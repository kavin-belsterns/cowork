// Purpose: write one audit_events row inside the caller's transaction, so the change and its audit row commit or roll back together.
// Rules: design.md Data design (AuditEvent) and AC-50, AC-51, AC-52. The table is append only, no personal data, visitors by id only.
// `detail` holds reason codes and counts. A key the logger would redact is rejected, so names, emails, phones and desks never get in.
import 'server-only';
import { AuditAction, AuditEntityType, type AuditAction as AuditActionValue, type AuditEntityType as AuditEntityTypeValue } from '@/contracts/history';
import { Id } from '@/contracts/common';
import { createLogger } from '@/lib/logger';
import type { Tx } from '@/lib/db';

export type AuditDetail = { [key: string]: AuditDetailValue };
type AuditDetailValue = string | number | boolean | null | AuditDetailValue[] | AuditDetail;

export type AuditEventInput = {
  /** Office snapshot. Null when no office applies, for example a job run or a platform admin change. */
  officeId: string | null;
  /** Null means the system principal (worker, seed or break-glass). */
  actorId: string | null;
  action: AuditActionValue;
  entityType: AuditEntityTypeValue;
  /** For a visit this is the visit id only. */
  entityId: string;
  /** Reason codes and counts only. */
  detail?: AuditDetail;
};

const MAX_DEPTH = 4;
const probed = new Map<string, boolean>();

/** Ask the logger itself, so this check never drifts from the logger redaction list. */
function loggerRedacts(key: string): boolean {
  const known = probed.get(key);
  if (known !== undefined) return known;
  let redacted = false;
  const probe = createLogger({
    level: 'fatal',
    write: (line) => {
      redacted = (JSON.parse(line) as Record<string, unknown>)[key] === '[REDACTED]';
    },
  });
  probe.fatal('probe', { [key]: 1 });
  probed.set(key, redacted);
  return redacted;
}

function assertNoPersonalKeys(value: unknown, depth = 0): void {
  if (depth > MAX_DEPTH) throw new Error('Audit detail is nested too deep.');
  if (Array.isArray(value)) {
    for (const item of value) assertNoPersonalKeys(item, depth + 1);
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, inner] of Object.entries(value)) {
      if (loggerRedacts(key)) throw new Error(`Audit detail key "${key}" is not allowed. Store reason codes and counts only.`);
      assertNoPersonalKeys(inner, depth + 1);
    }
  }
}

/** Insert one audit row. Call it inside the same `$transaction` as the change. Returns the new row id. */
export async function writeAudit(tx: Tx, event: AuditEventInput): Promise<string> {
  const action = AuditAction.parse(event.action);
  const entityType = AuditEntityType.parse(event.entityType);
  const entityId = Id.parse(event.entityId);
  const officeId = event.officeId === null ? null : Id.parse(event.officeId);
  const actorId = event.actorId === null ? null : Id.parse(event.actorId);
  if (event.detail !== undefined) assertNoPersonalKeys(event.detail);

  const row = await tx.auditEvent.create({
    data: { officeId, actorId, action, entityType, entityId, ...(event.detail !== undefined ? { detail: event.detail } : {}) },
    select: { id: true },
  });
  return row.id;
}
