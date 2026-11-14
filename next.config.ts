// Purpose: base Next.js settings and the static security headers.
// Written by S-00 T-01, extended by T-03 (spec S-00 section 5). The nonce CSP is set per request in src/proxy.ts.
// Rules: standards/security.md (HSTS, nosniff, Referrer-Policy, Origin check for server actions).
import type { NextConfig } from 'next';
import { env } from './src/lib/env';

// Server actions compare Origin to Host. Allow the client hostname only: host without scheme.
const appHost = new URL(env.APP_ORIGIN).host;

const config: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    serverActions: {
      // CSV import upload limit (spec S-00 section 5).
      bodySizeLimit: '2mb',
      allowedOrigins: [appHost],
    },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default config;
