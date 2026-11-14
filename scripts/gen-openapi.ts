// Purpose: write docs/api/openapi.yaml (OpenAPI 3.1) from the registry in src/lib/openapi.ts.
// Usage: pnpm exec tsx scripts/gen-openapi.ts [--stdout]
// With --stdout the YAML prints and no file is written. The real write runs as `pnpm docs:openapi`.
// The YAML writer below is small on purpose: the document holds only plain objects, arrays, strings, numbers and booleans.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { buildOpenApiDocument } from '../src/lib/openapi';

const OUTPUT = 'docs/api/openapi.yaml';

function scalar(value: string | number | boolean | null): string {
  if (typeof value === 'string') return JSON.stringify(value);
  return String(value);
}

function isScalar(value: unknown): value is string | number | boolean | null {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}

function lines(value: unknown, indent: number): string[] {
  const pad = ' '.repeat(indent);
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (isScalar(item)) return [`${pad}- ${scalar(item)}`];
      const inner = lines(item, indent + 2);
      return [`${pad}- ${(inner[0] ?? '').trimStart()}`, ...inner.slice(1)];
    });
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .flatMap(([key, v]) => {
        const name = /^[A-Za-z0-9_$/-]+$/.test(key) ? key : JSON.stringify(key);
        if (isScalar(v)) return [`${pad}${name}: ${scalar(v)}`];
        if (Array.isArray(v) && v.length === 0) return [`${pad}${name}: []`];
        if (!Array.isArray(v) && Object.keys(v as object).length === 0) return [`${pad}${name}: {}`];
        return [`${pad}${name}:`, ...lines(v, indent + 2)];
      });
  }
  return [`${pad}${scalar(value as string)}`];
}

const yaml = lines(buildOpenApiDocument(), 0).join('\n') + '\n';

if (process.argv.includes('--stdout')) {
  process.stdout.write(yaml);
} else {
  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, yaml);
  process.stdout.write(`Wrote ${OUTPUT}\n`);
}
