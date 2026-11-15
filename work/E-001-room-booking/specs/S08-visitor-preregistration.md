---
story: E-001/S-08
epic: E-001
ears: [E-001/AC-39, E-001/AC-40, E-001/AC-87, E-001/AC-91]
owns:
  - src/data/visit.ts
  - src/domain/visit/**
  - "src/app/(app)/visits/**"
  - src/components/visits/**
  - tests/unit/data/visit.test.ts
  - tests/unit/domain/visit/**
  - tests/integration/visit/**
  - tests/ui/visits.spec.ts
  - tests/e2e/E-001/S08-visitor-preregistration.spec.ts
depends_on: [E-001/S-00, E-001/S-01]
parallel: true
---

# Spec: E-001/S-08 Visitor pre-registration

## 1. Scope
EARS IDs covered:
- E-001/AC-39 a pre-registered visitor is saved as expected for that office and visit date, ready for the today view.
- E-001/AC-40 a missing name, visit date or office shows an error at that field and saves nothing.
- E-001/AC-87 "Pick today or a later date."
- E-001/AC-91 the host cancels an expected visit, so it leaves the today view.

The today view itself is E-001/S-09. This story proves AC-39 and AC-91 through the stored visit (`office_id`, `visit_date`, `status`), the exact keys the today view reads.

Out of scope:
- Today view, check-in, check-out, walk-ins, badge and arrival banner (E-001/S-09).
- Anonymising visitor data (E-001/S-12).
- Visitor names in history (E-001/S-10).

## 2. Page and UI
Routes: `/visits/new` (pre-register), `/visits` (my visits, cancel, find a visitor). Both send `Cache-Control: no-store`.

| State | What the user sees |
|---|---|
| Loading | `loading.tsx`: form skeleton, or three list row skeletons |
| Empty | "You have no upcoming visitors." Link "Pre-register a visitor". Search with no match: "No visitor matches that name." |
| Error | Form: error summary takes focus and lists each field message. Inputs stay. `error.tsx`: `internal` copy with reference id and Retry |
| Not found | Missing or other-office visit: "We could not find this item." Link "Back to my visits" |
| Success | Create redirects to `/visits`. A `role="status"` region says "Visitor pre-registered." Cancel says "Visit cancelled." |

Page rules:
- Form fields: visitor name, company, email, phone, office, visit date. Name, office and date are required.
- Office is a select of all offices. Default: the caller's office. The host is always the caller and is not a field.
- `/visits` lists visits the caller hosts, today and later, by date: visitor name, company, office, date, status text (Expected, Checked in, Checked out, Cancelled).
- Only Expected visits show Cancel. It opens an AlertDialog named "Cancel visit for <name> on <date>".
- "Find a visitor" is a search box. It posts to a server action. The name never goes in the URL.
- Submit is disabled while pending. Fields use `aria-describedby`.

Breakpoints: 375 one column, list rows stack into cards. 768 two-column form (name and company, email and phone). 1280 list as a table with the search box above.

Copy:
| Key | Text |
|---|---|
| title_new | Pre-register a visitor |
| name_label | Visitor name |
| company_label | Company (optional) |
| email_label | Email (optional) |
| phone_label | Phone (optional) |
| office_label | Office |
| date_label | Visit date |
| submit | Pre-register visitor |
| name_missing | Enter the visitor's name. |
| office_missing | Pick an office. |
| date_missing | Pick a visit date. |
| date_past | Pick today or a later date. |
| search_label | Find a visitor |
| cancel | Cancel visit |
| version | Someone changed this. Reload to see it. |

## 3. API
| Endpoint or action | Request type | Response type | Errors (RFC 9457) |
|---|---|---|---|
| `createVisitAction` in `src/app/(app)/visits/new/actions.ts`, form field `idempotencyKey` | `src/contracts/visit.ts: VisitCreateInput`, key as `common.ts: IdempotencyKey` | `Visit`, then redirect | `validation` 400, `unauthenticated` 401, `not-found` 404 (unknown office), `request-in-progress` 409, `request-changed` 422, `rule-violation` 422 |
| `cancelVisitAction` in `src/app/(app)/visits/actions.ts` | `VisitCancelInput` | `Visit` | 401, `forbidden` 403, 404, `version-conflict` 409 |
| `searchVisitsAction` in `src/app/(app)/visits/actions.ts` (POST only) | `VisitSearchInput` | `Visit[]` | `validation` 400, 401 |

- Each action parses with its schema, then calls `requirePermission`: `visit.create` for create and search, `visit.cancel` for cancel.
- `host_id` is set from the session. It is never read from the input.
- Create uses `withIdempotency()` with scope `(user_id, 'visit.create', key)`. TTL 24 h. Delete the key after any failure.
- AC-87 compares the visit date with today in the chosen office's zone (ADR-0009). It returns `rule-violation` 422, shown at the date field.
- Cancel works only on an expected visit. A visit no longer expected returns `version-conflict` 409.
- Rules in `src/domain/visit/rules.ts`: required fields, date not in the past, state move expected to cancelled. Pure, with `@ears` tags.
- No public HTTP route, so no OpenAPI change.
- Contract gap: none.

## 4. Data
| Table | Reads | Writes | Indexes used | Transaction |
|---|---|---|---|---|
| idempotency_keys | by `(user_id, scope, key)` | insert running, done with response (ids only), delete on failure | unique `(user_id, scope, key)` | Claim before the tx. Done inside it |
| offices | Q2 by id for zone. Q1 list for the select | None | PK, unique `name` | No |
| visits | Q2 my visits by `host_id` and date. By id for cancel. Search inside my visits by name | insert `status = 'expected'`. Cancel sets `cancelled` with `version` | `(host_id, visit_date)`, PK | Yes |
| audit_events | None | one row per create and cancel, visit by id only | None | Yes, same tx |

Transactions (interactive form, design table):
- Create: insert visit plus audit row. Both or neither.
- Cancel: `updateMany where id, version, status = 'expected'` plus audit row. 0 rows throws, rolls back the audit row and maps to `version-conflict`. Q1 of the today view reads `(office_id, visit_date)` and skips cancelled rows, so the visit leaves at once (AC-91).
- No new tables or columns.

## 5. Security
| Item | Value |
|---|---|
| Roles allowed | Create and search: all four roles, any office, host is the caller (`visit.create`). Cancel: host, platform admin, office admin and receptionist of the visit's office (`visit.cancel`) |
| Permission check | `requirePermission` first in each action, after the zod parse |
| Record scope | `scopeFor(session, visit)`: host matches `host_id` at any office. Office staff match `visit.office_id`. Other office 404. Same office without the right 403. Search filters by `host_id` only |
| Boundary validation | `VisitCreateInput` (name 120, email 254, phone 30), `VisitCancelInput`, `VisitSearchInput`, `IdempotencyKey`. All strict |
| Personal data | No visitor name, email or phone in any URL. Search is a POST body. `Cache-Control: no-store` on both pages. Host phone is not shown here (AC-20 belongs to `visit.desk`) |
| OWASP items | A01 per-record scope, host from session. A03 zod plus Prisma. A04 no personal data in URLs or caches |
| Logging | Visit id, office id, user id only. Never visitor name, email, phone or company. Validation failures by field name |

## 6. Tests
| Kind | File path | Covers |
|---|---|---|
| unit | `tests/unit/domain/visit/rules.test.ts` (T-03) | Required fields, date today ok and yesterday rejected in the office zone (Asia/Kolkata near midnight UTC), expected to cancelled only |
| unit | `tests/unit/data/visit.test.ts` (T-02) | Insert sets host from session, cancel 0 rows throws, search scoped to host, DTO has no internal fields |
| integration | `tests/integration/visit/create.test.ts`, `cancel.test.ts` (T-05) | Saved row has office, date, expected status. Missing fields save nothing. Past date 422. Replay returns the same visit. Cancel by host, by receptionist of the office, 404 for other office staff, 403 for another employee. `no-store` header present |
| ui | `tests/ui/visits.spec.ts` (T-04) | Five states at 375, 768, 1280. axe zero violations. Error summary focus. Search sends no query string |
| e2e | `tests/e2e/E-001/S08-visitor-preregistration.spec.ts` (T-05) | One test per ID, ID first in the title: `E-001/AC-39`, `E-001/AC-40`, `E-001/AC-87`, `E-001/AC-91` |
| evals | None: no AI output | |
| load | None: the 10% "visits" mix runs at epic release in `tests/load/E-001.js` | |

## 7. Docs
| Docs home | Change |
|---|---|
| `docs/manual/E-001-room-booking.md` | Add "Pre-register a visitor": required fields, date rule, cancel an expected visit |
| `docs/rules/` | Regenerated from `src/domain/visit/rules.ts` `@ears` tags |
| `docs/workflows/E-001-room-booking.md` | Host journey: pre-register, cancel, field errors |

## 8. Done
| Command | Expected output |
|---|---|
| `pnpm tsc --noEmit` | exit 0 |
| `pnpm lint` | exit 0, no warnings |
| `pnpm vitest run tests/unit/domain/visit tests/unit/data/visit.test.ts` | all pass |
| `pnpm vitest run tests/integration/visit` | all pass |
| `pnpm playwright test tests/ui/visits.spec.ts tests/e2e/E-001/S08-visitor-preregistration.spec.ts` | all pass |
| `bash scripts/ci/check-auth-in-actions.sh` | PASS |
| `bash scripts/ci/check-test-tree.sh` | PASS |
| `bash scripts/ci/check-no-console.sh` | PASS |
| `git diff --exit-code origin/main -- prisma src/contracts` | exit 0 (no contract change) |

## Tasks
| Task | Type | Specialist | Section | Note |
|---|---|---|---|---|
| T-01 | contract | data-engineer | 3, 4 | None: reads contracts |
| T-02 | data | api-engineer | 4 | `src/data/visit.ts`: create and cancel with audit in one tx, my visits, host-scoped search. Unit test |
| T-03 | api | api-engineer | 3, 5 | `src/domain/visit/rules.ts` with `@ears` tags, three actions with `requirePermission`, `scopeFor`, `withIdempotency`. Unit tests |
| T-04 | ui | ui-engineer | 2 | Two routes, state files, `no-store`, `src/components/visits/**`, copy table, `tests/ui/visits.spec.ts`. Excludes `actions.ts` |
| T-05 | tests | test-engineer | 6 | Integration tests, e2e spec, coverage check |
| T-06 | docs | test-engineer | 7 | Manual block, workflow steps, regenerate `docs/rules/` |
