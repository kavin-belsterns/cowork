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
