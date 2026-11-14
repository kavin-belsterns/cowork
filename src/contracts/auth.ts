// Purpose: sign-in, password change and the session type. Written by S-00 only.
// Rules: design.md Security (passwords 12 to 128 on change, 1 to 128 on sign-in, return path is a same-origin relative path).
import { z } from 'zod';
import { LIMITS, Id, Instant, Version, blankToUndefined } from '@/contracts/common';
import { Role } from '@/contracts/permissions';

/** One `/` then a path. No `//`, no `/\`, no scheme, no spaces or control characters. Anything else falls back to the role home. */
export const ReturnTo = z
  .string()
  .max(512)
  .regex(/^\/(?![/\\])[^\s\\\u0000-\u001f]*$/);

export const SignInInput = z.strictObject({
  email: z.string().trim().min(1).max(LIMITS.email).pipe(z.email()),
  password: z.string().min(1).max(LIMITS.passwordMax),
  returnTo: blankToUndefined(ReturnTo),
});
export type SignInInput = z.infer<typeof SignInInput>;

export const ChangePasswordInput = z.strictObject({
  currentPassword: z.string().min(1).max(LIMITS.passwordMax),
  // AC-72: shorter than 12 characters is rejected with "Use at least 12 characters."
  newPassword: z.string().min(LIMITS.passwordMin, { message: 'Use at least 12 characters.' }).max(LIMITS.passwordMax),
  version: Version,
});
export type ChangePasswordInput = z.infer<typeof ChangePasswordInput>;

/** What getSession() returns each request. It is filled from `users`, so role and office are never stale. */
export const SessionUser = z.strictObject({
  id: Id,
  name: z.string().min(1).max(LIMITS.name),
  role: Role,
  officeId: Id.nullable(),
  mustChangePassword: z.boolean(),
  /** End of the 12 hour session. Drives the 5 minute warning. */
  expiresAt: Instant,
  /** The user row version. Password change sends it back as `version`. */
  version: Version,
});
export type SessionUser = z.infer<typeof SessionUser>;
