// Purpose: shared helpers for the contract unit tests. Not a test file.
// Each schema gets: one valid sample accepted, an unknown key rejected, each required field rejected when missing,
// and each listed bad value rejected on its own field.
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';

export const ID = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';
export const ID2 = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5c';
export const NOW = '2026-11-16T09:00:00Z';
export const LATER = '2026-11-16T10:00:00Z';

type Case = {
  name: string;
  schema: z.ZodType;
  valid: Record<string, unknown>;
  /** Fields that must be present. Missing one fails. */
  required: string[];
  /** Field to list of bad values. Each one must fail and name that field in the issue path. */
  bad: Record<string, unknown[]>;
};

export function checkSchema(c: Case): void {
  describe(c.name, () => {
    it('accepts one valid sample', () => {
      const r = c.schema.safeParse(c.valid);
      expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
    });

    it('rejects an unknown key', () => {
      expect(c.schema.safeParse({ ...c.valid, extra: 'x' }).success).toBe(false);
    });

    for (const field of c.required) {
      it(`rejects a missing ${field}`, () => {
        const { [field]: _omit, ...rest } = c.valid;
        void _omit;
        const r = c.schema.safeParse(rest);
        expect(r.success).toBe(false);
        expect(r.error?.issues.some((i) => i.path[0] === field)).toBe(true);
      });
    }

    for (const [field, values] of Object.entries(c.bad)) {
      for (const value of values) {
        it(`rejects ${field} = ${JSON.stringify(value)?.slice(0, 40)}`, () => {
          const r = c.schema.safeParse({ ...c.valid, [field]: value });
          expect(r.success).toBe(false);
          expect(r.error?.issues.some((i) => i.path[0] === field)).toBe(true);
        });
      }
    }
  });
}
