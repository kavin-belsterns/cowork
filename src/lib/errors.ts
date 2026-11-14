// Purpose: RFC 9457 Problem Details and the app error classes. The only way to build an error response.
// Rules: standards/api.md. Never return stack, SQL, paths or raw error.message. instance is the request id.
// Types and copy: design.md Errors table. Type URIs are /problems/<type>.
// Source: https://www.rfc-editor.org/rfc/rfc9457.html
import type { ProblemType } from '@/contracts/common';

export type ProblemDetails = {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  [extension: string]: unknown;
};

const TITLES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Content',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
};

type ProblemInit = { type?: string; title?: string; detail?: string; instance?: string; extensions?: Record<string, unknown> };

/** Build a problem object. A bare type name such as `validation` becomes `/problems/validation`. No type gives about:blank. */
export function problem(status: number, init: ProblemInit = {}): ProblemDetails {
  const type = init.type === undefined ? 'about:blank' : /^[a-z-]+$/.test(init.type) ? `/problems/${init.type}` : init.type;
  const title = init.title ?? TITLES[status] ?? 'Error';
  const body: ProblemDetails = { ...init.extensions, type, title, status };
  if (init.detail) body.detail = init.detail;
  if (init.instance) body.instance = init.instance;
  return body;
}

/** Base class. `detail` must be safe to show to the end user. */
export class AppError extends Error {
  readonly status: number;
  readonly type?: ProblemType;
  readonly extensions?: Record<string, unknown>;
  readonly headers?: Record<string, string>;

  constructor(
    status: number,
    detail: string,
    opts: { type?: ProblemType; extensions?: Record<string, unknown>; headers?: Record<string, string> } = {},
  ) {
    super(detail);
    this.name = new.target.name;
    this.status = status;
    this.type = opts.type;
    this.extensions = opts.extensions;
    this.headers = opts.headers;
  }
}

export class UnauthorizedError extends AppError {
  constructor(detail = 'Please sign in again.') {
    super(401, detail, { type: 'unauthenticated' });
  }
}

export class ForbiddenError extends AppError {
  constructor(detail = 'You do not have access to this.') {
    super(403, detail, { type: 'forbidden' });
  }
}

/** Thrown by requirePermission while must_change_password is set. Pages catch it and redirect to /account/password. */
export class PasswordChangeRequiredError extends ForbiddenError {
  constructor() {
    super('Set a new password to continue.');
  }
}

export class NotFoundError extends AppError {
  constructor(detail = 'We could not find this item.') {
    super(404, detail, { type: 'not-found' });
  }
}

/** 400 for a bad shape (default). Use RuleViolationError when the shape is valid but a business rule fails. */
export class ValidationError extends AppError {
  constructor(detail: string, issues: { path: string; message: string }[] = [], status: 400 | 422 = 400) {
    super(status, detail, { type: status === 400 ? 'validation' : 'rule-violation', extensions: issues.length ? { issues } : undefined });
  }
}

/** 409. Two confirmed bookings overlap (Postgres 23P01). */
export class BookingConflictError extends AppError {
  constructor(detail = 'This room was just booked. Pick another time.') {
    super(409, detail, { type: 'booking-conflict' });
  }
}

/** 409. The row changed since the user loaded it (updateMany count 0). */
export class VersionConflictError extends AppError {
  constructor(detail = 'Someone changed this. Reload to see it.') {
    super(409, detail, { type: 'version-conflict' });
  }
}

/** 409. The same idempotency key is still running. */
export class RequestInProgressError extends AppError {
  constructor(detail = 'This is still saving. Wait a moment.') {
    super(409, detail, { type: 'request-in-progress' });
  }
}

/** 422. The same idempotency key came with a different payload. */
export class RequestChangedError extends AppError {
  constructor(detail = 'This request changed. Submit it again.') {
    super(422, detail, { type: 'request-changed' });
  }
}

/** 422. A business rule failed. `detail` carries the EARS text. Extensions may carry lists such as `bookings`. */
export class RuleViolationError extends AppError {
  constructor(detail: string, extensions?: Record<string, unknown>) {
    super(422, detail, { type: 'rule-violation', extensions });
  }
}

/** 429. Lockout or IP limit. `retryAfterSeconds` becomes the Retry-After header. */
export class LockedError extends AppError {
  constructor(retryAfterSeconds = 900, detail = 'Too many attempts. Try again in 15 minutes.') {
    super(429, detail, { type: 'locked', headers: { 'retry-after': String(retryAfterSeconds) } });
  }
}

/** Find the Postgres SQLSTATE in a Prisma or driver error without importing the driver. */
function sqlState(err: unknown): string | undefined {
  const seen = new Set<unknown>();
  const stack: unknown[] = [err];
  while (stack.length > 0) {
    const cur = stack.pop();
    if (!cur || typeof cur !== 'object' || seen.has(cur)) continue;
    seen.add(cur);
    const o = cur as Record<string, unknown>;
    for (const key of ['code', 'originalCode']) {
      const v = o[key];
      if (typeof v === 'string' && /^[0-9A-Z]{5}$/.test(v) && !/^P\d{4}$/.test(v)) return v;
    }
    stack.push(o.meta, o.cause, o.driverAdapterError);
  }
  return undefined;
}

/** Map a database error to an AppError. Returns null for errors with no mapping. The caller logs the cause. */
export function mapDbError(err: unknown): AppError | null {
  if (err instanceof AppError) return err;
  const state = sqlState(err);
  if (state === '23P01') return new BookingConflictError();
  return null;
}

/** Turn any thrown value into a problem+json Response. Unknown errors become a generic 500. Caller logs the cause. */
export function toResponse(err: unknown, requestId: string): Response {
  const known = err instanceof AppError;
  const body = known
    ? problem(err.status, { type: err.type, detail: err.message, instance: requestId, extensions: err.extensions })
    : problem(500, {
        type: 'internal',
        detail: `Something went wrong. Try again. If it happens again, give reference ${requestId} to your admin.`,
        instance: requestId,
      });
  return new Response(JSON.stringify(body), {
    status: body.status,
    headers: { 'content-type': 'application/problem+json', 'x-request-id': requestId, ...(known ? err.headers : {}) },
  });
}
