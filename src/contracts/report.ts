// Purpose: weekly report contracts. Written by S-00 only.
// Rules: design.md Data design (Reports). SQL returns raw minutes and counts. The use ratio is computed in src/domain/report/rules.ts.
import { z } from 'zod';
import { Id, IsoDate, LIMITS, blankToUndefined } from '@/contracts/common';

const isMonday = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay() === 1;

/** `office` is for the platform admin. `week` is the ISO date of the Monday. Both are optional: the page picks defaults. */
export const ReportQuery = z.strictObject({
  office: blankToUndefined(Id),
  week: blankToUndefined(IsoDate.refine(isMonday, { message: 'The week starts on a Monday.' })),
});
export type ReportQuery = z.infer<typeof ReportQuery>;

export const RoomUseRow = z.strictObject({
  roomId: Id,
  name: z.string().min(1).max(LIMITS.name),
  size: z.number().int().min(1),
  bookedMinutes: z.number().int().min(0),
  openMinutes: z.number().int().min(0),
});
export type RoomUseRow = z.infer<typeof RoomUseRow>;

export const VisitorDayRow = z.strictObject({
  date: IsoDate,
  /** Checked-in visits that day. Anonymised visits count (AC-18, AC-90). */
  checkedIn: z.number().int().min(0),
});
export type VisitorDayRow = z.infer<typeof VisitorDayRow>;

export const WeeklyReport = z.strictObject({
  officeId: Id,
  officeName: z.string().min(1).max(LIMITS.name),
  timeZone: z.string().max(64),
  weekStart: IsoDate,
  rooms: z.array(RoomUseRow),
  /** Seven rows, Monday to Sunday. */
  days: z.array(VisitorDayRow).length(7),
});
export type WeeklyReport = z.infer<typeof WeeklyReport>;
