import { test, expect, type Cookie } from '@playwright/test'

// E2E-FLOW-07: navigation, auth-guard redirects, 404 boundary (mock mode).
//
// Exercises EXISTING routing/auth behaviour only — no Class-A path is modified.
//   - src/middleware.ts redirects an unauthenticated /{locale}/* PAGE request to
//     /{locale}/login (its /api/* 401 branch is dead code: config.matcher
//     excludes `api`, so that branch never runs — see rev-sec-01). The
//     (authenticated) client layout re-checks /api/auth/me and itself pushes to
//     login on failure.
//   - API auth is therefore enforced at the handler, not the middleware:
//     /api/journals reads the Authorization: Bearer header and returns 401 when
//     none is present.
//   - No custom not-found.tsx / error.tsx exists anywhere under src/app, so an
//     unmatched route renders Next's built-in 404 (`<h1>404</h1>` +
//     `<h2>This page could not be found.</h2>`) with HTTP status 404.
//   - The primary nav lives in DockSidebar (desktop `<aside><nav>`) and Sidebar
//     (mobile `<header>`); on the Desktop Chrome viewport only the dock renders.
//
// Mock mode is forced via playwright.config.ts and the seeded admin is
// provisioned by tests/e2e/global-setup.ts. Exactly ONE login POST happens, in
// the top-level beforeAll — the auth rate limiter is 5 login POSTs / 15 min /
// IP, shared in-memory across the whole e2e run, so the authenticated tests
// reuse that session cookie via context.addCookies. The unauthenticated tests
// use the default per-test context, which carries no cookies. No sleeps;
// Playwright auto-waits on toHaveURL / locator visibility.

let authCookies: Cookie[] | undefined

test.beforeAll(async ({ browser }) => {
  test.setTimeout(150_000)
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto('/ja/login')
  await page.getByLabel('Email', { exact: true }).fill('admin@example.com')
  await page.getByLabel('Password', { exact: true }).fill('admin123')
  await page.getByRole('button', { name: 'Sign In', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 })
  authCookies = await context.cookies()
  await context.close()
})

test.describe('Unauthenticated auth-guard (existing middleware + handler behaviour)', () => {
  test('protected pages redirect to the login page', async ({ page }) => {
    // Three distinct protected destinations all funnel to /ja/login with no
    // session cookie. The default per-test context carries no cookies, so the
    // middleware redirect (not the client layout) is what is exercised.
    for (const path of ['/ja/dashboard', '/ja/audit/journals', '/ja/reports/monthly']) {
      await page.goto(path)
      await expect(page).toHaveURL(/\/ja\/login$/, { timeout: 30_000 })
    }

    // It really is the login page (not a redirect-chain artefact).
    await expect(page.getByLabel('Email', { exact: true })).toBeVisible()
  })

  test('a protected API endpoint rejects a token-less request with 401', async ({ request }) => {
    // The matcher excludes /api/*, so the middleware never runs here; the
    // /api/journals handler enforces auth itself via the Authorization header.
    // The standalone `request` fixture sends no Authorization header and no
    // cookies, so the handler returns its 401 before touching the database.
    const response = await request.get('/api/journals')
    expect(response.status()).toBe(401)
    const body = await response.json()
    expect(body).toMatchObject({ success: false })
  })
})

test.describe('Authenticated navigation + 404 boundary', () => {
  test.beforeEach(async ({ context }) => {
    if (authCookies) await context.addCookies(authCookies)
    test.setTimeout(150_000)
  })

  test('primary nav links render and a click resolves within the app', async ({ page }) => {
    await page.goto('/ja/dashboard')

    // The authenticated shell only mounts the DockSidebar <nav> after
    // /api/auth/me resolves, so this also proves the session cookie is honoured.
    const dockNav = page.locator('aside nav').first()
    await expect(dockNav).toBeVisible({ timeout: 30_000 })

    // Representative primary destinations are present in the nav (hrefs are
    // locale-prefixed and deterministic, so anchor on the href, not the label).
    const primaryHrefs = [
      '/ja/dashboard',
      '/ja/reports/monthly',
      '/ja/reports/budget',
      '/ja/audit/journals',
      '/ja/settings',
    ]
    for (const href of primaryHrefs) {
      await expect(page.locator(`aside nav a[href="${href}"]`)).toHaveCount(1)
    }

    // Clicking a primary nav link routes to a real authenticated page (not to
    // login, not to a 404). Settings is a known-good mock-mode destination.
    await page.locator('aside nav a[href="/ja/settings"]').click()
    await expect(page).toHaveURL(/\/ja\/settings$/, { timeout: 30_000 })
    // The shared authenticated layout persists across the client navigation.
    await expect(dockNav).toBeVisible()
  })

  test('an unmatched route renders the built-in 404 boundary, not a login redirect', async ({
    page,
  }) => {
    // Authenticated, so the middleware locale-prefix guard passes; the unknown
    // segment then falls through to Next's built-in not-found (no custom
    // not-found.tsx exists, so the default 404 copy renders).
    const response = await page.goto('/ja/e2e-flow-07-missing-route')
    expect(response?.status()).toBe(404)

    // It is the 404 boundary, not an auth redirect nor a normal app page.
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.getByText('This page could not be found.')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('heading', { name: '404' })).toBeVisible()
  })
})
