// Purpose: unit tests for src/domain/auth/rules.ts. Pure functions, no mocks.
// Rules: spec S01 section 6, standards/rules-home.md (each rule test names its EARS ID).
import { describe, expect, it } from 'vitest';
import {
  LOCKOUT_WINDOW_MS,
  RETRY_AFTER_SECONDS,
  accountBlock,
  ipDecision,
  isLockedOut,
  isPasswordLengthValid,
  isSessionExpired,
  isTempPasswordExpired,
  roleHome,
  sessionExpiresAt,
  sessionWarningAt,
  shouldWarn,
  signInDestination,
  windowStart,
} from '@/domain/auth/rules';

const now = new Date('2026-11-14T10:00:00.000Z');
const at = (iso: string) => new Date(iso);

describe('E-001/AC-48 lockout', () => {
  it('stays open at 4 failures and locks at 5', () => {
    expect(isLockedOut(0)).toBe(false);
    expect(isLockedOut(4)).toBe(false);
    expect(isLockedOut(5)).toBe(true);
    expect(isLockedOut(6)).toBe(true);
  });

  it('starts the window exactly 15 minutes back', () => {
    expect(windowStart(at('2026-11-14T10:15:00.000Z')).toISOString()).toBe('2026-11-14T10:00:00.000Z');
  });

  it('derives Retry-After from the window: 900 seconds', () => {
    expect(RETRY_AFTER_SECONDS).toBe(900);
    expect(RETRY_AFTER_SECONDS * 1000).toBe(LOCKOUT_WINDOW_MS);
  });
});

describe('E-001/AC-48 IP limit', () => {
  it('allows below 30 distinct emails', () => {
    expect(ipDecision(0)).toEqual({ action: 'allow' });
    expect(ipDecision(29)).toEqual({ action: 'allow' });
  });

  it('delays 1 s at 30 and 1 s more for each further email', () => {
    expect(ipDecision(30)).toEqual({ action: 'delay', delayMs: 1000 });
    expect(ipDecision(31)).toEqual({ action: 'delay', delayMs: 2000 });
    expect(ipDecision(99)).toEqual({ action: 'delay', delayMs: 70_000 });
  });

  it('blocks from 100', () => {
    expect(ipDecision(100)).toEqual({ action: 'block' });
    expect(ipDecision(500)).toEqual({ action: 'block' });
  });
});

describe('E-001/AC-72 password length', () => {
  it('rejects 11, accepts 12 and 128, rejects 129', () => {
    expect(isPasswordLengthValid('a'.repeat(11))).toBe(false);
    expect(isPasswordLengthValid('a'.repeat(12))).toBe(true);
    expect(isPasswordLengthValid('a'.repeat(128))).toBe(true);
    expect(isPasswordLengthValid('a'.repeat(129))).toBe(false);
  });
});

describe('E-001/AC-71 session length', () => {
  it('ends 12 hours after the start', () => {
    expect(sessionExpiresAt(now).toISOString()).toBe('2026-11-14T22:00:00.000Z');
  });

  it('counts the end instant as expired and one ms before as live', () => {
    const end = sessionExpiresAt(now);
    expect(isSessionExpired(end, new Date(end.getTime() - 1))).toBe(false);
    expect(isSessionExpired(end, end)).toBe(true);
  });

  it('warns 5 minutes before the end and stops at the end', () => {
    const end = sessionExpiresAt(now);
    expect(sessionWarningAt(end).toISOString()).toBe('2026-11-14T21:55:00.000Z');
    expect(shouldWarn(end, at('2026-11-14T21:54:59.999Z'))).toBe(false);
    expect(shouldWarn(end, at('2026-11-14T21:55:00.000Z'))).toBe(true);
    expect(shouldWarn(end, end)).toBe(false);
  });
});

describe('E-001/AC-47 role home', () => {
  it('maps each role', () => {
    expect(roleHome('platform_admin')).toBe('/admin/offices');
    expect(roleHome('office_admin')).toBe('/reception');
    expect(roleHome('receptionist')).toBe('/reception');
    expect(roleHome('employee')).toBe('/rooms');
  });

  it('uses the checked return path before the role home', () => {
    expect(signInDestination('employee', false, '/bookings')).toBe('/bookings');
    expect(signInDestination('employee', false, undefined)).toBe('/rooms');
  });
});

describe('E-001/AC-49 forced change and temp password', () => {
  it('sends a must-change user to the password page first', () => {
    expect(signInDestination('platform_admin', true, '/admin/offices')).toBe('/account/password');
  });

  it('expires a temp password at its time and never when null', () => {
    expect(isTempPasswordExpired(null, now)).toBe(false);
    expect(isTempPasswordExpired(at('2026-11-14T10:00:00.001Z'), now)).toBe(false);
    expect(isTempPasswordExpired(now, now)).toBe(true);
  });
});

describe('E-001/AC-84 account block', () => {
  it('blocks a deactivated user first', () => {
    expect(accountBlock({ deactivated: true, tempPasswordExpiresAt: at('2026-11-01T00:00:00Z') }, now)).toBe('inactive');
  });

  it('blocks an expired temp password', () => {
    expect(accountBlock({ deactivated: false, tempPasswordExpiresAt: at('2026-11-01T00:00:00Z') }, now)).toBe('temp_expired');
  });

  it('lets an active user with a live or no temp password in', () => {
    expect(accountBlock({ deactivated: false, tempPasswordExpiresAt: null }, now)).toBeNull();
    expect(accountBlock({ deactivated: false, tempPasswordExpiresAt: at('2026-11-20T00:00:00Z') }, now)).toBeNull();
  });
});
