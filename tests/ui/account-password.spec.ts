// Purpose: UI spec for /account/password and PageShell. States, axe, Tab order, menu per role and breakpoint, session warning, drafts.
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

async function signIn(page: Page, account: Account, password = PASSWORD): Promise<void> {
  await open(page, '/sign-in');
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'));
}

/** Sign in, then open the password page. Role homes of other stories are not built yet, so the sign in lands on a 404 page. */
async function signInAndOpen(page: Page, account: Account): Promise<void> {
  await signIn(page, account);
  await open(page, '/account/password');
  await expect(page.getByRole('heading', { level: 1, name: 'Set a new password' })).toBeVisible();
}

async function expectNoViolations(makeAxeBuilder: () => { analyze: () => Promise<{ violations: unknown[] }> }) {
  const results = await makeAxeBuilder().analyze();
  expect(results.violations).toEqual([]);
}

const width = (page: Page) => page.viewportSize()?.width ?? 0;
const summary = (page: Page) => page.locator('form').getByRole('alert');
const mainMenu = (page: Page) => page.getByRole('navigation', { name: 'Main' });

/** At 375 the menu sits behind a Menu button. Open it when the button shows. */
async function revealMenu(page: Page): Promise<void> {
  const button = page.getByRole('button', { name: 'Menu' });
  if (await button.isVisible()) {
    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
  }
  await expect(mainMenu(page)).toBeVisible();
}

async function fillPasswordForm(page: Page, current: string, next: string): Promise<void> {
  await page.getByLabel('Current password', { exact: true }).fill(current);
  await page.getByLabel('New password', { exact: true }).fill(next);
  await page.getByRole('button', { name: 'Save password' }).click();
}

const MENUS: Record<Role, string[]> = {
  platform_admin: ['Offices', 'Users', 'Import', 'Rooms', 'My bookings', 'My visits', 'Reception', 'History', 'Reports', 'Change password'],
  office_admin: ['Reception', 'Rooms', 'My bookings', 'My visits', 'Office rooms', 'Users', 'Import', 'History', 'Reports', 'Change password'],
  receptionist: ['Reception', 'Rooms', 'My bookings', 'My visits', 'History', 'Reports', 'Change password'],
  employee: ['Rooms', 'My bookings', 'My visits', 'Change password'],
};

const NEW_PASSWORD = 'Brand-new-passphrase-42';

async function injectNote(page: Page, name = 'note', label = 'Note'): Promise<void> {
  await page.evaluate(
    ([fieldName, fieldLabel]) => {
      const input = document.createElement('input');
      input.type = 'text';
      input.name = fieldName ?? '';
      input.setAttribute('aria-label', fieldLabel ?? '');
      document.querySelector('#main')?.append(input);
    },
    [name, label],
  );
}

const storedText = (page: Page) =>
  page.evaluate(() => JSON.stringify({ session: Object.entries(window.sessionStorage), local: Object.entries(window.localStorage) }));
const draftKeys = (page: Page) => page.evaluate(() => Object.keys(window.sessionStorage).filter((key) => key.startsWith('draft:')));

test.describe('/account/password success state', () => {
  test('shows the title, two fields and one primary action', async ({ page, users, makeAxeBuilder }, testInfo) => {
    const account = await users();
    await signInAndOpen(page, account);
    await expect(page.getByLabel('Current password', { exact: true })).toBeVisible();
    await expect(page.getByLabel('New password', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save password' })).toBeVisible();
    await expect(page.getByText('Your admin reset your password. Set a new one to continue.')).toHaveCount(0);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await expectNoViolations(makeAxeBuilder);
    await page.screenshot({ path: testInfo.outputPath(`account-password-${testInfo.project.name}.png`), fullPage: true });
  });

  test('E-001/AC-72 and AC-50 a valid change opens the role home, notes the success and keeps the new password', async ({ page, users }) => {
    const account = await users();
    await signInAndOpen(page, account);
    await fillPasswordForm(page, PASSWORD, NEW_PASSWORD);
    await page.waitForURL('**/rooms');
    expect(await page.evaluate(() => window.sessionStorage.getItem('flash'))).toBe('password.done');
    const row = await withDb((client) => client.query<{ version: number; must_change_password: boolean }>('SELECT version, must_change_password FROM users WHERE id = $1', [account.id]));
    expect(row.rows[0]?.version).toBe(2);
    expect(row.rows[0]?.must_change_password).toBe(false);
    // The old password no longer works. The new one does.
    await open(page, '/sign-in');
    await page.getByLabel('Email').fill(account.email);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(summary(page)).toHaveText('Email or password is wrong.');
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled();
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
    await page.getByLabel('Password', { exact: true }).fill(NEW_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('**/rooms');
  });

  test('E-001/AC-49 a forced change shows its notice, hides the menu and ends at the role home', async ({ page, users, makeAxeBuilder }) => {
    const account = await users({ mustChange: true });
    await signIn(page, account);
    await expect(page).toHaveURL(/\/account\/password$/);
    await expect(page.getByText('Your admin reset your password. Set a new one to continue.')).toBeVisible();
    await revealMenu(page);
    expect(await mainMenu(page).getByRole('link').allTextContents()).toEqual(['Change password']);
    await expect(mainMenu(page).getByRole('button', { name: 'Sign out' })).toBeVisible();
    await expectNoViolations(makeAxeBuilder);
    // The role home sends the user back while the change is pending.
    await page.goto('/');
    await expect(page).toHaveURL(/\/account\/password$/);
    await open(page, '/account/password');
    await fillPasswordForm(page, PASSWORD, NEW_PASSWORD);
    await page.waitForURL('**/rooms');
    const row = await withDb((client) => client.query<{ must_change_password: boolean; temp_password_expires_at: Date | null }>('SELECT must_change_password, temp_password_expires_at FROM users WHERE id = $1', [account.id]));
    expect(row.rows[0]?.must_change_password).toBe(false);
    expect(row.rows[0]?.temp_password_expires_at).toBeNull();
  });

  test('shows "Password changed." once in a status region on the next page', async ({ page, users, makeAxeBuilder }) => {
    const account = await users();
    await signInAndOpen(page, account);
    await page.evaluate(() => window.sessionStorage.setItem('flash', 'password.done'));
    await open(page, '/account/password');
    await expect(page.getByRole('status').filter({ hasText: 'Password changed.' })).toBeVisible();
    expect(await page.evaluate(() => window.sessionStorage.getItem('flash'))).toBeNull();
    await expectNoViolations(makeAxeBuilder);
    await open(page, '/account/password');
    await expect(page.getByText('Password changed.')).toHaveCount(0);
  });

  test('an expired session redirects to /sign-in and does not keep the "Password changed." note', async ({ page, users }) => {
    const account = await users();
    await signInAndOpen(page, account);
    await withDb((client) => client.query('DELETE FROM sessions WHERE user_id = $1', [account.id]));
    await fillPasswordForm(page, PASSWORD, NEW_PASSWORD);
    await page.waitForURL('**/sign-in**');
    await expect.poll(() => page.evaluate(() => window.sessionStorage.getItem('flash'))).toBeNull();
    await page.getByLabel('Email').fill(account.email);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('**/rooms');
    await expect(page.getByText('Password changed.')).toHaveCount(0);
  });

  test('ignores an unknown flash value', async ({ page, users }) => {
    const account = await users();
    await signInAndOpen(page, account);
    await page.evaluate(() => window.sessionStorage.setItem('flash', '<b>Hacked</b>'));
    await open(page, '/account/password');
    await expect(page.getByText('Hacked')).toHaveCount(0);
  });

  test('without a session it goes to /sign-in with the return path and comes back after sign in', async ({ page, users }) => {
    const account = await users();
    await page.goto('/account/password');
    await page.waitForURL('**/sign-in?**');
    expect(new URL(page.url()).searchParams.get('returnTo')).toBe('/account/password');
    await expect(page.getByText('Please sign in again.')).toBeVisible();
    await page.waitForFunction(() => {
      const form = document.querySelector('form');
      return form !== null && Object.keys(form).some((key) => key.startsWith('__reactProps'));
    });
    await page.getByLabel('Email').fill(account.email);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('**/account/password');
    await expect(page.getByRole('heading', { level: 1, name: 'Set a new password' })).toBeVisible();
  });
});

test.describe('/account/password error state', () => {
  test('E-001/AC-72 a short new password shows "Use at least 12 characters." at the field', async ({ page, users, makeAxeBuilder }) => {
    const account = await users();
    await signInAndOpen(page, account);
    await fillPasswordForm(page, PASSWORD, 'Short-1');
    await expect(summary(page)).toHaveText('Use at least 12 characters.');
    await expect(summary(page)).toBeFocused();
    await expect(page.locator('#newPassword-error')).toHaveText('Use at least 12 characters.');
    await expect(page.getByLabel('New password', { exact: true })).toHaveAttribute('aria-describedby', 'newPassword-help newPassword-error');
    await expect(page.getByLabel('New password', { exact: true })).toHaveAttribute('aria-invalid', 'true');
    await expectNoViolations(makeAxeBuilder);
    // A password of exactly 12 characters is accepted.
    await page.getByLabel('New password', { exact: true }).fill('Twelve-chars');
    await page.getByLabel('Current password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Save password' }).click();
    await page.waitForURL('**/rooms');
  });

  test('a wrong current password shows its message at the current password field', async ({ page, users, makeAxeBuilder }) => {
    const account = await users();
    await signInAndOpen(page, account);
    await fillPasswordForm(page, 'Not-my-password-1', NEW_PASSWORD);
    await expect(summary(page)).toHaveText('Your current password is wrong.');
    await expect(summary(page)).toBeFocused();
    await expect(page.locator('#currentPassword-error')).toHaveText('Your current password is wrong.');
    await expect(page.getByLabel('Current password', { exact: true })).toHaveAttribute('aria-describedby', 'currentPassword-error');
    await expectNoViolations(makeAxeBuilder);
  });

  test('an empty form shows a message at the current password field', async ({ page, users }) => {
    const account = await users();
    await signInAndOpen(page, account);
    await page.getByRole('button', { name: 'Save password' }).click();
    await expect(summary(page)).toBeFocused();
    await expect(page.locator('#currentPassword-error')).toHaveText('Enter your current password.');
  });

  test('a changed account shows "Someone changed this. Reload to see it." and keeps the page', async ({ page, users }) => {
    const account = await users();
    await signInAndOpen(page, account);
    await withDb((client) => client.query('UPDATE users SET version = version + 1 WHERE id = $1', [account.id]));
    await fillPasswordForm(page, PASSWORD, NEW_PASSWORD);
    await expect(summary(page)).toHaveText('Someone changed this. Reload to see it.');
    await expect(page.getByRole('button', { name: 'Save password' })).toBeVisible();
  });

  test('disables the button while the request is pending', async ({ page, users }) => {
    const account = await users();
    await signInAndOpen(page, account);
    await page.route('**/account/password', async (route) => {
      if (route.request().method() === 'POST') await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });
    await fillPasswordForm(page, 'Not-my-password-1', NEW_PASSWORD);
    await expect(page.getByRole('button', { name: 'Save password' })).toBeDisabled();
    await expect(summary(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save password' })).toBeEnabled();
  });

  test('error.tsx shows the internal copy, a reference id and a working Try again', async ({ page, users, makeAxeBuilder }) => {
    const account = await users();
    await signInAndOpen(page, account);
    await page.route('**/account/password', async (route) => {
      if (route.request().method() === 'POST') await route.fulfill({ status: 500, contentType: 'text/plain', body: 'failure' });
      else await route.continue();
    });
    await fillPasswordForm(page, PASSWORD, NEW_PASSWORD);
    await expect(page.getByRole('heading', { name: 'Something went wrong' })).toBeVisible();
    await expect(page.getByText(/^Something went wrong\. Try again\. If it happens again, give reference \S+ to your admin\.$/)).toBeVisible();
    await expectNoViolations(makeAxeBuilder);
    await page.unroute('**/account/password');
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('button', { name: 'Save password' })).toBeVisible();
  });
});

test.describe('/account/password loading state', () => {
  test('shows a skeleton shaped like the form while the page loads', async ({ page, users, makeAxeBuilder }) => {
    const account = await users();
    await signIn(page, account);
    await page.goto('/sign-in/missing');
    await page.waitForFunction(() => 'next' in window);
    await page.evaluate(() => (window as unknown as { next: { router: { prefetch: (href: string) => void } } }).next.router.prefetch('/account/password'));
    // Web-first wait: the router has fetched the prefetch response for this route.
    await expect.poll(() => page.evaluate((path) => performance.getEntriesByType('resource').some((e) => e.name.includes(path) && e.name.includes('_rsc')), '/account/password')).toBe(true);
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(
      (url) => url.pathname === '/account/password' && url.searchParams.has('_rsc'),
      async (route) => {
        if (!route.request().headers()['next-router-prefetch']) await held;
        await route.continue();
      },
    );
    await page.evaluate(() => (window as unknown as { next: { router: { push: (href: string) => void } } }).next.router.push('/account/password'));
    await expect(page.getByTestId('form-skeleton')).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Loading' })).toBeVisible();
    await expectNoViolations(makeAxeBuilder);
    release();
    await expect(page.getByRole('button', { name: 'Save password' })).toBeVisible();
    await expect(page.getByTestId('form-skeleton')).toHaveCount(0);
  });
});

test.describe('/account/password not found and empty states', () => {
  test('a missing path shows the root not found copy and a link home', async ({ page, users, makeAxeBuilder }) => {
    const account = await users();
    await signIn(page, account);
    const response = await page.goto('/account/password/missing');
    expect(response?.status()).toBe(404);
    await expect(page.getByText('We could not find this item.')).toBeVisible();
    await expectNoViolations(makeAxeBuilder);
    await page.getByRole('link', { name: 'Go to home' }).click();
    await page.waitForURL('**/rooms');
  });

  test('the empty state is not used: the form always has its fields', async ({ page, users }) => {
    const account = await users();
    await signInAndOpen(page, account);
    await expect(page.locator('form input:not([type="hidden"])')).toHaveCount(2);
  });
});

test.describe('PageShell menu', () => {
  for (const role of Object.keys(MENUS) as Role[]) {
    test(`shows the ${role} menu from the matrix and Sign out`, async ({ page, users, makeAxeBuilder }) => {
      const account = await users({ role });
      await signInAndOpen(page, account);
      await revealMenu(page);
      expect(await mainMenu(page).getByRole('link').allTextContents()).toEqual(MENUS[role]);
      await expect(mainMenu(page).getByRole('button', { name: 'Sign out' })).toBeVisible();
      await expect(mainMenu(page).getByRole('link', { name: 'Change password' })).toHaveAttribute('aria-current', 'page');
      await expect(page.getByText(account.name)).toBeVisible();
      await expectNoViolations(makeAxeBuilder);
    });
  }

  test('375 hides the menu behind a Menu button, 768 shows a top bar, 1280 shows a side menu', async ({ page, users }) => {
    const account = await users({ role: 'receptionist' });
    await signInAndOpen(page, account);
    const button = page.getByRole('button', { name: 'Menu' });
    const nav = mainMenu(page);
    const main = page.locator('#main');
    if (width(page) <= 375) {
      await expect(button).toBeVisible();
      await expect(nav).toBeHidden();
      await expect(button).toHaveAttribute('aria-expanded', 'false');
      await button.click();
      await expect(nav).toBeVisible();
      await expect(button).toHaveAttribute('aria-expanded', 'true');
      // Escape closes the menu and returns focus to the button.
      await page.keyboard.press('Escape');
      await expect(nav).toBeHidden();
      await expect(button).toBeFocused();
    } else {
      await expect(button).toBeHidden();
      await expect(nav).toBeVisible();
      const navBox = await nav.boundingBox();
      const mainBox = await main.boundingBox();
      expect(navBox).not.toBeNull();
      expect(mainBox).not.toBeNull();
      if (width(page) >= 1280) {
        // Side menu beside the page content.
        expect(navBox!.x + navBox!.width).toBeLessThanOrEqual(mainBox!.x);
      } else {
        // Top bar above the page content.
        expect(navBox!.y + navBox!.height).toBeLessThanOrEqual(mainBox!.y);
      }
    }
  });

  test('every menu control is at least 24 by 24 pixels and shows a focus ring', async ({ page, users }) => {
    const account = await users({ role: 'office_admin' });
    await signInAndOpen(page, account);
    await revealMenu(page);
    const controls = mainMenu(page).locator('a, button');
    const count = await controls.count();
    expect(count).toBeGreaterThan(5);
    for (let i = 0; i < count; i++) {
      const box = await controls.nth(i).boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(24);
      expect(box!.height).toBeGreaterThanOrEqual(24);
    }
    await mainMenu(page).getByRole('link').first().focus();
    await page.keyboard.press('Tab');
    await expect(mainMenu(page).getByRole('link').nth(1)).toHaveCSS('outline-style', 'solid');
  });

  test('Sign out ends the session, clears the cookie and returns to /sign-in', async ({ page, users }) => {
    const account = await users();
    await signInAndOpen(page, account);
    await page.evaluate(() => window.sessionStorage.setItem('flash', 'password.done'));
    await revealMenu(page);
    await mainMenu(page).getByRole('button', { name: 'Sign out' }).click();
    await page.waitForURL('**/sign-in');
    expect(await page.evaluate(() => window.sessionStorage.getItem('flash'))).toBeNull();
    const rows = await withDb((client) => client.query('SELECT 1 FROM sessions WHERE user_id = $1', [account.id]));
    expect(rows.rowCount).toBe(0);
    await page.goto('/account/password');
    await page.waitForURL('**/sign-in?**');
    expect((await page.context().cookies()).filter((cookie) => cookie.name === '__Host-session' && cookie.value !== '')).toHaveLength(0);
  });
});

test.describe('/account/password keyboard and fields', () => {
  test('Tab reaches the skip link, the menu, then current password, new password and Save password', async ({ page, users }) => {
    const account = await users();
    await signInAndOpen(page, account);
    const names: string[] = [];
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      const name = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return '';
        const labels = (el as HTMLInputElement).labels;
        return (labels && labels[0]?.innerText) || el.getAttribute('aria-label') || el.innerText.trim();
      });
      names.push(name);
      if (name === 'Save password') break;
    }
    expect(names[0]).toBe('Skip to main content');
    expect(names.slice(-3)).toEqual(['Current password', 'New password', 'Save password']);
    if (width(page) <= 375) {
      expect(names.slice(1, -3)).toEqual(['Room Booking', 'Menu']);
    } else {
      expect(names.slice(1, -3)).toEqual(['Room Booking', 'Rooms', 'My bookings', 'My visits', 'Change password', 'Sign out']);
    }
    await expect(page.getByRole('button', { name: 'Save password' })).toHaveCSS('outline-style', 'solid');
  });

  test('sets autocomplete on both fields and allows paste', async ({ page, users }) => {
    const account = await users();
    await signInAndOpen(page, account);
    await expect(page.getByLabel('Current password', { exact: true })).toHaveAttribute('autocomplete', 'current-password');
    await expect(page.getByLabel('New password', { exact: true })).toHaveAttribute('autocomplete', 'new-password');
    for (const label of ['Current password', 'New password']) {
      const notPrevented = await page.getByLabel(label, { exact: true }).evaluate((el) => {
        const data = new DataTransfer();
        data.setData('text/plain', 'pasted-value');
        return el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
      });
      expect(notPrevented).toBe(true);
    }
  });
});

test.describe('PageShell session warning', () => {
  test('E-001/AC-71 warns 5 minutes before the end, then asks the user to sign in again', async ({ page, users, makeAxeBuilder }) => {
    const account = await users();
    await signInAndOpen(page, account);
    await page.clock.install({ time: new Date() });
    await open(page, '/account/password');
    const region = page.getByTestId('session-warning');
    const minute = 60_000;
    await expect(region).toBeEmpty();
    // 6 minutes left: no warning yet.
    await page.clock.fastForward(12 * 60 * minute - 6 * minute);
    await page.clock.runFor(1500);
    await expect(region).toBeEmpty();
    // 4 minutes left: the warning shows in the status region.
    await page.clock.fastForward(2 * minute);
    await page.clock.runFor(1500);
    await expect(page.getByRole('status').filter({ hasText: 'Your session ends in 5 minutes. Save your work, then sign in again.' })).toBeVisible();
    await expectNoViolations(makeAxeBuilder);
    // Past the end: the warning gives way to the sign in link.
    await page.clock.fastForward(5 * minute);
    await page.clock.runFor(1500);
    await expect(page.getByText('Your session ends in 5 minutes.')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Please sign in again.' })).toHaveAttribute('href', '/sign-in?reason=expired');
  });
});

test.describe('PageShell draft keeper', () => {
  test('keeps a draft for the same user on the same page', async ({ page, users }) => {
    const account = await users();
    await signInAndOpen(page, account);
    await injectNote(page);
    await page.getByLabel('Note').fill('half written text');
    expect(await draftKeys(page)).toEqual([`draft:v1:${account.id}:/account/password`]);
    await open(page, '/account/password');
    await injectNote(page);
    await expect(page.getByLabel('Note')).toHaveValue('half written text');
  });

  test('clears drafts at sign-out', async ({ page, users }) => {
    const account = await users();
    await signInAndOpen(page, account);
    await injectNote(page);
    await page.getByLabel('Note').fill('half written text');
    expect(await draftKeys(page)).toHaveLength(1);
    await revealMenu(page);
    await mainMenu(page).getByRole('button', { name: 'Sign out' }).click();
    await page.waitForURL('**/sign-in');
    expect(await draftKeys(page)).toEqual([]);
    expect(await page.evaluate(() => window.sessionStorage.getItem('draft-owner'))).toBeNull();
    await signIn(page, account);
    await open(page, '/account/password');
    await injectNote(page);
    await expect(page.getByLabel('Note')).toHaveValue('');
  });

  test('clears drafts when another user signs in', async ({ page, users }) => {
    const first = await users();
    const second = await users();
    await signInAndOpen(page, first);
    await injectNote(page);
    await page.getByLabel('Note').fill('first user draft');
    expect(await draftKeys(page)).toEqual([`draft:v1:${first.id}:/account/password`]);
    // The second user signs in on the same tab without the first user signing out.
    await signIn(page, second);
    await open(page, '/account/password');
    expect(await draftKeys(page)).toEqual([]);
    expect(await page.evaluate(() => window.sessionStorage.getItem('draft-owner'))).toBe(second.id);
    await injectNote(page);
    await expect(page.getByLabel('Note')).toHaveValue('');
  });

  test('never stores a password field', async ({ page, users }) => {
    const account = await users();
    await signInAndOpen(page, account);
    await page.getByLabel('Current password', { exact: true }).fill('typed-current-secret-1');
    await page.getByLabel('New password', { exact: true }).fill('typed-new-secret-22');
    await page.getByLabel('Current password', { exact: true }).press('Tab');
    await injectNote(page, 'newPassword', 'Named like a password');
    await page.getByLabel('Named like a password').fill('typed-named-secret-3');
    await page.evaluate(() => {
      const input = document.createElement('input');
      input.type = 'password';
      input.name = 'secret';
      input.setAttribute('aria-label', 'Secret');
      document.querySelector('#main')?.append(input);
    });
    await page.getByLabel('Secret', { exact: true }).fill('typed-secret-field-4');
    const stored = await storedText(page);
    for (const secret of ['typed-current-secret-1', 'typed-new-secret-22', 'typed-named-secret-3', 'typed-secret-field-4']) {
      expect(stored).not.toContain(secret);
    }
    expect(await draftKeys(page)).toEqual([]);
  });
});
