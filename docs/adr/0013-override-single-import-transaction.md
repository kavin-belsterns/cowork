---
id: 0013
type: override
work_item: E-001
date: 2026-11-14
status: accepted
rule: standards/data.md#RC1
---

# 0013 CSV import runs in one transaction

## Context
`standards/data.md` says bulk imports use no transaction and small batches. AC-62 requires all rows or none: one bad row means nothing is imported.

## Decision
Validate every row first, outside the transaction. Then insert all rows with `createMany` in one transaction with a 30 s timeout. Only one import runs per office at a time. Proposed by the chair, signed with the design.

## Consequences
- Easier: AC-62 holds with no clean-up code.
- Harder: one transaction of up to 5,000 rows, with locks held for its length, not measured.
- Revisit when: an import of 5,000 rows takes over 10 s in the load test.

## Override block (type: override only)
- Rule skipped: standards/data.md#RC1
- Reason: AC-62 needs all-or-nothing behaviour across up to 5,000 rows.
- Who: Kavin Pasupathy (as signer)
- Expires: E-001 release review
