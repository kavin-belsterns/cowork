---
id: 0015
type: override
work_item: E-001/S-00
date: 2026-11-14
status: proposed
rule: standards/data.md#RC6
---

# 0015 Audit columns and boolean prefix on system tables

## Context
`standards/data.md` RC6 asks for `created_at`, `updated_at` and `created_by` on every table, and `is_` or `has_` on booleans. Five tables hold system or append-only rows: `sign_in_attempts`, `sessions`, `audit_events`, `idempotency_keys`, `job_runs`. Their rows are never edited by a user. `users.must_change_password` is named in design.md, ADR-0011 and five specs.

## Options
| Option | Complexity | Cost to run | Scale | Team knows it |
|---|---|---|---|---|
| A. Add every audit column to every table, rename the boolean | Low | Wider rows on the two busiest append tables, not measured | Fine | Yes |
| B. Keep `created_at` (or `at`) only on system tables, keep the design name | Low | None | Fine | Yes |

## Decision
Option B. A `created_by` on a sign-in attempt or a job run has no user to name. An `updated_at` on an append-only row is never set. Renaming the boolean would break the signed design wording. Proposed by the lead in E-001/S-00/T-01. The engineer confirms at the S-00 pull request.

## Consequences
- Easier: rows match their real lifecycle. Names match design.md.
- Harder: the house schema lint, when it ships, needs these five tables and one column on its allow list.
- Revisit when: any of these tables gains a user edit path.

## Override block (type: override only)
- Rule skipped: standards/data.md#RC6
- Reason: system and append-only rows have no editing user; the boolean name is fixed by the signed design.
- Who: engineer to confirm at the S-00 pull request
- Expires: when a user edit path is added to any of the five tables
