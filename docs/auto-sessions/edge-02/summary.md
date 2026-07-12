# EDGE-02 — Deepen error/edge-case tests in report/reports/cashflow services

## Scope
Additive edge-case tests for the non-Class-A report / reports / cashflow services.
No production source was modified — all changes are new `*-edge.test.ts` files that
pin previously-uncovered branches and a few latent defects (documented, not fixed).

## Files added (4 test files, 47 tests)
| File | Target source | What it newly covers |
|------|---------------|----------------------|
| `tests/unit/services/cashflow/runway-calculator-edge.test.ts` | `src/services/cashflow/runway-calculator.ts` | **`computeRunwayMonths` direct tests** (exported, previously untested): non-finite cash → `Infinity`, `avgNetBurn ≤ 0` / non-finite → `Infinity`, normal/negative/zero division. `getRunwayAlert` sub-threshold boundaries (just below 12 / 6 / 3, `Infinity`). `calculateBurnRateTrend` `previousBurn === 0` stable branch + partial previous-slice (5-month window). |
| `tests/unit/services/reports/business-report/content-validator-edge.test.ts` | `src/services/reports/business-report/content-validator.ts` | Exact `minLength`/`maxLength` boundaries (at-boundary valid, +1 char over → error). Placeholder `> 3` threshold boundary (3 = no warn, 4 = warn, for both `〇〇` and `{{…}}`). `calculateConfidence` exact `1.0` / floor `0` / `0.05`-per-placeholder penalty. `checkLegalTerminology.missing` (always `[]`). `validateCompleteReport` whitespace-only-is-missing, exact `completeness` math (12.5 %), and warning text. |
| `tests/unit/services/report/monthly-report-edge.test.ts` | `src/services/report/monthly-report.ts` | Drives `getMonthlyTrend` + `getMultiMonthReport` with **real `MonthlyBalance` rows** so `mapBalancesToProfitLoss` / `mapBalancesToBalanceSheet` execute (the existing test feeds `[]` and mocks every dependency, leaving these helpers dead). Exact P&L chain (revenue→grossProfit→operatingIncome→`round(op*0.7)` netIncome), category non-leakage, sample fallback. `getMultiMonthReport` year-boundary month wrap (`endMonth=2,count=3 → [12,1,2]`), non-wrap, full-12 wrap, `NOT_FOUND`, and real-data section construction. |
| `tests/unit/services/report/periodic-report-edge.test.ts` | `src/services/report/periodic-report.ts` | Drives `generatePeriodicReport` with **real balances** (pinned `now` via fake timers) so `mapToPeriodBS` / `calculatePeriodPL` / `calculatePeriodCF` / `calculatePeriodKPIs` / `generateSummary` / `generateTrendAnalysis` execute (existing test feeds `[]` → `Math.random` sample path). Exact first-period BS/PL/CF(no-previous-month branch)/KPI(2-dp round) values, summary growth + all-stable trend, and the all-zero-denominator case exercising **every KPI zero-guard** + null-growth + cash-caution trend. |

## Notes / latent defects pinned (characterization, not fixed — out of EDGE-02 scope)
- `mapBalancesToProfitLoss` (`monthly-report.ts`) computes
  `grossProfitMargin = (grossProfit / totalRevenue) * 100` and
  `operatingMargin = (operatingIncome / totalRevenue) * 100` with **no zero-revenue
  guard**. When recorded balances have no `revenue` category, `totalRevenue === 0` and
  the margins become `NaN`/`-Infinity`. (The periodic-report counterpart
  `calculatePeriodKPIs` *does* guard with `pl.revenue > 0`.) Not assert-pinned here to
  avoid coupling to `generateMonthlyReport`'s 5 mocked dependencies; flagged for a
  future fix task. See memory `cashflow-subsystem-scenario-gaps` /
  `budget-variance-actuals-lineage-broken` for the broader P&L-source context.
- `checkLegalTerminology` always returns `missing: []` (the field is unused). Pinned as
  current behavior.

## Verification
- `pnpm exec vitest run <4 files>` → **47 passed**.
- `pnpm exec eslint --max-warnings=0 <4 files>` → exit 0.
- `node scripts/autopm_verify.mjs --changed-only` → exit 0 (definition of done).

## Constraints honored
- No Class-A path touched (read-only reference only).
- No `any` / `@ts-ignore` / `.skip` / lint-disable / threshold lowering. No new deps.
- New helpers follow `Result<T,E>` + Zod `safeParse` where the SUT uses them; these are
  pure-function test files so no new helpers were needed.
- Only the added test files were run (known full-suite OOM avoided).
