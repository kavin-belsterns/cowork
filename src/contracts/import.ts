// Purpose: CSV import contracts. Written by S-00 only.
// Rules: design.md Security (CSV: 2 MB, 5,000 rows, cells starting = - @ tab or CR rejected, full-cell patterns for phone and floor).
// The row schemas see the raw cell text, so the formula check runs before any trim.
import { z } from 'zod';
import { Email, Id, LIMITS, PHONE_PATTERN } from '@/contracts/common';
import { Role } from '@/contracts/permissions';

export const IMPORT_MAX_BYTES = 2 * 1024 * 1024;
export const IMPORT_MAX_ROWS = 5000;
export const IMPORT_KINDS = ['rooms', 'users'] as const;
export const ImportKind = z.enum(IMPORT_KINDS);
export type ImportKind = z.infer<typeof ImportKind>;

export const ImportUploadInput = z.strictObject({
  officeId: Id,
  kind: ImportKind,
  // The file is parsed, never trusted by MIME type.
  file: z.file().min(1).max(IMPORT_MAX_BYTES),
});
export type ImportUploadInput = z.infer<typeof ImportUploadInput>;

/** Spreadsheet formula starters: = - @ tab carriage return. */
export const FORMULA_START = /^[=\-@\t\r]/;
const noFormula = (v: string) => !FORMULA_START.test(v);
const FORMULA_MESSAGE = 'This cell starts with a character a spreadsheet may run as a formula.';

const cellText = (max: number) =>
  z
    .string()
    .refine(noFormula, { message: FORMULA_MESSAGE })
    .transform((v) => v.trim())
    .pipe(z.string().min(1).max(max));

const optionalCellText = (max: number) =>
  z
    .string()
    .refine(noFormula, { message: FORMULA_MESSAGE })
    .transform((v) => v.trim())
    .pipe(z.string().max(max))
    .transform((v) => (v === '' ? undefined : v))
    .optional();

export const FLOOR_PATTERN = /^-?[0-9]{1,3}$/;

export const RoomCsvRow = z.strictObject({
  name: cellText(LIMITS.name),
  floor: z
    .string()
    .regex(FLOOR_PATTERN)
    .transform((v) => Number(v)),
  size: z
    .string()
    .regex(/^[0-9]{1,4}$/)
    .transform((v) => Number(v))
    .pipe(z.number().int().min(1).max(1000)),
});
export type RoomCsvRow = z.infer<typeof RoomCsvRow>;

export const UserCsvRow = z.strictObject({
  name: cellText(LIMITS.name),
  email: z
    .string()
    .max(LIMITS.email)
    .refine(noFormula, { message: FORMULA_MESSAGE })
    .transform((v) => v.trim())
    .pipe(Email),
  // platform_admin rows pass the schema. The row rules refuse them for office admins (AC-63).
  role: Role,
  phone: z
    .string()
    .regex(PHONE_PATTERN)
    .or(z.literal('').transform(() => undefined))
    .optional(),
  desk: optionalCellText(LIMITS.desk),
});
export type UserCsvRow = z.infer<typeof UserCsvRow>;

/** One bad cell. Row 1 is the first data row. `code` is for logs, `reason` is plain words for the admin. */
export const ImportRowError = z.strictObject({
  row: z.number().int().min(1).max(IMPORT_MAX_ROWS + 1),
  column: z.string().max(60).nullable(),
  code: z.string().min(1).max(60),
  reason: z.string().min(1).max(300),
});
export type ImportRowError = z.infer<typeof ImportRowError>;

export const ImportResult = z.strictObject({
  kind: ImportKind,
  officeId: Id,
  added: z.number().int().min(0).max(IMPORT_MAX_ROWS),
});
export type ImportResult = z.infer<typeof ImportResult>;
