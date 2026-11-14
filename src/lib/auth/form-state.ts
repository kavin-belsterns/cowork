// Purpose: the form state that sign-in and password actions return to useActionState.
// Rules: spec S01 section 3 (actions return form state, they do not throw expected errors to the client) and section 2 (copy).
// Fields and summary come from the AppError detail or fixed copy, which is safe to show. Zod text is never used.
import type { ZodError } from 'zod';
import { AppError } from '@/lib/errors';

export type FormState = {
  /** One line for the error summary, which takes focus. */
  summary: string;
  /** Message per field name. */
  fieldErrors: Record<string, string>;
  /** RFC 9457 type name, for tests and for the page to branch on. */
  type: string;
  /** Set for `locked`. Seconds from the Retry-After header. */
  retryAfterSeconds?: number;
} | null;

/** The `internal` copy from the Errors table, with a reference id. Safe to show. */
export function internalCopy(requestId: string): string {
  return `Something went wrong. Try again. If it happens again, give reference ${requestId} to your admin.`;
}

/**
 * Safe copy per failed field. Zod text never reaches the user.
 * A field in `copy` gets that text. A too long value, or a field not in `copy`, gets the `internal` copy under `form`.
 */
export function fieldErrorsFrom(error: ZodError, copy: Record<string, string>, requestId: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? 'form');
    const text = issue.code === 'too_big' ? undefined : copy[field];
    if (text !== undefined) out[field] ??= text;
    else out.form ??= internalCopy(requestId);
  }
  return out;
}

export function validationState(fieldErrors: Record<string, string>): FormState {
  return { summary: Object.values(fieldErrors)[0] ?? 'Check the form.', fieldErrors, type: 'validation' };
}

/**
 * Turn an expected AppError into form state. An unexpected error returns undefined so the caller rethrows it.
 * `fieldFor` puts the message at a field for the types that belong to one.
 */
export function stateFromError(err: unknown, fieldFor: Partial<Record<string, string>> = {}): FormState | undefined {
  if (!(err instanceof AppError)) return undefined;
  const type = err.type ?? 'internal';
  const field = fieldFor[type];
  const retry = Number(err.headers?.['retry-after']);
  return {
    summary: err.message,
    fieldErrors: field ? { [field]: err.message } : {},
    type,
    ...(type === 'locked' && Number.isFinite(retry) ? { retryAfterSeconds: retry } : {}),
  };
}
