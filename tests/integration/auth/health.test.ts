// Purpose: integration test for GET /api/health. It is public and returns the status and nothing else.
// Rules: spec S01 sections 3 and 6.
import { describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/health/route';

vi.mock('server-only', () => ({}));

describe('GET /api/health', () => {
  it('returns 200 with exactly { status: "ok" } and no session', async () => {
    const res = GET(new Request('http://localhost/api/health'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('carries no cookie, no store and echoes the request id', async () => {
    const res = GET(new Request('http://localhost/api/health', { headers: { 'x-request-id': 'req-123' } }));
    expect(res.headers.get('x-request-id')).toBe('req-123');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('generates a request id when none is sent', () => {
    const res = GET(new Request('http://localhost/api/health'));
    expect(res.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
  });
});
