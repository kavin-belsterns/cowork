---
id: 0008
type: decision
work_item: E-001
date: 2026-11-14
status: accepted
---

# 0008 CSV parser for import and seed

## Context
Admins import rooms and users by CSV (AC-61 to AC-64). The go-live seed script loads the same data (AC-60). Fields can hold quoted commas.

## Options
| Option | Complexity | Cost to run | Scale | Team knows it |
|---|---|---|---|---|
| A. Split lines on commas by hand | Low | None | Breaks on quoted commas and line breaks | Yes |
| B. `csv-parse` (sync API, server only) | Low | Parses 5,000 rows in memory, not measured | Fine | Yes |
| C. Read Excel files directly with a spreadsheet library | Medium: binary format, larger attack surface | None | Fine | Partly |

## Decision
Option B. The seed script takes the client spreadsheet saved as CSV, so import and seed share one validator in `src/domain/import/`. Proposed by the chair, signed with the design.

## Consequences
- Easier: one parser, one validator, one set of tests.
- Harder: the client saves their sheet as CSV. `csv-parse` is not in `standards/versions.md`; pin it by the 90-day rule.
- Revisit when: admins ask to upload Excel files directly.
