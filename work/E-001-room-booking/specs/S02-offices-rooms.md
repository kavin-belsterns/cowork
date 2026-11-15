---
story: E-001/S-02
epic: E-001
ears: [E-001/AC-30, E-001/AC-31, E-001/AC-32, E-001/AC-34, E-001/AC-54, E-001/AC-81, E-001/AC-86]
owns:
  - src/data/office.ts
  - src/data/room.ts
  - src/domain/office/**
  - "src/app/(app)/admin/offices/**"
  - src/components/offices/**
  - tests/unit/data/office.test.ts
  - tests/unit/data/room.test.ts
  - tests/unit/domain/office/**
  - tests/integration/office/**
  - tests/ui/admin-offices.spec.ts
  - tests/e2e/E-001/S02-offices-rooms.spec.ts
depends_on: [E-001/S-00, E-001/S-01, E-001/S-14]
parallel: false
---

# Spec: E-001/S-02 Offices and rooms

## 1. Scope
EARS IDs covered:
- E-001/AC-30 an admin saves a room with name, size and floor, and it joins the office.
- E-001/AC-31 a duplicate room name in one office gets "A room with this name already exists in this office."
- E-001/AC-32 removing a room with future bookings is refused, and the bookings are listed.
- E-001/AC-34 office hours and booking times on these pages show in the office's own time zone.
- E-001/AC-54 each office stores an IANA time zone and opening hours per weekday.
- E-001/AC-81 a size cut below a future booking's attendee count lists those bookings and asks to confirm.
- E-001/AC-86 a missing name or floor, or a size below 1, shows an error at the field and saves nothing.

Also delivered: office create and rename (platform admin), unique office name, time zone change blocked while future bookings exist.

Out of scope:
- `office.hours` for office admins. It stays off until Open point 8 is signed.
- Deleting offices (design non-goal).
- Assigning office admins (E-001/S-03). Room CSV import (E-001/S-04). Free rooms view (E-001/S-05).

## 2. Page and UI
Routes:
- `/admin/offices`: office list and create (`office.manage`).
- `/admin/offices/[officeId]`: name, time zone, opening hours (`office.manage`).
- `/admin/offices/[officeId]/rooms`: room list. `.../rooms/new` and `.../rooms/[roomId]`: add, edit, remove (`room.manage`).
- The room list sits at the parent of the mapped room path, under the same `room.manage` key. Office admins reach it from "Office rooms" in the menu.

| State | Offices list | Office edit | Rooms list and room form |
|---|---|---|---|
| Loading | `loading.tsx`: table skeleton, 5 rows | Form skeleton with 7 hour rows | Table skeleton, 5 rows |
| Empty | "No offices yet. Create the first office." and "Create office" | Not used: the form always has fields | "No rooms in this office yet. Add a room." and "Add room" |
| Error | `error.tsx`: `internal` copy with reference id and "Try again". Forms: error summary takes focus, message at each field | Same | Same |
| Not found | "We could not find this item." and "Back to offices" | Same, for a missing or other-office id (AC-05) | Same, and a room id not in the office |
| Success | `role="status"`: "Office saved." | "Office saved." Hours shown as "08:00 to 20:00 IST" | "Room saved." or "Room removed." |

- Hours editor: one row per weekday with an "Open" checkbox and two 24-hour time fields in 15-minute steps. Unticked means closed. Zone short name beside every time.
- Time zone: a select of IANA zones, with the current zone's short name and offset.
- Remove: AlertDialog "Remove room <name>". If refused, the dialog lists each booking: date as "Mon 16 Nov 2026", time with zone short name, attendees.
- Size cut: a confirm panel lists the clashing bookings in the same shape. "Save new size" sends `confirmSizeCut`. Bookings stay as they are.

Breakpoints: 375 tables stack into cards, one-column forms, hour rows stack. 768 two-column forms, hours as a table. 1280 office form and hours side by side.

| Key | Text |
|---|---|
| offices.empty | No offices yet. Create the first office. |
| office.name_taken | An office with this name already exists. |
| office.zone_blocked | Move or cancel future bookings before changing the time zone. |
| office.hours_order | Closing time must be after opening time. |
| office.closed | Closed |
| office.save | Save office |
| rooms.empty | No rooms in this office yet. Add a room. |
| room.name_required | Enter a room name. |
| room.floor_required | Enter a floor. |
| room.size_min | Size must be at least 1. |
| room.name_taken | A room with this name already exists in this office. |
| room.remove_blocked | This room has future bookings. Move or cancel them first. |
| room.size_confirm | These future bookings have more people than the new size. Save anyway? |
| room.size_confirm_button | Save new size |
| room.save | Save room |
| version | Someone changed this. Reload to see it. |

## 3. API
| Endpoint or action | Request type | Response type | Errors (RFC 9457) |
|---|---|---|---|
| `createOfficeAction` in `src/app/(app)/admin/offices/actions.ts` | `src/contracts/office.ts: OfficeCreateInput` | `Office` | `validation` 400, `forbidden` 403, `rule-violation` 422 (name taken) |
| `updateOfficeAction` in `src/app/(app)/admin/offices/[officeId]/actions.ts` | `OfficeUpdateInput` | `Office` | `validation` 400, `forbidden` 403, `not-found` 404, `version-conflict` 409, `rule-violation` 422 (name taken, zone blocked) |
| `saveOfficeHoursAction` in the same file | `OfficeHoursInput` | `OfficeHours[]` | `validation` 400, `forbidden` 403, `not-found` 404, `version-conflict` 409 |
| `createRoomAction` in `src/app/(app)/admin/offices/[officeId]/rooms/actions.ts` | `src/contracts/room.ts: RoomInput` | `Room` | `validation` 400 (AC-86), `forbidden` 403, `not-found` 404, `rule-violation` 422 (AC-31) |
| `updateRoomAction` in the same file | `RoomUpdateInput` | `Room`, or a confirm result with `Booking[]` (AC-81) | As above, plus `version-conflict` 409 |
| `removeRoomAction` in the same file | `RoomRemoveInput` | None, then redirect to the room list | `forbidden` 403, `not-found` 404, `rule-violation` 422 with a `bookings` member of `Booking[]` (AC-32) |

- Each action parses first, then calls `requirePermission`, then `scopeFor` for the office.
- The AC-81 confirm result is an action-local union of S-00 DTOs: `{ kind: "confirm", bookings: Booking[] }`. No new contract.
- `[officeId]` and `[roomId]` are parsed with `Id` from `common.ts`.
- Idempotency: None. Office and room creates are guarded by the natural unique keys (api.md "When not"). Updates use `version`.
- Times format through `src/lib/time.ts` (S-00, ADR-0009). No public route, so no OpenAPI change.

## 4. Data
| Table | Reads | Writes | Indexes used | Transaction |
|---|---|---|---|---|
| offices | Q1 list by name. Q2 by id | Insert. Update name or `time_zone` with `version` | Unique `name`, PK | Yes, zone change |
| office_hours | Q1 by office | Replace the office's rows. No row means closed | PK `(office_id, weekday)` | Yes, with audit |
| rooms | Q1 live rooms of office. Q2 by id | Insert. Update with `version`. Remove sets `deleted_at` | Partial unique `(office_id, lower(name)) where deleted_at is null`, PK | Yes, remove and size cut |
| bookings | Q4 confirmed future bookings of a room, or of an office for a zone change | None | `(room_id, starts_at)` | Read inside the guard |
| audit_events | None | One row per change | None | Same tx (AC-50) |

- Time zone change: lock the office row, count confirmed future bookings, refuse if any. Invariant: no future booking shifts (ADR-0009, ADR-0012).
- Room removal: lock the room row, list confirmed future bookings, refuse if any, else set `deleted_at`. Invariant: no confirmed future booking on a removed room (AC-32, ADR-0012). Booking insert takes `FOR SHARE` on office and room (E-001/S-06).
- Size cut: lock the room row, list future bookings with `attendees` above the new size. Without `confirmSizeCut`, return the list and write nothing (AC-81).
- Every guarded write that changes 0 rows throws, so the audit row rolls back. `version` mismatch returns 409.
- A unique violation on room or office name maps to the AC-31 or name-taken copy in `src/data/room.ts` and `src/data/office.ts`. This holds under races.
- No new tables or columns.

## 5. Security
| Item | Value |
|---|---|
| Permission keys | `office.manage` (platform admin): offices list, create, rename, time zone, hours. `room.manage` (platform admin, office admin of office): room list, add, edit, remove. `office.hours` for office admin stays off (Open point 8) |
| Scope rule | `scopeFor(session, { officeId })` on every office and room read and write. Other office returns 404 (AC-05). Office admin on `/admin/offices` or office edit returns 403. A room id outside the URL office returns 404 |
| Boundary validation | `OfficeCreateInput`, `OfficeUpdateInput`, `OfficeHoursInput`, `RoomInput`, `RoomUpdateInput`, `RoomRemoveInput`, `Id`. Names max 120. Zone checked as IANA in `src/domain/office/rules.ts` |
| OWASP | A01 deny by default and office scope. A03 Prisma and tagged `$queryRaw` only. A04 guards inside transactions (ADR-0012) |
| Logging | Office id, room id, user id, action, result. Booking ids only in the refused list log |

## 6. Tests
| Kind | File path | Covers |
|---|---|---|
| unit | `tests/unit/domain/office/rules.test.ts` (T-03) | Hours order and 15-minute steps, IANA check, room field rules (AC-86), size cut list (AC-81), remove rule (AC-32), zone change rule |
| unit | `tests/unit/data/office.test.ts`, `tests/unit/data/room.test.ts` (T-02) | Unique violation to AC-31 copy, 0 rows to 409, soft delete filter |
| integration | `tests/integration/office/{offices,rooms,guards}.test.ts` (T-05) | Name unique ignoring case, reusable after removal. Remove races a `FOR SHARE` booking insert: one wins. Zone change blocked. Office admin 403 on offices, 404 on other office. `office.hours` off. Audit rows |
| ui | `tests/ui/admin-offices.spec.ts` (T-04) | Five states on each route at 375, 768, 1280. axe zero violations. Tab order. AlertDialog names the room. Confirm panel |
| e2e | `tests/e2e/E-001/S02-offices-rooms.spec.ts` (T-05) | One test per ID, ID first in the title: `E-001/AC-30`, `E-001/AC-31`, `E-001/AC-32`, `E-001/AC-34`, `E-001/AC-54`, `E-001/AC-81`, `E-001/AC-86`. Future bookings come from the test DB helper. AC-34 checks the `Asia/Kolkata` and `Europe/London` seed offices |
| evals | None: no AI output or performance NFR | |
| load | None: epic release in E-001/S-13 | |

## 7. Docs
| Docs home | Change |
|---|---|
| `docs/manual/E-001-room-booking.md` | Block "Set up offices and rooms": create an office, time zone and hours, add, edit and remove rooms, size cut confirm |
| `docs/rules/` | Regenerated from `src/domain/office/rules.ts` `@ears` tags |
| `docs/workflows/E-001-room-booking.md` | Journeys "Platform admin sets up the company" and "Office admin runs one office" (rooms steps) |

## 8. Done
| Command | Expected output |
|---|---|
| `pnpm tsc --noEmit` | exit 0 |
| `pnpm lint` | exit 0, no warnings |
| `pnpm vitest run tests/unit/domain/office tests/unit/data/office.test.ts tests/unit/data/room.test.ts` | all pass |
| `pnpm vitest run tests/integration/office` | all pass |
| `pnpm playwright test tests/ui/admin-offices.spec.ts tests/e2e/E-001/S02-offices-rooms.spec.ts` | all pass |
| `bash scripts/ci/check-auth-in-actions.sh` | PASS |
| `bash scripts/ci/check-test-tree.sh` | PASS |
| `bash scripts/ci/check-no-console.sh` | PASS |
| `bash scripts/ci/check-ac-coverage.sh` | PASS for the seven IDs |
| `git diff --exit-code origin/main -- prisma src/contracts` | exit 0 (no contract change) |

## Tasks
| Task | Type | Specialist | Section | Note |
|---|---|---|---|---|
| T-01 | contract | data-engineer | 3, 4 | None: reads contracts |
| T-02 | data | api-engineer | 4 | `src/data/office.ts`, `src/data/room.ts`: lists, versioned updates, zone and remove guards in interactive tx, size cut list. Unit tests |
| T-03 | api | api-engineer | 3, 5 | `src/domain/office/rules.ts` with `@ears` tags, the three `actions.ts` files. Unit tests |
| T-04 | ui | ui-engineer | 2 | Office and room pages, hours editor, AlertDialog, confirm panel, `tests/ui/admin-offices.spec.ts`. Excludes `actions.ts` |
| T-05 | tests | test-engineer | 6 | Integration tests, e2e spec, coverage check |
| T-06 | docs | test-engineer | 7 | Manual block, regenerate rules docs, workflow journeys |
