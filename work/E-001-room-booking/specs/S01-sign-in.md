---
story: E-001/S-01
epic: E-001
ears: [E-001/AC-47, E-001/AC-48, E-001/AC-49, E-001/AC-71, E-001/AC-72, E-001/AC-84, E-001/AC-85]
owns:
  - src/lib/auth/**
  - src/data/session.ts
  - src/data/sign-in-attempt.ts
  - src/domain/auth/**
  - "src/app/(auth)/**"
  - "src/app/(app)/layout.tsx"
  - "src/app/(app)/page.tsx"
  - "src/app/(app)/account/**"
  - src/app/api/health/**
  - src/components/shell/**
  - src/components/auth/**
  - tests/unit/data/session.test.ts
  - tests/unit/data/sign-in-attempt.test.ts
  - tests/unit/domain/auth/**
  - tests/unit/lib/auth/**
  - tests/integration/auth/**
  - tests/ui/sign-in.spec.ts
  - tests/ui/account-password.spec.ts
  - tests/e2e/E-001/S01-sign-in.spec.ts
depends_on: [E-001/S-00]
parallel: false
---

# Spec: E-001/S-01 Sign-in and sessions

## 1. Scope
EARS IDs covered:
- E-001/AC-47 correct email and password opens the role home.
- E-001/AC-48 5 failures in 15 minutes lock the account for 15 minutes.
- E-001/AC-49 sign-in side: a user with `must_change_password` must set a new password first. The reset action is E-001/S-03.
- E-001/AC-71 a session ends 12 hours after it starts.
- E-001/AC-72 a new password under 12 characters is rejected with "Use at least 12 characters."
- E-001/AC-84 a deactivated user gets "This account is not active."
- E-001/AC-85 wrong details get "Email or password is wrong."

Also delivered: sign-out, the role home redirect, `PageShell` (role menu, 5-minute session warning, draft keeper) and `GET /api/health`.

Out of scope:
- Admin reset, first passwords and break-glass (E-001/S-03).
- Arrival banner inside `PageShell` (E-001/S-09 mounts it).
- Pruning sessions and sign-in attempts (E-001/S-12 worker).

## 2. Page and UI
Routes: `/sign-in`, `/account/password`, `/` (role home, redirect only). `/api/health` has no UI.
Role home: platform admin to `/admin/offices`. Office admin and receptionist to `/reception`. Employee to `/rooms`.

| State | `/sign-in` | `/account/password` |
|---|---|---|
| Loading | `loading.tsx`: form skeleton, two fields and a button | `loading.tsx`: form skeleton, two fields and a button |
| Empty | Not used: the form always has fields | Not used: the form always has fields |
| Error | Error summary takes focus. Message at each field. `error.tsx` shows the `internal` copy with reference id and "Try again" | Same pattern. AC-72 copy at the new password field |
| Not found | Root `not-found.tsx` (S-00): "We could not find this item." and "Go to home" | Same |
| Success | Redirect to the checked `returnTo` path, else role home. Forced change goes to `/account/password` | Redirect to role home. `role="status"` shows "Password changed." |

`PageShell` (`src/components/shell/page-shell.tsx`) is rendered inside each `page.tsx`, not in `layout.tsx`. It holds:
- Role menu, built from the S-00 `matrix`, so a link shows only when the role holds the key.
- Session warning 5 minutes before the 12 h end, in a `role="status"` region.
- Draft keeper: form drafts in `sessionStorage` keyed by user id. Restored on the same page for the same user only. Cleared on sign-out or when another user signs in. Password fields are never stored.

| Role | Menu |
|---|---|
| Platform admin | Offices, Users, Import, Rooms, My bookings, My visits, Reception, History, Reports |
| Office admin | Reception, Rooms, My bookings, My visits, Office rooms, Users, Import, History, Reports |
| Receptionist | Reception, Rooms, My bookings, My visits, History, Reports |
| Employee | Rooms, My bookings, My visits |
| All roles | Change password, Sign out |

Breakpoints: 375 one column, full-width button, menu behind a "Menu" button. 768 auth card at fixed width, top bar menu. 1280 side menu beside page content. Auth pages are centred (allowed for auth).
Fields: `autocomplete="email"`, `current-password`, `new-password`. Paste allowed (WCAG 3.3.8). Submit disabled while pending.

| Key | Text |
|---|---|
| sign_in.title | Sign in |
| sign_in.submit | Sign in |
| sign_in.hint | Forgot your password? Ask your office admin to reset it. |
| sign_in.wrong | Email or password is wrong. |
| sign_in.inactive | This account is not active. |
| sign_in.locked | Too many attempts. Try again in 15 minutes. |
| sign_in.temp_expired | This temporary password has expired. Ask your admin for a new one. |
| session.expired | Please sign in again. |
| session.warning | Your session ends in 5 minutes. Save your work, then sign in again. |
| password.title | Set a new password |
| password.forced | Your admin reset your password. Set a new one to continue. |
| password.too_short | Use at least 12 characters. |
| password.current_wrong | Your current password is wrong. |
| password.submit | Save password |
| password.done | Password changed. |
| menu.sign_out | Sign out |

## 3. API
| Endpoint or action | Request type | Response type | Errors (RFC 9457) |
|---|---|---|---|
| `signInAction` in `src/app/(auth)/sign-in/actions.ts` | `src/contracts/auth.ts: SignInInput` | Redirect | `validation` 400, `unauthenticated` 401 (AC-85), `rule-violation` 422 (AC-84, temp expired), `locked` 429 with `Retry-After` |
| `signOutAction` in `src/app/(auth)/sign-in/actions.ts` | None: no fields | Redirect to `/sign-in` | None |
| `changePasswordAction` in `src/app/(app)/account/password/actions.ts` | `src/contracts/auth.ts: ChangePasswordInput` | Redirect | `validation` 400, `unauthenticated` 401, `rule-violation` 422 (AC-72), `version-conflict` 409, `locked` 429 |
| `GET /api/health` in `src/app/api/health/route.ts` | None | `{ status: "ok" }` | `internal` 500 |

- Every action and the route call `requirePermission` first. Sign-in, sign-out and health use `public`. Password change uses `account.password`.
- `src/lib/auth/session.ts` `getSession()` reads `__Host-session`, hashes it with SHA-256 and loads the row with its user. It fills `SessionUser` (S-00) from `users` each request, with role, office, status and `mustChangePassword`. It also returns `expiresAt` for the warning. Expired or deactivated returns null.
- `requirePermission` (S-00) refuses every key except `account.password` while `mustChangePassword` is set. Pages redirect to `/account/password`.
- Sign-in order: parse, IP limit, email lockout, load user or dummy verify, Argon2id verify. Only after a verify passes: deactivated (AC-84), then temp expired.
- Client IP: last `X-Forwarded-For` value, one trusted hop, in `src/lib/auth/client-ip.ts`.
- Idempotency: None. Sign-in only adds a session row. Password change is guarded by the current password and `version`.
- Ownership note: design keeps `password_hash` in `src/data/user.ts`, which E-001/S-03 owns. S-01 reads and writes the hash only inside `src/data/session.ts` (`verifyCredentials`, `setOwnPassword`). They return a result, never the hash. Accepted by the lead: S-01 runs before S-03.
- Seed: S-00 `prisma/seed.ts` holds a user with `must_change_password = true` and a deactivated user (AC-49, AC-84).

## 4. Data
| Table | Reads | Writes | Indexes used | Transaction |
|---|---|---|---|---|
| users | By `lower(email)` at sign-in. By id each request | Password change: `password_hash`, `must_change_password` false, `temp_password_expires_at` null, `version` + 1 | Unique `lower(email)`, PK | Yes, password change |
| sessions | By `token_hash` each request | Insert at sign-in and change. Delete at sign-out, at expiry, and the caller's other rows at change | PK `token_hash`, `user_id` | Yes |
| sign_in_attempts | Failures by `email_hash` in 15 min. Distinct `email_hash` by `ip` in 15 min | Insert on each failure. Delete the email hash's rows on success | `(email_hash, at)`, `(ip, at)` | Sign-in success only |
| audit_events | None | Insert on password change | None | Yes |

- Sign-in success: one transaction inserts the session and deletes that email hash's attempts. Invariant: the failure count runs since the last success.
- Password change: one interactive transaction. `updateMany where id and version`, 0 rows throws 409. Delete other sessions, insert the new one, write the audit row. Invariant: change and audit both or neither (AC-50).
- No ADR-0012 or ADR-0013 guard in this story. No new tables or columns.

## 5. Security
| Item | Value |
|---|---|
| Permission keys | `public` (sign-in, sign-out, health). `account.password` (self). Role home: any signed-in user |
| Scope rule | Self only. `changePasswordAction` acts on `session.user.id`, never an id from input. No `scopeFor` call: no record id in input |
| Boundary validation | `SignInInput` (email 254, password 1 to 128, `returnTo` relative path), `ChangePasswordInput` (12 to 128) |
| Passwords | Argon2id via `@node-rs/argon2` (ADR-0005). Dummy verify on unknown email. Lockout by email hash since last success, so known and unknown emails lock alike |
| IP limit | Distinct email hashes per IP in 15 min. From 30, each attempt waits 1 s more. From 100, `locked` 429 with `Retry-After`. Shared store `sign_in_attempts` (api.md RC7) |
| Sessions | 256-bit CSPRNG token. `__Host-session`, `HttpOnly`, `Secure`, `SameSite=Lax`. SHA-256 stored. 12 h absolute. New token at sign-in and password change |
| OWASP | A01 deny by default, forced change gate. A02 Argon2id and CSPRNG. A07 lockout, same message for unknown and wrong, session rotation, open redirect blocked by the `returnTo` check |
| Logging | Sign-in ok, sign-in failed (reason code), lockout, session revoke, password change. User id only. Never email, IP, password or token |

## 6. Tests
| Kind | File path | Covers |
|---|---|---|
| unit | `tests/unit/domain/auth/rules.test.ts` (T-03) | Lockout at 4 and 5 failures, 15 min edge, IP delay at 30, block at 100, length 11, 12 and 128, 12 h expiry, warning time, role home per role, temp expiry |
| unit | `tests/unit/lib/auth/*.test.ts` (T-03) | Token length, hash, cookie flags, one-hop client IP, `returnTo` fallback, dummy verify on unknown email |
| unit | `tests/unit/data/session.test.ts`, `tests/unit/data/sign-in-attempt.test.ts` (T-02) | Lookup by hash, expired row deleted, counts per window, delete on success |
| integration | `tests/integration/auth/{sign-in,password,health}.test.ts` (T-05) | Unknown and wrong email same 401. 6th try 429. Success clears count. Inactive and temp expired only after verify. Forced change blocks other keys. Sign-out deletes row. Change rotates token, deletes other sessions, writes audit. IP limit. Health returns status only |
| ui | `tests/ui/sign-in.spec.ts`, `tests/ui/account-password.spec.ts` (T-04) | Five states at 375, 768, 1280. axe zero violations. Tab order. Error summary focus. Autocomplete. Warning with `page.clock`. Drafts cleared for another user, password never stored |
| e2e | `tests/e2e/E-001/S01-sign-in.spec.ts` (T-05) | One test per ID, ID first in the title: `E-001/AC-47`, `E-001/AC-48`, `E-001/AC-49`, `E-001/AC-71`, `E-001/AC-72`, `E-001/AC-84`, `E-001/AC-85`. AC-49 uses the seed user with `must_change_password = true`. AC-71 ages `expires_at` through the test DB helper |
| evals | None: no AI output. Page speed is E-001/S-13 | |
| load | None: epic release in E-001/S-13 | |

## 7. Docs
| Docs home | Change |
|---|---|
| `docs/manual/E-001-room-booking.md` | Block "Sign in and passwords": role homes, lockout, forced change, session end, ask the office admin to reset |
| `docs/rules/` | Regenerated from `src/domain/auth/rules.ts` `@ears` tags |
| `docs/workflows/E-001-room-booking.md` | Journey "Any role signs in" |
| `docs/api/openapi.yaml` | None: `/api/health` is registered in S-00. Regenerate shows no diff |

## 8. Done
| Command | Expected output |
|---|---|
| `pnpm tsc --noEmit` | exit 0 |
| `pnpm lint` | exit 0, no warnings |
| `pnpm vitest run tests/unit/domain/auth tests/unit/lib/auth tests/unit/data/session.test.ts tests/unit/data/sign-in-attempt.test.ts` | all pass |
| `pnpm vitest run tests/integration/auth` | all pass |
| `pnpm playwright test tests/ui/sign-in.spec.ts tests/ui/account-password.spec.ts tests/e2e/E-001/S01-sign-in.spec.ts` | all pass |
| `bash scripts/ci/check-auth-in-actions.sh` | PASS |
| `bash scripts/ci/check-test-tree.sh` | PASS |
| `bash scripts/ci/check-no-console.sh` | PASS |
| `bash scripts/ci/check-ac-coverage.sh` | PASS for the seven IDs |
| `git diff --exit-code origin/main -- prisma src/contracts` | exit 0 (no contract change) |

## Tasks
| Task | Type | Specialist | Section | Note |
|---|---|---|---|---|
| T-01 | contract | data-engineer | 3, 4 | None: reads contracts |
| T-02 | data | api-engineer | 4 | `src/data/session.ts` (lookup, insert, delete, `verifyCredentials`, `setOwnPassword` in one tx), `src/data/sign-in-attempt.ts`. Unit tests |
| T-03 | api | api-engineer | 3, 5 | `src/domain/auth/rules.ts` with `@ears` tags, `src/lib/auth/**`, sign-in and password `actions.ts`, health route. Unit tests |
| T-04 | ui | ui-engineer | 2 | Sign-in and password pages, `(app)/layout.tsx`, role home `page.tsx`, `PageShell`, `src/components/auth/**`, both ui specs. Excludes `actions.ts` |
| T-05 | tests | test-engineer | 6 | Integration tests, e2e spec, coverage check |
| T-06 | docs | test-engineer | 7 | Manual block, regenerate rules docs, workflow journey |
