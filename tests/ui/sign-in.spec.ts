// Purpose: UI spec for /sign-in. One test per state, axe on each, Tab order, error summary focus, autocomplete, paste, role homes.
// Rules: standards/ui.md, standards/testing.md, spec S01 sections 2 and 6. Runs at 375, 768 and 1280 through the ui-* projects.
// Test users are created here with unique emails on DATABASE_URL_MIGRATOR and deleted afterwards. Seed users are never changed.
// A missing database or server makes these tests fail. Nothing is skipped.
import { createHash, randomInt, randomUUID } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import pg from 'pg';
import type { Page } from '@playwright/test';
import { expect, test as base } from './fixtures';

const PASSWORD = 'Correct-horse-battery-9';

type Role = 'platform_admin' | 'office_admin' | 'receptionist' | 'employee';
type Account = { id: string; email: string; name: string; role: Role };
type MakeOptions = { role?: Role; mustChange?: boolean; deactivated?: boolean; tempExpired?: boolean };

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
  const role = options.role ?? 'employee';
  const id = randomUUID();
  const email = `ui-${randomUUID()}@example.test`;
  const name = `Ui Tester ${id.slice(0, 8)}`;
  passwordHash ??= hash(PASSWORD);
  const stored = await passwordHash;
  await withDb(async (client) => {
    let officeId: string | null = null;
    if (role !== 'platform_admin') {
      const office = await client.query<{ id: string }>('SELECT id FROM offices ORDER BY name LIMIT 1');
      officeId = office.rows[0]?.id ?? null;
      if (officeId === null) throw new Error('No office in the test database. Run the seed first.');
    }
    const now = Date.now();
    await client.query(
      `INSERT INTO users (id, office_id, email, name, role, password_hash, deactivated_at, must_change_password, temp_password_expires_at, version, updated_at)
       VALUES ($1, $2, $3, $4, $5::role, $6, $7, $8, $9, 1, now())`,
      [
        id,
        officeId,
        email,
        name,
        role,
        stored,
        options.deactivated ? new Date(now - 86_400_000) : null,
        options.mustChange === true || options.tempExpired === true,
        options.tempExpired ? new Date(now - 3_600_000) : options.mustChange ? new Date(now + 86_400_000) : null,
      ],
    );
  });
  return { id, email, name, role };
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

async function fillAndSubmit(page: Page, email: string, password: string): Promise<void> {
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

async function expectNoViolations(page: Page, makeAxeBuilder: () => { analyze: () => Promise<{ violations: unknown[] }> }) {
  const results = await makeAxeBuilder().analyze();
  expect(results.violations).toEqual([]);
}

async function expectNoSideScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

/** The error summary. The Next route announcer is also an alert, so the form scopes the match. */
const summary = (page: Page) => page.locator('form').getByRole('alert');

test.describe('/sign-in success state', () => {
  test('shows the form with title, labels, hint and one primary action', async ({ page, makeAxeBuilder }, testInfo) => {
    await open(page, '/sign-in');
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByText('Forgot your password? Ask your office admin to reset it.')).toBeVisible();
    await expectNoSideScroll(page);
    await expectNoViolations(page, makeAxeBuilder);
    await page.screenshot({ path: testInfo.outputPath(`sign-in-${testInfo.project.name}.png`), fullPage: true });
  });

  test('uses a full width button at 375 and a fixed width card from 768', async ({ page }) => {
    await open(page, '/sign-in');
    const width = page.viewportSize()?.width ?? 0;
    const card = await page.getByRole('region', { name: 'Sign in' }).boundingBox();
    const button = await page.getByRole('button', { name: 'Sign in' }).boundingBox();
    expect(card).not.toBeNull();
    expect(button).not.toBeNull();
    if (width <= 375) {
      expect(card!.width).toBeGreaterThan(width - 40);
      expect(button!.width).toBeGreaterThan(card!.width - 60);
    } else {
      expect(card!.width).toBe(384);
      expect(button!.width).toBeLessThan(card!.width - 60);
      // Centred on the page.
      expect(Math.abs(card!.x + card!.width / 2 - width / 2)).toBeLessThan(2);
    }
  });

  for (const [role, home] of [
    ['platform_admin', '/admin/offices'],
    ['office_admin', '/reception'],
    ['receptionist', '/reception'],
    ['employee', '/rooms'],
  ] as const) {
    test(`E-001/AC-47 opens the role home for ${role}`, async ({ page, users }) => {
      const account = await users({ role });
      await open(page, '/sign-in');
      await fillAndSubmit(page, account.email, PASSWORD);
      await page.waitForURL(`**${home}`);
      expect(new URL(page.url()).pathname).toBe(home);
    });
  }

  test('E-001/AC-47 goes to the checked returnTo path', async ({ page, users }) => {
    const account = await users();
    await open(page, '/sign-in?returnTo=%2Fbookings');
    await expect(page.locator('input[name="returnTo"]')).toHaveValue('/bookings');
    await fillAndSubmit(page, account.email, PASSWORD);
    await page.waitForURL('**/bookings');
  });

  test('drops an unsafe returnTo and uses the role home', async ({ page, users }) => {
    const account = await users();
    await open(page, '/sign-in?returnTo=%2F%2Fevil.example.com');
    await expect(page.locator('input[name="returnTo"]')).toHaveCount(0);
    await fillAndSubmit(page, account.email, PASSWORD);
    await page.waitForURL('**/rooms');
    expect(page.url()).not.toContain('evil.example.com');
  });

  test('E-001/AC-49 sends a user who must change the password to /account/password', async ({ page, users }) => {
    const account = await users({ mustChange: true });
    await open(page, '/sign-in?returnTo=%2Frooms');
    await fillAndSubmit(page, account.email, PASSWORD);
    await page.waitForURL('**/account/password');
    await expect(page.getByText('Your admin reset your password. Set a new one to continue.')).toBeVisible();
  });

  test('shows "Please sign in again." after a session ends', async ({ page, makeAxeBuilder }) => {
    await open(page, '/sign-in?reason=expired');
    await expect(page.getByRole('status').filter({ hasText: 'Please sign in again.' })).toBeVisible();
    await expectNoViolations(page, makeAxeBuilder);
  });

  test('role home with no session redirects to /sign-in and never answers 404', async ({ page }) => {
    const response = await page.request.get('/', { maxRedirects: 0 });
    expect(response.status()).toBeGreaterThanOrEqual(300);
    expect(response.status()).toBeLessThan(400);
    expect(response.headers()['location']).toContain('/sign-in');
    await page.goto('/');
    await page.waitForURL('**/sign-in');
  });
});

test.describe('/sign-in error state', () => {
  test('E-001/AC-85 wrong password: summary takes focus, email stays, password is cleared', async ({ page, users, makeAxeBuilder }) => {
    const account = await users();
    await open(page, '/sign-in');
    await fillAndSubmit(page, account.email, 'Wrong-password-123');
    await expect(summary(page)).toHaveText('Email or password is wrong.');
    await expect(summary(page)).toBeFocused();
    await expect(page.getByLabel('Email')).toHaveValue(account.email);
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
    await expectNoViolations(page, makeAxeBuilder);
  });

  test('E-001/AC-85 unknown email gets the same message', async ({ page }) => {
    await open(page, '/sign-in');
    await fillAndSubmit(page, `nobody-${randomUUID()}@example.test`, 'Wrong-password-123');
    await expect(summary(page)).toHaveText('Email or password is wrong.');
  });

  test('E-001/AC-84 deactivated user gets "This account is not active."', async ({ page, users }) => {
    const account = await users({ deactivated: true });
    await open(page, '/sign-in');
    await fillAndSubmit(page, account.email, PASSWORD);
    await expect(summary(page)).toHaveText('This account is not active.');
    await expect(summary(page)).toBeFocused();
  });

  test('E-001/AC-49 expired temporary password gets its own message', async ({ page, users }) => {
    const account = await users({ tempExpired: true });
    await open(page, '/sign-in');
    await fillAndSubmit(page, account.email, PASSWORD);
    await expect(summary(page)).toHaveText('This temporary password has expired. Ask your admin for a new one.');
  });

  test('E-001/AC-48 five wrong tries lock the account', async ({ page, users, makeAxeBuilder }) => {
    const account = await users();
    await open(page, '/sign-in');
    for (let attempt = 0; attempt < 5; attempt++) {
      await fillAndSubmit(page, account.email, `Wrong-password-${attempt}`);
      await expect(summary(page)).toHaveText('Email or password is wrong.');
      // React clears the form when the action ends. Wait for that before the next try.
      await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled();
      await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
    }
    await fillAndSubmit(page, account.email, PASSWORD);
    await expect(summary(page)).toHaveText('Too many attempts. Try again in 15 minutes.');
    await expect(summary(page)).toBeFocused();
    await expectNoViolations(page, makeAxeBuilder);
  });

  test('empty fields show a message at each field and link them with aria-describedby', async ({ page, makeAxeBuilder }) => {
    await open(page, '/sign-in');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(summary(page)).toBeFocused();
    const email = page.getByLabel('Email');
    const password = page.getByLabel('Password', { exact: true });
    await expect(page.locator('#email-error')).toHaveText('Enter a valid email address.');
    await expect(page.locator('#password-error')).toHaveText('Enter your password.');
    await expect(email).toHaveAttribute('aria-describedby', 'email-error');
    await expect(email).toHaveAttribute('aria-invalid', 'true');
    await expect(password).toHaveAttribute('aria-describedby', 'password-error');
    await expectNoViolations(page, makeAxeBuilder);
  });

  test('disables the button while the request is pending', async ({ page, users }) => {
    const account = await users();
    await open(page, '/sign-in');
    await page.route('**/sign-in', async (route) => {
      if (route.request().method() === 'POST') await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });
    await fillAndSubmit(page, account.email, 'Wrong-password-123');
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeDisabled();
    await expect(summary(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  test('error.tsx shows the internal copy, a reference id and a working Try again', async ({ page, makeAxeBuilder }) => {
    await open(page, '/sign-in');
    await page.route('**/sign-in', async (route) => {
      if (route.request().method() === 'POST') await route.fulfill({ status: 500, contentType: 'text/plain', body: 'failure' });
      else await route.continue();
    });
    await fillAndSubmit(page, `nobody-${randomUUID()}@example.test`, 'Wrong-password-123');
    await expect(page.getByRole('heading', { name: 'Something went wrong' })).toBeVisible();
    await expect(page.getByText(/^Something went wrong\. Try again\. If it happens again, give reference \S+ to your admin\.$/)).toBeVisible();
    await expectNoViolations(page, makeAxeBuilder);
    await page.unroute('**/sign-in');
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });
});

test.describe('/sign-in loading state', () => {
  test('shows a skeleton shaped like the form while the page loads', async ({ page, makeAxeBuilder }) => {
    // Start on a page of another segment, let the router learn the /sign-in loading shell, then hold the page data back.
    await page.goto('/sign-in/missing');
    await page.waitForFunction(() => 'next' in window);
    await page.evaluate(() => (window as unknown as { next: { router: { prefetch: (href: string) => void } } }).next.router.prefetch('/sign-in'));
    // Web-first wait: the router has fetched the prefetch response for this route.
    await expect.poll(() => page.evaluate((path) => performance.getEntriesByType('resource').some((e) => e.name.includes(path) && e.name.includes('_rsc')), '/sign-in')).toBe(true);
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(
      (url) => url.pathname === '/sign-in' && url.searchParams.has('_rsc'),
      async (route) => {
        if (!route.request().headers()['next-router-prefetch']) await held;
        await route.continue();
      },
    );
    await page.evaluate(() => (window as unknown as { next: { router: { push: (href: string) => void } } }).next.router.push('/sign-in'));
    await expect(page.getByTestId('form-skeleton')).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Loading' })).toBeVisible();
    await expectNoViolations(page, makeAxeBuilder);
    release();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByTestId('form-skeleton')).toHaveCount(0);
  });
});

test.describe('/sign-in not found state', () => {
  test('shows the root not found copy and a link home', async ({ page, makeAxeBuilder }) => {
    const response = await page.goto('/sign-in/missing');
    expect(response?.status()).toBe(404);
    await expect(page.getByText('We could not find this item.')).toBeVisible();
    await expectNoViolations(page, makeAxeBuilder);
    await page.getByRole('link', { name: 'Go to home' }).click();
    await page.waitForURL('**/sign-in');
  });
});

test.describe('/sign-in empty state', () => {
  test('is not used: the form always has its two fields', async ({ page }) => {
    await open(page, '/sign-in');
    await expect(page.locator('form input:not([type="hidden"])')).toHaveCount(2);
  });
});

test.describe('/sign-in keyboard and fields', () => {
  test('Tab goes email, password, Sign in, with a visible focus ring', async ({ page }) => {
    await open(page, '/sign-in');
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Email')).toBeFocused();
    await expect(page.getByLabel('Email')).toHaveCSS('outline-style', 'solid');
    await expect(page.getByLabel('Email')).toHaveCSS('outline-width', '2px');
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Password', { exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeFocused();
    await expect(page.getByRole('button', { name: 'Sign in' })).toHaveCSS('outline-style', 'solid');
  });

  test('Enter in the password field submits the form', async ({ page, users }) => {
    const account = await users();
    await open(page, '/sign-in');
    await page.getByLabel('Email').fill(account.email);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.keyboard.press('Enter');
    await page.waitForURL('**/rooms');
  });

  test('sets autocomplete on both fields and allows paste', async ({ page }) => {
    await open(page, '/sign-in');
    await expect(page.getByLabel('Email')).toHaveAttribute('autocomplete', 'email');
    await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('autocomplete', 'current-password');
    const notPrevented = await page.getByLabel('Password', { exact: true }).evaluate((el) => {
      const data = new DataTransfer();
      data.setData('text/plain', 'pasted-value');
      return el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    });
    expect(notPrevented).toBe(true);
  });
});
