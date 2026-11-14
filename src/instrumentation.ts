// Purpose: log every server render error with its digest, so the reference shown to the user is findable.
// Rules: standards/logging.md. Log the digest, route and request id only. No message text, no stack.
// Source: https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
import type { Instrumentation } from 'next';

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  // The logger writes to stdout. Edge has no stdout, so skip there.
  if (typeof process === 'undefined' || !process.stdout) return;
  const { logger } = await import('@/lib/logger');
  const header = request.headers['x-request-id'];
  const requestId = (Array.isArray(header) ? header[0] : header) ?? 'unknown';
  const digest = (error as { digest?: unknown }).digest;
  logger.child(requestId).error('render error', {
    'error.digest': typeof digest === 'string' ? digest : 'unknown',
    'http.route': context.routePath,
    'http.method': request.method,
    'next.route_type': context.routeType,
  });
};
