// Purpose: room contracts. Written by S-00 only.
// Rules: design.md Data design (Room). AC-86: name and floor are required and size is at least 1. Floor is a whole number, -999 to 999.
import { z } from 'zod';
import { Id, Name, Version, boolField, intField } from '@/contracts/common';

export const ROOM_SIZE_MAX = 1000;
const Floor = intField(-999, 999);
const Size = intField(1, ROOM_SIZE_MAX);

export const RoomInput = z.strictObject({
  officeId: Id,
  name: Name,
  floor: Floor,
  size: Size,
});
export type RoomInput = z.infer<typeof RoomInput>;

export const RoomUpdateInput = z.strictObject({
  roomId: Id,
  officeId: Id,
  version: Version,
  name: Name,
  floor: Floor,
  size: Size,
  /** AC-81: true after the admin sees the list of future bookings that no longer fit and confirms. */
  confirmSizeCut: boolField.default(false),
});
export type RoomUpdateInput = z.infer<typeof RoomUpdateInput>;

export const RoomRemoveInput = z.strictObject({
  roomId: Id,
  officeId: Id,
  version: Version,
});
export type RoomRemoveInput = z.infer<typeof RoomRemoveInput>;

export const Room = z.strictObject({
  id: Id,
  officeId: Id,
  name: Name,
  floor: Floor,
  size: Size,
  version: Version,
});
export type Room = z.infer<typeof Room>;
