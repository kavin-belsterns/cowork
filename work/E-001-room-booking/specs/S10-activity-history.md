---
story: E-001/S-10
epic: E-001
ears:
  - E-001/AC-50
  - E-001/AC-51
  - E-001/AC-52
  - E-001/AC-57
owns:
  - src/data/history.ts
  - src/domain/history/**
  - "src/app/(app)/history/**"
  - src/components/history/**
  - tests/unit/data/history.test.ts
  - tests/unit/domain/history/**
  - tests/integration/history/**
  - tests/ui/history.spec.ts
  - tests/e2e/E-001/S10-activity-history.spec.ts
depends_on: [E-001/S-00, E-001/S-01]
parallel: true
---

# Spec: E-001/S-10 Activity history

## 1. Scope
EARS IDs covered:
- E-001/AC-50 each create, change or cancel shows in history with actor, action, item and time.
- E-001/AC-51 no history entry can be edited or deleted.
- E-001/AC-52 visitors appear by record ID, never by name.
- E-001/AC-57 a cancelled booking stays, with status "cancelled", and shows in history.

Also cited: E-001/AC-06, an employee who opens `/history` gets 403. S-03 owns the ID at permission level.

History is append only and read only. Each story writes its own audit rows through `src/lib/audit.ts` (S-00). This story reads and shows them.

Out of scope:
- Writing audit rows. Each story does it in its own transaction.
- Retention and archive (Open point 7, pending the signer).
- Search, filter and export. Not in the epic.

## 2. Page and UI
Route: `/history`

| State | What the user sees |
|---|---|
| Loading | Table skeleton, ten rows |
| Empty | "No activity yet. Actions on rooms, bookings, users and visits show here." |
| Error | `error.tsx`: `internal` copy with reference id and "Try again" |
| Not found | Bad or stale cursor: "We could not find this item." Link "Back to latest" (drops the cursor) |
| Success | Table newest first. Columns: When, Who, Action, Item. "Show older" loads the next 100 |

Rows read as plain sentences. Who is the actor name, or "Nightly job" for the `system` principal. Action is a plain verb. Item is the record type and short reference.
Visitor items show "Visitor V-3F2A": "V-" plus the last 4 hex characters of the visit id, upper case. The id tail is random in uuid v7, the head is a timestamp. If the visit is anonymised the row adds "Visitor details removed".
Times in 24-hour form in the office zone. Platform admin view spans offices, so each time shows the zone short name and an Office column.
Menu: History sits in the role menu for platform admin, office admin and receptionist. Employees never see the link.

Breakpoints: 375 rows stack into cards (When, then the sentence). 768 table with four columns. 1280 table plus Office column for platform admin.

Copy:
| Key | Text |
|---|---|
| title | Activity history |
| older | Show older |
| system_actor | Nightly job |
| verbs | created, changed, cancelled, removed, deactivated, checked in, checked out, anonymised, failed |
| visitor_ref | Visitor V-{last4} |
| anonymised | Visitor details removed |
| forbidden | You do not have access to this. |

## 3. API
| Action or read (file) | Request schema | Response DTO | Errors (RFC 9457) |
|---|---|---|---|
| Page read in `src/app/(app)/history/page.tsx` | `src/contracts/history.ts: HistoryQuery` (cursor, `limit` 1 to 100 from `common.ts: PageQuery`) | `AuditEventView[]` plus next `Cursor` | `validation` 400, `unauthenticated` 401, `forbidden` 403, `internal` 500 |
| `loadOlderAction` (`src/app/(app)/history/actions.ts`) | `HistoryQuery` | `AuditEventView[]` plus next `Cursor` | same set |

- Both reads: zod parse, `requirePermission(session, 'history.view')`, then scope.
- No write action exists. There is no edit or delete control (AC-51).
- Cursor pagination on `(at, id)` with `id` as the unique tiebreaker. Limit 100. A cursor that fails `Cursor` parse gives 400 and the not found state.
- `AuditEventView` carries the short visitor reference and plain verb. The mapping lives in `src/domain/history/rules.ts`.
- Idempotency: None: read only.
- No public HTTP route. No OpenAPI change.

## 4. Data
| Table | Reads | Writes | Indexes used | Transaction |
|---|---|---|---|---|
| audit_events | Q1 office history newest first. Q2 all offices for platform admin. `where (at, id) < cursor order by at desc, id desc limit 101` | None | Q1 `(office_id, at desc, id desc)`. Q2 `(at desc, id desc)` | No: one read |
| users | Actor name by id. Deactivated users still show (AC-56) | None | PK | No |
| visits | `anonymised_at` by id for visitor items on the page | None | PK | No |
| bookings | None: status comes from the audit row | None | None | No |

Append only is held in the database (S-00): a trigger raises on UPDATE, DELETE and TRUNCATE, and `app_web` has INSERT and SELECT only (AC-51).
Fetch 101 rows to know if an older page exists. Return 100. No new tables or columns.

## 5. Security
| Item | Value |
|---|---|
| Permission key | `history.view`: platform admin all offices, office admin and receptionist of office. Employee 403 (AC-06) |
| Scope | `scopeFor(session, auditEvent)`: `audit_events.office_id` equals caller office. Rows with null `office_id` show to platform admin only |
| Boundary validation | `HistoryQuery`, `PageQuery`, `Cursor` |
| Personal data | Visitors by short id only (AC-52). No visitor name, email, phone or company in `AuditEventView`. No personal data in the URL: the cursor holds time and id only |
| OWASP | A01: permission in page and action, office filter in SQL. A09: history is tamper proof by trigger and grants |
| Logging | Request summary with user id and row count. No row contents |

## 6. Tests
| Kind | File path | Covers |
|---|---|---|
| unit | `tests/unit/domain/history/rules.test.ts` (T-03), `tests/unit/data/history.test.ts` (T-02) | Visitor reference from id tail, verb map, anonymised note, event shape has no personal data keys (E-001/AC-52), cursor encode and decode |
| integration | `tests/integration/history/{list,append-only,scope}.test.ts` (T-05) | Ties on `at` page with no gaps or repeats. UPDATE, DELETE, TRUNCATE as `app_web` fail (E-001/AC-51). Office admin sees own office only. Employee 403. `limit=101` gives 400 |
| ui | `tests/ui/history.spec.ts` (T-04) | Five states at 375, 768, 1280. axe zero violations. "Show older" by keyboard |
| e2e | `tests/e2e/E-001/S10-activity-history.spec.ts` (T-05) | One test per ID, ID first: `E-001/AC-50` admin creates a user, row shows. `E-001/AC-51` no edit or delete control, forged UPDATE fails. `E-001/AC-52` arrange writes one audit row for a seed visit through `src/lib/audit.ts`, page shows "Visitor V-" and no visitor name. `E-001/AC-57` arrange inserts one future booking for a seed employee, deactivation cancels it, history shows "cancelled", booking row keeps status cancelled. `E-001/AC-06` employee gets 403 |
| evals | None: no AI or performance NFR | |
| load | None: history is outside the k6 mix | |

## 7. Docs
| Docs home | Change |
|---|---|
| `docs/manual/E-001-room-booking.md` | Block "Read the activity history": who sees what, how visitors show, why nothing can be edited |
| `docs/rules/` | Regenerated from `src/domain/history/rules.ts` `@ears` tags |
| `docs/workflows/E-001-room-booking.md` | None: no journey step changes |

## 8. Done
| Command | Expected output |
|---|---|
| `pnpm tsc --noEmit` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm vitest run tests/unit/domain/history tests/unit/data/history.test.ts tests/integration/history` | all pass |
| `pnpm playwright test tests/ui/history.spec.ts tests/e2e/E-001/S10-activity-history.spec.ts` | all pass |
| `bash scripts/ci/check-auth-in-actions.sh` | PASS |
| `bash scripts/ci/check-test-tree.sh` | PASS |
| `bash scripts/ci/check-no-console.sh` | PASS |
| `git diff --exit-code origin/main -- prisma src/contracts` | exit 0 |

## Tasks
| Task | Type | Specialist | Section | Note |
|---|---|---|---|---|
| T-01 | contract | data-engineer | 3, 4 | None: reads contracts |
| T-02 | data | api-engineer | 4 | `src/data/history.ts`: Q1 and Q2 cursor reads, actor and anonymised lookups. Unit test |
| T-03 | api | api-engineer | 3, 5 | `src/domain/history/rules.ts` (reference, verbs) and `actions.ts` (`loadOlderAction`). Unit tests |
| T-04 | ui | ui-engineer | 2 | Page, table, five states, copy, `tests/ui/history.spec.ts`. Excludes `actions.ts` |
| T-05 | tests | test-engineer | 6 | Integration, e2e, coverage check |
| T-06 | docs | test-engineer | 7 | Manual block, regenerate rules docs |
