---
id: 0009
type: decision
work_item: E-001
date: 2026-11-14
status: accepted
---

# 0009 Time zone handling per office

## Context
Each office has its own time zone (AC-34, AC-54). Rules such as 15-minute steps, opening hours and "in the past" run in office local time. Daylight saving must not shift bookings.

## Options
| Option | Complexity | Cost to run | Scale | Team knows it |
|---|---|---|---|---|
| A. Native `Intl` only | High: no zoned arithmetic, manual offset maths | None | Fine | Yes |
| B. `date-fns` v4 with `@date-fns/tz` | Low | None | Fine | Yes |
| C. Temporal API | Low | None | Fine | No. Availability in Node 26 is UNVERIFIED |

## Decision
Option B. Store `timestamptz` in UTC. Convert at the boundary in `src/domain/*/rules.ts` with the office IANA zone. Proposed by the chair, signed with the design.

## Consequences
- Easier: one tested helper for every zoned rule.
- Harder: two packages not in `standards/versions.md`; pin them by the 90-day rule.
- Revisit when: Temporal ships unflagged in the pinned Node LTS.
