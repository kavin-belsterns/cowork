import { describe, expect, it } from 'vitest';
import { Booking, BookingCancelInput, BookingCreateInput, BookingNewQuery, BookingUpdateInput, RoomDay, RoomsQuery } from '@/contracts/booking';
import { ID, ID2, LATER, NOW, checkSchema } from './harness';

checkSchema({
  name: 'RoomsQuery',
  schema: RoomsQuery,
  valid: { office: ID, date: '2026-11-16', minSize: '6' },
  required: ['office', 'date'],
  bad: { office: ['x', ''], date: ['', '2026-13-01', '16-11-2026'], minSize: ['0', 'x', '1001'] },
});

describe('RoomsQuery details', () => {
  it('lets minSize stay blank', () => {
    expect(RoomsQuery.parse({ office: ID, date: '2026-11-16', minSize: '' }).minSize).toBeUndefined();
    expect(RoomsQuery.parse({ office: ID, date: '2026-11-16' }).minSize).toBeUndefined();
  });
});

const room = { id: ID, officeId: ID, name: 'Aspen', floor: 2, size: 8, version: 1 };

checkSchema({
  name: 'RoomDay',
  schema: RoomDay,
  valid: { room, open: true, slots: [{ startsAt: NOW, endsAt: LATER, state: 'free' }] },
  required: ['room', 'open', 'slots'],
  bad: {
    room: [{ ...room, size: 0 }],
    open: ['yes'],
    slots: [[{ startsAt: NOW, endsAt: LATER, state: 'taken' }], [{ startsAt: 'x', endsAt: LATER, state: 'free' }], Array.from({ length: 97 }, () => ({ startsAt: NOW, endsAt: LATER, state: 'free' }))],
  },
});

checkSchema({
  name: 'BookingNewQuery',
  schema: BookingNewQuery,
  valid: { roomId: ID, startsAt: NOW },
  required: ['roomId', 'startsAt'],
  bad: { roomId: ['x'], startsAt: ['x', '2026-11-16'] },
});

checkSchema({
  name: 'BookingCreateInput',
  schema: BookingCreateInput,
  valid: { roomId: ID, startsAt: NOW, endsAt: LATER, attendees: '4' },
  required: ['roomId', 'startsAt', 'endsAt', 'attendees'],
  bad: { roomId: ['x'], startsAt: ['x'], endsAt: ['2026-11-16T10:00:00'], attendees: ['', '0', '-1', 'x', '1001'] },
});

checkSchema({
  name: 'BookingUpdateInput',
  schema: BookingUpdateInput,
  valid: { bookingId: ID, version: 2, startsAt: NOW, endsAt: LATER, attendees: 4 },
  required: ['bookingId', 'version', 'startsAt', 'endsAt', 'attendees'],
  bad: { bookingId: ['x'], version: [0, ''], startsAt: ['x'], endsAt: ['x'], attendees: [0] },
});

checkSchema({
  name: 'BookingCancelInput',
  schema: BookingCancelInput,
  valid: { bookingId: ID, version: 2 },
  required: ['bookingId', 'version'],
  bad: { bookingId: ['x'], version: [0, ''] },
});

checkSchema({
  name: 'Booking',
  schema: Booking,
  valid: { id: ID, roomId: ID2, roomName: 'Aspen', officeId: ID, ownerId: ID, ownerName: 'Ana', seriesId: null, startsAt: NOW, endsAt: LATER, attendees: 4, status: 'confirmed', version: 1 },
  required: ['id', 'roomId', 'roomName', 'officeId', 'ownerId', 'ownerName', 'seriesId', 'startsAt', 'endsAt', 'attendees', 'status', 'version'],
  bad: { id: ['x'], roomName: [''], seriesId: ['x'], startsAt: ['x'], status: ['pending'], attendees: [0], version: [0] },
});
