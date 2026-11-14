// Purpose: data calls for sessions, credential checks and own password change.
// Rules: spec S01 section 3 (ownership note) and 4, data.md (retry whole tx, version guard), design.md Security.
// Inputs are hashes, never raw tokens. The password hash is read and written here only and never returned.
import 'server-only';
import type { Role } from '@/contracts/permissions';
import { writeAudit } from '@/lib/audit';
import { getDb, withRetry } from '@/lib/db';
import { VersionConflictError } from '@/lib/errors';

/** The fields `SessionUser` needs, plus the session end. */
export type SessionRow = {
  userId: string;
  name: string;
  role: Role;
  officeId: string | null;
  mustChangePassword: boolean;
  version: number;
  expiresAt: Date;
};

/** Find a live session by token hash. An expired row is deleted. A deactivated user gives null. */
export async function findSessionByTokenHash(tokenHash: string, now: Date): Promise<SessionRow | null> {
  const db = getDb('web');
  const row = await db.session.findUnique({
    where: { tokenHash },
    select: {
      expiresAt: true,
      user: {
        select: { id: true, name: true, role: true, officeId: true, mustChangePassword: true, version: true, deactivatedAt: true },
      },
    },
  });
  if (!row) return null;
  if (row.expiresAt.getTime() <= now.getTime()) {
    await db.session.deleteMany({ where: { tokenHash } });
    return null;
  }
  if (row.user.deactivatedAt !== null) return null;
  return {
    userId: row.user.id,
    name: row.user.name,
    role: row.user.role,
    officeId: row.user.officeId,
    mustChangePassword: row.user.mustChangePassword,
    version: row.user.version,
    expiresAt: row.expiresAt,
  };
}

/** Delete one session by token hash. Missing row is not an error. */
export async function deleteSession(tokenHash: string): Promise<void> {
  await getDb('web').session.deleteMany({ where: { tokenHash } });
}

export type CredentialUser = {
  id: string;
  deactivated: boolean;
  tempPasswordExpiresAt: Date | null;
  mustChangePassword: boolean;
};
export type CredentialResult = { ok: false } | { ok: true; user: CredentialUser };

/**
 * Load the user by lower(email) and run `verify` on the stored hash, or on null when there is no user or no hash.
 * `verify` is supplied by src/lib/auth (Argon2id, or a dummy verify on null). Returns no hash.
 */
export async function verifyCredentials(email: string, verify: (hash: string | null) => Promise<boolean>): Promise<CredentialResult> {
  const rows = await getDb('web').$queryRaw<
    { id: string; password_hash: string | null; deactivated_at: Date | null; temp_password_expires_at: Date | null; must_change_password: boolean }[]
  >`SELECT id, password_hash, deactivated_at, temp_password_expires_at, must_change_password FROM users WHERE lower(email) = lower(${email}) LIMIT 1`;
  const found = rows[0];
  const passed = await verify(found?.password_hash ?? null);
  if (!found || !passed) return { ok: false };
  return {
    ok: true,
    user: {
      id: found.id,
      deactivated: found.deactivated_at !== null,
      tempPasswordExpiresAt: found.temp_password_expires_at,
      mustChangePassword: found.must_change_password,
    },
  };
}

/** Sign-in success: insert the session and delete that email hash's failures in one transaction. */
export async function createSessionAfterSignIn(input: { userId: string; emailHash: string; tokenHash: string; expiresAt: Date }): Promise<void> {
  await getDb('web').$transaction(async (tx) => {
    await tx.session.create({ data: { tokenHash: input.tokenHash, userId: input.userId, expiresAt: input.expiresAt }, select: { tokenHash: true } });
    await tx.signInAttempt.deleteMany({ where: { emailHash: input.emailHash } });
  });
}

/** Check the user's current password. The hash stays inside. A user with no hash runs `verify(null)`. */
export async function checkOwnPassword(userId: string, verify: (hash: string | null) => Promise<boolean>): Promise<boolean> {
  const row = await getDb('web').user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  return verify(row?.passwordHash ?? null);
}

/**
 * Own password change in one interactive transaction, retried whole on P2034 or 40001.
 * Guard: `updateMany where id and version`. Zero rows throws VersionConflictError and rolls back.
 * Then: delete all the user's sessions, insert the new one, write the audit row.
 */
export async function setOwnPassword(input: { userId: string; version: number; newHash: string; tokenHash: string; expiresAt: Date }): Promise<void> {
  await withRetry(() =>
    getDb('web').$transaction(async (tx) => {
      const changed = await tx.user.updateMany({
        where: { id: input.userId, version: input.version },
        data: { passwordHash: input.newHash, mustChangePassword: false, tempPasswordExpiresAt: null, version: { increment: 1 } },
      });
      if (changed.count === 0) throw new VersionConflictError();
      await tx.session.deleteMany({ where: { userId: input.userId } });
      await tx.session.create({ data: { tokenHash: input.tokenHash, userId: input.userId, expiresAt: input.expiresAt }, select: { tokenHash: true } });
      const user = await tx.user.findUniqueOrThrow({ where: { id: input.userId }, select: { officeId: true } });
      await writeAudit(tx, {
        officeId: user.officeId,
        actorId: input.userId,
        action: 'changed',
        entityType: 'user',
        entityId: input.userId,
        detail: { reason: 'password_change' },
      });
    }),
  );
}
