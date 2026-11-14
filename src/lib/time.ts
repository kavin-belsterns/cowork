// Purpose: the one zoned-time helper every booking rule uses (ADR-0009). Pure: no Prisma, no next/*, no clock reads.
// Rules: store UTC instants. Convert with the office IANA zone only at the edge. Pass fixed instants in tests.
// Packages: date-fns v4 and @date-fns/tz. Source: https://github.com/date-fns/tz
import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/** Wall clock parts in a zone. `date` is YYYY-MM-DD and `time` is HH:mm, 24-hour. */
export type LocalParts = { date: string; time: string };

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function parseDate(date: string): { y: number; m: number; d: number } {
  const [y, m, d] = date.split('-').map(Number);
  return { y: y as number, m: m as number, d: d as number };
}

function parseTime(time: string): { h: number; min: number } {
  const [h, min] = time.split(':').map(Number);
  return { h: h as number, min: min as number };
}

/** Wall clock as if it were UTC, in ms. Used only as a base for offset maths. */
function wallAsUtcMs(date: string, time: string): number {
  const { y, m, d } = parseDate(date);
  const { h, min } = parseTime(time);
  return Date.UTC(y, m - 1, d, h, min);
}

/** Minutes to add to local wall time to reach UTC at this instant. Positive west of UTC. */
function offsetMinutesAt(ms: number, zone: string): number {
  return new TZDate(ms, zone).getTimezoneOffset();
}

/** Minutes since local midnight for an instant. */
function minuteOfDay(instant: Date, zone: string): number {
  const local = new TZDate(instant.getTime(), zone);
  return local.getHours() * 60 + local.getMinutes();
}

/**
 * Convert a UTC instant to the wall date and time in an IANA zone.
 * @example toLocalParts(new Date('2026-11-16T09:00:00Z'), 'Asia/Kolkata') gives { date: '2026-11-16', time: '14:30' }
 */
export function toLocalParts(instant: Date, zone: string): LocalParts {
  const local = new TZDate(instant.getTime(), zone);
  return { date: format(local, 'yyyy-MM-dd'), time: format(local, 'HH:mm') };
}

/**
 * Every UTC instant that shows this wall time in the zone.
 * Returns none for a DST gap (the time does not exist), one for a normal time and two for a repeated hour.
 * The list is sorted, earliest first.
 */
export function localToInstants(date: string, time: string, zone: string): Date[] {
  const wall = wallAsUtcMs(date, time);
  const offsets = new Set([offsetMinutesAt(wall - DAY_MS, zone), offsetMinutesAt(wall, zone), offsetMinutesAt(wall + DAY_MS, zone)]);
  const hits: number[] = [];
  for (const offset of offsets) {
    const ms = wall + offset * MINUTE_MS;
    const back = toLocalParts(new Date(ms), zone);
    if (back.date === date && back.time === time) hits.push(ms);
  }
  return [...new Set(hits)].sort((a, b) => a - b).map((ms) => new Date(ms));
}

/**
 * Convert a wall date and time to one UTC instant.
 * A repeated hour gives the first (earlier) instant. A DST gap gives null, so the caller must reject or hide the slot.
 */
export function localToInstant(date: string, time: string, zone: string): Date | null {
  return localToInstants(date, time, zone)[0] ?? null;
}

/** True when the wall time does not exist in the zone because clocks jumped forward. */
export function isDstGap(date: string, time: string, zone: string): boolean {
  return localToInstants(date, time, zone).length === 0;
}

/** True when the wall time happens twice in the zone because clocks moved back. */
export function isRepeatedHour(date: string, time: string, zone: string): boolean {
  return localToInstants(date, time, zone).length === 2;
}

/** The calendar day after a YYYY-MM-DD date. */
export function nextDate(date: string): string {
  const { y, m, d } = parseDate(date);
  const next = new Date(Date.UTC(y, m - 1, d) + DAY_MS);
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

/** First instant of a local day. If midnight does not exist, it is the first instant after the gap. */
function startOfLocalDay(date: string, zone: string): Date {
  const exact = localToInstant(date, '00:00', zone);
  if (exact) return exact;
  // Midnight sits inside a DST gap. The gap ends at the clock change, which is midnight plus the pre-gap offset.
  const wall = wallAsUtcMs(date, '00:00');
  return new Date(wall + offsetMinutesAt(wall - DAY_MS, zone) * MINUTE_MS);
}

/**
 * Start and end of a local day as UTC instants. The end is the start of the next day, so test `start <= t < end`.
 * The span is 23, 24 or 25 hours on a DST change day.
 */
export function localDayBounds(date: string, zone: string): { start: Date; end: Date } {
  return { start: startOfLocalDay(date, zone), end: startOfLocalDay(nextDate(date), zone) };
}

/** True when the instant sits on a 15-minute mark of local wall time, with zero seconds. */
export function isQuarterHourStep(instant: Date, zone: string): boolean {
  if (instant.getTime() % MINUTE_MS !== 0) return false;
  return minuteOfDay(instant, zone) % 15 === 0;
}

/**
 * True when the whole booking sits inside opening hours on one local day.
 * `opensAt` and `closesAt` are HH:mm in the zone. The end may equal the closing time.
 */
export function isWithinOpeningHours(startsAt: Date, endsAt: Date, zone: string, opensAt: string, closesAt: string): boolean {
  if (endsAt.getTime() <= startsAt.getTime()) return false;
  const start = toLocalParts(startsAt, zone);
  const end = toLocalParts(endsAt, zone);
  if (start.date !== end.date) return false;
  const open = parseTime(opensAt);
  const close = parseTime(closesAt);
  return minuteOfDay(startsAt, zone) >= open.h * 60 + open.min && minuteOfDay(endsAt, zone) <= close.h * 60 + close.min;
}

/** Format an instant as "Mon 16 Nov 2026" in the zone. */
export function formatDate(instant: Date, zone: string): string {
  return format(new TZDate(instant.getTime(), zone), 'EEE d MMM yyyy');
}

/** Format an instant as 24-hour "14:30" in the zone. */
export function formatTime(instant: Date, zone: string): string {
  return format(new TZDate(instant.getTime(), zone), 'HH:mm');
}

function zoneName(instant: Date, zone: string, locale: string): string {
  const parts = new Intl.DateTimeFormat(locale, { timeZone: zone, timeZoneName: 'short' }).formatToParts(instant);
  return parts.find((p) => p.type === 'timeZoneName')?.value ?? zone;
}

/**
 * Short zone label for the instant, such as "EST", "BST" or "CEST". It follows DST.
 * Zones with no common abbreviation give an offset form such as "GMT+5:30".
 */
export function zoneLabel(instant: Date, zone: string): string {
  const us = zoneName(instant, zone, 'en-US');
  if (!/^(GMT|UTC)[+-]/.test(us)) return us;
  const gb = zoneName(instant, zone, 'en-GB');
  return /^(GMT|UTC)[+-]/.test(gb) ? us : gb;
}
