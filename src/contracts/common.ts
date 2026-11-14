// Purpose: shared zod pieces every other contract imports. Written by S-00 only. Frozen after S-00 merges.
// Rules: standards/api.md (strict schemas, max lengths, page size cap 100), design.md Errors table and Security limits.
// Form fields arrive as strings, so numbers and booleans go through the preprocess helpers below. An empty string never counts as a number.
import { z } from 'zod';

/** uuid. Ids are uuid v7 made in the app. */
export const Id = z.uuid();
export type Id = z.infer<typeof Id>;

/** Opaque page cursor. The data layer encodes the sort key and the id tiebreaker into it. */
export const Cursor = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9_-]+$/);
export type Cursor = z.infer<typeof Cursor>;

/** Whole number from a number or a numeric string. '' and 'abc' fail. */
export const intField = (min: number, max: number) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() !== '' ? Number(v) : v), z.number().int().min(min).max(max));

/** Checkbox or select value to boolean. Missing means false. */
export const boolField = z.preprocess((v) => (v === 'true' || v === 'on' || v === true ? true : v === undefined || v === 'false' || v === false ? false : v), z.boolean());

/** Turn an empty form value into undefined, so an optional field can stay blank. */
export const blankToUndefined = <T extends z.ZodType>(schema: T) => z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

export const PAGE_LIMIT_MAX = 100;

/** Cursor paging. Limit 1 to 100, default 100. `limit=101` gives 400. */
export const PageQuery = z.strictObject({
  limit: intField(1, PAGE_LIMIT_MAX).default(PAGE_LIMIT_MAX),
  cursor: blankToUndefined(Cursor),
});
export type PageQuery = z.infer<typeof PageQuery>;

/** Random value such as a UUID v4. Max 255 characters (api.md). */
export const IdempotencyKey = z
  .string()
  .min(8)
  .max(255)
  .regex(/^[A-Za-z0-9._~-]+$/);
export type IdempotencyKey = z.infer<typeof IdempotencyKey>;

/** The 11 RFC 9457 types in design.md. The type URI is /problems/<type>. */
export const PROBLEM_TYPES = [
  'validation',
  'unauthenticated',
  'forbidden',
  'not-found',
  'booking-conflict',
  'version-conflict',
  'request-in-progress',
  'request-changed',
  'rule-violation',
  'locked',
  'internal',
] as const;
export const ProblemType = z.enum(PROBLEM_TYPES);
export type ProblemType = z.infer<typeof ProblemType>;

// Field limits from design.md Security: name 120, email 254, phone 30, desk 60, password 128.
export const LIMITS = { name: 120, email: 254, phone: 30, desk: 60, passwordMin: 12, passwordMax: 128, company: 120 } as const;

export const Name = z.string().trim().min(1).max(LIMITS.name);
export const Email = z.string().trim().min(1).max(LIMITS.email).pipe(z.email());
/** Same full-cell pattern as the CSV phone column, so one entry and a CSV row follow one rule (AC-63). */
// The lookahead caps the whole value, plus sign included, at 30 characters.
export const PHONE_PATTERN = /^(?=.{1,30}$)\+?[0-9 ]{6,}$/;
export const Phone = z.string().trim().regex(PHONE_PATTERN);
export const Desk = z.string().trim().min(1).max(LIMITS.desk);
export const Company = z.string().trim().min(1).max(LIMITS.company);

/** Optimistic concurrency counter. Every update, change, cancel and remove input carries it. */
export const Version = intField(1, 2_147_483_647);

/** A moment, ISO 8601 with a zone or offset. Booking times travel as instants so a repeated hour is never ambiguous (ADR-0009). */
export const Instant = z.iso.datetime({ offset: true });
export type Instant = z.infer<typeof Instant>;

/** A calendar day, YYYY-MM-DD. */
export const IsoDate = z.iso.date();
export type IsoDate = z.infer<typeof IsoDate>;

/** A wall clock time, HH:mm, 24-hour. */
export const HourMinute = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export type HourMinute = z.infer<typeof HourMinute>;

/** True when the string is an IANA zone name such as Asia/Kolkata. */
export function isIanaZone(value: string): boolean {
  if (value !== 'UTC' && !value.includes('/')) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const TimeZone = z.string().max(64).refine(isIanaZone, { message: 'Pick a valid time zone.' });
