# FIN-DESIGN-03 — Management & Financial Accounting Metrics Catalog (経営管理指標 / 財務会計 / 管理会計)

**Status:** DESIGN PROPOSAL — ANALYSIS ONLY.
**Every conclusion, finding, and proposed change in this document is `PENDING HUMAN DETERMINATION`.**
This is a metrics catalog and design analysis for a human reviewer. It is **not** an approval, a decision, or a
sign-off. No reviewer name, status of "approved", or acceptance is recorded anywhere in this document. Nothing here
has been implemented; all source code referenced is read-only for this task. This task writes this one document
only.

---

## 0. TL;DR

The task asks for a catalog of metrics to **add or strengthen** across (A) **financial accounting** — BS/PL/CF ratios
(profitability ROE/ROA/ROIC, liquidity, leverage, efficiency turnover, growth) — and (B) **management accounting** —
contribution margin, CVP / break-even, cost-behaviour fixed/variable split, segment profitability, and budget /
standard-cost variance — each with definition, formula, inputs, and judgemental assumptions.

Five findings dominate the catalog and are `PENDING HUMAN DETERMINATION`:

1. **Financial-accounting ratios already exist in three parallel, inconsistent implementations.** `ratio-analyzer.ts`
   computes 29 ratios (5 categories); `kpi.ts` computes a `FinancialKPIs` set + extended startup/VC/bank metrics;
   `financial-kpi.ts` computes a simpler `KPIResult[]` set. The *same* metric is computed differently across them
   (ROE on period-end equity vs average equity; EBITDA with depreciation-only vs depreciation+amortization vs absent;
   inventory detected three different ways). → *Consolidation is a prerequisite before "strengthen" means anything.*
   (Evidence: §5.1.)

2. **The financial-accounting ratio set has concrete, low-cost gaps.** The most actionable: **ROIC / NOPAT** (absent;
   the existing `roi` is a rough proxy but is *not* ROIC), **Cash Conversion Cycle** (DIO+DSO−DPO — DIO/DSO exist, DPO
   and CCC do not; the M&A DD checklist `MA-WC-001` already demands CCC), **DPO / fixed-asset turnover / working-capital
   turnover**, **cash-flow ratios** (OCF margin, earnings-quality CFO/net income, capex intensity, reinvestment,
   cash-flow adequacy — all absent despite a full `CashFlowStatement` type), and a **DuPont decomposition** of ROE.
   (Evidence: §5.2–5.6.)

3. **Management-accounting metrics are entirely absent as calculations.** The terms 限界利益 / 損益分岐点 / 変動費 / 固定費 /
   セグメント appear *only* in DD-checklist text (`ma-financial-dd.ts`), prompt text, and conversion disclosure templates —
   never in a computation. There is no contribution-margin, CVP, break-even, cost-behaviour, or segment-profitability
   engine. (Evidence: §6, §2.)

4. **Most management-accounting metrics are NOT computable on the current data model.** Three structural blockers:
   (a) **no fixed/variable cost classification** anywhere in `prisma/schema.prisma` (the P&L is not tagged, and `AccountItem`
   has no cost-behaviour field) — so contribution margin, CVP, break-even, and operating leverage cannot be computed,
   only *estimated* via cost-behaviour analysis on a historical series; (b) **no segment/department dimension on actuals**
   (`departmentId` is a freeform optional `String` on `Budget` only — no `Department`/`Segment` master; `Journal`/
   `MonthlyBalance`/`ProfitLoss` carry none) — so segment profitability is blocked; (c) **no quantity / unit-price** —
   so per-unit CVP and standard-cost Level-3 (price × efficiency) variance are blocked. (Evidence: §3, §7.)

5. **Budget / standard-cost variance is already designed by FIN-DESIGN-01.** Today only Level-1 static-budget
   variance (`actual − budget`) exists in `src/services/budget/**`; driver decomposition (Level 2/3, PVVM) and
   journal-level attribution are specified — not implemented — in `docs/proposals/fin-design-01-variance-attribution.md`.
   This document **references** that design rather than re-deriving it, and notes where standard-cost variance depends
   on the same data blockers. (Evidence: §6.9, §7.)

Given the above, this document specifies (a) a **consolidation finding** for the existing ratio code, (b) a **gap
catalog** of financial-accounting metrics to add, (c) a **management-accounting metric catalog** with formulas and the
data prerequisite each one needs, and (d) the **data-model prerequisites** (describe-only — most touch Class-A paths)
that gate the management-accounting half. All `PENDING HUMAN DETERMINATION`.

---

## 1. Scope & non-goals

**In scope (design only):**
- Inventory the metrics that already exist across `src/services/analytics/{financial-kpi,kpi}.ts` and the analysis
  routes/services (read-only).
- Catalog financial-accounting metrics to add or strengthen, with definition, formula, inputs, existing-vs-new, and a
  concrete proposed change.
- Catalog management-accounting metrics to add (all new), with the same fields plus the data prerequisite each needs.
- Surface the data-model blockers that make most management-accounting metrics non-computable today.
- Reference — not re-derive — the budget/standard-cost variance design in FIN-DESIGN-01.

**Out of scope (non-goals):**
- Any code change. This task writes this one document only. Every proposed metric, model field, and API shape is a
  description for a human, `PENDING HUMAN DETERMINATION`.
- Forecasting, budget *entry* UX, consolidation/elimination, and the full FIN-DESIGN-01 variance implementation
  (already designed there).
- Re-deriving FIN-DESIGN-01's variance methodology (referenced via §6.9 / §7).

**Files read for this analysis (read-only reference):** `src/services/analytics/financial-kpi.ts`;
`src/services/analytics/kpi.ts`; `src/services/ai/analyzers/ratio-analyzer.ts`; `src/services/ai/analyzers/ratios/{profitability,liquidity,safety,efficiency,growth,types}.ts`;
`src/app/api/analysis/{ratios,financial}/route.ts`; `src/app/api/analysis/types/output.ts`;
`src/services/cashflow/calculator.ts`; `src/services/budget/{actual-vs-budget,detailed-actual-vs-budget}.ts`;
`src/services/dd/checklists/ma-financial-dd.ts`; `src/types/index.ts`; `prisma/schema.prisma`;
`docs/proposals/fin-design-01-variance-attribution.md`.

---

## 2. Current metric surface (read-only inventory)

There are **three** independent metric implementations. They overlap but disagree on definitions.

| Layer | File | Output shape | Counts |
|-------|------|--------------|--------|
| L1 simple KPI | `src/services/analytics/financial-kpi.ts` | `KPIResult[]` via `calculateAllKPIs` | ROE, ROA, ROS, GrossMargin, OperatingMargin, EBITDA, EBITDAMargin, CurrentRatio, QuickRatio, DERatio, EquityRatio, Runway |
| L2 structured KPI | `src/services/analytics/kpi.ts` | `FinancialKPIs` (+ `ExtendedFinancialKPIs` = startup/VC/bank/advice) | profitability(6)·efficiency(4)·safety(4)·growth(2)·cashFlow(2) + startup(8) + vc(6) + bank(5) + benchmark |
| L3 ratio analyzer | `src/services/ai/analyzers/ratios/*.ts` | `RatioAnalysisResult` (29 `CalculatedRatio`) | liquidity(5)·safety(6)·profitability(7)·efficiency(6)·growth(5) |

**L3 (ratio-analyzer) is the most complete financial-accounting set** and is wired to the public `POST /api/analysis/ratios`
route. L2 is wired to report/monthly-report generation. L1 appears to be a legacy/parallel helper. All three live outside
the Class-A exclusion list (they are under `src/services/analytics/**` and `src/services/ai/analyzers/**`), so an
implementation task could extend them — but this task only describes the changes.

---

## 3. Data-model constraints (the blockers — `PENDING HUMAN DETERMINATION`)

These four facts determine which proposed metrics are computable today vs gated on data work. All verified against
`prisma/schema.prisma` and `src/types/index.ts`.

| # | Fact | Evidence | Consequence |
|---|------|----------|-------------|
| **C1** | No fixed/variable cost classification exists. | `AccountItem` (`schema.prisma:454-478`) has `categoryId/categoryName/categoryType` and `correspondingIncomeId/ExpenseId` (freee 対応収益/対応費用) but **no** `costBehaviour`/`variableRatio`/`fixedFlag`. `ProfitLossItem.category` (`types/index.ts:78`) is a freeform bucket string. | Contribution margin, CM ratio, variable-cost ratio, CVP, break-even, margin of safety, operating leverage, and standard-cost Level-3 variance are **not directly computable** — only estimable via cost-behaviour analysis on a historical P&L series, or after adding a classification field. |
| **C2** | No segment/department dimension on actuals. | `departmentId` is an optional `String` on `Budget` only (`schema.prisma:197`); there is **no `Department`/`Segment` model** (confirmed by full model inventory). `Journal` (`:108`), `MonthlyBalance` (`:377`), and `ProfitLoss` carry no department/segment. freee returns `segment_1/2/3` but both sync paths discard them (FIN-DESIGN-01 §4.3). | Segment profitability, segment contribution margin, and department-level variance are **blocked** until a segment dimension is captured (FIN-DESIGN-01 §7.1/§7.6). |
| **C3** | No quantity / unit-price. | Neither `Journal` nor `ProfitLossItem` carries `quantity` or `unitPrice`. | Per-unit CVP (break-even *units*, unit contribution margin), revenue PVVM, and standard-cost price/efficiency variance are **blocked** (FIN-DESIGN-01 §7.2). |
| **C4** | Actuals are `MonthlyBalance`-derived, not journal-derived; revenue/COGS mapping is broken on the freee path. | FIN-DESIGN-01 §4.2/§4.4: `getCategoryFromAccountItem` has a dead `revenue` branch and **no** `cost_of_sales` branch; the live budget route feeds hardcoded sample P&L. | Any metric consuming `revenue`, `grossProfit`, or `costOfSales` is **unreliable for the top P&L lines** on the freee path until the category-mapping fix (§7.4) and account-key crosswalk (§7.3) land. This affects ROIC, gross-margin-based DuPont, contribution margin, and CCC inputs. |

> **PENDING HUMAN DETERMINATION:** Which of C1–C4 to resolve, and in what order. C4 + the crosswalk (§7.3/§7.4) are the
> minimum to make *any* revenue/COGS-based metric trustworthy; C1 unlocks the contribution-margin family; C2 unlocks
> segment profitability; C3 unlocks per-unit CVP and standard-cost Level-3.

---

## 4. Consolidation findings (existing code — `PENDING HUMAN DETERMINATION`)

Before adding metrics, the three parallel implementations disagree. Each row is a finding + concrete proposed change.

| Metric | L1 `financial-kpi.ts` | L2 `kpi.ts` | L3 `ratio-analyzer` | Finding → proposed change |
|--------|------------------------|-------------|----------------------|---------------------------|
| **ROE** | `netIncome / equity` (period-end) | `safeDivide(netIncome, equity)` (period-end) | `netIncome / avgEquity` (avg of current+prev) | Three denominators. L3's average-equity is the GAAP-correct form; L1/L2 use point-in-time. → *Adopt average-equity everywhere; deprecate L1/L2 variants or route them through L3.* `PENDING` |
| **ROA** | `netIncome / totalAssets` (period-end) | `safeDivide(netIncome, totalAssets)` (period-end) | `netIncome / avgAssets` | Same issue. → *Adopt average-assets.* `PENDING` |
| **EBITDA** | `operatingIncome + depreciation + amortization` (absolute) | `operatingIncome + depreciation` (margin only; **no amortization**) | **absent** (no EBITDA ratio) | L2 omits amortization; L3 has no EBITDA at all. → *One EBITDA definition (`opInc + dep + amort`) shared across layers; add an `ebitda` / `ebitda_margin` ratio to L3 profitability.* `PENDING` |
| **Inventory detection** | name includes 棚卸/在庫 | name includes 棚卸/商品/製品/材料 | name includes 棚卸/在庫 **or** `code==='1005'` | Three different sets → three different quick ratios / inventory turnovers. → *One resolver keyed off `AccountItem.categoryType` (or a canonical code list), reused by all layers.* `PENDING` |
| **Interest-bearing debt** | n/a | bank: current+fixed filtered by 借入 | ROI: current 借入/リース + fixed 借入/社債 | Different scope (lease? bonds?). → *One `getInterestBearingDebt()` including the chosen scope (lease/bond decision).* `PENDING` |
| **Receivables / payables** | n/a | 売掛/受取手形/未収 ; 買掛/支払手形/未払 | 売掛/受取 **or** `code==='1003'` ; 買掛/未払 **or** `code==='2001'` | 未収/未収 in L2 sweeps accruals into receivables; L3 omits 未収 from receivables but includes it nowhere consistently. → *One resolver; decide explicitly whether accruals (未収/未払) count as operating receivables/payables (they affect DSO/DPO).* `PENDING` |
| **Interest expense** | n/a | bank: `sgaExpenses` filtered by 支払利息/利息 (**wrong bucket** — interest is non-operating, not SGA) | safety/ROI: `nonOperatingExpenses` filtered by 支払利息 (correct bucket) | L2 looks in `sgaExpenses` for interest — interest lives in `nonOperatingExpenses` (see `ProfitLoss` type + `calculator.ts:getInterestExpense`). L2's `interestCoverageRatio`/`dscr` are therefore likely **zero/incorrect**. → *Fix L2 to read `nonOperatingExpenses` like L3/calculator.* `PENDING` |
| **Sector gating** | n/a | `inventoryTurnover` forced to 0 for service/technology/finance | L3 computes inventory turnover unconditionally | L2 suppresses; L3 does not. → *One policy (suppress with a `notApplicable` status, or compute and flag).* `PENDING` |

> **PENDING HUMAN DETERMINATION:** Whether to consolidate L1/L2/L3 into a single ratio service (L3 as canonical,
> L2's extended startup/VC/bank kept as a separate "operational metrics" module) or to keep them separate and merely
> align definitions. This is an architecture decision for a human.

---

## 5. Financial-accounting gap catalog (to add / strengthen)

For each item: **Definition & formula · Inputs · Existing? · Concrete proposed change · `PENDING HUMAN DETERMINATION`.**
"Existing" refers to the L3 ratio-analyzer unless noted. All proposed additions are described, not implemented.

### 5.1 Profitability

| Metric | Definition & formula | Inputs | Existing? | Concrete proposed change |
|--------|----------------------|--------|-----------|--------------------------|
| **ROIC** | Return on Invested Capital = `NOPAT / InvestedCapital × 100`. `NOPAT = EBIT × (1 − t)`. | EBIT; effective tax rate `t = incomeTax / incomeBeforeTax`; invested capital (see PENDING) | **No** (L3 `roi` uses `(netIncome+interest)/(equity+IBD)` — a rough proxy, **not** ROIC: wrong numerator (NOPAT, not netIncome+interest) and no cash netting) | Add `roic` to `PROFITABILITY_RATIOS` with NOPAT numerator and invested-capital denominator. |
| **NOPAT** | Net Operating Profit After Tax = `EBIT × (1 − t)`. | EBIT; `t` | No (not exposed anywhere) | Expose as a derived value alongside ROIC. |
| **EBIT margin** | `EBIT / revenue × 100`. | EBIT; revenue | No (L3 has operating/ordinary/net margin but not EBIT) | Add `ebit_margin` to profitability. |
| **EBITDA (absolute + margin)** | `EBITDA = opInc + dep + amort`; `EBITDA margin = EBITDA / revenue × 100`. | opInc, dep, amort, revenue | Partial (L1 absolute, L2 margin-only w/o amort, L3 absent) | Add `ebitda` + `ebitda_margin` to L3 profitability; align definition per §4. |
| **Operating cash flow margin** | `CFO / revenue × 100`. | `cf.operatingActivities.netCashFromOperating`; revenue | No | Add a new **cash-flow ratio category** (see §5.6) with `ocf_margin`. |
| **DuPont (3-step)** | `ROE = net_margin × asset_turnover × equity_multiplier`. | net margin, asset turnover, `totalAssets/equity` | No (components exist scattered; decomposition not exposed) | Add a `dupont` breakdown block returning the three factors + their product reconciled to ROE. |
| **DuPont (5-step)** | Extends 3-step: `tax_burden × interest_burden × EBIT_margin × asset_turnover × equity_multiplier`. | netIncome/pretax, pretax/EBIT, EBIT/revenue, revenue/assets, assets/equity | No | Optional deeper decomposition. |

> **PENDING HUMAN DETERMINATION (profitability):**
> - **EBIT definition.** In JGAAP, interest is non-operating, so `経常利益 (ordinaryIncome)` already excludes interest.
>   Two defensible EBIT forms: (a) `EBIT = operatingIncome` (operating-only, common in 財務比率 textbooks that equate
>   営業利益 with EBIT); (b) `EBIT = ordinaryIncome + interestExpense` (add back interest to 経常利益). The choice moves
>   ROIC/NOPAT/EBIT-margin/interest-burden. *Decide one and document it.*
> - **Invested capital definition.** Financing approach: `equity + interestBearingDebt − cash&equivalents`. Operating
>   approach: `netWorkingCapital + netFixedAssets`. And whether to use **average** invested capital. *Decide.*
> - **Effective tax rate fallback** when `incomeBeforeTax ≤ 0` (statutory rate? null?). *Decide.*
> - **DuPont equity multiplier** vs the existing `equityRatio` (they are reciprocals; expose one or both?).
> - Whether `ebitda_margin` should subtract lease/amortization-of-intangibles — currently amortization is always 0 in
>   `calculator.ts` (`amortization = 0`), so EBITDA collapses to `opInc + dep`. *Decide whether to source amortization.*

### 5.2 Liquidity

| Metric | Definition & formula | Inputs | Existing? | Concrete proposed change |
|--------|----------------------|--------|-----------|--------------------------|
| **Cash Conversion Cycle (CCC)** | `DIO + DSO − DPO` (days). | DIO, DSO, DPO | **No** (DIO, DSO exist in L3 efficiency; DPO absent; CCC absent) | Add `ccc` to liquidity (or efficiency); demanded by DD checklist `MA-WC-001`. |
| **Defensive Interval Ratio (DIR)** | `(cash + marketable securities + receivables) / (daily operating expenses)`. | cash+securities+receivables; operating expenses (see PENDING) | No | Add `defensive_interval` to liquidity (days). |
| **Operating cash flow to current liabilities** | `CFO / currentLiabilities × 100`. | CFO; current liabilities | No | Add to cash-flow category (§5.6). |
| **Cash ratio / current / quick / working capital** | — | — | **Yes** (L3 liquidity has all five: current, quick, cash, WC, WC ratio) | Keep; no change. |

> **PENDING HUMAN DETERMINATION (liquidity):**
> - **CCC sign and DPO cost base.** DPO standardly uses **cost of sales** (or purchases), not revenue — but some
>   practitioners use revenue. With the C4 mapping break, `costOfSales` may be empty on the freee path. *Decide the
>   denominator and the fallback when COGS is unavailable.*
> - **DIR daily operating expenses denominator.** Options: `(COGS + SGA − non-cash) / 365` or `(operating expenses) / 365`.
>   Whether to include COGS, whether to subtract depreciation. *Decide.*
> - **365 vs 360 vs period-days** for all day-count ratios (DIO/DSO/DPO/DIR). *Decide a single convention.*

### 5.3 Leverage / safety

| Metric | Definition & formula | Inputs | Existing? | Concrete proposed change |
|--------|----------------------|--------|-----------|--------------------------|
| **Long-term debt-to-equity** | `fixedLiabilities / equity`. | fixed liabilities; equity | No (L3 has total D/E, not long-term D/E) | Add `long_term_debt_to_equity` to safety. |
| **Debt-to-EBITDA** | `interestBearingDebt / EBITDA`. | IBD; EBITDA | No (L2 bank has DSCR/coverage but not debt/EBITDA) | Add to safety (covenant-common). |
| **Net debt-to-EBITDA** | `(IBD − cash&equivalents) / EBITDA`. | IBD; cash; EBITDA | No | Add to safety. |
| **Equity multiplier** | `totalAssets / equity`. | totalAssets; equity | No (derivable as 1/equityRatio; not exposed) | Expose (also a DuPont factor). |
| **Times Interest Earned (TIE)** | `EBIT / interestExpense`. | EBIT; interest expense | Partial (L3 `interest_coverage` uses **operating income**, not EBIT) | Add `times_interest_earned` (EBIT-based) or redefine `interest_coverage`; *decide* (see PENDING). |
| **equity_ratio / debt_to_equity / debt_ratio / fixed_ratio / fixed_long_term_ratio** | — | — | **Yes** (L3 safety, all six) | Keep. |

> **PENDING HUMAN DETERMINATION (leverage):**
> - **Interest-bearing debt scope** (lease? bonds? short-term borrowings?) — must match the §4 consolidation resolver.
> - **Cash definition** for net debt: cash & deposits only, or + marketable securities? *Decide.*
> - **TIE vs interest_coverage**: keep both (operating-income vs EBIT base) or collapse to one. *Decide.*
> - **Interest-expense bucket bug in L2** (`kpi.ts` reads `sgaExpenses` for interest — §4) must be fixed before
>   `debt/EBITDA`/`net_debt/EBITDA` are exposed, since EBITDA + interest feed them.

### 5.4 Efficiency

| Metric | Definition & formula | Inputs | Existing? | Concrete proposed change |
|--------|----------------------|--------|-----------|--------------------------|
| **Days Payable Outstanding (DPO)** | `365 / payablesTurnover` = `(payables / costOfSales) × 365`. | payables; COGS | **No** (L3 has payables_turnover but not DPO) | Add `days_payable` to efficiency (also unblocks CCC). |
| **Fixed-asset turnover** | `revenue / fixedAssets` (or average). | revenue; fixed assets | No | Add `fixed_asset_turnover`. |
| **Working-capital turnover** | `revenue / (currentAssets − currentLiabilities)`. | revenue; CA; CL | No | Add `working_capital_turnover`. |
| **Cash conversion cycle** | (see §5.2) | — | No | Add (cross-listed). |
| **asset/inventory/receivables/payables turnover, DIO, DSO** | — | — | **Yes** (L3 efficiency, all six) | Keep; align inventory/receivables/payables resolvers per §4. |

> **PENDING HUMAN DETERMINATION (efficiency):**
> - **Average vs period-end** balances for turnover denominators (L3 uses average assets for `asset_turnover` but
>   period-end for inventory/receivables/payables). *Decide a consistent convention.*
> - **DPO cost base** (COGS vs purchases) — same open question as CCC.

### 5.5 Growth

| Metric | Definition & formula | Inputs | Existing? | Concrete proposed change |
|--------|----------------------|--------|-----------|--------------------------|
| **Gross-profit growth** | `(GP_curr − GP_prev) / |GP_prev| × 100`. | grossProfit curr/prev | No (L3 has revenue/OI/net-income/total-assets/equity growth) | Add `gross_profit_growth`. |
| **EBITDA growth** | `(EBITDA_curr − EBITDA_prev) / |EBITDA_prev| × 100`. | EBITDA curr/prev | No | Add `ebitda_growth` (gated on the §4 EBITDA alignment). |
| **Ordinary-income growth** | `(OI_curr − OI_prev) / |OI_prev| × 100`. | ordinaryIncome curr/prev | No | Add `ordinary_income_growth`. |
| **EPS growth / DPS growth / BVPS growth** | Per-share period-over-period change. | shares outstanding; dividends; equity | No | **Blocked** — no share-count / dividend-per-share / shares-outstanding fields in the model. *Decide whether to add them.* |
| **revenue / OI / net-income / total-assets / equity growth** | — | — | **Yes** (L3 growth, all five) | Keep. |

> **PENDING HUMAN DETERMINATION (growth):**
> - **Sign convention for loss-making bases.** L3 divides by `|prev|` — a base-year loss produces a sign-misleading
>   growth % (e.g., loss halving shows −50%). *Decide whether to suppress/flag growth when the prior period is negative.*
> - Whether per-share growth (EPS/DPS/BVPS) is in scope — it requires share-count data not in the schema (Class-A).
>   *Decide.*

### 5.6 Cash-flow ratios (new category — `PENDING HUMAN DETERMINATION`)

L3 has **no cash-flow ratio category** today (only L2's `fcf`/`fcfMargin`). The `CashFlowStatement` type
(`types/index.ts:102-145`) already exposes `netCashFromOperating`, `purchaseOfFixedAssets`, `repaymentOfBorrowing`,
`dividendPaid`, `interestPaid`, `depreciation`, `netIncome` — enough to compute all of the following.

| Metric | Definition & formula | Inputs | Existing? | Concrete proposed change |
|--------|----------------------|--------|-----------|--------------------------|
| **OCF margin** | `CFO / revenue × 100`. | CFO; revenue | No | Add new `CASHFLOW_RATIOS` category + `ocf_margin`. |
| **Earnings quality (accruals ratio)** | `(netIncome − CFO) / netIncome` (or `CFO / netIncome`). | netIncome; CFO | No | Add `earnings_quality`. |
| **FCF margin** | `FCF / revenue × 100`. | FCF; revenue | Partial (L2 only) | Move/also expose in L3. |
| **Capex intensity** | `capex / revenue × 100` (capex = `−purchaseOfFixedAssets`). | purchaseOfFixedAssets; revenue | No | Add `capex_intensity`. |
| **Reinvestment ratio** | `capex / depreciation`. | capex; depreciation | No | Add `reinvestment_ratio`. |
| **Cash-flow adequacy** | `CFO / (capex + debtRepayment + dividends)`. | CFO; capex; repayment; dividends | No | Add `cash_flow_adequacy`. |
| **CFO-to-debt** | `CFO / totalDebt × 100`. | CFO; total debt | No | Add `cfo_to_debt`. |

> **PENDING HUMAN DETERMINATION (cash-flow):**
> - **Capex sign.** `calculator.ts` stores `purchaseOfFixedAssets` as a non-positive number (`Math.min(0, …)`,
>   `:188`), while the type implies a magnitude. All capex-based ratios must normalize the sign. *Decide the canonical
>   sign convention and whether the route receives calculator-built CF or freee-built CF (which may differ).*
> - **Dividends.** `calculator.ts` hardcodes `dividendPaid = 0` (`:213`) and `financingActivities.dividendPaid` is
>   unused. Cash-flow adequacy therefore understates the denominator until dividends are sourced. *Decide whether to
>   source dividends (schema/Class-A) or exclude them.*
> - **CFO source ambiguity.** `CashFlowStatement` has two parallel shapes — `operating{items,netCashFromOperating}`
>   and `operatingActivities{…}`. Ratios must pick one (and handle the case where only one is populated). *Decide.*
> - Whether the new cash-flow category belongs under L3 (`/api/analysis/ratios`) or a separate `/api/analysis/cashflow`
>   route. *Decide.*

---

## 6. Management-accounting metric catalog (all NEW — `PENDING HUMAN DETERMINATION`)

None of these are computed anywhere today (§0.3). Each is gated on one or more of the blockers C1–C3 (§3) unless noted.
For each: **Definition & formula · Inputs · Data prerequisite · Concrete proposed change**.

### 6.1 Contribution margin (限界利益)
- **Formula:** `CM = revenue − variableCosts`.
- **Inputs:** revenue; `variableCosts` = sum of P&L items classified *variable* (typically COGS + the variable portion
  of SGA).
- **Data prerequisite:** C1 (fixed/variable classification). Without it, only an *estimate* via cost-behaviour analysis
  (§6.7) is possible.
- **Concrete proposed change:** Add `calculateContributionMargin(pl, costBehaviourMap)` to a new
  `src/services/analytics/management-accounting.ts` (non-Class-A). Accept an explicit classification map so the metric
  is correct by construction when classifications exist, and `null`/estimated when they do not.

### 6.2 Contribution margin ratio (限界利益率) & variable-cost ratio (変動費率)
- **Formula:** `CM ratio = CM / revenue × 100`; `variableCost ratio = variableCosts / revenue × 100 = 100 − CM ratio`.
- **Inputs:** CM; revenue (or variableCosts; revenue).
- **Data prerequisite:** C1.
- **Concrete proposed change:** Return alongside `CM` in the same function.

### 6.3 Break-even point (損益分岐点)
- **Sales form:** `breakEvenRevenue = fixedCosts / CM ratio`.
- **Units form:** `breakEvenUnits = fixedCosts / (price − variableCostPerUnit)` = `fixedCosts / unitCM`.
- **Inputs:** fixedCosts (sum of *fixed*-classified items, typically fixed SGA + depreciation); CM ratio; (for units)
  unit price & unit variable cost.
- **Data prerequisite:** C1 for the sales form; **C3** (quantity/unit-price) for the units form.
- **Concrete proposed change:** Add `calculateBreakEven({fixedCosts, cmRatio})` (sales form, computable with C1) and a
  units form gated on C3.

### 6.4 Margin of safety (安全余裕率)
- **Formula:** `MoS = (actualRevenue − breakEvenRevenue) / actualRevenue × 100`.
- **Inputs:** actualRevenue; breakEvenRevenue.
- **Data prerequisite:** C1 (transitively, via break-even).
- **Concrete proposed change:** Add `calculateMarginOfSafety(actualRevenue, breakEvenRevenue)`.

### 6.5 Degree of operating leverage (DOL / レバレッジ)
- **Formula (level form):** `DOL = CM / operatingIncome`.
- **Formula (elasticity form):** `DOL = %Δ operatingIncome / %Δ revenue`.
- **Inputs:** CM; operatingIncome (level) or two-period OI & revenue (elasticity).
- **Data prerequisite:** C1 for the level form; two periods of P&L for the elasticity form.
- **Concrete proposed change:** Add `calculateOperatingLeverage(cm, operatingIncome)` (level form) — the cheaper,
  single-period option. *Decide whether the elasticity form is also required (PENDING).*

### 6.6 CVP target-profit sales
- **Formula:** `targetRevenue = (fixedCosts + targetProfit) / CM ratio`.
- **Inputs:** fixedCosts; targetProfit; CM ratio.
- **Data prerequisite:** C1.
- **Concrete proposed change:** Add `calculateTargetProfitRevenue({fixedCosts, targetProfit, cmRatio})`.

### 6.7 Cost-behaviour fixed/variable split (原価分解) — methodology
- **Problem:** C1 means there is no persisted classification, so CM/CVP/break-even need an *estimated* split.
- **Candidate methods (all `PENDING HUMAN DETERMINATION`):**
  - **(a) Account-analysis:** manual per-account fixed/variable/mixed tag (most accurate; requires a classification
    field on `AccountItem` — Class-A schema).
  - **(b) High-low:** on a historical P&L series, `variableRate = (cost_hi − cost_lo) / (activity_hi − activity_lo)`,
    `fixed = totalCost − variableRate × activity`. Needs ≥2 periods + an activity driver.
  - **(c) Least-squares regression:** `cost = a + b × activity` over N periods. More data, more robust.
  - **(d) Engineering estimate:** bottom-up from standards (heaviest; overlaps standard-cost).
- **Activity driver options:** revenue (cheapest, always available), units (C3), headcount, machine-hours. *Decide.*
- **Heuristic seed (no schema change):** freee `AccountItem.correspondingExpenseId/Name` (対応費用) links a cost to a
  revenue account — accounts with a corresponding revenue are candidate-*variable*; accounts without are candidate-*fixed*.
  This is a *seed for human review*, not a classification. `PENDING HUMAN DETERMINATION`.
- **Concrete proposed change:** Add `estimateCostBehaviour(plSeries, driver)` returning `{variableRatio, fixedCost}`
  per account or per cost pool, with the method chosen per PENDING. Gate the §6.1–6.6 metrics on either a real
  classification (C1) or this estimate (with a `method: 'estimated'` flag and confidence).

### 6.8 Segment profitability (セグメント別収益性)
- **Metrics per segment:** segment revenue, segment variable costs, segment CM, segment fixed costs (direct),
  segment operating income, segment margin %.
- **Inputs:** P&L items tagged with a segment/department.
- **Data prerequisite:** **C2** (segment dimension on actuals). Currently blocked: `departmentId` exists only on
  `Budget`; `Journal`/`MonthlyBalance`/`ProfitLoss` have no segment; freee `segment_1/2/3` is discarded in sync
  (FIN-DESIGN-01 §4.3/§7.1).
- **Concrete proposed change:** *Describe-only* — add segment-tagged P&L aggregation once C2 is resolved (FIN-DESIGN-01
  §7.1 dimension capture + §7.6 department master). Until then, this metric is **not computable** and should surface a
  `dataQuality.dimensionCoverage.segment = false` flag (mirroring FIN-DESIGN-01 §8).

### 6.9 Budget / standard-cost variance (予実差異 / 標準原価差異)
- **Existing:** Level-1 static-budget variance (`actual − budget`) in `src/services/budget/actual-vs-budget.ts` and
  `detailed-actual-vs-budget.ts`; threshold flagging in `analyzeBudgetVariance`. No driver decomposition, no
  standard-cost Level-3.
- **Designed (not implemented):** FIN-DESIGN-01 specifies the full framework — Level 2 (flexible-budget / activity
  variance), Level 3 (price × efficiency), revenue PVVM, journal-level attribution, sign convention, materiality,
  reconciliation gap, and the target data model + API shape.
- **Standard-cost variance specifically** (direct-materials / direct-labor price & efficiency): requires
  **quantity + budgeted unit price** per input — i.e., blocker **C3** (FIN-DESIGN-01 §7.2). Not computable today.
- **Concrete proposed change:** *Do not re-derive here.* Implement per FIN-DESIGN-01's phasing (§12): Phase 0
  (category-mapping fix §7.4 + key crosswalk §7.3 + `dataQuality`), Phase 1 (Layer A account drivers), Phase 2 (Layer B
  M0 journal ranking + reconciliation), Phase 3 (PVVM/standard-cost depth via §7.1/§7.2). All `PENDING HUMAN DETERMINATION`.

> **PENDING HUMAN DETERMINATION (management accounting, overall):** Whether to ship the C1-estimable subset (CM ratio,
> break-even sales, margin of safety, DOL — all via §6.7 cost-behaviour estimation on a historical series) *before* the
> C1 classification field lands, or to gate the whole management-accounting family on a real classification. The
> estimable subset would carry a `method: 'estimated'` confidence flag; the classification-based subset would be exact.

---

## 7. Data-model prerequisites (PROPOSED — descriptions only, `PENDING HUMAN DETERMINATION`)

Every item is a **proposal for a human decision**. Items 7.2–7.5 touch Class-A paths and are therefore described, not
implemented, by this task. They overlap FIN-DESIGN-01 §7 and are restated here only where the management-accounting
catalog depends on them.

| # | Prerequisite | Unlocks | Touches (Class-A?) | Status |
|---|--------------|---------|--------------------|--------|
| **7.1** | **Fixed/variable cost classification.** Add a `costBehaviour` enum (`fixed`/`variable`/`mixed`) or a `variableRatio` (0–1) to `AccountItem`; or a separate `AccountCostBehaviour` table. Seed via the 対応費用 heuristic (§6.7) for human review. | §6.1–6.6 (CM, CVP, break-even, MoS, DOL, target-profit) | `prisma/schema.prisma` + `AccountItem` ingestion (**Class-A**) | `PENDING` |
| **7.2** | **Segment / department dimension on actuals.** Capture freee `segment_1/2/3` + `partner`/`item`/`tag` in journal sync; add a `Department`/segment master. (≡ FIN-DESIGN-01 §7.1/§7.6.) | §6.8 segment profitability; department-level variance | `schema.prisma`, `src/lib/integrations/freee/**` (**Class-A**) | `PENDING` |
| **7.3** | **Quantity / unit-price.** Add optional `quantity`/`unitPrice` to journal details / P&L. (≡ FIN-DESIGN-01 §7.2.) | §6.3 break-even *units*; revenue PVVM; standard-cost Level-3 (§6.9) | `schema.prisma`, freee sync (**Class-A**) | `PENDING` |
| **7.4** | **Account-key crosswalk** (`account_item_id ↔ shortcut_num ↔ name`) + **category-mapping fix** (replace dead-code `getCategoryFromAccountItem` with an `AccountItem.categoryType`-driven map). (≡ FIN-DESIGN-01 §7.3/§7.4.) | Trustworthy revenue/COGS → all revenue/COGS-based metrics (ROIC, DuPont, CM, CCC) | `src/lib/integrations/freee/**`, `src/services/conversion/**` (**Class-A**) | `PENDING` |
| **7.5** | **FinancialKPIs type extension** (`src/types/index.ts:221`) + new `ManagementAccountingKPIs` type. | Persisting/exposing the new metrics | `src/types/**` (not Class-A, but a shared contract) | `PENDING` |

> **PENDING HUMAN DETERMINATION:** Which of 7.1–7.5 to accept and in what order. 7.4 is the minimum to make any
> revenue/COGS-based metric trustworthy; 7.1 unlocks the contribution-margin family; 7.2 unlocks segments; 7.3 unlocks
> per-unit CVP and standard-cost depth.

---

## 8. Integration surface (where new metrics would live — `PENDING HUMAN DETERMINATION`)

- **Financial-accounting gaps (§5):** the natural home is the **ratio-analyzer** (`src/services/ai/analyzers/ratios/*.ts`)
  — **not Class-A** — extending the existing `*_RATIOS` arrays + a new `CASHFLOW_RATIOS` category, exposed via
  `POST /api/analysis/ratios`. The L1/L2 consolidation (§4) should precede or accompany this. *Decide.*
- **Management-accounting metrics (§6):** a new **`src/services/analytics/management-accounting.ts`** (non-Class-A)
  exposing `calculateContributionMargin`, `calculateBreakEven`, `calculateMarginOfSafety`,
  `calculateOperatingLeverage`, `calculateTargetProfitRevenue`, `estimateCostBehaviour`. Wired through a new
  `POST /api/analysis/management` route (mirroring the analysis route pattern) or folded into the existing report
  pipeline. *Decide the route.*
- **User-defined KPI surface:** `CustomKPI`/`CustomKPIValue` (`schema.prisma:573/608`) already exist for user-defined
  KPIs; new domain metrics could be seeded as `CustomKPI` definitions. *Note:* `src/services/kpi/**` is **Class-A**
  (excluded from modification); any KPI-definition service work is describe-only. The analytics layer (non-Class-A) is
  the implementation target. *Decide.*
- **Persisted KPIs:** the `FinancialKPI` DB model (`schema.prisma:359`) and `FinancialKPIs` type
  (`src/types/index.ts:221`) would need extension to persist new metrics. *Decide scope.*

> **PENDING HUMAN DETERMINATION:** All integration placement (which module, which route, which persisted type) is a
> decision for a human.

---

## 9. Worked example (illustrative only — `PENDING HUMAN DETERMINATION`)

Numbers are illustrative, not from real data. Shows the C1-estimable management-accounting subset.

A service company, FY2025 (¥): `revenue = 100,000,000`; `COGS = 30,000,000`; `SGA = 50,000,000` (of which, per a
classification estimate, `40,000,000` fixed and `10,000,000` variable); `operatingIncome = 20,000,000`.

- `variableCosts = COGS + variableSGA = 30,000,000 + 10,000,000 = 40,000,000`
- `CM = 100,000,000 − 40,000,000 = 60,000,000`; `CM ratio = 60%`; `variableCost ratio = 40%`
- `fixedCosts = 40,000,000`
- `breakEvenRevenue = 40,000,000 / 0.60 = 66,666,667`
- `marginOfSafety = (100,000,000 − 66,666,667) / 100,000,000 = 33.3%`
- `DOL = 60,000,000 / 20,000,000 = 3.0` (a 10% revenue gain → ~30% OI gain, at constant cost behaviour)
- `targetProfitRevenue (target = 8,000,000) = (40,000,000 + 8,000,000) / 0.60 = 80,000,000`

This subset is computable **today only via the §6.7 estimate** (no persisted fixed/variable split), so every line above
would carry `method: 'estimated'` and a confidence flag until 7.1 lands. `PENDING HUMAN DETERMINATION` on whether to
ship the estimated form.

---

## 10. Risks, assumptions, open questions (all `PENDING HUMAN DETERMINATION`)

1. **Definition inconsistency (§4) before addition.** Adding ROIC/EBITDA/CCC on top of three disagreeing implementations
   multiplies the inconsistency. Decide whether consolidation is a prerequisite.
2. **C4 mapping break.** Until §7.4 lands, revenue/COGS/gross-profit-based metrics (ROIC, DuPont, CM, CCC, gross-margin
   growth) inherit the broken freee-path mapping and are unreliable for the top P&L lines. Decide whether to gate these.
3. **Estimation vs classification (§6.7).** Shipping CM/CVP/break-even on an *estimated* split risks presenting
   estimates as facts. Decide the confidence-flagging UX and whether estimation is acceptable at all.
4. **Average-vs-period-end and 365-vs-360 conventions.** Multiple open conventions across day-count and average-balance
   ratios (§5). Decide one each.
5. **EBIT definition (§5.1).** Operating-income-based vs ordinary-income-based EBIT shifts ROIC/NOPAT/EBIT-margin and
   the DuPont interest-burden factor. Decide.
6. **Capex sign + dividend sourcing (§5.6).** Cash-flow ratios depend on a normalized capex sign and real dividends
   (currently hardcoded 0). Decide.
7. **Segment scope (§6.8).** Segment profitability is fully blocked until 7.2; decide whether it is in scope for the
   first iteration or deferred.
8. **Class-A boundaries.** 7.1–7.4 (and the standard-cost variance depth in §6.9) touch `prisma/schema.prisma`,
   `src/lib/integrations/freee/**`, and `src/services/conversion/**` — all Class-A. Any implementation is a separate,
   bounded task. This document only describes them.
9. **No new external dependencies / no copied code** (per task constraints). Every metric above is implementable with
   existing Prisma + the existing statement types; the catalog adds no libraries.

---

## 11. References

- Horngren, Datar & Rajan, *Cost Accounting: A Managerial Emphasis* — contribution margin, CVP, break-even, margin of
  safety, operating leverage, standard-cost variance (Level 1/2/3), and segment reporting.
- Garrison, Noreen & Brewer, *Managerial Accounting* — cost-behaviour analysis (account-analysis, high-low,
  least-squares), CVP, and the DuPont decomposition.
- Cited prior design: `docs/proposals/fin-design-01-variance-attribution.md` (budget / standard-cost variance
  methodology — referenced, not re-derived).
- Repo evidence: `src/services/analytics/financial-kpi.ts`; `src/services/analytics/kpi.ts`;
  `src/services/ai/analyzers/ratio-analyzer.ts`; `src/services/ai/analyzers/ratios/{profitability,liquidity,safety,efficiency,growth,types}.ts`;
  `src/app/api/analysis/{ratios,financial}/route.ts`; `src/app/api/analysis/types/output.ts`;
  `src/services/cashflow/calculator.ts`; `src/services/budget/{actual-vs-budget,detailed-actual-vs-budget}.ts`;
  `src/services/dd/checklists/ma-financial-dd.ts` (`MA-WC-001` demands CCC); `src/types/index.ts` (`ProfitLoss:81`,
  `BalanceSheet:50`, `CashFlowStatement:102`, `FinancialKPIs:221`); `prisma/schema.prisma` (`Budget:191`,
  `Journal:108`, `MonthlyBalance:377`, `AccountItem:454`, `CustomKPI:573`).

---

*End of proposal. All content above is analysis for a human reviewer. Nothing is approved, decided, or signed off.
Every conclusion is `PENDING HUMAN DETERMINATION`.*
