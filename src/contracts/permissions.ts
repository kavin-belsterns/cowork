// Purpose: roles, the permission matrix, requirePermission() and scopeFor(). Written by story S-00 only.
// Rules: standards/security.md. Deny by default. Every route.ts and actions.ts calls requirePermission( (ci/check-auth-in-actions.sh).
// 'public' is the explicit way to say an endpoint needs no login. It still has to be written down.
// Source of the keys: design.md Route map. Source of the reach rules: design.md Security, first bullet (AC-05, AC-06, AC-16, AC-28).
import { z } from 'zod';
import type { SessionUser } from '@/contracts/auth';
import { ForbiddenError, NotFoundError, PasswordChangeRequiredError, UnauthorizedError } from '@/lib/errors';

/** Four fixed roles (AC-01). Same values as the Postgres `role` enum. */
export const ROLES = ['platform_admin', 'office_admin', 'employee', 'receptionist'] as const;
export const Role = z.enum(ROLES);
export type Role = z.infer<typeof Role>;

/** The four roles plus the worker. `system` never signs in and never appears in the `role` enum. */
export const PRINCIPALS = [...ROLES, 'system'] as const;
export type Principal = (typeof PRINCIPALS)[number];

export const PERMISSIONS = [
  'public',
  'account.password',
  'office.manage',
  'office.hours',
  'room.manage',
  'user.manage',
  'import.run',
  'booking.create',
  'booking.manage',
  'visit.create',
  'visit.cancel',
  'visit.seen',
  'visit.desk',
  'history.view',
  'report.view',
  'job.purge',
  'job.prune',
] as const;
export type Permission = (typeof PERMISSIONS)[number];
export type GuardedPermission = Exclude<Permission, 'public'>;

export type SystemPrincipal = { role: 'system' };
export type Actor = SessionUser | SystemPrincipal;
/** null means no session. */
export type Session = Actor | null;

const allow = (...who: Principal[]): Record<Principal, boolean> =>
  Object.fromEntries(PRINCIPALS.map((p) => [p, who.includes(p)])) as Record<Principal, boolean>;

const everyone = ROLES;
const staff = ['platform_admin', 'office_admin', 'receptionist'] as const;

/**
 * One row per permission key, one column per principal. Missing means deny.
 * A true cell says the role may try the action. scopeFor() then limits it to the records the role may reach.
 */
export const matrix: Record<GuardedPermission, Record<Principal, boolean>> = {
  'account.password': allow(...everyone),
  'office.manage': allow('platform_admin'),
  // Open point 8: office admins may edit their own office hours only after the signer agrees. Off until then.
  'office.hours': allow('platform_admin'),
  'room.manage': allow('platform_admin', 'office_admin'),
  'user.manage': allow('platform_admin', 'office_admin'),
  'import.run': allow('platform_admin', 'office_admin'),
  'booking.create': allow(...everyone),
  'booking.manage': allow(...everyone),
  'visit.create': allow(...everyone),
  'visit.cancel': allow(...everyone),
  'visit.seen': allow(...everyone),
  'visit.desk': allow(...staff),
  'history.view': allow(...staff),
  'report.view': allow(...staff),
  'job.purge': allow('system'),
  'job.prune': allow('system'),
};

export function can(session: Session, permission: Permission): boolean {
  if (permission === 'public') return true;
  return session !== null && matrix[permission][session.role] === true;
}

/**
 * Throws UnauthorizedError (401) with no session and ForbiddenError (403) with the wrong role.
 * While must_change_password is set, every key except account.password throws PasswordChangeRequiredError (403).
 * Record ownership is checked separately with scopeFor().
 */
export function requirePermission(session: Session, permission: 'public'): void;
export function requirePermission(session: Session, permission: GuardedPermission): asserts session is NonNullable<Session>;
export function requirePermission(session: Session, permission: Permission): void;
export function requirePermission(session: Session, permission: Permission): void {
  if (permission === 'public') return;
  if (session === null) throw new UnauthorizedError();
  if ('mustChangePassword' in session && session.mustChangePassword && permission !== 'account.password') {
    throw new PasswordChangeRequiredError();
  }
  if (!matrix[permission][session.role]) throw new ForbiddenError();
}

/** The record a caller wants to reach. `officeId` is the record's office. */
export type Resource =
  | { kind: 'office'; officeId: string }
  | { kind: 'room'; officeId: string }
  | { kind: 'user'; userId: string; officeId: string | null; role: Role }
  | { kind: 'account'; userId: string }
  | { kind: 'booking'; officeId: string; ownerId: string }
  | { kind: 'visit'; officeId: string; hostId: string };

/** allow, forbidden (same office, no right: 403) or not-found (other office: 404, AC-05). */
export type Scope = 'allow' | 'forbidden' | 'not-found';

const sameOffice = (session: SessionUser, officeId: string | null) => officeId !== null && session.officeId === officeId;

/**
 * Decide whether the caller reaches one record. Call it after requirePermission().
 * Own bookings and visits match owner or host at any office. Other records match the caller's office.
 */
export function scopeFor(session: Session, permission: Permission, resource: Resource): Scope {
  if (session === null) return 'forbidden';
  if (session.role === 'system') return resource.kind === 'visit' || resource.kind === 'office' ? 'allow' : 'forbidden';
  // visit.seen is host only: every role, platform admin included, needs to be the host (design.md Route map).
  if (permission === 'visit.seen') {
    if (resource.kind !== 'visit') return 'forbidden';
    if (resource.hostId === session.id) return 'allow';
    return sameOffice(session, resource.officeId) ? 'forbidden' : 'not-found';
  }
  if (session.role === 'platform_admin') return 'allow';

  const here = 'officeId' in resource && sameOffice(session, resource.officeId);
  const miss: Scope = here ? 'forbidden' : 'not-found';

  switch (resource.kind) {
    case 'account':
      return resource.userId === session.id ? 'allow' : 'not-found';
    case 'booking':
      if (resource.ownerId === session.id) return 'allow';
      return here && session.role !== 'employee' ? 'allow' : miss;
    case 'visit':
      if (resource.hostId === session.id) return 'allow';
      return here && session.role !== 'employee' ? 'allow' : miss;
    case 'office':
    case 'room':
      return here && session.role !== 'employee' ? 'allow' : miss;
    case 'user':
      if (resource.officeId === null) return 'not-found';
      if (!here) return 'not-found';
      // An office admin reaches only employees and receptionists of the office (AC-15, AC-16).
      return session.role === 'office_admin' && (resource.role === 'employee' || resource.role === 'receptionist') ? 'allow' : 'forbidden';
  }
}

/** Throws NotFoundError (404) or ForbiddenError (403) unless scopeFor() says allow. */
export function requireScope(session: Session, permission: Permission, resource: Resource): void {
  const scope = scopeFor(session, permission, resource);
  if (scope === 'not-found') throw new NotFoundError();
  if (scope === 'forbidden') throw new ForbiddenError();
}
