'use server';
// Purpose: own password change action. Thin: authorise, parse, call the flow, rotate the cookie, redirect.
// Rules: standards/api.md, spec S01 sections 3 and 5. Acts on the session user only, never an id from input.
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { ChangePasswordInput } from '@/contracts/auth';
import { requirePermission } from '@/contracts/permissions';
import { roleHome } from '@/domain/auth/rules';
import { changePassword } from '@/lib/auth/change-password';
import { clientIp } from '@/lib/auth/client-ip';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth/cookie';
import { fieldErrorsFrom, stateFromError, validationState, type FormState } from '@/lib/auth/form-state';
import { getSession } from '@/lib/auth/session';
import { UnauthorizedError } from '@/lib/errors';
import { logger } from '@/lib/logger';

const text = (data: FormData, name: string) => {
  const v = data.get(name);
  return typeof v === 'string' ? v : undefined;
};

export async function changePasswordAction(_previous: FormState | undefined, formData: FormData): Promise<FormState> {
  const h = await headers();
  const requestId = h.get('x-request-id') ?? crypto.randomUUID();
  const session = await getSession();
  try {
    requirePermission(session, 'account.password');
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      logger.child(requestId).warn('authz.denied', { action: 'change_password', reason: 'unauthenticated' });
      redirect('/sign-in');
    }
    throw err;
  }
  if (session === null) redirect('/sign-in');

  const log = logger.child(requestId, { userId: session.id });

  const parsed = ChangePasswordInput.safeParse({
    currentPassword: text(formData, 'currentPassword'),
    newPassword: text(formData, 'newPassword'),
    version: text(formData, 'version'),
  });
  if (!parsed.success) {
    log.warn('validation.failed', { action: 'change_password' });
    return validationState(
      fieldErrorsFrom(parsed.error, { currentPassword: 'Enter your current password.', newPassword: 'Use at least 12 characters.' }, requestId),
    );
  }

  try {
    const result = await changePassword(session, parsed.data, {
      ip: clientIp(h),
      now: new Date(),
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      log,
    });
    (await cookies()).set(SESSION_COOKIE, result.token, sessionCookieOptions(result.expiresAt));
  } catch (err) {
    const state = stateFromError(err, { unauthenticated: 'currentPassword', 'rule-violation': 'newPassword' });
    if (state === undefined) {
      log.error('password.error', { err });
      throw err;
    }
    return state;
  }
  redirect(roleHome(session.role));
}
