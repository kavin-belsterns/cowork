import { describe, expect, it } from 'vitest';
import { ChangePasswordInput, ReturnTo, SessionUser, SignInInput } from '@/contracts/auth';
import { ID, LATER, checkSchema } from './harness';

checkSchema({
  name: 'SignInInput',
  schema: SignInInput,
  valid: { email: 'ana@example.com', password: 'x', returnTo: '/rooms' },
  required: ['email', 'password'],
  bad: {
    email: ['', 'not-an-email', `${'a'.repeat(250)}@example.com`],
    password: ['', 'p'.repeat(129)],
    returnTo: ['//evil.example.com', 'https://evil.example.com', '/\\evil', 'rooms', '/a b'],
  },
});

describe('SignInInput details', () => {
  it('accepts a 1 character password and a 128 character password', () => {
    expect(SignInInput.safeParse({ email: 'ana@example.com', password: 'x' }).success).toBe(true);
    expect(SignInInput.safeParse({ email: 'ana@example.com', password: 'p'.repeat(128) }).success).toBe(true);
  });

  it('treats a blank returnTo as none', () => {
    expect(SignInInput.parse({ email: 'ana@example.com', password: 'x', returnTo: '' }).returnTo).toBeUndefined();
  });

  it('ReturnTo takes one relative path with a query', () => {
    expect(ReturnTo.safeParse('/bookings/new?room=1').success).toBe(true);
    expect(ReturnTo.safeParse('/').success).toBe(true);
  });
});

checkSchema({
  name: 'ChangePasswordInput',
  schema: ChangePasswordInput,
  valid: { currentPassword: 'old', newPassword: 'a-long-new-password', version: 2 },
  required: ['currentPassword', 'newPassword', 'version'],
  bad: {
    currentPassword: ['', 'p'.repeat(129)],
    newPassword: ['', 'short-pass', 'p'.repeat(129)],
    version: [0, 'x', ''],
  },
});

describe('ChangePasswordInput details', () => {
  it('E-001/AC-72 says "Use at least 12 characters." for 11 characters and accepts 12', () => {
    const short = ChangePasswordInput.safeParse({ currentPassword: 'old', newPassword: 'a'.repeat(11), version: 1 });
    expect(short.success).toBe(false);
    expect(short.error?.issues[0]?.message).toBe('Use at least 12 characters.');
    expect(ChangePasswordInput.safeParse({ currentPassword: 'old', newPassword: 'a'.repeat(12), version: 1 }).success).toBe(true);
  });
});

checkSchema({
  name: 'SessionUser',
  schema: SessionUser,
  valid: { id: ID, name: 'Ana', role: 'employee', officeId: ID, mustChangePassword: false, expiresAt: LATER, version: 1 },
  required: ['id', 'name', 'role', 'officeId', 'mustChangePassword', 'expiresAt', 'version'],
  bad: { id: ['x'], name: [''], role: ['system', 'admin'], officeId: ['x'], mustChangePassword: ['yes'], expiresAt: ['soon'], version: [0] },
});
