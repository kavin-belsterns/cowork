// Purpose: the own-password-change flow as a plain function. The action authorises, parses, calls this and sets the cookie.
// Rules: spec S01 sections 3 to 5. Acts on the signed-in user only. Wrong current password counts toward the 5 in 15 lockout.
// Lockout rows use a user key hash, not an email hash. They are cleared after a successful change. The same transaction (data layer) rotates the token and writes audit.
// The new session keeps the old end time, so the 12 hour limit still runs from sign-in (AC-71).
import 'server-only';
import type { ChangePasswordInput, SessionUser } from '@/contracts/auth';
import { LOCKOUT_FAILURES, RETRY_AFTER_SECONDS, isLockedOut, isPasswordLengthValid, windowStart } from '@/domain/auth/rules';
import { checkOwnPassword, setOwnPassword } from '@/data/session';
import { clearFailures, countFailures, recordFailure } from '@/data/sign-in-attempt';
import { hashPassword, verifierFor } from '@/lib/auth/password';
import { generateToken, hashToken, hashUserKey } from '@/lib/auth/token';
import { LockedError, UnauthorizedError, ValidationError } from '@/lib/errors';
import { logger, type Logger } from '@/lib/logger';

export const PASSWORD_COPY = {
  tooShort: 'Use at least 12 characters.',
  currentWrong: 'Your current password is wrong.',
  locked: 'Too many attempts. Try again in 15 minutes.',
} as const;

export type ChangePasswordContext = {
  ip: string;
  now: Date;
  sleep: (ms: number) => Promise<void>;
  log?: Logger;
};

export type ChangePasswordResult = { token: string; expiresAt: Date };

/** Returns the new session token. Throws AppError: 401 (current wrong), 422 (length), 409 (version), 429. */
export async function changePassword(actor: SessionUser, input: ChangePasswordInput, ctx: ChangePasswordContext): Promise<ChangePasswordResult> {
  const log = ctx.log ?? logger;
  if (!isPasswordLengthValid(input.newPassword)) {
    throw new ValidationError(PASSWORD_COPY.tooShort, [{ path: 'newPassword', message: PASSWORD_COPY.tooShort }], 422);
  }

  const key = hashUserKey(actor.id);
  if (isLockedOut(await countFailures(key, windowStart(ctx.now)))) {
    log.warn('password.locked', { userId: actor.id, limit: LOCKOUT_FAILURES });
    throw new LockedError(RETRY_AFTER_SECONDS, PASSWORD_COPY.locked);
  }

  if (!(await checkOwnPassword(actor.id, verifierFor(input.currentPassword)))) {
    await recordFailure(key, ctx.ip, ctx.now);
    log.warn('password.change_failed', { userId: actor.id, reason: 'current_wrong' });
    throw new UnauthorizedError(PASSWORD_COPY.currentWrong);
  }

  const token = generateToken();
  const expiresAt = new Date(actor.expiresAt);
  await setOwnPassword({
    userId: actor.id,
    version: input.version,
    newHash: await hashPassword(input.newPassword),
    tokenHash: hashToken(token),
    expiresAt,
  });
  await clearFailures(key);
  log.info('password.changed', { userId: actor.id });
  log.info('session.revoked', { userId: actor.id, reason: 'password_change' });
  return { token, expiresAt };
}
