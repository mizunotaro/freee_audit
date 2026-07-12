# E2E-FLOW-04 — financial-statement reports (BS/PL/CF) render + period switch + export

## Outcome
Added `tests/e2e/financial-statements-flow.spec.ts` — a Playwright E2E spec (mock mode)
that drives the seeded admin through the periodic report (`/ja/reports/periodic`), the
only BS/PL/CF page that exposes period controls **and** an export. Both tests pass
against a real mock dev server (verified locally, not fake-green).

- `pnpm exec playwright test tests/e2e/financial-statements-flow.spec.ts` → **2 passed**
- `node scripts/autopm_verify.mjs --changed-only` → **exit 0** (typecheck 0 errors, eslint 0 warnings, vitest n/a for `.spec.ts`)

## Net-new coverage vs E2E-CORE-02
`reports-close.spec.ts` (E2E-CORE-02) already covers the periodic page's **default-period**
render + CSV content. FLOW-04's distinct contribution is **period switching**:

1. `BS/PL/CF render and switching the period type re-fetches with fewer columns` — asserts
   the three statement cards + a key-figure cell from each (当期純利益 / 純資産 / 期末現金),
   confirms the 12months baseline renders **13 cells** in the CF 営業CF row (1 label + 12
   periods), switches the period type 12months→3months via the shadcn Select, asserts the
   re-fetch carries `periodType=3months` (200), and the row re-renders with **4 cells**.
2. `CSV export carries the currently-selected period type` — switches to 6months, clicks
   `CSV出力`, asserts the export request URL carries `periodType=6months&export=csv`
   (200, `text/csv`, `attachment; filename="periodic-report.csv"`), and that the body
   carries the three statement markers (`--- 貸借対照表 ---` / `--- 損益計算書 ---` /
   `--- キャッシュフロー ---`). This proves the UI propagates the user's switched period
   into the export — behavior E2E-CORE-02 (default 12months) never exercises.

## Why the periodic page
The reports pages are `monthly`, `periodic`, `cashflow`, `kpi`, `budget`, `business`, `ir/*`.
Only `periodic` renders BS+PL+CF as independent tables **and** has both period switchers
(periodType / fiscalYearEndMonth / includePreviousYear) and an export button (`CSV出力` →
`/api/reports/periodic?…&export=csv`). `monthly` renders BS/PL/CF too but has no export
button; `cashflow` is CF-only. The legacy `reports.spec.ts` navigates to non-existent
`/balance-sheet` / `/profit-loss` / `/cash-flow` routes (fake-green junk) — left untouched.

## Determinism
The periodic service falls back to sample data on an empty DB, so every period window
resolves with BS/PL/CF rows. Only the numeric amounts are randomized
(`Math.random` in `generateSamplePeriodData`), so the spec asserts on:
- the network request's `periodType` query param, and
- the per-row cell count (`1 + periods` — 13 for 12months, 4 for 3months; deterministic
  because `calculatePeriods` emits exactly `monthsBack` periods and `includePreviousYear`
  is left off).

No sleeps (Playwright auto-waits on `waitForResponse` + locators). No `data-testid` /
class selectors — ARIA roles + text, anchored on the h1 (`getByRole('heading')`, not
`getByText`, because AppLayout's nav also has a `多期間レポート` link).

## Gotcha discovered — shadcn/Radix Select trigger has no accessible name
`getByRole('combobox', { name: '12ヶ月' })` matches **nothing**: Radix `Select.Trigger`
renders `<button role="combobox">` whose selected value is a child element, so the
trigger's accessible name is empty (Playwright snapshot: `combobox [ref=e…]` with no
quoted name, vs `switch "前年同期比較"`). Fix: target by displayed value text —
`page.getByRole('combobox').filter({ hasText: '12ヶ月' })` and
`page.getByRole('option').filter({ hasText: '3ヶ月' })`. (Options portal to `document.body`
on open, so `getByRole('option')` finds them without scoping.)

## Auth
One login in `beforeAll` + `context.addCookies` in `beforeEach` (Pattern B from
`settings-import-flow.spec.ts` / E2E-FLOW-03) — the auth rate limiter is 5 login POSTs /
15 min / IP, hardcoded in Class-A `src/lib/security`, so the spec contributes exactly 1
login for 2 tests.

## Constraints honored
- No Class-A path modified (spec-only addition; no source/service/route edits).
- No `any`, `@ts-ignore`, `.skip`, lint-disable, or coverage lowering.
- No new dependencies.
- Mock mode is forced by `playwright.config.ts` (`webServer.env: webServerEnv()`); the spec
  sets no env flags itself.
