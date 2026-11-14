// Purpose: Argon2id hashing and verifying, with a dummy verify when there is no stored hash.
// Rules: spec S01 section 5, ADR-0005. Library defaults are Argon2id, 19 MiB, 2 passes, 1 lane (OWASP minimum).
// The algorithm option is left at its default: the package declares it as an ambient const enum, which isolatedModules cannot read.
import 'server-only';
import { hash, verify } from '@node-rs/argon2';

let dummy: Promise<string> | undefined;

/** A hash of a random value, made once. Unknown emails verify against it so timing matches known emails. */
function dummyHash(): Promise<string> {
  dummy ??= hash(`dummy-${crypto.randomUUID()}`);
  return dummy;
}

export function hashPassword(plain: string): Promise<string> {
  return hash(plain);
}

/** True only when `plain` matches `stored`. A null hash runs the dummy verify and returns false. A bad hash returns false. */
export async function verifyPassword(stored: string | null, plain: string): Promise<boolean> {
  if (stored === null) {
    await verify(await dummyHash(), plain).catch(() => false);
    return false;
  }
  try {
    return await verify(stored, plain);
  } catch {
    return false;
  }
}

/** The callback shape `verifyCredentials` and `checkOwnPassword` take. */
export function verifierFor(plain: string): (stored: string | null) => Promise<boolean> {
  return (stored) => verifyPassword(stored, plain);
}
