// Purpose: unit tests for src/lib/auth/token.ts.
// Rules: spec S01 sections 5 and 6 (256-bit CSPRNG token, SHA-256 hex hash, email hash of trimmed lower-cased email).
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { generateToken, hashEmail, hashToken, hashUserKey } from '@/lib/auth/token';

describe('E-001/AC-47 token helpers', () => {
  it('makes a 256-bit token as 43 base64url characters', () => {
    const token = generateToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
  });

  it('makes a new token each call', () => {
    expect(generateToken()).not.toBe(generateToken());
  });

  it('hashes a token with SHA-256 hex', () => {
    expect(hashToken('abc')).toBe(createHash('sha256').update('abc').digest('hex'));
    expect(hashToken('abc')).toHaveLength(64);
  });

  it('hashes an email trimmed and lower-cased', () => {
    expect(hashEmail('  Ann@Example.TEST ')).toBe(hashEmail('ann@example.test'));
    expect(hashEmail('ann@example.test')).toBe(createHash('sha256').update('ann@example.test').digest('hex'));
  });

  it('keeps the user key apart from an email hash', () => {
    expect(hashUserKey('u1')).not.toBe(hashEmail('u1'));
    expect(hashUserKey('u1')).toHaveLength(64);
  });
});
