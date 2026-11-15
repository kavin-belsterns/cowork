---
story: E-001/S-05
epic: E-001
ears: [E-001/AC-07, E-001/AC-33, E-001/AC-80]
owns:
  - src/data/availability.ts
  - src/domain/availability/**
  - "src/app/(app)/rooms/**"
  - src/components/rooms/**
  - tests/unit/data/availability.test.ts
  - tests/unit/domain/availability/**
  - tests/integration/availability/**
  - tests/ui/rooms.spec.ts
  - tests/e2e/E-001/S05-room-availability.spec.ts
depends_on: [E-001/S-00, E-001/S-01]
parallel: true
---

# Spec: E-001/S-05 Room availability

## 1. Scope
EARS IDs covered:
- E-001/AC-07 any user can see free rooms at any office, not only their own.
- E-001/AC-33 pick an office and a day, see every room with its free and booked times.
- E-001/AC-80 enter an attendee count, see only rooms that fit.

Availability rules live in `src/domain/availability/`, not the booking module in design.md, so S-05 and S-06 own separate files.

Out of scope:
- Saving a booking, and every booking rule message (E-001/S-06). A slot button only opens `/bookings/new`.
- Office hours and room editing (E-001/S-02). This story only reads them.
- Repeat bookings (E-001/S-07).

## 2. Page and UI
Route: `/rooms` (role home for employees). Filters are a GET form: office, date, attendees. They hold no personal data.

| State | What the user sees |
|---|---|
| Loading | `loading.tsx`: filter bar, then three room card skeletons with slot rows |
| Empty | Closed day: "This office is closed on <day>." No room fits: "No room here holds <N> people. Lower the count or pick another office." Office has no rooms: "This office has no rooms yet." |
| Error | `error.tsx`: "Something went wrong. Try again. If it happens again, give reference <id> to your admin." Retry button |
| Not found | Unknown or malformed office id: "We could not find this item." Link "Back to rooms" |
| Success | One card per room: name, floor, "Holds N people", then the day as labelled slot buttons |

Layout rules:
- Each room card lists 15-minute slots from opening to closing time in the office zone.
- A free slot is a button of at least 24 by 24 px. Its accessible name is "Book <room> at HH:MM <zone>". It links to `/bookings/new` with the room id and start time.
- A booked range is plain text "Booked HH:MM to HH:MM". Booked state is shown by text, not colour alone. No drag.
- The office zone short name sits beside the date heading and each time, since users view any office.
- DST gap slots are hidden. A repeated fall-back hour shows the zone short name on each slot.
- On today, slots that have started are not offered as buttons.
- Default office: the caller's office. Platform admins get the first office by name. Default date: today in the office zone. Default attendees: 1.

Breakpoints: 375 one column, filters stacked, slot buttons wrap in a grid of 4. 768 filters in two columns, slots in a grid of 8. 1280 filters in one row, room cards two across.

Copy:
| Key | Text |
|---|---|
| title | Find a free room |
| office_label | Office |
| date_label | Day |
| attendees_label | Number of attendees |
| apply | Show rooms |
| room_size | Holds N people |
| slot_name | Book <room> at HH:MM <zone> |
| booked | Booked HH:MM to HH:MM |
| closed | This office is closed on <day>. |
| none_fit | No room here holds <N> people. Lower the count or pick another office. |
| no_rooms | This office has no rooms yet. |
| date_format | Mon 16 Nov 2026, times in 24-hour form |

## 3. API
| Endpoint or action | Request type | Response type | Errors (RFC 9457) |
|---|---|---|---|
| None: no server action. `src/app/(app)/rooms/page.tsx` is a server component that reads `getRoomDay()` from `src/data/availability.ts` | `src/contracts/booking.ts: RoomsQuery` (office, date, minSize) from `searchParams` | `RoomDay[]`, office list as `src/contracts/office.ts: Office` | `validation` 400 (bad params, shown at the filter field), `unauthenticated` 401, `not-found` 404 (unknown office) |

- The page parses `searchParams` with `RoomsQuery` first and uses only the parsed value.
- The page calls `requirePermission(session, 'booking.create')` before any data read.
- `src/domain/availability/rules.ts` stays pure: slot grid, overlap marking, size filter, DST gap and repeated hour. No Prisma, no `next/*`. Each rule has an `@ears` TSDoc tag.
- Time conversion uses `src/lib/time.ts` (ADR-0009).
- No public HTTP route, so no OpenAPI change. No idempotency: read only.
- Contract gap: none.

## 4. Data
| Table | Reads | Writes | Indexes used | Transaction |
|---|---|---|---|---|
| offices | Q1 list by name for the picker. Q2 by id for zone | None | unique `name`, PK | No: read only |
| office_hours | Q1 by office and weekday | None | PK `(office_id, weekday)`. No row means closed | No |
| rooms | Q1 live rooms of office with `size >= minSize` | None | partial unique `(office_id, lower(name)) where deleted_at is null` | No |
| bookings | Q1 confirmed bookings of those rooms for the day | None | exclusion constraint gist index, btree `(room_id, starts_at)` | No |

Q1 on bookings is raw SQL by `$queryRaw` tagged template. It uses the exact constraint expression so the planner can use the gist index:

```sql
SELECT room_id, starts_at, ends_at FROM bookings
WHERE room_id = ANY(${roomIds}::uuid[])
  AND tstzrange(starts_at, ends_at, '[)') && tstzrange(${dayStart}, ${dayEnd}, '[)')
  AND status = 'confirmed'
```

`dayStart` and `dayEnd` are the office-zone day bounds in UTC. No new tables or columns. Reads only, so no transaction and no audit row. The overlap guard on write is the constraint in S-06 (ADR-0006).

## 5. Security
| Item | Value |
|---|---|
| Roles allowed | All four roles: `booking.create` |
| Permission check | `requirePermission(session, 'booking.create')` in `page.tsx` before the data read |
| Record scope | `scopeFor`: free rooms are readable at any office (AC-07). Deleted rooms are never returned |
| Boundary validation | `RoomsQuery` (strict, office uuid, ISO date, `minSize` integer of 1 or more) |
| Data exposure | `RoomDay` holds room fields and booked ranges only. No owner name, no booking id of other users |
| OWASP items | A01 deny by default, permission in the page. A03 zod plus `$queryRaw` tagged template, no `$queryRawUnsafe`. A04 no personal data in URL params |
| Logging | Request summary with user id, office id and date. No names |

## 6. Tests
| Kind | File path | Covers |
|---|---|---|
| unit | `tests/unit/domain/availability/rules.test.ts` (T-03) | 15-minute slot grid from hours, overlap marking with `[)` so 11:00 after a 10:00 to 11:00 booking is free, size filter (E-001/AC-80), closed day, DST gap hidden (Europe/London 29 Mar 2026), repeated hour labelled (25 Oct 2026), started slots on today |
| unit | `tests/unit/data/availability.test.ts` (T-02) | Query maps rows to `RoomDay`, cancelled rows excluded, deleted rooms excluded, day bounds in UTC |
| integration | `tests/integration/availability/rooms.test.ts` (T-05) | Seed data: employee reads another office (E-001/AC-07), every room listed with booked ranges (E-001/AC-33), `minSize` filter (E-001/AC-80), unknown office 404, bad date 400, no session 401, EXPLAIN shows the gist index on Q1 |
| ui | `tests/ui/rooms.spec.ts` (T-04) | Five states at 375, 768, 1280. axe zero violations. Tab reaches every slot button. Slot targets 24 by 24 px. Booked text present |
| e2e | `tests/e2e/E-001/S05-room-availability.spec.ts` (T-05) | One test per ID, ID first in the title: `E-001/AC-07`, `E-001/AC-33`, `E-001/AC-80` |
| evals | None: no AI output. Page speed is checked in E-001/S-13 | |
| load | None: the 50% "view rooms" mix runs at epic release in `tests/load/E-001.js` | |

## 7. Docs
| Docs home | Change |
|---|---|
| `docs/manual/E-001-room-booking.md` | Add "Find a free room": pick office, day and attendees, read slots, zone label, closed days |
| `docs/rules/` | Regenerated from `src/domain/availability/rules.ts` `@ears` tags |
| `docs/workflows/E-001-room-booking.md` | Employee journey, step "Pick office, day and attendee count" |
| `docs/api/openapi.yaml` | None: no public route |

## 8. Done
| Command | Expected output |
|---|---|
| `pnpm tsc --noEmit` | exit 0 |
| `pnpm lint` | exit 0, no warnings |
| `pnpm vitest run tests/unit/domain/availability tests/unit/data/availability.test.ts` | all pass |
| `pnpm vitest run tests/integration/availability` | all pass |
| `pnpm playwright test tests/ui/rooms.spec.ts tests/e2e/E-001/S05-room-availability.spec.ts` | all pass |
| `bash scripts/ci/check-auth-in-actions.sh` | PASS |
| `bash scripts/ci/check-test-tree.sh` | PASS |
| `bash scripts/ci/check-no-console.sh` | PASS |
| `bash scripts/ci/check-ac-coverage.sh` | PASS for AC-07, AC-33, AC-80 |
| `git diff --exit-code origin/main -- prisma src/contracts` | exit 0 (no contract change) |

## Tasks
| Task | Type | Specialist | Section | Note |
|---|---|---|---|---|
| T-01 | contract | data-engineer | 3, 4 | None: reads contracts |
| T-02 | data | api-engineer | 4 | `src/data/availability.ts`: Q1 raw SQL, rooms and hours reads, `RoomDay` mapping. Unit test |
| T-03 | api | api-engineer | 3, 5 | `src/domain/availability/rules.ts` pure rules with `@ears` tags. Unit tests. No actions in this story |
| T-04 | ui | ui-engineer | 2 | `/rooms` page, `loading.tsx`, `error.tsx`, `not-found.tsx`, `src/components/rooms/**`, copy table, `tests/ui/rooms.spec.ts`. Excludes `actions.ts` |
| T-05 | tests | test-engineer | 6 | Integration test, e2e spec, coverage check |
| T-06 | docs | test-engineer | 7 | Manual block, workflow step, regenerate `docs/rules/` |
