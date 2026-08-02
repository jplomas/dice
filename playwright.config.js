import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  // These assert security invariants; a flaky pass is worse than a failure,
  // so no retries and a hard failure on a stray `test.only`.
  retries: 0,
  forbidOnly: true,
  fullyParallel: true,
  timeout: 60_000,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    trace: 'retain-on-failure',
    // The offline spec loads file:// URLs; no baseURL is set on purpose so a
    // test cannot accidentally depend on a server it did not start.
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
