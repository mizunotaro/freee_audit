# FIN-DESIGN-02 — Cashflow + Runway 3-Scenario Model (通常 / 悲観 / 強気)

**Status:** DESIGN PROPOSAL — ANALYSIS ONLY.
**Every conclusion, finding, and proposed change in this document is `PENDING HUMAN DETERMINATION`.**
This is a methodology/design for a human reviewer. It is **not** an approval, a decision, or a sign-off. No reviewer
name, status of "approved", or acceptance is recorded anywhere in this document. Nothing here has been implemented;
source code is read-only reference for this task. This task writes **this one document only**.

This is the direct sequel to [FIN-DESIGN-01 (budget-variance attribution)](./fin-design-01-variance-attribution.md);
the data-source findings there (actuals live in `MonthlyBalance`, never `Journal`; sample-data fallback; broken
account→category mapping) carry over verbatim and are re-cited where they constrain the scenario model.

---

## 0. TL;DR

The task asks for a **scenario model** producing base / pessimistic / optimistic projections for **cash position,
monthly burn, and Runway (months to zero cash)**, with explicit per-scenario parameter sets
(revenue growth, collection timing/DSO, churn, cost inflation, one-offs), formulas, sensitivity handling, and a
response shape, grounded in the standard burn/Runway definitions.

Three findings dominate the design and are `PENDING HUMAN DETERMINATION`:

1. **The live cashflow + Runway pipeline runs on hardcoded sample data.** The route
   `src/app/api/reports/cashflow/route.ts` builds its P&L and balance sheet from `getBalanceSheet()` /
   `getProfitLoss()` — pure synthetic generators (`baseMultiplier = 1 + (month-1)*0.02`, fixed line items). The
   `companyId` is captured into `targetCompanyId` (`:25`) but **never passed to the generators**; `beginningCash` is
   the literal `15000000` (`:28`, `:31`). There is **no `MonthlyBalance` read** in this path. So every cash-position
   and Runway number served today is synthetic, identical for every company. (Evidence: §4.1.) → *A scenario model
   built on this input would be projecting fiction; the data-source fix is a hard prerequisite.*

2. **"Scenarios" today are a single linear multiplier on burn — and they are dead in the live path.**
   `calculateRunway` (`runway-calculator.ts:40-46`) derives its three scenarios purely by multiplying one
   `baseBurnRate` by `optimistic/realistic/pessimistic` scalars clamped to `[0.5, 2.0]` (realistic forced to `1.0`),
   and the route calls it with **no options** (`route.ts:32`), so all three scenarios are **identical**. There is no
   revenue growth, no DSO, no churn, no one-off, no cost inflation, no time-varying projection — the scenario
   *concept* does not exist in code. (Evidence: §4.2.) → *A real driver-based scenario engine must be designed from
   scratch; the multiplier is not a foundation to extend.*

3. **Runway is a static quotient (`cash / burn`), not a month-by-month projection to zero.** The formula
   `runwayMonths = currentCash / burnRate` (`runway-calculator.ts:44-46`) assumes **constant** burn and a flat cash
   line. It cannot represent improving/deteriorating burn, discrete inflows (a funding round) or outflows (a bonus,
   tax payment, capex) inside the horizon, or a cash line that dips below zero then recovers. It also defines burn
   as **operating-only** for Runway (`:25-33`) but as **op+inv+fin** in the sibling `calculateAverageBurnRate`
   (`:198-207`) — two inconsistent burn bases in one file. (Evidence: §4.3, §4.4.) → *The model must roll cash forward
   month-by-month (direct method) and let the static quotient fall out as the degenerate flat-burn case (§11).*

Given the above, this document specifies: (a) the **standard burn/Runway/DSO definitions** to adopt (§3); (b) a
**direct-method monthly cash rollforward engine** whose levers are the requested parameter set (§6.1–6.3); (c) how
**burn and Runway-to-zero are derived per scenario** from that engine (§6.4); (d) **sensitivity handling**
(tornado + optional Monte Carlo) (§6.5); (e) the **target data model** (no `CashFlowForecast`/`ScenarioAssumption`
table exists today — §7), **response shape** (§8), **algorithm** (§9), and a **worked 3-scenario example** (§10).
Every proposed change touching source or schema is a description for a human, `PENDING HUMAN DETERMINATION`. Schema
additions are Class-A (`prisma/schema.prisma`) and out of bounds to implement here.

---

## 1. Scope & non-goals

**In scope (design only):**
- A driver-based scenario model producing 3 coherent projections (base/悲観 optimistic-内... 通常/悲観/強気) of monthly
  cash position, gross/net burn, and Runway-to-zero over a horizon.
- The per-scenario **parameter set** (revenue growth, collection timing/DSO, churn, cost inflation, one-offs, capex,
  debt service, financing), the **formulas**, and **sensitivity handling**.
- The target **data model**, **API request/response shape**, **edge-case catalog**, and a **worked example**.
- Cited, standard burn/Runway/working-capital definitions the model is grounded in.

**Out of scope (non-goals):**
- Any code change. This task writes this one document only. All proposed model/API/schema changes are descriptions for
  a human, `PENDING HUMAN DETERMINATION`.
- Multi-entity consolidation, FX-translation of foreign subsidiaries' cash, or intercompany elimination.
- A budgeting/**entry** UX for assumptions (§7 proposes storage, not UI).
- Re-derivation of the FIN-DESIGN-01 actuals-lineage fix — referenced, not re-litigated.

---

## 2. Background — current cashflow/Runway code (read-only reference)

| File | Role |
|------|------|
| `src/services/cashflow/calculator.ts:56-94` | `calculateCashFlow(pl, currentBS, previousBS, options)`: builds an **indirect-method** `CashFlowStatement` from PL + BS deltas. Operating = NI + depr + amort + ΔdefTax + ΔAR(inv sign) + Δinv + ΔAP + other + interest adj. |
| `src/services/cashflow/calculator.ts:181-230` | Investing CF from fixed-asset *deltas*; financing CF from borrowing deltas + interest; `dividendPaid = 0` hardcoded (`:213`); `amortization = 0` hardcoded (`:105`). |
| `src/services/cashflow/cash-position.ts:4-46` | `generateCashPosition(monthlyCashFlows, beginningCash)`: rolls cash forward month-by-month over **actual** historical CFs (not a forecast). |
| `src/services/cashflow/cash-position.ts:88-230` | `generateDetailedCashPosition`: splits operating into 売上入金 / 仕入支払 / 人件費 / 経費 using **fabricated ratios** (`netIncome*1.2`, `*0.8`, `*0.3`, `*0.1`) — not derived from any collection/payment schedule. |
| `src/services/cashflow/runway-calculator.ts:16-80` | `calculateRunway(currentCash, monthlyCashFlows, options)`: mean operating CF → `baseBurnRate` → ×multipliers → `runway = cash/burn`. Static. |
| `src/services/cashflow/runway-calculator.ts:100-132` | `validateAndApplyAdjustments`: clamps multipliers to `[0.5,2.0]`, forces realistic `1.0`, **requires a reason string** to apply any non-1.0 multiplier (else warns and resets to 1.0). |
| `src/services/cashflow/runway-calculator.ts:140-166` | `getRunwayAlert`: safe ≥12mo, warning ≥6, critical ≥3, else critical-short. |
| `src/services/cashflow/runway-calculator.ts:168-207` | `calculateBurnRateTrend` / `calculateAverageBurnRate`: burn = **op+inv+fin** total here (inconsistent with Runway's operating-only basis). |
| `src/app/api/reports/cashflow/route.ts:14-62` | The endpoint. Calls `getBalanceSheet`/`getProfitLoss` — **synthetic generators**; `companyId` unused; `beginningCash = 15000000` literal. |
| `src/hooks/reports/use-cashflow-data.ts` | Frontend consumer: reads `cashFlows`/`cashPosition`/`runway`/`alert` from this route, then **separately** pulls debt-service cash-out from `/api/debt/forecast` (`:38-67`). |
| `python-service/app/services/cashflow_calculator.py` | Parallel indirect-method calc; **no scenario / burn / Runway / forecast** logic. |

**What the current code does *not* do:** no forecasting/projection (only historical rollforward), no driver levers
(growth/DSO/churn/inflation/one-offs), no month-by-month path to zero, no sensitivity, no persistence of assumptions,
no real data source. These are the subject of this design.

---

## 3. Standard burn, Runway & working-capital definitions (cited)

The model is grounded in the canonical VC/FP&A and treasury definitions. These are definitional references, not repo
citations.

**Gross burn** — total cash *outflows* of the business in a period, before netting any inflows (payroll, payments to
suppliers, rent, tax paid, capex, debt service). The standard "how much cash do we light on fire each month" measure.

**Net burn** — cash outflows − cash inflows over the period; equivalently the negative of the period's net cash change
when that change is negative:
> `NetBurn_t = Outflows_t − Inflows_t = −ΔCash_t` (when `ΔCash_t < 0`)

The **common SaaS/startup narrow definition** uses operating cash only (`NetBurn = −OperatingCF`); the **broader
definition** includes investing outflows (`NetBurn = −(OperatingCF + InvestingCF)`). Whether financing counts depends
on whether recurring debt service / dividends are considered "operations." This model exposes the choice as an
explicit parameter (`burnBasis`, §6.4) rather than baking one in. `PENDING HUMAN DETERMINATION` on the default basis.

**Cash Runway** — months until cash is exhausted at the current net burn rate, the standard FP&A/VC definition:
> `Runway (months) = Cash ÷ |NetMonthlyBurn|`  (when `NetMonthlyBurn > 0`; otherwise `∞`)

This is a **constant-burn** formula — correct as a point estimate, wrong as soon as burn trends or one-offs occur. The
scenario engine (§6) generalizes it; the static quotient is recovered exactly in the flat-burn degenerate case (§11).

**DSO — Days Sales Outstanding** (collection timing):
> `DSO = AccountsReceivable ÷ (Revenue ÷ 365)`  (annualized), or `AR ÷ (Revenue × 30 ÷ 365)` per month.

**DPO — Days Payable Outstanding** (payment timing):
> `DPO = AccountsPayable ÷ (COGS ÷ 365)`.

**DIO — Days Inventory Outstanding** and **CCC — Cash Conversion Cycle**:
> `CCC = DSO + DIO − DPO`  — the number of days a dollar is locked up between paying suppliers and collecting from
> customers; the central lever connecting P&L growth to cash burn in a scaling business.

**Direct vs indirect method (for forecasting).** The existing `calculator.ts` is **indirect** (NI + ΔWC) — appropriate
for a *historical* cash-flow statement but poorly suited to scenario forecasting, because it back-solves cash from
accrual deltas rather than modeling when cash actually arrives/leaves. Scenario forecasting is conventionally done by
the **direct method**: model collections from a revenue plan × a collection (DSO) lag, and payments from a purchases
plan × a payment (DPO) lag (the "receipts and disbursements" / treasury forecasting method). This design adopts the
direct method for the projection engine (§6.1). `PENDING HUMAN DETERMINATION`.

> **PENDING HUMAN DETERMINATION:** Which burn basis (operating-only vs op+investing vs op+inv+fin) is the product
> default, and whether the UI surfaces all three. The rest of the design is basis-agnostic.

---

## 4. Current-state findings (evidence-backed)

### 4.1 The live cashflow + Runway pipeline runs on hardcoded sample data
`src/app/api/reports/cashflow/route.ts`:
- `targetCompanyId = user.companyId` (`:25`) — captured.
- `getYearCashFlows(targetCompanyId, fiscalYear)` (`:27`) loops months 1–12 and calls `getBalanceSheet(companyId,
  fiscalYear, month)` / `getProfitLoss(...)` (`:54-58`) — but **both generators ignore every argument** and return
  synthetic objects built from `baseMultiplier = 1 + (month-1)*0.02` (BS, `:65`) / `*0.03` (PL, `:104`), with fixed
  line items (現金及び預金 ¥15M, 売掛金 ¥8M, 買掛金 ¥5M, revenue ¥5M, 給与手当 ¥0.8M, …).
- `generateCashPosition(cashFlows, 15000000)` (`:28`) and `currentCash = …endingCash || 15000000` (`:31`) — beginning
  cash and current cash are both the literal `15000000` (or a multiple thereof).

There is **no `prisma.monthlyBalance` call** in this route (contrast `balance-loader.ts:52`, which the *report* path
uses but this *cashflow* path does not). Consequences directly relevant to a scenario model:
- "Current cash," revenue, AR, AP, payroll — every input the scenario engine needs — is synthetic and identical for
  every tenant. A 3-scenario projection built here projects the same fiction for every company.
- This mirrors the FIN-DESIGN-01 finding that the budget route feeds hardcoded `generateSamplePL`; the cashflow route
  is the same defect in a different feature.
- The real source — `MonthlyBalance` (`schema.prisma:377`, fields `companyId/fiscalYear/month/accountCode/
  accountName/category/amount`) — is read by `balance-loader.ts:fetchBalancesByFiscalYear` but is **not wired** into
  the cashflow path. Per FIN-DESIGN-01 §4.2, `MonthlyBalance` is the single convergence point of freee trial-balance
  sync, CSV import, and seed; it is the only real actuals source.

`PENDING HUMAN DETERMINATION`: whether the scenario engine may ship at all before the cashflow route is rewired to
`MonthlyBalance` (a `src/app/api/reports/**` + `src/services/cashflow/**` change — not Class-A, but out of bounds to
*implement* in this audit-only task).

### 4.2 "Scenarios" today = one linear burn multiplier, dead in the live path
`calculateRunway` (`runway-calculator.ts`):
- `monthlyNetCashFlows` = per-month `operatingActivities.netCashFromOperating` **only** (`:25-29`).
- `avgMonthlyNetCashFlow` = unweighted simple mean (`:31`).
- `baseBurnRate = |avg|` only when negative, else `0` (`:33`) → a company with positive operating CF but heavy capex /
  debt repayment reports **burn = 0 → Runway = 999 (∞)**, regardless of investing/financing drain.
- Scenarios (`:40-46`): `realisticBurnRate = base*1.0`, `optimistic = base*adj.optimistic`, `pessimistic =
  base*adj.pessimistic`; `validateAndApplyAdjustments` (`:100-132`) clamps both to `[0.5, 2.0]`, forces realistic to
  `1.0`, and **silently resets to 1.0** if a non-1.0 multiplier lacks a reason string (`:117-125`).
- The route calls `calculateRunway(currentCash, cashFlows)` with **no options** (`route.ts:32`) → `adjustments`
  undefined → all three scenarios identical to realistic.

What this cannot represent: revenue growth (none modeled), collection timing/DSO (none), churn (none), cost inflation
(none), one-offs (none), time-varying burn (none), investing/financing events (none). The multiplier scales a single
constant-burn scalar — it is not a scenario model and is not a foundation to extend. `PENDING HUMAN DETERMINATION`.

### 4.3 Runway is a static quotient, not a projection to zero
`runwayMonths = currentCash / burnRate` (`:44-46`); `zeroCashDate = addMonths(now, floor(runwayMonths))` (`:49-52`),
clamped to `9999-12-31` when infinite. This assumes:
- **Constant** burn every future month (no trend, no seasonality, no one-offs).
- Cash declines **monotonically** to zero (no funding round, no seasonal inflow, no recovery after a trough).
- A single point estimate (no distribution / probability of shortfall).

It therefore **cannot** answer the questions a scenario model exists for: "if revenue grows 10%/mo but DSO slips from
60 to 90 days, when do we hit zero?"; "if we raise ¥300M in month 4, does the pessimistic case still survive?";
"what is the minimum cash balance in the next 12 months (trough) even if we never hit zero?". The direct-method
monthly rollforward (§6.1) answers all three; the static quotient is its flat-burn special case (§11).
`PENDING HUMAN DETERMINATION`.

### 4.4 No DSO/DPO/CCC; two inconsistent burn bases; fabricated detail
- **No working-capital-timing modeling exists.** `calculator.ts` derives ΔAR/ΔAP/Δinv from BS deltas (`:107-117`) —
  the *change*, never the *level* and never a days metric. DSO/DPO/DIO/CCC are not computed anywhere in
  `src/services/cashflow/**`. Yet the data to compute them (revenue, COGS, AR, AP balances) is all present in the PL/BS
  types and (really) in `MonthlyBalance`. A scenario lever like "DSO worsens 60→90" has no representation today.
- **Two burn definitions in one file.** `calculateRunway` uses operating-only (`:25-33`); `calculateAverageBurnRate`
  (`:198-207`) uses `op+inv+fin` total. The trend function (`:168-196`) thus describes a different "burn" than the
  Runway it sits beside.
- **`generateDetailedCashPosition` is fabricated.** 売上入金 = `max(0, netIncome*1.2)`, 仕入支払 =
  `-|increaseInPayables*0.8|`, 人件費 = `-|netIncome*0.3|`, その他経費 = `-|netIncome*0.1|`
  (`cash-position.ts:96-138`). These ratios are not derived from any payroll/supplier schedule; leaning on them for a
  collection/payment-timing forecast would propagate invented numbers.

`PENDING HUMAN DETERMINATION`: the burn basis to standardize on, and whether to replace the fabricated detail rows
with direct-method drivers.

### 4.5 No persistence for assumptions or results; CLAUDE.md doc/reality gap
`prisma/schema.prisma` has **zero** matches for `Forecast`/`Scenario`/`Assumption` (verified by search). There is no
table to store per-company scenario assumptions (growth/DSO/churn/inflation/one-offs), no table to store a computed
projection, and no audit link to the blockchain `AuditLog`. CLAUDE.md §5 ("Other") *lists* a `CashFlowForecast` model,
but it does not exist in the schema — a doc/reality gap (cf. the project memory on CLAUDE.md §3 listing absent
component dirs). The scheduler (`src/jobs/scheduler.ts`) has no forecast job. So scenarios today are not just
uncomputed — they are also un-storable and un-scheduled. `PENDING HUMAN DETERMINATION` (target model in §7).

### 4.6 Data-source & cross-feature dependencies (carry-over from FIN-DESIGN-01 / project memory)
The scenario engine consumes outputs of several Class-A subsystems. Their **known defects propagate** into any
projection and must be flagged, not hidden:
- **Actuals source** (`MonthlyBalance`): per FIN-DESIGN-01 §4.2, the report path may be empty/stale (trial-balance
  sync is not scheduled; only manual) and falls back to `generateSampleProfitLoss`. The scenario engine must surface
  `actualsSource` and **refuse to project on sample/mock data** (§6.7).
- **Account→category mapping**: per FIN-DESIGN-01 §4.4, `getCategoryFromAccountItem` misroutes revenue/COGS, so
  revenue, COGS, AR, AP read from `MonthlyBalance` may be unreliable until that fix lands. DSO/DPO computed from
  misrouted revenue are themselves unreliable.
- **Debt schedule** (`src/services/debt/**`, Class-A): per project memory REV-TAX-01, debt forecasts **exclude
  overdue** (`gte:now`), **sync by `issue_date` not `due_date`**, and paid amounts never flip to `PAID`. The scenario
  engine's debt-service feed inherits these defects; runway under-counts near-term repayments.
- **Tax schedule** (`src/services/tax/**`, Class-A): per REV-TAX-01, `generateDefaultTaxSchedules` throws `P2002`
  (duplicate withholding vs `@@unique`) and due dates roll ~12 months late. The scenario engine's tax-paid feed
  inherits this; pessimistic-case tax shocks may be mis-dated.
- **Valuation randomness** (`src/services/valuation/**`, Class-A): per REV-VAL-01, the repo's `SeededRandom` is weak
  and LHS sampling is broken. If the optional Monte-Carlo sensitivity (§6.5) reuses it, those defects carry over.

`PENDING HUMAN DETERMINATION`: which of these the scenario feature is gated on (the strongest gate is §4.1 +
FIN-DESIGN-01 §4.4 — without real revenue/cash, a projection is meaningless).

---

## 5. Proposed scenario model — overview

A **direct-method monthly cash rollforward**, run three times with three coherent parameter bundles, producing a
**path** (monthly cash, monthly gross/net burn) and a **Runway-to-zero** for each. Sensitivity is a layer on top
(§6.5).

- **§6.1** — the projection engine (direct method; receipts from revenue × DSO lag; disbursements from purchases ×
  DPO lag; plus payroll, tax, capex, debt service, one-offs, financing).
- **§6.2** — the per-scenario parameter set (the requested levers: revenue growth, collection timing/DSO, churn, cost
  inflation, one-offs, plus capex/debt-service/financing).
- **§6.3** — the formulas.
- **§6.4** — deriving gross/net burn and Runway-to-zero (and trough) per scenario from the engine.
- **§6.5** — sensitivity handling (tornado; optional Monte Carlo).
- **§6.6** — calibrating base parameters from history.
- **§6.7** — edge cases & data-quality signaling.

> **PENDING HUMAN DETERMINATION:** Whether to ship the full direct-method engine or a lighter "constant-burn with
> one-offs" approximation first (see §13 phasing). This document specifies the full model; the degenerate cases are
> shown explicitly so a phased cut-down is well-defined.

---

## 6. Proposed model — detail

### 6.1 The projection engine (direct method, monthly, to zero)

Inputs: a starting balance sheet snapshot (cash `C_0`, AR `AR_0`, AP `AP_0`, inventory `Inv_0`), a trailing run of
monthly P&L (revenue, COGS, payroll, other opex) from `MonthlyBalance`, and a scenario parameter bundle `P_s`
(§6.2). Horizon `H` months (proposed default 12; configurable).

For each forecast month `t = 1..H`, in order:

1. **Revenue plan.** `Rev_t = Rev_{t-1} · (1 + g_t^s)` where `g_t^s` is the scenario monthly revenue growth
   (annualized growth ÷ 12, or a month-by-month vector). Churn acts on revenue: `Rev_t` is reduced by
   `churnRate_t^s · Rev_{t-1}` (net of any expansion) before growth compounding — see §6.3 for the exact ordering.
2. **Collections (cash in) via DSO lag.** Credit sales `S_t = creditSalesPct · Rev_t`. Roll AR:
   `AR_t = AR_{t-1} + S_t − Col_t`, where `Col_t` is determined by a **collection pattern** derived from the scenario
   DSO target (§6.3). `Col_t` is the cash actually received in month `t`.
3. **Purchases & payments (cash out) via DPO lag.** Purchases `Pur_t ≈ COGS_t + ΔInv_t`. Roll AP:
   `AP_t = AP_{t-1} + Pur_t − Pay_t`, where `Pay_t` follows a **payment pattern** derived from the scenario DPO.
4. **Payroll & other operating outflows.** `Payroll_t`, `OtherOp_t` grown by wage/cost inflation (§6.3).
5. **Tax paid.** `Tax_t` per the tax calendar (effective rate × taxable income, paid in statutory months) — sourced
   from the tax-schedule output (Class-A; defects per §4.6).
6. **Capex.** `Capex_t` = scenario capex schedule (maintenance % of revenue + discrete project outlays).
7. **Debt service & financing.** `DebtSvc_t` = scheduled principal + interest (from debt-schedule output, Class-A);
   `Fin_t` = scenario financing (drawdowns, equity raises as one-offs, dividends).
8. **One-offs.** `OneOff_t^s` = discrete scenario events (funding round inflow, bonus, legal settlement, large
   purchase) at specified months.
9. **Net cash change & roll.**
   `ΔCash_t = Col_t − (Pay_t + Payroll_t + OtherOp_t + Tax_t + Capex_t + DebtSvc_t) + Fin_t + OneOff_t^s`
   `C_t = C_{t-1} + ΔCash_t`.
10. **Track.** Record `C_t`, monthly gross burn, monthly net burn, running min cash (trough), and the first
    `t` where `C_t ≤ 0` (Runway-to-zero; `∞` if never within `H`).

The engine is **deterministic** and **basis-parameterized** (the `burnBasis` switch selects which outflow categories
count toward burn in §6.4). It reduces to the indirect/quotient behavior in degenerate cases (§11).

> **PENDING HUMAN DETERMINATION:** Horizon default (12 vs 18 vs 24 months), whether inventory (DIO) is modeled
> explicitly or folded into purchases, and whether tax is modeled at scenario level or taken verbatim from the
> schedule.

### 6.2 Per-scenario parameter set (the levers)

One bundle per scenario (`s ∈ {base 通常, pessimistic 悲観, optimistic 強気}`). Each lever carries a **value** (used by
the bundle) and a **range** (used by sensitivity, §6.5). All numbers below are illustrative placeholders — every
default is `PENDING HUMAN DETERMINATION`.

| Lever | Symbol | Base (通常) | Pessimistic (悲観) | Optimistic (強気) | Notes |
|-------|--------|------------|--------------------|-------------------|-------|
| Revenue growth (monthly) | `g` | trailing mean (capped) | base − Δ (or negative) | base + Δ | churn applied first (§6.3) |
| Revenue churn (monthly) | `churn` | trailing | base + Δ | base − Δ | reduces the revenue base pre-growth |
| Collection timing (DSO, days) | `dso` | trailing | base + 15–30 (slower) | base − 15 (faster / factoring) | drives `Col_t` pattern |
| Payment timing (DPO, days) | `dpo` | trailing | base − 10 (pay faster) | base + 10 (stretch) | drives `Pay_t` pattern |
| Inventory days (DIO) | `dio` | trailing | base + Δ | base − Δ | optional; affects `Pur_t` |
| Cost inflation (monthly) | `π` | wage/CPI index | base + Δ (sticky costs) | base − Δ (cost discipline) | grows Payroll/OtherOp |
| Gross margin | `gm` | trailing | base − Δ | base + Δ | alternative to separate COGS inflation |
| Capex schedule | `capex` | maintenance % rev | maintained | deferred/disciplined | maintenance + one-off projects |
| Debt service | `debtSvc` | from schedule | from schedule (+ covenants) | from schedule | Class-A feed (§4.6) |
| Tax paid | `tax` | from schedule | adverse (large qtr) | normalized | Class-A feed (§4.6) |
| Financing / funding | `fin` | none scheduled | none | equity raise in month k | drawdowns, raises |
| One-offs | `oneOff` | scheduled only | adverse (settlement, refund) | favorable (grant, raise) | month-tagged events |
| Minimum cash buffer | `C_min` | policy floor | policy floor | policy floor | Runway-to-`C_min` variant (§6.4) |
| Burn basis | `burnBasis` | op+inv (proposed) | op+inv | op+inv | op-only / op+inv / op+inv+fin (§3) |

**Coherence rule:** the three bundles are *coherent stories*, not independent sweeps — e.g., the pessimistic bundle
combines slower collection **and** higher churn **and** sticky costs **and** an adverse one-off, because that is how
downturns actually compound. Independent single-lever variation is the job of the tornado (§6.5), not the named
scenarios. `PENDING HUMAN DETERMINATION` on bundle values per company/industry.

### 6.3 Formulas

**(a) Revenue with churn then growth.**
> `Rev_t = Rev_{t-1} · (1 − churn_t) · (1 + g_t)`

Churn applied to the *opening* base (lost customers leave before growth compounds); `g` is net new/expansion.
`PENDING HUMAN DETERMINATION` on ordering (churn-first vs growth-first changes results modestly).

**(b) Collections from a DSO target (receipts pattern).** Represent the collection lag as a discrete distribution over
lags `{0,1,2,…}` months with weights summing to 1, chosen so the implied DSO matches the scenario target. With weights
`w_0, w_1, w_2` (collect in-month / +30d / +60d):
> `Col_t = w_0·S_t + w_1·S_{t-1} + w_2·S_{t-2}`,  `w_0 + w_1 + w_2 = 1`
> implied `DSO ≈ 30·(w_1 + 2·w_2)` (immediate `w_0` contributes 0 days).

Given a target `dso` and a chosen two-lag shape, solve for the weights (e.g., fix `w_0` from history, set
`w_1 + 2·w_2 = dso/30`, `w_2 = 1 − w_0 − w_1`). This is the standard treasury "receipts pattern" — it lets a scenario
say "DSO 60→90" and have collections *lag* accordingly, deferring cash. `AR_t = AR_{t-1} + S_t − Col_t` stays
consistent. `PENDING HUMAN DETERMINATION` on lag order (2 vs 3 lags) and whether to fit weights from historical
AR/revenue rather than assume.

**(c) Payments from a DPO target (disbursements pattern).** Symmetric:
> `Pay_t = v_0·Pur_t + v_1·Pur_{t-1} + v_2·Pur_{t-2}`,  implied `DPO ≈ 30·(v_1 + 2·v_2)`
> `Pur_t ≈ COGS_t + (Inv_t − Inv_{t-1})`,  `Inv_t ≈ (dio/30)·COGS_t` (if DIO modeled).
> `AP_t = AP_{t-1} + Pur_t − Pay_t`.

**(d) Cost inflation.**
> `Payroll_t = Payroll_{t-1}·(1 + π_t)·(1 + headcountGrowth_t)`  (headcount growth may be negative under pessimistic)
> `OtherOp_t = OtherOp_{t-1}·(1 + π_t)`.

**(e) Tax, capex, debt service, financing, one-offs** — taken from their schedules/scenario vectors (§6.2); capex
maintenance proposed as `% of revenue` so it scales with the scenario.

**(f) Net cash change & cash roll.**
> `ΔCash_t = Col_t − Pay_t − Payroll_t − OtherOp_t − Tax_t − Capex_t − DebtSvc_t + Fin_t + OneOff_t`
> `C_t = C_{t-1} + ΔCash_t`.

**(g) Monthly burn (basis-parameterized).** Let `OutOp_t = Pay_t + Payroll_t + OtherOp_t + Tax_t`; then:
> `GrossBurn_t = OutOp_t + Capex_t + DebtSvc_t`  (all outflows; financing excluded by convention)
> `NetBurn_t = GrossBurn_t − Col_t − otherInflows_t`  (broad); narrow = `OutOp_t + Capex_t − Col_t`.

### 6.4 Deriving burn & Runway per scenario

From the engine's monthly series `{C_t, GrossBurn_t, NetBurn_t}` for scenario `s`:

- **Average net burn** `B̄_s = mean(NetBurn_t over t where NetBurn_t > 0)` (ignore net-positive months so a funding
  month doesn't distort the burn estimate). `PENDING HUMAN DETERMINATION` on averaging window (full horizon vs
  first-6 / last-6).
- **Runway-to-zero (path-based):** `R_s = min{ t : C_t ≤ 0 }`, else `∞` (never within `H`). This is the **true**
  scenario Runway — it accounts for trend and one-offs. Report `zeroCashDate = startDate + R_s months`.
- **Runway-to-zero (static quotient):** `R_s* = C_0 / B̄_s` — the textbook formula (§3), reported alongside as the
  "constant-burn" reference. The gap `R_s − R_s*` quantifies the one-off/trend effect the static formula misses.
- **Trough:** `min_t C_t` and its month — critical for "we survive, but cash dips to ¥X in month 7."
- **Runway-to-buffer:** `R_s^{min} = min{ t : C_t ≤ C_min }` — months until the policy minimum-cash floor is breached
  (often more actionable than zero). `PENDING HUMAN DETERMINATION` on whether the headline Runway is to-zero or
  to-`C_min`.
- **Alert level** via the existing `getRunwayAlert` thresholds (≥12 safe / ≥6 warning / ≥3 critical), applied to the
  **pessimistic** scenario's Runway (conservative), not the base. `PENDING HUMAN DETERMINATION`.

### 6.5 Sensitivity handling

Two complementary modes, both `PENDING HUMAN DETERMINATION` on inclusion:

**(i) Tornado (single-lever) — proposed default.** Hold all levers at **base**; sweep each lever `ℓ` across its
`[pessimistic, optimistic]` range (§6.2); record the resulting Runway at each end. Plot `|ΔRunway|` per lever,
sorted descending. This identifies which assumptions the Runway is most sensitive to (typically DSO and revenue
growth, then churn, then cost inflation). Deterministic, cheap, explainable.

**(ii) Two-way grid (optional).** A heat-map of Runway over a 2D grid of the two top tornado levers (e.g., DSO ×
revenue growth), surfacing the "cliff" where Runway collapses.

**(iii) Monte Carlo (optional, advanced).** Sample each lever from a distribution (triangular on its `[pes, opt]`
range, or fitted to history), simulate `N` paths, report **median Runway**, **5th/95th percentile**, and
**P(Runway < 6 months)** (probability of a near-term shortfall). This reuses a seeded RNG — per REV-VAL-01 the repo's
`SeededRandom` is weak and its LHS is broken, so a **new, tested** RNG/LHS should be specified rather than reusing the
valuation one (that would import Class-A defects, §4.6). `PENDING HUMAN DETERMINATION` on whether Monte Carlo ships
and whether it warrants its own RNG.

> **PENDING HUMAN DETERMINATION:** Which sensitivity modes ship. The tornado is the high-value/low-cost default; MC
> is the high-cost option that needs a sound RNG and a stated distribution-fitting policy.

### 6.6 Calibrating base parameters from history

Base (`通常`) should be **data-derived**, not guessed, from the trailing `MonthlyBalance` run (per FIN-DESIGN-01, the
real source). Proposed estimators (all `PENDING HUMAN DETERMINATION` on window/weighting):
- `g_base`: trailing-N (e.g., 6–12) compound monthly revenue growth, **capped** to a sane band to avoid extrapolating
  a spike (e.g., `[−5%, +10%]`/mo). Flag if capped.
- `dso_base`, `dpo_base`, `dio_base`: trailing-N mean of `AR/(Rev·30/365)`, `AP/(COGS·30/365)`, `Inv/(COGS·30/365)`.
  (Subject to the §4.6 category-mapping caveat for revenue/COGS.)
- `churn_base`: if available from `KPIStartup.churnRate` (the KPI model already defines churn/MRR/ARR); else
  estimated from revenue attrition or left as a manual assumption with a `要確認` flag (CrystalBall "uncertain
  isolated" policy).
- `π_base`: wage/CPI index, or trailing-N opex-per-month slope.
- Recency weighting: prefer recent months (exponential or last-3 vs prior-3, cf. the existing
  `calculateBurnRateTrend` recent/prior split) so a deteriorating trend raises base burn.

`PENDING HUMAN DETERMINATION`: estimation windows, caps, and whether manual overrides are allowed (with reason
strings, mirroring the existing `adjustmentReasons` discipline at `runway-calculator.ts:117-125`).

### 6.7 Edge cases & data-quality signaling

| Case | Detection | Handling (proposal) |
|------|-----------|---------------------|
| **No/sparse actuals** (`MonthlyBalance` empty → sample/mock fallback, §4.1/4.6) | `actualsSource ∈ {sample, mock, none}` | **Do not project.** Return `dataQuality.actualsSource` and an empty projection with a `要確認` flag. Never project synthetic data. |
| **Positive operating CF (burn = 0 today)** | `baseBurnRate = 0` under current logic | Engine still runs (investing/financing may still drain cash); Runway may be `∞` — report `∞` honestly, not `999`, and surface the trough. |
| **Cash already ≤ 0 at `t=0`** | `C_0 ≤ 0` | Runway = 0; flag critical; do not divide. |
| **Cash crosses zero then recovers** (one-off inflow) | `min{t: C_t ≤ 0}` then `C_{t+k} > 0` | Report the **first** zero-cross month *and* the trough *and* terminal cash; the static quotient cannot express this. |
| **Funding round inside horizon** | `Fin_k > 0` | Modeled as a month-tagged one-off; show Runway with and without the raise (sensitivity). |
| **Seasonal revenue** (e.g., year-end spike) | historical month-of-year pattern | Apply a seasonal index to `g_t` rather than a flat rate; `PENDING HUMAN DETERMINATION`. |
| **DSO/DPO unreachable** (no AR/AP history, or cash-only business) | `AR_0 ≈ 0` or no history | Fall back to immediate collection/payment (`w_0 = 1`); flag `collectionTiming: 'assumed'`. |
| **Class-A feed defects** (debt excludes overdue; tax P2002/late dates, §4.6) | feed validation | Surface as `dataQuality.warnings` (e.g., `debt_excludes_overdue`, `tax_schedule_unavailable`); do not silently absorb. |
| **Horizon shorter than Runway** | `R_s > H` | Report `R_s` as `> H` (open-ended), not a precise number. |
| **Currency** (multi-currency cash) | `ForeignCurrencyTransaction` present | Project in base currency; flag FX assumption. |

> **PENDING HUMAN DETERMINATION:** Detection thresholds and exact handling per case (e.g., the `C_min` policy floor,
> the materiality of the static-vs-path Runway gap above which to warn).

---

## 7. Target data model (PROPOSED — descriptions only, `PENDING HUMAN DETERMINATION`)

Every item below is a **proposal for a human decision**. Schema additions touch `prisma/schema.prisma` (Class-A) and
are out of bounds to implement here; they are described so the model's persistence dependencies are explicit. None
exists today (§4.5).

**7.1 `ScenarioAssumption` table.** Store per-`(companyId, fiscalYear)` the parameter bundles for the three scenarios
(each lever's value + range + a free-text reason), the `burnBasis`, horizon `H`, and `C_min`. Reuses the
`adjustmentReasons` discipline already in `runway-calculator.ts`. Without this, scenarios are recomputed from scratch
each request and cannot be audited or compared over time. `PENDING HUMAN DETERMINATION`.

**7.2 `CashFlowForecast` table.** Persist a computed projection: `(companyId, fiscalYear, scenario, month)` rows with
`cash, grossBurn, netBurn, collections, payments, payroll, capex, debtSvc, tax, oneOff, financing`, plus a header
row with `runwayToZero, runwayStatic, runwayToBuffer, trough, troughMonth, zeroCashDate`. This is the model CLAUDE.md
§5 *names* but the schema *lacks*. `PENDING HUMAN DETERMINATION` (and reconcile the CLAUDE.md doc gap).

**7.3 Audit link.** Each forecast generation writes the blockchain `AuditLog` (via `logRouteAudit()`/`auditLogger`,
never raw `prisma.auditLog.create()` per project memory) recording assumption-hash + result-hash, so a cached forecast
is tamper-evident. `PENDING HUMAN DETERMINATION`.

**7.4 Scheduler (optional).** A `node-cron` job (alongside `src/jobs/scheduler.ts`) re-running the three scenarios
after the daily journal/trial-balance sync, so the projection stays current. `PENDING HUMAN DETERMINATION`.

> **PENDING HUMAN DETERMINATION:** Whether persistence (7.1–7.4) is in scope for a first cut, or whether scenarios are
> computed on demand only. On-demand avoids schema changes (Class-A) entirely for an MVP; persistence is needed for
> auditability and trend-over-time.

---

## 8. API & response shape (PROPOSED — `PENDING HUMAN DETERMINATION`)

Proposed as a **new** endpoint so the existing `/api/reports/cashflow` response (consumed by `use-cashflow-data.ts`)
is untouched (backward compatible). The existing `runway` field stays; the rich projection is additive.

**Request (new):**
```
GET /api/reports/cashflow/scenarios
    ?fiscalYear=2025
    &horizon=12                 // months; default 12
    &burnBasis=op_investing     // op_only | op_investing | op_investing_financing
    &buffer=0                   // C_min policy floor (¥); Runway-to-buffer variant
    &sensitivity=tornado        // none | tornado | tornado,mc
    &mcPaths=2000               // if mc
```

**Response (proposed shape):**
```jsonc
{
  "fiscalYear": 2025, "horizon": 12, "burnBasis": "op_investing",
  "asOf": "2025-06-30",
  "dataQuality": {
    "actualsSource": "monthly_balance",     // monthly_balance | sample | mock | none
    "actualsMonths": 11,                    // trailing months with real data
    "cappedLevers": ["revenue_growth"],     // base levers that hit a cap (§6.6)
    "warnings": []                          // e.g. "debt_excludes_overdue","revenue_category_misrouted"
  },
  "startPosition": { "cash": 42000000, "receivables": 18000000, "payables": 9500000, "inventory": 6000000,
                     "dso": 61, "dpo": 48, "dio": 18, "ccc": 31 },
  "scenarios": {
    "base":        { /* ScenarioResult */ },
    "pessimistic": { /* ScenarioResult */ },
    "optimistic":  { /* ScenarioResult */ }
  },
  "sensitivity": {
    "tornado": [
      { "lever": "dso",            "runwayAtPessimistic": 7.1,  "runwayAtOptimistic": 14.8, "swing": 7.7 },
      { "lever": "revenue_growth", "runwayAtPessimistic": 8.0,  "runwayAtOptimistic": 15.0, "swing": 7.0 },
      { "lever": "churn",          ... }
    ],
    "monteCarlo": {                       // only if sensitivity includes 'mc'
      "paths": 2000,
      "medianRunway": 11.2, "p5Runway": 6.4, "p95Runway": 18.0,
      "probRunwayBelow6mo": 0.18
    }
  },
  "alert": { "level": "warning", "message": "...", "recommendation": "..." }   // from pessimistic Runway
}
```

**`ScenarioResult` (per scenario):**
```jsonc
{
  "parameters": { "revenueGrowthMo": 0.008, "churnMo": 0.01, "dso": 61, "dpo": 48,
                  "costInflationMo": 0.003, "capexPctOfRevenue": 0.02, "oneOffs": [
                    { "month": 4, "amount": 300000000, "type": "equity_raise", "label": "Series B" } ] },
  "monthly": [
    { "month": 1, "cash": 41500000, "grossBurn": 6100000, "netBurn": 500000,
      "collections": 5600000, "payments": 2100000, "payroll": 3200000, "capex": 100000,
      "debtService": 400000, "tax": 0, "oneOff": 0, "financing": 0 } /* …12 rows */
  ],
  "runwayToZero": 11.4,            // path-based (months); null/Infinity if never within horizon
  "runwayStatic": 9.8,             // C0 / avgNetBurn — the textbook quotient (§3)
  "runwayToBuffer": 8.6,           // months to C_min
  "trough": { "month": 7, "cash": 12500000 },
  "terminalCash": 31000000,
  "avgNetBurn": 4280000,
  "zeroCashDate": "2026-05-30"
}
```

Notes:
- `dataQuality.actualsSource` makes the §4.1 silent-sample-data fallback **visible** — consumers never mistake demo
  numbers for a real projection (same principle as FIN-DESIGN-01 §8).
- Both `runwayToZero` (path) and `runwayStatic` (quotient) are returned so the UI can show the textbook number *and*
  the one-off/trend-aware number, with their gap.
- The existing `use-cashflow-data.ts` hook is **unaffected** (new endpoint); a future hook can layer this on top,
  reusing the `/api/debt/forecast` debt-service data it already pulls (`use-cashflow-data.ts:57-67`).

> **PENDING HUMAN DETERMINATION:** Endpoint path (under `/api/reports/cashflow/*` vs a new `/api/analysis/*`
> namespace), field names, whether `monthly` is paginated/truncated for long horizons, and whether this replaces or
> supplements the existing `runway` object in `/api/reports/cashflow`.

---

## 9. Algorithm sketch (pseudo-code, `PENDING HUMAN DETERMINATION`)

```
function projectScenario(startBS, history, P_s, H, burnBasis):
  C = startBS.cash; AR = startBS.ar; AP = startBS.ap; Inv = startBS.inv
  weights = dsoToWeights(P_s.dso)          # §6.3(b)  collection pattern
  vweights = dpoToWeights(P_s.dpo)         # §6.3(c)  payment pattern
  lagSales = [last 2 months credit sales from history]   # seed for lag in month 1–2
  lagPur   = [last 2 months purchases from history]
  series = []
  for t in 1..H:
    Rev      = RevPrev * (1 - P_s.churn) * (1 + P_s.g)        # §6.3(a)
    S        = creditSalesPct * Rev
    COGS     = Rev * (1 - P_s.gm)
    Pur      = COGS + deltaInv(Inv, P_s.dio, COGS)            # §6.3(c)
    Col      = dot(weights,  [S,  lagSales...])               # §6.3(b)
    Pay      = dot(vweights, [Pur, lagPur...])                # §6.3(c)
    Payroll  = PayrollPrev * (1 + P_s.pi) * (1 + P_s.headcountGrowth)
    OtherOp  = OtherOpPrev * (1 + P_s.pi)
    Tax      = taxForMonth(t, P_s)                            # Class-A feed, §4.6
    Capex    = P_s.capexPctOfRev * Rev + projectOutlay(t, P_s)
    DebtSvc  = debtServiceForMonth(t)                         # Class-A feed, §4.6
    Fin      = financingForMonth(t, P_s)
    OneOff   = oneOffForMonth(t, P_s)
    dC       = Col - Pay - Payroll - OtherOp - Tax - Capex - DebtSvc + Fin + OneOff   # §6.3(f)
    C_next   = C + dC
    AR       = AR + S - Col;  AP = AP + Pur - Pay             # roll WC for next iter
    series.push({month:t, cash:C_next, grossBurn, netBurn(burnBasis), Col, Pay, Payroll, Capex, DebtSvc, Tax, OneOff, Fin})
    C = C_next; RevPrev = Rev; PayrollPrev = Payroll; OtherOpPrev = OtherOp; lagSales.shift.push(S); lagPur.shift.push(Pur)
  return summarize(series, startBS.cash, burnBasis)           # §6.4

function scenariosReport(companyId, fy, opts):
  actuals = fetchBalancesByFiscalYear(companyId, fy)          # balance-loader.ts (real source)
  if actuals empty or source ∈ {sample,mock,none}: return {dataQuality.actualsSource, scenarios:{}, sensitivity:{}}
  startBS = readStartBalance(actuals)                         # cash/AR/AP/Inv from MonthlyBalance
  history = trailingMonthlyPL(actuals)                        # revenue/COGS/payroll/opex
  base    = calibrateBase(history)                            # §6.6
  bundles = { base, pessimistic: downgrade(base), optimistic: upgrade(base) }   # §6.2 coherence
  proj    = { base: projectScenario(...), pessimistic: projectScenario(...), optimistic: projectScenario(...) }
  sens    = opts.sensitivity.includes('tornado') ? tornado(startBS, history, bundles, opts) : null
  mc      = opts.sensitivity.includes('mc')      ? monteCarlo(startBS, history, base, opts)  : null
  return { dataQuality, startPosition, scenarios: proj, sensitivity: {tornado, monteCarlo: mc},
           alert: getRunwayAlert(proj.pessimistic.runwayToZero) }
```

The reusable primitive `dsoToWeights` (DSO target → collection-lag distribution) and `dot` (lagged weighted sum) **do
not exist today** — `src/services/cashflow/**` has no working-capital-timing code (§4.4). Building them is the core of
any implementation. `PENDING HUMAN DETERMINATION`.

---

## 10. Worked example (`PENDING HUMAN DETERMINATION` — illustrative numbers only)

Company: cash `C_0 = ¥42M`, AR `¥18M`, AP `¥9.5M`, revenue `¥6M/mo`, COGS `¥2.4M/mo`, payroll `¥3.2M/mo`, trailing
DSO 61 / DPO 48. Horizon 12 months, `burnBasis = op+investing`.

- **Base (通常):** `g = +0.8%/mo`, `churn = 1%/mo`, DSO 61, DPO 48, cost inflation `+0.3%/mo`, capex `2% of revenue`,
  scheduled debt service `¥0.4M/mo`, no one-offs. Path: cash drifts down gently; avg net burn `≈ ¥4.28M/mo` (a
  one-off tax month dominates the average); **Runway-to-zero `≈ 11.4 mo`**; static quotient `42/4.28 ≈ 9.8 mo`; trough
  `¥12.5M` in month 7 (tax month).
- **Pessimistic (悲観):** `g = −1.5%/mo`, `churn = 2.5%/mo`, **DSO 90** (collections lag an extra month), DPO 40 (pay
  faster), cost inflation `+0.6%/mo`, adverse tax `¥3M` in month 6, capex maintained. Collections lag → cash in
  drops before cost cuts land → **Runway-to-zero `≈ 6.4 mo`**, trough `¥1.2M` in month 6; the static quotient
  (`42/6.9 ≈ 6.1`) is close here *only* because burn is fairly flat — in scenarios with a mid-horizon raise the two
  diverge sharply (see optimistic).
- **Optimistic (強気):** `g = +2%/mo`, `churn = 0.5%/mo`, **DSO 46** (faster collection), DPO 58 (stretch), cost
  inflation `0`, **Series B raise `¥300M` in month 4**, disciplined capex. Path: burn turns net-positive around month
  3, cash infuses in month 4 → **Runway-to-zero `∞`** (never within horizon); but note the **static quotient before
  the raise** would have been `42/2.1 ≈ 20 mo` — illustrating why a path-based Runway that *includes* the one-off is
  the honest number.

Tornado (base, single-lever sweeps) ranks: DSO (swing `≈ 7.7 mo`) ≈ revenue growth (`≈ 7.0 mo`) > churn
(`≈ 3.5 mo`) > cost inflation (`≈ 1.8 mo`) > DPO (`≈ 1.2 mo`). → The model says **collection timing and growth are
the two levers most worth managing** for this company's Runway — exactly the insight the current single-multiplier
"scenario" cannot produce.

This shows: (a) the engine producing a *path* (trough, recovery, one-offs) the static quotient cannot; (b) the three
bundles as coherent stories; (c) sensitivity ranking the levers. All numbers are illustrative placeholders,
`PENDING HUMAN DETERMINATION`.

---

## 11. Reconciliation to the standard definitions (degenerate cases)

The engine is a **generalization** of the textbook formula; the current code's behavior is a special case:

- **Flat-burn degenerate case → static Runway.** Set `g = 0`, `churn = 0`, constant DSO/DPO, `π = 0`, no one-offs,
  no financing, constant capex/debt/tax. Then every `ΔCash_t` is identical `= −B`, so `C_t = C_0 − B·t`, and
  `Runway-to-zero = C_0/B` — **exactly** the standard `Runway = Cash / |NetMonthlyBurn|` (§3) and exactly the current
  `runway-calculator.ts:44` quotient. The static formula is recovered; the engine merely adds the ability to vary
  inputs over time.
- **Operating-only burn degenerate case → current `calculateRunway`.** Set `burnBasis = op_only` and ignore
  capex/debt/financing; the engine's net burn reduces to `−OperatingCF`, matching `runway-calculator.ts:25-33`. The
  design thus subsumes today's logic and makes its (currently hardcoded, §4.4) burn-basis choice an explicit parameter.
- **No-scenario degenerate case → today's dead scenarios.** Set all three bundles equal (as the live route does by
  passing no options, §4.2); all three `ScenarioResult`s coincide — i.e., today's behavior is the "no real scenario"
  special case. The design's value is precisely that the bundles differ.

This reconciliation is the formal argument that the proposal is a **superset** of the current behavior, not a
replacement with different semantics — important for migration. `PENDING HUMAN DETERMINATION` on migration
(broadcast the richer object; keep `runway` as the flat-burn alias for one release).

---

## 12. Risks, assumptions, open questions (all `PENDING HUMAN DETERMINATION`)

1. **Garbage-in on the live route.** Until §4.1 is fixed (cashflow route reads `MonthlyBalance`), any projection is
   synthetic. Decide whether the feature is gated on the rewire.
2. **Revenue/COGS misrouting.** DSO/DPO/revenue-growth calibration depends on reliable revenue & COGS from
   `MonthlyBalance`; FIN-DESIGN-01 §4.4 shows these are misrouted today. Decide whether to gate on that fix.
3. **Class-A feed defects propagate.** Debt (excludes overdue; sync by `issue_date`) and tax (P2002; late dates)
   feed the engine with known errors (§4.6, REV-TAX-01). Decide whether to surface warnings only or block.
4. **Burn-basis choice.** Operating-only vs op+investing vs op+inv+fin changes Runway materially (a capex-heavy
   company looks healthy on op-only). Decide the default and whether all three surface.
5. **Monte Carlo RNG.** If §6.5(iii) ships, the repo's `SeededRandom` is weak/broken (REV-VAL-01); a new tested RNG
   + LHS is needed. Decide whether MC is worth that cost.
6. **Calibration caps & windows.** Every §6.6 estimator (growth cap, DSO window, recency weight) is a placeholder;
   bad calibration → bad base case. Decide defaults and whether manual overrides (with reasons) are allowed.
7. **Runway-to-zero vs Runway-to-buffer.** Policy `C_min` may be the more actionable headline. Decide.
8. **Persistence vs on-demand.** §7.1–7.4 require Class-A schema changes; on-demand avoids them for an MVP but loses
   auditability/trend. Decide scope.
9. **No new external dependencies / no copied code** (per task constraints). The engine is implementable with
   existing Prisma + existing balance-loader + existing `MonthlyBalance`; the only "new" math (DSO→weights,
   lagged-dot, seeded RNG for MC) is straightforward to implement in-repo. It adds no libraries.

---

## 13. Suggested phasing (`PENDING HUMAN DETERMINATION` — sequencing only, not a commitment)

- **Phase 0 (trust the base):** Rewire `/api/reports/cashflow` to read `MonthlyBalance` (fix §4.1); surface
  `dataQuality.actualsSource`; standardize one burn basis (fix §4.4 inconsistency). *Non-Class-A path
  (`src/app/api/reports/**`, `src/services/cashflow/**`), but still out of bounds to implement in this audit task.*
- **Phase 1 (constant-burn + one-offs):** Replace the dead multiplier-scenarios with three bundles that at minimum add
  month-tagged one-offs and a burn-basis switch to the static quotient — a cheap upgrade that already beats today's
  identical-three-scenarios output. No new model needed; on-demand only.
- **Phase 2 (direct-method engine):** Implement §6.1–6.4 (DSO/DPO lag patterns, monthly rollforward, path Runway,
  trough). This is where Runway becomes trend- and one-off-aware.
- **Phase 3 (sensitivity + persistence):** §6.5 tornado (cheap) → optional Monte Carlo (with a sound RNG); §7.1–7.4
  persistence + audit link + scheduler (Class-A schema).

> **PENDING HUMAN DETERMINATION:** Whether and when each phase proceeds. This is a recommendation for a human, not a
> plan to execute.

---

## 14. References

- Standard FP&A / VC definitions: **gross burn** (total cash outflows), **net burn** (outflows − inflows = −ΔCash when
  negative), **cash runway = cash ÷ |net monthly burn|** (months to zero at constant burn) — the definitions this
  model generalizes (§3, §11).
- Treasury **direct-method ("receipts and disbursements") cash forecasting**: collections modeled from a revenue plan
  × collection lag; payments from a purchases plan × payment lag — the basis for §6.1/6.3.
- Working-capital timing: **DSO** (`AR ÷ (Rev÷365)`), **DPO** (`AP ÷ (COGS÷365)`), **DIO**, **CCC = DSO + DIO − DPO**
  — the levers in §6.2/6.3.
- Sensitivity: **tornado** (single-lever swing) and **Monte Carlo** (path distribution, P(shortfall)) — §6.5.
- Repo evidence: `src/services/cashflow/calculator.ts`; `src/services/cashflow/cash-position.ts`;
  `src/services/cashflow/runway-calculator.ts`; `src/app/api/reports/cashflow/route.ts`;
  `src/hooks/reports/use-cashflow-data.ts`; `src/services/report/balance-loader.ts`;
  `src/types/index.ts` (`RunwayCalculation:170`, `CashFlowStatement:102`, `CashPositionMonthly:147`);
  `src/types/reports.ts` (`RunwayData:226`); `src/types/reports/cashflow.ts`;
  `python-service/app/services/cashflow_calculator.py`; `prisma/schema.prisma` (`MonthlyBalance:377`; no
  `Forecast`/`Scenario`/`Assumption` model).
- Cross-feature carry-over: [FIN-DESIGN-01](./fin-design-01-variance-attribution.md) §4.2 (actuals live in
  `MonthlyBalance`, sample fallback) and §4.4 (revenue/COGS category misrouting); project memory REV-TAX-01 (debt &
  tax defects), REV-VAL-01 (weak `SeededRandom`/LHS).

---

*End of proposal. All content above is analysis for a human reviewer. Nothing is approved, decided, or signed off.
Every conclusion is `PENDING HUMAN DETERMINATION`.*
