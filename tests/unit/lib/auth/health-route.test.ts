// Purpose: unit test for GET /api/health. Public, returns only { status: "ok" }.
import { describe, expect, it } from 'vitest';
import { GET } from '@/app/api/health/route';

describe('GET /api/health', () => {
  it('returns status ok and nothing else, with the request id echoed', async () => {
    const res = GET(new Request('http://localhost:3000/api/health', { headers: { 'x-request-id': 'req-12345678' } }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
    expect(res.headers.get('x-request-id')).toBe('req-12345678');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('makes a request id when none is sent', () => {
    expect(GET(new Request('http://localhost:3000/api/health')).headers.get('x-request-id')).toBeTruthy();
  });
});
