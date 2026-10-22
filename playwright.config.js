// End-to-end tests. `npm test` builds the site into dist-test, starts a local server with a
// fresh database (sample data and demo accounts included) and runs every tests/*.spec.js file
// in two projects: "desktop" (everything) and "phone" (only tests tagged @phone).
//
// To run against a server you already started (faster while working on the tests):
//   NAGP_TEST_URL=http://localhost:8795 NAGP_TEST_DIST=dist-qa npx playwright test
import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

const PORT = 8799;
const external = process.env.NAGP_TEST_URL || '';
const baseURL = external || `http://localhost:${PORT}`;
const executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;

export default defineConfig({
  testDir: 'tests',
  // Only *.spec.js files are tests (tests/stripe-signature.check.mjs is a plain node script).
  testMatch: '**/*.spec.js',
  timeout: 45_000,
  expect: { timeout: 7_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL,
    launchOptions: { executablePath },
    // The site scrolls smoothly unless reduced motion is asked for; instant scrolling keeps clicks reliable.
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], launchOptions: { executablePath }, reducedMotion: 'reduce' } },
    // The phone run covers the most important journeys only, to keep the suite fast.
    { name: 'phone', grep: /@phone/, use: { ...devices['Pixel 7'], launchOptions: { executablePath }, reducedMotion: 'reduce' } },
  ],
  webServer: external ? undefined : {
    command: `rm -rf .wrangler/state-test && NAGP_SHOW_PRICES=1 NAGP_DIST=dist-test node build.mjs && npx wrangler pages dev dist-test --d1 DB=nagp-local --binding DEMO_MODE=true --binding EMAIL_TEST_MODE=show-links --port ${PORT} --persist-to .wrangler/state-test --compatibility-date=2025-09-01`,
    url: `http://localhost:${PORT}/api/session`,
    timeout: 120_000,
    reuseExistingServer: false,
  },
});
