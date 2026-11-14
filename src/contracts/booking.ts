// Purpose: room availability and booking contracts. Written by S-00 only.
// Rules: design.md Data design (Booking). Times travel as instants (ISO 8601). The office zone turns them into wall time (ADR-0009).
// Attendees: 1 to 1,000. The room size check and the 15 minute steps live in src/domain/booking/rules.ts.
import { z } from 'zod';
import { Id, Instant, IsoDate, LIMITS, Version, intField } from '@/contracts/common';
import { Room } from '@/contracts/room';

export const Attendees = intField(1, 1000);

/** Query of the /rooms page. `office` and `date` are required. `minSize` filters rooms that are too small (AC-80). */
export const RoomsQuery = z.strictObject({
  office: Id,
  date: IsoDate,
  minSize: z.preprocess((v) => (v === '' ? undefined : v), Attendees.optional()),
});
export type RoomsQuery = z.infer<typeof RoomsQuery>;

export const BOOKING_STATUSES = ['confirmed', 'cancelled'] as const;
export const BookingStatus = z.enum(BOOKING_STATUSES);
export type BookingStatus = z.infer<typeof BookingStatus>;

export const SLOT_STATES = ['free', 'booked'] as const;

/** One 15 minute cell of the room grid. Booked is shown as text, never colour alone. */
export const RoomSlot = z.strictObject({
  startsAt: Instant,
  endsAt: Instant,
  state: z.enum(SLOT_STATES),
});
export type RoomSlot = z.infer<typeof RoomSlot>;

export const RoomDay = z.strictObject({
  room: Room,
  /** False when the office is closed on this day. The grid is then empty. */
  open: z.boolean(),
  slots: z.array(RoomSlot).max(96),
});
export type RoomDay = z.infer<typeof RoomDay>;

/** Query of /bookings/new. The room and the start come from a slot link on /rooms. */
export const BookingNewQuery = z.strictObject({
  roomId: Id,
  startsAt: Instant,
});
export type BookingNewQuery = z.infer<typeof BookingNewQuery>;

export const BookingCreateInput = z.strictObject({
  roomId: Id,
  startsAt: Instant,
  endsAt: Instant,
  attendees: Attendees,
});
export type BookingCreateInput = z.infer<typeof BookingCreateInput>;

/** Moves the day, time or attendee count. The room stays. */
export const BookingUpdateInput = z.strictObject({
  bookingId: Id,
  version: Version,
  startsAt: Instant,
  endsAt: Instant,
  attendees: Attendees,
});
export type BookingUpdateInput = z.infer<typeof BookingUpdateInput>;

export const BookingCancelInput = z.strictObject({
  bookingId: Id,
  version: Version,
});
export type BookingCancelInput = z.infer<typeof BookingCancelInput>;

export const Booking = z.strictObject({
  id: Id,
  roomId: Id,
  roomName: z.string().min(1).max(LIMITS.name),
  officeId: Id,
  ownerId: Id,
  ownerName: z.string().min(1).max(LIMITS.name),
  seriesId: Id.nullable(),
  startsAt: Instant,
  endsAt: Instant,
  attendees: Attendees,
  status: BookingStatus,
  version: Version,
});
export type Booking = z.infer<typeof Booking>;
