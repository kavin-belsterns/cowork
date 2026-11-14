// Purpose: unit tests for src/lib/auth/sign-in.ts. Data calls are mocked, password hashing is real Argon2id.
// Rules: spec S01 sections 3 and 5 (order, same 401 for unknown and wrong, verify before inactive, lockout, IP limit, no personal data in logs).
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/data/session', () => ({
  verifyCredentials: vi.fn(),
  createSessionAfterSignIn: vi.fn(),
  findSessionByTokenHash: vi.fn(),
}));
vi.mock('@/data/sign-in-attempt', () => ({
  countDistinctEmailsByIp: vi.fn(),
  countFailures: vi.fn(),
  recordFailure: vi.fn(),
}));

import { createSessionAfterSignIn, findSessionByTokenHash, verifyCredentials, type CredentialUser } from '@/data/session';
import { countDistinctEmailsByIp, countFailures, recordFailure } from '@/data/sign-in-attempt';
import { AppError } from '@/lib/errors';
import { createLogger } from '@/lib/logger';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { signIn, SIGN_IN_COPY } from '@/lib/auth/sign-in';
import { hashEmail, hashToken } from '@/lib/auth/token';

const now = new Date('2026-11-14T10:00:00.000Z');
const EMAIL = 'Ann@Example.test';
const PASSWORD = 'correct horse battery';
const IP = '203.0.113.7';

let storedHash: string;
let stored: { hash: string | null; user: CredentialUser };
const lines: Record<string, unknown>[] = [];
const log = createLogger({ level: 'trace', write: (raw) => void lines.push(JSON.parse(raw)) });
const sleep = vi.fn(async () => {});

function activeUser(over: Partial<CredentialUser> = {}): CredentialUser {
  return { id: 'user-1', deactivated: false, tempPasswordExpiresAt: null, mustChangePassword: false, ...over };
}

/** Same contract as the real data call: run verify on the hash or null, return no hash. */
function fakeVerifyCredentials() {
  vi.mocked(verifyCredentials).mockImplementation(async (_email, verify) => {
    const passed = await verify(stored.hash);
    return !stored.hash || !passed ? { ok: false } : { ok: true, user: stored.user };
  });
}

const run = (over: { email?: string; password?: string; returnTo?: string } = {}) =>
  signIn({ email: over.email ?? EMAIL, password: over.password ?? PASSWORD, returnTo: over.returnTo }, { ip: IP, now, sleep, log });

async function failure(promise: Promise<unknown>): Promise<AppError> {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(AppError);
  return err as AppError;
}

beforeAll(async () => {
  storedHash = await hashPassword(PASSWORD);
});

beforeEach(() => {
  vi.resetAllMocks();
  lines.length = 0;
  stored = { hash: storedHash, user: activeUser() };
  vi.mocked(countDistinctEmailsByIp).mockResolvedValue(0);
  vi.mocked(countFailures).mockResolvedValue(0);
  vi.mocked(createSessionAfterSignIn).mockResolvedValue();
  vi.mocked(findSessionByTokenHash).mockResolvedValue({
    userId: 'user-1',
    name: 'Ann',
    role: 'employee',
    officeId: null,
    mustChangePassword: false,
    version: 1,
    expiresAt: new Date('2026-11-14T22:00:00.000Z'),
  });
  fakeVerifyCredentials();
});

describe('E-001/AC-47 sign in', () => {
  it('opens a session ending 12 hours later and returns the role home', async () => {
    const result = await run();
    expect(result.expiresAt.toISOString()).toBe('2026-11-14T22:00:00.000Z');
    expect(result.destination).toBe('/rooms');
    const call = vi.mocked(createSessionAfterSignIn).mock.calls[0]![0];
    expect(call).toMatchObject({ userId: 'user-1', emailHash: hashEmail(EMAIL), expiresAt: result.expiresAt });
    expect(call.tokenHash).toBe(hashToken(result.token));
    expect(recordFailure).not.toHaveBeenCalled();
  });

  it('uses a checked return path and drops an open redirect', async () => {
    expect((await run({ returnTo: '/bookings' })).destination).toBe('/bookings');
    expect((await run({ returnTo: '//evil.example' })).destination).toBe('/rooms');
  });

  it('logs the user id only', async () => {
    await run();
    const text = JSON.stringify(lines);
    expect(lines.at(-1)).toMatchObject({ msg: 'sign_in.ok', userId: 'user-1' });
    for (const secret of [EMAIL.toLowerCase(), EMAIL, PASSWORD, IP]) expect(text).not.toContain(secret);
  });
});

describe('E-001/AC-85 wrong details', () => {
  it('gives the same 401 text for a wrong password and an unknown email', async () => {
    const wrong = await failure(run({ password: 'not the password' }));
    stored = { hash: null, user: activeUser() };
    const unknown = await failure(run());
    for (const err of [wrong, unknown]) {
      expect(err.status).toBe(401);
      expect(err.type).toBe('unauthenticated');
      expect(err.message).toBe('Email or password is wrong.');
    }
  });

  it('records a failure with the email hash and IP, and opens no session', async () => {
    await failure(run({ password: 'not the password' }));
    expect(recordFailure).toHaveBeenCalledWith(hashEmail(EMAIL), IP, now);
    expect(createSessionAfterSignIn).not.toHaveBeenCalled();
  });

  it('runs the verify callback with null for an unknown email (dummy verify)', async () => {
    stored = { hash: null, user: activeUser() };
    const seen: (string | null)[] = [];
    vi.mocked(verifyCredentials).mockImplementation(async (_e, verify) => {
      seen.push(stored.hash);
      expect(await verify(null)).toBe(false);
      return { ok: false };
    });
    await failure(run());
    expect(seen).toEqual([null]);
    expect(await verifyPassword(null, PASSWORD)).toBe(false);
  });

  it('logs a reason code and never the email, IP or password', async () => {
    await failure(run({ password: 'not the password' }));
    const text = JSON.stringify(lines);
    expect(lines.at(-1)).toMatchObject({ msg: 'sign_in.failed', reason: 'wrong_credentials' });
    for (const secret of [EMAIL.toLowerCase(), EMAIL, 'not the password', IP]) expect(text).not.toContain(secret);
  });
});

describe('E-001/AC-48 lockout and IP limit', () => {
  it('lets the 5th attempt run at 4 failures', async () => {
    vi.mocked(countFailures).mockResolvedValue(4);
    await expect(run()).resolves.toBeDefined();
  });

  it('locks at 5 failures with 429 and Retry-After before any verify', async () => {
    vi.mocked(countFailures).mockResolvedValue(5);
    const err = await failure(run());
    expect(err.status).toBe(429);
    expect(err.type).toBe('locked');
    expect(err.message).toBe(SIGN_IN_COPY.locked);
    expect(err.headers).toEqual({ 'retry-after': '900' });
    expect(verifyCredentials).not.toHaveBeenCalled();
  });

  it('counts from the 15 minute window start', async () => {
    await run();
    expect(countFailures).toHaveBeenCalledWith(hashEmail(EMAIL), new Date('2026-11-14T09:45:00.000Z'));
    expect(countDistinctEmailsByIp).toHaveBeenCalledWith(IP, new Date('2026-11-14T09:45:00.000Z'));
  });

  it('does not wait below 30 emails', async () => {
    vi.mocked(countDistinctEmailsByIp).mockResolvedValue(29);
    await run();
    expect(sleep).not.toHaveBeenCalled();
  });

  it('waits 1 s at 30 emails and 3 s at 32', async () => {
    vi.mocked(countDistinctEmailsByIp).mockResolvedValue(30);
    await run();
    vi.mocked(countDistinctEmailsByIp).mockResolvedValue(32);
    await run();
    expect(sleep.mock.calls).toEqual([[1000], [3000]]);
  });

  it('blocks the IP from 100 emails with 429 and no verify', async () => {
    vi.mocked(countDistinctEmailsByIp).mockResolvedValue(100);
    const err = await failure(run());
    expect(err).toMatchObject({ status: 429, type: 'locked' });
    expect(verifyCredentials).not.toHaveBeenCalled();
    expect(countFailures).not.toHaveBeenCalled();
  });
});

describe('E-001/AC-84 inactive and temp expired only after verify', () => {
  it('tells a deactivated user with the right password', async () => {
    stored = { hash: storedHash, user: activeUser({ deactivated: true }) };
    const err = await failure(run());
    expect(err).toMatchObject({ status: 422, type: 'rule-violation', message: 'This account is not active.' });
    expect(createSessionAfterSignIn).not.toHaveBeenCalled();
  });

  it('gives a deactivated user with the wrong password only the wrong-details 401', async () => {
    stored = { hash: storedHash, user: activeUser({ deactivated: true }) };
    const err = await failure(run({ password: 'not the password' }));
    expect(err).toMatchObject({ status: 401, message: 'Email or password is wrong.' });
  });

  it('tells an expired temp password only after verify', async () => {
    stored = { hash: storedHash, user: activeUser({ tempPasswordExpiresAt: new Date('2026-11-14T09:59:59.000Z') }) };
    const err = await failure(run());
    expect(err).toMatchObject({ status: 422, type: 'rule-violation', message: SIGN_IN_COPY.tempExpired });
    const wrong = await failure(run({ password: 'not the password' }));
    expect(wrong.status).toBe(401);
  });

  it('does not count inactive as a failed attempt', async () => {
    stored = { hash: storedHash, user: activeUser({ deactivated: true }) };
    await failure(run());
    expect(recordFailure).not.toHaveBeenCalled();
  });
});

describe('E-001/AC-49 forced change', () => {
  it('sends a must-change user to the password page', async () => {
    stored = { hash: storedHash, user: activeUser({ mustChangePassword: true, tempPasswordExpiresAt: new Date('2026-11-20T00:00:00Z') }) };
    expect((await run({ returnTo: '/rooms' })).destination).toBe('/account/password');
  });
});
