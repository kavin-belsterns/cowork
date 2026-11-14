---
story: E-001/S-11
epic: E-001
ears:
  - E-001/AC-08
  - E-001/AC-53
  - E-001/AC-90
owns:
  - src/data/report.ts
  - src/domain/report/**
  - "src/app/(app)/reports/**"
  - src/components/reports/**
  - tests/unit/data/report.test.ts
  - tests/unit/domain/report/**
  - tests/integration/report/**
  - tests/ui/reports.spec.ts
  - tests/e2e/E-001/S11-weekly-reports.spec.ts
depends_on: [E-001/S-00, E-001/S-06, E-001/S-09]
parallel: true
---

# Spec: E-001/S-11 Weekly reports

## 1. Scope
EARS IDs covered:
- E-001/AC-08 each weekly report is built from live data when the page opens.
- E-001/AC-53 room use equals booked hours divided by the office's open hours for the week.
- E-001/AC-90 the report shows the number of visitors per office per day.

Also cited: E-001/AC-06, an employee who opens `/reports` gets 403. S-03 owns the ID at permission level.

Out of scope:
- Charts. Data tables only, so nothing is chart-only.
- Export, email or scheduled reports. Not in the epic.
- Stored or cached report tables. The design has none (AC-08).

## 2. Page and UI
Route: `/reports` with searchParams `office` (platform admin only) and `week` (ISO date of the Monday).

| State | What the user sees |
|---|---|
| Loading | Two table skeletons: "Room use" and "Visitors" |
| Empty | No live rooms: "This office has no rooms yet. Add rooms in Offices." Visitors table always shows seven days, 0 where none |
| Error | `error.tsx`: `internal` copy with reference id and "Try again" |
| Not found | Other-office `office` id: "We could not find this item." Link "Back to my office report" |
| Success | Heading with the week, "Room use" table, "Visitors" table, Previous week and Next week links |

Room use table: Room, Size, Booked hours, Open hours, Use. Use shows a whole percent, for example "42%". A room in an office closed all week shows "Closed all week" and no percent.
Visitors table: one row per day, Mon to Sun, date as "Mon 16 Nov 2026", count of checked-in visitors. Anonymised visits count (AC-18). A total row ends the table.
Each table has a `<caption>` and `scope` on header cells. No colour carries meaning.
Platform admin sees an office picker (a select, default the first office by name). Office admin and receptionist see their own office only.
Menu: Reports sits in the role menu for platform admin, office admin and receptionist. Employees never see the link.

Breakpoints: 375 rows stack into cards, one column. 768 both tables full width, one under the other. 1280 the two tables side by side.

Copy:
| Key | Text |
|---|---|
| title | Weekly report: {officeName} |
| week | Week of {Mon 16 Nov 2026} |
| prev / next | Previous week / Next week |
| room_table | Room use |
| visitor_table | Visitors per day |
| closed_week | Closed all week |
| total | Total |
| forbidden | You do not have access to this. |

## 3. API
| Read (file) | Request schema | Response DTO | Errors (RFC 9457) |
|---|---|---|---|
| Page read in `src/app/(app)/reports/page.tsx` | `src/contracts/report.ts: ReportQuery` (office, ISO week start) | `WeeklyReport` (raw minutes and counts), ratio added by `src/domain/report/rules.ts` | `validation` 400, `unauthenticated` 401, `forbidden` 403, `not-found` 404, `internal` 500 |

- The page parses searchParams with `ReportQuery`, calls `requirePermission(session, 'report.view')`, then `scopeFor`.
- No server action: the page is a read and the week and office links are plain GET links. Only ids and a date are in the URL, no personal data.
- Live data (AC-08): the page renders per request with no cache. It calls `connection()` before the query so Next.js never prerenders it.
- `src/domain/report/rules.ts` holds the week bounds in the office zone (ADR-0009), the use ratio, the rounding and the closed-week case. SQL returns only raw minutes and counts.
- Idempotency: None: read only.
- No public HTTP route. No OpenAPI change.

## 4. Data
| Table | Reads | Writes | Indexes used | Transaction |
|---|---|---|---|---|
| bookings | Q1 shape by `$queryRaw`: sum of confirmed minutes per room, each booking clipped to the week, `status = 'confirmed'` | None | `(room_id, starts_at)` | No |
| rooms | Live rooms of the office, plus removed rooms with a confirmed booking in the week | None | partial unique `(office_id, lower(name))`, PK | No |
| office_hours | Hours per weekday for the office | None | PK `(office_id, weekday)` | No |
| offices | Zone and name by id | None | PK | No |
| visits | Q2 checked-in visits per `visit_date` for the week: `checked_in_at is not null`, anonymised included | None | `(office_id, visit_date)` | No |

- Open minutes come from `office_hours` times each weekday in the week. No row means closed (0).
- Week bounds are local Monday 00:00 to next Monday 00:00 in the office zone, turned into UTC instants. A DST week has 167 or 169 hours. The SQL takes the two instants.
- Cancelled bookings are kept (AC-57) and excluded from booked minutes.
- No transaction: reads only. All reads run in one request, so one page view sees one moment closely enough for a weekly total.
- No new tables or columns.

## 5. Security
| Item | Value |
|---|---|
| Permission key | `report.view`: platform admin all offices, office admin and receptionist of office. Employee 403 (AC-06) |
| Scope | `scopeFor(session, office)`: office admin and receptionist get their own office. Any other `office` id gives 404 (AC-05) |
| Boundary validation | `ReportQuery`: `office` as `Id`, `week` as an ISO date that must be a Monday |
| Personal data | Counts only. No visitor names. No personal data in the URL |
| OWASP | A01: permission and office scope on the page read. A03: `$queryRaw` tagged template only, `$queryRawUnsafe` banned |
| Logging | Request summary with user id, office id, week, duration. No row contents |

## 6. Tests
| Kind | File path | Covers |
|---|---|---|
| unit | `tests/unit/domain/report/rules.test.ts` (T-03), `tests/unit/data/report.test.ts` (T-02) | Ratio and rounding (E-001/AC-53), zero open minutes, week bounds in `Asia/Kolkata` and `Europe/London` across the October fall-back week, Monday check |
| integration | `tests/integration/report/{room-use,visitors,scope}.test.ts` (T-05) | Booking clipped at week edges. Cancelled excluded. Anonymised visit counted. Expected-only visit not counted. Other office 404. Employee 403 |
| ui | `tests/ui/reports.spec.ts` (T-04) | Five states at 375, 768, 1280. axe zero violations. Table captions and header scope |
| e2e | `tests/e2e/E-001/S11-weekly-reports.spec.ts` (T-05) | One test per ID, ID first: `E-001/AC-08` book a room, reload, booked hours rise. `E-001/AC-53` seeded week shows the expected percent. `E-001/AC-90` check in a visitor, today's count rises by 1. `E-001/AC-06` employee gets 403 |
| evals | None: no AI or performance NFR | |
| load | None: reports are 5% of the S-13 k6 mix | |

## 7. Docs
| Docs home | Change |
|---|---|
| `docs/manual/E-001-room-booking.md` | Block "Read the weekly report": what room use means, which visitors count, closed weeks |
| `docs/rules/` | Regenerated from `src/domain/report/rules.ts` `@ears` tags |
| `docs/workflows/E-001-room-booking.md` | None: no journey step changes |

## 8. Done
| Command | Expected output |
|---|---|
| `pnpm tsc --noEmit` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm vitest run tests/unit/domain/report tests/unit/data/report.test.ts tests/integration/report` | all pass |
| `pnpm playwright test tests/ui/reports.spec.ts tests/e2e/E-001/S11-weekly-reports.spec.ts` | all pass |
| `bash scripts/ci/check-auth-in-actions.sh` | PASS |
| `bash scripts/ci/check-test-tree.sh` | PASS |
| `bash scripts/ci/check-no-console.sh` | PASS |
| `git diff --exit-code origin/main -- prisma src/contracts` | exit 0 |

## Tasks
| Task | Type | Specialist | Section | Note |
|---|---|---|---|---|
| T-01 | contract | data-engineer | 3, 4 | None: reads contracts |
| T-02 | data | api-engineer | 4 | `src/data/report.ts`: booked minutes raw SQL, open hours, visitor counts. Unit test |
| T-03 | api | api-engineer | 3, 5 | `src/domain/report/rules.ts` with `@ears` tags. No `actions.ts`: the page read calls `requirePermission`. Unit tests |
| T-04 | ui | ui-engineer | 2 | Page, two tables, week links, office picker, five states, `tests/ui/reports.spec.ts` |
| T-05 | tests | test-engineer | 6 | Integration, e2e, coverage check |
| T-06 | docs | test-engineer | 7 | Manual block, regenerate rules docs |
