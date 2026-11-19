import { defineConfig, devices } from '@playwright/test';

/**
 * E2E config (Tier 3). Not run in CI yet. Starts `next dev` unless one is
 * already running on :3000. Browsers: `npx playwright install chromium`.
 */
export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:3000',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
  },
});
