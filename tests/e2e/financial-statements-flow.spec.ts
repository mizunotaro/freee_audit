import { test, expect, type Cookie, type Page } from '@playwright/test'

// E2E-FLOW-04: financial-statement reports (BS/PL/CF) render + period switch + export in mock mode.
//
// Drives the seeded admin into the periodic report — the one page that renders
// BS + PL + CF as independent tables AND exposes period controls (period type,
// fiscal-year-end month, prior-year toggle) plus a CSV export. E2E-CORE-02
// (reports-close.spec) already covers the default-period render + CSV content;
// this spec's net-new coverage is PERIOD SWITCHING: it changes the period type
// and asserts the report re-fetches with the new window and renders fewer
// period columns, then exports and asserts the export request carries the
// switched period (so the UI propagates the user's selection into the export).
//
// Mock mode (FREEE_MOCK_MODE/AI_MOCK_MODE) is forced via playwright.config.ts
// and the seeded admin is provisioned by tests/e2e/global-setup.ts. The periodic
// service falls back to sample data on an empty DB, so every period window
// resolves with BS/PL/CF rows; only the numeric amounts are randomized
// (Math.random in generateSamplePeriodData), which this spec never asserts on.
// Deterministic anchors: the network request's periodType query param and the
// per-row cell count (1 label cell + one cell per period — 13 for 12months,
// 4 for 3months). No sleeps: Playwright auto-waits on waitForResponse + locators.

// Auth happens once in beforeAll and the session cookie is injected into each
// test's context (not a per-test login): the auth rate limiter is 5 login POSTs
// / 15 min / IP, hardcoded in src/lib/security and shared in-memory across the
// whole e2e run, so this spec must contribute as few logins as possible.
let authCookies: Cookie[] | undefined

// The CF "営業CF" row is the deterministic anchor for the period-column count:
// one label cell + one cell per period. generatePeriodicReport emits exactly
// `monthsBack` periods (3/6/12) for the chosen periodType (doubled only when
// includePreviousYear is on, which this spec leaves off), so the cell count is
// 1 + periodType — 13 for 12months, 4 for 3months.
const operatingCfRow = (page: Page) =>
  page.getByRole('row').filter({ has: page.getByRole('cell', { name: '営業CF', exact: true }) })

const periodTypeResponse = (page: Page, periodType: string) =>
  page.waitForResponse(
    (response) => {
      try {
        if (response.request().method() !== 'GET') return false
        const url = new URL(response.url())
        return (
          url.pathname === '/api/reports/periodic' &&
          url.searchParams.get('periodType') === periodType
        )
      } catch {
        return false
      }
    },
    { timeout: 30_000 }
  )

test.describe('E2E financial-statement reports flow (mock mode)', () => {
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

  test('BS/PL/CF render and switching the period type re-fetches with fewer columns', async ({
    page,
  }) => {
    // Initial load fetches the default 12months window (cold compile allowed).
    const initialResponsePromise = periodTypeResponse(page, '12months')
    await page.goto('/ja/reports/periodic')
    const initialResponse = await initialResponsePromise
    expect(initialResponse.status()).toBe(200)

    // Page shell + the three financial-statement cards mounted. The h1 is used
    // (not getByText) because the AppLayout nav also has a "多期間レポート" link.
    await expect(page.getByRole('heading', { name: '多期間レポート', exact: true })).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByText('損益計算書 (PL)', { exact: true })).toBeVisible()
    await expect(page.getByText('貸借対照表 (BS)', { exact: true })).toBeVisible()
    await expect(page.getByText('キャッシュフロー (CF)', { exact: true })).toBeVisible()

    // A representative key-figure row from each statement proves data rendered,
    // not just card headers: PL net income, BS equity, CF ending cash.
    await expect(page.getByRole('cell', { name: '当期純利益', exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: '純資産', exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: '期末現金', exact: true })).toBeVisible()

    // Baseline: 12months → 12 period columns + 1 label cell = 13 cells in the CF row.
    await expect(operatingCfRow(page).getByRole('cell')).toHaveCount(13, { timeout: 15_000 })

    // Switch the period type 12months → 3months via the shadcn Select (Radix
    // combobox). The trigger exposes no accessible name (its value renders as a
    // child element), so target it by the value text it displays; the option
    // list portals to body on open. onValueChange updates state → fetchReport
    // re-runs.
    const switchedResponsePromise = periodTypeResponse(page, '3months')
    await page.getByRole('combobox').filter({ hasText: '12ヶ月' }).click()
    await page.getByRole('option').filter({ hasText: '3ヶ月' }).click()
    const switchedResponse = await switchedResponsePromise
    expect(switchedResponse.status()).toBe(200)

    // The report re-rendered with the narrower window: 3 period columns + 1
    // label cell = 4 cells. The CF card is still mounted.
    await expect(operatingCfRow(page).getByRole('cell')).toHaveCount(4, { timeout: 15_000 })
    await expect(page.getByText('キャッシュフロー (CF)', { exact: true })).toBeVisible()
  })

  test('CSV export carries the currently-selected period type', async ({ page, context }) => {
    // Land on the page (default 12months loads), then switch to a non-default
    // window (6months) so the export assertion proves the UI propagates the
    // user's selection — not the default 12months E2E-CORE-02 already exports.
    const initialResponsePromise = periodTypeResponse(page, '12months')
    await page.goto('/ja/reports/periodic')
    await initialResponsePromise
    await expect(page.getByRole('heading', { name: '多期間レポート', exact: true })).toBeVisible({
      timeout: 30_000,
    })

    const switchedResponsePromise = periodTypeResponse(page, '6months')
    await page.getByRole('combobox').filter({ hasText: '12ヶ月' }).click()
    await page.getByRole('option').filter({ hasText: '6ヶ月' }).click()
    const switchedResponse = await switchedResponsePromise
    expect(switchedResponse.status()).toBe(200)

    // The export button calls window.open on the periodic endpoint with
    // export=csv, so the response arrives on a popup — listen at the context
    // level to catch it, and assert it is a real downloadable CSV carrying the
    // switched periodType.
    const exportResponsePromise = context.waitForEvent('response', {
      predicate: (response) => {
        try {
          const url = new URL(response.url())
          return (
            url.pathname === '/api/reports/periodic' &&
            url.searchParams.get('export') === 'csv' &&
            url.searchParams.get('periodType') === '6months'
          )
        } catch {
          return false
        }
      },
      timeout: 30_000,
    })
    await page.getByRole('button', { name: 'CSV出力' }).click()
    const exportResponse = await exportResponsePromise

    expect(exportResponse.status()).toBe(200)
    expect(exportResponse.headers()['content-type']).toContain('text/csv')
    const disposition = exportResponse.headers()['content-disposition'] ?? ''
    expect(disposition).toContain('attachment')
    expect(disposition).toContain('periodic-report.csv')

    // Chromium hands an attachment response to its download pipeline, so the
    // captured response body is not retrievable. Fetch the same export URL
    // (with the switched periodType) through the page's authenticated request
    // context to assert the file contents carry all three statements.
    const csvResponse = await page.request.get(
      '/api/reports/periodic?periodType=6months&includePreviousYear=false&fiscalYearEndMonth=12&export=csv'
    )
    expect(csvResponse.status()).toBe(200)
    const csv = await csvResponse.text()
    expect(csv).toContain('--- 貸借対照表 ---')
    expect(csv).toContain('--- 損益計算書 ---')
    expect(csv).toContain('--- キャッシュフロー ---')
  })
})
