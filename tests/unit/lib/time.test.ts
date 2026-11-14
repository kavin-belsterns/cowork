// Purpose: Unit tests for zoned-time helpers (src/lib/time.ts, ADR-0009).
// Rules: standards/testing.md. Pure tests, fixed instants, DST gap and repeated hours.
import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatTime,
  isDstGap,
  isQuarterHourStep,
  isRepeatedHour,
  isWithinOpeningHours,
  localDayBounds,
  localToInstant,
  localToInstants,
  nextDate,
  toLocalParts,
  zoneLabel,
} from '@/lib/time';

describe('src/lib/time: zoned-time helpers', () => {
  const KOLKATA = 'Asia/Kolkata';
  const LONDON = 'Europe/London';

  describe('toLocalParts', () => {
    it('converts UTC instant to local wall date and time', () => {
      const instant = new Date('2026-11-16T09:00:00Z');
      expect(toLocalParts(instant, KOLKATA)).toEqual({ date: '2026-11-16', time: '14:30' });
      expect(toLocalParts(instant, LONDON)).toEqual({ date: '2026-11-16', time: '09:00' });
    });

    it('accounts for British Summer Time (BST) offset in summer', () => {
      const instant = new Date('2026-07-16T09:00:00Z');
      expect(toLocalParts(instant, LONDON)).toEqual({ date: '2026-07-16', time: '10:00' });
    });
  });

  describe('localToInstant and localToInstants', () => {
    it('converts normal unambiguous wall time to a single UTC instant', () => {
      const instant = localToInstant('2026-11-16', '14:30', KOLKATA);
      expect(instant).not.toBeNull();
      expect(instant?.toISOString()).toBe('2026-11-16T09:00:00.000Z');
    });

    it('returns empty array and null for a DST spring-forward gap', () => {
      // In Europe/London, clocks jump forward from 01:00 GMT to 02:00 BST on 2026-03-29.
      expect(isDstGap('2026-03-29', '01:30', LONDON)).toBe(true);
      expect(localToInstants('2026-03-29', '01:30', LONDON)).toEqual([]);
      expect(localToInstant('2026-03-29', '01:30', LONDON)).toBeNull();
    });

    it('returns two instants and earlier instant for repeated hour during autumn fall-back', () => {
      // In Europe/London, clocks fall back from 02:00 BST to 01:00 GMT on 2026-10-25.
      expect(isRepeatedHour('2026-10-25', '01:30', LONDON)).toBe(true);
      const instants = localToInstants('2026-10-25', '01:30', LONDON);
      expect(instants).toHaveLength(2);
      expect(instants[0]?.toISOString()).toBe('2026-10-25T00:30:00.000Z'); // 01:30 BST
      expect(instants[1]?.toISOString()).toBe('2026-10-25T01:30:00.000Z'); // 01:30 GMT

      // localToInstant returns the earlier instant
      expect(localToInstant('2026-10-25', '01:30', LONDON)?.toISOString()).toBe('2026-10-25T00:30:00.000Z');
    });

    it('reports no DST gap or repeated hour in zones without DST', () => {
      expect(isDstGap('2026-03-29', '01:30', KOLKATA)).toBe(false);
      expect(isRepeatedHour('2026-10-25', '01:30', KOLKATA)).toBe(false);
    });
  });

  describe('nextDate', () => {
    it('returns next calendar day', () => {
      expect(nextDate('2026-11-16')).toBe('2026-11-17');
      expect(nextDate('2026-11-30')).toBe('2026-12-01');
      expect(nextDate('2026-12-31')).toBe('2027-01-01');
      expect(nextDate('2024-02-28')).toBe('2024-02-29'); // Leap year
      expect(nextDate('2026-02-28')).toBe('2026-03-01'); // Non-leap year
    });
  });

  describe('localDayBounds', () => {
    it('returns start and end spanning exactly 24 hours on regular days', () => {
      const bounds = localDayBounds('2026-11-16', KOLKATA);
      const spanMs = bounds.end.getTime() - bounds.start.getTime();
      expect(spanMs).toBe(24 * 60 * 60 * 1000);
      expect(toLocalParts(bounds.start, KOLKATA)).toEqual({ date: '2026-11-16', time: '00:00' });
      expect(toLocalParts(bounds.end, KOLKATA)).toEqual({ date: '2026-11-17', time: '00:00' });
    });

    it('returns 23-hour span on spring-forward DST change day', () => {
      const bounds = localDayBounds('2026-03-29', LONDON);
      const spanMs = bounds.end.getTime() - bounds.start.getTime();
      expect(spanMs).toBe(23 * 60 * 60 * 1000);
    });

    it('returns 25-hour span on fall-back DST change day', () => {
      const bounds = localDayBounds('2026-10-25', LONDON);
      const spanMs = bounds.end.getTime() - bounds.start.getTime();
      expect(spanMs).toBe(25 * 60 * 60 * 1000);
    });
  });

  describe('isQuarterHourStep', () => {
    it('accepts 0, 15, 30, and 45 minute marks with zero seconds', () => {
      expect(isQuarterHourStep(new Date('2026-11-16T09:00:00.000Z'), LONDON)).toBe(true);
      expect(isQuarterHourStep(new Date('2026-11-16T09:15:00.000Z'), LONDON)).toBe(true);
      expect(isQuarterHourStep(new Date('2026-11-16T09:30:00.000Z'), LONDON)).toBe(true);
      expect(isQuarterHourStep(new Date('2026-11-16T09:45:00.000Z'), LONDON)).toBe(true);
    });

    it('rejects odd minutes and non-zero seconds or milliseconds', () => {
      expect(isQuarterHourStep(new Date('2026-11-16T09:07:00.000Z'), LONDON)).toBe(false);
      expect(isQuarterHourStep(new Date('2026-11-16T09:14:00.000Z'), LONDON)).toBe(false);
      expect(isQuarterHourStep(new Date('2026-11-16T09:15:10.000Z'), LONDON)).toBe(false);
      expect(isQuarterHourStep(new Date('2026-11-16T09:15:00.500Z'), LONDON)).toBe(false);
    });
  });

  describe('isWithinOpeningHours', () => {
    const opens = '08:00';
    const closes = '20:00';

    it('accepts time spans strictly inside opening hours on the same local day', () => {
      const start = new Date('2026-11-16T09:00:00Z');
      const end = new Date('2026-11-16T17:00:00Z');
      expect(isWithinOpeningHours(start, end, LONDON, opens, closes)).toBe(true);
    });

    it('accepts spans matching exact opening and closing boundaries', () => {
      const start = new Date('2026-11-16T08:00:00Z');
      const end = new Date('2026-11-16T20:00:00Z');
      expect(isWithinOpeningHours(start, end, LONDON, opens, closes)).toBe(true);
    });

    it('rejects spans starting before opening time or ending after closing time', () => {
      const early = new Date('2026-11-16T07:45:00Z');
      const mid = new Date('2026-11-16T10:00:00Z');
      const late = new Date('2026-11-16T20:15:00Z');

      expect(isWithinOpeningHours(early, mid, LONDON, opens, closes)).toBe(false);
      expect(isWithinOpeningHours(mid, late, LONDON, opens, closes)).toBe(false);
    });

    it('rejects invalid spans (end <= start or spanning across midnight)', () => {
      const t1 = new Date('2026-11-16T10:00:00Z');
      const t2 = new Date('2026-11-16T10:00:00Z');
      const t3 = new Date('2026-11-17T09:00:00Z');

      expect(isWithinOpeningHours(t1, t2, LONDON, opens, closes)).toBe(false);
      expect(isWithinOpeningHours(t1, t3, LONDON, opens, closes)).toBe(false);
    });
  });

  describe('formatting and labels', () => {
    it('formats date and time in the specified zone', () => {
      const instant = new Date('2026-11-16T09:00:00Z');
      expect(formatDate(instant, KOLKATA)).toBe('Mon 16 Nov 2026');
      expect(formatTime(instant, KOLKATA)).toBe('14:30');
      expect(formatDate(instant, LONDON)).toBe('Mon 16 Nov 2026');
      expect(formatTime(instant, LONDON)).toBe('09:00');
    });

    it('returns appropriate zone labels including DST adjustments', () => {
      expect(zoneLabel(new Date('2026-11-16T09:00:00Z'), LONDON)).toBe('GMT');
      expect(zoneLabel(new Date('2026-07-16T09:00:00Z'), LONDON)).toBe('BST');
      expect(zoneLabel(new Date('2026-11-16T09:00:00Z'), KOLKATA)).toBe('GMT+5:30');
    });
  });
});
