import { describe, expect, it } from 'vitest';
import {
  PERMISSIONS,
  PRINCIPALS,
  ROLES,
  Role,
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
import { ID, ID2, LATER } from './harness';

const HERE = ID;
const OTHER = ID2;
const ME = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4aaa';
const P = 'booking.manage' as const;
const THEM = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4bbb';

function user(role: Role, over: Partial<SessionUser> = {}): SessionUser {
  return { id: ME, name: 'Test', role, officeId: role === 'platform_admin' ? null : HERE, mustChangePassword: false, expiresAt: LATER, version: 1, ...over };
}

// Written from the design.md Route map, not from the code under test.
const EXPECTED: Record<GuardedPermission, Principal[]> = {
  'account.password': ['platform_admin', 'office_admin', 'employee', 'receptionist'],
  'office.manage': ['platform_admin'],
  'office.hours': ['platform_admin'], // office admin is off until Open point 8 is signed
  'room.manage': ['platform_admin', 'office_admin'],
  'user.manage': ['platform_admin', 'office_admin'],
  'import.run': ['platform_admin', 'office_admin'],
  'booking.create': ['platform_admin', 'office_admin', 'employee', 'receptionist'],
  'booking.manage': ['platform_admin', 'office_admin', 'employee', 'receptionist'],
  'visit.create': ['platform_admin', 'office_admin', 'employee', 'receptionist'],
  'visit.cancel': ['platform_admin', 'office_admin', 'employee', 'receptionist'],
  'visit.seen': ['platform_admin', 'office_admin', 'employee', 'receptionist'],
  'visit.desk': ['platform_admin', 'office_admin', 'receptionist'],
  'history.view': ['platform_admin', 'office_admin', 'receptionist'],
  'report.view': ['platform_admin', 'office_admin', 'receptionist'],
  'job.purge': ['system'],
  'job.prune': ['system'],
};

const guarded = PERMISSIONS.filter((p): p is GuardedPermission => p !== 'public');

describe('E-001/AC-01 four fixed roles', () => {
  it('E-001/AC-01 the Role enum holds exactly platform_admin, office_admin, employee and receptionist', () => {
    expect([...ROLES]).toEqual(['platform_admin', 'office_admin', 'employee', 'receptionist']);
    expect(Role.safeParse('system').success).toBe(false);
    expect(Role.safeParse('admin').success).toBe(false);
  });

  it('E-001/AC-01 the worker is a fifth principal, not a role', () => {
    expect([...PRINCIPALS]).toEqual([...ROLES, 'system']);
  });
});

describe('E-001/AC-01 permission matrix', () => {
  it('E-001/AC-01 has one row for each permission key and none for public', () => {
    expect(Object.keys(matrix).sort()).toEqual([...guarded].sort());
    expect(Object.keys(matrix)).not.toContain('public');
    expect(Object.keys(EXPECTED).sort()).toEqual([...guarded].sort());
  });

  for (const permission of guarded) {
    for (const principal of PRINCIPALS) {
      const allowed = EXPECTED[permission].includes(principal);
      it(`E-001/AC-01 ${principal} ${allowed ? 'may' : 'may not'} use ${permission}`, () => {
        expect(matrix[permission][principal]).toBe(allowed);
        const session: Session = principal === 'system' ? { role: 'system' } : user(principal);
        expect(can(session, permission)).toBe(allowed);
        if (allowed) {
          expect(() => requirePermission(session, permission)).not.toThrow();
        } else {
          expect(() => requirePermission(session, permission)).toThrow(ForbiddenError);
        }
      });
    }
  }

  it('E-001/AC-01 office.hours is off for office_admin until Open point 8 is signed', () => {
    expect(matrix['office.hours'].office_admin).toBe(false);
  });

  it('E-001/AC-01 every cell is a boolean for every principal', () => {
    for (const permission of guarded) {
      expect(Object.keys(matrix[permission]).sort()).toEqual([...PRINCIPALS].sort());
      for (const principal of PRINCIPALS) expect(typeof matrix[permission][principal]).toBe('boolean');
    }
  });
});

describe('E-001/AC-01 requirePermission', () => {
  it('E-001/AC-01 lets public through with no session', () => {
    expect(() => requirePermission(null, 'public')).not.toThrow();
    expect(can(null, 'public')).toBe(true);
  });

  it('E-001/AC-01 gives 401 to a missing session on every guarded key', () => {
    for (const permission of guarded) {
      expect(() => requirePermission(null, permission)).toThrow(UnauthorizedError);
      expect(can(null, permission)).toBe(false);
    }
  });

  it('E-001/AC-01 denies an unknown key by default', () => {
    // @ts-expect-error a key outside the list must never pass
    expect(() => requirePermission(user('platform_admin'), 'made.up')).toThrow();
  });

  it('E-001/AC-01 allows only account.password while must_change_password is set', () => {
    const fresh = user('platform_admin', { mustChangePassword: true });
    expect(() => requirePermission(fresh, 'account.password')).not.toThrow();
    for (const permission of guarded.filter((p) => p !== 'account.password')) {
      expect(() => requirePermission(fresh, permission)).toThrow(PasswordChangeRequiredError);
    }
    expect(() => requirePermission(fresh, 'public')).not.toThrow();
  });

  it('E-001/AC-01 PasswordChangeRequiredError is a 403 forbidden problem', () => {
    const e = new PasswordChangeRequiredError();
    expect(e).toBeInstanceOf(ForbiddenError);
    expect(e.status).toBe(403);
    expect(e.type).toBe('forbidden');
  });
});

describe('E-001/AC-01 scopeFor', () => {
  const booking = (officeId: string, ownerId: string): Resource => ({ kind: 'booking', officeId, ownerId });
  const visit = (officeId: string, hostId: string): Resource => ({ kind: 'visit', officeId, hostId });

  it('E-001/AC-01 platform_admin reaches every record', () => {
    const s = user('platform_admin');
    for (const r of [booking(OTHER, THEM), visit(OTHER, THEM), { kind: 'office', officeId: OTHER }, { kind: 'room', officeId: OTHER }] satisfies Resource[]) {
      expect(scopeFor(s, P, r)).toBe('allow');
    }
    expect(scopeFor(s, P, { kind: 'user', userId: THEM, officeId: null, role: 'platform_admin' })).toBe('allow');
  });

  it('E-001/AC-05 other-office records give not-found for office_admin, receptionist and employee', () => {
    for (const role of ['office_admin', 'receptionist', 'employee'] as const) {
      const s = user(role);
      expect(scopeFor(s, P, booking(OTHER, THEM))).toBe('not-found');
      expect(scopeFor(s, P, visit(OTHER, THEM))).toBe('not-found');
      expect(scopeFor(s, P, { kind: 'office', officeId: OTHER })).toBe('not-found');
      expect(scopeFor(s, P, { kind: 'room', officeId: OTHER })).toBe('not-found');
      expect(scopeFor(s, P, { kind: 'user', userId: THEM, officeId: OTHER, role: 'employee' })).toBe('not-found');
    }
  });

  it('E-001/AC-06 same-office records without the right give forbidden for an employee', () => {
    const s = user('employee');
    expect(scopeFor(s, P, booking(HERE, THEM))).toBe('forbidden');
    expect(scopeFor(s, P, visit(HERE, THEM))).toBe('forbidden');
    expect(scopeFor(s, P, { kind: 'room', officeId: HERE })).toBe('forbidden');
  });

  it('E-001/AC-01 own bookings and visits match at any office', () => {
    for (const role of ROLES) {
      const s = user(role);
      expect(scopeFor(s, P, booking(OTHER, ME))).toBe('allow');
      expect(scopeFor(s, P, visit(OTHER, ME))).toBe('allow');
    }
  });

  it('E-001/AC-01 office_admin and receptionist reach same-office bookings and visits', () => {
    for (const role of ['office_admin', 'receptionist'] as const) {
      const s = user(role);
      expect(scopeFor(s, P, booking(HERE, THEM))).toBe('allow');
      expect(scopeFor(s, P, visit(HERE, THEM))).toBe('allow');
      expect(scopeFor(s, P, { kind: 'office', officeId: HERE })).toBe('allow');
    }
  });

  it('E-001/AC-16 an office admin reaches employees and receptionists of the office only', () => {
    const s = user('office_admin');
    expect(scopeFor(s, P, { kind: 'user', userId: THEM, officeId: HERE, role: 'employee' })).toBe('allow');
    expect(scopeFor(s, P, { kind: 'user', userId: THEM, officeId: HERE, role: 'receptionist' })).toBe('allow');
    expect(scopeFor(s, P, { kind: 'user', userId: THEM, officeId: HERE, role: 'office_admin' })).toBe('forbidden');
    expect(scopeFor(s, P, { kind: 'user', userId: THEM, officeId: null, role: 'platform_admin' })).toBe('not-found');
  });

  it('E-001/AC-01 a receptionist and an employee never reach another user record', () => {
    for (const role of ['receptionist', 'employee'] as const) {
      expect(scopeFor(user(role), P, { kind: 'user', userId: THEM, officeId: HERE, role: 'employee' })).toBe('forbidden');
    }
  });

  it('E-001/AC-01 account scope is self only', () => {
    expect(scopeFor(user('employee'), P, { kind: 'account', userId: ME })).toBe('allow');
    expect(scopeFor(user('employee'), P, { kind: 'account', userId: THEM })).toBe('not-found');
  });

  it('E-001/AC-01 the system principal reaches visits and offices only', () => {
    const s: Session = { role: 'system' };
    expect(scopeFor(s, P, visit(HERE, THEM))).toBe('allow');
    expect(scopeFor(s, P, { kind: 'office', officeId: HERE })).toBe('allow');
    expect(scopeFor(s, P, booking(HERE, THEM))).toBe('forbidden');
    expect(scopeFor(s, P, { kind: 'user', userId: THEM, officeId: HERE, role: 'employee' })).toBe('forbidden');
  });

  it('E-001/AC-01 no session reaches nothing', () => {
    expect(scopeFor(null, P, booking(HERE, ME))).toBe('forbidden');
  });

  it('E-001/AC-01 visit.seen is host only for every role, platform admin included', () => {
    for (const role of ROLES) {
      const s = user(role);
      expect(scopeFor(s, 'visit.seen', visit(OTHER, ME))).toBe('allow');
      expect(scopeFor(s, 'visit.seen', visit(HERE, THEM))).toBe(role === 'platform_admin' ? 'not-found' : 'forbidden');
      expect(scopeFor(s, 'visit.seen', visit(OTHER, THEM))).toBe('not-found');
      expect(scopeFor(s, 'visit.seen', booking(HERE, ME))).toBe('forbidden');
    }
  });

  it('E-001/AC-01 requireScope throws 404 and 403 and passes on allow', () => {
    expect(() => requireScope(user('employee'), P, booking(OTHER, THEM))).toThrow(NotFoundError);
    expect(() => requireScope(user('employee'), P, booking(HERE, THEM))).toThrow(ForbiddenError);
    expect(() => requireScope(user('employee'), P, booking(HERE, ME))).not.toThrow();
  });
});
