import { describe, expect, it } from 'vitest';
import { BookingCancelInput, BookingUpdateInput } from '@/contracts/booking';
import { OfficeHoursInput, OfficeUpdateInput } from '@/contracts/office';
import { RoomRemoveInput, RoomUpdateInput } from '@/contracts/room';
import { SeriesCancelInput } from '@/contracts/series';
import { DeactivateInput, PasswordResetInput, UserUpdateInput } from '@/contracts/user';
import { CheckInInput, CheckOutInput, VisitCancelInput } from '@/contracts/visit';
import { ChangePasswordInput } from '@/contracts/auth';
import { ID, ID2, LATER, NOW } from './harness';

// Spec S-00 section 3: every update, change, cancel and remove input carries `version`.
const samples: [string, { safeParse: (v: unknown) => { success: boolean } }, Record<string, unknown>][] = [
  ['OfficeUpdateInput', OfficeUpdateInput, { officeId: ID, name: 'Chennai', timeZone: 'Asia/Kolkata' }],
  ['OfficeHoursInput', OfficeHoursInput, { officeId: ID, days: [] }],
  ['RoomUpdateInput', RoomUpdateInput, { roomId: ID, officeId: ID, name: 'Aspen', floor: 1, size: 4 }],
  ['RoomRemoveInput', RoomRemoveInput, { roomId: ID, officeId: ID }],
  ['UserUpdateInput', UserUpdateInput, { userId: ID, name: 'Ana', email: 'ana@example.com', role: 'employee', officeId: ID }],
  ['PasswordResetInput', PasswordResetInput, { userId: ID }],
  ['DeactivateInput', DeactivateInput, { userId: ID }],
  ['ChangePasswordInput', ChangePasswordInput, { currentPassword: 'old', newPassword: 'a-long-new-password' }],
  ['BookingUpdateInput', BookingUpdateInput, { bookingId: ID, startsAt: NOW, endsAt: LATER, attendees: 2 }],
  ['BookingCancelInput', BookingCancelInput, { bookingId: ID }],
  ['SeriesCancelInput', SeriesCancelInput, { seriesId: ID, bookingId: ID2, scope: 'one' }],
  ['VisitCancelInput', VisitCancelInput, { visitId: ID }],
  ['CheckInInput', CheckInInput, { visitId: ID }],
  ['CheckOutInput', CheckOutInput, { visitId: ID }],
];

describe('every update, cancel and remove input carries version', () => {
  for (const [name, schema, withoutVersion] of samples) {
    it(`${name} rejects a missing version and accepts version 1`, () => {
      expect(schema.safeParse(withoutVersion).success).toBe(false);
      expect(schema.safeParse({ ...withoutVersion, version: 1 }).success).toBe(true);
    });
  }
});
