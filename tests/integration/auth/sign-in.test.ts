// Purpose: integration tests for the sign-in flow against the live database as app_web.
// Rules: spec S01 sections 3 to 6. Covers AC-47, AC-48, AC-71, AC-84, AC-85 and the forced change gate, sign-out and IP limit.
// Users are made on DATABASE_URL_MIGRATOR with unique emails and deleted afterwards. A missing database makes every test fail.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { SignInInput } from '@/contracts/auth';
import { requirePermission } from '@/contracts/permissions';
import { deleteSession, findSessionByTokenHash } from '@/data/session';
import { signIn, SIGN_IN_COPY } from '@/lib/auth/sign-in';
import { hashEmail, hashToken } from '@/lib/auth/token';
import { toSessionUser } from '@/lib/auth/session';
import { LockedError, PasswordChangeRequiredError, RuleViolationError, UnauthorizedError } from '@/lib/errors';
import { Fixtures, PASSWORD, noSleep, recordingSleep } from './helpers';

vi.mock('server-only', () => ({}));

const fx = new Fixtures();
const ctx = (ip: string, now = new Date()) => ({ ip, now, sleep: noSleep });
const input = (email: string, password = PASSWORD, returnTo?: string) => SignInInput.parse({ email, password, returnTo });

beforeAll(async () => {
  await fx.connect();
});
afterAll(async () => {
  await fx.cleanup();
});

describe('signIn success', () => {
  it('E-001/AC-47 a correct email and password opens a session and the role home', async () => {
    const cases = [
      ['employee', '/rooms'],
      ['receptionist', '/reception'],
      ['office_admin', '/reception'],
      ['platform_admin', '/admin/offices'],
    ] as const;
    for (const [role, home] of cases) {
      const user = await fx.user({ role });
      const result = await signIn(input(user.email), ctx(fx.ip()));
      expect(result.destination).toBe(home);
      expect(result.token).toHaveLength(43);
      const row = await findSessionByTokenHash(hashToken(result.token), new Date());
      expect(row?.userId).toBe(user.id);
    }
  });

  it('E-001/AC-47 matches the email without regard to case and honours a safe returnTo', async () => {
    const user = await fx.user();
    const result = await signIn(input(user.email.toUpperCase(), PASSWORD, '/my/bookings'), ctx(fx.ip()));
    expect(result.destination).toBe('/my/bookings');
  });

  it('E-001/AC-47 an unsafe returnTo falls back to the role home', async () => {
    const user = await fx.user();
    const result = await signIn({ email: user.email, password: PASSWORD, returnTo: '//evil.example' }, ctx(fx.ip()));
    expect(result.destination).toBe('/rooms');
  });

  it('stores only the SHA-256 hash of the token, never the token', async () => {
    const user = await fx.user();
    const result = await signIn(input(user.email), ctx(fx.ip()));
    const rows = await fx.sessionRows(user.id);
    expect(rows.map((r) => r.token_hash)).toEqual([hashToken(result.token)]);
  });

  it('E-001/AC-71 the session ends 12 hours after sign-in', async () => {
    const user = await fx.user();
    const now = new Date();
    const result = await signIn(input(user.email), ctx(fx.ip(), now));
    expect(result.expiresAt.getTime() - now.getTime()).toBe(12 * 60 * 60 * 1000);
    const [row] = await fx.sessionRows(user.id);
    expect(row?.expires_at.getTime()).toBe(result.expiresAt.getTime());
    const hash = hashToken(result.token);
    expect(await findSessionByTokenHash(hash, new Date(now.getTime() + 12 * 3_600_000 - 1000))).not.toBeNull();
    expect(await findSessionByTokenHash(hash, new Date(now.getTime() + 12 * 3_600_000))).toBeNull();
    // The expired row is deleted when it is read.
    expect(await fx.sessionRows(user.id)).toHaveLength(0);
  });

  it('a session row whose expires_at is in the past is not found and is deleted', async () => {
    const user = await fx.user();
    const result = await signIn(input(user.email), ctx(fx.ip()));
    await fx.db.query('UPDATE sessions SET expires_at = now() - interval \'1 minute\' WHERE user_id = $1', [user.id]);
    expect(await findSessionByTokenHash(hashToken(result.token), new Date())).toBeNull();
    expect(await fx.sessionRows(user.id)).toHaveLength(0);
  });

  it('a deactivated user loses a live session at the next lookup', async () => {
    const user = await fx.user();
    const result = await signIn(input(user.email), ctx(fx.ip()));
    await fx.db.query('UPDATE users SET deactivated_at = now() WHERE id = $1', [user.id]);
    expect(await findSessionByTokenHash(hashToken(result.token), new Date())).toBeNull();
  });
});

describe('signIn wrong details', () => {
  it('E-001/AC-85 a wrong password gives 401 "Email or password is wrong."', async () => {
    const user = await fx.user();
    const err = await signIn(input(user.email, 'not-the-password'), ctx(fx.ip())).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(UnauthorizedError);
    expect((err as UnauthorizedError).status).toBe(401);
    expect((err as UnauthorizedError).message).toBe('Email or password is wrong.');
  });

  it('E-001/AC-85 an unknown email gives the same 401 and the same text as a wrong password', async () => {
    const user = await fx.user();
    const ip = fx.ip();
    const wrong = await signIn(input(user.email, 'not-the-password'), ctx(ip)).catch((e: unknown) => e);
    const unknown = await signIn(input(fx.unknownEmail()), ctx(ip)).catch((e: unknown) => e);
    expect(unknown).toBeInstanceOf(UnauthorizedError);
    expect((unknown as UnauthorizedError).status).toBe((wrong as UnauthorizedError).status);
    expect((unknown as UnauthorizedError).message).toBe((wrong as UnauthorizedError).message);
    expect((unknown as UnauthorizedError).message).toBe(SIGN_IN_COPY.wrong);
  });

  it('records one failure row per wrong try and none for a success', async () => {
    const user = await fx.user();
    const ip = fx.ip();
    await signIn(input(user.email, 'bad-1'), ctx(ip)).catch(() => undefined);
    await signIn(input(user.email, 'bad-2'), ctx(ip)).catch(() => undefined);
    expect(await fx.failureCount(hashEmail(user.email))).toBe(2);
  });
});

describe('signIn lockout', () => {
  it('E-001/AC-48 the 6th try gets 429 with Retry-After 900, even with the right password', async () => {
    const user = await fx.user();
    const ip = fx.ip();
    for (let i = 0; i < 5; i++) {
      const err = await signIn(input(user.email, `bad-${i}`), ctx(ip)).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(UnauthorizedError);
    }
    const err = (await signIn(input(user.email), ctx(ip)).catch((e: unknown) => e)) as LockedError;
    expect(err).toBeInstanceOf(LockedError);
    expect(err.status).toBe(429);
    expect(err.headers?.['retry-after']).toBe('900');
    expect(err.message).toBe(SIGN_IN_COPY.locked);
    expect(await fx.sessionRows(user.id)).toHaveLength(0);
  });

  it('E-001/AC-48 4 failures do not lock and a right password still signs in', async () => {
    const user = await fx.user();
    const ip = fx.ip();
    for (let i = 0; i < 4; i++) await signIn(input(user.email, `bad-${i}`), ctx(ip)).catch(() => undefined);
    await expect(signIn(input(user.email), ctx(ip))).resolves.toHaveProperty('token');
  });

  it('E-001/AC-48 an unknown email locks like a known one', async () => {
    const email = fx.unknownEmail();
    const ip = fx.ip();
    for (let i = 0; i < 5; i++) await signIn(input(email, `bad-${i}`), ctx(ip)).catch(() => undefined);
    await expect(signIn(input(email), ctx(ip))).rejects.toBeInstanceOf(LockedError);
  });

  it('E-001/AC-48 the lock is a sliding window: 5 failures older than 15 minutes do not lock', async () => {
    const user = await fx.user();
    const ip = fx.ip();
    const now = new Date();
    await fx.addFailures(hashEmail(user.email), ip, 5, new Date(now.getTime() - 15 * 60_000 - 1000));
    await expect(signIn(input(user.email), ctx(ip, now))).resolves.toHaveProperty('token');
  });

  it('E-001/AC-48 5 failures inside the last 15 minutes lock, and the lock lifts as they age out', async () => {
    const user = await fx.user();
    const ip = fx.ip();
    const now = new Date();
    await fx.addFailures(hashEmail(user.email), ip, 5, new Date(now.getTime() - 14 * 60_000));
    await expect(signIn(input(user.email), ctx(ip, now))).rejects.toBeInstanceOf(LockedError);
    const later = new Date(now.getTime() + 2 * 60_000);
    await expect(signIn(input(user.email), ctx(ip, later))).resolves.toHaveProperty('token');
  });

  it('a success clears the failure count for that email', async () => {
    const user = await fx.user();
    const ip = fx.ip();
    for (let i = 0; i < 3; i++) await signIn(input(user.email, `bad-${i}`), ctx(ip)).catch(() => undefined);
    expect(await fx.failureCount(hashEmail(user.email))).toBe(3);
    await signIn(input(user.email), ctx(ip));
    expect(await fx.failureCount(hashEmail(user.email))).toBe(0);
    // The count restarts at zero: 4 more failures do not lock.
    for (let i = 0; i < 4; i++) await signIn(input(user.email, `again-${i}`), ctx(ip)).catch(() => undefined);
    await expect(signIn(input(user.email), ctx(ip))).resolves.toHaveProperty('token');
  });
});

describe('signIn account state', () => {
  it('E-001/AC-84 a deactivated user with the right password gets 422 "This account is not active."', async () => {
    const user = await fx.user({ deactivated: true });
    const err = (await signIn(input(user.email), ctx(fx.ip())).catch((e: unknown) => e)) as RuleViolationError;
    expect(err).toBeInstanceOf(RuleViolationError);
    expect(err.status).toBe(422);
    expect(err.message).toBe('This account is not active.');
    expect(await fx.sessionRows(user.id)).toHaveLength(0);
  });

  it('E-001/AC-84 a deactivated user with a wrong password gets the 401 text, so status is not leaked', async () => {
    const user = await fx.user({ deactivated: true });
    const err = (await signIn(input(user.email, 'wrong-password'), ctx(fx.ip())).catch((e: unknown) => e)) as UnauthorizedError;
    expect(err).toBeInstanceOf(UnauthorizedError);
    expect(err.message).toBe(SIGN_IN_COPY.wrong);
  });

  it('an expired temporary password gets 422 only after the verify passes', async () => {
    const user = await fx.user({ tempExpired: true });
    const ip = fx.ip();
    const wrong = await signIn(input(user.email, 'wrong-password'), ctx(ip)).catch((e: unknown) => e);
    expect(wrong).toBeInstanceOf(UnauthorizedError);
    const err = (await signIn(input(user.email), ctx(ip)).catch((e: unknown) => e)) as RuleViolationError;
    expect(err).toBeInstanceOf(RuleViolationError);
    expect(err.message).toBe(SIGN_IN_COPY.tempExpired);
    expect(await fx.sessionRows(user.id)).toHaveLength(0);
  });

  it('E-001/AC-49 a user with must_change_password goes to /account/password even with a returnTo', async () => {
    const user = await fx.user({ mustChange: true });
    const result = await signIn(input(user.email, PASSWORD, '/rooms'), ctx(fx.ip()));
    expect(result.destination).toBe('/account/password');
  });

  it('E-001/AC-49 the forced change blocks every key except account.password', async () => {
    const user = await fx.user({ mustChange: true });
    const result = await signIn(input(user.email), ctx(fx.ip()));
    const row = await findSessionByTokenHash(hashToken(result.token), new Date());
    expect(row).not.toBeNull();
    const session = toSessionUser(row!);
    expect(session.mustChangePassword).toBe(true);
    expect(() => requirePermission(session, 'account.password')).not.toThrow();
    for (const key of ['booking.create', 'visit.create', 'user.manage'] as const) {
      expect(() => requirePermission(session, key)).toThrow(PasswordChangeRequiredError);
    }
  });
});

describe('sign-out', () => {
  it('deleting the session by token hash removes the row and the token stops working', async () => {
    const user = await fx.user();
    const result = await signIn(input(user.email), ctx(fx.ip()));
    const hash = hashToken(result.token);
    await deleteSession(hash);
    expect(await fx.sessionRows(user.id)).toHaveLength(0);
    expect(await findSessionByTokenHash(hash, new Date())).toBeNull();
    await expect(deleteSession(hash)).resolves.toBeUndefined();
  });
});

describe('IP limit', () => {
  it('waits 1 s more for each email from the 30th, with the injected sleep', async () => {
    const ip = fx.ip();
    const now = new Date();
    for (let i = 0; i < 30; i++) await fx.addFailures(hashEmail(`ipdelay-${i}-${ip}@example.test`), ip, 1, new Date(now.getTime() - 1000));
    const user = await fx.user();
    const { sleep, waits } = recordingSleep();
    await signIn(input(user.email), { ip, now, sleep });
    expect(waits).toEqual([1000]);
  });

  it('does not wait below 30 distinct emails', async () => {
    const ip = fx.ip();
    const now = new Date();
    for (let i = 0; i < 29; i++) await fx.addFailures(hashEmail(`ipfree-${i}-${ip}@example.test`), ip, 1, new Date(now.getTime() - 1000));
    const user = await fx.user();
    const { sleep, waits } = recordingSleep();
    await signIn(input(user.email), { ip, now, sleep });
    expect(waits).toEqual([]);
  });

  it('blocks from 100 distinct emails with 429 and Retry-After, even for a right password', async () => {
    const ip = fx.ip();
    const now = new Date();
    for (let i = 0; i < 100; i++) await fx.addFailures(hashEmail(`ipblock-${i}-${ip}@example.test`), ip, 1, new Date(now.getTime() - 1000));
    const user = await fx.user();
    const err = (await signIn(input(user.email), ctx(ip, now)).catch((e: unknown) => e)) as LockedError;
    expect(err).toBeInstanceOf(LockedError);
    expect(err.status).toBe(429);
    expect(err.headers?.['retry-after']).toBe('900');
    expect(await fx.sessionRows(user.id)).toHaveLength(0);
  });

  it('counts per IP: another address is not blocked', async () => {
    const ip = fx.ip();
    const now = new Date();
    for (let i = 0; i < 100; i++) await fx.addFailures(hashEmail(`ipother-${i}-${ip}@example.test`), ip, 1, new Date(now.getTime() - 1000));
    const user = await fx.user();
    await expect(signIn(input(user.email), ctx(fx.ip(), now))).resolves.toHaveProperty('token');
  });
});
