// Purpose: visitor contracts for pre-registration, the reception desk, the arrival banner and the badge. Written by S-00 only.
// Rules: design.md Data design (Visit) and Security (visitor search is a POST body, host phone shows only in desk views).
// The host of a pre-registered visit is the caller. It is never a field of VisitCreateInput.
import { z } from 'zod';
import { Company, Email, Id, Instant, IsoDate, LIMITS, Name, Phone, Version, blankToUndefined } from '@/contracts/common';

export const VISIT_STATUSES = ['expected', 'checked_in', 'checked_out', 'cancelled'] as const;
export const VisitStatus = z.enum(VISIT_STATUSES);
export type VisitStatus = z.infer<typeof VisitStatus>;

export const VisitCreateInput = z.strictObject({
  name: Name,
  company: blankToUndefined(Company),
  email: blankToUndefined(Email),
  phone: blankToUndefined(Phone),
  officeId: Id,
  visitDate: IsoDate,
});
export type VisitCreateInput = z.infer<typeof VisitCreateInput>;

export const VisitCancelInput = z.strictObject({
  visitId: Id,
  version: Version,
});
export type VisitCancelInput = z.infer<typeof VisitCancelInput>;

/** A visitor with no appointment. The receptionist picks the host. The visit is created already checked in. */
export const WalkInInput = z.strictObject({
  name: Name,
  company: blankToUndefined(Company),
  email: blankToUndefined(Email),
  phone: blankToUndefined(Phone),
  officeId: Id,
  hostId: Id,
});
export type WalkInInput = z.infer<typeof WalkInInput>;

export const CheckInInput = z.strictObject({
  visitId: Id,
  version: Version,
});
export type CheckInInput = z.infer<typeof CheckInInput>;

export const CheckOutInput = z.strictObject({
  visitId: Id,
  version: Version,
});
export type CheckOutInput = z.infer<typeof CheckOutInput>;

/** POST body only. The visitor name never goes in a URL. `officeId` is for the platform admin, who picks an office. */
export const VisitSearchInput = z.strictObject({
  query: z.string().trim().min(1).max(LIMITS.name),
  officeId: blankToUndefined(Id),
});
export type VisitSearchInput = z.infer<typeof VisitSearchInput>;

/** Dismiss the arrival banner. It sets host_seen_at. A repeat is harmless, so it carries no version. */
export const VisitSeenInput = z.strictObject({
  visitId: Id,
});
export type VisitSeenInput = z.infer<typeof VisitSeenInput>;

/** Name, company, email and phone are null after the nightly purge (AC-09). */
export const Visit = z.strictObject({
  id: Id,
  officeId: Id,
  hostId: Id,
  name: z.string().max(LIMITS.name).nullable(),
  company: z.string().max(LIMITS.company).nullable(),
  email: z.string().max(LIMITS.email).nullable(),
  phone: z.string().max(LIMITS.phone).nullable(),
  visitDate: IsoDate,
  status: VisitStatus,
  checkedInAt: Instant.nullable(),
  checkedOutAt: Instant.nullable(),
  anonymised: z.boolean(),
  version: Version,
});
export type Visit = z.infer<typeof Visit>;

/** One visitor row of the today view. Host phone and desk show here only (AC-20). */
export const TodayVisit = Visit.extend({
  hostName: z.string().max(LIMITS.name),
  hostPhone: z.string().max(LIMITS.phone).nullable(),
  hostDesk: z.string().max(LIMITS.desk).nullable(),
  /** True for a visitor of an earlier day who is still checked in. These rows sit first. */
  notCheckedOut: z.boolean(),
});
export type TodayVisit = z.infer<typeof TodayVisit>;

export const TodayBooking = z.strictObject({
  id: Id,
  roomName: z.string().min(1).max(LIMITS.name),
  ownerName: z.string().min(1).max(LIMITS.name),
  startsAt: Instant,
  endsAt: Instant,
  attendees: z.number().int().min(1),
});
export type TodayBooking = z.infer<typeof TodayBooking>;

export const TodayView = z.strictObject({
  officeId: Id,
  officeName: z.string().min(1).max(LIMITS.name),
  timeZone: z.string().max(64),
  date: IsoDate,
  bookings: z.array(TodayBooking),
  visits: z.array(TodayVisit),
});
export type TodayView = z.infer<typeof TodayView>;

/** One line of the host's arrival banner. */
export const ArrivalNotice = z.strictObject({
  visitId: Id,
  visitorName: Name,
  arrivedAt: Instant,
});
export type ArrivalNotice = z.infer<typeof ArrivalNotice>;

/** Everything printed on the badge (AC-43). Nothing else. */
export const BadgeView = z.strictObject({
  visitorName: Name,
  hostName: z.string().min(1).max(LIMITS.name),
  officeName: z.string().min(1).max(LIMITS.name),
  date: IsoDate,
});
export type BadgeView = z.infer<typeof BadgeView>;
