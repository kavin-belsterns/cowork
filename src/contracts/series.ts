// Purpose: recurring booking contracts. Written by S-00 only.
// Rules: design.md Data design (BookingSeries) and ADR-0010. Daily or weekly, up to 90 booking rows. The 90 day limit is a rule, not a shape.
import { z } from 'zod';
import { Id, Instant, IsoDate, Version } from '@/contracts/common';
import { Attendees, Booking } from '@/contracts/booking';

export const SERIES_PATTERNS = ['daily', 'weekly'] as const;
export const SeriesPattern = z.enum(SERIES_PATTERNS);
export type SeriesPattern = z.infer<typeof SeriesPattern>;

/** The first occurrence plus a pattern and an end date. The rules expand the dates in the office zone. */
export const SeriesCreateInput = z.strictObject({
  roomId: Id,
  startsAt: Instant,
  endsAt: Instant,
  attendees: Attendees,
  pattern: SeriesPattern,
  untilDate: IsoDate,
});
export type SeriesCreateInput = z.infer<typeof SeriesCreateInput>;

export const SERIES_CANCEL_SCOPES = ['one', 'future'] as const;
export const SeriesCancelScope = z.enum(SERIES_CANCEL_SCOPES);
export type SeriesCancelScope = z.infer<typeof SeriesCancelScope>;

/** `bookingId` is the date the user clicked. `one` cancels it. `future` cancels it and every later date. */
export const SeriesCancelInput = z.strictObject({
  seriesId: Id,
  bookingId: Id,
  version: Version,
  scope: SeriesCancelScope,
});
export type SeriesCancelInput = z.infer<typeof SeriesCancelInput>;

/** `seriesId` is null when no date was free. Zero booked is a result, not an error (design.md). */
export const SeriesResult = z.strictObject({
  seriesId: Id.nullable(),
  booked: z.array(Booking).max(90),
  clashes: z.array(IsoDate).max(90),
  closedDays: z.array(IsoDate).max(90),
});
export type SeriesResult = z.infer<typeof SeriesResult>;
