// Purpose: office and opening hours contracts. Written by S-00 only.
// Rules: design.md Data design (Office, OfficeHours). Weekday is ISO: 1 Monday to 7 Sunday. A day with no entry is closed.
import { z } from 'zod';
import { HourMinute, Id, Name, TimeZone, Version, intField } from '@/contracts/common';

export const OfficeCreateInput = z.strictObject({
  name: Name,
  timeZone: TimeZone,
});
export type OfficeCreateInput = z.infer<typeof OfficeCreateInput>;

export const OfficeUpdateInput = z.strictObject({
  officeId: Id,
  version: Version,
  name: Name,
  timeZone: TimeZone,
});
export type OfficeUpdateInput = z.infer<typeof OfficeUpdateInput>;

export const OpenDay = z.strictObject({
  weekday: intField(1, 7),
  opensAt: HourMinute,
  closesAt: HourMinute,
});
export type OpenDay = z.infer<typeof OpenDay>;

/** Open days only. The save replaces the week. `version` is the office version, so two editors cannot overwrite each other. */
export const OfficeHoursInput = z
  .strictObject({
    officeId: Id,
    version: Version,
    days: z.array(OpenDay).max(7),
  })
  .superRefine((value, ctx) => {
    const seen = new Set<number>();
    value.days.forEach((d, i) => {
      if (seen.has(d.weekday)) ctx.addIssue({ code: 'custom', path: ['days', i, 'weekday'], message: 'Each day can appear once.' });
      seen.add(d.weekday);
      // office.hours_order. HH:mm strings compare in clock order.
      if (d.closesAt <= d.opensAt) ctx.addIssue({ code: 'custom', path: ['days', i, 'closesAt'], message: 'Closing time must be after opening time.' });
    });
  });
export type OfficeHoursInput = z.infer<typeof OfficeHoursInput>;

export const Office = z.strictObject({
  id: Id,
  name: Name,
  timeZone: TimeZone,
  version: Version,
});
export type Office = z.infer<typeof Office>;

export const OfficeHours = z.strictObject({
  officeId: Id,
  weekday: intField(1, 7),
  opensAt: HourMinute,
  closesAt: HourMinute,
});
export type OfficeHours = z.infer<typeof OfficeHours>;
