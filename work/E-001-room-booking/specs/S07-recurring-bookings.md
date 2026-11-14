---
story: E-001/S-07
epic: E-001
ears: [E-001/AC-74, E-001/AC-75, E-001/AC-76, E-001/AC-77]
owns:
  - src/data/series.ts
  - src/domain/series/**
  - "src/app/(app)/bookings/series/**"
  - "src/app/(app)/bookings/new/**"
  - src/components/booking/**
  - tests/unit/data/series.test.ts
  - tests/unit/domain/series/**
  - tests/integration/series/**
  - tests/ui/bookings-series.spec.ts
  - tests/e2e/E-001/S07-recurring-bookings.spec.ts
depends_on: [E-001/S-00, E-001/S-06]
parallel: false
---

# Spec: E-001/S-07 Recurring bookings

## 1. Scope
EARS IDs covered:
- E-001/AC-74 a daily or weekly repeat creates one booking per date in the series.
- E-001/AC-75 "A series can run up to 90 days ahead."
- E-001/AC-76 free dates are booked and clashing dates are listed.
- E-001/AC-77 cancelling a series booking offers "this date only" or "all future dates".

Boundary: the last allowed until date is today plus 90 days in the office zone. AC-25 and AC-75 reject only "more than 90 days ahead". A daily series in a seven-day office then holds at most 91 dates. The EARS lines rule over the 90-row estimate in design.md.

Out of scope:
- Single booking rules and actions (E-001/S-06). This story imports `src/domain/booking/rules.ts` and does not edit it.
- Monthly repeats (epic out of scope).
- Changing the time of a whole series. Each date is changed on its own at `/bookings/[bookingId]` (E-001/S-06).

## 2. Page and UI
Routes: Repeat on `/bookings/new`, which continues into the series flow. Series page `/bookings/series/[seriesId]`.

| State | What the user sees |
|---|---|
| Loading | `loading.tsx` on the series page: heading skeleton, then date row skeletons |
| Empty | 0 booked: "No dates were free. Nothing was booked." above the full clash list. No future dates left: "This series has no upcoming dates." Link "Back to my bookings" |
| Error | Form error summary takes focus. Inputs stay. `error.tsx`: `internal` copy with reference id and Retry |
| Not found | Missing or other-office series: "We could not find this item." Link "Back to my bookings" |
| Success | Redirect to `/bookings/series/[seriesId]`. A `role="status"` region says "N dates booked." Clashes and closed days follow as lists |

Form and page rules:
- `/bookings/new` gets a "Repeat" checkbox. Ticked, it shows "Daily" or "Weekly" radios and an "Until" date. Submit then calls `createSeriesAction`.
- The series page lists each date: date, time with zone short name, room, status text. Each confirmed future date has a Cancel button.
- Clashes list: "Already booked: <date>". Closed days list: "This office is closed on <date>." Dates use the "Mon 16 Nov 2026" form.
- Cancel opens an AlertDialog named "Cancel booking for <room> on <date>" with two choices. S-07 extends `src/components/booking/cancel-booking-dialog.tsx` so a booking with a series offers both. A single booking keeps the S-06 dialog.
- Submit is disabled while pending. Fields use `aria-describedby`.

Breakpoints: 375 one column, date rows stack into cards, dialog buttons full width. 768 two-column form (pattern, until). 1280 series dates as a table beside the summary.

Copy:
| Key | Text |
|---|---|
| repeat | Repeat |
| daily | Daily |
| weekly | Weekly |
| until | Until |
| submit | Book series |
| booked | N dates booked. |
| none_free | No dates were free. Nothing was booked. |
| clash_heading | These dates were already booked |
| clash_row | Already booked: <date> |
| closed_heading | Skipped because the office is closed |
| closed_row | This office is closed on <date>. |
| too_far | A series can run up to 90 days ahead. |
| cancel_one | Cancel this date only |
| cancel_future | Cancel this and all future dates |
| cancelled | Booking cancelled. / N bookings cancelled. |

## 3. API
| Endpoint or action | Request type | Response type | Errors (RFC 9457) |
|---|---|---|---|
| `createSeriesAction` in `src/app/(app)/bookings/series/actions.ts`, form field `idempotencyKey` | `src/contracts/series.ts: SeriesCreateInput`, key as `common.ts: IdempotencyKey` | `SeriesResult` (booked, clashes, closedDays), then redirect | `validation` 400, `unauthenticated` 401, `not-found` 404, `request-in-progress` 409, `request-changed` 422, `rule-violation` 422 |
| `cancelSeriesAction` in `src/app/(app)/bookings/series/[seriesId]/actions.ts` | `SeriesCancelInput` (scope one or future) | `Booking[]` cancelled | 401, `forbidden` 403, 404, `version-conflict` 409 |

Create flow:
1. Parse with `SeriesCreateInput`, then `requirePermission(session, 'booking.create')`.
2. `withIdempotency()` claims scope `(user_id, 'series.create', key)` as running. Same rules as S-06. TTL 24 h. Delete the key after any failure.
3. Rules on the first date reuse S-06 booking rules: steps, past, 1 day, size, hours.
4. `src/domain/series/rules.ts` expands dates in the office zone, skips closed weekdays and lists them, rejects an until date past the boundary (AC-75), asserts at most 90 rows, and checks the time fits the hours of every open weekday used. A misfit returns the AC-55 copy for that weekday.
5. Insert in one transaction (section 4). 0 booked is a success, not an error.

- `[seriesId]` is parsed with `Id`. Cancel runs `requirePermission(session, 'booking.manage')` with the same rule per series.
- Wall-clock time is kept across a DST change. Each date is turned into UTC on its own (ADR-0009).
- Rules are pure with `@ears` tags. No Prisma, no `next/*`.
- No public HTTP route, so no OpenAPI change.
- Contract gap: none.

## 4. Data
| Table | Reads | Writes | Indexes used | Transaction |
|---|---|---|---|---|
| idempotency_keys | by `(user_id, scope, key)` | insert running, done with response (ids only), delete on failure | unique `(user_id, scope, key)` | Claim before the tx. Done inside it |
| offices, rooms | by id, `FOR SHARE` | None | PK | Yes (ADR-0012) |
| office_hours | all weekdays of the office | None | PK `(office_id, weekday)` | No |
| booking_series | Q1 by id | insert `pattern`, `until_date` | PK, `owner_id`, `room_id` | Yes |
| bookings | Q1 by series with dates | multi-row insert. Cancel sets `status = 'cancelled'` | exclusion constraint, FK `series_id` | Yes |
| audit_events | None | one row for the series, one per booked or cancelled date | None | Yes, same tx |

Series create, per the design transactions table (AC-76):
- One tx. `FOR SHARE` on office and room. Insert the series row.
- One `INSERT ... SELECT unnest(dates) ON CONFLICT DO NOTHING RETURNING` by `$queryRaw` tagged template. Rows that hit the exclusion constraint are skipped, not raised.
- Returned rows are booked. Expanded dates minus returned rows are the clashes.
- This is the one guarded write that does not throw on 0 rows. On 0 booked, the series row is deleted in the same tx and no booking audit row is written. The key is still marked done with the result.

Series cancel: one tx. Scope one: `updateMany where id, version, status = 'confirmed'`. Scope future: all confirmed bookings of the series with `starts_at` at or after the picked date and after now. 0 rows on scope one throws `version-conflict`. Cancelled rows stay. No new tables or columns.

## 5. Security
| Item | Value |
|---|---|
| Roles allowed | Create: all four roles, any office (`booking.create`). Cancel: `booking.manage`, same rule per series |
| Permission check | `requirePermission` first in each action, after the zod parse |
| Record scope | `scopeFor(session, series)`: owner at any office. Office staff by `room.office_id`. Other office 404. Same office without the right 403 |
| Boundary validation | `SeriesCreateInput`, `SeriesCancelInput`, `IdempotencyKey`, `Id` for `[seriesId]`. All strict |
| OWASP items | A01 per-series scope. A03 zod plus `$queryRaw` tagged template, no `$queryRawUnsafe`. A04 overlap held by the constraint. Row cap 90 stops a large insert |
| Logging | Series result with user id, series id, booked and clash counts. No names |

## 6. Tests
| Kind | File path | Covers |
|---|---|---|
| unit | `tests/unit/domain/series/rules.test.ts` (T-03) | Daily and weekly expansion, closed days skipped and listed, boundary day 90 ok and day 91 rejected, 91-date cap, hours per weekday, DST wall clock kept |
| unit | `tests/unit/data/series.test.ts` (T-02) | Returned rows split into booked and clashes, 0 rows deletes the series row, scope future filter |
| integration | `tests/integration/series/create.test.ts`, `cancel.test.ts` (T-05) | Series of 10 with 2 pre-booked dates books 8 and lists 2. All dates taken returns 0 booked and no series row. Replay returns the same result. Cancel one keeps the rest. Cancel future keeps earlier dates. Authz 404 and 403 |
| ui | `tests/ui/bookings-series.spec.ts` (T-04) | Five states at 375, 768, 1280. axe zero violations. Repeat fields show on tick. Cancel dialog has both choices by keyboard |
| e2e | `tests/e2e/E-001/S07-recurring-bookings.spec.ts` (T-05) | One test per ID, ID first in the title: `E-001/AC-74`, `E-001/AC-75`, `E-001/AC-76`, `E-001/AC-77` |
| evals | None: no AI output | |
| load | None: epic release only in `tests/load/E-001.js` | |

## 7. Docs
| Docs home | Change |
|---|---|
| `docs/manual/E-001-room-booking.md` | Add "Repeat a booking": daily or weekly, 90-day limit, clashes and closed days, cancel one or all future |
| `docs/rules/` | Regenerated from `src/domain/series/rules.ts` `@ears` tags |
| `docs/workflows/E-001-room-booking.md` | Employee journey: tick Repeat, series clashes listed |

## 8. Done
| Command | Expected output |
|---|---|
| `pnpm tsc --noEmit` | exit 0 |
| `pnpm lint` | exit 0, no warnings |
| `pnpm vitest run tests/unit/domain/series tests/unit/data/series.test.ts` | all pass |
| `pnpm vitest run tests/integration/series` | all pass |
| `pnpm playwright test tests/ui/bookings-series.spec.ts tests/ui/bookings-new.spec.ts tests/e2e/E-001/S07-recurring-bookings.spec.ts` | all pass |
| `bash scripts/ci/check-auth-in-actions.sh` | PASS |
| `bash scripts/ci/check-test-tree.sh` | PASS |
| `bash scripts/ci/check-no-console.sh` | PASS |
| `git diff --exit-code origin/main -- prisma src/contracts` | exit 0 (no contract change) |

## Tasks
| Task | Type | Specialist | Section | Note |
|---|---|---|---|---|
| T-01 | contract | data-engineer | 3, 4 | None: reads contracts |
| T-02 | data | api-engineer | 4 | `src/data/series.ts`: multi-row insert with ON CONFLICT DO NOTHING, 0-row path, cancel one or future. Unit test |
| T-03 | api | api-engineer | 3, 5 | `src/domain/series/rules.ts` with `@ears` tags, both actions with `requirePermission`, `scopeFor`, `withIdempotency`. Unit tests |
| T-04 | ui | ui-engineer | 2 | Repeat fields on `/bookings/new`, series page and state files, series cancel dialog in `src/components/booking/**`, `tests/ui/bookings-series.spec.ts`. Excludes `actions.ts` |
| T-05 | tests | test-engineer | 6 | Integration tests, e2e spec, coverage check. Rerun `tests/ui/bookings-new.spec.ts` |
| T-06 | docs | test-engineer | 7 | Manual block, workflow steps, regenerate `docs/rules/` |
