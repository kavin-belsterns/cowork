import { describe, expect, it } from 'vitest';
import { ImportResult, ImportRowError, ImportUploadInput, RoomCsvRow, UserCsvRow } from '@/contracts/import';
import { ID, checkSchema } from './harness';

const file = (bytes: number) => new File([new Uint8Array(bytes).fill(97)], 'rooms.csv', { type: 'text/csv' });

describe('ImportUploadInput', () => {
  it('accepts a CSV of 1 byte up to 2 MB', () => {
    expect(ImportUploadInput.safeParse({ officeId: ID, kind: 'rooms', file: file(1) }).success).toBe(true);
    expect(ImportUploadInput.safeParse({ officeId: ID, kind: 'users', file: file(2 * 1024 * 1024) }).success).toBe(true);
  });

  it('rejects an empty file, a file over 2 MB, a bad kind, a bad office and an unknown key', () => {
    expect(ImportUploadInput.safeParse({ officeId: ID, kind: 'rooms', file: file(0) }).success).toBe(false);
    expect(ImportUploadInput.safeParse({ officeId: ID, kind: 'rooms', file: file(2 * 1024 * 1024 + 1) }).success).toBe(false);
    expect(ImportUploadInput.safeParse({ officeId: ID, kind: 'offices', file: file(1) }).success).toBe(false);
    expect(ImportUploadInput.safeParse({ officeId: 'x', kind: 'rooms', file: file(1) }).success).toBe(false);
    expect(ImportUploadInput.safeParse({ officeId: ID, kind: 'rooms', file: 'text' }).success).toBe(false);
    expect(ImportUploadInput.safeParse({ officeId: ID, kind: 'rooms', file: file(1), extra: 1 }).success).toBe(false);
  });

  it('rejects each missing field', () => {
    for (const field of ['officeId', 'kind', 'file']) {
      const full: Record<string, unknown> = { officeId: ID, kind: 'rooms', file: file(1) };
      delete full[field];
      expect(ImportUploadInput.safeParse(full).success).toBe(false);
    }
  });
});

const room = { name: 'Aspen', floor: '2', size: '8' };

checkSchema({
  name: 'RoomCsvRow',
  schema: RoomCsvRow,
  valid: room,
  required: ['name', 'floor', 'size'],
  bad: {
    name: ['', '   ', '=SUM(A1)', '-1+1', '@cmd', '\tx', '\rx', 'n'.repeat(121)],
    floor: ['', 'two', '1000', '-1000', '+2', '=1', ' 2', '2 '],
    size: ['', '0', '-1', '10000', 'big', '1.5'],
  },
});

describe('RoomCsvRow details', () => {
  it('turns floor and size into numbers and accepts a negative floor', () => {
    expect(RoomCsvRow.parse(room)).toEqual({ name: 'Aspen', floor: 2, size: 8 });
    expect(RoomCsvRow.parse({ ...room, floor: '-1' }).floor).toBe(-1);
  });

  it('trims the name after the formula check', () => {
    expect(RoomCsvRow.parse({ ...room, name: '  Aspen  ' }).name).toBe('Aspen');
  });
});

const user = { name: 'Ana', email: 'ana@example.com', role: 'employee', phone: '+91 44 1234 5678', desk: 'B-12' };

checkSchema({
  name: 'UserCsvRow',
  schema: UserCsvRow,
  valid: user,
  required: ['name', 'email', 'role'],
  bad: {
    name: ['', '=1+1', '@x'],
    email: ['', 'nope', '=a@example.com', '-a@example.com'],
    role: ['admin', 'system', ''],
    phone: ['12345', '=123456', '-123456', '+', 'abc defg', '1'.repeat(31), '+' + '1'.repeat(30), '++123456'],
    desk: ['=A1', '-x', '@x', 'd'.repeat(61)],
  },
});

describe('UserCsvRow details', () => {
  it('lets phone and desk be missing or blank, and passes platform_admin on to the row rules', () => {
    expect(UserCsvRow.safeParse({ name: 'Ana', email: 'ana@example.com', role: 'employee' }).success).toBe(true);
    expect(UserCsvRow.parse({ ...user, desk: '' }).desk).toBeUndefined();
    expect(UserCsvRow.parse({ ...user, phone: '' }).phone).toBeUndefined();
    expect(UserCsvRow.safeParse({ ...user, role: 'platform_admin' }).success).toBe(true);
  });

  it('allows a full-cell phone with a leading plus', () => {
    expect(UserCsvRow.safeParse({ ...user, phone: '+919876543210' }).success).toBe(true);
  });
});

checkSchema({
  name: 'ImportRowError',
  schema: ImportRowError,
  valid: { row: 3, column: 'floor', code: 'floor_format', reason: 'Floor must be a whole number.' },
  required: ['row', 'column', 'code', 'reason'],
  bad: { row: [0, 5002, 'x'], column: [1], code: [''], reason: [''] },
});

checkSchema({
  name: 'ImportResult',
  schema: ImportResult,
  valid: { kind: 'rooms', officeId: ID, added: 12 },
  required: ['kind', 'officeId', 'added'],
  bad: { kind: ['offices'], officeId: ['x'], added: [-1, 5001, 1.5] },
});
