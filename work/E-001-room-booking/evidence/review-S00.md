# Review log: E-001/S-00

## E-001/S-00/T-01 round 1
Verdict: Request Changes (reviewer subagent, read only).

| # | File | Issue | Severity | Lead action |
|---|---|---|---|---|
| 1 | src/lib/logger.ts:12-13 | Redaction misses camelCase name fields (hostName, ownerName, actorName, fullName) and the visitor search `query` | Major | Re-dispatch: fix |
| 2 | src/contracts/import.ts:69 | `UserCsvRow.phone` rejects a blank cell | Major | Re-dispatch: fix |
| 3 | src/contracts/permissions.ts:118,129-131 | `scopeFor` cannot express host-only `visit.seen` | Major | Re-dispatch: fix |
| 4 | prisma/schema.prisma | System and log tables lack `created_by`/`updated_at`; `must_change_password` lacks `is_` prefix | Major | Lead: override ADR-0015 |
| 5 | .github/workflows/ci.yml:89-92 | Playwright steps fail with no spec files in S-00 | Major | Re-dispatch: fix |
| 6 | src/contracts/common.ts:68-69 | `PHONE_PATTERN` allows 31 characters, limit is 30 | Minor | Re-dispatch: fix, 30 holds |
| 7 | docs/adr/0014-override-typescript-6.md | Who not named | Minor | Open review item for the engineer at PR |

Suggestions taken: next.config.ts, package.json and postcss.config.mjs go into the T-03 and T-04 card owns. Idempotency key parsing note goes to S-06 to S-09 cards.

## E-001/S-00/T-01 round 2
Verdict: Approve (reviewer subagent, read only). Round 1 items 1 to 6 closed: 1, 2, 3, 5, 6 fixed in code; 4 covered by ADR-0015.

Open review items carried to the PR:
| # | File | Issue | Severity | Owner |
|---|---|---|---|---|
| 1 | docs/adr/0014-override-typescript-6.md, docs/adr/0015-override-audit-columns-system-tables.md | Who not named, status proposed | Minor | Engineer at the S-00 PR |
| 2 | src/lib/logger.ts:13 | camelCase name and `query` redaction untested | Minor | S-00 T-05 (`tests/unit/lib/logger.test.ts`) |

Suggestion noted for S-12: log the job under `job`, not `job_name`, which the redaction now hides.

## E-001/S-00/T-02 round 1
Verdict: Request Changes (reviewer subagent, read only). Catalog of e001_test confirmed: exclusion constraint identical to ADR-0006, btree_gist, partial uniques, 10 CHECKs, audit triggers, NOLOGIN roles, grants per spec, no TRUNCATE.

| # | File | Issue | Severity | Lead action |
|---|---|---|---|---|
| 1 | src/lib/audit.ts:1-7 | No `import 'server-only'` on a DB-writing module | Major | Re-dispatch: fix |
| 2 | src/lib/audit.ts:67 | Prisma call outside `src/data/` (data.md RC9) | Minor | Declined: spec S-00 places the audit writer in `src/lib/` as shared infra that runs inside the caller's transaction, like `db.ts` |
| 3 | evidence notes 1 and 3 | Stale after the lead re-run | Minor | Lead fixed |
| 4 | evidence | No `pnpm ls` version line (versions.md RC4) | Minor | Accepted T-01 evidence line 46: package.json unchanged |

Spec question closed: a cancelled visit holds no check-in time. S-08 cancels only expected visits, so the CHECK matches.
Lead question to specialist: `.env.example` differs from HEAD but is not in T-02 owns. Specialist to report the change.
PR items: EXPLAIN ANALYZE for the four non-FK raw-SQL indexes (data.md RC3) on empty S-00 tables, to be handled at the S-00 PR.

## E-001/S-00/T-02 round 2
Verdict: Approve (reviewer subagent, read only). Item 1 closed (server-only first import). Items 3 and 4 closed.

Lead actions on the reviewer's open items:
| # | Issue | Lead action |
|---|---|---|
| 1 | RC9 skipped without ADR | Wrote docs/adr/0016-override-audit-writer-in-lib.md, listed on the card |
| 2 | Stale .env.example note | Note 2 rewritten: unchanged, sandbox artifact |
| 3 | tsc and lint not shown after the fix | Lead re-ran both after the fix, exit 0, blocks added to evidence |

Open review items carried to the PR: ADR-0016 Who to be named by the engineer. EXPLAIN ANALYZE for the four non-FK raw-SQL indexes (data.md RC3).


## E-001/S-00/T-03 round 1
Verdict: Approve (reviewer subagent, read only). OpenAPI registry and CLI generator, pure zoned-time helpers with DST handling, and per-request nonce CSP proxy with security headers implemented per spec.

Checks in order:
| # | Check | Result |
|---|---|---|
| 1 | Evidence present for every done command | pass |
| 2 | Only owned files changed | pass |
| 3 | No contract diff outside S-00 | pass |
| 4 | EARS coverage (check-ac-coverage.sh) | n/a until T-05 |
| 5 | Standards checklist lines | pass |
| 6 | Overrides have ADRs | pass |

Critical Issues: None.

Suggestions:
| # | File | Line | Suggestion | Category |
|---|------|------|------------|----------|
| 1 | src/proxy.ts | 12 | Support standard `traceparent` extraction in addition to `x-request-id` if distributed tracing is required. | Security |
| 2 | scripts/gen-openapi.ts | 9 | Resolve `OUTPUT` using `path.resolve(process.cwd(), OUTPUT)` to guarantee correct file path if invoked from a subdirectory. | Style |


## E-001/S-00/T-04 round 1
Verdict: Approve (reviewer subagent, read only). Tailwind v4 tokens, shadcn configuration, Inter font shell layout, global error and not-found states implemented cleanly to spec.

Checks in order:
| # | Check | Result |
|---|---|---|
| 1 | Evidence present for every done command | pass |
| 2 | Only owned files changed | pass |
| 3 | No contract diff outside S-00 | pass |
| 4 | EARS coverage (check-ac-coverage.sh) | n/a until T-05 |
| 5 | Standards checklist lines | pass |
| 6 | Overrides have ADRs | pass |

Critical Issues: None.

Suggestions:
| # | File | Line | Suggestion | Category |
|---|------|------|------------|----------|
| 1 | components.json | 16 | The alias `@/lib/utils` is configured, but `src/lib/utils.ts` does not yet exist. When adding future shadcn primitives that depend on `cn`, provide the standard helper. | Style |
| 2 | src/components/ui/button.tsx | 32 | Icon buttons (`size="icon"`) must receive an explicit `aria-label` attribute from call sites per WCAG 2.2 and standards/ui.md. | Testing |


## E-001/S-00/T-05 round 1
Verdict: Request Changes (reviewer subagent, read only). Comprehensive foundation test suite implemented across unit, integration, and UI fixture layers with high quality assertions.

| # | File | Line | Issue | Severity | Lead action |
|---|------|------|-------|----------|-------------|
| 1 | next-env.d.ts | 3 | File modified outside card owns list (Next.js route type imports; revert via git checkout) | Critical | Revert with git checkout |
| 2 | tests/ui/fixtures.ts | 1 | ESLint suppression "/* eslint-disable react-hooks/rules-of-hooks */" has no ADR reference and lacks an override ADR in docs/adr/ | Critical | Re-dispatch / fix: rename fixture callback parameter to eliminate hook false-positive without disable comment |


## E-001/S-00/T-05 round 2
Verdict: Approve (reviewer subagent, read only). Round 1 issues 1 and 2 closed.

Checks in order:
| # | Check | Result |
|---|---|---|
| 1 | Evidence present for every done command | pass |
| 2 | Only owned files changed | pass |
| 3 | No contract diff outside S-00 | pass |
| 4 | EARS coverage (check-ac-coverage.sh) | pass |
| 5 | Standards checklist lines | pass |
| 6 | Overrides have ADRs | pass |

Critical Issues: None.
Suggestions: None.


## E-001/S-00/T-06 round 1
Verdict: Approve (reviewer subagent, read only). Clean generation of OpenAPI 3.1 specification and database ERD, with standard-compliant interface rules documentation.

Checks in order:
| # | Check | Result |
|---|---|---|
| 1 | Evidence present for every done command | pass |
| 2 | Only owned files changed | pass |
| 3 | No contract diff outside S-00 | pass |
| 4 | EARS coverage (check-ac-coverage.sh) | n/a until T-05 |
| 5 | Standards checklist lines | pass |
| 6 | Overrides have ADRs | pass |

Critical Issues: None.
Suggestions:
1. `docs/ui/interface-rules.md:32`: Consider explicitly listing the paired status foreground tokens alongside the status background tokens in the status table.

## E-001/S-00 story check fix (lead, 2026-11-14)
Story re-run with the test DB up found `tests/integration/contracts/migration.test.ts` failing 1 of 10. Earlier passes came from the DB being offline: the live block returned early and passed. CI on PR #100 (real DB) failed on the same file.
Fixed in T-05 by the test-engineer: one transaction per forbidden audit statement; the live block now fails when it cannot connect (no fallback URL, no early return). Lead verified: unreachable DB gives exit 1, test DB gives 9 of 9 passing. The T-05 card done list now includes `tests/integration/contracts`.
