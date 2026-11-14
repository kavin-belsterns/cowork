// Purpose: user admin contracts and the host picker. Written by S-00 only.
// Rules: design.md Security (limits, password_hash never leaves src/data/user.ts, host picker returns name and desk only).
// officeId is required for every role except platform_admin, which has none (CHECK in the T-02 migration).
import { z } from 'zod';
import { Cursor, Desk, Email, Id, Instant, LIMITS, Name, PageQuery, Phone, Version, blankToUndefined } from '@/contracts/common';
import { Role } from '@/contracts/permissions';

export const USER_STATUSES = ['active', 'deactivated', 'no_password'] as const;
export const UserStatus = z.enum(USER_STATUSES);
export type UserStatus = z.infer<typeof UserStatus>;

export const UserListQuery = PageQuery.extend({
  office: blankToUndefined(Id),
  role: blankToUndefined(Role),
  status: blankToUndefined(UserStatus),
  cursor: blankToUndefined(Cursor),
});
export type UserListQuery = z.infer<typeof UserListQuery>;

const roleMatchesOffice = (v: { role: Role; officeId?: string | undefined }) => (v.role === 'platform_admin') === (v.officeId === undefined);
const officeRule = { message: 'A platform admin has no office. Every other role needs one.', path: ['officeId'] };

export const UserCreateInput = z
  .strictObject({
    name: Name,
    email: Email,
    role: Role,
    officeId: blankToUndefined(Id),
    phone: blankToUndefined(Phone),
    desk: blankToUndefined(Desk),
  })
  .refine(roleMatchesOffice, officeRule);
export type UserCreateInput = z.infer<typeof UserCreateInput>;

export const UserUpdateInput = z
  .strictObject({
    userId: Id,
    version: Version,
    name: Name,
    email: Email,
    role: Role,
    officeId: blankToUndefined(Id),
    phone: blankToUndefined(Phone),
    desk: blankToUndefined(Desk),
  })
  .refine(roleMatchesOffice, officeRule);
export type UserUpdateInput = z.infer<typeof UserUpdateInput>;

export const PasswordResetInput = z.strictObject({
  userId: Id,
  version: Version,
});
export type PasswordResetInput = z.infer<typeof PasswordResetInput>;

export const ISSUE_PASSWORDS_MAX = 500;

export const IssuePasswordsInput = z.strictObject({
  userIds: z.array(Id).min(1).max(ISSUE_PASSWORDS_MAX),
  /** The admin's own password, entered again to confirm. */
  adminPassword: z.string().min(1).max(LIMITS.passwordMax),
});
export type IssuePasswordsInput = z.infer<typeof IssuePasswordsInput>;

export const HostReassignment = z.strictObject({
  visitId: Id,
  newHostId: Id,
});
export type HostReassignment = z.infer<typeof HostReassignment>;

export const DeactivateInput = z.strictObject({
  userId: Id,
  version: Version,
  /** One entry per future visit the user hosts (AC-59). */
  hostReassignments: z.array(HostReassignment).max(1000).default([]),
});
export type DeactivateInput = z.infer<typeof DeactivateInput>;

export const UserListItem = z.strictObject({
  id: Id,
  name: Name,
  email: Email,
  role: Role,
  officeId: Id.nullable(),
  officeName: z.string().max(LIMITS.name).nullable(),
  status: UserStatus,
  version: Version,
});
export type UserListItem = z.infer<typeof UserListItem>;

export const UserDetail = z.strictObject({
  id: Id,
  name: Name,
  email: Email,
  role: Role,
  officeId: Id.nullable(),
  officeName: z.string().max(LIMITS.name).nullable(),
  phone: z.string().max(LIMITS.phone).nullable(),
  desk: z.string().max(LIMITS.desk).nullable(),
  status: UserStatus,
  mustChangePassword: z.boolean(),
  tempPasswordExpiresAt: Instant.nullable(),
  version: Version,
});
export type UserDetail = z.infer<typeof UserDetail>;

/** Host picker option. Name and desk only. No phone, no email. */
export const HostOption = z.strictObject({
  id: Id,
  name: Name,
  desk: z.string().max(LIMITS.desk).nullable(),
});
export type HostOption = z.infer<typeof HostOption>;
