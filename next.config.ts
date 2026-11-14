// Purpose: base Next.js settings. Written by S-00 T-01.
// T-03 adds the security headers, the nonce CSP and serverActions.allowedOrigins (spec S-00 section 5).
import type { NextConfig } from 'next';

const config: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    serverActions: {
      // CSV import upload limit (spec S-00 section 5).
      bodySizeLimit: '2mb',
    },
  },
};

export default config;
