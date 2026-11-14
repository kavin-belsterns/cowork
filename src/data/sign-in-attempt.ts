// Purpose: data calls for the sign_in_attempts table, the one store for lockout and IP limit counts.
// Rules: spec S01 section 4, design.md Data design (SignInAttempt). Inputs are hashes and the client IP. Never a raw email.
// Indexes: sign_in_attempts_email_at_idx (Q1), sign_in_attempts_ip_at_idx (Q2).
import 'server-only';
import { getDb } from '@/lib/db';

/** Insert one failure row. `at` comes from the caller so rules and tests share one clock. */
export async function recordFailure(emailHash: string, ip: string, at: Date): Promise<void> {
  await getDb('web').signInAttempt.create({ data: { emailHash, ip, at }, select: { id: true } });
}

/** Q1: failures for one email hash at or after `since`. Uses sign_in_attempts_email_at_idx. */
export async function countFailures(emailHash: string, since: Date): Promise<number> {
  return getDb('web').signInAttempt.count({ where: { emailHash, at: { gte: since } } });
}

/** Q2: distinct email hashes seen from one IP at or after `since`. Uses sign_in_attempts_ip_at_idx. */
export async function countDistinctEmailsByIp(ip: string, since: Date): Promise<number> {
  const rows = await getDb('web').signInAttempt.findMany({
    where: { ip, at: { gte: since } },
    distinct: ['emailHash'],
    select: { emailHash: true },
  });
  return rows.length;
}

/** Delete every failure row for one hash. Called after a successful password change for the user key hash. */
export async function clearFailures(emailHash: string): Promise<void> {
  await getDb('web').signInAttempt.deleteMany({ where: { emailHash } });
}
