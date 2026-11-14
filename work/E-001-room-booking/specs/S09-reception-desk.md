---
story: E-001/S-09
epic: E-001
ears:
  - E-001/AC-20
  - E-001/AC-21
  - E-001/AC-22
  - E-001/AC-41
  - E-001/AC-42
  - E-001/AC-43
  - E-001/AC-44
  - E-001/AC-45
  - E-001/AC-46
  - E-001/AC-88
owns:
  - src/data/reception.ts
  - src/domain/reception/**
  - "src/app/(app)/reception/**"
  - src/components/reception/**
  - src/components/shell/arrival-banner.tsx
  - src/components/shell/page-shell.tsx
  - tests/unit/data/reception.test.ts
  - tests/unit/domain/reception/**
  - tests/integration/reception/**
  - tests/ui/reception.spec.ts
  - tests/ui/reception-badge.spec.ts
  - tests/e2e/E-001/S09-reception-desk.spec.ts
depends_on: [E-001/S-00, E-001/S-08]
parallel: false
---

# Spec: E-001/S-09 Reception desk

## 1. Scope
EARS IDs covered:
- E-001/AC-20 today view shows host name, phone and desk while a visitor is expected or checked in.
- E-001/AC-21 host sees an arrival banner on the next page load after check-in.
- E-001/AC-22 walk-in with a host creates the visit and checks it in.
- E-001/AC-41 check-in records the time and the receptionist.
- E-001/AC-42 second check-in is rejected with "Already checked in at HH:MM."
- E-001/AC-43 checked-in visitor gets a printable badge: visitor name, host name, office, date.
- E-001/AC-44 check-out records the time.
- E-001/AC-45 earlier-day visitor still checked in shows as "Not checked out".
- E-001/AC-46 today view shows today's bookings and visitors for the office.
- E-001/AC-88 check-out of a visitor not checked in is rejected with "This visitor is not checked in."

Reception rules live in `src/domain/reception/`, not `src/domain/visit/` as design.md lists, so S-08 files stay untouched.

Out of scope:
- Pre-register, my visits and host cancel (E-001/S-08).
- Booking a room for a guest. The desk links to `/rooms` (E-001/S-05, E-001/S-06).
- Badge printers and kiosks (epic non-goal). The badge is a browser print page.

## 2. Page and UI
Routes: `/reception`, `/reception/visits/new`, `/reception/visits/[visitId]`, `/reception/visits/[visitId]/badge`. Arrival banner in PageShell on every page.

| State | What the user sees |
|---|---|
| Loading | Today view: two skeleton tables (bookings, visitors). Visit page: card skeleton |
| Empty | Visitors: "No visitors expected today. Add a walk-in." with "Add walk-in". Bookings: "No rooms are booked today." |
| Error | `error.tsx`: `internal` copy with reference id and "Try again". Action errors in the error summary, focus moves to it |
| Not found | Other-office or missing visit: "We could not find this item." Link "Back to today" |
| Success | Check-in: badge page opens, host phone and desk shown. Check-out and walk-in: result in `role="status"` |

Today view: sections "Bookings today" and "Visitors". Visitor rows: name, company, host name, host phone, host desk, status label. Earlier-day checked-in rows sit first with "Not checked out". Search box filters by name through a POST action, never the URL.
Polling: refresh every 60 s, "Refresh" button, "Pause updates" toggle (WCAG 2.2.2). A refresh keeps focus and the search text.
Banner: inserted after hydration into a `role="status"` region. Several arrivals stack. Each has "Dismiss".
Badge: one per page, large visitor name, host name, office name, date as "Mon 16 Nov 2026", "Print badge" button. Print CSS hides the shell.
Menu (receptionist, office admin): Today, Add walk-in, Rooms, My bookings, History, Reports. Platform admin adds an office picker on the today view.

Breakpoints: 375 tables stack into cards, one column, buttons full width. 768 two-column walk-in form. 1280 bookings and visitors side by side.

Copy:
| Key | Text |
|---|---|
| title | Today at {officeName} |
| walkin_title | Add a walk-in visitor |
| walkin_submit | Check in visitor |
| host_label | Host |
| check_in / check_out | Check in / Check out |
| print | Print badge |
| refresh / pause / resume | Refresh / Pause updates / Resume updates |
| not_checked_out | Not checked out |
| status labels | Expected / Checked in / Checked out |
| already_in | Already checked in at HH:MM. |
| cancelled | This visit was cancelled. |
| left | This visitor left at HH:MM. |
| not_in | This visitor is not checked in. |
| banner | Your visitor {name as entered} has arrived at reception. |
| dismiss | Dismiss |

## 3. API
| Action (file) | Request schema | Response DTO | Errors (RFC 9457) |
|---|---|---|---|
| `checkInAction` (`src/app/(app)/reception/actions.ts`) | `src/contracts/visit.ts: CheckInInput` | `Visit`, then redirect to badge | `validation` 400, `unauthenticated` 401, `forbidden` 403, `not-found` 404, `rule-violation` 422 (three copies), `internal` 500 |
| `checkOutAction` (same file) | `CheckOutInput` | `Visit` | same set, `rule-violation` 422 with AC-88 copy or "This visitor left at HH:MM." |
| `walkInAction` (same file) | `WalkInInput` plus `IdempotencyKey` form field | `Visit` | same set, `request-in-progress` 409, `request-changed` 422 |
| `searchVisitsAction` (same file) | `VisitSearchInput` (POST body only) | `TodayView` | `validation`, `unauthenticated`, `forbidden` |
| `dismissArrivalAction` (same file, imported by PageShell) | `VisitSeenInput` | none, `revalidatePath` | `validation`, `unauthenticated`, `forbidden` |
| Today view page read | `[officeId]` searchParam for platform admin: `common.ts: Id` | `TodayView` | `not-found` 404 |
| Visit and badge page read | `[visitId]`: `Id` | `Visit` | `not-found` 404 |
| PageShell read | session only | `ArrivalNotice[]` | none, banner hidden on failure |

- Every action: zod parse, `requirePermission(session, 'visit.desk')` (or `'visit.seen'`), then `scopeFor`.
- Check-in 0 rows: re-read the visit in office scope. Checked in gives AC-42 copy. Cancelled gives "This visit was cancelled." Checked out gives "This visitor left at HH:MM." Missing gives 404.
- Walk-in idempotency: `withIdempotency()`, key scope `(user_id, 'visit.walk-in', key)`, 24 h. Check-in and check-out need no key: the status guard makes a repeat fail safely.
- Host picker: `HostOption` from S-03 `src/components/host-picker/`, scoped to the visit office.
- Contract: `BadgeView` (visitor name, host name, office name, date) is in S-00 for the badge (AC-43).
- No public HTTP route. No OpenAPI change.

## 4. Data
| Table | Reads | Writes | Indexes used | Transaction |
|---|---|---|---|---|
| visits | Q1 today by office. Q5 earlier days still checked in. Q3 unseen arrivals by host. Re-read by id and office | Check-in: `UPDATE ... WHERE id, office_id, status = 'expected'` sets `status`, `checked_in_at`, `checked_in_by`. Check-out: `WHERE id, office_id, status = 'checked_in'` sets `checked_out_at`. Walk-in insert as checked in. Dismiss sets `host_seen_at` `WHERE id, host_id` | `(office_id, visit_date)`, partial `(office_id) where status = 'checked_in'`, partial `(host_id) where host_seen_at is null and status = 'checked_in'`, FK `checked_in_by` | Yes, one per write: guarded update or insert plus audit row (AC-50). 0 rows throws so the audit rolls back |
| bookings | Today's confirmed bookings of the office rooms (AC-46) | None | `(room_id, starts_at)` | No |
| rooms | Live rooms of the office | None | `(office_id, lower(name))` partial unique | No |
| users | Host name, phone, desk by id (AC-20) | None | PK | No |
| audit_events | None | Insert per write, visitor by id only | None | In the write tx |
| idempotency_keys | Walk-in key | Claim running, mark done, delete after failure | unique `(user_id, scope, key)` | Separate from the visit tx |

Dismiss with 0 rows (already dismissed) rolls back and returns ok. No new tables or columns.

## 5. Security
| Item | Value |
|---|---|
| Permission keys | `visit.desk`: receptionist and office admin of office, platform admin. `visit.seen`: host only |
| Scope | `scopeFor(session, visit)`: `visit.office_id` equals caller office, else 404 (AC-05). Platform admin any office. `visit.seen` matches `host_id` |
| Boundary validation | `CheckInInput`, `CheckOutInput`, `WalkInInput`, `VisitSearchInput`, `VisitSeenInput`, `Id`, `IdempotencyKey` |
| Personal data | Host phone only in `visit.desk` views. No visitor name in any URL. `Cache-Control: no-store` on all `/reception` pages and the badge |
| OWASP | A01: permission in every action, office-scoped update. A03: zod plus Prisma, no raw string SQL. A04: status guard in the UPDATE stops double check-in races |
| Logging | Visit id, user id, office id, result. Never visitor or host names, phones, desks |

## 6. Tests
| Kind | File path | Covers |
|---|---|---|
| unit | `tests/unit/domain/reception/rules.test.ts` (T-03), `tests/unit/data/reception.test.ts` (T-02) | 0-row mapping to the three copies and 404, Not checked out rule, banner text, today window in office zone |
| integration | `tests/integration/reception/{check-in,check-out,walk-in,today,arrival}.test.ts` (T-05) | Two parallel check-ins, one wins, other gets AC-42. Other office 404. Employee 403. Audit row per write. Walk-in replay. Dismiss by non-host changes nothing |
| ui | `tests/ui/reception.spec.ts`, `tests/ui/reception-badge.spec.ts` (T-04) | Five states at 375, 768, 1280. axe zero violations. Pause control. Focus kept on refresh. Banner in `role="status"` |
| e2e | `tests/e2e/E-001/S09-reception-desk.spec.ts` (T-05) | One test per ID, ID first: `E-001/AC-20`, `E-001/AC-21`, `E-001/AC-22`, `E-001/AC-41`, `E-001/AC-42`, `E-001/AC-43`, `E-001/AC-44`, `E-001/AC-45`, `E-001/AC-46`, `E-001/AC-88` |
| evals | None: no AI or performance NFR in this story | |
| load | None: today view is in the S-13 k6 mix | |

## 7. Docs
| Docs home | Change |
|---|---|
| `docs/manual/E-001-room-booking.md` | Block "Run the reception desk": today view, walk-in, check in and out, badge, the four error messages |
| `docs/rules/` | Regenerated from `src/domain/reception/rules.ts` `@ears` tags |
| `docs/workflows/E-001-room-booking.md` | Receptionist journey and host arrival banner |

## 8. Done
| Command | Expected output |
|---|---|
| `pnpm tsc --noEmit` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm vitest run tests/unit/domain/reception tests/unit/data/reception.test.ts tests/integration/reception` | all pass |
| `pnpm playwright test tests/ui/reception.spec.ts tests/ui/reception-badge.spec.ts tests/e2e/E-001/S09-reception-desk.spec.ts` | all pass |
| `bash scripts/ci/check-auth-in-actions.sh` | PASS |
| `bash scripts/ci/check-test-tree.sh` | PASS |
| `bash scripts/ci/check-no-console.sh` | PASS |
| `git diff --exit-code origin/main -- prisma src/contracts` | exit 0 |

## Tasks
| Task | Type | Specialist | Section | Note |
|---|---|---|---|---|
| T-01 | contract | data-engineer | 3, 4 | None: reads contracts |
| T-02 | data | api-engineer | 4 | `src/data/reception.ts`: today reads, guarded updates, walk-in insert, arrivals. Unit test |
| T-03 | api | api-engineer | 3, 5 | `src/domain/reception/rules.ts` with `@ears` tags and `actions.ts` (five actions). Unit tests |
| T-04 | ui | ui-engineer | 2 | Four pages, polling, badge print, banner, PageShell mount, two ui specs. Excludes `actions.ts` |
| T-05 | tests | test-engineer | 6 | Integration, e2e, coverage check |
| T-06 | docs | test-engineer | 7 | Manual block, workflow, regenerate rules docs |
