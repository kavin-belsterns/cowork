import { describe, expect, it } from 'vitest';
import { Cursor, HourMinute, IdempotencyKey, Id, Instant, IsoDate, PROBLEM_TYPES, PageQuery, TimeZone, Version, isIanaZone } from '@/contracts/common';
import { ID, checkSchema } from './harness';

describe('common: Id', () => {
  it('accepts a uuid v7 and rejects other text', () => {
    expect(Id.safeParse(ID).success).toBe(true);
    for (const bad of ['', 'abc', '1234', ID.slice(1), `${ID}0`, null, 7]) expect(Id.safeParse(bad).success).toBe(false);
  });
});

describe('common: PageQuery', () => {
  it('defaults the limit to 100 and accepts 1 to 100 as text or number', () => {
    expect(PageQuery.parse({}).limit).toBe(100);
    expect(PageQuery.parse({ limit: '1' }).limit).toBe(1);
    expect(PageQuery.parse({ limit: 100 }).limit).toBe(100);
  });

  it('rejects limit 101, 0, empty and text', () => {
    for (const limit of ['101', 101, '0', 0, '', 'abc', '1.5', -1]) expect(PageQuery.safeParse({ limit }).success).toBe(false);
  });

  it('treats an empty cursor as no cursor and rejects odd characters', () => {
    expect(PageQuery.parse({ cursor: '' }).cursor).toBeUndefined();
    expect(PageQuery.safeParse({ cursor: 'a b' }).success).toBe(false);
    expect(PageQuery.safeParse({ cursor: 'x'.repeat(201) }).success).toBe(false);
    expect(Cursor.safeParse('abc_DEF-123').success).toBe(true);
  });

  checkSchema({ name: 'PageQuery shape', schema: PageQuery, valid: { limit: '50', cursor: 'abc' }, required: [], bad: { limit: ['101'], cursor: ['a b'] } });
});

describe('common: IdempotencyKey', () => {
  it('accepts a uuid and rejects short, long and odd keys', () => {
    expect(IdempotencyKey.safeParse('5f0c4b1e-9a3d-4c55-8c1e-0d9f8a7b6c5d').success).toBe(true);
    for (const bad of ['', 'short', 'a'.repeat(256), 'has space 123456']) expect(IdempotencyKey.safeParse(bad).success).toBe(false);
  });
});

describe('common: ProblemType', () => {
  it('lists the 11 types of design.md', () => {
    expect([...PROBLEM_TYPES].sort()).toEqual(
      ['booking-conflict', 'forbidden', 'internal', 'locked', 'not-found', 'request-changed', 'request-in-progress', 'rule-violation', 'unauthenticated', 'validation', 'version-conflict'].sort(),
    );
  });
});

describe('common: value types', () => {
  it('Version needs a whole number of 1 or more', () => {
    expect(Version.parse('3')).toBe(3);
    for (const bad of ['', '0', 'x', 1.5, -2, null]) expect(Version.safeParse(bad).success).toBe(false);
  });

  it('Instant needs a zone or offset', () => {
    expect(Instant.safeParse('2026-11-16T09:00:00Z').success).toBe(true);
    expect(Instant.safeParse('2026-11-16T09:00:00+05:30').success).toBe(true);
    for (const bad of ['2026-11-16T09:00:00', '2026-11-16', 'now', '']) expect(Instant.safeParse(bad).success).toBe(false);
  });

  it('IsoDate needs a real calendar day', () => {
    expect(IsoDate.safeParse('2026-11-16').success).toBe(true);
    for (const bad of ['2026-13-01', '2026-02-30', '16/11/2026', '']) expect(IsoDate.safeParse(bad).success).toBe(false);
  });

  it('HourMinute needs 24-hour HH:mm', () => {
    for (const ok of ['00:00', '08:15', '23:59']) expect(HourMinute.safeParse(ok).success).toBe(true);
    for (const bad of ['24:00', '8:00', '08:60', '0800', '']) expect(HourMinute.safeParse(bad).success).toBe(false);
  });

  it('TimeZone needs an IANA name', () => {
    expect(isIanaZone('Asia/Kolkata')).toBe(true);
    expect(TimeZone.safeParse('Europe/London').success).toBe(true);
    expect(TimeZone.safeParse('UTC').success).toBe(true);
    for (const bad of ['IST', 'Mars/Base', '', 'EST']) expect(TimeZone.safeParse(bad).success).toBe(false);
  });
});
