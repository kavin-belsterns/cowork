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

## E-001/S-01/T-03 round 1

Reviewer: bls-engineering:reviewer. Verdict: **Request Changes**.

| # | Check | Result |
|---|---|---|
| 1 | Evidence | pass. 8 commands, all `exit: 0`. The build warning comes from S-00 `src/instrumentation.ts`. |
| 2 | Owned files | pass. 24 untracked paths match card `owns`. |
| 3 | Contract diff | pass against `origin/main` and `origin/feat/E001-S00-contracts` (same tree). |
| 4 | EARS coverage | n/a until T-05 |
| 5 | Standards | fail: issues 1, 5, 6. |
| 6 | Overrides | pass. ADR-0017 (expired). No lint or type suppressions. |

### Issues
| # | File | Line | Issue | Severity |
|---|---|---|---|---|
| 1 | src/app/(auth)/sign-in/actions.ts | 27-31 | A bad `returnTo` (for example `//evil.example`, or over 512 chars) blocks sign-in with raw zod text instead of falling back to the role home (spec 2, design 232, api.md RC2). | Major |
| 2 | src/domain/auth/rules.ts | 31-40 | AC-48 says "lock for 15 minutes". The lock is a sliding window: it lifts when the 5th most recent failure leaves the window. `Retry-After: 900` and the copy overstate the wait. `@remarks` claims more than the code does. | Major |
| 3 | src/lib/auth/change-password.ts | 39-49 | Wrong current passwords are counted under `hashUserKey` and never deleted. A user can stay locked out of `/account/password` after a success or an admin reset. They also add a key to the IP count. | Major |
| 4 | both actions.ts | 30; 42 | Three strings not in spec section 2. Other parse failures (`newPassword` over 128, `version`, `returnTo`) still show raw zod text. | Minor |
| 5 | both actions.ts | 61; 26-30 | `signOutAction` logs `session.revoked` on the root logger with no `request_id`. `changePasswordAction` redirects an unauthenticated caller and logs nothing. | Minor |
| 6 | evidence E001-S01-T03.txt | end | No `pnpm ls next @prisma/client prisma` output (versions.md RC4). No "## Owns check" yet. | Minor |

### Suggestions
| # | File | Suggestion |
|---|---|---|
| 1 | src/domain/auth/rules.ts 51-55 | IP delay of (n minus 29) s is accepted. UNVERIFIED: proxy read timeouts near 60 s may return 504 before the 429. Confirm with client IT or cap the delay. |
| 2 | src/lib/auth/client-ip.ts 11-13 | With no `X-Forwarded-For` every caller shares the `unknown` bucket. Add a line to the release checklist. |
| 3 | src/lib/auth/sign-in.ts 75-81 | The role is read from the new session row: one extra lookup. Add `role` to `CredentialUser` when T-02 data is next touched. |
| 4 | sign-in.ts, change-password.ts | `RETRY_AFTER_SECONDS` is defined twice. Derive it from `LOCKOUT_WINDOW_MS`. |

### Lead decisions
- 1: fix in round 2.
- 2: accept the sliding window. Spec sections 4 and 6 define the query as "failures by email_hash in 15 min". Fix `@remarks` to describe the sliding window in round 2. Carried to "Open review items" for the signer to confirm against AC-48.
- 3: fix in round 2. The card widens to `src/data/sign-in-attempt.ts` and its test (inside story owns) to add `clearFailures`, which runs after a successful change. Carried to "Open review items": the S-03 admin reset must also delete the user-key rows.
- 4: fix the raw zod text in round 2. Keep the three plain strings. Carried to "Open review items": add these copy keys to spec section 2.
- 5: fix in round 2.
- 6: add `pnpm ls next @prisma/client prisma` to the done list. The lead adds the owns check at commit.
- Suggestions 1 and 2: carried to "Open review items". Suggestion 4: fix in round 2. Suggestion 3: left for later.

## E-001/S-01/T-03 round 2

Reviewer: bls-engineering:reviewer. Verdict: **Approve**.

| # | Check | Result |
|---|---|---|
| 1 | Evidence | pass. 10 commands, all `exit: 0`, including `pnpm ls` and the DB-backed `clearFailures` test. Evidence is newer than every changed file. |
| 2 | Owned files | pass. 24 untracked and 2 modified paths match the widened card `owns`. |
| 3 | Contract diff | pass. `git diff --exit-code origin/main -- prisma src/contracts` exit 0 (01424bf). |
| 4 | EARS coverage | n/a until T-05 |
| 5 | Standards | pass. check-auth-in-actions, check-no-console, check-test-tree re-run: exit 0. |
| 6 | Overrides | pass. ADR-0017 expired. No suppressions. |

Round 1 items: 1, 3 (code), 4 (raw zod text), 5, 6 (`pnpm ls`) and suggestion 4 are fixed. Items 2, 3 (S-03 side) and 4 (spec keys) are carried as decided.

### Suggestions
| # | File | Line | Suggestion | Category |
|---|---|---|---|---|
| 1 | src/lib/auth/change-password.ts | 51-58 | `clearFailures` runs after the transaction commits. If it throws, the password has changed but the action returns 500 with no cookie. The new password still works. Stale rows age out in 15 min. Accept, or catch and log. | Reliability |

Side note: ADR-0017 front matter still says `status: accepted` while the body says expired.

### Lead action
Approve and commit. Suggestion 1 and the ADR-0017 status are carried to "Open review items".

## Open review items (running list for the PR body)
| Task | # | File | Issue | Severity |
|---|---|---|---|---|
| T-02 | 1 | src/data/session.ts | Transaction comments name what they do, not the invariant (data.md RC1). | Minor |
| T-02 | 2 | tests/unit/data/session.test.ts | "keeps the row" test does not assert the row exists. | Minor |
| T-02 | S1 | src/data/sign-in-attempt.ts | Prisma `distinct` may run in memory (UNVERIFIED). | Minor |
| T-02 | S2 | docs/adr/0017-override-stack-s01-on-s00.md | `rule: eng-build#step-5` is not the `standards/<file>.md#RCn` form. Front matter `status` still `accepted` after expiry. | Minor |
| T-03 | R1-2 | src/domain/auth/rules.ts | AC-48 says "lock for 15 minutes"; code is a sliding window per spec sections 4 and 6. `Retry-After: 900` and the copy are an upper bound. Signer to confirm. | Major |
| T-03 | R1-3 | (E-001/S-03) | The admin reset must also delete the user-key attempt rows that password change writes. | Major |
| T-03 | R1-4 | specs/S01-sign-in.md section 2 | Add copy keys for "Enter a valid email address.", "Enter your password.", "Enter your current password.". | Minor |
| T-03 | R1-S1 | src/domain/auth/rules.ts | IP delay reaches 70 s at 99 emails; proxy timeouts near 60 s may return 504 first (UNVERIFIED). | Minor |
| T-03 | R1-S2 | src/lib/auth/client-ip.ts | No `X-Forwarded-For` puts everyone in the `unknown` bucket. Add to the release checklist. | Minor |
| T-03 | R1-S3 | src/lib/auth/sign-in.ts | Role read from the new session row: one extra lookup. Add `role` to `CredentialUser`. | Minor |
| T-03 | R2-S1 | src/lib/auth/change-password.ts | `clearFailures` runs after commit; a throw there returns 500 although the change succeeded. | Minor |

## E-001/S-01/T-04 round 1

Reviewer: bls-engineering:reviewer. Verdict: **Request Changes**.

| # | Check | Result |
|---|---|---|
| 1 | Evidence | pass. 7 commands, all `exit: 0`. 162 UI tests at three widths, axe clean. |
| 2 | Owned files | pass. 26 untracked paths match card `owns`. No `route.ts` or `actions.ts` touched. |
| 3 | Contract diff | pass against origin/main. |
| 4 | EARS coverage | n/a until T-05 |
| 5 | Standards | fail: issues 1 and 2. |
| 6 | Overrides | pass. None. No suppressions. |

Base note: origin/main moved to 4a94c17 (Dependabot #101, #102: `@playwright/test` 1.65.0, `lucide-react` 1.70.0, Radix). Rebase and re-run the build and UI commands.

### Issues
| # | File | Line | Issue | Severity |
|---|---|---|---|---|
| 1 | src/components/auth/password-form.tsx | 19, 23, 27 | The "Password changed." note is set before the action runs and kept on every redirect, including the redirect to `/sign-in` for an expired session or a deactivated account. Sign-out does not clear it. The next page can show "Password changed." when nothing changed, possibly to another user. No test covers this path. | Major |
| 2 | src/components/auth/text-field.tsx | 22, 30-41 | ui.md RC3: the input and label are hand-rolled. shadcn Input and Label do not exist in `src/components/ui`. | Major |
| 3 | src/components/shell/role-menu.tsx, sign-out-button.tsx | 33-43; 11-19 | ui.md RC3: the Menu toggle and Sign out are hand-rolled buttons, although `Button` has `outline` and `ghost` variants. | Minor |

### Suggestions
| # | File | Line | Suggestion | Category |
|---|---|---|---|---|
| 1 | src/components/auth/password-form.tsx | 12-14 | `isRedirect` matches Next's internal `NEXT_REDIRECT` digest. Put redirect parsing in one helper. | Maintainability |
| 2 | tests/ui/*.spec.ts | 311; 351 | `page.waitForTimeout(1000)` in both loading tests can flake. Wait on the prefetch response. | Reliability |
| 3 | src/components/auth/password-form.tsx | 49 | "Use 12 to 128 characters." is not a spec copy key. Add it to the spec key list (T-03 R1-4). | Docs |

### Lead decisions
- 1: fix in round 2. Keep the note only when the redirect target is the role home. Clear it at sign-out. Add a test for the unauthenticated path.
- 2: fix in round 2. The card widens to two new files, `src/components/ui/input.tsx` and `src/components/ui/label.tsx`, written as the standard shadcn components (Label on the existing `@radix-ui/react-label`). No S-00 file is edited and no dependency is added. These paths are outside the story owns: carried to "Open review items" for the human to see.
- 3: fix in round 2 with the `Button` variants.
- Suggestions 1 and 2: fix in round 2 (small and in owns). Suggestion 3: carried to "Open review items" with T-03 R1-4.
- Rebase onto origin/main 4a94c17 before round 2.

## E-001/S-01/T-04 round 2

Reviewer: bls-engineering:reviewer. Verdict: **Approve**.

| # | Check | Result |
|---|---|---|
| 1 | Evidence | pass. 7 commands, all `exit: 0`. 165 UI tests. Timestamps show a fresh run after the last edit. |
| 2 | Owned files | pass. 29 paths match the widened `owns`, plus the evidence file. Under `src/components/ui` only `input.tsx` and `label.tsx` are new. `package.json` and the lockfile are unchanged. |
| 3 | Contract diff | pass against origin/main 4a94c17. |
| 4 | EARS coverage | n/a until T-05 |
| 5 | Standards | pass. ui.md RC1, RC2, RC3. |
| 6 | Overrides | pass. None. |

Round 1 items: R1-1 fixed (confirmed against Next 16.4.6: the note stays only on the role-home redirect; sign-out and sign-in mount also clear it). R1-2, R1-3, S1, S2 fixed. S3 carried.

### Suggestions
| # | File | Line | Suggestion | Category |
|---|---|---|---|---|
| 1 | tests/ui/account-password.spec.ts | 242-254 | The sign-in mount also clears the note, so this test would pass even if the form's catch path stopped clearing it. Optional: check `sessionStorage` before the sign-in page mounts. | Testing |

### Lead action
Approve and commit. Suggestion 1 carried.

## Open review items (added at T-04)
| Task | # | File | Issue | Severity |
|---|---|---|---|---|
| T-04 | R1-2 | src/components/ui/input.tsx, label.tsx | New shared shadcn components added by S-01, outside the story owns, so ui.md RC3 holds. No S-00 file edited, no dependency added. | Minor |
| T-04 | R1-S3 | src/components/auth/password-form.tsx | "Use 12 to 128 characters." is not a spec section 2 copy key (with T-03 R1-4). | Minor |
| T-04 | R2-S1 | tests/ui/account-password.spec.ts | Expired-session test does not prove the form's own clear path on its own. | Minor |

## E-001/S-01/T-05 round 1

Reviewer: bls-engineering:reviewer. Verdict: **Approve**.

| # | Check | Result |
|---|---|---|
| 1 | Evidence | pass. 6 commands, all `exit: 0`. The one `exit: 1` block is the planned DB-unreachable run under Notes. 42 integration tests, 7 e2e tests. |
| 2 | Owned files | pass. 4 paths under `tests/integration/auth/` and the e2e spec match `owns`. No tracked changes. |
| 3 | Contract diff | pass against origin/main 4a94c17. |
| 4 | EARS coverage | pass for S-01. Full run fails for other stories (77 of 91 missing). None of AC-47, 48, 49, 71, 72, 84, 85 missing. Each e2e test asserts its outcome (URL, copy, cookie, DB row). |
| 5 | Standards | pass, with Minor issue 1. |
| 6 | Overrides | pass. None. |

Every spec section 6 integration item has a test (same 401 for unknown and wrong, 6th try 429 with `retry-after`, success clears count, inactive and temp expired only after verify, forced change blocks other keys, sign-out deletes row, change rotates token and deletes other sessions, audit row and rollback, IP limit, health status only).

### Issues
| # | File | Line | Issue | Severity |
|---|---|---|---|---|
| 1 | tests/e2e/E-001/S01-sign-in.spec.ts | 122-140 | AC-49 uses the seed row's `temp_password_expires_at` (seed time + 7 days). On a test DB seeded more than 7 days ago the test fails with a timeout that does not name the cause. False failure, not false pass. | Minor |

### Suggestions
| # | File | Line | Suggestion | Category |
|---|---|---|---|---|
| 1 | tests/e2e/E-001/S01-sign-in.spec.ts | 83-89 | `open()` detects hydration through React's internal `__reactProps` key. A React rename would time out every e2e test. | Reliability |
| 2 | src/instrumentation.ts (S-00) | 9-11 | Build log shows "Ecmascript file had an error" for this file. Build exits 0. Cause UNVERIFIED. Check `onRequestError` compiles in production. | Out of scope |

### Lead action
Approve and commit. Issue 1 and both suggestions carried to "Open review items". CI seeds a fresh DB per run, so issue 1 affects only long-lived local test DBs.

## Open review items (added at T-05)
| Task | # | File | Issue | Severity |
|---|---|---|---|---|
| T-05 | 1 | tests/e2e/E-001/S01-sign-in.spec.ts | AC-49 depends on a seed less than 7 days old. Move the expiry forward inside the existing snapshot and restore. | Minor |
| T-05 | S1 | tests/e2e/E-001/S01-sign-in.spec.ts | Hydration check uses React's internal `__reactProps` key. | Minor |
| T-05 | S2 | src/instrumentation.ts (S-00) | "Ecmascript file had an error" in build output. Build passes. Cause unverified. | Minor |

## E-001/S-01/T-06 round 1

Reviewer: bls-engineering:reviewer. Verdict: **Request Changes**.

| # | Check | Result |
|---|---|---|
| 1 | Evidence | pass. 4 commands, all `exit: 0`. Evidence (re-run by the lead) is newer than every doc file. |
| 2 | Owned files | pass. Three new doc files under `docs/**`, none under `docs/adr/**`. |
| 3 | Contract diff | pass against origin/main 4a94c17. |
| 4 | EARS coverage | n/a until T-05 |
| 5 | Standards | pass. writing.md checks clean. |
| 6 | Overrides | pass. None. |

### Issues
| # | File | Line | Issue | Severity |
|---|---|---|---|---|
| 1 | docs/manual/E-001-room-booking.md | 25 | Lockout copy says "Try again in 15 minutes." The app shows "Too many attempts. Try again in 15 minutes." | Major |
| 2 | docs/workflows/E-001-room-booking.md | 14 | Same copy mismatch in node D. | Major |
| 3 | docs/manual/E-001-room-booking.md | 25 | Names only the 5-failure account limit. The IP block shows the same message, and the workflow leaves out the IP check, which runs first. | Minor |
| 4 | docs/manual/E-001-room-booking.md | 8 | Says sign-in opens the role home. A checked return path comes first when present. | Minor |

### Suggestions
| # | File | Line | Suggestion | Category |
|---|---|---|---|---|
| 1 | docs/workflows/E-001-room-booking.md | 17 | "password not expired": only the temporary password expires. | Docs |
| 2 | docs/manual/E-001-room-booking.md | 22 | Headers "What you see" and "What to do" use second person (writing.md W10). | Style |
| 3 | evidence E001-S01-T06.txt | 17-18 | `git diff --stat docs/` prints nothing for untracked files. | Docs |
| 4 | docs/rules/auth.md | 6 | `RETRY_AFTER_SECONDS` has no `@ears` tag (fix in src/domain/auth/rules.ts, T-03 owns). | Docs |

### Lead decisions
- Issues 1 to 4 and suggestion 1: fix in round 2.
- Suggestion 3: the card's done command changes to `git status --short docs/`.
- Suggestions 2 and 4: carried to "Open review items".

## E-001/S-01/T-06 round 2

Reviewer: bls-engineering:reviewer. Verdict: **Approve**.

| # | Check | Result |
|---|---|---|
| 1 | Evidence | pass. 4 commands, all `exit: 0`. Evidence is newer than every doc file. |
| 2 | Owned files | pass. Manual, workflow, rules doc and evidence match `owns`. openapi.yaml and erd.md regenerated with no diff. |
| 3 | Contract diff | pass against origin/main 4a94c17. |
| 4 | EARS coverage | n/a until T-05 |
| 5 | Standards | pass, with Minor issue 1. |
| 6 | Overrides | pass. None. |

Round 1 issues 1 to 4 and suggestions 1 and 3 are fixed. Suggestions 2 and 4 stay carried.

### Issues
| # | File | Line | Issue | Severity |
|---|---|---|---|---|
| 1 | docs/workflows/E-001-room-booking.md | 25 | Edge `I -->\|No\| L` goes to "Open the role home". The code opens the checked return path first when present. The manual is right; the workflow is not, for this one branch. | Minor |

### Suggestions
| # | File | Line | Suggestion | Category |
|---|---|---|---|---|
| 1 | evidence E001-S01-T06.txt | 30-33 | "Files changed" leaves out `docs/rules/auth.md`, which `pnpm docs:all` wrote. | Docs |

### Lead action
Approve and commit. Round limit reached. Issue 1 and suggestion 1 carried to "Open review items".

## Open review items (added at T-06)
| Task | # | File | Issue | Severity |
|---|---|---|---|---|
| T-06 | R1-S2 | docs/manual/E-001-room-booking.md | Table headers "What you see" and "What to do" use second person (writing.md W10). | Minor |
| T-06 | R1-S4 | src/domain/auth/rules.ts | `RETRY_AFTER_SECONDS` has no `@ears` tag, so docs/rules/auth.md shows "-". | Minor |
| T-06 | R2-1 | docs/workflows/E-001-room-booking.md | No-forced-change branch goes to the role home; the code opens the checked return path first when present. | Minor |
| T-06 | R2-S1 | evidence E001-S01-T06.txt | "Files changed" omits docs/rules/auth.md. | Minor |
