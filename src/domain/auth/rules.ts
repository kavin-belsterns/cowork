// Purpose: the sign-in and session rules as pure functions. No database, no framework, no clock of their own.
// Rules: standards/rules-home.md, spec S01 sections 1 and 5, design.md Security. Callers pass `now`.
// Counts come from src/data/sign-in-attempt.ts. Rules decide what a count means.
import type { Role } from '@/contracts/permissions';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

export const LOCKOUT_FAILURES = 5;
export const LOCKOUT_WINDOW_MS = 15 * MINUTE_MS;
/**
 * Retry-After for a lock, in seconds. Derived from the window so the two cannot drift.
 *
 * @remarks A locked sign-in answers with Retry-After set to the 15 minute window, which is 900 seconds.
 * @example RETRY_AFTER_SECONDS is 900.
 * @ears E-001/AC-48
 */
export const RETRY_AFTER_SECONDS = LOCKOUT_WINDOW_MS / 1000;
export const IP_DELAY_FROM = 30;
export const IP_BLOCK_FROM = 100;
export const IP_DELAY_STEP_MS = 1000;
export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;
export const SESSION_LENGTH_MS = 12 * HOUR_MS;
export const SESSION_WARNING_MS = 5 * MINUTE_MS;
export const FORCED_CHANGE_PATH = '/account/password';

/**
 * Start of the failure window. A failure at exactly this instant still counts.
 *
 * @remarks Failures count when they happened in the last 15 minutes, edge included.
 * @example windowStart(new Date('2026-11-14T10:15:00Z')) is 10:00:00Z.
 * @ears E-001/AC-48
 */
export function windowStart(now: Date): Date {
  return new Date(now.getTime() - LOCKOUT_WINDOW_MS);
}

/**
 * Whether an email hash is locked.
 *
 * @remarks Sliding window. Locked while 5 or more failures fall in the last 15 minutes. Old failures age out one by one, so the lock lifts when the count drops below 5.
 * @example isLockedOut(4) is false. isLockedOut(5) is true.
 * @ears E-001/AC-48
 */
export function isLockedOut(failuresInWindow: number): boolean {
  return failuresInWindow >= LOCKOUT_FAILURES;
}

export type IpDecision = { action: 'allow' } | { action: 'delay'; delayMs: number } | { action: 'block' };

/**
 * What to do with a client IP, from the distinct email hashes it tried in 15 minutes.
 *
 * @remarks Below 30 the IP is free. From 30 each attempt waits 1 s more for every further email. From 100 the IP is blocked.
 * @example ipDecision(30) waits 1000 ms. ipDecision(31) waits 2000 ms. ipDecision(100) blocks.
 * @ears E-001/AC-48
 */
export function ipDecision(distinctEmails: number): IpDecision {
  if (distinctEmails >= IP_BLOCK_FROM) return { action: 'block' };
  if (distinctEmails >= IP_DELAY_FROM) return { action: 'delay', delayMs: (distinctEmails - IP_DELAY_FROM + 1) * IP_DELAY_STEP_MS };
  return { action: 'allow' };
}

/**
 * Whether a new password has an allowed length.
 *
 * @remarks A new password needs 12 to 128 characters. Under 12 gets "Use at least 12 characters."
 * @example isPasswordLengthValid('a'.repeat(11)) is false. 12 and 128 are true.
 * @ears E-001/AC-72
 */
export function isPasswordLengthValid(password: string): boolean {
  return password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX;
}

/**
 * End of a session that starts now.
 *
 * @remarks A session ends 12 hours after it starts. Activity does not extend it.
 * @example sessionExpiresAt(10:00Z) is 22:00Z the same day.
 * @ears E-001/AC-71
 */
export function sessionExpiresAt(start: Date): Date {
  return new Date(start.getTime() + SESSION_LENGTH_MS);
}

/**
 * Whether a session has ended. The end instant itself counts as ended.
 *
 * @remarks A session is over at its expiry time.
 * @example isSessionExpired(expiresAt, expiresAt) is true.
 * @ears E-001/AC-71
 */
export function isSessionExpired(expiresAt: Date, now: Date): boolean {
  return expiresAt.getTime() <= now.getTime();
}

/**
 * When the page warns that the session is about to end.
 *
 * @remarks The warning shows 5 minutes before the 12 hour end.
 * @example sessionWarningAt(22:00Z) is 21:55Z.
 * @ears E-001/AC-71
 */
export function sessionWarningAt(expiresAt: Date): Date {
  return new Date(expiresAt.getTime() - SESSION_WARNING_MS);
}

/**
 * Whether the warning shows now. It stops once the session has ended.
 *
 * @remarks Warn from 5 minutes before the end until the end.
 * @example shouldWarn(22:00Z, 21:55Z) is true. At 21:54:59Z it is false.
 * @ears E-001/AC-71
 */
export function shouldWarn(expiresAt: Date, now: Date): boolean {
  return now.getTime() >= sessionWarningAt(expiresAt).getTime() && !isSessionExpired(expiresAt, now);
}

/**
 * Landing path per role.
 *
 * @remarks Platform admin goes to offices. Office admin and receptionist go to reception. Employee goes to rooms.
 * @example roleHome('employee') is '/rooms'.
 * @ears E-001/AC-47
 */
export function roleHome(role: Role): string {
  switch (role) {
    case 'platform_admin':
      return '/admin/offices';
    case 'office_admin':
    case 'receptionist':
      return '/reception';
    case 'employee':
      return '/rooms';
  }
}

/**
 * Where sign-in sends the user. A forced change comes first.
 *
 * @remarks A user with must_change_password sets a new password first. Else the checked return path, else the role home.
 * @example signInDestination('employee', true, '/rooms') is '/account/password'.
 * @ears E-001/AC-49
 */
export function signInDestination(role: Role, mustChangePassword: boolean, checkedReturnTo: string | undefined): string {
  if (mustChangePassword) return FORCED_CHANGE_PATH;
  return checkedReturnTo ?? roleHome(role);
}

/**
 * Whether a temporary password has run out. No expiry means it has not.
 *
 * @remarks A temporary password expires at its expiry time. The check runs only after the password verifies.
 * @example isTempPasswordExpired(null, now) is false.
 * @ears E-001/AC-49
 */
export function isTempPasswordExpired(expiresAt: Date | null, now: Date): boolean {
  return expiresAt !== null && expiresAt.getTime() <= now.getTime();
}

export type AccountBlock = 'inactive' | 'temp_expired';

/**
 * Whether a verified user may sign in. Call it only after the password verified.
 *
 * @remarks A deactivated user gets "This account is not active." A lapsed temporary password gets its own message. Inactive wins.
 * @example accountBlock({ deactivated: true, tempPasswordExpiresAt: null }, now) is 'inactive'.
 * @ears E-001/AC-84
 */
export function accountBlock(user: { deactivated: boolean; tempPasswordExpiresAt: Date | null }, now: Date): AccountBlock | null {
  if (user.deactivated) return 'inactive';
  if (isTempPasswordExpired(user.tempPasswordExpiresAt, now)) return 'temp_expired';
  return null;
}
