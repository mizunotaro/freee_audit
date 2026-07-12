# E2E-FLOW-01 — Budget vs Actual + Variance Flow (mock mode)

## Scope

UI-level Playwright E2E for the budget-vs-actual flow in `FREEE_MOCK_MODE` /
`AI_MOCK_MODE`. Navigate to the 予実管理 (budget/variance) view, assert the
budget-vs-actual comparison renders, assert the variance drivers / waterfall
render, and assert the budget CSV export responds. Deterministic waits only
(roles / text locators + the Playwright `download` event) — no `waitForTimeout`.

## Change

- **Added** `tests/e2e/budget-variance.spec.ts` — one `test.describe` with a
  `beforeEach` login (seeded admin) and a single test covering all four
  requirements sequentially (one login total, to stay within the in-memory
  login rate limiter — see `auth-rate-limit-trips-local-e2e`).

No source/lib/API changes. All assertions target pre-existing UI rendered off
the existing budget routes; nothing on a Class-A path was touched.

## How the four requirements are satisfied

| Requirement | Assertion |
|---|---|
| Navigate to budget/variance view | `goto('/ja/reports/budget')` → `toHaveURL(/\/reports\/budget/)` + the tablist `段階損益レベル` tab is visible (the tabs mount only after the initial data fetch settles, so this is also the "page shell mounted" signal) |
| Comparison renders | Default 段階損益 tab: heading `段階損益レベル比較` (h3, mounts only once `/api/reports/budget?action=detailed` resolves) + a data row cell `売上高` (proves data, not just the shell) |
| Drivers / waterfall shows | Switch to `経営分析` tab (Radix mounts it lazily) → heading `営業利益 予実ブリッジ` + the bridge driver label `売上高差異` (rendered by `VarianceBridgeChart` recharts Y-axis off `/api/reports/budget/managerial`; proves the waterfall **data**, not just the chart frame) |
| Export responds | Click `CSVアップロード` → click the `テンプレートをダウンロード` download link (`<a href="/api/reports/budget?action=template" download>`) → `waitForEvent('download')` asserts `suggestedFilename() === 'budget_template.csv'`; then `page.request.get('/api/reports/budget?action=template')` asserts 200 + `text/csv` + `Content-Disposition: attachment; filename=budget_template.csv` + body contains `勘定科目コード` / `売上高` |

## Why the assertions are deterministic (mock mode)

The budget services fall back to a deterministic sample P&L on an empty DB:

- `/api/reports/budget?action=detailed` → `calculateDetailedActualVsBudget` emits
  the stage rows `売上高 / 売上原価 / 売上総利益 / 販売管理費 / 営業利益 / 当期純利益`
  (verified in `src/services/budget/detailed-actual-vs-budget.ts`).
- `/api/reports/budget/managerial` → `buildVarianceBridge` requires all four
  stages `売上高 / 売上原価 / 販売管理費 / 営業利益`; all are present in mock
  mode, so the bridge is non-null and emits drivers `売上高差異 /
  売上原価差異 / 販売管理費差異` with `startLabel=営業利益（予算）`,
  `endLabel=営業利益（実績）` (`src/services/budget/managerial-accounting.ts`).
- `/api/reports/budget?action=template` → `generateBudgetTemplate()` returns a
  fixed CSV (`勘定科目コード,勘定科目名,1月,…` + `売上高 / 売上原価 / …` rows).

Only numeric amounts vary; the spec never asserts on numbers — only on the
fixed labels / headers / filename.

## Note on the "export" surface

The budget page has no dedicated export button; the only download surface in
the budget flow is the CSV template link inside the CSV-upload dialog
(`src/components/budget/CSVUpload.tsx`). That link is the export asserted
above — a real, UI-triggered, same-origin `Content-Disposition: attachment`
CSV download, with its body re-fetched and verified.

## Verification

- `node scripts/autopm_verify.mjs --changed-only` → **exit 0**
  (typecheck: 0 errors; eslint: clean; vitest: skipped — `.spec.ts` files are
  Playwright specs routed to the CI `e2e-tests` job, never to vitest, per
  `scripts/autopm_verify.mjs` lines 277–282).
- **Local Playwright run also passed**: `1 passed (30.2s)`, exit 0, against a
  manually-started mock dev server (`corepack pnpm dev` + the e2e env vars;
  `reuseExistingServer` reused it, `globalSetup` pushed the schema + seeded the
  admin to the shared `test.db`). All four assertions held in a real Chromium.

## Definition of done

`node scripts/autopm_verify.mjs --changed-only` exits 0. ✓
