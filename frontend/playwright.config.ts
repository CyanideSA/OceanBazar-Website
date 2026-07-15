import { defineConfig, devices } from '@playwright/test';

/**
 * OceanBazar Playwright E2E Configuration
 * Run: npx playwright test
 * UI:  npx playwright test --ui
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  projects: [
    /* Desktop Chrome */
    {
      name: 'chromium',
      testIgnore: ['**/admin/**/*.spec.ts'],
      use: {
        ...devices['Desktop Chrome'],
        // Avoid Windows system / corporate proxy hijacking loopback.
        launchOptions: {
          args: [
            '--proxy-server=direct://',
            '--proxy-bypass-list=*',
            // Windows often resolves `localhost` to ::1 while Next binds IPv4 only — force IPv4.
            '--host-resolver-rules=MAP localhost 127.0.0.1',
          ],
        },
      },
    },
    /* Mobile Safari */
    {
      name: 'mobile-safari',
      testIgnore: ['**/admin/**/*.spec.ts', '**/deterministic/**/*.spec.ts'],
      use: {
        ...devices['iPhone 13'],
        baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000',
      },
    },
    /* Admin panel — different base URL */
    {
      name: 'admin',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.PLAYWRIGHT_ADMIN_URL || 'http://127.0.0.1:5173',
        launchOptions: {
          args: [
            '--proxy-server=direct://',
            '--proxy-bypass-list=*',
            '--host-resolver-rules=MAP localhost 127.0.0.1',
          ],
        },
      },
      testMatch: '**/admin/**/*.spec.ts',
    },
  ],
  globalSetup: './tests/e2e/helpers/global-setup.ts',
});
