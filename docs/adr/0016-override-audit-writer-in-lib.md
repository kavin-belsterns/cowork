---
id: 0016
type: override
work_item: E-001/S-00
date: 2026-11-14
status: proposed
rule: standards/data.md#RC9
---

# 0016 Audit writer lives in src/lib, not src/data

## Context
`standards/data.md` RC9 puts Prisma calls in `src/data/<entity>.ts`. Every write in E-001 must add an `audit_events` row in the same transaction (AC-50). Spec S-00 places `writeAudit(tx, event)` in `src/lib/audit.ts` so all thirteen stories call one shared helper, as they do with `src/lib/db.ts`.

## Options
| Option | Complexity | Cost to run | Scale | Team knows it |
|---|---|---|---|---|
| A. `src/data/audit.ts`, owned by one story, imported by the others | Medium: every story depends on that story's file | None | Fine | Yes |
| B. `src/lib/audit.ts` from S-00, `server-only`, takes the caller's `tx` | Low | None | Fine | Yes |

## Decision
Option B. The writer only inserts into the caller's transaction and starts with `import 'server-only'`. Proposed by the lead in E-001/S-00/T-02. The engineer confirms at the S-00 pull request.

## Consequences
- Easier: one audit path for every story, set before any story starts.
- Harder: one Prisma call outside `src/data/`. Reviewers must know this exception.
- Revisit when: the audit writer needs to read data, or a second shared writer appears.

## Override block (type: override only)
- Rule skipped: standards/data.md#RC9
- Reason: a shared, transaction-scoped writer used by every story belongs with `db.ts` in S-00.
- Who: engineer to confirm at the S-00 pull request
- Expires: when a story needs more than an insert from this helper
