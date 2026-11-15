---
story: E-001/S-14
epic: E-001
ears: [E-001/AC-54, E-001/AC-74, E-001/AC-75, E-001/AC-76, E-001/AC-77]
contracts_amendment: true
owns:
  - prisma/migrations/20261115090000_web_delete_grants/**
  - tests/integration/contracts/migration.test.ts
  - tests/integration/contracts/web-delete-grants.test.ts
depends_on: [E-001/S-00]
parallel: false
---

# Spec: E-001/S-14 Contracts amendment: web role delete grants

## 1. Scope
EARS IDs covered (unblocked, not changed):
- E-001/AC-54 (S-02): closing a weekday deletes its `office_hours` row. No row means closed.
- E-001/AC-74, E-001/AC-75, E-001/AC-76, E-001/AC-77 (S-07): a series that books 0 dates deletes its `booking_series` row.

Out of scope:
- Any new table, column, index, contract type or permission key.
- Editing the merged migration `20261114093324_e001_init`. A merged migration is never changed.
- Grants for `app_worker`: S-12 worker deletes are already granted.
- The S-02 and S-07 code that uses these grants.

## 2. Page and UI
None: a database grant has no page.

## 3. API
None: no endpoint, action or contract type changes. `src/contracts/**` stays as it is.

## 4. Data
| Table | Reads | Writes | Indexes used | Transaction |
|---|---|---|---|---|
| office_hours | None | `GRANT DELETE ... TO app_web` | None | No: one migration statement |
| booking_series | None | `GRANT DELETE ... TO app_web` | None | No: one migration statement |

- New migration `prisma/migrations/20261115090000_web_delete_grants/migration.sql`, one statement: `GRANT DELETE ON "office_hours", "booking_series" TO "app_web";`.
- `prisma/schema.prisma` does not change, so `prisma migrate diff` stays empty.
- `app_web` and `app_worker` stay NOLOGIN. Login roles (`app_web_login`, `app_worker_login`) are set by CI and ops, outside migrations.
- `audit_events` keeps its append-only triggers. No DELETE grant there.

## 5. Security
| Item | Value |
|---|---|
| Roles | `app_web` gains DELETE on two tables only. Least privilege: both deletes are needed by signed specs S-02 and S-07 |
| Boundary validation | None: no input |
| OWASP | A01: the grant is table level. Row reach stays in `scopeFor` and in the S-02 and S-07 transactions. A05: grants are code reviewed in a migration, never set by hand |
| Logging | None: no runtime code |

## 6. Tests
| Kind | File path | Covers |
|---|---|---|
| unit | None: no TypeScript code | |
| integration | `tests/integration/contracts/migration.test.ts` (T-01) | The S-00 grants map now expects DELETE on `office_hours` and `booking_series` for `app_web`. Nothing else changes |
| integration | `tests/integration/contracts/web-delete-grants.test.ts` (T-05) | As `app_web_login`: delete one `office_hours` row and one `booking_series` row inside a rolled-back tx. DELETE on `rooms` and `audit_events` is still refused (42501). Fails, never skips, when the DB is unreachable |
| ui | None: no page | |
| e2e | None: no new EARS line. S-02 and S-07 e2e cover AC-54 and AC-74 to AC-77 | |
| evals | None: no AI output | |
| load | None: no runtime path | |

## 7. Docs
| Docs home | Change |
|---|---|
| `docs/db/erd.md` | None: regenerate shows no diff, the schema is unchanged |
| `docs/adr/` | None: grants follow the S-00 role design. ADR-0018 (AC-48) rides in this PR as a lead commit |

## 8. Done
| Command | Expected output |
|---|---|
| `pnpm tsc --noEmit` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm prisma validate` | exit 0 |
| `DATABASE_URL_MIGRATOR=$TEST_DATABASE_URL pnpm prisma migrate deploy` | exit 0, applies `20261115090000_web_delete_grants` |
| `DATABASE_URL_MIGRATOR=$TEST_DATABASE_URL pnpm prisma migrate status` | exit 0, up to date |
| `DATABASE_URL_WEB=$TEST_DATABASE_URL_WEB DATABASE_URL_MIGRATOR=$TEST_DATABASE_URL pnpm vitest run tests/integration/contracts` | all pass |
| `node scripts/gen-rules-doc.ts --strict && git diff --exit-code docs/rules` | exit 0 |
| `pnpm docs:all && git diff --exit-code docs/` | exit 0 |
| `bash scripts/ci/check-test-tree.sh` | PASS |

## Tasks
| Task | Type | Specialist | Section | Note |
|---|---|---|---|---|
| T-01 | contract | data-engineer | 4 | New migration with the two grants. Update the grants map in `migration.test.ts` |
| T-02 | data | api-engineer | 4 | None: no data call. S-02 and S-07 write their own |
| T-03 | api | api-engineer | 3 | None: no rule or action |
| T-04 | ui | ui-engineer | 2 | None: no page |
| T-05 | tests | test-engineer | 6 | `web-delete-grants.test.ts` as `app_web_login`. Coverage check unchanged |
| T-06 | docs | test-engineer | 7 | Regenerate docs, confirm no diff |
