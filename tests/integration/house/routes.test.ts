// Purpose: Integration house tests for routes, response schemas, and error sanitisation.
// Rules: standards/testing.md, standards/api.md, standards/logging.md. Public health schema, no stack traces in error responses, limit=101 validation.
import { describe, expect, it } from 'vitest';
import { HealthResponse } from '@/lib/openapi';
import { PageQuery, PAGE_LIMIT_MAX } from '@/contracts/common';
import { toResponse, ValidationError } from '@/lib/errors';

describe('House route and response integration tests', () => {
  const REQ_ID = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4001';

  describe('GET /api/health response schema', () => {
    it('validates the successful health check payload against HealthResponse schema', () => {
      const validPayload = { status: 'ok' };
      const parsed = HealthResponse.safeParse(validPayload);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.status).toBe('ok');
      }
    });

    it('rejects unexpected properties or invalid status values', () => {
      expect(HealthResponse.safeParse({ status: 'healthy' }).success).toBe(false);
      expect(HealthResponse.safeParse({ status: 'ok', extra: 'unexpected' }).success).toBe(false);
      expect(HealthResponse.safeParse({}).success).toBe(false);
    });
  });

  describe('Paging query parameter limits', () => {
    it('accepts limit up to PAGE_LIMIT_MAX (100) and defaults to 100', () => {
      const defaultParsed = PageQuery.safeParse({});
      expect(defaultParsed.success).toBe(true);
      if (defaultParsed.success) {
        expect(defaultParsed.data.limit).toBe(PAGE_LIMIT_MAX);
      }

      const parsed100 = PageQuery.safeParse({ limit: '100' });
      expect(parsed100.success).toBe(true);
      if (parsed100.success) {
        expect(parsed100.data.limit).toBe(100);
      }
    });

    it('rejects limit=101 with validation failure (max 100 per api.md)', () => {
      const result = PageQuery.safeParse({ limit: '101' });
      expect(result.success).toBe(false);
      if (!result.success) {
        const issues = result.error.issues;
        expect(issues.some((i) => i.path.includes('limit'))).toBe(true);
      }
    });

    it('rejects limit <= 0 or non-numeric strings', () => {
      expect(PageQuery.safeParse({ limit: '0' }).success).toBe(false);
      expect(PageQuery.safeParse({ limit: '-5' }).success).toBe(false);
      expect(PageQuery.safeParse({ limit: 'abc' }).success).toBe(false);
    });
  });

  describe('Error response sanitisation (no stack in responses)', () => {
    it('omits stack traces and internal file paths in 500 error responses', async () => {
      const internalError = new Error('Database syntax error at line 42 in /src/data/secret.ts');
      internalError.stack = 'Error: Database syntax error\n    at query (/src/data/secret.ts:42:15)';

      const res = toResponse(internalError, REQ_ID);
      expect(res.status).toBe(500);
      expect(res.headers.get('content-type')).toBe('application/problem+json');
      expect(res.headers.get('x-request-id')).toBe(REQ_ID);

      const body = await res.json();
      expect(body.type).toBe('/problems/internal');
      expect(body.status).toBe(500);
      expect(body.instance).toBe(REQ_ID);

      const rawJson = JSON.stringify(body);
      expect(rawJson).not.toContain('stack');
      expect(rawJson).not.toContain('/src/data/secret.ts');
      expect(rawJson).not.toContain('syntax error');
      expect(body.detail).toBe(
        `Something went wrong. Try again. If it happens again, give reference ${REQ_ID} to your admin.`,
      );
    });

    it('omits stack traces in AppError responses while preserving safe detail and extensions', async () => {
      const appErr = new ValidationError('Invalid query parameters', [{ path: 'limit', message: 'Too large' }]);
      appErr.stack = 'ValidationError: Invalid query parameters\n    at Object.<anonymous> (/test.ts:1:1)';

      const res = toResponse(appErr, REQ_ID);
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.type).toBe('/problems/validation');
      expect(body.instance).toBe(REQ_ID);
      expect(body.detail).toBe('Invalid query parameters');
      expect(body.issues).toEqual([{ path: 'limit', message: 'Too large' }]);

      const rawJson = JSON.stringify(body);
      expect(rawJson).not.toContain('stack');
      expect(rawJson).not.toContain('/test.ts');
    });
  });
});
