import { test, expect } from '@playwright/test'

// E2E-FLOW-01: budget vs actual + variance flow in mock mode.
//
// Drives the seeded admin into the 予実管理 (budget vs actual) page and asserts:
//   1. navigation lands on the budget/variance view,
//   2. the budget-vs-actual comparison renders (段階損益 stage table + a row),
//   3. the variance drivers / waterfall (予実ブリッジ) render on the 経営分析 tab,
//   4. the budget CSV export (template download) responds with a real CSV file.
//
// Mock mode (FREEE_MOCK_MODE/AI_MOCK_MODE) is forced via playwright.config.ts
// and the seeded admin is provisioned by tests/e2e/global-setup.ts. The budget
// services fall back to a deterministic sample P&L on an empty DB, so the page
// always carries the stage/driver labels asserted below — only the numeric
// amounts vary, which we never assert on. No sleeps: Playwright auto-waits on
// locators and the download event.

test.describe('E2E budget vs actual flow (mock mode)', () => {
  test.beforeEach(async ({ page }) => {
    // next dev compiles each route on first hit (in CI too); allow a cold start
    // that covers login + the budget route compile + its API calls + the export.
    test.setTimeout(180_000)

    await page.goto('/ja/login')
    await page.getByLabel('Email', { exact: true }).fill('admin@example.com')
    await page.getByLabel('Password', { exact: true }).fill('admin123')
    await page.getByRole('button', { name: 'Sign In', exact: true }).click()
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 })
  })

  test('budget vs actual renders comparison + variance waterfall and exports a CSV', async ({
    page,
  }) => {
    await page.goto('/ja/reports/budget')

    // 1. Navigation landed on the budget/variance view. The tablist is rendered
    // only after the initial data fetch settles (loading=false), so a visible
    // tab is also the "page shell mounted" signal.
    await expect(page).toHaveURL(/\/reports\/budget/)
    await expect(page.getByRole('tab', { name: '段階損益レベル' })).toBeVisible({
      timeout: 30_000,
    })

    // 2. Budget-vs-actual comparison renders. The default 段階損益 tab mounts its
    // table only once /api/reports/budget?action=detailed resolves; a row cell
    // proves data rendered, not just the section shell.
    await expect(
      page.getByRole('heading', { name: '段階損益レベル比較', exact: true })
    ).toBeVisible()
    await expect(page.getByRole('cell', { name: '売上高', exact: true })).toBeVisible()

    // 3. Variance drivers / waterfall render. Switch to the 経営分析 tab — Radix
    // mounts its content lazily — and assert the bridge section heading plus a
    // driver label, which proves the waterfall data (not just the chart frame)
    // rendered off /api/reports/budget/managerial.
    await page.getByRole('tab', { name: '経営分析' }).click()
    await expect(
      page.getByRole('heading', { name: '営業利益 予実ブリッジ', exact: true })
    ).toBeVisible()
    await expect(page.getByText('売上高差異')).toBeVisible({ timeout: 30_000 })

    // 4. Export responds. The budget page's only download surface is the CSV
    // template link inside the CSV upload dialog. Open the dialog, click the
    // download link, and assert Chromium received a real attachment.
    await page.getByRole('button', { name: 'CSVアップロード' }).click()
    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 })
    await page.getByRole('link', { name: 'テンプレートをダウンロード' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe('budget_template.csv')

    // The download body is not inspectable from the event, so re-fetch the same
    // authenticated export endpoint to assert status, headers, and CSV body.
    const exportResponse = await page.request.get('/api/reports/budget?action=template')
    expect(exportResponse.status()).toBe(200)
    expect(exportResponse.headers()['content-type']).toContain('text/csv')
    const disposition = exportResponse.headers()['content-disposition'] ?? ''
    expect(disposition).toContain('attachment')
    expect(disposition).toContain('budget_template.csv')
    const csv = await exportResponse.text()
    expect(csv).toContain('勘定科目コード')
    expect(csv).toContain('売上高')
  })
})
