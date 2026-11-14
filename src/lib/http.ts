// Purpose: the only place that calls fetch. Timeout, bounded retries, exponential backoff with full jitter.
// Rules: standards/api.md. Retry only when idempotent is true and only on transient errors. Retry at one layer only.
// Source: https://builder.aws.com/content/3EumjoZascWd1oZiEgL8ORlv3qE/timeouts-retries-and-backoff-with-jitter

export type HttpPolicy = {
  /** Required. Justify the number in a comment at the call site. */
  timeoutMs: number;
  /** Extra attempts after the first. House default is 3. Ignored when idempotent is false. */
  retries: number;
  /** True only for reads, PUT, DELETE, or a POST that carries an Idempotency-Key. */
  idempotent: boolean;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Test hooks. */
  random?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

export class HttpTimeoutError extends Error {
  constructor(url: string, timeoutMs: number) {
    super(`Request timed out after ${timeoutMs} ms: ${new URL(url).origin}`);
    this.name = 'HttpTimeoutError';
  }
}

const TRANSIENT = new Set([408, 429, 502, 503, 504]);

/** Full jitter: a random delay between 0 and min(cap, base * 2^attempt). */
export function backoffMs(attempt: number, base: number, cap: number, random: () => number): number {
  return Math.floor(random() * Math.min(cap, base * 2 ** attempt));
}

async function once(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const caller = init.signal;
  const onCallerAbort = () => controller.abort();
  if (caller) {
    if (caller.aborted) controller.abort();
    else caller.addEventListener('abort', onCallerAbort, { once: true });
  }
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (controller.signal.aborted && !caller?.aborted) throw new HttpTimeoutError(url, timeoutMs);
    throw err;
  } finally {
    clearTimeout(timer);
    caller?.removeEventListener('abort', onCallerAbort);
  }
}

export async function fetchWithPolicy(url: string, init: RequestInit, policy: HttpPolicy): Promise<Response> {
  const attempts = (policy.idempotent ? Math.max(0, policy.retries) : 0) + 1;
  const base = policy.baseDelayMs ?? 200;
  const cap = policy.maxDelayMs ?? 5000;
  const random = policy.random ?? Math.random;
  const sleep = policy.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  for (let attempt = 0; ; attempt++) {
    const last = attempt === attempts - 1;
    try {
      const res = await once(url, init, policy.timeoutMs);
      if (last || !TRANSIENT.has(res.status)) return res;
      await res.body?.cancel();
    } catch (err) {
      if (last || init.signal?.aborted) throw err;
    }
    await sleep(backoffMs(attempt, base, cap, random));
  }
}
