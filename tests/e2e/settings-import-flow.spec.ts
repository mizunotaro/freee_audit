import { test, expect, type Cookie } from '@playwright/test'

// E2E-FLOW-03: settings save + CSV data-import flow in mock mode.
//
// Drives the seeded admin through two previously-untested happy/error paths:
//   1. /ja/settings  — change a value, save, assert the PUT is 200, the success
//      toast renders, and the value round-trips through GET (persistence).
//   2. /ja/import/journals — upload a valid fixture CSV and assert the import
//      succeeds (200 + result panel), then assert the two validation-error
//      paths: a non-CSV file is rejected by the client (alert, upload blocked),
//      and a CSV missing required headers is rejected by the server (400 alert).
//
// Mock mode (FREEE_MOCK_MODE/AI_MOCK_MODE) is forced via playwright.config.ts
// and the seeded admin is provisioned by tests/e2e/global-setup.ts. The journal
// importer writes straight to SQLite (no external call), so the import result is
// deterministic. Assertions anchor on the network response (status + parsed
// body) and on stable ARIA roles the components already expose (role="status"
// result panel, role="alert" error banner) — no sleeps, no class selectors.

// Auth happens once in beforeAll and the session cookie is injected into each
// test's context (not a per-test login): the auth rate limiter is 5 login POSTs
// / 15 min / IP, hardcoded in src/lib/security and shared in-memory across the
// whole e2e run, so this spec must contribute as few logins as possible.
let authCookies: Cookie[] | undefined

test.describe('E2E settings + import flow (mock mode)', () => {
  test.beforeAll(async ({ browser }) => {
    // next dev compiles each route on first hit (in CI too); the single cold
    // start covers login + the dashboard compile.
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

  test.beforeEach(async ({ context }) => {
    if (authCookies) await context.addCookies(authCookies)
    test.setTimeout(150_000)
  })

  test('settings save persists a changed value', async ({ page }) => {
    await page.goto('/ja/settings')
    // Bottom save button mounts once the page hydrates (post /api/settings GET).
    await expect(page.getByRole('button', { name: '設定を保存', exact: true })).toBeVisible({
      timeout: 30_000,
    })

    // freee Client ID is a plain labeled input on the freee tab and is returned
    // verbatim by GET (not masked), so it is a clean value to round-trip.
    await page.getByRole('tab', { name: 'freee連携' }).click()
    await page.getByLabel('Client ID', { exact: true }).fill('e2e-client-12345')

    const [putResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === 'PUT' &&
          new URL(response.url()).pathname === '/api/settings'
      ),
      page.getByRole('button', { name: '設定を保存', exact: true }).click(),
    ])
    expect(putResponse.status()).toBe(200)

    // Visible success state (sonner toast mounted in [locale]/layout.tsx).
    await expect(page.getByText('設定を保存しました')).toBeVisible({ timeout: 5_000 })

    // Persistence: the authenticated GET returns the stored value verbatim.
    const getResponse = await page.request.get('/api/settings')
    expect(getResponse.status()).toBe(200)
    const saved = await getResponse.json()
    expect(saved.freeeClientId).toBe('e2e-client-12345')
  })

  test('journal CSV import succeeds and renders the result panel', async ({ page }) => {
    await page.goto('/ja/import/journals')
    await expect(
      page.getByRole('heading', { name: '仕訳データインポート', exact: true })
    ).toBeVisible({ timeout: 30_000 })

    // Drive "update existing / don't skip duplicates" so the run is deterministic
    // on any DB state: a fresh DB inserts the rows, a re-run (rows already
    // present from a prior local play) updates them. Either way imported >= 1,
    // whereas the default skip-duplicates would report imported=0 on a re-run.
    await page.getByLabel('重複データをスキップする').uncheck()
    await page.getByLabel('既存データを更新する').check()

    // The fixture (header + 2 valid rows) matches the importer's JP mapping.
    await page.locator('#csv-upload').setInputFiles('tests/e2e/fixtures/journals-good.csv')

    const [postResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname === '/api/import/journals'
      ),
      page.getByRole('button', { name: 'インポート実行' }).click(),
    ])
    expect(postResponse.status()).toBe(200)
    const body = await postResponse.json()
    expect(body.success).toBe(true)
    expect(body.imported).toBeGreaterThanOrEqual(1)
    expect(body.failed).toBe(0)

    // UI success state: the role="status" result panel with its heading.
    await expect(page.getByRole('status')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('インポート結果')).toBeVisible()
  })

  test('a non-CSV file is rejected client-side before upload', async ({ page }) => {
    await page.goto('/ja/import/journals')
    await expect(
      page.getByRole('heading', { name: '仕訳データインポート', exact: true })
    ).toBeVisible({ timeout: 30_000 })

    // setInputFiles bypasses the input's accept=".csv" hint and fires onChange;
    // the component guards on the extension and sets the error, never the file.
    await page.locator('#csv-upload').setInputFiles('tests/e2e/fixtures/not-a-csv.txt')

    // Next.js mounts an empty route-announcer that also carries role="alert";
    // scope to the real error banner by its message text.
    const errorBanner = page.getByRole('alert').filter({ hasText: 'CSVファイルを選択してください' })
    await expect(errorBanner).toBeVisible()
    // No file selected -> run button stays disabled (no request sent).
    await expect(page.getByRole('button', { name: 'インポート実行' })).toBeDisabled()
  })

  test('a malformed CSV is rejected by the server with a 400 alert', async ({ page }) => {
    await page.goto('/ja/import/journals')
    await expect(
      page.getByRole('heading', { name: '仕訳データインポート', exact: true })
    ).toBeVisible({ timeout: 30_000 })

    // Passes the client .csv check, so it reaches the server, which fails it:
    // none of the required headers map -> 400 with { success: false }.
    await page.locator('#csv-upload').setInputFiles('tests/e2e/fixtures/journals-bad-headers.csv')

    const [postResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname === '/api/import/journals'
      ),
      page.getByRole('button', { name: 'インポート実行' }).click(),
    ])
    expect(postResponse.status()).toBe(400)
    const body = await postResponse.json()
    expect(body.success).toBe(false)

    // UI error state: the role="alert" banner surfaces the server message
    // (filter out Next's empty route-announcer, which also carries role="alert").
    const errorBanner = page.getByRole('alert').filter({ hasText: /Missing required headers/ })
    await expect(errorBanner).toBeVisible({ timeout: 10_000 })
  })
})
