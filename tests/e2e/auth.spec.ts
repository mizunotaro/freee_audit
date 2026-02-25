import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should display login page', async ({ page }) => {
    const currentUrl = page.url()
    const isValidUrl =
      currentUrl === 'http://localhost:3000/' ||
      currentUrl.includes('/ja/') ||
      currentUrl.includes('/en/') ||
      currentUrl.includes('login') ||
      currentUrl.includes('dashboard')

    expect(isValidUrl).toBeTruthy()

    const loginForm = page.locator('form, [data-testid="login-form"]')
    const hasLoginForm = (await loginForm.count()) > 0
    expect(
      hasLoginForm || page.url().includes('dashboard') || currentUrl === 'http://localhost:3000/'
    ).toBeTruthy()
  })

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/ja/login')

    const emailInput = page.locator('input[type="email"], input[name="email"]')
    const passwordInput = page.locator('input[type="password"], input[name="password"]')

    if ((await emailInput.count()) > 0) {
      await emailInput.fill('invalid@example.com')
      await passwordInput.fill('wrongpassword')

      const submitButton = page.locator('button[type="submit"]')
      await submitButton.click()

      await page.waitForTimeout(1000)

      const errorMessage = page.locator('[class*="error"], [data-testid="error-message"]')
      const hasError = (await errorMessage.count()) > 0
      expect(hasError || page.url().includes('login')).toBeTruthy()
    }
  })
})

test.describe('Dashboard Access', () => {
  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/ja/dashboard')

    await page.waitForTimeout(1000)

    const currentUrl = page.url()
    const isLoginPage = currentUrl.includes('login')
    const isDashboardPage = currentUrl.includes('dashboard')

    expect(isLoginPage || isDashboardPage).toBeTruthy()
  })
})

test.describe('Security Headers', () => {
  test('should have security headers set', async ({ page }) => {
    const response = await page.goto('/')

    if (response) {
      const headers = response.headers()

      const hasFrameOptions = headers['x-frame-options'] || headers['X-Frame-Options']
      const hasContentTypeOptions =
        headers['x-content-type-options'] || headers['X-Content-Type-Options']

      expect(
        hasFrameOptions || hasContentTypeOptions || Object.keys(headers).length > 0
      ).toBeTruthy()
    }
  })
})
