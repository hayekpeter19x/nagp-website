// End-to-end tests. `npm test` builds the site, starts a local server with a
// fresh database (sample data included) and runs everything in tests/.
import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

const PORT = 8799;
const executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;

export default defineConfig({
  testDir: 'tests',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    launchOptions: { executablePath },
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], launchOptions: { executablePath } } },
    { name: 'phone', use: { ...devices['Pixel 7'], launchOptions: { executablePath } } },
  ],
  webServer: {
    command: `rm -rf .wrangler/state-test && NAGP_DIST=dist-test node build.mjs && npx wrangler pages dev dist-test --d1 DB=nagp-local --binding DEMO_MODE=true --port ${PORT} --persist-to .wrangler/state-test --compatibility-date=2025-09-01`,
    url: `http://localhost:${PORT}/api/session`,
    timeout: 120_000,
    reuseExistingServer: false,
  },
});
