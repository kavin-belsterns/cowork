// Purpose: shared fixtures for the auth integration tests. Users are made on DATABASE_URL_MIGRATOR with unique emails.
// Rules: standards/testing.md. Every row made here is deleted by `cleanup`. Audit rows are append only and stay (no personal data).
// A missing database makes `connect` throw, so the tests FAIL. Nothing is skipped.
import { randomInt, randomUUID } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import pg from 'pg';
import { hashEmail, hashUserKey } from '@/lib/auth/token';

export const PASSWORD = 'Correct-horse-battery-9';
export type Role = 'platform_admin' | 'office_admin' | 'receptionist' | 'employee';
export type MakeOptions = { role?: Role; mustChange?: boolean; deactivated?: boolean; tempExpired?: boolean };
export type Account = { id: string; email: string; name: string; role: Role };

export const noSleep = (): Promise<void> => Promise.resolve();

/** A sleep that records each wait, so a test can see the IP delay without waiting. */
export function recordingSleep(): { sleep: (ms: number) => Promise<void>; waits: number[] } {
  const waits: number[] = [];
  return {
    waits,
    sleep: (ms) => {
      waits.push(ms);
      return Promise.resolve();
    },
  };
}

export class Fixtures {
  private client: pg.Client | undefined;
  private readonly accounts: Account[] = [];
  private readonly ips = new Set<string>();
  private readonly hashes = new Set<string>();
  private stored: Promise<string> | undefined;

  /** Connect as the migrator role. Throws when the database is unreachable. */
  async connect(): Promise<void> {
    const url = process.env.DATABASE_URL_MIGRATOR;
    if (!url) throw new Error('DATABASE_URL_MIGRATOR is not set');
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    this.client = client;
    // The seed must be there: the tests need an office.
    const office = await this.db.query('SELECT 1 FROM offices LIMIT 1');
    if (office.rowCount === 0) throw new Error('No office in the test database. Run the seed first.');
  }

  get db(): pg.Client {
    if (!this.client) throw new Error('Fixtures.connect() was not called');
    return this.client;
  }

  /** One fake client address per call, so the IP limit never mixes tests. */
  ip(): string {
    const ip = `10.${randomInt(1, 255)}.${randomInt(1, 255)}.${randomInt(1, 255)}`;
    this.ips.add(ip);
    return ip;
  }

  async user(options: MakeOptions = {}): Promise<Account> {
    const role = options.role ?? 'employee';
    const id = randomUUID();
    const email = `it-${randomUUID()}@example.test`;
    const name = `It Tester ${id.slice(0, 8)}`;
    this.stored ??= hash(PASSWORD);
    const passwordHash = await this.stored;
    let officeId: string | null = null;
    if (role !== 'platform_admin') {
      const office = await this.db.query<{ id: string }>('SELECT id FROM offices ORDER BY name LIMIT 1');
      officeId = office.rows[0]?.id ?? null;
    }
    const now = Date.now();
    await this.db.query(
      `INSERT INTO users (id, office_id, email, name, role, password_hash, deactivated_at, must_change_password, temp_password_expires_at, version, updated_at)
       VALUES ($1, $2, $3, $4, $5::role, $6, $7, $8, $9, 1, now())`,
      [
        id,
        officeId,
        email,
        name,
        role,
        passwordHash,
        options.deactivated ? new Date(now - 86_400_000) : null,
        options.mustChange === true || options.tempExpired === true,
        options.tempExpired ? new Date(now - 3_600_000) : options.mustChange ? new Date(now + 86_400_000) : null,
      ],
    );
    const account = { id, email, name, role };
    this.accounts.push(account);
    this.hashes.add(hashEmail(email));
    this.hashes.add(hashUserKey(id));
    return account;
  }

  /** An email nobody owns. Its lockout rows are cleaned up too. */
  unknownEmail(): string {
    const email = `it-unknown-${randomUUID()}@example.test`;
    this.hashes.add(hashEmail(email));
    return email;
  }

  async sessionRows(userId: string): Promise<{ token_hash: string; expires_at: Date }[]> {
    const r = await this.db.query<{ token_hash: string; expires_at: Date }>('SELECT token_hash, expires_at FROM sessions WHERE user_id = $1', [userId]);
    return r.rows;
  }

  async failureCount(emailHash: string): Promise<number> {
    const r = await this.db.query<{ n: string }>('SELECT count(*) AS n FROM sign_in_attempts WHERE email_hash = $1', [emailHash]);
    return Number(r.rows[0]?.n ?? 0);
  }

  /** Insert failure rows by hand, with a chosen time. */
  async addFailures(emailHash: string, ip: string, count: number, at: Date): Promise<void> {
    this.hashes.add(emailHash);
    this.ips.add(ip);
    for (let i = 0; i < count; i++) {
      await this.db.query('INSERT INTO sign_in_attempts (id, email_hash, ip, at) VALUES (gen_random_uuid(), $1, $2, $3)', [emailHash, ip, at]);
    }
  }

  async cleanup(): Promise<void> {
    if (!this.client) return;
    const ids = this.accounts.map((a) => a.id);
    await this.client.query('DELETE FROM sessions WHERE user_id = ANY($1::uuid[])', [ids]);
    await this.client.query('DELETE FROM sign_in_attempts WHERE email_hash = ANY($1) OR ip = ANY($2)', [[...this.hashes], [...this.ips]]);
    await this.client.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [ids]);
    await this.client.end();
    this.client = undefined;
  }
}
