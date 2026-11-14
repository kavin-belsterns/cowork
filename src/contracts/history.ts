// Purpose: activity history contracts. Written by S-00 only.
// Rules: design.md Data design (AuditEvent) and UX rules. A visitor shows as a short reference, never a name (AC-52).
import { z } from 'zod';
import { Id, Instant, LIMITS, PageQuery, Cursor } from '@/contracts/common';

/** Same values as the audit_action Postgres enum. The UI turns them into plain verbs. */
export const AUDIT_ACTIONS = ['created', 'changed', 'cancelled', 'removed', 'deactivated', 'checked_in', 'checked_out', 'anonymised', 'failed'] as const;
export const AuditAction = z.enum(AUDIT_ACTIONS);
export type AuditAction = z.infer<typeof AuditAction>;

export const AUDIT_ENTITY_TYPES = ['office', 'room', 'user', 'booking', 'series', 'visit', 'import', 'job'] as const;
export const AuditEntityType = z.enum(AUDIT_ENTITY_TYPES);
export type AuditEntityType = z.infer<typeof AuditEntityType>;

/** Cursor and limit only. The sort is (at desc, id desc), so the cursor holds both. */
export const HistoryQuery = PageQuery;
export type HistoryQuery = z.infer<typeof HistoryQuery>;

export const AuditEventView = z.strictObject({
  id: Id,
  at: Instant,
  /** Null when the office is not known, for example a job run. */
  officeId: Id.nullable(),
  officeName: z.string().max(LIMITS.name).nullable(),
  timeZone: z.string().max(64).nullable(),
  /** Null for the system principal. The page shows "Nightly job". */
  actorName: z.string().max(LIMITS.name).nullable(),
  action: AuditAction,
  itemType: AuditEntityType,
  /** Record label or a short reference such as "V-3F2A" for a visitor. Never a visitor name. */
  itemLabel: z.string().max(200),
  /** True when the visit behind the item has been anonymised. The page adds "Visitor details removed". */
  visitorDetailsRemoved: z.boolean(),
});
export type AuditEventView = z.infer<typeof AuditEventView>;

export const HistoryPage = z.strictObject({
  events: z.array(AuditEventView).max(100),
  next: Cursor.nullable(),
});
export type HistoryPage = z.infer<typeof HistoryPage>;
