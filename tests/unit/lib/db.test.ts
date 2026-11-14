// Purpose: Unit tests for database retry policy and error detection (src/lib/db.ts).
// Rules: standards/testing.md, standards/data.md. Retry on P2034 / 40001 up to limit, re-throw persistent or non-retryable error.
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { isRetryable, MAX_RETRIES, withRetry } from '@/lib/db';

describe('src/lib/db: retry policy and concurrency conflict detection', () => {
  describe('MAX_RETRIES constant', () => {
    it('is configured to 3 retries', () => {
      expect(MAX_RETRIES).toBe(3);
    });
  });

  describe('isRetryable', () => {
    it('detects Prisma P2034 write conflict / deadlock code', () => {
      expect(isRetryable({ code: 'P2034' })).toBe(true);
    });

    it('detects Postgres 40001 serialization failure code', () => {
      expect(isRetryable({ code: '40001' })).toBe(true);
    });

    it('detects retryable codes in meta.code and meta.originalCode', () => {
      expect(isRetryable({ meta: { code: 'P2034' } })).toBe(true);
      expect(isRetryable({ meta: { originalCode: '40001' } })).toBe(true);
    });

    it('detects retryable codes in nested cause objects up to depth 3', () => {
      const wrapped = {
        name: 'PrismaClientUnknownRequestError',
        cause: {
          name: 'DriverAdapterError',
          cause: {
            code: '40001',
          },
        },
      };
      expect(isRetryable(wrapped)).toBe(true);
    });

    it('returns false for non-retryable error codes and generic errors', () => {
      expect(isRetryable(null)).toBe(false);
      expect(isRetryable(undefined)).toBe(false);
      expect(isRetryable('some string error')).toBe(false);
      expect(isRetryable(new Error('connection failed'))).toBe(false);
      expect(isRetryable({ code: 'P2002' })).toBe(false); // Unique constraint violation
      expect(isRetryable({ code: '23505' })).toBe(false);
    });
  });

  describe('withRetry', () => {
    it('returns result immediately when operation succeeds on first attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const result = await withRetry(fn);
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries on P2034 and succeeds if an attempt resolves', async () => {
      const p2034Err = { code: 'P2034', message: 'Write conflict' };
      const fn = vi
        .fn()
        .mockRejectedValueOnce(p2034Err)
        .mockRejectedValueOnce(p2034Err)
        .mockResolvedValueOnce('resolved on attempt 3');

      const result = await withRetry(fn);
      expect(result).toBe('resolved on attempt 3');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('retries on 40001 serialization failure and succeeds', async () => {
      const serializationErr = { code: '40001', message: 'could not serialize access' };
      const fn = vi
        .fn()
        .mockRejectedValueOnce(serializationErr)
        .mockResolvedValueOnce('resolved on attempt 2');

      const result = await withRetry(fn);
      expect(result).toBe('resolved on attempt 2');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('does NOT retry on non-retryable errors and throws immediately', async () => {
      const nonRetryable = new Error('Constraint violation');
      const fn = vi.fn().mockRejectedValue(nonRetryable);

      await expect(withRetry(fn)).rejects.toThrow('Constraint violation');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('throws the last retryable error when retries are exhausted (1 initial + 3 retries = 4 total)', async () => {
      const persistentErr = { code: 'P2034', message: 'Deadlock persists' };
      const fn = vi.fn().mockRejectedValue(persistentErr);

      await expect(withRetry(fn)).rejects.toEqual(persistentErr);
      expect(fn).toHaveBeenCalledTimes(MAX_RETRIES + 1); // 4 attempts
    });
  });
});
