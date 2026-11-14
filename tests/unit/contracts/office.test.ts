import { describe, expect, it } from 'vitest';
import { Office, OfficeCreateInput, OfficeHours, OfficeHoursInput, OfficeUpdateInput } from '@/contracts/office';
import { ID, checkSchema } from './harness';

checkSchema({
  name: 'OfficeCreateInput',
  schema: OfficeCreateInput,
  valid: { name: 'Chennai', timeZone: 'Asia/Kolkata' },
  required: ['name', 'timeZone'],
  bad: { name: ['', '   ', 'n'.repeat(121)], timeZone: ['', 'IST', 'Mars/Base'] },
});

checkSchema({
  name: 'OfficeUpdateInput',
  schema: OfficeUpdateInput,
  valid: { officeId: ID, version: 1, name: 'Chennai', timeZone: 'Asia/Kolkata' },
  required: ['officeId', 'version', 'name', 'timeZone'],
  bad: { officeId: ['x'], version: [0, ''], name: [''], timeZone: ['IST'] },
});

const days = [{ weekday: 1, opensAt: '08:00', closesAt: '20:00' }];

checkSchema({
  name: 'OfficeHoursInput',
  schema: OfficeHoursInput,
  valid: { officeId: ID, version: 1, days },
  required: ['officeId', 'version', 'days'],
  bad: {
    officeId: ['x'],
    version: [0],
    days: [
      [{ weekday: 0, opensAt: '08:00', closesAt: '20:00' }],
      [{ weekday: 8, opensAt: '08:00', closesAt: '20:00' }],
      [{ weekday: 1, opensAt: '8:00', closesAt: '20:00' }],
      [{ weekday: 1, opensAt: '20:00', closesAt: '08:00' }],
      [{ weekday: 1, opensAt: '08:00', closesAt: '08:00' }],
      [days[0], days[0]],
      Array.from({ length: 8 }, (_, i) => ({ weekday: (i % 7) + 1, opensAt: '08:00', closesAt: '20:00' })),
      [{ weekday: 1, opensAt: '08:00', closesAt: '20:00', extra: 1 }],
    ],
  },
});

describe('OfficeHoursInput details', () => {
  it('accepts an all-closed week (no days)', () => {
    expect(OfficeHoursInput.safeParse({ officeId: ID, version: 1, days: [] }).success).toBe(true);
  });

  it('says why closing time is refused', () => {
    const r = OfficeHoursInput.safeParse({ officeId: ID, version: 1, days: [{ weekday: 1, opensAt: '20:00', closesAt: '08:00' }] });
    expect(r.error?.issues[0]?.message).toBe('Closing time must be after opening time.');
  });
});

checkSchema({
  name: 'Office',
  schema: Office,
  valid: { id: ID, name: 'Chennai', timeZone: 'Asia/Kolkata', version: 1 },
  required: ['id', 'name', 'timeZone', 'version'],
  bad: { id: ['x'], name: [''], timeZone: ['IST'], version: [0] },
});

checkSchema({
  name: 'OfficeHours',
  schema: OfficeHours,
  valid: { officeId: ID, weekday: 5, opensAt: '08:00', closesAt: '20:00' },
  required: ['officeId', 'weekday', 'opensAt', 'closesAt'],
  bad: { officeId: ['x'], weekday: [0, 8, ''], opensAt: ['25:00'], closesAt: ['8am'] },
});
