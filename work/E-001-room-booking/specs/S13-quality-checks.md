---
story: E-001/S-13
epic: E-001
ears:
  - E-001/AC-29
  - E-001/AC-65
  - E-001/AC-66
  - E-001/AC-67
  - E-001/AC-68
  - E-001/AC-69
  - E-001/AC-73
owns:
  - playwright.config.ts
  - tests/load/**
  - tests/evals/S13-quality-checks/**
  - tests/e2e/E-001/S13-quality-checks.spec.ts
depends_on: [E-001/S-00, E-001/S-04, E-001/S-07, E-001/S-10, E-001/S-11, E-001/S-12]
parallel: false
---

# Spec: E-001/S-13 Quality checks

## 1. Scope
EARS IDs covered:
- E-001/AC-29 every page shows without sideways scrolling at 375 px and wider.
- E-001/AC-65 the system holds 20 offices, 300 rooms, 3,000 users and 500 visitors a day.
- E-001/AC-66 every page meets WCAG 2.2 AA.
- E-001/AC-67 main content shows within 2.5 s on office wifi (LCP p75 over 5 runs).
- E-001/AC-68 95% of server requests answer within 500 ms.
- E-001/AC-69 200 concurrent users with an error rate under 1%.
- E-001/AC-73 latest Chrome, Edge, Safari and Firefox.

This story adds checks only. It changes no app code. A failing check goes back to the story that owns the page.

Out of scope:
- Fixing pages that fail. The owning story fixes them.
- Uptime target (Open point 1, client IT).
- The previous browser version. Playwright runs the current stable of each. Latest minus one is a hand check at eng-release.

## 2. Page and UI
Route: None: no page of its own. The sweeps visit every route in the design route map.

| State | What the user sees |
|---|---|
| Loading | None: no page |
| Empty | None: no page |
| Error | None: no page |
| Not found | None: no page |
| Success | None: no page |

Routes swept, with seed ids and the role that can open each: `/sign-in`, `/account/password`, `/`, `/admin/offices`, `/admin/offices/[officeId]`, `/admin/offices/[officeId]/rooms/[roomId]`, `/admin/users`, `/admin/users/[userId]`, `/admin/import`, `/rooms`, `/bookings/new`, `/bookings`, `/bookings/[bookingId]`, `/bookings/series/[seriesId]`, `/visits/new`, `/visits`, `/reception`, `/reception/visits/new`, `/reception/visits/[visitId]`, `/reception/visits/[visitId]/badge`, `/history`, `/reports`.
Breakpoints: 375, 768 and 1280 for the axe sweep. 375 for the sideways scroll sweep.
Copy: None: no page.

## 3. API
None: no server action and no route. The checks call existing pages and actions as a client.

| Check | Input | Output | Pass rule |
|---|---|---|---|
| k6 `tests/load/E-001.js` | `BASE_URL`, seed users from `tests/load/seed.ts` | `tests/load/out/E-001-summary.json` (`--summary-export`) | `http_req_duration: ['p(95)<500']`, `http_req_failed: ['rate<0.01']` |
| LCP runs in the e2e spec | `BASE_URL`, one user per role | `tests/evals/S13-quality-checks/out/lcp.json` | p75 of 5 runs per page at or under 2500 ms |
| Grader `tests/evals/S13-quality-checks/grade-performance.ts` | the two JSON files | pass or fail per threshold, exit code | code grader, no model |

- k6 mix (design NFRs): 200 VUs, 3 s think time. 50% view rooms, 20% book, 15% today view, 10% visits, 5% reports.
- Server actions are scripted as form POSTs. Each VU loads the page, reads the action id from the rendered form, then posts the form.
- Each booking VU picks a slot from its VU number and iteration, so 409 noise stays low. A `booking-conflict` reply counts as expected, not an error.
- RFC 9457 types: None new. Request schemas and DTOs: None.
- Idempotency: the book step sends a fresh `idempotencyKey` per form, as a browser would.
- `out/` files are not committed. The evidence file holds the printed summaries.

## 4. Data
| Table | Reads | Writes | Indexes used | Transaction |
|---|---|---|---|---|
| all E-001 tables | Through the app only | `tests/load/seed.ts` on staging or a local test DB: 20 offices, 300 rooms, 3,000 users, 500 visits a day for 7 days, bookings at 60% of open hours | None: no new query | No: seed uses `createMany` in batches. Runs once before the load test |
| bookings, visits, idempotency_keys | Through the app | k6 book and today view steps | The story indexes | App transactions as each story defines |

- The volume seed reuses `scripts/seed.ts` row validators (S-04). It refuses to run when `NODE_ENV=production`.
- It uses `DATABASE_URL_MIGRATOR`. It never targets the client production database.
- No new tables or columns.

## 5. Security
| Item | Value |
|---|---|
| Permission keys | None new. Each sweep signs in as the role that the route map allows for the page |
| Scope | None: checks use seed users in their own office |
| Boundary validation | None: no input to the app beyond normal forms |
| Secrets | `BASE_URL` and seed passwords from env. Never committed. Staging only |
| OWASP | A05: the load test runs against staging, never production. A07: seed passwords are test values, rotated with the staging DB |
| Logging | k6 and Playwright print counts and timings only. No user names or emails in reports |

## 6. Tests
| Kind | File path | Covers |
|---|---|---|
| unit | `tests/evals/S13-quality-checks/grade-performance.test.ts` (T-05) | Grader passes and fails on sample summaries at each threshold edge |
| integration | None: no data layer or action in this story | |
| ui | None: each story's `tests/ui` spec runs axe at three viewports. This story sweeps them all in e2e | |
| e2e | `tests/e2e/E-001/S13-quality-checks.spec.ts` (T-05) | One test per ID, ID first: `E-001/AC-29` 375 px sweep, `scrollWidth <= clientWidth` on every route. `E-001/AC-65` volume seed counts, then rooms and today view render for the largest office. `E-001/AC-66` axe `wcag22aa` sweep, every route, three widths, zero violations. `E-001/AC-67` LCP p75 over 5 runs per page, 10 Mbps and 40 ms RTT by CDP, chromium. `E-001/AC-68` grader on the k6 p95. `E-001/AC-69` grader on the k6 error rate and 200 VUs. `E-001/AC-73` smoke (sign in, book, check in) tagged `@smoke` on chromium, msedge, webkit, firefox |
| evals | `tests/evals/S13-quality-checks/grade-performance.ts` (T-05) | Code grader, pass or fail, for AC-67, AC-68, AC-69 |
| load | `tests/load/E-001.js` (T-05) | `BASE_URL=<staging url> k6 run tests/load/E-001.js` |

`playwright.config.ts` changes (T-05): add projects `chromium`, `msedge` (channel `msedge`), `webkit`, `firefox` for `@smoke`, and a `perf` project on chromium. Keep `forbidOnly`, `retries` and `trace` per `standards/testing.md`.
The 10 Mbps and 40 ms profile waits on Open point 3. The test reads the numbers from one constant.

## 7. Docs
| Docs home | Change |
|---|---|
| `docs/manual/E-001-room-booking.md` | Block "Supported browsers and screens": four browsers, 375 px and wider |
| `docs/rules/` | Regenerated. No new rules file in this story |
| `docs/workflows/E-001-room-booking.md` | None: no journey changes |

## 8. Done
| Command | Expected output |
|---|---|
| `pnpm tsc --noEmit` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm vitest run tests/evals/S13-quality-checks` | all pass |
| `pnpm tsx tests/load/seed.ts` (staging) | exit 0, counts 20, 300, 3000 printed |
| `BASE_URL=<staging url> k6 run --summary-export tests/load/out/E-001-summary.json tests/load/E-001.js` | exit 0, thresholds pass |
| `pnpm playwright test tests/e2e/E-001/S13-quality-checks.spec.ts` | all pass on every project. No ui spec: no page |
| `bash scripts/ci/check-auth-in-actions.sh` | PASS |
| `bash scripts/ci/check-test-tree.sh` | PASS |
| `bash scripts/ci/check-no-console.sh` | PASS |
| `git diff --exit-code origin/main -- prisma src/contracts` | exit 0 |

## Tasks
| Task | Type | Specialist | Section | Note |
|---|---|---|---|---|
| T-01 | contract | data-engineer | 3, 4 | None: reads contracts |
| T-02 | data | api-engineer | 4 | None: no data layer. The volume seed is test code, written in T-05 |
| T-03 | api | api-engineer | 3, 5 | None: no rules or actions |
| T-04 | ui | ui-engineer | 2 | None: no page |
| T-05 | tests | test-engineer | 6 | `playwright.config.ts` projects, volume seed, k6 script, e2e sweeps, grader and its test, coverage check |
| T-06 | docs | test-engineer | 7 | Manual block, regenerate rules docs |
