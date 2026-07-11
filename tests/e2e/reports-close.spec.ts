import { test, expect } from '@playwright/test'

// E2E-CORE-02: core close/report flow in mock mode.
//
// Drives the seeded admin into the periodic report — the one page that renders
// BS + PL + CF together — asserts the three statements and a row from each
// actually render, then triggers the CSV export button and asserts the export
// endpoint answers with a real downloadable text/csv carrying all three
// statements.
//
// Mock mode (FREEE_MOCK_MODE/AI_MOCK_MODE) is forced via playwright.config.ts
// and the seeded admin is provisioned by tests/e2e/global-setup.ts. The periodic
// service falls back to sample periods on an empty DB, so the page and the CSV
// always carry the deterministic section markers/labels asserted below — only
// the numeric amounts are randomized, which we never assert on. No sleeps:
// Playwright auto-waits on locators and waitForResponse.

test.describe('E2E reports close flow (mock mode)', () => {
  test.beforeEach(async ({ page }) => {
    // next dev compiles each route on first hit (in CI too); allow a cold start
    // that covers login + the periodic report compile in one test.
    test.setTimeout(150_000)

    await page.goto('/ja/login')
    await page.getByLabel('Email', { exact: true }).fill('admin@example.com')
    await page.getByLabel('Password', { exact: true }).fill('admin123')
    await page.getByRole('button', { name: 'Sign In', exact: true }).click()
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 })
  })

  test('periodic report renders BS/PL/CF and exports a CSV file', async ({ page, context }) => {
    await page.goto('/ja/reports/periodic')

    // Page shell mounted. Scoped to the heading role: the sidebar also has a
    // "多期間レポート" nav link, so a text match is ambiguous.
    await expect(page.getByRole('heading', { name: '多期間レポート', exact: true })).toBeVisible({
      timeout: 30_000,
    })

    // All three financial statements render (the {report && (...)} block mounts
    // once /api/reports/periodic resolves).
    await expect(page.getByText('損益計算書 (PL)', { exact: true })).toBeVisible()
    await expect(page.getByText('貸借対照表 (BS)', { exact: true })).toBeVisible()
    await expect(page.getByText('キャッシュフロー (CF)', { exact: true })).toBeVisible()

    // A representative row label from each statement proves data rendered, not
    // just section headers.
    await expect(page.getByRole('cell', { name: '売上高', exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: '総資産', exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: '営業CF', exact: true })).toBeVisible()

    // Trigger the CSV export. The page calls window.open on the export endpoint,
    // so the response arrives on a popup — listen at the context level to catch
    // it, and assert it is a real downloadable file.
    const [exportResponse] = await Promise.all([
      context.waitForEvent('response', {
        predicate: (response) => {
          try {
            const url = new URL(response.url())
            return (
              url.pathname === '/api/reports/periodic' && url.searchParams.get('export') === 'csv'
            )
          } catch {
            return false
          }
        },
        timeout: 30_000,
      }),
      page.getByRole('button', { name: 'CSV出力' }).click(),
    ])

    expect(exportResponse.status()).toBe(200)
    expect(exportResponse.headers()['content-type']).toContain('text/csv')
    const disposition = exportResponse.headers()['content-disposition'] ?? ''
    expect(disposition).toContain('attachment')
    expect(disposition).toContain('periodic-report.csv')

    // Chromium hands an attachment response to its download pipeline, so the
    // captured response body is not retrievable (Network.getResponseBody misses
    // downloads). Fetch the same export URL through the page's authenticated
    // request context to assert the file contents carry all three statements.
    const csvResponse = await page.request.get(
      '/api/reports/periodic?periodType=12months&includePreviousYear=false&fiscalYearEndMonth=12&export=csv'
    )
    expect(csvResponse.status()).toBe(200)
    const csv = await csvResponse.text()
    expect(csv).toContain('--- 貸借対照表 ---')
    expect(csv).toContain('--- 損益計算書 ---')
    expect(csv).toContain('--- キャッシュフロー ---')
    expect(csv).toContain('営業CF')
  })
})
