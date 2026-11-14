---
story: E-001/S-00
epic: E-001
ears:
  - E-001/AC-01
owns:
  - package.json
  - pnpm-lock.yaml
  - tsconfig.json
  - next.config.ts
  - eslint.config.mjs
  - vitest.config.ts
  - playwright.config.ts
  - tsdoc.json
  - .nvmrc
  - .env.example
  - .gitignore
  - .github/**
  - Dockerfile
  - docker-compose.yml
  - components.json
  - prisma/**
  - src/contracts/**
  - src/lib/db.ts
  - src/lib/env.ts
  - src/lib/errors.ts
  - src/lib/logger.ts
  - src/lib/http.ts
  - src/lib/idempotency.ts
  - src/lib/openapi.ts
  - src/lib/time.ts
  - src/lib/audit.ts
  - src/components/ui/**
  - src/app/globals.css
  - src/app/layout.tsx
  - src/app/global-error.tsx
  - src/app/not-found.tsx
  - scripts/gen-openapi.ts
  - scripts/gen-rules-doc.ts
  - tests/unit/contracts/**
  - tests/unit/lib/**
  - tests/integration/contracts/**
  - tests/integration/house/**
  - tests/ui/fixtures.ts
depends_on: []
parallel: false
---

# Spec: E-001/S-00 Contracts

## 1. Scope
EARS IDs covered:
- E-001/AC-01 four fixed roles, enforced as the `Role` enum and the `permissions.ts` matrix.

Also delivered (no EARS line of its own): the Next.js scaffold copied from the plugin profile, the schema with every raw-SQL object in design.md, the zod contracts every story reads, the test seed, tokens and house tests.

Out of scope:
- Every page and route. Each story builds its own.
- Business rules in `src/domain/**`. Each story writes its own.
- Session lookup and sign-in (E-001/S-01). `requirePermission` takes a session type from here, S-01 fills it.

## 2. Page and UI
Route: None: S-00 has no page. Root `layout.tsx`, `global-error.tsx` and `not-found.tsx` are shells only.

Tokens for `src/app/globals.css` (palette reset, semantic roles per `standards/ui.md`):

| Token group | Names |
|---|---|
| Colour roles | `background`, `foreground`, `muted`, `primary`, `accent`, `destructive`, `border`, `ring`, each surface with `-foreground` |
| Status | `status-free`, `status-booked`, `status-expected`, `status-checked-in`, `status-not-checked-out`, each with `-foreground`. Always paired with a text label |
| Type | One family via `next/font`. 12, 14, 16, 18, 24, 32, 40 px |
| Space, radius, shadow, motion | 4 px base. Radius `sm`, `md`, `lg`. Shadows for overlays only. 150, 200, 300 ms with `motion-safe:` |
| Focus | `ring` at 2 px, contrast 3:1 or more against `background` |

All foreground and background pairs meet 4.5:1. Breakpoints: 375, 768, 1280.
Copy: `global-error.tsx` shows the `internal` copy from design.md with the reference id. `not-found.tsx` shows "We could not find this item." and "Go to home".

## 3. API
No handler code. One schema set per design route map row, all `.strict()` with max lengths from design.md.

| File in `src/contracts/` | Schemas and DTOs |
|---|---|
| `common.ts` | `Id` (uuid), `Cursor`, `PageQuery` (limit 1 to 100), `IdempotencyKey`, `ProblemType` union of the 11 types in design.md |
| `auth.ts` | `SignInInput` (email 254, password 12 to 128 on change, 1 to 128 on sign-in, `returnTo` relative path), `ChangePasswordInput`, `SessionUser` |
| `office.ts` | `OfficeCreateInput`, `OfficeUpdateInput` (with `version`), `OfficeHoursInput`, `Office`, `OfficeHours` |
| `room.ts` | `RoomInput`, `RoomUpdateInput` (`version`, `confirmSizeCut`), `RoomRemoveInput`, `Room` |
| `user.ts` | `UserListQuery` (office, role, status, cursor), `UserCreateInput`, `UserUpdateInput`, `PasswordResetInput`, `IssuePasswordsInput` (`userIds` max 500, `adminPassword`), `DeactivateInput` (`hostReassignments`), `UserListItem`, `UserDetail`, `HostOption` (id, name, desk only) |
| `import.ts` | `ImportUploadInput` (`officeId`, kind rooms or users, 2 MB), `RoomCsvRow`, `UserCsvRow` (full-cell phone and floor patterns), `ImportRowError`, `ImportResult` |
| `booking.ts` | `RoomsQuery` (office, date, minSize), `RoomDay`, `BookingNewQuery` (roomId, startsAt from a slot link), `BookingCreateInput`, `BookingUpdateInput`, `BookingCancelInput`, `Booking` |
| `series.ts` | `SeriesCreateInput` (pattern daily or weekly, `untilDate`), `SeriesCancelInput` (scope one or future), `SeriesResult` (booked, clashes, closedDays) |
| `visit.ts` | `VisitCreateInput`, `VisitCancelInput`, `WalkInInput`, `CheckInInput`, `CheckOutInput`, `VisitSearchInput` (POST body only), `VisitSeenInput`, `Visit`, `TodayView`, `ArrivalNotice`, `BadgeView` (visitor name, host name, office name, date) |
| `history.ts` | `HistoryQuery`, `AuditEventView` (visitor as short reference, plain verb) |
| `report.ts` | `ReportQuery` (office, ISO week start), `WeeklyReport` (raw minutes and counts) |
| `permissions.ts` | `Role`, `Permission`, `matrix`, `requirePermission(session, perm)`, `scopeFor(session, resource)` |

Every update, change, cancel and remove input carries `version` (office, room, user, booking, visit).
Only public route: `GET /api/health` returns `{ status: "ok" }`, registered in `src/lib/openapi.ts`. Server actions are not in OpenAPI.

## 4. Data
Migration `prisma/migrations/<timestamp>_e001_init/`. Prisma 7 names. Every table per the design data design table: snake_case plural, uuid v7 from the app, `created_at`, `updated_at`, `created_by`.

| Table | Keys and indexes | Raw SQL in migration |
|---|---|---|
| offices | unique `name` | None |
| office_hours | PK `(office_id, weekday)` | CHECK `opens_at < closes_at` |
| rooms | partial unique `(office_id, lower(name)) where deleted_at is null` | partial unique, CHECK `size >= 1` |
| users | unique `lower(email)`, `(office_id, role)` | CHECK `office_id` null only for `platform_admin` |
| sign_in_attempts | `(email_hash, at)`, `(ip, at)` | None |
| sessions | PK `token_hash`, `user_id`, `expires_at` | None |
| bookings | `(room_id, starts_at)`, `(owner_id, starts_at)`, `series_id` | `btree_gist` extension, exclusion constraint from ADR-0006, CHECK `starts_at < ends_at`, CHECK `attendees >= 1` |
| booking_series | `owner_id`, `room_id` | None |
| visits | `(office_id, visit_date)`, `(host_id, visit_date)`, `checked_in_by`, three partial indexes from design.md. `name`, `email`, `phone`, `company` nullable for the purge | CHECKs tying `status` to `checked_in_at` and `checked_out_at`, CHECK `name` not null while `anonymised_at` is null |
| audit_events | `(office_id, at desc, id desc)`, `(at desc, id desc)`, `(entity_type, entity_id)` | row trigger on UPDATE and DELETE, statement trigger on TRUNCATE |
| idempotency_keys | unique `(user_id, scope, key)` | None |
| job_runs | unique `(job, run_date)` | None |

Roles and grants (raw SQL): `app_owner` owns the schema. No role but `app_owner` gets TRUNCATE.
- `app_web`: SELECT, INSERT, UPDATE on every table except `audit_events` (INSERT, SELECT only) and `job_runs` (SELECT only). DELETE on `sessions`, `sign_in_attempts`, `idempotency_keys`.
- `app_worker`: SELECT on `offices`, `visits`. UPDATE on `visits`. INSERT, SELECT on `audit_events`. INSERT, SELECT, UPDATE on `job_runs`. SELECT, DELETE on `sessions`, `idempotency_keys`, `sign_in_attempts`.
Transaction: None: S-00 has no runtime writes.
Test seed `prisma/seed.ts`: 2 offices (`Asia/Kolkata`, `Europe/London`), hours Mon to Fri 08:00 to 20:00, 4 rooms each, one user per role per office plus one platform admin, one user with `must_change_password = true` (AC-49), one deactivated user (AC-84), today's bookings and visits, visits older than 90 days for the purge test.

## 5. Security
| Item | Value |
|---|---|
| Roles | `platform_admin`, `office_admin`, `employee`, `receptionist`, plus `system` for the worker |
| Matrix | One row per permission key in the design route map. Deny by default. `office.hours` for `office_admin` is off until Open point 8 is signed |
| Boundary validation | Every schema `.strict()`. Max lengths: name 120, email 254, phone 30, desk 60, password 128 |
| Secrets | `src/lib/env.ts` parses `DATABASE_URL_WEB`, `DATABASE_URL_WORKER`, `DATABASE_URL_MIGRATOR`, `APP_ORIGIN`. `.env.example` holds names only |
| Headers | `next.config.ts`: nonce CSP, HSTS, `nosniff`, `Referrer-Policy`. `serverActions.allowedOrigins` from `APP_ORIGIN`, `serverActions.bodySizeLimit` 2 MB for CSV import |
| OWASP | A01 deny by default. A03 zod plus Prisma, `$queryRawUnsafe` banned in `eslint.config.mjs`. A05 env validated at start. A08 lockfile committed |

## 6. Tests
| Kind | File path | Covers |
|---|---|---|
| unit | `tests/unit/contracts/*.test.ts` (T-01) | Each schema accepts a valid sample and rejects each bad field. Permissions matrix for every role and key, E-001/AC-01 |
| unit | `tests/unit/lib/{db,errors,logger,http,env,time}.test.ts` (T-05) | House tests per standards: retry on P2034 and 40001, `instance` equals request id, JSON log keys and redaction, backoff cap, env failure, zoned time helpers and DST |
| integration | `tests/integration/contracts/migration.test.ts` (T-05) | Migration applies on an empty DB, seed runs, every raw-SQL object exists, two overlapping confirmed bookings fail with 23P01, audit UPDATE, DELETE and TRUNCATE fail |
| integration | `tests/integration/house/{routes,headers,authz-matrix}.test.ts` (T-05) | No stack in responses, `limit=101` gives 400, security headers, authz matrix walker that later stories extend |
| ui | `tests/ui/fixtures.ts` (T-05) | Shared axe fixture with `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` |
| e2e | None: no page | |
| evals | None: no AI or performance NFR | |
| load | None: epic release only | |

## 7. Docs
| Docs home | Change |
|---|---|
| `docs/ui/interface-rules.md` | Written from the tokens: colour roles, status labels, type, states, copy rules |
| `docs/db/erd.md` | Generated from `prisma/schema.prisma` |
| `docs/api/openapi.yaml` | Generated: `/api/health` only |

## 8. Done
| Command | Expected output |
|---|---|
| `pnpm install --frozen-lockfile` | exit 0 |
| `pnpm tsc --noEmit` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm prisma validate` | exit 0 |
| `pnpm prisma migrate reset --force && pnpm prisma db seed` (test DB only) | exit 0, seed summary printed |
| `bash scripts/ci/check-fk-index.sh` | PASS |
| `bash scripts/ci/check-versions.sh` | PASS |
| `pnpm vitest run tests/unit/contracts tests/unit/lib tests/integration/contracts tests/integration/house` | all pass |
| `pnpm docs:openapi && git diff --exit-code docs/api/openapi.yaml` | exit 0 after commit |
| `docker compose config` | exit 0 |

## Tasks
| Task | Type | Specialist | Section | Note |
|---|---|---|---|---|
| T-01 | contract | data-engineer | 3, 4 | Scaffold from the plugin profile (configs, `.github/`, Docker files, `src/lib/` starters). `schema.prisma`, every `src/contracts/*.ts`, `permissions.ts`, contract unit tests |
| T-02 | data | data-engineer | 4 | Migration with all raw SQL, DB roles and grants, `src/lib/db.ts`, `src/lib/audit.ts`, `prisma/seed.ts` |
| T-03 | api | api-engineer | 3 | `src/lib/openapi.ts`, `scripts/gen-openapi.ts`, `src/lib/time.ts` (ADR-0009), `next.config.ts` headers |
| T-04 | ui | ui-engineer | 2 | Tokens in `globals.css`, shadcn `components.json` and `src/components/ui/**`, root layout, global error, not found |
| T-05 | tests | test-engineer | 6 | House tests, migration test, axe fixture |
| T-06 | docs | test-engineer | 7 | Interface rules, ERD, OpenAPI |
