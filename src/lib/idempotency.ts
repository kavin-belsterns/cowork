// Purpose: Idempotency-Key handling for writes that create or book (booking, series, visit, walk-in).
// Rules: standards/api.md and design.md sequence. Key scope is (user_id, scope, key). Row status is running or done. TTL 24 hours.
// 400 missing key, 409 still running, 422 same key with a different payload, replay when done. Failure deletes the running row.
// Draft, not an RFC: https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/
import { createHash } from 'node:crypto';
import { RequestChangedError, RequestInProgressError, ValidationError } from '@/lib/errors';

export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

/** `body` holds ids only, never personal data (design.md Data design). */
export type StoredResult = { status: number; body: unknown };

/** What the store says about a key. `done` carries the saved result. */
export type BeginResult = { state: 'new' } | { state: 'in_flight' } | { state: 'mismatch' } | { state: 'done'; result: StoredResult };

export type KeyScope = { userId: string; scope: string; key: string };

/**
 * The api-engineer writes the Prisma store in src/data/idempotency.ts over the idempotency_keys table.
 * `Tx` is the transaction client type, so a booking write can mark the key done inside its own transaction.
 */
export interface IdempotencyStore<Tx = unknown> {
  /** Atomic. Insert a row as running, or report the existing row. A row older than the TTL counts as absent. UNIQUE(user_id, scope, key). */
  begin(input: KeyScope & { requestHash: string; ttlMs: number }): Promise<BeginResult>;
  /** Mark the row done and save the result. Pass `tx` to do it inside the caller's transaction. */
  complete(input: KeyScope, result: StoredResult, tx?: Tx): Promise<void>;
  /** Delete the row so the client can retry. Called after the transaction has rolled back. */
  abandon(input: KeyScope): Promise<void>;
}

/** Same method, path and body give the same hash. Server actions pass method `ACTION` and the action name as path. */
export function hashRequest(method: string, path: string, body: string): string {
  return createHash('sha256').update(`${method}\n${path}\n${body}`).digest('hex');
}

export type IdempotencyContext<Tx> = {
  /** Call inside the write transaction to save the result with the write. If run never calls it, withIdempotency saves after run returns. */
  complete: (result: StoredResult, tx?: Tx) => Promise<void>;
};

export async function withIdempotency<Tx = unknown>(
  store: IdempotencyStore<Tx>,
  input: { userId: string; scope: string; key: string | null; requestHash: string },
  run: (ctx: IdempotencyContext<Tx>) => Promise<StoredResult>,
): Promise<StoredResult & { replayed: boolean }> {
  if (!input.key) throw new ValidationError('The Idempotency-Key header is required.');
  const id: KeyScope = { userId: input.userId, scope: input.scope, key: input.key };
  const begun = await store.begin({ ...id, requestHash: input.requestHash, ttlMs: IDEMPOTENCY_TTL_MS });

  if (begun.state === 'in_flight') throw new RequestInProgressError();
  if (begun.state === 'mismatch') throw new RequestChangedError();
  if (begun.state === 'done') return { ...begun.result, replayed: true };

  let completed = false;
  try {
    const result = await run({
      complete: async (r, tx) => {
        await store.complete(id, r, tx);
        completed = true;
      },
    });
    if (!completed) await store.complete(id, result);
    return { ...result, replayed: false };
  } catch (err) {
    await store.abandon(id); // validation errors, 23P01 and crashes are not saved. The form issues a new key.
    throw err;
  }
}
