// Purpose: Integration house tests for security headers, CSP nonce and request id propagation.
// Rules: standards/testing.md, standards/security.md. HSTS, nosniff, Referrer-Policy, X-Frame-Options, CSP strict-dynamic.
import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import nextConfig from '@/../next.config';
import { proxy } from '@/proxy';

describe('House security headers: static headers and dynamic proxy CSP', () => {
  describe('next.config.ts static security headers', () => {
    it('declares the mandatory security headers for all paths (/:path*)', async () => {
      expect(nextConfig.headers).toBeDefined();
      const headersConfig = await nextConfig.headers!();
      expect(headersConfig).toHaveLength(1);

      const entry = headersConfig[0]!;
      expect(entry.source).toBe('/:path*');

      const map = new Map(entry.headers.map((h: { key: string; value: string }) => [h.key.toLowerCase(), h.value]));

      // Strict-Transport-Security: max-age=31536000; includeSubDomains
      expect(map.get('strict-transport-security')).toBe('max-age=31536000; includeSubDomains');

      // X-Content-Type-Options: nosniff
      expect(map.get('x-content-type-options')).toBe('nosniff');

      // Referrer-Policy: strict-origin-when-cross-origin
      expect(map.get('referrer-policy')).toBe('strict-origin-when-cross-origin');

      // X-Frame-Options: DENY
      expect(map.get('x-frame-options')).toBe('DENY');
    });

    it('disables the X-Powered-By header', () => {
      expect(nextConfig.poweredByHeader).toBe(false);
    });
  });

  describe('src/proxy.ts per-request middleware', () => {
    it('generates a cryptographically strong CSP nonce and sets strict-dynamic on script-src', () => {
      const req = new NextRequest('http://localhost:3000/rooms');
      const res = proxy(req);

      const csp = res.headers.get('content-security-policy');
      expect(csp).toBeDefined();
      expect(csp).not.toBeNull();

      expect(csp).toContain("default-src 'self'");
      expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
      expect(csp).toMatch(/style-src 'self' 'nonce-[A-Za-z0-9+/=]+'/);
      expect(csp).toContain("img-src 'self' blob: data:");
      expect(csp).toContain("font-src 'self'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("base-uri 'self'");
      expect(csp).toContain("form-action 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain('upgrade-insecure-requests');
    });

    it('preserves a valid caller-provided x-request-id on response', () => {
      const validReqId = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4001';
      const req = new NextRequest('http://localhost:3000/api/health', {
        headers: { 'x-request-id': validReqId },
      });
      const res = proxy(req);

      expect(res.headers.get('x-request-id')).toBe(validReqId);
    });

    it('generates a fresh UUID when x-request-id is missing or contains invalid characters', () => {
      const missingReq = new NextRequest('http://localhost:3000/rooms');
      const missingRes = proxy(missingReq);
      const generatedId = missingRes.headers.get('x-request-id');
      expect(generatedId).toBeDefined();
      expect(generatedId).toMatch(/^[0-9a-f-]{36}$/);

      // Malformed / invalid format: spaces, special characters, too short (< 8 chars), too long (> 128 chars)
      const maliciousReq = new NextRequest('http://localhost:3000/rooms', {
        headers: { 'x-request-id': 'bad<script>alert(1)</script>' },
      });
      const maliciousRes = proxy(maliciousReq);
      const safeId = maliciousRes.headers.get('x-request-id');
      expect(safeId).toBeDefined();
      expect(safeId).not.toContain('<script>');
      expect(safeId).toMatch(/^[0-9a-f-]{36}$/);

      const tooShortReq = new NextRequest('http://localhost:3000/rooms', {
        headers: { 'x-request-id': 'short' },
      });
      const tooShortRes = proxy(tooShortReq);
      expect(tooShortRes.headers.get('x-request-id')).not.toBe('short');
      expect(tooShortRes.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
    });
  });
});
