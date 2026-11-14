// Purpose: e2e for story E-001/S-01. One test per EARS ID, ID first in the title, through the real pages.
// Rules: standards/testing.md, spec S01 section 6. Test users are made on DATABASE_URL_MIGRATOR with unique emails and deleted afterwards.
// AC-49 signs in as a seed user and restores that row afterwards. AC-71 ages `expires_at` through the migrator client.
// A missing database or server makes these tests fail. Nothing is skipped.
import { createHash, randomInt, randomUUID } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import pg from 'pg';
import { expect, test as base, type Page } from '@playwright/test';

const PASSWORD = 'Correct-horse-battery-9';
const SEED_PASSWORD = process.env.SEED_PASSWORD ?? 'Test-Password-1234';
const SEED_FORCED_EMAIL = 'must.change.chn@example.test';

type Account = { id: string; email: string };
type MakeOptions = { deactivated?: boolean };

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

async function withDb<T>(fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const url = process.env.DATABASE_URL_MIGRATOR;
  if (!url) throw new Error('DATABASE_URL_MIGRATOR is not set');
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

let passwordHash: Promise<string> | undefined;

async function createAccount(options: MakeOptions): Promise<Account> {
  const id = randomUUID();
  const email = `e2e-${randomUUID()}@example.test`;
  passwordHash ??= hash(PASSWORD);
  const stored = await passwordHash;
  await withDb(async (client) => {
    const office = await client.query<{ id: string }>('SELECT id FROM offices ORDER BY name LIMIT 1');
    const officeId = office.rows[0]?.id;
    if (!officeId) throw new Error('No office in the test database. Run the seed first.');
    await client.query(
      `INSERT INTO users (id, office_id, email, name, role, password_hash, deactivated_at, must_change_password, version, updated_at)
       VALUES ($1, $2, $3, $4, 'employee'::role, $5, $6, false, 1, now())`,
      [id, officeId, email, `E2e Tester ${id.slice(0, 8)}`, stored, options.deactivated ? new Date(Date.now() - 86_400_000) : null],
    );
  });
  return { id, email };
}

async function removeAccount(account: Account): Promise<void> {
  await withDb(async (client) => {
    await client.query('DELETE FROM sessions WHERE user_id = $1', [account.id]);
    await client.query('DELETE FROM sign_in_attempts WHERE email_hash = ANY($1)', [[sha256(account.email), sha256(`user:${account.id}`)]]);
    await client.query('DELETE FROM users WHERE id = $1', [account.id]);
  });
}

const test = base.extend<{ ip: string; users: (options?: MakeOptions) => Promise<Account> }>({
  // One fake client address per test, so the IP limit never mixes tests. The server trusts the last X-Forwarded-For value.
  ip: [
    async ({ context }, provide) => {
      const ip = `10.${randomInt(1, 255)}.${randomInt(1, 255)}.${randomInt(1, 255)}`;
      await context.setExtraHTTPHeaders({ 'x-forwarded-for': ip });
      await provide(ip);
      await withDb((client) => client.query('DELETE FROM sign_in_attempts WHERE ip = $1', [ip]));
    },
    { auto: true },
  ],
  users: async ({ ip }, provide) => {
    expect(ip).not.toBe('');
    const made: Account[] = [];
    await provide(async (options = {}) => {
      const account = await createAccount(options);
      made.push(account);
      return account;
    });
    for (const account of made) await removeAccount(account);
  },
});

/** Wait until React has attached to the first form, so a click is not lost before hydration. */
async function open(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await page.waitForFunction(() => {
    const form = document.querySelector('form');
    return form !== null && Object.keys(form).some((key) => key.startsWith('__reactProps'));
  });
}

async function signInWith(page: Page, email: string, password: string): Promise<void> {
  await open(page, '/sign-in');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

/** The error summary. The Next route announcer is also an alert, so the form scopes the match. */
const summary = (page: Page) => page.locator('form').getByRole('alert');

test('E-001/AC-47 a correct email and password opens the role home', async ({ page, users }) => {
  const account = await users();
  await signInWith(page, account.email, PASSWORD);
  await page.waitForURL('**/rooms');
  const cookie = (await page.context().cookies()).find((c) => c.name === '__Host-session');
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.value.length).toBeGreaterThanOrEqual(43);
});

test('E-001/AC-48 five failures in 15 minutes lock the account, even for the right password', async ({ page, users }) => {
  const account = await users();
  for (let i = 0; i < 5; i++) {
    await signInWith(page, account.email, `wrong-password-${i}`);
    await expect(summary(page)).toContainText('Email or password is wrong.');
  }
  await signInWith(page, account.email, PASSWORD);
  await expect(summary(page)).toContainText('Too many attempts. Try again in 15 minutes.');
  await expect(page).toHaveURL(/\/sign-in/);
  expect((await page.context().cookies()).filter((c) => c.name === '__Host-session' && c.value !== '')).toHaveLength(0);
});

test('E-001/AC-49 a user with must_change_password must set a new password first', async ({ page }) => {
  const before = await withDb(async (client) => {
    const r = await client.query<{ id: string; password_hash: string; must_change_password: boolean; temp_password_expires_at: Date | null; version: number }>(
      'SELECT id, password_hash, must_change_password, temp_password_expires_at, version FROM users WHERE email = $1',
      [SEED_FORCED_EMAIL],
    );
    const row = r.rows[0];
    if (!row) throw new Error('Seed user must.change.chn@example.test is missing. Run the seed first.');
    return row;
  });
  try {
    expect(before.must_change_password).toBe(true);
    await signInWith(page, SEED_FORCED_EMAIL, SEED_PASSWORD);
    await page.waitForURL('**/account/password');
    await expect(page.getByRole('heading', { name: 'Set a new password' })).toBeVisible();
    await expect(page.getByText('Your admin reset your password. Set a new one to continue.')).toBeVisible();
    // The role home does not let the user past the gate.
    await page.goto('/');
    await page.waitForURL('**/account/password');
  } finally {
    await withDb(async (client) => {
      await client.query('DELETE FROM sessions WHERE user_id = $1', [before.id]);
      await client.query('DELETE FROM sign_in_attempts WHERE email_hash = $1', [sha256(SEED_FORCED_EMAIL)]);
      await client.query(
        'UPDATE users SET password_hash = $2, must_change_password = $3, temp_password_expires_at = $4, version = $5 WHERE id = $1',
        [before.id, before.password_hash, before.must_change_password, before.temp_password_expires_at, before.version],
      );
    });
  }
});

test('E-001/AC-71 a session ends 12 hours after it starts', async ({ page, users }) => {
  const account = await users();
  const started = Date.now();
  await signInWith(page, account.email, PASSWORD);
  await page.waitForURL('**/rooms');
  const rows = await withDb((client) => client.query<{ expires_at: Date }>('SELECT expires_at FROM sessions WHERE user_id = $1', [account.id]));
  expect(rows.rows).toHaveLength(1);
  const ended = rows.rows[0]!.expires_at.getTime();
  // The server stamped the start between `started` and now, so the end sits 12 h after a moment inside that span.
  expect(ended).toBeGreaterThanOrEqual(started + 12 * 3_600_000);
  expect(ended).toBeLessThanOrEqual(Date.now() + 12 * 3_600_000);

  await page.goto('/account/password');
  await expect(page.getByRole('heading', { name: 'Set a new password' })).toBeVisible();
  // Age the session to the past: the next request needs a new sign-in.
  await withDb((client) => client.query("UPDATE sessions SET expires_at = now() - interval '1 minute' WHERE user_id = $1", [account.id]));
  await page.goto('/account/password');
  await page.waitForURL('**/sign-in**');
  await expect(page.getByText('Please sign in again.')).toBeVisible();
});

test('E-001/AC-72 a new password under 12 characters is rejected with "Use at least 12 characters."', async ({ page, users }) => {
  const account = await users();
  await signInWith(page, account.email, PASSWORD);
  await page.waitForURL('**/rooms');
  await open(page, '/account/password');
  await page.getByLabel('Current password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('New password', { exact: true }).fill('short-11-ch');
  await page.getByRole('button', { name: 'Save password' }).click();
  await expect(page.getByText('Use at least 12 characters.').first()).toBeVisible();
  await expect(page).toHaveURL(/\/account\/password/);
  // The old password is still the one in force.
  const row = await withDb((client) => client.query<{ version: number }>('SELECT version FROM users WHERE id = $1', [account.id]));
  expect(row.rows[0]?.version).toBe(1);
});

test('E-001/AC-84 a deactivated user is rejected with "This account is not active."', async ({ page, users }) => {
  const account = await users({ deactivated: true });
  await signInWith(page, account.email, PASSWORD);
  await expect(summary(page)).toContainText('This account is not active.');
  await expect(page).toHaveURL(/\/sign-in/);
  expect((await page.context().cookies()).filter((c) => c.name === '__Host-session' && c.value !== '')).toHaveLength(0);
});

test('E-001/AC-85 wrong details are rejected with "Email or password is wrong." for a known and an unknown email', async ({ page, users }) => {
  const account = await users();
  await signInWith(page, account.email, 'not-the-password');
  await expect(summary(page)).toContainText('Email or password is wrong.');
  await signInWith(page, `e2e-unknown-${randomUUID()}@example.test`, PASSWORD);
  await expect(summary(page)).toContainText('Email or password is wrong.');
  await expect(page).toHaveURL(/\/sign-in/);
});
