---
story: E-001/S-03
epic: E-001
ears: [E-001/AC-02, E-001/AC-03, E-001/AC-04, E-001/AC-05, E-001/AC-06, E-001/AC-13, E-001/AC-14, E-001/AC-15, E-001/AC-16, E-001/AC-17, E-001/AC-19, E-001/AC-56, E-001/AC-58, E-001/AC-59, E-001/AC-89]
owns:
  - src/data/user.ts
  - src/domain/user/**
  - src/domain/access/**
  - "src/app/(app)/admin/users/**"
  - src/components/users/**
  - src/components/host-picker/**
  - scripts/break-glass.ts
  - tests/unit/data/user.test.ts
  - tests/unit/domain/user/**
  - tests/unit/domain/access/**
  - tests/integration/user/**
  - tests/ui/admin-users.spec.ts
  - tests/e2e/E-001/S03-users-roles.spec.ts
depends_on: [E-001/S-00, E-001/S-01]
parallel: true
---

# Spec: E-001/S-03 Users and roles

## 1. Scope
EARS IDs covered:
- E-001/AC-02 a platform admin manages every office, room and user.
- E-001/AC-03 an office admin manages only their own office.
- E-001/AC-04 a receptionist acts only in their own office.
- E-001/AC-05 another office's record returns 404. Proven at permission level by the authz matrix test.
- E-001/AC-06 an employee gets 403 on reports and history. Proven at permission level here. E-001/S-10 and E-001/S-11 e2e also cite it.
- E-001/AC-13 an office can have one or more office admins.
- E-001/AC-14 only a platform admin assigns the office admin role (office create is E-001/S-02).
- E-001/AC-15 an office admin creates employees and receptionists for their own office only.
- E-001/AC-16 an office admin assigning platform admin or office admin gets 403.
- E-001/AC-17 removing the last office admin gets "Each office needs at least one admin."
- E-001/AC-19 each profile stores phone and desk.
- E-001/AC-56 removing a user deactivates the account and keeps their history.
- E-001/AC-58 deactivation cancels the user's future bookings.
- E-001/AC-59 hosted future visits each need a new host before deactivation completes.
- E-001/AC-89 a used email gets "This email is already in use."

Also delivered: admin reset (AC-49 action side), bulk issue of first passwords (ADR-0011), the host picker, the last-platform-admin guard and `scripts/break-glass.ts`.
`src/domain/access/` holds only the last-office-admin and last-platform-admin guards. Reach lives in S-00 `permissions.ts`.

Out of scope:
- Sign-in side of AC-49 (E-001/S-01). User CSV import (E-001/S-04).
- Walk-in use of the host picker (E-001/S-09). History and report pages (E-001/S-10, E-001/S-11).

## 2. Page and UI
Routes: `/admin/users` (list, create, issue first passwords), `/admin/users/[userId]` (edit, reset, deactivate). Both send `Cache-Control: no-store`.

| State | Users list | User detail |
|---|---|---|
| Loading | `loading.tsx`: table skeleton, 10 rows | Form skeleton |
| Empty | "No users in this office yet. Add a user." and "Add user" | Not used: a user always has fields |
| Error | `error.tsx`: `internal` copy with reference id and "Try again". Forms: error summary takes focus, message at each field | Same |
| Not found | "We could not find this item." and "Back to users" | Same, for a missing or other-office user (AC-05) |
| Success | `role="status"`: "User saved." | "User saved.", "User deactivated." or the temp password panel |

- List columns: name, email, role, office, status (Active, Deactivated, No password yet). Cursor pages of 100, ordered by name then id. "Load more" button.
- Create and edit fields: name, email, role, office, phone, desk. Office admins see role limited to employee and receptionist. Their `role` and `office_id` are read-only on edit.
- Reset: AlertDialog "Reset password for <name>". Then the temp password panel with a Copy button.
- Issue first passwords: tick users with no password, re-enter your own password, then the browser saves a CSV (name, email, temporary password).
- Deactivate: AlertDialog "Deactivate <name>". It states how many future bookings will be cancelled. It lists each future hosted visit with a host picker. The button stays disabled until every visit has a host.
- Host picker (`src/components/host-picker/`): combobox scoped to one office. Shows name and desk only. Options load server side per office and filter in the browser.

Breakpoints: 375 table stacks into cards, one-column form. 768 two-column form. 1280 list with a filter bar above.

| Key | Text |
|---|---|
| users.empty | No users in this office yet. Add a user. |
| user.add | Add user |
| user.save | Save user |
| user.email_taken | This email is already in use. |
| user.last_office_admin | Each office needs at least one admin. |
| user.last_platform_admin | The company needs at least one platform admin. |
| user.forbidden | You do not have access to this. |
| reset.button | Reset password |
| temp.panel | Shown once. Give it to the user in person. |
| temp.copy | Copy |
| issue.button | Issue first passwords |
| issue.confirm | Enter your own password to confirm. |
| issue.wrong_password | Your password is wrong. |
| issue.warning | The file holds live passwords. Hand them out, then delete the file. |
| deactivate.bookings | Their N future bookings will be cancelled. |
| deactivate.hosts | Pick a new host for each visit before you deactivate. |
| deactivate.button | Deactivate user |
| version | Someone changed this. Reload to see it. |

## 3. API
| Endpoint or action | Request type | Response type | Errors (RFC 9457) |
|---|---|---|---|
| `createUserAction` in `src/app/(app)/admin/users/actions.ts` | `src/contracts/user.ts: UserCreateInput` | `UserDetail` | `validation` 400, `forbidden` 403 (AC-16), `not-found` 404, `rule-violation` 422 (AC-89) |
| `issuePasswordsAction` in the same file | `IssuePasswordsInput` | CSV text, never stored | `validation` 400, `forbidden` 403, `locked` 429 |
| `updateUserAction` in `src/app/(app)/admin/users/[userId]/actions.ts` | `UserUpdateInput` | `UserDetail` | As create, plus `version-conflict` 409 and `rule-violation` 422 (AC-17, last platform admin) |
| `resetPasswordAction` in the same file | `PasswordResetInput` | Temp password and expiry, shown once | `forbidden` 403, `not-found` 404 |
| `deactivateUserAction` in the same file | `DeactivateInput` | `UserDetail` | `forbidden` 403, `not-found` 404, `version-conflict` 409, `rule-violation` 422 (AC-17, AC-59, last platform admin) |

- Each action parses first, then calls `requirePermission(session, "user.manage")`, then `scopeFor` on the target user.
- List and picker reads return `UserListItem`, `UserDetail` and `HostOption`. `password_hash` never leaves `src/data/user.ts`.
- Reset: 16 alphanumeric CSPRNG characters, `must_change_password` true, expiry 7 days.
- Bulk issue: only users with no password, max 500 per run. Argon2id hashing runs before the transaction (ADR-0011). A wrong admin password counts as a sign-in failure, so lockout applies.
- `scripts/break-glass.ts --email <address>` runs on the host with `DATABASE_URL_MIGRATOR`. It creates the first platform admin, or resets an existing one. It prints the temp password once and writes an audit event and a log line.
- Idempotency: None. Create is guarded by unique `lower(email)`. Bulk issue updates only rows where `password_hash is null`. Edits use `version`.
- Contract: `UserListQuery` (office, role, status, cursor) is in S-00.

## 4. Data
| Table | Reads | Writes | Indexes used | Transaction |
|---|---|---|---|---|
| users | Q1 by `lower(email)`. Q2 by office. Q3 active admins of office | Insert. Update with `version`. Password fields. `deactivated_at` | Unique `lower(email)`, `(office_id, role)` | Yes |
| offices | Lock row for the office admin guard | None | PK | Yes |
| sessions | None | Delete all of the target's rows on reset and deactivation | `user_id` | Same tx |
| sign_in_attempts | None | Delete the target's email hash rows on reset | `(email_hash, at)` | Same tx |
| bookings | Target's confirmed future bookings | Set `status` cancelled. Rows stay (AC-57) | `(owner_id, starts_at)` | Deactivation tx |
| visits | Target's future hosted visits | Set `host_id` per `hostReassignments` | `(host_id, visit_date)` | Deactivation tx |
| audit_events | None | One row per change, one per issued user | None | Same tx (AC-50) |

- Demote or deactivate an office admin: lock the office row, count active admins. Invariant: one active admin per office (AC-17, ADR-0012).
- Demote or deactivate a platform admin: `pg_advisory_xact_lock(2, 0)`, count active platform admins. Invariant: one active platform admin (ADR-0012).
- Deactivate: one tx. Lock office, admin guard, cancel bookings, reassign hosts, reject if any visit is unmapped, set `deactivated_at`, delete sessions. Invariant: no future bookings or unassigned hosted visits (AC-58, AC-59).
- New host must be active, in the visit's office, and not the target.
- User edits: `updateMany where id and version`, 0 rows returns 409. Unique violation maps to AC-89 copy.
- Bulk issue: one tx, per user `updateMany where id and password_hash is null`. Users with 0 rows are left out of the file, not an error.

## 5. Security
| Item | Value |
|---|---|
| Permission keys | `user.manage`. Platform admin: any user. Office admin: employees and receptionists of their office only |
| Scope rule | `scopeFor(session, { officeId: target.office_id })`. Other office returns 404 (AC-05). Office admin on an admin of their office returns 403. Assigning `platform_admin` or `office_admin` returns 403 (AC-16). Changed `role` or `office_id` from an office admin returns 403 |
| Boundary validation | `UserCreateInput`, `UserUpdateInput`, `PasswordResetInput`, `IssuePasswordsInput` (`userIds` max 500), `DeactivateInput`, `Id`. Name 120, email 254, phone 30, desk 60 |
| Secrets | Temp passwords shown once, never logged or stored in plain text. `no-store` on both pages and the issue response. Reset and deactivation delete the target's sessions |
| OWASP | A01 deny by default, office scope, tiered roles. A02 CSPRNG and Argon2id. A04 guards inside transactions. A07 re-auth for bulk issue, session revoke |
| Logging | Role change, deactivation, password reset, issue count, break-glass. User ids only. Never names, emails, phones, desks or passwords |

## 6. Tests
| Kind | File path | Covers |
|---|---|---|
| unit | `tests/unit/domain/user/rules.test.ts`, `tests/unit/domain/access/rules.test.ts` (T-03) | Allowed roles per caller (AC-15, AC-16), field limits (AC-19), unmapped visits (AC-59), new host checks, last admin guards (AC-17) |
| unit | `tests/unit/data/user.test.ts` (T-02) | Unique violation to AC-89, 0 rows to 409, DTOs never hold `password_hash` |
| integration | `tests/integration/user/{create,edit,reset,issue,deactivate,guards,break-glass}.test.ts` (T-05) | Reset clears sessions and attempts. Issue skips users with a password. Deactivate cancels bookings and reassigns visits. Two parallel demotions of the last two admins: exactly one succeeds. Break-glass audit row |
| integration | `tests/integration/user/authz-matrix.test.ts` (T-05) | Uses the S-00 walker over every key, role, same office and other office: 404 (AC-05), 403 (AC-06, AC-16), reach (AC-02 to AC-04) |
| ui | `tests/ui/admin-users.spec.ts` (T-04) | Five states at 375, 768, 1280. axe zero violations. Tab order. Combobox by keyboard. Temp panel Copy. Deactivate button disabled until all hosts picked |
| e2e | `tests/e2e/E-001/S03-users-roles.spec.ts` (T-05) | One test per ID, ID first in the title: `E-001/AC-02`, `E-001/AC-03`, `E-001/AC-04`, `E-001/AC-05`, `E-001/AC-06`, `E-001/AC-13`, `E-001/AC-14`, `E-001/AC-15`, `E-001/AC-16`, `E-001/AC-17`, `E-001/AC-19`, `E-001/AC-56`, `E-001/AC-58`, `E-001/AC-59`, `E-001/AC-89`. AC-06 here: employee on `/admin/users` sees the `forbidden` copy |
| evals | None: no AI output or performance NFR | |
| load | None: epic release in E-001/S-13 | |

## 7. Docs
| Docs home | Change |
|---|---|
| `docs/manual/E-001-room-booking.md` | Block "Manage users": roles, create, reset, issue first passwords, deactivate and pick new hosts |
| `docs/runbook/break-glass.md` | How to run `scripts/break-glass.ts` on the host |
| `docs/rules/` | Regenerated from `src/domain/user/rules.ts` and `src/domain/access/rules.ts` `@ears` tags |
| `docs/workflows/E-001-room-booking.md` | Journeys "Office admin runs one office" and "Platform admin sets up the company" (user steps) |

## 8. Done
| Command | Expected output |
|---|---|
| `pnpm tsc --noEmit` | exit 0 |
| `pnpm lint` | exit 0, no warnings |
| `pnpm vitest run tests/unit/domain/user tests/unit/domain/access tests/unit/data/user.test.ts` | all pass |
| `pnpm vitest run tests/integration/user` | all pass |
| `pnpm playwright test tests/ui/admin-users.spec.ts tests/e2e/E-001/S03-users-roles.spec.ts` | all pass |
| `bash scripts/ci/check-auth-in-actions.sh` | PASS |
| `bash scripts/ci/check-test-tree.sh` | PASS |
| `bash scripts/ci/check-no-console.sh` | PASS |
| `bash scripts/ci/check-ac-coverage.sh` | PASS for the fifteen IDs |
| `git diff --exit-code origin/main -- prisma src/contracts` | exit 0 (no contract change) |

## Tasks
| Task | Type | Specialist | Section | Note |
|---|---|---|---|---|
| T-01 | contract | data-engineer | 3, 4 | None: reads contracts |
| T-02 | data | api-engineer | 4 | `src/data/user.ts`: list, create, versioned edit, reset, bulk issue, deactivation tx, host options. Unit tests |
| T-03 | api | api-engineer | 3, 5 | `src/domain/user/rules.ts`, `src/domain/access/rules.ts` with `@ears` tags, both `actions.ts`, `scripts/break-glass.ts`. Unit tests |
| T-04 | ui | ui-engineer | 2 | User pages, AlertDialogs, temp panel, issue flow, host picker, `tests/ui/admin-users.spec.ts`. Excludes `actions.ts` |
| T-05 | tests | test-engineer | 6 | Integration tests with the authz matrix, e2e spec, coverage check |
| T-06 | docs | test-engineer | 7 | Manual block, break-glass runbook, regenerate rules docs, workflow journeys |
