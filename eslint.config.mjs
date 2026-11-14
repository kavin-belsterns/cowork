// Purpose: lint rules. eslint-config-next plus the house rules from the plugin profile, plus a ban on unsafe raw SQL.
// Rules: standards/ui.md (a11y), standards/logging.md (no console), standards/api.md (one fetch wrapper),
// standards/rules-home.md (pure domain), standards/security.md (env only in src/lib/env.ts), standards/data.md (one PrismaClient).
// Source for jsx-a11y flat config: https://github.com/jsx-eslint/eslint-plugin-jsx-a11y
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import jsxA11y from 'eslint-plugin-jsx-a11y';

const outbound = ['node-fetch', 'axios', 'undici', 'got', 'ky']; // raw HTTP clients, use src/lib/http.ts
const message = 'Call fetchWithPolicy from src/lib/http.ts. It sets the timeout and the retry rules.';

// OWASP A03: raw SQL only by $queryRaw and $executeRaw tagged templates. The Unsafe forms take a string and allow injection.
const unsafeRawSql = [
  {
    selector: "MemberExpression[property.name='$queryRawUnsafe']",
    message: 'Use the $queryRaw tagged template. $queryRawUnsafe is banned (OWASP A03).',
  },
  {
    selector: "MemberExpression[property.name='$executeRawUnsafe']",
    message: 'Use the $executeRaw tagged template. $executeRawUnsafe is banned (OWASP A03).',
  },
];

export default defineConfig([
  globalIgnores(['.next/**', 'out/**', 'coverage/**', 'playwright-report/**', 'test-results/**', 'generated/**', 'node_modules/**', 'next-env.d.ts']),

  ...nextVitals,
  ...nextTs,

  // Static accessibility checks. axe in Playwright covers the browser side.
  // eslint-config-next already registers the jsx-a11y plugin, so only the full recommended rule set is added here.
  { files: ['**/*.{jsx,tsx}'], rules: jsxA11y.flatConfigs.recommended.rules },

  // App Router only. There is no pages/ folder, so this rule only prints a warning.
  { rules: { '@next/next/no-html-link-for-pages': 'off' } },

  // The unsafe raw SQL ban applies to every file.
  {
    files: ['**/*.{ts,tsx,js,jsx,mjs}'],
    rules: { 'no-restricted-syntax': ['error', ...unsafeRawSql] },
  },

  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-console': 'error',
      // Global fetch is not an import, so no-restricted-globals bans it. no-restricted-imports bans raw HTTP packages.
      'no-restricted-globals': ['error', { name: 'fetch', message }],
      'no-restricted-properties': [
        'error',
        { object: 'globalThis', property: 'fetch', message },
        { object: 'process', property: 'env', message: 'Read config from src/lib/env.ts.' },
      ],
      'no-restricted-imports': ['error', { paths: outbound.map((name) => ({ name, message })) }],
      'no-restricted-syntax': [
        'error',
        { selector: "NewExpression[callee.name='PrismaClient']", message: 'One PrismaClient, created in src/lib/db.ts.' },
        ...unsafeRawSql,
      ],
    },
  },

  // The only files allowed to write output, call fetch, read process.env or build a PrismaClient.
  { files: ['src/lib/logger.ts'], rules: { 'no-console': 'off' } },
  { files: ['src/lib/http.ts'], rules: { 'no-restricted-globals': 'off', 'no-restricted-properties': 'off' } },
  { files: ['src/lib/env.ts'], rules: { 'no-restricted-properties': 'off' } },
  { files: ['src/lib/db.ts'], rules: { 'no-restricted-syntax': ['error', ...unsafeRawSql] } },

  // Pure rules: no database, no framework. This block replaces the imports rule above, so it repeats the outbound list.
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [...outbound, '@prisma/client', 'react', 'next'].map((name) => ({ name, message: 'Domain rules stay pure.' })),
          patterns: [{ group: ['next/*', '**/lib/db', '**/lib/http', '**/generated/prisma/**', '@generated/*'], message: 'Domain rules stay pure.' }],
        },
      ],
    },
  },
]);
