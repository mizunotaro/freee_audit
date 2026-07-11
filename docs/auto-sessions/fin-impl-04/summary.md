# FIN-IMPL-04 — Financial-accounting ratio analysis strengthening (analytics)

**Status:** IMPLEMENTED — `PENDING HUMAN DETERMINATION` on every judgemental choice.
**Target file:** `src/services/analytics/financial-kpi.ts` (additive; legacy surface untouched)
**Tests:** `tests/unit/services/analytics/financial-kpi-ratios.test.ts` (58 golden + edge cases)
**Design ref:** `docs/proposals/fin-design-03-accounting-metrics.md` §5 (on branch `feature/auto/fin-design-03`)

> **This is financial output. The PR MUST be labelled `human-review-required` and
> `do-not-auto-merge`.** Every formula and assumption below must be verified by the
> owner before merge. Do not let it auto-merge.

---

## 1. What changed

A new, additive ratio surface was appended to `src/services/analytics/financial-kpi.ts`.
The legacy `calculateFinancialKPIs` / `calculateExtendedKPIs` / `getKPIBenchmarks`
(consumed by `monthly-report.ts`, `reports/kpi/route.ts`, `analysis/route.ts`, and the
existing test files) are **intentionally untouched** — no signature or behaviour change,
fully backward compatible.

New exports:

- `calculateFinancialRatios(bs, pl, options?) → Result<FinancialRatioSet, AppError>` — aggregator
- `FinancialRatioSet`, `FinancialRatioOptions`, `NOPATResult`, `ROICResult`, `DuPontResult` — types
- 35 individual `calc*` helpers, each returning `Result<T, AppError>` and validating its inputs
  with Zod `safeParse`.

All inputs are Zod-validated (`balanceSheetSchema`, `profitLossSchema`); a validation failure
short-circuits with a `Result` failure (`VALIDATION_ERROR`). Missing prior period for a growth
metric is `NOT_FOUND` at the helper level and `null` at the aggregator level.

**Module-wide divide-by-zero convention** (matches the existing `safeDivide`): a zero denominator
yields `0`, never `Infinity`/`NaN`. This is asserted in the edge-case tests.

---

## 2. Formula list (for owner verification)

### Profitability
| Metric | Formula (chosen default) | Cited basis |
|---|---|---|
| ROE | netIncome / **average** equity × 100 (period-end fallback when no prior BS) | standard ROE |
| ROA | netIncome / **average** total assets × 100 | standard ROA |
| ROIC | NOPAT / **average** invested capital × 100 | standard ROIC |
| NOPAT | EBIT × (1 − effectiveTaxRate); t = incomeTax/incomeBeforeTax clamped [0,1] | standard NOPAT |
| EBIT | **operatingIncome** (operating-only view) | PENDING — see §3 |
| EBITDA | operatingIncome + depreciation (amortization not on model) | fin-design-03 §4 |
| gross/operating/net/EBIT/EBITDA margin | X / revenue × 100 (computed from components, not the stored margin field) | standard |
| DuPont 3-step | netMargin × assetTurnover × equityMultiplier (×100 for ROE), average balances | standard DuPont |
| DuPont 5-step | taxBurden × interestBurden × ebitMargin × assetTurnover × equityMultiplier | standard DuPont |

### Liquidity
| Metric | Formula | Note |
|---|---|---|
| current ratio | currentAssets / currentLiabilities × 100 (%) | |
| quick ratio | (currentAssets − inventory) / currentLiabilities × 100 (%) | |
| cash ratio | cash&deposits / currentLiabilities × 100 (%) | |
| working capital | currentAssets − currentLiabilities | |
| DIO | inventory / COGS × 365 | |
| DSO | receivables / revenue × 365 | |
| DPO | payables / COGS × 365 | |
| CCC | DIO + DSO − DPO | demanded by DD checklist `MA-WC-001` |

### Leverage / safety
| Metric | Formula |
|---|---|
| debt-to-equity | totalLiabilities / equity |
| equity ratio | equity / totalAssets × 100 (%) |
| debt ratio | totalLiabilities / totalAssets × 100 (%) |
| long-term debt-to-equity | fixedLiabilities / equity |
| equity multiplier | totalAssets / equity |
| debt-to-EBITDA | interest-bearing debt / EBITDA |
| net debt-to-EBITDA | (IBD − cash) / EBITDA |
| times interest earned | EBIT / interestExpense |
| interest coverage | EBITDA / interestExpense |

### Efficiency turnovers
| Metric | Formula |
|---|---|
| asset turnover | revenue / **average** total assets |
| inventory turnover | COGS / inventory (0 for service/technology/finance) |
| receivables turnover | revenue / receivables |
| payables turnover | COGS / payables |
| fixed-asset turnover | revenue / net fixed assets |
| working-capital turnover | revenue / working capital |

### Growth (period-over-period; null when prior period absent)
revenue, profit (netIncome), grossProfit, operatingIncome, ordinaryIncome, EBITDA, total assets,
equity — each `(curr − prev) / |prev| × 100` via the shared `calculateGrowthRate`.

---

## 3. Assumptions / `PENDING HUMAN DETERMINATION` (must verify before merge)

1. **EBIT = operatingIncome.** JGAAP keeps interest non-operating, so 経常利益 already excludes
   interest; two defensible EBIT forms exist. Chosen: operating-only (standard for ROIC's
   operating-return view). Alternative: `ordinaryIncome + interestExpense`. Affects ROIC/NOPAT/
   EBIT-margin/interest-burden.
2. **Invested capital = equity + interestBearingDebt − cash** (financing approach), on an
   **average** basis. Alternatives: operating approach (NWC + net fixed assets); period-end;
   not netting cash (more conservative, higher IC, lower ROIC).
3. **Effective tax rate fallback = 0** when `incomeBeforeTax ≤ 0` (NOPAT = EBIT). Alternative:
   statutory rate, or nullify ROIC.
4. **Interest-bearing debt scope** = items named 借入 / 社債 / リース (short + long). Open: include
   leases? bonds? short-term?
5. **Cash for net debt** = 現金 / 預金 only. Open: include marketable securities (有価証券)?
6. **Day count = 365** for DIO/DSO/DPO/CCC. Alternative: 360.
7. **DPO/DIO cost base = COGS.** DSO uses revenue. Open: DPO on purchases; DSO on credit sales.
8. **Average vs period-end balances**: average used for ROE/ROA/ROIC/asset-turnover/equity-
   multiplier when a prior BS is supplied, else period-end. Inventory/receivables/payables
   turnovers use period-end (consistent with legacy code).
9. **Receivables/payables resolvers** reuse the legacy name filters (売掛/受取手形/未収 ; 買掛/支払手形/
   未払), which sweep accruals (未収/未払) into operating receivables/payables — affects DSO/DPO.
10. **Growth sign convention** divides by `|previous|` (legacy `calculateGrowthRate`), so a
    negative base yields a sign-misleading %. Consumers should treat growth as non-meaningful
    when previous ≤ 0.
11. **Coverage when interest = 0** returns 0 (module-wide zero-denominator convention).
    Alternative: null / ∞ (0 can mislead — "cannot cover" vs "no interest").
12. **Sector gating**: inventory turnover & DIO forced to 0 for service/technology/finance
    (matches legacy `calculateEfficiencyKPIs`); CCC then reflects only DSO − DPO.

---

## 4. Bug fix carried in (fin-design-03 §4)

Interest expense for TIE / interest coverage is read from **`nonOperatingExpenses`**
(支払利息), NOT `sgaExpenses`. The legacy `calculateBankKPIs` reads `sgaExpenses` (wrong bucket →
0/incorrect DSCR & interest coverage). The new helpers use the correct bucket. A golden test
asserts this (`reads interest from nonOperatingExpenses`).

---

## 5. Out of scope (noted for follow-up)

- **Cash-flow ratios** (OCF margin, earnings quality, capex intensity, reinvestment, CF adequacy)
  from fin-design-03 §5.6 are deliberately omitted — they hinge on PENDING capex-sign and
  dividend-sourcing decisions. The aggregator therefore takes no `cf` argument.
- Consolidation of the three parallel ratio implementations (financial-kpi / analytics-kpi /
  ratio-analyzer) is an architecture decision, not done here.
- Per-share growth (EPS/DPS/BVPS) — blocked on share-count data (Class-A schema).

---

## 6. Verify gate

`node scripts/autopm_verify.mjs --changed-only` → **exit 0**.
typecheck 0 errors · eslint clean (2 files) · vitest 58 passed.
