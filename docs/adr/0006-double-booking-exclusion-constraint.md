---
id: 0006
type: decision
work_item: E-001
date: 2026-11-14
status: accepted
---

# 0006 Prevent double bookings with a Postgres exclusion constraint

## Context
Zero double bookings is the main success measure (AC-11, AC-12). Two requests for the same slot can arrive in the same millisecond. Postgres runs Read Committed by default.

## Options
| Option | Complexity | Cost to run | Scale | Team knows it |
|---|---|---|---|---|
| A. Check for overlap in code, then insert | Low | None | Breaks under concurrency: both checks pass | Yes |
| B. Serializable transaction with retry on 40001 | Medium | Retries under load, not measured | Fine | Yes |
| C. Advisory lock per room around check and insert | Medium | Lock wait per booking, not measured | Fine | Partly |
| D. `EXCLUDE USING gist (room_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&) WHERE (status = 'confirmed')` | Medium: raw SQL in migration, `btree_gist` extension | Index upkeep on insert, not measured | Fine to 600,000 rows | Partly |

## Decision
Option D. The database refuses the second booking whatever the code does. Error 23P01 maps to 409 `/problems/booking-conflict`. Proposed by the chair, signed with the design.

## Consequences
- Easier: one guard for single, changed and recurring bookings. `[)` allows back-to-back slots (AC-36).
- Harder: Prisma cannot declare the constraint. S-00 adds it as raw SQL in the migration and a test proves it exists. The client Postgres must allow `btree_gist`.
- Revisit when: bookings pass 5 million rows or the insert p95 passes 100 ms in the load test.
