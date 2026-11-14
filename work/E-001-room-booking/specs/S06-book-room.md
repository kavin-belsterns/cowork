---
story: E-001/S-06
epic: E-001
ears: [E-001/AC-11, E-001/AC-12, E-001/AC-23, E-001/AC-24, E-001/AC-25, E-001/AC-26, E-001/AC-27, E-001/AC-28, E-001/AC-35, E-001/AC-36, E-001/AC-37, E-001/AC-38, E-001/AC-55, E-001/AC-78, E-001/AC-79, E-001/AC-82]
owns:
  - src/data/booking.ts
  - src/domain/booking/**
  - "src/app/(app)/bookings/**"
  - src/components/booking/**
  - tests/unit/data/booking.test.ts
  - tests/unit/domain/booking/**
  - tests/integration/booking/**
  - tests/ui/bookings.spec.ts
  - tests/ui/bookings-new.spec.ts
  - tests/e2e/E-001/S06-book-room.spec.ts
depends_on: [E-001/S-00, E-001/S-03, E-001/S-05]
parallel: true
---

# Spec: E-001/S-06 Book, change and cancel

## 1. Scope
EARS IDs covered:
- E-001/AC-11 at most one confirmed booking per room for any overlap, held by the exclusion constraint.
- E-001/AC-12 of two racing bookings, one is confirmed and the other gets "This room was just booked. Pick another time."
- E-001/AC-23 start and end only in 15-minute steps.
- E-001/AC-24 "A booking can last at most 1 day."
- E-001/AC-25 "You can book up to 90 days ahead."
- E-001/AC-26 "You cannot book a time that has passed."
- E-001/AC-27 owner, platform admin, and office admins and receptionists of the room's office can change or cancel.
- E-001/AC-28 anyone else gets 403.
- E-001/AC-35 a valid booking is saved and a confirmation is shown.
- E-001/AC-36 back-to-back bookings such as 10:00 to 11:00 and 11:00 to 12:00 are allowed.
- E-001/AC-37 a change onto a taken time is rejected and the original stays.
- E-001/AC-38 a cancelled booking frees the time at once.
- E-001/AC-55 "This office is open HH:MM to HH:MM." with the zone short name.
- E-001/AC-78 attendee count is asked on every booking.
- E-001/AC-79 "This room holds N people."
- E-001/AC-82 admins and receptionists book as well as employees.

Out of scope:
- The free rooms list (E-001/S-05). This story reads its data module to refresh free times after a 409.
- Repeat on `/bookings/new` and the series cancel choice (E-001/S-07). S-07 extends the shared form and cancel dialog.
- Cancelled rows in history and reports (E-001/S-10, E-001/S-11).

## 2. Page and UI
Routes: `/bookings/new` (book), `/bookings` (my bookings), `/bookings/[bookingId]` (change or cancel).

| State | What the user sees |
|---|---|
| Loading | `loading.tsx` per route: form skeleton, or three list row skeletons |
| Empty | `/bookings`: "You have no upcoming bookings." Link "Find a free room" to `/rooms`. The form never empties |
| Error | Form: error summary takes focus and lists each field message. Inputs stay. `error.tsx`: `internal` copy with reference id and Retry |
| Not found | Missing or other-office booking or room: "We could not find this item." Link "Back to my bookings" |
| Success | Create redirects to `/bookings/[bookingId]`. A `role="status"` region says "Booking confirmed." Change says "Booking changed." Cancel says "Booking cancelled." |

Form rules:
- Fields: room (prefilled from the `/rooms` slot), day, start, end, attendees. Times are 15-minute selects in the office zone, with the zone short name beside them.
- Each field uses `aria-describedby` for its message. Submit is disabled while pending.
- The form holds a hidden `idempotencyKey`. It gets a new key after any failure.
- After a 409, inputs stay and the free times for that room and day refresh from `src/data/availability.ts`.
- Cancel opens an AlertDialog named "Cancel booking for <room> on <date>".
- `/bookings` lists the caller's future bookings: date, time with zone, room, office, attendees, status text.

Breakpoints: 375 one column, list rows stack into cards. 768 two-column form (start, end side by side). 1280 form beside the room summary and free times.

Copy:
| Key | Text |
|---|---|
| title_new | Book <room> |
| attendees_label | Number of attendees |
| submit | Book room |
| save | Save changes |
| cancel | Cancel booking |
| step | Pick a time in 15-minute steps. |
| attendees_missing | Enter the number of attendees. |
| too_long | A booking can last at most 1 day. |
| too_far | You can book up to 90 days ahead. |
| past | You cannot book a time that has passed. |
| hours | This office is open HH:MM to HH:MM <zone>. |
| closed | This office is closed on <day>. |
| size | This room holds N people. |
| conflict | This room was just booked. Pick another time. |
| version | Someone changed this. Reload to see it. |
| running | This is still saving. Wait a moment. |
| changed_key | This request changed. Submit it again. |
| forbidden | You do not have access to this. |

## 3. API
| Endpoint or action | Request type | Response type | Errors (RFC 9457) |
|---|---|---|---|
| `createBookingAction` in `src/app/(app)/bookings/new/actions.ts`, form field `idempotencyKey` | `src/contracts/booking.ts: BookingCreateInput`, key as `common.ts: IdempotencyKey` | `Booking`, then redirect | `validation` 400, `unauthenticated` 401, `not-found` 404, `booking-conflict` 409, `request-in-progress` 409, `request-changed` 422, `rule-violation` 422 |
| `updateBookingAction` in `src/app/(app)/bookings/[bookingId]/actions.ts` | `BookingUpdateInput` | `Booking` | `validation` 400, 401, `forbidden` 403, `not-found` 404, `booking-conflict` 409, `version-conflict` 409, `rule-violation` 422 |
| `cancelBookingAction` in the same file | `BookingCancelInput` | `Booking` | 401, 403, 404, `version-conflict` 409 |

Create flow, per the design sequence:
1. Parse with `BookingCreateInput`, then `requirePermission(session, 'booking.create')`.
2. `withIdempotency()` inserts the key as running, scope `(user_id, 'booking.create', key)`. Done returns the saved result. Running returns 409. Other payload hash returns 422. TTL 24 h, pruned by the worker (S-12).
3. Load room, office, hours and zone. Rules in order: steps, past, 90 days, 1 day, hours, size.
4. Interactive transaction (section 4). 23P01 maps to `booking-conflict` 409 with AC-12 copy in `src/lib/errors.ts`.
5. After rollback on any failure, delete the running key. The form issues a new key.

- `[bookingId]` is parsed with `Id`. Change and cancel use the booking `version`. They need no idempotency key: the version guard stops a repeat.
- Change moves the day, time or attendee count. The room stays.
- Rules in `src/domain/booking/rules.ts` are pure, with `@ears` tags. No Prisma, no `next/*`.
- No public HTTP route, so no OpenAPI change.
- Contract: `BookingNewQuery` (room id and start from S-05 slot links) is in S-00.
- Contract: `BookingUpdateInput` and `BookingCancelInput` carry `version` (S-00 section 3).

## 4. Data
| Table | Reads | Writes | Indexes used | Transaction |
|---|---|---|---|---|
| idempotency_keys | by `(user_id, scope, key)` | insert running, update done with response (ids only), delete on failure | unique `(user_id, scope, key)` | Claim runs before the booking tx. Done is set inside it |
| offices, rooms | by id, `FOR SHARE` in the tx | None | PK | Yes (ADR-0012) |
| office_hours | by office and weekday | None | PK `(office_id, weekday)` | No |
| bookings | Q2 my future bookings. By id for change and cancel | Q3 insert. Update time, attendees or status with `version` | exclusion constraint, `(owner_id, starts_at)`, `(room_id, starts_at)` | Yes |
| audit_events | None | one row per create, change, cancel via `src/lib/audit.ts` | None | Yes, same tx |

Transactions (interactive form, design table):
- Create: `FOR SHARE` on the office and room rows, insert booking, audit row, key done. Invariant: no overlap (ADR-0006), and no zone change or room removal slips past the insert (ADR-0012).
- Change: same locks, `updateMany where id, version, status = 'confirmed'`. 0 rows throws and maps to `version-conflict`. 23P01 rolls back, so the original stays (AC-37).
- Cancel: `updateMany where id, version, status = 'confirmed'` sets `cancelled`. The row stays. The constraint only covers confirmed rows, so the time is free at once (AC-38).
- `[)` ranges allow back-to-back bookings (AC-36). No new tables or columns.

## 5. Security
| Item | Value |
|---|---|
| Roles allowed | Create: all four roles, any office (`booking.create`, AC-07, AC-82). Change and cancel: `booking.manage` |
| Permission check | `requirePermission` first in each action, after the zod parse |
| Record scope | `scopeFor(session, booking)`: owner matches `owner_id` at any office. Office staff match `room.office_id`. Other office returns 404. Same office without the right returns 403 (AC-28) |
| Boundary validation | `BookingCreateInput`, `BookingUpdateInput`, `BookingCancelInput`, `IdempotencyKey`, `Id` for `[bookingId]`. All strict |
| OWASP items | A01 deny by default and per-record scope. A03 zod plus Prisma, `$queryRaw` tagged only. A04 race closed by the constraint, not by a read check. A08 idempotency on create |
| Logging | Booking conflict event with user id, room id, booking id. Validation failures by field name. No names, no notes |

## 6. Tests
| Kind | File path | Covers |
|---|---|---|
| unit | `tests/unit/domain/booking/rules.test.ts` (T-03) | Steps, past, 90 days, 1 day, hours with zone, closed day, size, edit rights. Rule order |
| unit | `tests/unit/data/booking.test.ts` (T-02) | 23P01 to `booking-conflict`, 0 rows to `version-conflict`, `FOR SHARE` issued, key deleted on failure |
| integration | `tests/integration/booking/create.test.ts`, `change.test.ts`, `authz.test.ts` (T-05) | 20 parallel creates on one slot, exactly 1 succeeds, 19 get 409. Back-to-back saves. Replay returns the same booking, running 409, other payload 422. Change onto a taken time keeps the original. Cancel frees the slot. Authz matrix for `booking.manage`: 404 other office, 403 same office |
| ui | `tests/ui/bookings-new.spec.ts`, `tests/ui/bookings.spec.ts` (T-04) | Five states at 375, 768, 1280. axe zero violations. Error summary focus. Inputs kept after 409. Keyboard submit |
| e2e | `tests/e2e/E-001/S06-book-room.spec.ts` (T-05) | One test per ID, ID first in the title: `E-001/AC-11`, `E-001/AC-12`, `E-001/AC-23`, `E-001/AC-24`, `E-001/AC-25`, `E-001/AC-26`, `E-001/AC-27`, `E-001/AC-28`, `E-001/AC-35`, `E-001/AC-36`, `E-001/AC-37`, `E-001/AC-38`, `E-001/AC-55`, `E-001/AC-78`, `E-001/AC-79`, `E-001/AC-82` |
| evals | None: no AI output. Speed is checked in E-001/S-13 | |
| load | None: the 20% "book" mix runs at epic release in `tests/load/E-001.js` | |

## 7. Docs
| Docs home | Change |
|---|---|
| `docs/manual/E-001-room-booking.md` | Add "Book, change or cancel a room": the rules and messages in plain words, who can change a booking |
| `docs/rules/` | Regenerated from `src/domain/booking/rules.ts` `@ears` tags |
| `docs/workflows/E-001-room-booking.md` | Employee journey: book, change, slot just taken |

## 8. Done
| Command | Expected output |
|---|---|
| `pnpm tsc --noEmit` | exit 0 |
| `pnpm lint` | exit 0, no warnings |
| `pnpm vitest run tests/unit/domain/booking tests/unit/data/booking.test.ts` | all pass |
| `pnpm vitest run tests/integration/booking` | all pass, race test 1 of 20 |
| `pnpm playwright test tests/ui/bookings-new.spec.ts tests/ui/bookings.spec.ts tests/e2e/E-001/S06-book-room.spec.ts` | all pass |
| `bash scripts/ci/check-auth-in-actions.sh` | PASS |
| `bash scripts/ci/check-test-tree.sh` | PASS |
| `bash scripts/ci/check-no-console.sh` | PASS |
| `git diff --exit-code origin/main -- prisma src/contracts` | exit 0 (no contract change) |

## Tasks
| Task | Type | Specialist | Section | Note |
|---|---|---|---|---|
| T-01 | contract | data-engineer | 3, 4 | None: reads contracts |
| T-02 | data | api-engineer | 4 | `src/data/booking.ts`: create, change and cancel in interactive tx with `FOR SHARE`, version guard, 23P01 mapping. Unit test |
| T-03 | api | api-engineer | 3, 5 | `src/domain/booking/rules.ts` with `@ears` tags, three actions with `requirePermission`, `scopeFor` and `withIdempotency`. Unit tests |
| T-04 | ui | ui-engineer | 2 | Three routes, five state files, `src/components/booking/**` incl. `cancel-booking-dialog.tsx`, copy table, both `tests/ui` specs. Excludes `actions.ts` |
| T-05 | tests | test-engineer | 6 | Integration tests incl. 20-way race, e2e spec, coverage check |
| T-06 | docs | test-engineer | 7 | Manual block, workflow steps, regenerate `docs/rules/` |
