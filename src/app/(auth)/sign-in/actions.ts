'use server';
// Purpose: sign-in and sign-out server actions. Thin: authorise, parse, call the flow, set or clear the cookie, redirect.
// Rules: standards/api.md, spec S01 section 3. Expected errors return form state. redirect() stays outside try blocks.
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { SignInInput } from '@/contracts/auth';
import { requirePermission } from '@/contracts/permissions';
import { signIn } from '@/lib/auth/sign-in';
import { SESSION_COOKIE, clearedCookieOptions, sessionCookieOptions } from '@/lib/auth/cookie';
import { clientIp } from '@/lib/auth/client-ip';
import { checkedReturnTo } from '@/lib/auth/return-to';
import { fieldErrorsFrom, stateFromError, validationState, type FormState } from '@/lib/auth/form-state';
import { getSession } from '@/lib/auth/session';
import { hashToken } from '@/lib/auth/token';
import { deleteSession } from '@/data/session';
import { logger } from '@/lib/logger';

const text = (data: FormData, name: string) => {
  const v = data.get(name);
  return typeof v === 'string' ? v : undefined;
};

export async function signInAction(_previous: FormState | undefined, formData: FormData): Promise<FormState> {
  requirePermission(null, 'public');
  const h = await headers();
  const requestId = h.get('x-request-id') ?? crypto.randomUUID();
  const log = logger.child(requestId);

  // returnTo is parsed apart. An invalid value is dropped and the role home is used.
  const parsed = SignInInput.omit({ returnTo: true }).safeParse({ email: text(formData, 'email'), password: text(formData, 'password') });
  if (!parsed.success) {
    log.warn('validation.failed', { action: 'sign_in' });
    return validationState(fieldErrorsFrom(parsed.error, { email: 'Enter a valid email address.', password: 'Enter your password.' }, requestId));
  }
  const input = { ...parsed.data, returnTo: checkedReturnTo(text(formData, 'returnTo')) };

  let destination: string;
  try {
    const result = await signIn(input, {
      ip: clientIp(h),
      now: new Date(),
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      log,
    });
    (await cookies()).set(SESSION_COOKIE, result.token, sessionCookieOptions(result.expiresAt));
    destination = result.destination;
  } catch (err) {
    const state = stateFromError(err);
    if (state === undefined) {
      log.error('sign_in.error', { err });
      throw err;
    }
    return state;
  }
  redirect(destination);
}

export async function signOutAction(): Promise<void> {
  requirePermission(null, 'public');
  const h = await headers();
  const log = logger.child(h.get('x-request-id') ?? crypto.randomUUID());
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const session = await getSession();
    await deleteSession(hashToken(token));
    if (session) log.info('session.revoked', { userId: session.id, reason: 'sign_out' });
  }
  store.set(SESSION_COOKIE, '', clearedCookieOptions());
  redirect('/sign-in');
}
