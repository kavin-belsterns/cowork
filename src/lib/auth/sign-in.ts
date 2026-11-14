// Purpose: the sign-in flow as a plain function. The action parses, calls this, sets the cookie and redirects.
// Rules: spec S01 section 3 order: IP limit, email lockout, load user or dummy verify, Argon2id verify.
// Deactivated (AC-84) and temp expired come only after the verify passes. Unknown and wrong give one 401 text.
// Logs the user id only. Never email, IP, password or token. Integration tests (T-05) call this against the live DB.
import 'server-only';
import type { SignInInput } from '@/contracts/auth';
import { FORCED_CHANGE_PATH, RETRY_AFTER_SECONDS, accountBlock, ipDecision, isLockedOut, sessionExpiresAt, signInDestination, windowStart } from '@/domain/auth/rules';
import { createSessionAfterSignIn, findSessionByTokenHash, verifyCredentials } from '@/data/session';
import { countDistinctEmailsByIp, countFailures, recordFailure } from '@/data/sign-in-attempt';
import { verifierFor } from '@/lib/auth/password';
import { checkedReturnTo } from '@/lib/auth/return-to';
import { generateToken, hashEmail, hashToken } from '@/lib/auth/token';
import { LockedError, RuleViolationError, UnauthorizedError } from '@/lib/errors';
import { logger, type Logger } from '@/lib/logger';

export const SIGN_IN_COPY = {
  wrong: 'Email or password is wrong.',
  inactive: 'This account is not active.',
  locked: 'Too many attempts. Try again in 15 minutes.',
  tempExpired: 'This temporary password has expired. Ask your admin for a new one.',
} as const;

export type SignInContext = {
  ip: string;
  now: Date;
  sleep: (ms: number) => Promise<void>;
  log?: Logger;
};

export type SignInResult = { token: string; expiresAt: Date; destination: string };

/** Returns the new session token and where to go. Throws AppError: 401, 422 or 429. */
export async function signIn(input: SignInInput, ctx: SignInContext): Promise<SignInResult> {
  const log = ctx.log ?? logger;
  const emailHash = hashEmail(input.email);
  const since = windowStart(ctx.now);

  const ip = ipDecision(await countDistinctEmailsByIp(ctx.ip, since));
  if (ip.action === 'block') {
    log.warn('sign_in.locked', { reason: 'ip_limit' });
    throw new LockedError(RETRY_AFTER_SECONDS, SIGN_IN_COPY.locked);
  }
  if (ip.action === 'delay') await ctx.sleep(ip.delayMs);

  if (isLockedOut(await countFailures(emailHash, since))) {
    log.warn('sign_in.locked', { reason: 'email_lockout' });
    throw new LockedError(RETRY_AFTER_SECONDS, SIGN_IN_COPY.locked);
  }

  const result = await verifyCredentials(input.email, verifierFor(input.password));
  if (!result.ok) {
    await recordFailure(emailHash, ctx.ip, ctx.now);
    log.warn('sign_in.failed', { reason: 'wrong_credentials' });
    throw new UnauthorizedError(SIGN_IN_COPY.wrong);
  }

  const user = result.user;
  const block = accountBlock(user, ctx.now);
  if (block === 'inactive') {
    log.warn('sign_in.failed', { userId: user.id, reason: 'inactive' });
    throw new RuleViolationError(SIGN_IN_COPY.inactive);
  }
  if (block === 'temp_expired') {
    log.warn('sign_in.failed', { userId: user.id, reason: 'temp_expired' });
    throw new RuleViolationError(SIGN_IN_COPY.tempExpired);
  }

  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = sessionExpiresAt(ctx.now);
  await createSessionAfterSignIn({ userId: user.id, emailHash, tokenHash, expiresAt });

  // The role is not in the credential result, so read it from the new session row. '/' redirects by role if the row is gone.
  const row = await findSessionByTokenHash(tokenHash, ctx.now);
  const destination = row
    ? signInDestination(row.role, user.mustChangePassword, checkedReturnTo(input.returnTo))
    : user.mustChangePassword
      ? FORCED_CHANGE_PATH
      : '/';
  log.info('sign_in.ok', { userId: user.id });
  return { token, expiresAt, destination };
}
