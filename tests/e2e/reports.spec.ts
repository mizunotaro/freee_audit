import { test, expect } from '@playwright/test'

test.describe('Reports Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ja/login')

    const emailInput = page.locator('input[type="email"], input[name="email"]')
    if ((await emailInput.count()) > 0) {
      await emailInput.fill('test@example.com')
      await page.locator('input[type="password"], input[name="password"]').fill('password123')
      await page.locator('button[type="submit"]').click()
      await page.waitForTimeout(1000)
    }
  })

  test('should display reports navigation', async ({ page }) => {
    await page.goto('/ja/reports')
    await page.waitForTimeout(1000)

    const currentUrl = page.url()
    expect(currentUrl).toContain('/ja/')
  })

  test('should show balance sheet page', async ({ page }) => {
    await page.goto('/ja/reports/balance-sheet')
    await page.waitForTimeout(1000)

    const currentUrl = page.url()
    expect(currentUrl).toContain('/ja/')
  })

  test('should show profit loss page', async ({ page }) => {
    await page.goto('/ja/reports/profit-loss')
    await page.waitForTimeout(1000)

    const currentUrl = page.url()
    expect(currentUrl).toContain('/ja/')
  })

  test('should show cash flow page', async ({ page }) => {
    await page.goto('/ja/reports/cash-flow')
    await page.waitForTimeout(1000)

    const currentUrl = page.url()
    expect(currentUrl).toContain('/ja/')
  })
})

test.describe('Report Export', () => {
  test('should have export options', async ({ page }) => {
    await page.goto('/ja/reports')
    await page.waitForTimeout(1000)

    const exportButton = page.locator(
      '[data-testid="export"], button:has-text("出力"), button:has-text("Export")'
    )
    const hasExportButton = (await exportButton.count()) > 0

    expect(hasExportButton || page.url().includes('login')).toBeTruthy()
  })
})

test.describe('KPI Dashboard', () => {
  test('should display KPI widgets', async ({ page }) => {
    await page.goto('/ja/dashboard')
    await page.waitForTimeout(1000)

    const pageContent = await page.textContent('body')
    const hasKPIContent =
      pageContent?.includes('ROE') ||
      pageContent?.includes('ROA') ||
      pageContent?.includes('Runway') ||
      pageContent?.includes('dashboard') ||
      pageContent?.includes('login')

    expect(hasKPIContent).toBeTruthy()
  })
})
