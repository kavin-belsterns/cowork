# Review log: E-001/S-01

## E-001/S-01/T-02 round 1

Reviewer: bls-engineering:reviewer. Verdict: **Approve**.

| # | Check | Result |
|---|---|---|
| 1 | Evidence present for every done command | pass. All 5 card commands show `exit: 0`. No `SKIPPED:` lines. |
| 2 | Only owned files changed | pass. 4 source and test paths match card `owns`. Evidence file is the card's path. |
| 3 | No contract diff outside S-00 | pass. `git diff --exit-code origin/feat/E001-S00-contracts -- prisma src/contracts` exit 0 (base per ADR-0017). |
| 4 | EARS coverage | n/a until T-05 |
| 5 | Standards checklist lines | pass, with Minor items 1 and 2. |
| 6 | Overrides have ADRs | pass. ADR-0017. |

### Issues
| # | File | Line | Issue | Severity |
|---|---|---|---|---|
| 1 | src/data/session.ts | 85, 99-103 | data.md RC1: transaction comments say what they do, not the invariant they protect ("failure count runs since the last success"; "change and audit both or neither, AC-50"). | Minor |
| 2 | tests/unit/data/session.test.ts | 98-102 | Title says "keeps the row" but no assertion checks the row still exists. | Minor |
| 3 | work/E-001-room-booking/evidence/E001-S01-T02.txt | end | "## Owns check" section required by ADR-0017 before commit. | Minor (lead fixed before commit) |

### Suggestions
| # | File | Line | Suggestion | Category |
|---|---|---|---|---|
| 1 | src/data/sign-in-attempt.ts | 18-24 | UNVERIFIED: Prisma `distinct` may run in memory without the `nativeDistinct` preview. A raw `count(DISTINCT email_hash)` returns one number. Row count is bounded, low impact. | Performance |
| 2 | docs/adr/0017-override-stack-s01-on-s00.md | 7 | overrides.md RC1 wants `rule` as `standards/<file>.md#RCn`. `eng-build#step-5` is a skill step; confirm the form. | Docs |

### Looks good
- `setOwnPassword` runs the whole interactive transaction inside `withRetry`. Zero rows throws `VersionConflictError` and rolls back update, session swap and audit together. Tests prove the rollback.
- `verifyCredentials` always calls `verify` (null for unknown user). Deactivated shows only after verify passes. The hash never leaves the file.
- Raw SQL is a parameterised tagged template on `lower(email)`, matching `users_email_lower_uq`.
- Count queries match the `(email_hash, at)` and `(ip, at)` indexes. Window edge tested both ways.
- Tests use unique ids, clean up in FK order, never touch seed users, and fail when the DB is unreachable (lead confirmed exit 1).

### Lead action
Approve. Item 3 fixed by the lead before commit. Items 1 and 2 carried to the PR body under "Open review items".
