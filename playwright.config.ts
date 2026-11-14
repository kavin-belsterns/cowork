// Purpose: Playwright runs ui (per page, axe, three viewports), e2e (one spec per story, against EARS lines)
// and characterisation (brownfield: pins current behaviour before a change, tests/characterisation/, eng-map).
// Rules: standards/ui.md and standards/testing.md. Run one project: pnpm exec playwright test --project=characterisation
// Sources: https://playwright.dev/docs/test-configuration and https://playwright.dev/docs/test-snapshots
import { defineConfig, devices } from '@playwright/test';

const ci = !!process.env.CI;
const baseURL = process.env.BASE_URL ?? 'http://localhost:3000';
const viewports = [
  { name: 'ui-375', width: 375, height: 812 }, // mobile
  { name: 'ui-768', width: 768, height: 1024 }, // tablet
  { name: 'ui-1280', width: 1280, height: 800 }, // desktop
];

export default defineConfig({
  testDir: 'tests',
  forbidOnly: ci,
  retries: ci ? 2 : 0,
  // list for the terminal, html for the CI artifact.
  reporter: [['list'], ['html', { open: 'never' }]],
  // Key placement for toHaveScreenshot in config: UNVERIFIED in the research reports. Baselines are per OS, so run in one environment.
  expect: { toHaveScreenshot: { maxDiffPixels: 100 } },
  use: { baseURL, trace: 'on-first-retry' },
  projects: [
    ...viewports.map((v) => ({
      name: v.name,
      testMatch: /ui\/.*\.spec\.ts/,
      testIgnore: /characterisation\//,
      use: { ...devices['Desktop Chrome'], viewport: { width: v.width, height: v.height } },
    })),
    { name: 'e2e', testMatch: /e2e\/.*\.spec\.ts/, testIgnore: /characterisation\//, use: { ...devices['Desktop Chrome'] } },
    // Decision 10: one config, a fourth project. Run it alone: --project=characterisation.
    { name: 'characterisation', testDir: 'tests/characterisation', testMatch: /.*\.spec\.ts/, use: { ...devices['Desktop Chrome'] } },
  ],
  // Test the production build.
  webServer: {
    command: 'pnpm run build && pnpm run start',
    url: baseURL,
    reuseExistingServer: !ci,
    timeout: 180_000,
  },
});
