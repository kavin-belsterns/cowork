// Purpose: Unit tests for outbound HTTP policy (src/lib/http.ts).
// Rules: standards/testing.md, standards/api.md. Backoff calculation, retry limits, cap bounds, idempotency guard.
import { describe, expect, it, vi, afterEach } from 'vitest';
import { backoffMs, fetchWithPolicy, HttpTimeoutError } from '@/lib/http';

describe('src/lib/http: HTTP client with backoff and retry policy', () => {
  describe('backoffMs', () => {
    const base = 200;
    const cap = 5000;

    it('returns 0 when random is 0', () => {
      expect(backoffMs(0, base, cap, () => 0)).toBe(0);
      expect(backoffMs(3, base, cap, () => 0)).toBe(0);
    });

    it('calculates exponential backoff when random is 1', () => {
      // base * 2^attempt
      expect(backoffMs(0, base, cap, () => 1)).toBe(200); // 200 * 1
      expect(backoffMs(1, base, cap, () => 1)).toBe(400); // 200 * 2
      expect(backoffMs(2, base, cap, () => 1)).toBe(800); // 200 * 4
      expect(backoffMs(3, base, cap, () => 1)).toBe(1600); // 200 * 8
      expect(backoffMs(4, base, cap, () => 1)).toBe(3200); // 200 * 16
    });

    it('caps the delay at maxDelayMs regardless of attempt count', () => {
      expect(backoffMs(5, base, cap, () => 1)).toBe(5000); // 200 * 32 = 6400 -> capped at 5000
      expect(backoffMs(10, base, cap, () => 1)).toBe(5000);
    });

    it('scales proportionally with the random factor (full jitter)', () => {
      expect(backoffMs(2, base, cap, () => 0.5)).toBe(400); // 800 * 0.5 = 400
    });
  });

  describe('fetchWithPolicy', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
      vi.restoreAllMocks();
    });

    it('returns response immediately on successful call (200)', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }));
      const sleep = vi.fn();

      const res = await fetchWithPolicy('https://api.example.com/test', {}, {
        timeoutMs: 1000,
        retries: 3,
        idempotent: true,
        sleep,
      });

      expect(res.status).toBe(200);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      expect(sleep).not.toHaveBeenCalled();
    });

    it('retries up to configured retry limit on transient error when idempotent is true', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(new Response('Busy', { status: 503 }))
        .mockResolvedValueOnce(new Response('Rate limited', { status: 429 }))
        .mockResolvedValueOnce(new Response('Success', { status: 200 }));
      globalThis.fetch = fetchMock;

      const sleepDelays: number[] = [];
      const sleep = vi.fn().mockImplementation(async (ms: number) => {
        sleepDelays.push(ms);
      });

      const res = await fetchWithPolicy('https://api.example.com/test', {}, {
        timeoutMs: 1000,
        retries: 3,
        idempotent: true,
        baseDelayMs: 100,
        maxDelayMs: 1000,
        random: () => 1,
        sleep,
      });

      expect(res.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(sleep).toHaveBeenCalledTimes(2);
      expect(sleepDelays).toEqual([100, 200]); // attempt 0: 100, attempt 1: 200
    });

    it('does NOT retry on transient error when idempotent is false', async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response('Busy', { status: 503 }));
      globalThis.fetch = fetchMock;
      const sleep = vi.fn();

      const res = await fetchWithPolicy('https://api.example.com/test', {}, {
        timeoutMs: 1000,
        retries: 3,
        idempotent: false,
        sleep,
      });

      expect(res.status).toBe(503);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(sleep).not.toHaveBeenCalled();
    });

    it('does NOT retry on non-transient error status codes (e.g. 400, 404, 500)', async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response('Bad request', { status: 400 }));
      globalThis.fetch = fetchMock;
      const sleep = vi.fn();

      const res = await fetchWithPolicy('https://api.example.com/test', {}, {
        timeoutMs: 1000,
        retries: 3,
        idempotent: true,
        sleep,
      });

      expect(res.status).toBe(400);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(sleep).not.toHaveBeenCalled();
    });

    it('throws HttpTimeoutError when request times out', async () => {
      globalThis.fetch = vi.fn().mockImplementation((_url, init) => {
        return new Promise((_, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        });
      });

      await expect(
        fetchWithPolicy('https://api.example.com/slow', {}, {
          timeoutMs: 20,
          retries: 0,
          idempotent: true,
          sleep: vi.fn(),
        }),
      ).rejects.toThrow(HttpTimeoutError);
    });

    it('stops retrying after maximum retry attempts exhausted', async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response('Bad Gateway', { status: 502 }));
      globalThis.fetch = fetchMock;
      const sleep = vi.fn();

      const res = await fetchWithPolicy('https://api.example.com/test', {}, {
        timeoutMs: 1000,
        retries: 2,
        idempotent: true,
        sleep,
      });

      expect(res.status).toBe(502);
      expect(fetchMock).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
      expect(sleep).toHaveBeenCalledTimes(2);
    });
  });
});
