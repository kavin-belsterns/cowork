import { describe, expect, it } from 'vitest';
import { SeriesCancelInput, SeriesCreateInput, SeriesResult } from '@/contracts/series';
import { ID, ID2, LATER, NOW, checkSchema } from './harness';

checkSchema({
  name: 'SeriesCreateInput',
  schema: SeriesCreateInput,
  valid: { roomId: ID, startsAt: NOW, endsAt: LATER, attendees: 4, pattern: 'weekly', untilDate: '2026-12-31' },
  required: ['roomId', 'startsAt', 'endsAt', 'attendees', 'pattern', 'untilDate'],
  bad: { roomId: ['x'], startsAt: ['x'], endsAt: ['x'], attendees: [0, ''], pattern: ['monthly', ''], untilDate: ['', '2026-02-30', 'soon'] },
});

checkSchema({
  name: 'SeriesCancelInput',
  schema: SeriesCancelInput,
  valid: { seriesId: ID, bookingId: ID2, version: 1, scope: 'future' },
  required: ['seriesId', 'bookingId', 'version', 'scope'],
  bad: { seriesId: ['x'], bookingId: ['x'], version: [0, ''], scope: ['all', ''] },
});

const booking = { id: ID, roomId: ID2, roomName: 'Aspen', officeId: ID, ownerId: ID, ownerName: 'Ana', seriesId: ID2, startsAt: NOW, endsAt: LATER, attendees: 4, status: 'confirmed', version: 1 };

checkSchema({
  name: 'SeriesResult',
  schema: SeriesResult,
  valid: { seriesId: ID, booked: [booking], clashes: ['2026-11-23'], closedDays: ['2026-11-22'] },
  required: ['seriesId', 'booked', 'clashes', 'closedDays'],
  bad: {
    seriesId: ['x'],
    booked: [[{ ...booking, status: 'pending' }], Array.from({ length: 91 }, () => booking)],
    clashes: [['23 Nov'], Array.from({ length: 91 }, () => '2026-11-23')],
    closedDays: [['x']],
  },
});

describe('SeriesResult details', () => {
  it('accepts zero booked with a null series id (a result, not an error)', () => {
    expect(SeriesResult.safeParse({ seriesId: null, booked: [], clashes: ['2026-11-23'], closedDays: [] }).success).toBe(true);
  });
});
