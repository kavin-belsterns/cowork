---
id: 0010
type: decision
work_item: E-001
date: 2026-11-14
status: accepted
---

# 0010 Store recurring bookings as individual booking rows

## Context
Daily and weekly series are in scope (AC-74 to AC-77, ADR-0002). Each date must obey the same overlap rule as a single booking (AC-11).

## Options
| Option | Complexity | Cost to run | Scale | Team knows it |
|---|---|---|---|---|
| A. Store only the repeat rule. Expand dates when reading | High: overlap checks across rules, the exclusion constraint cannot see them | Expansion on every read | Weak | Partly |
| B. `booking_series` row plus one `booking` row per date, linked by `series_id` | Low | At most 90 rows per series (daily, 90 days, seven-day office); closed days skipped | Fine | Yes |

## Decision
Option B. The exclusion constraint from ADR-0006 guards every date. Clashing dates are skipped and listed (AC-76). Proposed by the chair, signed with the design.

## Consequences
- Easier: availability, reports and cancel use one table.
- Harder: changing a whole series means updating many rows in one transaction.
- Revisit when: monthly or open-ended series are requested.
