// Purpose: the only PrismaClient. Web and worker each build their own, with their own database role.
// Rules: standards/data.md (one client, retry the whole transaction on P2034 or 40001, keep Prisma transaction defaults).
// Prisma 7 needs a driver adapter. The URL comes from src/lib/env.ts: DATABASE_URL_WEB for web, DATABASE_URL_WORKER for the worker.
// Source: https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases/postgresql
import 'server-only';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '@generated/prisma/client';
import { requireEnv } from '@/lib/env';

export type DbRole = 'web' | 'worker';
export type Db = PrismaClient;
/** The client a `$transaction(async (tx) => ...)` callback receives. */
export type Tx = Prisma.TransactionClient;

const URL_VAR = { web: 'DATABASE_URL_WEB', worker: 'DATABASE_URL_WORKER' } as const;

// One client per role per process. globalThis keeps it across hot reloads in development.
const cache = globalThis as unknown as { __db?: Partial<Record<DbRole, Db>> };

/** Return the client for a role. The URL is read when the client is first needed, so a worker never needs the web URL. */
export function getDb(role: DbRole = 'web'): Db {
  const clients = (cache.__db ??= {});
  let client = clients[role];
  if (!client) {
    const adapter = new PrismaPg({ connectionString: requireEnv(URL_VAR[role]) });
    client = new PrismaClient({ adapter });
    clients[role] = client;
  }
  return client;
}

/** Re-run a whole transaction at most this many times after the first try. */
export const MAX_RETRIES = 3;

/** Prisma P2034 (write conflict or deadlock) or Postgres 40001 (serialization failure). The driver may wrap the code. */
export function isRetryable(err: unknown, depth = 0): boolean {
  if (!err || typeof err !== 'object' || depth > 3) return false;
  const e = err as { code?: unknown; meta?: { code?: unknown; originalCode?: unknown }; cause?: unknown };
  const codes = [e.code, e.meta?.code, e.meta?.originalCode];
  if (codes.some((c) => c === 'P2034' || c === '40001')) return true;
  return isRetryable(e.cause, depth + 1);
}

/**
 * Run `fn` again from the start when it fails with P2034 or 40001. `fn` must open its own interactive transaction,
 * so each try starts clean. Any other error, and the last retryable error, is thrown unchanged.
 */
export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= MAX_RETRIES || !isRetryable(err)) throw err;
    }
  }
}
