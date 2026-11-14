// Purpose: the session cookie name and flags in one place.
// Rules: spec S01 section 5. `__Host-` needs Secure, Path=/ and no Domain. HttpOnly, SameSite=Lax.
export const SESSION_COOKIE = '__Host-session';

export type CookieOptions = {
  httpOnly: true;
  secure: true;
  sameSite: 'lax';
  path: '/';
  expires?: Date;
  maxAge?: number;
};

/** Options for a live session cookie. It ends with the session row. */
export function sessionCookieOptions(expiresAt: Date): CookieOptions {
  return { httpOnly: true, secure: true, sameSite: 'lax', path: '/', expires: expiresAt };
}

/** Options that remove the cookie. Same flags, so the browser matches the `__Host-` cookie. */
export function clearedCookieOptions(): CookieOptions {
  return { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 };
}
