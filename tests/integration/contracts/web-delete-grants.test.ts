// Purpose: Integration test for the S-14 grants. app_web may delete office_hours and booking_series only.
// Rules: standards/testing.md, standards/security.md. Covers E-001/AC-54 and E-001/AC-74.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';

describe('S-14 app_web delete grants', () => {
  let web: Client;
  let owner: Client;
  const officeId = randomUUID();
  const userId = randomUUID();
  const roomId = randomUUID();
  const seriesId = randomUUID();
  const suffix = officeId.slice(0, 8);
  let ownerConnected = false;
  let webConnected = false;

  function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
      throw new Error(
        `${name} is not set. Run: DATABASE_URL_WEB=$TEST_DATABASE_URL_WEB DATABASE_URL_MIGRATOR=$TEST_DATABASE_URL pnpm vitest run tests/integration/contracts`,
      );
    }
    return value;
  }

  beforeAll(async () => {
    const webUrl = requireEnv('DATABASE_URL_WEB');
    const migratorUrl = requireEnv('DATABASE_URL_MIGRATOR');
    web = new Client({ connectionString: webUrl, connectionTimeoutMillis: 3000 });
    owner = new Client({ connectionString: migratorUrl, connectionTimeoutMillis: 3000 });
    await web.connect();
    webConnected = true;
    await owner.connect();
    ownerConnected = true;

    await owner.query(`INSERT INTO offices (id, name, time_zone, updated_at) VALUES ($1, $2, 'Asia/Kolkata', now())`, [
      officeId,
      `s14-office-${suffix}`,
    ]);
    await owner.query(
      `INSERT INTO office_hours (office_id, weekday, opens_at, closes_at, updated_at) VALUES ($1, 1, '09:00', '17:00', now())`,
      [officeId],
    );
    await owner.query(
      `INSERT INTO users (id, office_id, email, name, role, updated_at) VALUES ($1, $2, $3, 's14 user', 'employee', now())`,
      [userId, officeId, `s14-${suffix}@example.test`],
    );
    await owner.query(
      `INSERT INTO rooms (id, office_id, name, floor, size, updated_at) VALUES ($1, $2, $3, 1, 4, now())`,
      [roomId, officeId, `s14-room-${suffix}`],
    );
    await owner.query(
      `INSERT INTO booking_series (id, owner_id, room_id, pattern, until_date, updated_at) VALUES ($1, $2, $3, 'daily', '2030-01-31', now())`,
      [seriesId, userId, roomId],
    );
  });

  afterAll(async () => {
    if (owner && ownerConnected) {
      await owner.query(`DELETE FROM booking_series WHERE id = $1`, [seriesId]).catch(() => undefined);
      await owner.query(`DELETE FROM rooms WHERE id = $1`, [roomId]).catch(() => undefined);
      await owner.query(`DELETE FROM users WHERE id = $1`, [userId]).catch(() => undefined);
      await owner.query(`DELETE FROM office_hours WHERE office_id = $1`, [officeId]).catch(() => undefined);
      await owner.query(`DELETE FROM offices WHERE id = $1`, [officeId]).catch(() => undefined);
      await owner.end().catch(() => undefined);
    }
    if (web && webConnected) await web.end().catch(() => undefined);
  });

  async function inRolledBackTx<T>(run: () => Promise<T>): Promise<T> {
    await web.query('BEGIN');
    try {
      return await run();
    } finally {
      await web.query('ROLLBACK');
    }
  }

  it('connects as a non-superuser login role', async () => {
    const res = await web.query<{ current_user: string; is_super: string }>(
      `SELECT current_user, current_setting('is_superuser') AS is_super`,
    );
    expect(res.rows[0]?.is_super).toBe('off');
    expect(res.rows[0]?.current_user).not.toBe('app_owner');
  });

  it('E-001/AC-54 deletes one office_hours row', async () => {
    const res = await inRolledBackTx(() =>
      web.query(`DELETE FROM office_hours WHERE office_id = $1 AND weekday = 1`, [officeId]),
    );
    expect(res.rowCount).toBe(1);
  });

  it('E-001/AC-74 deletes one booking_series row', async () => {
    const res = await inRolledBackTx(() => web.query(`DELETE FROM booking_series WHERE id = $1`, [seriesId]));
    expect(res.rowCount).toBe(1);
  });

  it('rolls back, so the fixture rows still exist', async () => {
    const hours = await owner.query(`SELECT 1 FROM office_hours WHERE office_id = $1`, [officeId]);
    const series = await owner.query(`SELECT 1 FROM booking_series WHERE id = $1`, [seriesId]);
    expect(hours.rowCount).toBe(1);
    expect(series.rowCount).toBe(1);
  });

  it('still refuses DELETE on rooms with 42501', async () => {
    await expect(inRolledBackTx(() => web.query(`DELETE FROM rooms WHERE id = $1`, [roomId]))).rejects.toMatchObject({
      code: '42501',
    });
  });

  it('still refuses DELETE on audit_events with 42501', async () => {
    await expect(
      inRolledBackTx(() => web.query(`DELETE FROM audit_events WHERE id = $1`, [randomUUID()])),
    ).rejects.toMatchObject({ code: '42501' });
  });
});
