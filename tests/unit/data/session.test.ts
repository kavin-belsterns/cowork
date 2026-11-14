// Purpose: unit tests for src/data/session.ts against the live test database as role app_web.
// Rules: spec S01 sections 3 and 4. Fixtures use a separate pg client on DATABASE_URL_MIGRATOR with unique ids per run.
// Seed users are never edited. Audit rows are append only, so they stay behind. The tests fail when the database is unreachable.
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  checkOwnPassword,
  createSessionAfterSignIn,
  deleteSession,
  findSessionByTokenHash,
  setOwnPassword,
  verifyCredentials,
} from '@/data/session';
import { VersionConflictError } from '@/lib/errors';

const run = randomUUID();
const now = new Date('2026-11-14T10:00:00.000Z');
const later = new Date(now.getTime() + 12 * 3_600_000);
const past = new Date(now.getTime() - 1000);
const tok = (n: string) => `ut-tok-${n}-${run}`;

type Fixture = { id: string; email: string };
const userIds: string[] = [];
const emailHashes: string[] = [];
let admin: Client;

async function makeUser(label: string, opts: { hash?: string | null; deactivated?: boolean; must?: boolean; tempExpires?: Date | null } = {}): Promise<Fixture> {
  const id = randomUUID();
  const email = `ut-${label}-${run}@Example.test`;
  await admin.query(
    `INSERT INTO users (id, office_id, email, name, role, password_hash, deactivated_at, must_change_password, temp_password_expires_at, updated_at)
     VALUES ($1, NULL, $2, $3, 'platform_admin', $4, $5, $6, $7, now())`,
    [id, email, `Unit ${label}`, opts.hash === undefined ? 'hash-old' : opts.hash, opts.deactivated ? now : null, opts.must ?? false, opts.tempExpires ?? null],
  );
  userIds.push(id);
  return { id, email };
}

async function sessionCount(userId: string): Promise<number> {
  const r = await admin.query('SELECT count(*)::int AS n FROM sessions WHERE user_id = $1', [userId]);
  return r.rows[0].n as number;
}

beforeAll(async () => {
  const url = process.env.DATABASE_URL_MIGRATOR;
  if (!url) throw new Error('DATABASE_URL_MIGRATOR is not set.');
  admin = new Client({ connectionString: url });
  await admin.connect();
});

afterAll(async () => {
  if (!admin) return;
  await admin.query('DELETE FROM sessions WHERE user_id = ANY($1)', [userIds]);
  await admin.query('DELETE FROM sign_in_attempts WHERE email_hash = ANY($1)', [emailHashes]);
  await admin.query('DELETE FROM users WHERE id = ANY($1)', [userIds]);
  await admin.end();
});

describe('findSessionByTokenHash', () => {
  it('returns the SessionUser fields for a live session', async () => {
    const u = await makeUser('find');
    await admin.query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [tok('find'), u.id, later]);
    const row = await findSessionByTokenHash(tok('find'), now);
    expect(row).toEqual({
      userId: u.id,
      name: 'Unit find',
      role: 'platform_admin',
      officeId: null,
      mustChangePassword: false,
      version: 1,
      expiresAt: later,
    });
    expect(JSON.stringify(row)).not.toContain('hash-old');
  });

  it('returns null for an unknown hash', async () => {
    expect(await findSessionByTokenHash(tok('missing'), now)).toBeNull();
  });

  it('deletes an expired row and returns null', async () => {
    const u = await makeUser('expired');
    await admin.query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [tok('expired'), u.id, past]);
    expect(await findSessionByTokenHash(tok('expired'), now)).toBeNull();
    expect(await sessionCount(u.id)).toBe(0);
  });

  it('treats a session that ends exactly now as expired', async () => {
    const u = await makeUser('edge');
    await admin.query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [tok('edge'), u.id, now]);
    expect(await findSessionByTokenHash(tok('edge'), now)).toBeNull();
    expect(await sessionCount(u.id)).toBe(0);
  });

  it('returns null for a deactivated user and keeps the row', async () => {
    const u = await makeUser('inactive', { deactivated: true });
    await admin.query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [tok('inactive'), u.id, later]);
    expect(await findSessionByTokenHash(tok('inactive'), now)).toBeNull();
  });
});

describe('deleteSession', () => {
  it('deletes the row and ignores a missing one', async () => {
    const u = await makeUser('del');
    await admin.query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [tok('del'), u.id, later]);
    await deleteSession(tok('del'));
    expect(await sessionCount(u.id)).toBe(0);
    await expect(deleteSession(tok('del'))).resolves.toBeUndefined();
  });
});

describe('verifyCredentials', () => {
  it('matches the email case-insensitively and passes the stored hash to verify', async () => {
    const u = await makeUser('cred', { hash: 'hash-cred', must: true, tempExpires: later });
    const seen: (string | null)[] = [];
    const res = await verifyCredentials(u.email.toUpperCase(), async (h) => {
      seen.push(h);
      return true;
    });
    expect(seen).toEqual(['hash-cred']);
    expect(res).toEqual({ ok: true, user: { id: u.id, deactivated: false, tempPasswordExpiresAt: later, mustChangePassword: true } });
    expect(JSON.stringify(res)).not.toContain('hash-cred');
  });

  it('returns ok false when verify fails', async () => {
    const u = await makeUser('credbad');
    expect(await verifyCredentials(u.email, async () => false)).toEqual({ ok: false });
  });

  it('calls verify with null for an unknown email and returns ok false even if verify says true', async () => {
    const seen: (string | null)[] = [];
    const res = await verifyCredentials(`ut-none-${run}@example.test`, async (h) => {
      seen.push(h);
      return true;
    });
    expect(seen).toEqual([null]);
    expect(res).toEqual({ ok: false });
  });

  it('calls verify with null for a user with no password yet', async () => {
    const u = await makeUser('nohash', { hash: null });
    const seen: (string | null)[] = [];
    expect(await verifyCredentials(u.email, async (h) => { seen.push(h); return false; })).toEqual({ ok: false });
    expect(seen).toEqual([null]);
  });

  it('reports a deactivated user as deactivated after a passing verify', async () => {
    const u = await makeUser('credinactive', { deactivated: true });
    const res = await verifyCredentials(u.email, async () => true);
    expect(res.ok && res.user.deactivated).toBe(true);
  });
});

describe('createSessionAfterSignIn', () => {
  it('inserts the session and deletes only that email hash attempts', async () => {
    const u = await makeUser('signin');
    const mine = `ut-eh-${run}`;
    const other = `ut-eh-other-${run}`;
    emailHashes.push(mine, other);
    await admin.query(
      `INSERT INTO sign_in_attempts (id, email_hash, ip, at) VALUES ($1, $2, 'ut', now()), ($3, $2, 'ut', now()), ($4, $5, 'ut', now())`,
      [randomUUID(), mine, randomUUID(), randomUUID(), other],
    );
    await createSessionAfterSignIn({ userId: u.id, emailHash: mine, tokenHash: tok('signin'), expiresAt: later });
    expect(await sessionCount(u.id)).toBe(1);
    const left = await admin.query('SELECT email_hash FROM sign_in_attempts WHERE email_hash = ANY($1)', [[mine, other]]);
    expect(left.rows).toEqual([{ email_hash: other }]);
  });

  it('rolls back the attempts delete when the session insert fails', async () => {
    const u = await makeUser('signinfail');
    const eh = `ut-eh-fail-${run}`;
    emailHashes.push(eh);
    await admin.query(`INSERT INTO sign_in_attempts (id, email_hash, ip, at) VALUES ($1, $2, 'ut', now())`, [randomUUID(), eh]);
    await admin.query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [tok('dup'), u.id, later]);
    await expect(createSessionAfterSignIn({ userId: u.id, emailHash: eh, tokenHash: tok('dup'), expiresAt: later })).rejects.toThrow();
    const left = await admin.query('SELECT count(*)::int AS n FROM sign_in_attempts WHERE email_hash = $1', [eh]);
    expect(left.rows[0].n).toBe(1);
  });
});

describe('checkOwnPassword', () => {
  it('passes the stored hash to verify and returns its result', async () => {
    const u = await makeUser('own', { hash: 'hash-own' });
    const seen: (string | null)[] = [];
    expect(await checkOwnPassword(u.id, async (h) => { seen.push(h); return true; })).toBe(true);
    expect(await checkOwnPassword(u.id, async () => false)).toBe(false);
    expect(seen).toEqual(['hash-own']);
  });

  it('calls verify with null for an unknown user id', async () => {
    const seen: (string | null)[] = [];
    await checkOwnPassword(randomUUID(), async (h) => { seen.push(h); return false; });
    expect(seen).toEqual([null]);
  });
});

describe('setOwnPassword', () => {
  it('sets the hash, clears the flags, bumps version, rotates sessions and writes one audit row', async () => {
    const u = await makeUser('pw', { must: true, tempExpires: later });
    await admin.query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3), ($4, $2, $3)', [tok('pw1'), u.id, later, tok('pw2')]);
    await setOwnPassword({ userId: u.id, version: 1, newHash: 'hash-new', tokenHash: tok('pw3'), expiresAt: later });

    const user = await admin.query('SELECT password_hash, must_change_password, temp_password_expires_at, version FROM users WHERE id = $1', [u.id]);
    expect(user.rows[0]).toEqual({ password_hash: 'hash-new', must_change_password: false, temp_password_expires_at: null, version: 2 });
    const sessions = await admin.query('SELECT token_hash FROM sessions WHERE user_id = $1', [u.id]);
    expect(sessions.rows).toEqual([{ token_hash: tok('pw3') }]);
    const audit = await admin.query('SELECT action, entity_type, actor_id, detail FROM audit_events WHERE entity_id = $1', [u.id]);
    expect(audit.rows).toEqual([{ action: 'changed', entity_type: 'user', actor_id: u.id, detail: { reason: 'password_change' } }]);
    expect(JSON.stringify(audit.rows)).not.toContain('hash-new');
  });

  it('throws VersionConflictError on a stale version and changes nothing', async () => {
    const u = await makeUser('pwstale');
    await admin.query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [tok('stale1'), u.id, later]);
    await expect(
      setOwnPassword({ userId: u.id, version: 99, newHash: 'hash-x', tokenHash: tok('stale2'), expiresAt: later }),
    ).rejects.toBeInstanceOf(VersionConflictError);
    const user = await admin.query('SELECT password_hash, version FROM users WHERE id = $1', [u.id]);
    expect(user.rows[0]).toEqual({ password_hash: 'hash-old', version: 1 });
    const sessions = await admin.query('SELECT token_hash FROM sessions WHERE user_id = $1', [u.id]);
    expect(sessions.rows).toEqual([{ token_hash: tok('stale1') }]);
    const audit = await admin.query('SELECT count(*)::int AS n FROM audit_events WHERE entity_id = $1', [u.id]);
    expect(audit.rows[0].n).toBe(0);
  });

  it('rolls back the password change when the session insert fails', async () => {
    const u = await makeUser('pwroll');
    const other = await makeUser('pwrollother');
    await admin.query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [tok('roll'), other.id, later]);
    // The new token hash already belongs to another user, so the insert violates the primary key.
    await expect(setOwnPassword({ userId: u.id, version: 1, newHash: 'hash-y', tokenHash: tok('roll'), expiresAt: later })).rejects.toThrow();
    const user = await admin.query('SELECT password_hash, version FROM users WHERE id = $1', [u.id]);
    expect(user.rows[0]).toEqual({ password_hash: 'hash-old', version: 1 });
  });
});
