import { describe, expect, it } from 'vitest';
import { Room, RoomInput, RoomRemoveInput, RoomUpdateInput } from '@/contracts/room';
import { ID, checkSchema } from './harness';

checkSchema({
  name: 'RoomInput',
  schema: RoomInput,
  valid: { officeId: ID, name: 'Aspen', floor: '2', size: '8' },
  required: ['officeId', 'name', 'floor', 'size'],
  bad: {
    officeId: ['x'],
    name: ['', ' ', 'r'.repeat(121)],
    floor: ['', 'two', '1000', '-1000', '1.5'],
    size: ['', '0', '-1', 'big', '1001'],
  },
});

describe('RoomInput details (E-001/AC-86)', () => {
  it('accepts floor 0 and a negative floor, and turns text into numbers', () => {
    expect(RoomInput.parse({ officeId: ID, name: 'Aspen', floor: '0', size: '1' })).toMatchObject({ floor: 0, size: 1 });
    expect(RoomInput.parse({ officeId: ID, name: 'Aspen', floor: -2, size: 4 }).floor).toBe(-2);
  });
});

checkSchema({
  name: 'RoomUpdateInput',
  schema: RoomUpdateInput,
  valid: { roomId: ID, officeId: ID, version: 1, name: 'Aspen', floor: 2, size: 8, confirmSizeCut: true },
  required: ['roomId', 'officeId', 'version', 'name', 'floor', 'size'],
  bad: { roomId: ['x'], officeId: ['x'], version: [0, ''], name: [''], floor: [''], size: [0], confirmSizeCut: ['maybe', 3] },
});

describe('RoomUpdateInput details', () => {
  it('defaults confirmSizeCut to false and reads a checkbox value', () => {
    const base = { roomId: ID, officeId: ID, version: 1, name: 'Aspen', floor: 2, size: 8 };
    expect(RoomUpdateInput.parse(base).confirmSizeCut).toBe(false);
    expect(RoomUpdateInput.parse({ ...base, confirmSizeCut: 'on' }).confirmSizeCut).toBe(true);
  });
});

checkSchema({
  name: 'RoomRemoveInput',
  schema: RoomRemoveInput,
  valid: { roomId: ID, officeId: ID, version: 1 },
  required: ['roomId', 'officeId', 'version'],
  bad: { roomId: ['x'], officeId: ['x'], version: [0, ''] },
});

checkSchema({
  name: 'Room',
  schema: Room,
  valid: { id: ID, officeId: ID, name: 'Aspen', floor: 2, size: 8, version: 1 },
  required: ['id', 'officeId', 'name', 'floor', 'size', 'version'],
  bad: { id: ['x'], officeId: ['x'], name: [''], floor: ['x'], size: [0], version: [0] },
});
