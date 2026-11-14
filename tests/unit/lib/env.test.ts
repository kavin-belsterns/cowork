// Purpose: Unit tests for environment variable validation (src/lib/env.ts).
// Rules: standards/testing.md, standards/security.md. Fast failure on missing/bad vars, no secret values in errors.
import { describe, expect, it } from 'vitest';
import { loadEnv, requireEnv } from '@/lib/env';

describe('src/lib/env: environment variable schema and validation', () => {
  const validBase = {
    APP_ORIGIN: 'https://rooms.example.com',
  };

  describe('APP_ORIGIN validation', () => {
    it('accepts valid origin with scheme and host only', () => {
      const parsed = loadEnv({ APP_ORIGIN: 'https://rooms.example.com' });
      expect(parsed.APP_ORIGIN).toBe('https://rooms.example.com');

      const localhostParsed = loadEnv({ APP_ORIGIN: 'http://localhost:3000' });
      expect(localhostParsed.APP_ORIGIN).toBe('http://localhost:3000');
    });

    it('fails fast when APP_ORIGIN is missing', () => {
      expect(() => loadEnv({})).toThrow(/Invalid environment\. Fix these variables: APP_ORIGIN/);
    });

    it('fails when APP_ORIGIN has a trailing slash', () => {
      expect(() => loadEnv({ APP_ORIGIN: 'https://rooms.example.com/' })).toThrow(/APP_ORIGIN/);
    });

    it('fails when APP_ORIGIN includes a path', () => {
      expect(() => loadEnv({ APP_ORIGIN: 'https://rooms.example.com/app' })).toThrow(/APP_ORIGIN/);
    });

    it('fails when APP_ORIGIN uses an unsupported protocol', () => {
      expect(() => loadEnv({ APP_ORIGIN: 'ftp://rooms.example.com' })).toThrow(/APP_ORIGIN/);
    });
  });

  describe('NODE_ENV and LOG_LEVEL defaults and validation', () => {
    it('applies default development and info levels when unspecified', () => {
      const parsed = loadEnv(validBase);
      expect(parsed.NODE_ENV).toBe('development');
      expect(parsed.LOG_LEVEL).toBe('info');
    });

    it('accepts valid enum choices', () => {
      const parsed = loadEnv({
        ...validBase,
        NODE_ENV: 'production',
        LOG_LEVEL: 'warn',
      });
      expect(parsed.NODE_ENV).toBe('production');
      expect(parsed.LOG_LEVEL).toBe('warn');
    });

    it('rejects invalid enum values', () => {
      expect(() => loadEnv({ ...validBase, NODE_ENV: 'staging' as unknown as 'development' })).toThrow(/NODE_ENV/);
      expect(() => loadEnv({ ...validBase, LOG_LEVEL: 'verbose' as unknown as 'info' })).toThrow(/LOG_LEVEL/);
    });
  });

  describe('Database URL validation', () => {
    it('accepts postgresql and postgres protocols for database URLs', () => {
      const parsed = loadEnv({
        ...validBase,
        DATABASE_URL_WEB: 'postgresql://app_web:secret@localhost:5432/app',
        DATABASE_URL_WORKER: 'postgres://app_worker:secret@localhost:5432/app',
      });
      expect(parsed.DATABASE_URL_WEB).toBe('postgresql://app_web:secret@localhost:5432/app');
      expect(parsed.DATABASE_URL_WORKER).toBe('postgres://app_worker:secret@localhost:5432/app');
    });

    it('rejects non-postgres protocols and malformed URLs', () => {
      expect(() =>
        loadEnv({
          ...validBase,
          DATABASE_URL_WEB: 'mysql://root:secret@localhost:3306/db',
        }),
      ).toThrow(/DATABASE_URL_WEB/);

      expect(() =>
        loadEnv({
          ...validBase,
          DATABASE_URL_WORKER: 'not-a-valid-url',
        }),
      ).toThrow(/DATABASE_URL_WORKER/);
    });

    it('treats empty strings as unset/undefined', () => {
      const parsed = loadEnv({
        ...validBase,
        DATABASE_URL_WEB: '',
        LOG_LEVEL: '',
      });
      expect(parsed.DATABASE_URL_WEB).toBeUndefined();
      expect(parsed.LOG_LEVEL).toBe('info'); // fell back to default
    });
  });

  describe('requireEnv and secret safety', () => {
    it('returns the requested variable when present in environment', () => {
      const envObj = loadEnv({
        ...validBase,
        DATABASE_URL_WEB: 'postgresql://app_web:pw@localhost:5432/db',
      });
      expect(requireEnv('DATABASE_URL_WEB', envObj)).toBe('postgresql://app_web:pw@localhost:5432/db');
    });

    it('throws with variable name but NEVER exposes secrets in error message', () => {
      const envObj = loadEnv(validBase);
      expect(() => requireEnv('DATABASE_URL_WORKER', envObj)).toThrow(
        'Missing environment variable: DATABASE_URL_WORKER',
      );
    });
  });
});
