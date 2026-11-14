// Purpose: Integration test for database migration, raw-SQL constraints, and audit append-only guards.
// Rules: standards/testing.md, standards/data.md. Verify exclusion constraint 23P01, audit triggers, roles and grants.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';

describe('Database Migration & Raw-SQL Schema Verification', () => {
  const migrationPath = join(process.cwd(), 'prisma/migrations/20261114093324_e001_init/migration.sql');
  let migrationSql = '';

  beforeAll(() => {
    expect(existsSync(migrationPath)).toBe(true);
    migrationSql = readFileSync(migrationPath, 'utf-8');
  });

  describe('Static migration SQL definitions', () => {
    it('creates btree_gist extension for room_id exclusion indexing', () => {
      expect(migrationSql).toMatch(/CREATE EXTENSION IF NOT EXISTS btree_gist;/i);
    });

    it('defines double-booking exclusion constraint (bookings_no_overlap_excl)', () => {
      expect(migrationSql).toContain('"bookings_no_overlap_excl"');
      expect(migrationSql).toMatch(
        /EXCLUDE USING gist \("room_id" WITH =, tstzrange\("starts_at", "ends_at", '\[\)'\) WITH &&\) WHERE \("status" = 'confirmed'\)/,
      );
    });

    it('defines check constraints for office hours, rooms, users, bookings and visits', () => {
      expect(migrationSql).toContain('"office_hours_opens_before_closes_chk"');
      expect(migrationSql).toContain('"office_hours_weekday_chk"');
      expect(migrationSql).toContain('"rooms_size_chk"');
      expect(migrationSql).toContain('"users_office_null_only_platform_admin_chk"');
      expect(migrationSql).toContain('"bookings_starts_before_ends_chk"');
      expect(migrationSql).toContain('"bookings_attendees_chk"');
      expect(migrationSql).toContain('"visits_checked_in_at_chk"');
      expect(migrationSql).toContain('"visits_checked_out_at_chk"');
      expect(migrationSql).toContain('"visits_check_out_after_in_chk"');
      expect(migrationSql).toContain('"visits_name_until_anonymised_chk"');
    });

    it('defines case-insensitive unique indexes on email and room names', () => {
      expect(migrationSql).toContain('"users_email_lower_uq"');
      expect(migrationSql).toContain('"rooms_office_lower_name_live_uq"');
    });

    it('defines partial indexes for visit queries', () => {
      expect(migrationSql).toContain('"visits_host_unseen_idx"');
      expect(migrationSql).toContain('"visits_date_not_anonymised_idx"');
      expect(migrationSql).toContain('"visits_office_checked_in_idx"');
    });

    it('defines append-only audit trigger function and triggers', () => {
      expect(migrationSql).toContain('"audit_events_append_only"');
      expect(migrationSql).toContain('"audit_events_no_change"');
      expect(migrationSql).toContain('"audit_events_no_truncate"');
    });

    it('creates roles app_web and app_worker and defines role grants', () => {
      expect(migrationSql).toContain('CREATE ROLE "app_web"');
      expect(migrationSql).toContain('CREATE ROLE "app_worker"');
      expect(migrationSql).toContain('REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM "app_web", "app_worker"');
      expect(migrationSql).toContain('GRANT SELECT, INSERT, UPDATE ON "offices"');
      expect(migrationSql).toContain('GRANT INSERT, SELECT ON "audit_events" TO "app_web"');
      expect(migrationSql).toContain('GRANT DELETE ON "sessions", "sign_in_attempts", "idempotency_keys" TO "app_web"');
      expect(migrationSql).toContain('GRANT SELECT, DELETE ON "sessions", "idempotency_keys", "sign_in_attempts" TO "app_worker"');
    });
  });

  describe('Live database validation (requires DATABASE_URL_MIGRATOR)', () => {
    let client: Client;

    beforeAll(async () => {
      const migratorUrl = process.env.DATABASE_URL_MIGRATOR;
      if (!migratorUrl) {
        throw new Error(
          'DATABASE_URL_MIGRATOR is not set. Start the test database and run: DATABASE_URL_MIGRATOR=$TEST_DATABASE_URL pnpm vitest run tests/integration/contracts',
        );
      }
      client = new Client({ connectionString: migratorUrl, connectionTimeoutMillis: 3000 });
      try {
        await client.connect();
      } catch (err: unknown) {
        const reason = err instanceof Error ? err.message : String(err);
        throw new Error(`Cannot connect to the test database from DATABASE_URL_MIGRATOR: ${reason}`);
      }
    });

    afterAll(async () => {
      await client?.end();
    });

    it('has the exclusion constraint bookings_no_overlap_excl in pg_constraint', async () => {
      const res = await client.query<{ contype: string; def: string }>(
        `SELECT c.contype, pg_get_constraintdef(c.oid) AS def FROM pg_constraint c
         WHERE c.conname = 'bookings_no_overlap_excl' AND c.conrelid = 'public.bookings'::regclass`,
      );
      expect(res.rows).toHaveLength(1);
      expect(res.rows[0]?.contype).toBe('x');
      expect(res.rows[0]?.def).toMatch(/USING gist/);
      expect(res.rows[0]?.def).toMatch(/room_id WITH =/);
      expect(res.rows[0]?.def).toMatch(/confirmed/);
    });

    it('has every CHECK constraint in pg_constraint', async () => {
      const expected: Record<string, string> = {
        office_hours_opens_before_closes_chk: 'office_hours',
        office_hours_weekday_chk: 'office_hours',
        rooms_size_chk: 'rooms',
        users_office_null_only_platform_admin_chk: 'users',
        bookings_starts_before_ends_chk: 'bookings',
        bookings_attendees_chk: 'bookings',
        visits_checked_in_at_chk: 'visits',
        visits_checked_out_at_chk: 'visits',
        visits_check_out_after_in_chk: 'visits',
        visits_name_until_anonymised_chk: 'visits',
      };
      const res = await client.query<{ conname: string; relname: string }>(
        `SELECT c.conname, t.relname FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
         WHERE c.contype = 'c' AND c.conname = ANY($1)`,
        [Object.keys(expected)],
      );
      const found = Object.fromEntries(res.rows.map((r) => [r.conname, r.relname]));
      expect(found).toEqual(expected);
    });

    it('has the audit_events triggers in pg_trigger (row for UPDATE and DELETE, statement for TRUNCATE)', async () => {
      const res = await client.query<{ tgname: string; tgtype: number }>(
        `SELECT tgname, tgtype FROM pg_trigger
         WHERE tgrelid = 'public.audit_events'::regclass AND NOT tgisinternal`,
      );
      const byName = Object.fromEntries(res.rows.map((r) => [r.tgname, r.tgtype]));
      const rowFlag = 1;
      const beforeFlag = 2;
      const deleteFlag = 8;
      const updateFlag = 16;
      const truncateFlag = 32;
      const change = byName['audit_events_no_change'];
      const trunc = byName['audit_events_no_truncate'];
      expect(change).toBeDefined();
      expect(trunc).toBeDefined();
      expect((change ?? 0) & rowFlag).toBe(rowFlag);
      expect((change ?? 0) & beforeFlag).toBe(beforeFlag);
      expect((change ?? 0) & updateFlag).toBe(updateFlag);
      expect((change ?? 0) & deleteFlag).toBe(deleteFlag);
      expect((trunc ?? 0) & rowFlag).toBe(0);
      expect((trunc ?? 0) & beforeFlag).toBe(beforeFlag);
      expect((trunc ?? 0) & truncateFlag).toBe(truncateFlag);
    });

    it('has the partial and lower() unique indexes in pg_indexes', async () => {
      const res = await client.query<{ indexname: string; indexdef: string }>(
        `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND indexname = ANY($1)`,
        [
          [
            'users_email_lower_uq',
            'rooms_office_lower_name_live_uq',
            'visits_host_unseen_idx',
            'visits_date_not_anonymised_idx',
            'visits_office_checked_in_idx',
          ],
        ],
      );
      const def = Object.fromEntries(res.rows.map((r) => [r.indexname, r.indexdef]));
      expect(Object.keys(def).sort()).toEqual(
        [
          'rooms_office_lower_name_live_uq',
          'users_email_lower_uq',
          'visits_date_not_anonymised_idx',
          'visits_host_unseen_idx',
          'visits_office_checked_in_idx',
        ].sort(),
      );
      expect(def['users_email_lower_uq']).toMatch(/UNIQUE INDEX .*\(lower\(\(?email\)?(::text)?\)\)/);
      expect(def['rooms_office_lower_name_live_uq']).toMatch(/UNIQUE INDEX/);
      expect(def['rooms_office_lower_name_live_uq']).toMatch(/lower\(/);
      expect(def['rooms_office_lower_name_live_uq']).toMatch(/WHERE \(?\(?deleted_at IS NULL/);
      expect(def['visits_host_unseen_idx']).toMatch(/WHERE .*host_seen_at IS NULL/);
      expect(def['visits_date_not_anonymised_idx']).toMatch(/WHERE .*anonymised_at IS NULL/);
      expect(def['visits_office_checked_in_idx']).toMatch(/WHERE .*checked_in/);
    });

    it('has roles app_web and app_worker in pg_roles with NOLOGIN', async () => {
      const res = await client.query<{ rolname: string; rolcanlogin: boolean }>(
        `SELECT rolname, rolcanlogin FROM pg_roles WHERE rolname IN ('app_web', 'app_worker') ORDER BY rolname`,
      );
      expect(res.rows).toEqual([
        { rolname: 'app_web', rolcanlogin: false },
        { rolname: 'app_worker', rolcanlogin: false },
      ]);
    });

    it('grants each role exactly the privileges in spec section 4 and never TRUNCATE', async () => {
      const crud = ['INSERT', 'SELECT', 'UPDATE'];
      const webTables = [
        'offices',
        'office_hours',
        'rooms',
        'users',
        'sign_in_attempts',
        'sessions',
        'bookings',
        'booking_series',
        'visits',
        'idempotency_keys',
      ];
      const expected: Record<string, Record<string, string[]>> = {
        app_web: {
          ...Object.fromEntries(webTables.map((t) => [t, [...crud]])),
          audit_events: ['INSERT', 'SELECT'],
          job_runs: ['SELECT'],
          sessions: ['DELETE', ...crud],
          sign_in_attempts: ['DELETE', ...crud],
          idempotency_keys: ['DELETE', ...crud],
        },
        app_worker: {
          offices: ['SELECT'],
          visits: ['SELECT', 'UPDATE'],
          audit_events: ['INSERT', 'SELECT'],
          job_runs: ['INSERT', 'SELECT', 'UPDATE'],
          sessions: ['DELETE', 'SELECT'],
          idempotency_keys: ['DELETE', 'SELECT'],
          sign_in_attempts: ['DELETE', 'SELECT'],
        },
      };
      const res = await client.query<{ grantee: string; table_name: string; privilege_type: string }>(
        `SELECT grantee, table_name, privilege_type FROM information_schema.role_table_grants
         WHERE table_schema = 'public' AND grantee IN ('app_web', 'app_worker')`,
      );
      const actual: Record<string, Record<string, string[]>> = { app_web: {}, app_worker: {} };
      for (const r of res.rows) {
        const perRole = actual[r.grantee] ?? {};
        actual[r.grantee] = perRole;
        (perRole[r.table_name] ??= []).push(r.privilege_type);
      }
      for (const role of Object.keys(actual)) {
        for (const list of Object.values(actual[role] ?? {})) list.sort();
      }
      for (const role of Object.keys(expected)) {
        for (const list of Object.values(expected[role] ?? {})) list.sort();
      }
      expect(actual).toEqual(expected);
      expect(res.rows.filter((r) => r.privilege_type === 'TRUNCATE')).toEqual([]);
    });

    it('verifies exclusion constraint on live database rejects overlapping confirmed bookings with 23P01', async () => {
      const testRoomId = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f9999';
      const userAlice = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f9998';
      const officeId = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f9997';

      // Insert prerequisites within a rollback transaction
      await client.query('BEGIN');
      try {
        await client.query(
          `INSERT INTO offices (id, name, time_zone, updated_at) VALUES ($1, 'Test Office', 'Europe/London', NOW())`,
          [officeId],
        );
        await client.query(
          `INSERT INTO users (id, office_id, email, name, role, updated_at) VALUES ($1, $2, 'test@example.com', 'Alice', 'employee', NOW())`,
          [userAlice, officeId],
        );
        await client.query(
          `INSERT INTO rooms (id, office_id, name, floor, size, updated_at) VALUES ($1, $2, 'Room 101', 1, 10, NOW())`,
          [testRoomId, officeId],
        );

        // First confirmed booking
        await client.query(
          `INSERT INTO bookings (id, room_id, owner_id, starts_at, ends_at, attendees, status, updated_at)
           VALUES ('0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f9991', $1, $2, '2026-11-16 10:00:00+00', '2026-11-16 11:00:00+00', 2, 'confirmed', NOW())`,
          [testRoomId, userAlice],
        );

        // Second overlapping confirmed booking must fail with SQLSTATE 23P01
        let errorCode = '';
        try {
          await client.query(
            `INSERT INTO bookings (id, room_id, owner_id, starts_at, ends_at, attendees, status, updated_at)
             VALUES ('0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f9992', $1, $2, '2026-11-16 10:30:00+00', '2026-11-16 11:30:00+00', 2, 'confirmed', NOW())`,
            [testRoomId, userAlice],
          );
        } catch (err: unknown) {
          const pgErr = err as { code?: string };
          errorCode = pgErr.code ?? '';
        }
        expect(errorCode).toBe('23P01');
      } finally {
        await client.query('ROLLBACK');
      }
    });

    it('verifies audit_events table rejects UPDATE, DELETE and TRUNCATE via triggers', async () => {
      const auditId = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f9990';
      const statements: Array<{ sql: string; params: string[] }> = [
        { sql: `UPDATE audit_events SET action = 'changed' WHERE id = $1`, params: [auditId] },
        { sql: `DELETE FROM audit_events WHERE id = $1`, params: [auditId] },
        { sql: `TRUNCATE TABLE audit_events`, params: [] },
      ];

      // Each forbidden statement runs in its own transaction, so one error cannot abort the next.
      for (const stmt of statements) {
        await client.query('BEGIN');
        try {
          await client.query(
            `INSERT INTO audit_events (id, action, entity_type, entity_id, actor_id)
             VALUES ($1, 'created', 'booking', '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f9991', '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f9998')`,
            [auditId],
          );
          await expect(client.query(stmt.sql, stmt.params)).rejects.toThrow(/audit_events is append only/);
        } finally {
          await client.query('ROLLBACK');
        }
      }
    });
  });
});
