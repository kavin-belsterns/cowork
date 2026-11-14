// Purpose: Vitest runs unit and integration tests only. Playwright owns ui, e2e. Load tests use k6.
// Rules: standards/testing.md. Tests live under tests/, never under src/. Coverage reads src/.
// Source: https://nextjs.org/docs/app/guides/testing/vitest and https://vitest.dev/config/coverage
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Match the "@/*" and "@generated/*" paths in tsconfig.json.
    alias: {
      '@generated': fileURLToPath(new URL('./generated', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node', // component rendering is covered by Playwright ui tests
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    passWithNoTests: true, // S-00 may land before any test. check-ac-coverage.sh catches gaps at release.
    // src/lib/env.ts reads these at import. Test values only. The test database is a throwaway container on 127.0.0.1:5433.
    env: {
      NODE_ENV: 'test',
      DATABASE_URL_WEB: process.env.DATABASE_URL_WEB ?? 'postgresql://app_web:app_web@localhost:5433/app_test',
      DATABASE_URL_WORKER: process.env.DATABASE_URL_WORKER ?? 'postgresql://app_worker:app_worker@localhost:5433/app_test',
      DATABASE_URL_MIGRATOR: process.env.DATABASE_URL_MIGRATOR ?? 'postgresql://app_owner:app_owner@localhost:5433/app_test',
      APP_ORIGIN: 'http://localhost:3000',
      LOG_LEVEL: 'error',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      // Async Server Components cannot run in Vitest. Pages and layouts are covered by ui and e2e.
      exclude: ['src/app/**/page.tsx', 'src/app/**/layout.tsx', 'src/**/*.d.ts'],
      thresholds: { lines: 80, functions: 80, branches: 70 },
    },
  },
});
