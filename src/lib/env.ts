// Purpose: the only file that reads process.env. Parses with zod at startup and fails fast.
// Rules: standards/security.md (no secret in code, env validated at boot). Import it from instrumentation.ts so boot fails early.
// Errors list variable names only, never values. Only NEXT_PUBLIC_ names reach the browser, so never put a secret under that prefix.
// Each process holds only its own database URL: web has DATABASE_URL_WEB, the worker has DATABASE_URL_WORKER, scripts have
// DATABASE_URL_MIGRATOR. So the three URLs are optional here. A process entry point calls requireEnv() for the one it needs.
import { z } from 'zod';

const dbUrl = z.url({ protocol: /^postgres(ql)?$/ });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL_WEB: dbUrl.optional(),
  DATABASE_URL_WORKER: dbUrl.optional(),
  DATABASE_URL_MIGRATOR: dbUrl.optional(),
  // Scheme and host only, for example https://rooms.example.com. No path, no trailing slash.
  APP_ORIGIN: z
    .url({ protocol: /^https?$/ })
    .refine((v) => new URL(v).origin === v, { message: 'Use scheme and host only, with no path or trailing slash.' }),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

export type Env = z.infer<typeof schema>;

/** Parse a source object. An empty string counts as unset, so `LOG_LEVEL=` in a .env file is safe. */
export function loadEnv(source: Record<string, string | undefined>): Env {
  const cleaned: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(source)) cleaned[k] = v === '' ? undefined : v;
  const parsed = schema.safeParse(cleaned);
  if (!parsed.success) {
    const names = parsed.error.issues.map((i) => i.path.join('.') || '(root)');
    throw new Error(`Invalid environment. Fix these variables: ${[...new Set(names)].join(', ')}`);
  }
  return parsed.data;
}

export const env: Env = loadEnv(process.env);

type DatabaseVar = 'DATABASE_URL_WEB' | 'DATABASE_URL_WORKER' | 'DATABASE_URL_MIGRATOR';

/** Return the database URL a process needs, or throw with the variable name. Never prints the value. */
export function requireEnv(name: DatabaseVar, source: Env = env): string {
  const value = source[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}
