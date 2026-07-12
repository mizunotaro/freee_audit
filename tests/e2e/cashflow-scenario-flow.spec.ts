import { test, expect, type Cookie } from '@playwright/test'

// E2E-FLOW-06: cashflow + Runway scenario view (mock mode).
//
// Drives the seeded admin into the 資金繰り表 (cashflow) page and asserts the
// Runway scenario UI FIN-UI-01 wired in (RunwayScenarioChart consuming the
// runway.scenarios band payload from /api/reports/cashflow):
//   1. the three scenario bands (楽観 / 現実 / 悲観) render with Runway months,
//   2. the Runway banner displays the headline runway months,
//   3. the scenario band chart (現金残高推移予測) mounts off the same payload,
//   4. toggling the fiscal-year control re-projects the chart — a fresh
//      /api/reports/cashflow?fiscalYear=… GET fires and the band re-renders.
//
// Mock mode (FREEE_MOCK_MODE / AI_MOCK_MODE) is forced via playwright.config.ts
// and the seeded admin is provisioned by tests/e2e/global-setup.ts.
// /api/reports/cashflow is a deterministic synthetic generator (the
// FIN-DESIGN-02 hardcoded-sample defect — out of scope here), so the scenario
// payload is always present and the Runway months are stable. Assertions anchor
// on structure + ARIA + the network response, never on specific currency values.
// No sleeps: Playwright auto-waits on locators and the response event.
//
// Scope note (see docs/auto-sessions/e2e-flow-06/summary.md): FIN-UI-01's chart
// renders all three bands simultaneously — there is no discrete per-scenario
// toggle — so "toggling a scenario updates the chart" maps to the page's real
// re-projection control, the fiscal-year <select>, which re-fetches the scenario
// payload and re-renders the band. That is the closest real interaction the
// built UI exposes; inventing one would be fake-green.

// Auth happens once in beforeAll and the session cookie is injected into each
// test's context (not a per-test login): the auth rate limiter is 5 login POSTs
// / 15 min / IP, hardcoded in src/lib/security and shared in-memory across the
// whole e2e run, so this spec must contribute as few logins as possible.
let authCookies: Cookie[] | undefined

test.describe('E2E cashflow + Runway scenario flow (mock mode)', () => {
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

  test('three scenario bands + Runway months render from /api/reports/cashflow', async ({
    page,
  }) => {
    await page.goto('/ja/reports/cashflow')

    // The Runway scenario card mounts only once /api/reports/cashflow resolves
    // and runway is non-null (the card is wrapped in `{runway && …}`), so the
    // heading is also the "page + scenario data ready" signal.
    await expect(
      page.getByRole('heading', { name: 'Runwayシナリオ分析', exact: true })
    ).toBeVisible({
      timeout: 30_000,
    })

    // 1. Three scenario bands render, each labelled (楽観 / 現実 / 悲観).
    // .first(): the RunwayScenarioChart's recharts <Legend> also renders
    // "現実シナリオ", so that text node appears twice (card label + legend item).
    // The scenario cards precede the chart in the DOM, so .first() anchors each
    // assertion to its band card regardless of the legend duplicate.
    await expect(page.getByText('楽観シナリオ', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('現実シナリオ', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('悲観シナリオ', { exact: true }).first()).toBeVisible()

    // 2. Runway months display: the banner headline ("Runway" + "{n}ヶ月") and
    //    each scenario card's "{n}ヶ月". A numeric months value proves the
    //    runway payload reached the DOM, not just the section shell.
    await expect(page.getByText('Runway', { exact: true })).toBeVisible()
    await expect(page.getByText(/\d+ヶ月/).first()).toBeVisible()

    // 3. The FIN-UI-01 scenario band chart section is present.
    await expect(
      page.getByText('現金残高推移予測（楽観/現実/悲観バンド）', { exact: true })
    ).toBeVisible()

    // 4. Network: the payload actually carries the three scenarios + headline
    //    runway months. The page's own fetch used the default fiscal year, so
    //    re-GET the same endpoint via the authenticated request context.
    const res = await page.request.get('/api/reports/cashflow?fiscalYear=2026')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.runway).toBeTruthy()
    expect(typeof body.runway.runwayMonths).toBe('number')
    for (const key of ['optimistic', 'realistic', 'pessimistic'] as const) {
      const scenario = body.runway.scenarios[key]
      expect(scenario).toBeTruthy()
      expect(typeof scenario.runwayMonths).toBe('number')
      expect(typeof scenario.burnRate).toBe('number')
    }
  })

  test('changing the fiscal-year control re-projects the scenario chart', async ({ page }) => {
    await page.goto('/ja/reports/cashflow')
    await expect(
      page.getByRole('heading', { name: 'Runwayシナリオ分析', exact: true })
    ).toBeVisible({
      timeout: 30_000,
    })

    // The page's only <select> is the fiscal-year control. Changing it calls
    // setFiscalYear → fetchData re-runs (useCallback dep on fiscalYear) → a fresh
    // cashflow GET fires and the band chart re-renders off the new payload.
    const fiscalSelect = page.locator('select')
    await expect(fiscalSelect).toBeVisible()

    const [refetch] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === 'GET' &&
          new URL(response.url()).pathname === '/api/reports/cashflow' &&
          new URL(response.url()).searchParams.get('fiscalYear') === '2024'
      ),
      fiscalSelect.selectOption('2024'),
    ])
    expect(refetch.status()).toBe(200)

    // The band chart section is still mounted after the re-projection.
    await expect(
      page.getByText('現金残高推移予測（楽観/現実/悲観バンド）', { exact: true })
    ).toBeVisible()
  })
})
