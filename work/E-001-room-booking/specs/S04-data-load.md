---
story: E-001/S-04
epic: E-001
ears: [E-001/AC-60, E-001/AC-61, E-001/AC-62, E-001/AC-63, E-001/AC-64]
owns:
  - src/data/import.ts
  - src/domain/import/**
  - "src/app/(app)/admin/import/**"
  - src/components/import/**
  - scripts/seed.ts
  - tests/fixtures/csv/**
  - tests/unit/data/import.test.ts
  - tests/unit/domain/import/**
  - tests/integration/import/**
  - tests/ui/admin-import.spec.ts
  - tests/e2e/E-001/S04-data-load.spec.ts
depends_on: [E-001/S-00, E-001/S-01]
parallel: true
---

# Spec: E-001/S-04 Data load

## 1. Scope
EARS IDs covered:
- E-001/AC-60 a one-time seed script loads offices, rooms and users from the client sheet saved as CSV.
- E-001/AC-61 a valid rooms or users CSV adds every row.
- E-001/AC-62 any bad row means nothing is imported, and each bad row is listed with row, column and reason.
- E-001/AC-63 CSV rows get the same role and office limits as single entries.
- E-001/AC-64 a file over 5,000 rows gets "Upload at most 5,000 rows at a time."

Seed and import share one validator in `src/domain/import/` (ADR-0008).

Out of scope:
- First passwords for imported users (E-001/S-03 bulk issue). Imported users start with no password.
- Offices by CSV on the import screen. Only the seed script creates offices.
- Updating existing rows. Import only adds. Excel files (ADR-0008).

## 2. Page and UI
Route: `/admin/import` (`import.run`). Sends `Cache-Control: no-store`.

| State | What the user sees |
|---|---|
| Loading | `loading.tsx`: form skeleton. While a file is checked: button disabled and `role="status"` says "Checking your file." |
| Empty | Not used: the form always has fields. The error table shows only when there are bad rows |
| Error | File errors at the file field. Row errors: summary "Nothing was imported. Fix these rows and upload the file again." takes focus, then a table of row, column and reason. `error.tsx`: `internal` copy with reference id and "Try again" |
| Not found | Root `not-found.tsx`: "We could not find this item." and "Go to home". A target office outside reach also gives 404 (AC-05) |
| Success | `role="status"`: "Imported N rows." For users, a link "Issue first passwords" to `/admin/users` |

- Form fields: kind (Rooms or Users, radio), office (select for platform admins, fixed for office admins), file (`accept=".csv"`), button "Import rows".
- The page lists the required columns for the chosen kind. Row numbers count the header as row 1.
- Error cells never echo the cell value. They show the column name and a plain reason.

Breakpoints: 375 one column, error table stacks into cards. 768 kind and office side by side. 1280 form beside the column guide.

| Key | Text |
|---|---|
| import.title | Import rooms or users |
| import.submit | Import rows |
| import.checking | Checking your file. |
| import.done | Imported N rows. |
| import.failed | Nothing was imported. Fix these rows and upload the file again. |
| import.too_many | Upload at most 5,000 rows at a time. |
| import.too_big | Upload a file of at most 2 MB. |
| import.unreadable | We could not read this file. Save it as CSV and try again. |
| import.columns | The file needs these columns: <list>. |
| import.busy | Another import for this office is running. Try again in a minute. |
| import.race | Some rows now clash with data added since you uploaded. Upload the file again. |
| row.required | This field is empty. |
| row.too_long | This value is too long. |
| row.bad_format | This value is not in the right format. |
| row.formula | This cell starts with a character that is not allowed. |
| row.duplicate | This value appears twice in the file. |
| row.email_taken | This email is already in use. |
| row.room_taken | A room with this name already exists in this office. |
| row.role_not_allowed | You cannot give this role. |
| row.size_min | Size must be at least 1. |

## 3. API
| Endpoint or action | Request type | Response type | Errors (RFC 9457) |
|---|---|---|---|
| `importAction` in `src/app/(app)/admin/import/actions.ts` | `src/contracts/import.ts: ImportUploadInput` | `ImportResult` | `validation` 400 (size, shape), `forbidden` 403, `not-found` 404, `rule-violation` 422 (AC-62 with `ImportRowError[]`, AC-64, busy, race) |
| `scripts/seed.ts --dir <folder>` | `offices.csv`, `rooms.csv`, `users.csv` | Printed summary, exit 0. Row errors printed, exit 1 | Not HTTP |

- The action parses first, then calls `requirePermission(session, "import.run")`, then `scopeFor` on the target office.
- Steps: read the file with `csv-parse` (sync). Reject over 5,000 rows (AC-64). Parse each row with `RoomCsvRow` or `UserCsvRow`. Run the row rules. Check existing emails and room names. Return every `ImportRowError` if any. Only then open the transaction.
- Row rules in `src/domain/import/rules.ts`: required fields, lengths, formula cells (`= - @ \t \r` first, except full-cell `^\+?[0-9 ]{6,30}$` in phone and `^-?[0-9]{1,3}$` in floor), duplicates inside the file, role reach (AC-63).
- AC-63: office admins may import only employee and receptionist rows. `platform_admin` rows are refused on the screen. Platform admins come from the seed or break-glass.
- Seed: refuses to run if any office exists ("The database already has offices. The seed runs once only."). Rooms and users files carry an `office` column. The seed resolves it, drops it, then parses the rest with the same row schemas. Offices map onto `OfficeCreateInput` and `OfficeHoursInput`. Runs with `DATABASE_URL_MIGRATOR`.
- Idempotency: None. A repeat upload fails on the unique email and room name rules, so nothing is added twice.
- Contract: `ImportUploadInput.officeId` is in S-00 (target office for the lock and the AC-63 check).
- Config: `serverActions.bodySizeLimit` 2 MB is set in `next.config.ts` by S-00.

## 4. Data
| Table | Reads | Writes | Indexes used | Transaction |
|---|---|---|---|---|
| users | Existing `lower(email)` for the file's emails | `createMany`, `password_hash` null | Unique `lower(email)` | Yes |
| rooms | Live names of the office | `createMany` | Partial unique `(office_id, lower(name)) where deleted_at is null` | Yes |
| offices | Target office by id | Seed only: insert | PK, unique `name` | Yes |
| office_hours | None | Seed only: insert | PK `(office_id, weekday)` | Yes |
| audit_events | None | `createMany`, one row per created record | None | Same tx (AC-50) |

- Import: `pg_try_advisory_xact_lock(1, hashtext(office_id::text))` first. False returns the busy copy. Then one transaction with `createMany` and a 30 s timeout. Invariant: all rows or none (AC-62, ADR-0013).
- All checks and parsing run before the transaction. Nothing is hashed inside.
- A unique violation inside the transaction rolls back everything and returns the race copy.
- Seed: one transaction for all three files, same 30 s timeout. Any error writes nothing.
- No new tables or columns.

## 5. Security
| Item | Value |
|---|---|
| Permission keys | `import.run`: same reach as `user.manage`. One run per office at a time. Seed runs from the host shell outside the web app |
| Scope rule | `scopeFor(session, { officeId })` on the target office. Other office returns 404 (AC-05). Row roles checked against the caller (AC-63) |
| Boundary validation | `ImportUploadInput` (2 MB, kind rooms or users), `RoomCsvRow`, `UserCsvRow`. File parsed, never trusted by MIME type |
| Limits | 2 MB, 5,000 rows, one import per office, 30 s transaction |
| OWASP | A01 office scope and role reach. A03 CSV formula injection and Prisma only. A04 all or nothing, advisory lock |
| Logging | Import result: office id, user id, kind, row count, row numbers and reason codes. Never cell values |

## 6. Tests
| Kind | File path | Covers |
|---|---|---|
| unit | `tests/unit/domain/import/rules.test.ts` (T-03) | Required, lengths, formula cells and the two full-cell patterns, duplicates in file, role reach (AC-63), 5,000 and 5,001 rows (AC-64) |
| unit | `tests/unit/data/import.test.ts` (T-02) | Lock false to busy, unique violation to race copy, audit rows per record |
| integration | `tests/integration/import/{rooms,users,lock,seed}.test.ts` (T-05) | Valid files add every row. One bad row at row 4,999 imports nothing. Two parallel imports for one office: one gets busy. Two offices both pass. 2 MB limit. Office admin 404 on another office. Seed loads fixtures, second run refused |
| ui | `tests/ui/admin-import.spec.ts` (T-04) | Five states at 375, 768, 1280. axe zero violations. Tab order. Error summary focus. Error table as cards at 375 |
| e2e | `tests/e2e/E-001/S04-data-load.spec.ts` (T-05) | One test per ID, ID first in the title: `E-001/AC-60`, `E-001/AC-61`, `E-001/AC-62`, `E-001/AC-63`, `E-001/AC-64`. AC-60 runs the seed on an empty scratch database and checks the summary and counts |
| evals | None: no AI output or performance NFR | |
| load | None: epic release in E-001/S-13 | |

Fixtures in `tests/fixtures/csv/`: valid rooms and users, bad rows, formula cells, 5,001 rows, over 2 MB, and a `seed/` folder with the three files.

## 7. Docs
| Docs home | Change |
|---|---|
| `docs/manual/E-001-room-booking.md` | Block "Import rooms and users": columns, limits, how to read the error table |
| `docs/runbook/seed.md` | Go-live seed: save the client sheet as three CSV files, run `scripts/seed.ts`, then issue first passwords |
| `docs/rules/` | Regenerated from `src/domain/import/rules.ts` `@ears` tags |
| `docs/workflows/E-001-room-booking.md` | Journeys "Office admin runs one office" (import) and "Platform admin sets up the company" (seed) |

## 8. Done
| Command | Expected output |
|---|---|
| `pnpm tsc --noEmit` | exit 0 |
| `pnpm lint` | exit 0, no warnings |
| `pnpm vitest run tests/unit/domain/import tests/unit/data/import.test.ts` | all pass |
| `pnpm vitest run tests/integration/import` | all pass |
| `pnpm tsx scripts/seed.ts --dir tests/fixtures/csv/seed` (empty test DB) | exit 0, summary of offices, rooms and users |
| `pnpm playwright test tests/ui/admin-import.spec.ts tests/e2e/E-001/S04-data-load.spec.ts` | all pass |
| `bash scripts/ci/check-auth-in-actions.sh` | PASS |
| `bash scripts/ci/check-test-tree.sh` | PASS |
| `bash scripts/ci/check-no-console.sh` | PASS |
| `bash scripts/ci/check-ac-coverage.sh` | PASS for the five IDs |
| `git diff --exit-code origin/main -- prisma src/contracts` | exit 0 (no contract change) |

## Tasks
| Task | Type | Specialist | Section | Note |
|---|---|---|---|---|
| T-01 | contract | data-engineer | 3, 4 | None: reads contracts |
| T-02 | data | api-engineer | 4 | `src/data/import.ts`: existing key lookups, try-lock, `createMany` with audit rows in one tx. Unit tests |
| T-03 | api | api-engineer | 3, 5 | `src/domain/import/` parser and `rules.ts` with `@ears` tags, `actions.ts`, `scripts/seed.ts`, CSV fixtures. Unit tests |
| T-04 | ui | ui-engineer | 2 | Import page, column guide, error table, `tests/ui/admin-import.spec.ts`. Excludes `actions.ts` |
| T-05 | tests | test-engineer | 6 | Integration tests, e2e spec, coverage check |
| T-06 | docs | test-engineer | 7 | Manual block, seed runbook, regenerate rules docs, workflow journeys |
