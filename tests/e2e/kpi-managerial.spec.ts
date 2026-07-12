import { test, expect } from '@playwright/test'

// E2E-FLOW-02: KPI dashboard + management-accounting view (mock mode).
//
// Drives the seeded admin through the two analytic dashboards and asserts the
// three things the task names: cards render, charts render, filters apply.
//
//   1. /ja/reports/kpi        — 経営指標ダッシュボード (KPI cards + gauges/bars)
//   2. /ja/reports/budget      — 予実管理 → 経営分析 tab (variance bridge chart
//                               + managerial CVP cards)
//
// Mock mode (FREEE_MOCK_MODE/AI_MOCK_MODE) is forced via playwright.config.ts
// and the seeded admin is provisioned by tests/e2e/global-setup.ts. Both backing
// routes (/api/reports/kpi, /api/reports/budget/managerial) compute from sample
// statements (generateSample*), so they return deterministic payloads on an empty
// DB — no seeded financial rows are required. Numeric amounts are intentionally
// never asserted (they are not the contract under test); only structural rendering
// and filter→refetch wiring are. No sleeps: Playwright auto-waits on locators and
// waitForResponse. Filter assertions parse the request URL so a single-digit
// month never substring-matches a neighbouring param.

const KPI_API = '/api/reports/kpi'
const MANAGERIAL_API = '/api/reports/budget/managerial'

// Pick a month guaranteed to differ from the page default (new Date().getMonth()+1)
// so the <select> change actually flips state and triggers a refetch.
function differentMonth(): number {
  const current = new Date().getMonth() + 1
  return (current % 12) + 1
}

function hasMonth(respUrl: string, pathname: string, month: number): boolean {
  try {
    const u = new URL(respUrl)
    return u.pathname === pathname && u.searchParams.get('month') === String(month)
  } catch {
    return false
  }
}

test.describe('E2E KPI + managerial dashboards (mock mode)', () => {
  test.beforeEach(async ({ page }) => {
    // next dev compiles each route on first hit (in CI too); allow a cold start
    // that covers login + the first analytic route compile in one test.
    test.setTimeout(150_000)

    await page.goto('/ja/login')
    await page.getByLabel('Email', { exact: true }).fill('admin@example.com')
    await page.getByLabel('Password', { exact: true }).fill('admin123')
    await page.getByRole('button', { name: 'Sign In', exact: true }).click()
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 })
  })

  test('KPI dashboard renders cards, gauges and benchmark, and refetches on filter change', async ({
    page,
  }) => {
    await page.goto('/ja/reports/kpi')

    // Page shell mounted (the {kpis && (...)} block appears once /api/reports/kpi
    // resolves; until then only the pulse skeleton renders).
    await expect(
      page.getByRole('heading', { name: '経営指標ダッシュボード', exact: true })
    ).toBeVisible({ timeout: 30_000 })

    // Cards render: a couple of the always-present KPICard titles.
    await expect(page.getByText('ROE（自己資本利益率）', { exact: true })).toBeVisible()
    await expect(page.getByText('自己資本比率', { exact: true }).first()).toBeVisible()

    // Charts render: the two gauge section headings mount, a gauge-only value
    // label (当座比率 appears only under a KPIGauge, never as a card title) proves
    // the gauge value blocks drew, and a recharts surface proves the SVG chart
    // itself rendered in the real browser viewport.
    await expect(page.getByText('収益性指標', { exact: true })).toBeVisible()
    await expect(page.getByText('安全性指標', { exact: true })).toBeVisible()
    await expect(page.getByText('当座比率', { exact: true })).toBeVisible()
    await expect(page.locator('.recharts-wrapper').first()).toBeVisible()

    // Benchmark table section mounts.
    await expect(page.getByText('KPIベンチマーク', { exact: true })).toBeVisible()

    // Filters apply: changing the month <select> (the second select on the page,
    // after the year select) triggers a fresh /api/reports/kpi?month=<n> request.
    const targetMonth = differentMonth()
    const kpiResponse = page.waitForResponse((resp) => hasMonth(resp.url(), KPI_API, targetMonth), {
      timeout: 30_000,
    })
    await page.locator('select').nth(1).selectOption(String(targetMonth))
    const response = await kpiResponse
    expect(response.ok()).toBeTruthy()
  })

  test('budget 経営分析 tab renders variance bridge + managerial CVP cards, and refetches on filter change', async ({
    page,
  }) => {
    await page.goto('/ja/reports/budget')

    // The <Tabs> shell mounts only after the page's loading flag clears.
    const managerialTab = page.getByRole('tab', { name: '経営分析' })
    await expect(managerialTab).toBeVisible({ timeout: 30_000 })

    // Mount the managerial TabsContent (Radix Tabs lazy-mounts the active panel;
    // the bridge chart + CVP cards are not in the DOM until the tab is activated).
    await managerialTab.click()

    // Variance bridge chart renders (heading + recharts surface). The bridge is
    // non-null for the sample P&L, so VarianceBridgeChart draws rather than its
    // empty/error ChartState.
    await expect(page.getByText('営業利益 予実ブリッジ', { exact: true })).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.locator('.recharts-wrapper').first()).toBeVisible()

    // Managerial CVP cards render. These KPICard titles are unique to
    // ManagerialAccountingCards, so they prove the metrics payload resolved
    // (metrics non-null → 'ready' branch, not the loading/empty ChartState).
    await expect(page.getByText('管理会計指標（CVP分析）', { exact: true })).toBeVisible()
    await expect(page.getByText('限界利益率', { exact: true })).toBeVisible()
    await expect(page.getByText('損益分岐点売上高', { exact: true })).toBeVisible()
    await expect(page.getByText('安全余裕率', { exact: true })).toBeVisible()

    // Filters apply: the useManagerialAccounting hook refetches the managerial
    // endpoint when the month <select> changes.
    const targetMonth = differentMonth()
    const managerialResponse = page.waitForResponse(
      (resp) => hasMonth(resp.url(), MANAGERIAL_API, targetMonth),
      { timeout: 30_000 }
    )
    await page.locator('select').nth(1).selectOption(String(targetMonth))
    const response = await managerialResponse
    expect(response.ok()).toBeTruthy()
  })
})
