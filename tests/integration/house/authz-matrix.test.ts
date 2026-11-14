// Purpose: Integration house tests for the authorization matrix walker and record scoping.
// Rules: standards/testing.md, standards/security.md. Deny by default, 401 on missing session, 403 on wrong role, 404 on cross-office.
import { describe, expect, it } from 'vitest';
import {
  PERMISSIONS,
  PRINCIPALS,
  ROLES,
  can,
  matrix,
  requirePermission,
  requireScope,
  scopeFor,
  type GuardedPermission,
  type Principal,
  type Resource,
  type Session,
} from '@/contracts/permissions';
import type { SessionUser } from '@/contracts/auth';
import { ForbiddenError, NotFoundError, PasswordChangeRequiredError, UnauthorizedError } from '@/lib/errors';

export const TEST_OFFICE_A = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f0001';
export const TEST_OFFICE_B = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f0002';
export const USER_ALICE = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3fa001';
export const USER_BOB = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3fb002';

export function makeSession(role: Principal, overrides: Partial<SessionUser> = {}): Session {
  if (role === 'system') return { role: 'system' };
  return {
    id: USER_ALICE,
    name: 'Test Actor',
    role,
    officeId: role === 'platform_admin' ? null : TEST_OFFICE_A,
    mustChangePassword: false,
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    version: 1,
    ...overrides,
  };
}

describe('House Authz Matrix Walker: verifying all role x permission combinations', () => {
  const guardedPermissions = PERMISSIONS.filter((p): p is GuardedPermission => p !== 'public');

  describe('Public endpoints', () => {
    it('allows access with no session', () => {
      expect(can(null, 'public')).toBe(true);
      expect(() => requirePermission(null, 'public')).not.toThrow();
    });

    it('allows access with any authenticated role or system principal', () => {
      for (const principal of PRINCIPALS) {
        const session = makeSession(principal);
        expect(can(session, 'public')).toBe(true);
        expect(() => requirePermission(session, 'public')).not.toThrow();
      }
    });
  });

  describe('Unauthenticated access (session is null)', () => {
    it('rejects every guarded permission with 401 UnauthorizedError', () => {
      for (const perm of guardedPermissions) {
        expect(can(null, perm)).toBe(false);
        expect(() => requirePermission(null, perm)).toThrow(UnauthorizedError);
      }
    });
  });

  describe('Password change requirement guard', () => {
    it('blocks all guarded permissions except account.password when mustChangePassword is true', () => {
      for (const role of ROLES) {
        const session = makeSession(role, { mustChangePassword: true });
        for (const perm of guardedPermissions) {
          if (perm === 'account.password') {
            expect(() => requirePermission(session, perm)).not.toThrow();
          } else {
            expect(() => requirePermission(session, perm)).toThrow(PasswordChangeRequiredError);
          }
        }
      }
    });
  });

  describe('Full matrix walker: Principal x Permission', () => {
    it('enforces exact permission rules across all principals and guarded permissions', () => {
      for (const perm of guardedPermissions) {
        for (const principal of PRINCIPALS) {
          const session = makeSession(principal);
          const expectedAllowed = matrix[perm][principal];

          expect(can(session, perm)).toBe(expectedAllowed);

          if (expectedAllowed) {
            expect(() => requirePermission(session, perm)).not.toThrow();
          } else {
            expect(() => requirePermission(session, perm)).toThrow(ForbiddenError);
          }
        }
      }
    });
  });

  describe('Record Scoping (scopeFor and requireScope IDOR prevention)', () => {
    describe('Booking resource scoping', () => {
      const ownBooking: Resource = { kind: 'booking', officeId: TEST_OFFICE_A, ownerId: USER_ALICE };
      const sameOfficeOtherBooking: Resource = { kind: 'booking', officeId: TEST_OFFICE_A, ownerId: USER_BOB };
      const otherOfficeBooking: Resource = { kind: 'booking', officeId: TEST_OFFICE_B, ownerId: USER_BOB };

      it('allows owner to reach booking regardless of role', () => {
        for (const role of ROLES) {
          const session = makeSession(role);
          expect(scopeFor(session, 'booking.manage', ownBooking)).toBe('allow');
          expect(() => requireScope(session, 'booking.manage', ownBooking)).not.toThrow();
        }
      });

      it('allows platform_admin to reach any booking', () => {
        const adminSession = makeSession('platform_admin');
        expect(scopeFor(adminSession, 'booking.manage', otherOfficeBooking)).toBe('allow');
        expect(() => requireScope(adminSession, 'booking.manage', otherOfficeBooking)).not.toThrow();
      });

      it('allows office_admin and receptionist to manage same-office bookings, but rejects other-office with 404', () => {
        for (const staffRole of ['office_admin', 'receptionist'] as const) {
          const staff = makeSession(staffRole);
          expect(scopeFor(staff, 'booking.manage', sameOfficeOtherBooking)).toBe('allow');
          expect(scopeFor(staff, 'booking.manage', otherOfficeBooking)).toBe('not-found');
          expect(() => requireScope(staff, 'booking.manage', otherOfficeBooking)).toThrow(NotFoundError);
        }
      });

      it('forbids employee from managing another users same-office booking with 403', () => {
        const employee = makeSession('employee');
        expect(scopeFor(employee, 'booking.manage', sameOfficeOtherBooking)).toBe('forbidden');
        expect(() => requireScope(employee, 'booking.manage', sameOfficeOtherBooking)).toThrow(ForbiddenError);
      });
    });

    describe('Visit resource scoping', () => {
      const ownVisit: Resource = { kind: 'visit', officeId: TEST_OFFICE_A, hostId: USER_ALICE };
      const otherVisitSameOffice: Resource = { kind: 'visit', officeId: TEST_OFFICE_A, hostId: USER_BOB };
      const otherVisitOtherOffice: Resource = { kind: 'visit', officeId: TEST_OFFICE_B, hostId: USER_BOB };

      it('allows host to reach visit record', () => {
        const host = makeSession('employee');
        expect(scopeFor(host, 'visit.cancel', ownVisit)).toBe('allow');
      });

      it('visit.seen is strictly host only for all roles including platform_admin', () => {
        const admin = makeSession('platform_admin', { id: 'admin-123' });
        expect(scopeFor(admin, 'visit.seen', ownVisit)).toBe('not-found');
        expect(() => requireScope(admin, 'visit.seen', ownVisit)).toThrow(NotFoundError);

        const hostAdmin = makeSession('platform_admin', { id: USER_ALICE });
        expect(scopeFor(hostAdmin, 'visit.seen', ownVisit)).toBe('allow');
      });

      it('returns not-found (404) for cross-office visit and forbidden (403) for unauthorized same-office visit', () => {
        const employee = makeSession('employee');
        expect(scopeFor(employee, 'visit.cancel', otherVisitSameOffice)).toBe('forbidden');
        expect(() => requireScope(employee, 'visit.cancel', otherVisitSameOffice)).toThrow(ForbiddenError);

        expect(scopeFor(employee, 'visit.cancel', otherVisitOtherOffice)).toBe('not-found');
        expect(() => requireScope(employee, 'visit.cancel', otherVisitOtherOffice)).toThrow(NotFoundError);
      });
    });

    describe('User resource scoping', () => {
      const sameOfficeEmp: Resource = { kind: 'user', userId: USER_BOB, officeId: TEST_OFFICE_A, role: 'employee' };
      const sameOfficeRecep: Resource = { kind: 'user', userId: USER_BOB, officeId: TEST_OFFICE_A, role: 'receptionist' };
      const sameOfficeOtherAdmin: Resource = { kind: 'user', userId: USER_BOB, officeId: TEST_OFFICE_A, role: 'office_admin' };
      const otherOfficeEmp: Resource = { kind: 'user', userId: USER_BOB, officeId: TEST_OFFICE_B, role: 'employee' };

      it('allows platform_admin to reach any user', () => {
        const admin = makeSession('platform_admin');
        expect(scopeFor(admin, 'user.manage', otherOfficeEmp)).toBe('allow');
      });

      it('allows office_admin to manage only employees and receptionists of own office', () => {
        const officeAdmin = makeSession('office_admin');
        expect(scopeFor(officeAdmin, 'user.manage', sameOfficeEmp)).toBe('allow');
        expect(scopeFor(officeAdmin, 'user.manage', sameOfficeRecep)).toBe('allow');

        // Cannot manage another office_admin (403)
        expect(scopeFor(officeAdmin, 'user.manage', sameOfficeOtherAdmin)).toBe('forbidden');
        expect(() => requireScope(officeAdmin, 'user.manage', sameOfficeOtherAdmin)).toThrow(ForbiddenError);

        // Cannot manage users from other offices (404)
        expect(scopeFor(officeAdmin, 'user.manage', otherOfficeEmp)).toBe('not-found');
        expect(() => requireScope(officeAdmin, 'user.manage', otherOfficeEmp)).toThrow(NotFoundError);
      });
    });
  });
});
