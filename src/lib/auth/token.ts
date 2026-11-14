// Purpose: session token and hash helpers. Only hashes reach the database.
// Rules: spec S01 section 5 (256-bit CSPRNG token, SHA-256 stored), design.md Security, data (email_hash).
import { createHash, randomBytes } from 'node:crypto';

/** 256 random bits from the OS CSPRNG, base64url (43 characters). */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/** SHA-256 hex of a token. This is what `sessions.token_hash` holds. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** SHA-256 hex of the trimmed, lower-cased email. The key for lockout counts. */
export function hashEmail(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

/** Lockout key for a signed-in user's password change. Not an email, so it never collides with a sign-in key. */
export function hashUserKey(userId: string): string {
  return createHash('sha256').update(`user:${userId}`).digest('hex');
}
