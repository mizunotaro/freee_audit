import { defineConfig, devices } from '@playwright/test'
import { webServerEnv } from './tests/e2e/lib/env'

export default defineConfig({
  testDir: './tests/e2e',
  // Creates the test DB schema + seeded admin before the server/tests start,
  // so `pnpm e2e` is self-contained in CI (the e2e job does no DB setup).
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    // Force mock mode + provide boot-time secrets (CSRF_SECRET>=32 etc.) for the
    // dev server. process.env wins for secrets so CI's job env is respected.
    env: webServerEnv(),
  },
})
