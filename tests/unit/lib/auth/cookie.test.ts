// Purpose: unit tests for src/lib/auth/cookie.ts. Flags per spec S01 section 5.
import { describe, expect, it } from 'vitest';
import { SESSION_COOKIE, clearedCookieOptions, sessionCookieOptions } from '@/lib/auth/cookie';

describe('E-001/AC-71 session cookie', () => {
  it('uses the __Host- name', () => {
    expect(SESSION_COOKIE).toBe('__Host-session');
  });

  it('sets HttpOnly, Secure, SameSite=Lax, Path=/ and no Domain', () => {
    const end = new Date('2026-11-14T22:00:00Z');
    const options = sessionCookieOptions(end);
    expect(options).toEqual({ httpOnly: true, secure: true, sameSite: 'lax', path: '/', expires: end });
    expect(options).not.toHaveProperty('domain');
  });

  it('clears with the same flags and max age 0', () => {
    expect(clearedCookieOptions()).toEqual({ httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 });
  });
});
