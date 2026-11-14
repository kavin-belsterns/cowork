// Purpose: integration tests for the own-password change against the live database as app_web.
// Rules: spec S01 sections 3 to 6. Covers AC-72, token rotation, other sessions deleted, audit row, version guard and lockout.
// Users are made on DATABASE_URL_MIGRATOR with unique emails and deleted afterwards. Audit rows are append only and stay.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ChangePasswordInput, SignInInput, type SessionUser } from '@/contracts/auth';
import { findSessionByTokenHash } from '@/data/session';
import { changePassword, PASSWORD_COPY } from '@/lib/auth/change-password';
import { signIn } from '@/lib/auth/sign-in';
import { toSessionUser } from '@/lib/auth/session';
import { hashToken, hashUserKey } from '@/lib/auth/token';
import { LockedError, UnauthorizedError, ValidationError, VersionConflictError } from '@/lib/errors';
import { Fixtures, PASSWORD, noSleep, type MakeOptions } from './helpers';

vi.mock('server-only', () => ({}));

const NEW_PASSWORD = 'A-brand-new-password-42';
const fx = new Fixtures();
const ctx = (ip: string, now = new Date()) => ({ ip, now, sleep: noSleep });

beforeAll(async () => {
  await fx.connect();
});
afterAll(async () => {
  await fx.cleanup();
});

/** Make a user, sign in, and return the session the action would hold. */
async function signedIn(options: MakeOptions = {}) {
  const user = await fx.user(options);
  const ip = fx.ip();
  const result = await signIn(SignInInput.parse({ email: user.email, password: PASSWORD }), ctx(ip));
  const row = await findSessionByTokenHash(hashToken(result.token), new Date());
  if (!row) throw new Error('No session row after sign-in');
  const session: SessionUser = toSessionUser(row);
  return { user, ip, token: result.token, session };
}

const change = (session: SessionUser, over: Partial<{ currentPassword: string; newPassword: string; version: number }> = {}) =>
  ChangePasswordInput.parse({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD, version: session.version, ...over });

describe('changePassword length rule', () => {
  it('E-001/AC-72 a new password of 11 characters is rejected with "Use at least 12 characters."', async () => {
    const { session, ip, user } = await signedIn();
    const err = (await changePassword(session, { currentPassword: PASSWORD, newPassword: 'a'.repeat(11), version: session.version }, ctx(ip)).catch((e: unknown) => e)) as ValidationError;
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.status).toBe(422);
    expect(err.message).toBe('Use at least 12 characters.');
    expect(PASSWORD_COPY.tooShort).toBe('Use at least 12 characters.');
    // Nothing changed: the old password still works.
    const again = await signIn(SignInInput.parse({ email: user.email, password: PASSWORD }), ctx(fx.ip()));
    expect(again.token).toBeTruthy();
  });

  it('E-001/AC-72 the contract refuses 11 characters with the same text', () => {
    const parsed = ChangePasswordInput.safeParse({ currentPassword: PASSWORD, newPassword: 'a'.repeat(11), version: 1 });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe('Use at least 12 characters.');
  });

  it('E-001/AC-72 exactly 12 characters is accepted', async () => {
    const { session, ip } = await signedIn();
    const result = await changePassword(session, change(session, { newPassword: 'a'.repeat(12) }), ctx(ip));
    expect(result.token).toHaveLength(43);
  });
});

describe('changePassword success', () => {
  it('rotates the token, deletes other sessions and keeps the 12 hour end', async () => {
    const { user, ip, token, session } = await signedIn();
    // A second device for the same user.
    const other = await signIn(SignInInput.parse({ email: user.email, password: PASSWORD }), ctx(fx.ip()));
    expect(await fx.sessionRows(user.id)).toHaveLength(2);

    const result = await changePassword(session, change(session), ctx(ip));

    expect(result.token).not.toBe(token);
    const rows = await fx.sessionRows(user.id);
    expect(rows.map((r) => r.token_hash)).toEqual([hashToken(result.token)]);
    expect(await findSessionByTokenHash(hashToken(token), new Date())).toBeNull();
    expect(await findSessionByTokenHash(hashToken(other.token), new Date())).toBeNull();
    expect(rows[0]?.expires_at.toISOString()).toBe(session.expiresAt);
    expect(result.expiresAt.toISOString()).toBe(session.expiresAt);
  });

  it('stores the new password: the old one stops working and the new one signs in', async () => {
    const { user, ip, session } = await signedIn();
    await changePassword(session, change(session), ctx(ip));
    await expect(signIn(SignInInput.parse({ email: user.email, password: PASSWORD }), ctx(fx.ip()))).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(signIn(SignInInput.parse({ email: user.email, password: NEW_PASSWORD }), ctx(fx.ip()))).resolves.toHaveProperty('token');
  });

  it('adds 1 to the version, clears must_change_password and the temp expiry', async () => {
    const { user, ip, session } = await signedIn({ mustChange: true });
    expect(session.mustChangePassword).toBe(true);
    await changePassword(session, change(session), ctx(ip));
    const r = await fx.db.query<{ version: number; must_change_password: boolean; temp_password_expires_at: Date | null }>(
      'SELECT version, must_change_password, temp_password_expires_at FROM users WHERE id = $1',
      [user.id],
    );
    expect(r.rows[0]).toEqual({ version: session.version + 1, must_change_password: false, temp_password_expires_at: null });
  });

  it('E-001/AC-49 after the forced change the new session is free of the gate', async () => {
    const { ip, session, user } = await signedIn({ mustChange: true });
    const result = await changePassword(session, change(session), ctx(ip));
    const row = await findSessionByTokenHash(hashToken(result.token), new Date());
    expect(row?.userId).toBe(user.id);
    expect(row?.mustChangePassword).toBe(false);
  });

  it('writes one audit row with reason password_change and no password data', async () => {
    const { user, ip, session } = await signedIn();
    await changePassword(session, change(session), ctx(ip));
    const r = await fx.db.query<{ action: string; entity_type: string; actor_id: string; detail: unknown }>(
      'SELECT action, entity_type, actor_id, detail FROM audit_events WHERE entity_id = $1',
      [user.id],
    );
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ action: 'changed', entity_type: 'user', actor_id: user.id, detail: { reason: 'password_change' } });
    expect(JSON.stringify(r.rows[0])).not.toContain(NEW_PASSWORD);
  });
});

describe('changePassword failures', () => {
  it('a stale version throws 409 and changes nothing: no audit row, sessions and password unchanged', async () => {
    const { user, ip, token, session } = await signedIn();
    const err = (await changePassword(session, change(session, { version: session.version + 7 }), ctx(ip)).catch((e: unknown) => e)) as VersionConflictError;
    expect(err).toBeInstanceOf(VersionConflictError);
    expect(err.status).toBe(409);
    const audit = await fx.db.query('SELECT 1 FROM audit_events WHERE entity_id = $1', [user.id]);
    expect(audit.rowCount).toBe(0);
    expect((await fx.sessionRows(user.id)).map((r) => r.token_hash)).toEqual([hashToken(token)]);
    await expect(signIn(SignInInput.parse({ email: user.email, password: PASSWORD }), ctx(fx.ip()))).resolves.toHaveProperty('token');
  });

  it('a wrong current password gives 401 "Your current password is wrong." and changes nothing', async () => {
    const { ip, token, session, user } = await signedIn();
    const err = (await changePassword(session, change(session, { currentPassword: 'not-my-password' }), ctx(ip)).catch((e: unknown) => e)) as UnauthorizedError;
    expect(err).toBeInstanceOf(UnauthorizedError);
    expect(err.status).toBe(401);
    expect(err.message).toBe('Your current password is wrong.');
    expect((await fx.sessionRows(user.id)).map((r) => r.token_hash)).toEqual([hashToken(token)]);
  });

  it('counts wrong current passwords under a user key and locks at 5, even with the right password', async () => {
    const { ip, session, user } = await signedIn();
    for (let i = 0; i < 5; i++) {
      await expect(changePassword(session, change(session, { currentPassword: `wrong-${i}` }), ctx(ip))).rejects.toBeInstanceOf(UnauthorizedError);
    }
    expect(await fx.failureCount(hashUserKey(user.id))).toBe(5);
    const err = (await changePassword(session, change(session), ctx(ip)).catch((e: unknown) => e)) as LockedError;
    expect(err).toBeInstanceOf(LockedError);
    expect(err.status).toBe(429);
    expect(err.headers?.['retry-after']).toBe('900');
  });

  it('a wrong current password does not touch the sign-in lockout of the same user', async () => {
    const { ip, session, user } = await signedIn();
    for (let i = 0; i < 5; i++) await changePassword(session, change(session, { currentPassword: `wrong-${i}` }), ctx(ip)).catch(() => undefined);
    await expect(signIn(SignInInput.parse({ email: user.email, password: PASSWORD }), ctx(fx.ip()))).resolves.toHaveProperty('token');
  });

  it('clears the user key failures after a successful change', async () => {
    const { ip, session, user } = await signedIn();
    for (let i = 0; i < 3; i++) await changePassword(session, change(session, { currentPassword: `wrong-${i}` }), ctx(ip)).catch(() => undefined);
    expect(await fx.failureCount(hashUserKey(user.id))).toBe(3);
    await changePassword(session, change(session), ctx(ip));
    expect(await fx.failureCount(hashUserKey(user.id))).toBe(0);
  });
});
