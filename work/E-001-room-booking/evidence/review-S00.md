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
