// Purpose: per-request nonce CSP and request id. Next.js 16 name for middleware (installed next 16.4.6).
// Rules: standards/security.md (CSP), standards/logging.md (accept x-request-id or make one, return it on the response).
// No auth here: E-001/S-01 owns sessions. Static headers live in next.config.ts.
// Source: https://nextjs.org/docs/app/guides/content-security-policy
import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';

const REQUEST_ID = /^[A-Za-z0-9._-]{8,128}$/;

/** Keep a caller id only when it is a safe token. Else make a new one. Stops log and header injection. */
function requestIdFrom(request: NextRequest): string {
  const given = request.headers.get('x-request-id');
  return given && REQUEST_ID.test(given) ? given : crypto.randomUUID();
}

function buildCsp(nonce: string): string {
  const dev = env.NODE_ENV === 'development';
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
}

/** Make the nonce and request id, then pass both to the app and put them on the response. */
export function proxy(request: NextRequest): NextResponse {
  const nonce = btoa(crypto.randomUUID());
  const requestId = requestIdFrom(request);
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('x-request-id', requestId);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('x-request-id', requestId);
  return response;
}

export const config = {
  // Every path except build assets. API routes are included so each response has a request id.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
