---
story: E-001/S-12
epic: E-001
ears:
  - E-001/AC-09
  - E-001/AC-10
  - E-001/AC-18
  - E-001/AC-70
  - E-001/AC-83
owns:
  - src/worker/**
  - src/data/purge.ts
  - src/data/jobs.ts
  - src/domain/purge/**
  - docker-compose.yml
  - tests/unit/data/purge.test.ts
  - tests/unit/domain/purge/**
  - tests/integration/purge/**
  - tests/integration/worker/**
  - tests/e2e/E-001/S12-visitor-purge.spec.ts
depends_on: [E-001/S-00, E-001/S-09]
parallel: true
---

# Spec: E-001/S-12 Visitor data purge

## 1. Scope
EARS IDs covered:
- E-001/AC-09 the nightly job removes name, email, phone and company 90 days after the visit date.
- E-001/AC-10 a failed purge is recorded in the activity history.
- E-001/AC-18 an anonymised visit keeps its visit date, office and host.
- E-001/AC-70 daily database backups are kept for 7 days only. Client IT runs them. This story writes the runbook and a test that checks it.
- E-001/AC-83 a failed purge is retried on the next nightly run.

Also delivered: three prune jobs in the same loop (sessions, idempotency keys, sign-in attempts), and the `worker` service in `docker-compose.yml` ([ADR-0007](../../../docs/adr/0007-worker-container-for-jobs.md)).

Out of scope:
- Running backups. Client IT owns them (Open point 4).
- Activity history retention (Open point 7).
- Showing "Visitor details removed". S-10 and S-09 render it from `anonymised_at`.

## 2. Page and UI
Route: None: no page. The worker is a background process.

| State | What the user sees |
|---|---|
| Loading | None: no page |
| Empty | None: no page |
| Error | None: no page. A failure shows as a history row (AC-10) |
| Not found | None: no page |
| Success | None: no page |

Breakpoints: None: no page.
Copy: None: no page. The audit row uses verb "failed" and item "Nightly visitor purge", shown by S-10.

## 3. API
None: no server action and no HTTP route. Entry points:

| Entry (file) | Input | Output | Errors |
|---|---|---|---|
| `src/worker/index.ts` | Env from `src/lib/env.ts` (`DATABASE_URL_WORKER`). `--once` and `--at=<ISO>` honoured only when `NODE_ENV=test` | Long-running loop, ticks every 10 minutes | None: errors go to `job_runs` and `audit_events` |
| `src/worker/run.ts: runDueJobs(now)` | `now: Date` | per job: `skipped`, `ok` with counts, or `failed` | Caught per job. One failing job does not stop the others |
| `src/worker/jobs/{purge-visitors,prune-sessions,prune-idempotency-keys,prune-sign-in-attempts}.ts` | `now`, office list | counts | thrown to `runDueJobs` |

- A job is due once per UTC date at the first tick at or after 01:00 UTC. `isDue(now)` lives in `src/domain/purge/rules.ts`.
- RFC 9457 types: None: no HTTP. Results use the `JobRun` `result` enum from S-00.
- Request schema: None. DTOs: None. The worker reads rows and writes counts.
- Idempotency: the `job_runs` unique `(job, run_date)` claim. No idempotency keys.

## 4. Data
| Table | Reads | Writes | Indexes used | Transaction |
|---|---|---|---|---|
| job_runs | Claim | `INSERT (job, run_date, running)` first. Unique conflict means already ran or running: skip. Then set `ok` or `failed` | unique `(job, run_date)` | Claim is its own statement, before any work |
| offices | All offices with `time_zone` | None | PK | No |
| visits | Q4: `visit_date <= cutoff(office) and anonymised_at is null`, per office, 1,000 ids per batch with `FOR UPDATE SKIP LOCKED` | Set `name`, `email`, `phone`, `company` to null, set `anonymised_at`. Keep `visit_date`, `office_id`, `host_id`, `status` and times (AC-18) | partial `(visit_date) where anonymised_at is null` | Yes, one per batch. Invariant: a row is either fully cleared with `anonymised_at` set, or untouched |
| audit_events | None | One row per job run: `ok` with count, or `failed` with reason code. Visitors never named (AC-52) | None | With the final `job_runs` update |
| sessions | None | Delete `expires_at < now` | `expires_at` | No: one statement |
| idempotency_keys | None | Delete `created_at < now - 24 h` | None: one scan a night over 50,000 rows | No: one statement |
| sign_in_attempts | None | Delete `at < now - 24 h`, wider than the 15 min lockout window | `(email_hash, at)` | No: one statement |

- Cutoff per office: today in the office zone minus 90 days (ADR-0009). Rule in `src/domain/purge/rules.ts`.
- Failure (AC-10): `job_runs.result = failed` and an audit row with actor `system`, in one tx. If that write also fails, log one ERROR line.
- Retry (AC-83): no in-night retry. The next night claims a new `run_date`. Its cutoff query still matches every row with `anonymised_at is null`, so missed rows are caught.
- Contract: S-00 grants `app_worker` everything the four jobs need (section 4 roles and grants).
- Contract: `visits.name`, `email`, `phone`, `company` are nullable in S-00 for AC-09.

## 5. Security
| Item | Value |
|---|---|
| Permission key | `system` principal: purge and prune only (route map) |
| Scope | `scopeFor` not used: the system principal spans all offices. Each office gets its own cutoff |
| Boundary validation | `src/lib/env.ts` parses env at start. Test flags rejected unless `NODE_ENV=test` |
| DB role | `app_worker` via `DATABASE_URL_WORKER`. No access to `password_hash` |
| Container | `worker` service, same image as `web`, `command` runs `src/worker/index.ts`, no published port, internal network, `restart: unless-stopped`, `depends_on: db` healthy |
| OWASP | A01: least privilege role. A04: claim row stops double runs. A09: failures audited and logged |
| Logging | JSON line per job: job, run_date, result, row count, duration. Never visitor data |

## 6. Tests
| Kind | File path | Covers |
|---|---|---|
| unit | `tests/unit/domain/purge/rules.test.ts` (T-03), `tests/unit/data/purge.test.ts` (T-02) | Cutoff per zone at both sides of midnight, `isDue`, cleared field list, prune ages, batch loop stops at 0 |
| integration | `tests/integration/purge/{anonymise,failure,retry,backups-runbook}.test.ts`, `tests/integration/worker/{claim,loop}.test.ts` (T-05) | Fixed clock. Day 89 kept, day 90 cleared. 2,500 rows in three batches. Injected failure writes `failed` and audit. Next night clears the rows. Two workers, one claim. Runbook states 7 days |
| ui | None: no page | |
| e2e | `tests/e2e/E-001/S12-visitor-purge.spec.ts` (T-05) | Runs `src/worker/index.ts --once --at=<ISO>` against the seed. One test per ID, ID first: `E-001/AC-09` old visits cleared. `E-001/AC-10` forced failure gives an audit row. `E-001/AC-18` date, office and host kept. `E-001/AC-70` `docs/runbook/backups.md` states 7 days. `E-001/AC-83` next run clears the rows |
| evals | None: no AI or performance NFR | |
| load | None: 500 visitors a day is 1 batch | |

Failure injection: env `WORKER_FAIL_JOB=purge`, read only when `NODE_ENV=test`.

## 7. Docs
| Docs home | Change |
|---|---|
| `docs/manual/E-001-room-booking.md` | Block "Visitor data after 90 days": what is removed, what stays, what admins see |
| `docs/runbook/backups.md` | New: daily encrypted `pg_dump`, kept 7 days, owner client IT, restore steps (AC-70) |
| `docs/rules/` | Regenerated from `src/domain/purge/rules.ts` `@ears` tags |
| `docs/workflows/E-001-room-booking.md` | None: no user journey |

## 8. Done
| Command | Expected output |
|---|---|
| `pnpm tsc --noEmit` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm vitest run tests/unit/domain/purge tests/unit/data/purge.test.ts tests/integration/purge tests/integration/worker` | all pass |
| `pnpm playwright test tests/e2e/E-001/S12-visitor-purge.spec.ts` | all pass. No ui spec: no page |
| `docker compose config` | exit 0, `worker` service listed |
| `bash scripts/ci/check-auth-in-actions.sh` | PASS |
| `bash scripts/ci/check-test-tree.sh` | PASS |
| `bash scripts/ci/check-no-console.sh` | PASS |
| `git diff --exit-code origin/main -- prisma src/contracts` | exit 0 |

## Tasks
| Task | Type | Specialist | Section | Note |
|---|---|---|---|---|
| T-01 | contract | data-engineer | 3, 4 | None: reads contracts. Grants gap goes to the lead |
| T-02 | data | api-engineer | 4 | `src/data/purge.ts` (batched anonymise, prunes), `src/data/jobs.ts` (claim, finish). Unit test |
| T-03 | api | api-engineer | 3, 5 | `src/domain/purge/rules.ts`, `src/worker/**` loop and jobs, `worker` service in `docker-compose.yml`. Unit tests |
| T-04 | ui | ui-engineer | 2 | None: no page |
| T-05 | tests | test-engineer | 6 | Integration, worker tests, e2e, coverage check |
| T-06 | docs | test-engineer | 7 | Manual block, `docs/runbook/backups.md`, regenerate rules docs |
