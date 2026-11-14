---
id: 0007
type: decision
work_item: E-001
date: 2026-11-14
status: accepted
---

# 0007 Run nightly jobs in a worker container

## Context
Visitor data must be anonymised nightly (AC-09) with a retry on the next run (AC-83). The app runs in Docker on client hosts (SOW 7).

## Options
| Option | Complexity | Cost to run | Scale | Team knows it |
|---|---|---|---|---|
| A. Host cron calls a protected HTTP endpoint | Low in repo, but lives on client hosts | None | Fine | Yes |
| B. `pg_cron` extension in Postgres | Low | None | Fine | No, and needs the extension on client Postgres |
| C. `worker` service from the same image. Wakes every 15 min, runs once per UTC day after 02:00, guarded by unique `job_run (job, run_date)` | Low: no new package | One idle Node process | Fine | Yes |

## Decision
Option C. Everything ships in our Docker Compose file. The unique row stops a double run. Proposed by the chair, signed with the design.

## Consequences
- Easier: tested like app code. Session pruning uses the same loop.
- Harder: one more container to monitor.
- Revisit when: more than three scheduled jobs exist. Revisited 2026-11-14 at four jobs (purge, sessions, idempotency keys, sign-in attempts): one loop still fits. Next revisit at six jobs.
