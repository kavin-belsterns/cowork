# Review log: E-001/S-14

## E-001/S-14/T-01 round 1

Reviewer: bls-engineering:reviewer. Verdict: **Approve**.

| # | Check | Result |
|---|---|---|
| 1 | Evidence | pass. 9 commands, all `exit: 0`. `migrate deploy` applied only `20261115090000_web_delete_grants`. 15 of 15 contract tests on `e001_s02`. |
| 2 | Owned files | pass. New migration folder and `migration.test.ts` (+2 lines) match `owns`. |
| 3 | Contract diff | pass. Contracts amendment: schema and `src/contracts` unchanged; init migration untouched; the new migration is the only contract change. |
| 4 | EARS coverage | n/a until T-05 |
| 5 | Standards | pass with Minor 1. Least privilege: DELETE only, `app_web` only, two tables only. The grants test uses `toEqual` on the full map. |
| 6 | Overrides | pass. None. |

### Issues
| # | File | Line | Issue | Severity |
|---|---|---|---|---|
| 1 | evidence E001-S14-T01.txt | end | No `pnpm ls next @prisma/client prisma` (versions.md RC4). package.json unchanged; raw SQL only. | Minor |

### Lead action
Approve and commit. Item 1 carried to "Open review items"; the story evidence runs `pnpm ls`.

## E-001/S-14/T-05 round 1

Reviewer: bls-engineering:reviewer. Verdict: **Approve**.

| # | Check | Result |
|---|---|---|
| 1 | Evidence | pass. 4 commands, all `exit: 0`. 21 contract tests (6 new). Unreachable DB run exits 1 (fails, not skips). |
| 2 | Owned files | pass. One new test file in `owns`, plus its evidence file. |
| 3 | Contract diff | pass. T-05 touches neither `prisma/` nor `src/contracts/`. |
| 4 | EARS coverage | Expected for an amendment: no e2e by design (spec section 6). The test cites AC-54 and AC-74, the IDs on the card. |
| 5 | Standards | pass with Minors 1 and 2. Not a superuser (checked), deletes in rolled-back tx, DELETE on rooms and audit_events refused with 42501, fixtures cleaned up in FK order. |
| 6 | Overrides | pass. None. |

### Issues
| # | File | Line | Issue | Severity |
|---|---|---|---|---|
| 1 | tests/integration/contracts/web-delete-grants.test.ts | 2, 89, 96 | The ID citations make AC-54 and AC-74 count as covered in `check-ac-coverage.sh`, but this grant test does not prove the EARS lines end to end. The S-02 and S-07 e2e specs must name them. | Minor |
| 2 | same | 38-57 | testing.md RC2 prefers seed data; this test makes its own rows (the seed has no `booking_series` rows; same pattern as the S-00 `migration.test.ts`). | Minor |

### Suggestions
| # | File | Line | Suggestion | Category |
|---|---|---|---|---|
| 1 | same | 62-66 | Cleanup deletes swallow errors silently. Harmless with unique ids. | Style |

### Lead action
Approve and commit. Items 1 and 2 carried to "Open review items". Item 1 relayed to the S-02 session for its T-05.
