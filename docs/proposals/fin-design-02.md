# FIN-DESIGN-02 — 3-Scenario Cash-Flow + Runway Engine (通常 / 悲観 / 強気)

**Status:** Implemented (FIN-IMPL-02). **Human review required** — every formula and
judgemental default below must be verified by the owner before the output is trusted.

**Scope:** `src/services/cashflow/scenario-engine.ts` (new), with strengthening of
`src/services/cashflow/calculator.ts` and `src/services/cashflow/runway-calculator.ts`.
Additive only. No Class-A path touched. No new dependencies.

This document is the cited methodology referenced by the implementation. It was
authored as part of FIN-IMPL-02 (no prior `fin-design-02` proposal existed).

---

## 1. Goal

Produce **base / pessimistic / optimistic** forward projections for:

- cash position (month-by-month roll-forward),
- gross burn,
- net burn,
- runway (months to zero cash),

each parameterised by five levers: **revenue growth, DSO, churn, cost inflation, one-offs**.

All public entry points return `Result<T, AppError>` and validate input with Zod
`safeParse`. The projector is pure and deterministic given explicit base numbers,
so every output is hand-reproducible.

---

## 2. Standard definitions (cited)

| Metric | Formula | Source |
|---|---|---|
| **Net burn** | `max(0, −net operating cash flow)` | Investopedia, "Burn Rate" |
| **Gross burn** | total operating cash outflow (spend) | Investopedia / Carta, "Gross Burn" |
| **Runway** | `cash balance ÷ net burn rate` (months; ∞ if not burning) | Investopedia, "Cash Runway" |
| **DSO** | `DSO = (AR ÷ revenue) × days` ⇔ `AR = revenue × DSO / days` | CFA Institute; indirect method |
| **Cash collected** | `revenue − ΔAR` | Indirect-method working-capital identity |
| **Revenue path** | `revenue_t = revenue_0 × (1+g)^t × (1−churn)^t` | Standard compounding + SaaS churn |
| **Cost path** | `cost_t = cost_0 × (1+π)^t` | Standard period compounding |

`DAYS_PER_MONTH = 365 / 12 ≈ 30.4167` (365-day year over 12 months).

---

## 3. Monthly cash waterfall (per scenario, per projected month `t`)

```
revenueScale      = (1 + g)^t × (1 − churn)^t
billedRevenue(t)  = baseMonthlyInflow × revenueScale
AR(t)             = billedRevenue(t) × dsoDays / DAYS_PER_MONTH
ΔAR(t)            = AR(t) − AR(t−1)
dsoCashDrag(t)    = −ΔAR(t)                       // ≥0 consumes cash
grossInflow(t)    = billedRevenue(t) + dsoCashDrag(t)   // = revenue − ΔAR (cash collected)
grossOutflow(t)   = baseMonthlyOutflow × (1 + π)^t
netOperating(t)   = grossInflow(t) − grossOutflow(t)
oneOff(t)         = Σ one-offs scheduled for month t   // signed
netCash(t)        = netOperating(t) + oneOff(t)
grossBurn(t)      = grossOutflow(t)
netBurn(t)        = max(0, −netOperating(t))      // operating only; one-offs excluded
endingCash(t)     = endingCash(t−1) + netCash(t)   // endingCash(0) = currentCash
```

### Aggregates

- `avgGrossBurn`, `avgNetBurn` = mean over the horizon months.
- **Runway** = `computeRunwayMonths(currentCash, avgNetBurn)` = `currentCash / avgNetBurn`
  (∞ when `avgNetBurn ≤ 0`). This is a **forward-looking operating runway**.
- **Exhaustion** = first month where `endingCash ≤ 0`, reported fractionally
  (`zeroCashMonth`, 1-indexed; `0` means already exhausted at the start) with a
  projected `zeroCashDate`.

> **Important behavioural note:** runway is **operating-based** (excludes one-offs
> and is anchored to the run-rate), while `zeroCashMonth` is the **actual cash
> crossing** (includes one-offs). A large one-off outflow can therefore make the
> firm run out of cash *before* its operating runway suggests. Both are reported
> deliberately — see GOLDEN test "one-off outflow affects cash, not burn".

---

## 4. Judgemental choices — `PENDING HUMAN DETERMINATION`

Each defaults to the most conservative / most defensible option. The owner should
confirm or override.

1. **Opening AR(0).** Defaults to *steady-state*: `AR(0) = baseMonthlyInflow × dsoDays / DAYS_PER_MONTH`,
   so the `ΔAR` line captures only the working-capital drag from the **ramp**, not a
   spurious one-time build from zero. Override via `openingReceivables`. *Conservative
   rationale:* neither punitive (AR from 0) nor flattering (ignore WC).
2. **Gross-burn proxy from indirect-method CF.** `deriveBurnRunRate` partitions the
   operating components by sign; non-cash add-backs (depreciation) classify as inflow,
   so gross burn is an **upper-bound proxy** for true direct cash outflows. **Net burn
   is exact regardless.** Where a direct-method collection/payment split exists, prefer it.
3. **One-offs excluded from burn/runway.** Burn is operating-only by definition;
   one-offs (capex, fundraising, tax) move cash but are not recurring spend.
4. **Runway averaging window** = full projection horizon (forward-looking run-rate),
   distinct from the historical-trailing `calculateRunway`.
5. **Default scenario presets** (`DEFAULT_SCENARIO_PRESETS`) are uncalibrated starting
   points (pessimistic is deliberately punitive), not forecasts.
6. **Cost inflation** is permitted to be negative (deliberate cost reduction). Revenue
   growth is floored at `−0.99` to avoid sign-flip pathology from >100% contraction.

---

## 5. Validation (Zod)

- `revenueGrowthMonthly ∈ [−0.99, 50]`, `dsoDays ∈ [0, 365]`,
  `monthlyChurnRate ∈ [0, 1]`, `costInflationMonthly ∈ [−0.99, 50]`,
  `horizonMonths ∈ [1, 120]`, non-negative base inflow/outflow & opening AR.
- `deriveRunRateFromCashFlows([])` → `VALIDATION_ERROR` (cannot infer a run-rate from
  zero data points).

---

## 6. Golden / property tests

`tests/unit/services/cashflow/scenario-engine.test.ts` and `calculator-burn.test.ts`
(47 + existing cashflow suite, all green):

- **GOLDEN base** — neutral levers, exact-integer ending-cash series, runway = 5.0,
  exhaustion at month 5.
- **GOLDEN one-off** — discrete outflow hits cash but not burn; runway 5.0 vs actual
  exhaustion 3.5 months.
- **GOLDEN cash-positive** — inflow > outflow ⇒ netBurn 0 ⇒ runway ∞, no exhaustion.
- **GOLDEN DSO** — steady-state DSO ⇒ zero drag; growth ramp ⇒ `grossInflow < billedRevenue`.
- **Monotonicity** — DSO / churn / inflation each never improve cash; cash-collected
  identity `grossInflow = billedRevenue − ΔAR` holds every month.
- **Edge** — zero / negative cash, zero burn, 100% churn, horizon = 1, explicit opening AR.
- **Ordering** (DSO-free scenarios) — optimistic ≥ base ≥ pessimistic on cash, runway,
  exhaustion. (With non-zero DSO a shrinking scenario can release working capital, so
  strict cash ordering is only asserted when DSO = 0 — a documented real effect.)

---

## 7. Files

| File | Change |
|---|---|
| `src/services/cashflow/scenario-engine.ts` | **new** — engine, Zod schemas, types, presets, `deriveRunRateFromCashFlows` |
| `src/services/cashflow/calculator.ts` | + `deriveBurnRunRate` (cited gross/net burn) |
| `src/services/cashflow/runway-calculator.ts` | + `computeRunwayMonths` (cited runway) |
| `tests/unit/services/cashflow/scenario-engine.test.ts` | **new** — golden + property + edge |
| `tests/unit/services/cashflow/calculator-burn.test.ts` | **new** — `deriveBurnRunRate` |
| `docs/proposals/fin-design-02.md` | this methodology |
