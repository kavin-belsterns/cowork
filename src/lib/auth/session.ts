// Purpose: getSession() reads the cookie and loads the signed-in user, fresh from `users` each request.
// Rules: spec S01 section 3. Expired or deactivated gives null. Role and status are never cached in the cookie.
import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import type { SessionUser } from '@/contracts/auth';
import { findSessionByTokenHash, type SessionRow } from '@/data/session';
import { SESSION_COOKIE } from '@/lib/auth/cookie';
import { hashToken } from '@/lib/auth/token';

/** Map the data row to the contract type. Pure, so it is tested without cookies. */
export function toSessionUser(row: SessionRow): SessionUser {
  return {
    id: row.userId,
    name: row.name,
    role: row.role,
    officeId: row.officeId,
    mustChangePassword: row.mustChangePassword,
    expiresAt: row.expiresAt.toISOString(),
    version: row.version,
  };
}

/** Look up a raw cookie value. No value, or no live row, gives null. */
export async function sessionFromToken(token: string | undefined, now: Date): Promise<SessionUser | null> {
  if (!token) return null;
  const row = await findSessionByTokenHash(hashToken(token), now);
  return row ? toSessionUser(row) : null;
}

/** The signed-in user for this request, or null. One lookup per request. */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  return sessionFromToken(store.get(SESSION_COOKIE)?.value, new Date());
});
