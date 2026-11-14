// Purpose: unit tests for src/lib/auth/password.ts. Real Argon2id, no database.
// Rules: spec S01 section 5 and 6 (dummy verify on unknown email).
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@node-rs/argon2', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@node-rs/argon2')>();
  return { ...actual, verify: vi.fn((...args: Parameters<typeof actual.verify>) => actual.verify(...args)) };
});

import { verify } from '@node-rs/argon2';
import { hashPassword, verifierFor, verifyPassword } from '@/lib/auth/password';

describe('E-001/AC-85 password hashing', () => {
  beforeEach(() => {
    vi.mocked(verify).mockClear();
  });

  it('hashes with Argon2id and verifies the right password', async () => {
    const stored = await hashPassword('correct horse battery');
    expect(stored.startsWith('$argon2id$')).toBe(true);
    expect(await verifyPassword(stored, 'correct horse battery')).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const stored = await hashPassword('correct horse battery');
    expect(await verifyPassword(stored, 'wrong horse battery')).toBe(false);
  });

  it('runs a dummy verify on null and returns false', async () => {
    expect(await verifyPassword(null, 'anything at all')).toBe(false);
    expect(verify).toHaveBeenCalledTimes(1);
    const [usedHash] = vi.mocked(verify).mock.calls[0]!;
    expect(String(usedHash).startsWith('$argon2id$')).toBe(true);
  });

  it('returns false for a malformed stored hash', async () => {
    expect(await verifyPassword('not-a-hash', 'anything at all')).toBe(false);
  });

  it('builds the callback the data layer takes', async () => {
    const stored = await hashPassword('correct horse battery');
    expect(await verifierFor('correct horse battery')(stored)).toBe(true);
    expect(await verifierFor('correct horse battery')(null)).toBe(false);
  });
});
