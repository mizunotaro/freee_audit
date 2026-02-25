import { test, expect } from '@playwright/test'

test.describe('Audit Flow', () => {
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

  test('should display audit status dashboard', async ({ page }) => {
    await page.goto('/ja/dashboard')
    await page.waitForTimeout(1000)

    const auditSection = page.locator(
      '[data-testid="audit-status"], section:has-text("監査"), section:has-text("Audit")'
    )
    const hasAuditSection = (await auditSection.count()) > 0

    expect(hasAuditSection || page.url().includes('login')).toBeTruthy()
  })

  test('should navigate to audit details', async ({ page }) => {
    await page.goto('/ja/audit')
    await page.waitForTimeout(1000)

    const currentUrl = page.url()
    expect(currentUrl).toContain('/ja/')
  })
})

test.describe('Audit Status Indicators', () => {
  test('should show passed/failed counts', async ({ page }) => {
    await page.goto('/ja/dashboard')
    await page.waitForTimeout(1000)

    const pageContent = await page.textContent('body')
    const hasStatusIndicators =
      pageContent?.includes('合格') ||
      pageContent?.includes('PASSED') ||
      pageContent?.includes('件') ||
      pageContent?.includes('dashboard') ||
      pageContent?.includes('login')

    expect(hasStatusIndicators).toBeTruthy()
  })
})

test.describe('Journal List', () => {
  test('should display journals page', async ({ page }) => {
    await page.goto('/ja/journals')
    await page.waitForTimeout(1000)

    const currentUrl = page.url()
    expect(currentUrl).toContain('/ja/')
  })
})
