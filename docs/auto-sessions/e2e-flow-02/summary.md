# E2E-FLOW-02 — E2E: KPI dashboard + management-accounting view (mock mode)

## Outcome
Added one Playwright spec, `tests/e2e/kpi-managerial.spec.ts` (2 tests). Both tests were
**executed locally** against a self-started mock dev server (Playwright reused it via
`reuseExistingServer`) and passed: `2 passed (50.7s)`. The diff is purely additive — a new
test file, no source or Class-A path touched.

## Scope — the two dashboards covered

| Page | Route | Backing API (sample-data, mock-safe) | What is asserted |
|------|-------|--------------------------------------|------------------|
| KPI dashboard | `/ja/reports/kpi` | `GET /api/reports/kpi` (`generateSampleBalanceSheet/ProfitLoss/CashFlow` → `calculateExtendedKPIs`) | cards render, gauges render, benchmark section mounts, month filter refetches |
| Budget 経営分析 view | `/ja/reports/budget` → `経営分析` tab | `GET /api/reports/budget/managerial` (`generateSamplePL` → `computeManagerialMetrics` + `buildVarianceBridge`) | variance bridge chart renders, CVP cards render, month filter refetches |

Both routes compute from sample statements, so they return deterministic payloads on the
empty seeded DB — no financial rows are required beyond the `global-setup.ts` admin.

## What each test asserts (and why each assertion is robust)

### Test 1 — KPI dashboard
- **Shell**: `heading "経営指標ダッシュボード"` visible (mounts only after `/api/reports/kpi`
  resolves; until then the page shows its pulse skeleton).
- **Cards**: `ROE（自己資本利益率）` and `自己資本比率` titles visible (KPICard titles).
- **Charts**: `収益性指標` / `安全性指標` gauge-section headings + `当座比率` (a gauge-only
  label, never a card title) + `.recharts-wrapper` visible — proves the gauge value blocks
  AND the SVG surface rendered in the real browser viewport.
- **Benchmark**: `KPIベンチマーク` section heading visible.
- **Filters apply**: changing the month `<select>` fires a fresh
  `/api/reports/kpi?month=<n>` request, asserted via `waitForResponse` with URL param parsing.

### Test 2 — Budget 経営分析 tab
- **Shell**: `tab "経営分析"` visible (the `<Tabs>` mount only after the page's loading flag
  clears).
- **Lazy-mounted panel**: Radix Tabs do not render inactive `TabsContent`, so the test
  clicks the tab to mount the bridge chart + CVP cards.
- **Bridge chart**: `営業利益 予実ブリッジ` heading + `.recharts-wrapper` visible (bridge is
  non-null for the sample P&L, so `VarianceBridgeChart` draws rather than its empty/error
  `ChartState`).
- **CVP cards**: `管理会計指標（CVP分析）` heading + `限界利益率` / `損益分岐点売上高` /
  `安全余裕率` titles visible (unique to `ManagerialAccountingCards`; metrics non-null →
  `resolveChartStatus` returns `ready`, not the loading/empty skeleton).
- **Filters apply**: the `useManagerialAccounting` hook refetches
  `/api/reports/budget/managerial?month=<n>` on month `<select>` change.

## Verification (no fake green)
- **Playwright (executed)**: started `next dev --webpack` with the `webServerEnv()` secrets
  (CSRF_SECRET/ENCRYPTION_KEY/JWT_SECRET/DATABASE_URL=file:./test.db + mock flags),
  Playwright reused it, `global-setup` pushed the schema + seeded the admin, then
  `corepack pnpm exec playwright test tests/e2e/kpi-managerial.spec.ts` → **2 passed**.
- **autopm_verify --changed-only (DoD)**: `exit 0`.
  - typecheck: 0 total / 0 relevant errors.
  - eslint: 0 warnings on the new spec.
  - vitest: skipped (the gate routes only `*.test.ts(x)` to vitest; `*.spec.ts` is a
    Playwright file and is intentionally not collected by vitest — see
    `resolveTestFiles` in `scripts/autopm_verify.mjs`).

> Caveat (stated, not hidden): the autopm gate typechecks + lints the spec but does **not**
> execute Playwright — that is the CI `e2e-tests` job's role. The spec was executed locally
> (result above) to close that gap for this task.

## Patterns followed
- Login via accessible roles (`getByLabel('Email'/'Password')`, `Sign In` button) and
  `toHaveURL(/\/dashboard/)` — identical to `smoke.spec.ts` / `reports-close.spec.ts`.
- No `waitForTimeout`; Playwright auto-waits on locators + `waitForResponse`.
- Filter assertions parse the response URL (`new URL(...).searchParams.get('month')`) so a
  single-digit month can never substring-match a neighbouring param (e.g. `month=1` inside
  `month=12`).
- Target month chosen as `(currentMonth % 12) + 1` so it always differs from the page
  default and the `<select>` change actually flips state → triggers the refetch.
- Numeric amounts are never asserted (not the contract under test); only structural
  rendering and filter→refetch wiring.

## Constraints honored
- No Class-A path touched (no `prisma/`, `src/lib/auth*`, `src/lib/crypto.ts`,
  `src/lib/security/**`, `src/services/{kpi,audit,conversion,valuation,tax,debt,
  deferred-accrual,journal-proposal,freee}/**`, no forbidden API routes). Read-only
  reference only. Note: the KPI route exercised is `/api/reports/kpi` (under
  `reports/`, not the forbidden top-level `/api/kpi`) and its service is
  `src/services/analytics/financial-kpi` (under `analytics/`, not the forbidden
  `src/services/kpi/**`).
- No `any`, `@ts-ignore`, `@ts-expect-error`, `.skip`, lint-disable, or coverage
  lowering. No new dependencies. Additive only.
