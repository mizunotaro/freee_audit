import { test, expect } from '@playwright/test'

// E2E-CORE-01 green baseline: the minimal happy path the CI e2e job must pass.
// Mock mode (FREEE_MOCK_MODE/AI_MOCK_MODE) is forced via playwright.config.ts
// and the seeded admin is provisioned by tests/e2e/global-setup.ts.
// Selectors use accessible roles/labels (no sleeps); Playwright auto-waits.

test.describe('E2E smoke (mock mode)', () => {
  test('login as seeded admin → dashboard renders', async ({ page }) => {
    // next dev compiles each route on first hit (in CI too); allow a cold start.
    test.setTimeout(120_000)

    await page.goto('/ja/login')

    await page.getByLabel('Email', { exact: true }).fill('admin@example.com')
    await page.getByLabel('Password', { exact: true }).fill('admin123')
    await page.getByRole('button', { name: 'Sign In', exact: true }).click()

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 })
    await expect(page.getByText('Quick Actions', { exact: true })).toBeVisible({
      timeout: 30_000,
    })
  })
})
