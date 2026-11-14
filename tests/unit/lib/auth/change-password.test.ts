// Purpose: unit tests for src/lib/auth/change-password.ts. Data calls are mocked, hashing is real Argon2id.
// Rules: spec S01 sections 3 to 5 (length rule, wrong current password, lockout, version, rotation keeps the session end).
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/data/session', () => ({ checkOwnPassword: vi.fn(), setOwnPassword: vi.fn() }));
vi.mock('@/data/sign-in-attempt', () => ({ clearFailures: vi.fn(), countFailures: vi.fn(), recordFailure: vi.fn() }));

import type { SessionUser } from '@/contracts/auth';
import { checkOwnPassword, setOwnPassword } from '@/data/session';
import { clearFailures, countFailures, recordFailure } from '@/data/sign-in-attempt';
import { AppError, VersionConflictError } from '@/lib/errors';
import { createLogger } from '@/lib/logger';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { changePassword } from '@/lib/auth/change-password';
import { hashToken, hashUserKey } from '@/lib/auth/token';

const now = new Date('2026-11-14T10:00:00.000Z');
const OLD = 'old password value';
const NEW = 'brand new password value';
const actor: SessionUser = {
  id: '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b',
  name: 'Ann',
  role: 'employee',
  officeId: null,
  mustChangePassword: true,
  expiresAt: '2026-11-14T20:00:00.000Z',
  version: 4,
};

let oldHash: string;
const lines: Record<string, unknown>[] = [];
const log = createLogger({ level: 'trace', write: (raw) => void lines.push(JSON.parse(raw)) });
const ctx = { ip: '203.0.113.7', now, sleep: async () => {}, log };
const input = (over: Partial<{ currentPassword: string; newPassword: string; version: number }> = {}) => ({
  currentPassword: OLD,
  newPassword: NEW,
  version: 4,
  ...over,
});

async function failure(promise: Promise<unknown>): Promise<AppError> {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(AppError);
  return err as AppError;
}

beforeAll(async () => {
  oldHash = await hashPassword(OLD);
});

beforeEach(() => {
  vi.resetAllMocks();
  lines.length = 0;
  vi.mocked(countFailures).mockResolvedValue(0);
  vi.mocked(setOwnPassword).mockResolvedValue();
  vi.mocked(clearFailures).mockResolvedValue();
  vi.mocked(checkOwnPassword).mockImplementation((_id, verify) => verify(oldHash));
});

describe('E-001/AC-72 new password length', () => {
  it('rejects 11 characters with 422 and the AC-72 text before any lookup', async () => {
    const err = await failure(changePassword(actor, input({ newPassword: 'a'.repeat(11) }), ctx));
    expect(err).toMatchObject({ status: 422, type: 'rule-violation', message: 'Use at least 12 characters.' });
    expect(checkOwnPassword).not.toHaveBeenCalled();
    expect(setOwnPassword).not.toHaveBeenCalled();
  });

  it('accepts 12 characters', async () => {
    await expect(changePassword(actor, input({ newPassword: 'a'.repeat(12) }), ctx)).resolves.toBeDefined();
  });
});

describe('E-001/AC-49 password change', () => {
  it('saves an Argon2id hash with the version, rotates the token and keeps the session end', async () => {
    const result = await changePassword(actor, input(), ctx);
    const saved = vi.mocked(setOwnPassword).mock.calls[0]![0];
    expect(saved).toMatchObject({ userId: actor.id, version: 4 });
    expect(saved.newHash.startsWith('$argon2id$')).toBe(true);
    expect(await verifyPassword(saved.newHash, NEW)).toBe(true);
    expect(saved.tokenHash).toBe(hashToken(result.token));
    expect(saved.expiresAt.toISOString()).toBe('2026-11-14T20:00:00.000Z');
    expect(result.expiresAt).toEqual(saved.expiresAt);
  });

  it('acts on the session user, not an id from input', async () => {
    await changePassword(actor, { ...input(), userId: 'someone-else' } as never, ctx);
    expect(vi.mocked(checkOwnPassword).mock.calls[0]![0]).toBe(actor.id);
    expect(vi.mocked(setOwnPassword).mock.calls[0]![0].userId).toBe(actor.id);
  });

  it('clears the user key failures after a successful change, and not before', async () => {
    await changePassword(actor, input(), ctx);
    expect(vi.mocked(clearFailures)).toHaveBeenCalledWith(hashUserKey(actor.id));
    expect(vi.mocked(clearFailures).mock.invocationCallOrder[0]).toBeGreaterThan(vi.mocked(setOwnPassword).mock.invocationCallOrder[0]!);
  });

  it('does not clear failures when the save fails', async () => {
    vi.mocked(setOwnPassword).mockRejectedValue(new VersionConflictError());
    await failure(changePassword(actor, input(), ctx));
    expect(vi.mocked(clearFailures)).not.toHaveBeenCalled();
  });

  it('passes a version conflict up as 409', async () => {
    vi.mocked(setOwnPassword).mockRejectedValue(new VersionConflictError());
    expect(await failure(changePassword(actor, input(), ctx))).toMatchObject({ status: 409, type: 'version-conflict' });
  });

  it('logs the user id and event names only', async () => {
    await changePassword(actor, input(), ctx);
    const text = JSON.stringify(lines);
    expect(lines.map((l) => l.msg)).toEqual(['password.changed', 'session.revoked']);
    expect(lines.every((l) => l.userId === actor.id)).toBe(true);
    for (const secret of [OLD, NEW]) expect(text).not.toContain(secret);
  });
});

describe('E-001/AC-85 wrong current password', () => {
  it('gives 401, records a failure under the user key and saves nothing', async () => {
    const err = await failure(changePassword(actor, input({ currentPassword: 'not the old one' }), ctx));
    expect(err).toMatchObject({ status: 401, type: 'unauthenticated', message: 'Your current password is wrong.' });
    expect(recordFailure).toHaveBeenCalledWith(hashUserKey(actor.id), ctx.ip, now);
    expect(setOwnPassword).not.toHaveBeenCalled();
  });
});

describe('E-001/AC-48 password change lockout', () => {
  it('locks at 5 failures with 429 and Retry-After before the verify', async () => {
    vi.mocked(countFailures).mockResolvedValue(5);
    const err = await failure(changePassword(actor, input(), ctx));
    expect(err).toMatchObject({ status: 429, type: 'locked', headers: { 'retry-after': '900' } });
    expect(checkOwnPassword).not.toHaveBeenCalled();
  });

  it('allows the 5th try at 4 failures', async () => {
    vi.mocked(countFailures).mockResolvedValue(4);
    await expect(changePassword(actor, input(), ctx)).resolves.toBeDefined();
  });
});
