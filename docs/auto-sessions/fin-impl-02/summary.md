# FIN-IMPL-02 — Session Summary

3-scenario (通常 / 悲観 / 強気) cash-flow + Runway engine added to
`src/services/cashflow`. Additive only; no Class-A path touched; no new deps.

## What changed

| File | Change |
|---|---|
| `src/services/cashflow/scenario-engine.ts` | **new** — Zod-validated `Result`-returning engine: `projectScenario`, `runScenarioEngine`, `deriveRunRateFromCashFlows`, schemas/types, `DEFAULT_SCENARIO_PRESETS` |
| `src/services/cashflow/calculator.ts` | + `deriveBurnRunRate` (cited gross/net burn from indirect-method CF) |
| `src/services/cashflow/runway-calculator.ts` | + `computeRunwayMonths` (cited runway = cash ÷ net burn) |
| `tests/unit/services/cashflow/scenario-engine.test.ts` | **new** — golden + property + edge (39 tests) |
| `tests/unit/services/cashflow/calculator-burn.test.ts` | **new** — `deriveBurnRunRate` (8 tests) |
| `docs/proposals/fin-design-02.md` | **new** — cited methodology (the proposal referenced by the task did not previously exist) |

## Verification

- `corepack pnpm exec vitest run tests/unit/services/cashflow/` → **140 passed** (incl. pre-existing runway/calculator/cash-position tests — no regressions).
- `corepack pnpm exec eslint --max-warnings=0` on all changed files → **clean**.
- `corepack pnpm exec tsc --noEmit` → **no errors** in changed files.
- `node scripts/autopm_verify.mjs --changed-only` → **exit 0** (run at session end).

## Model summary (per scenario, per month `t`)

```
revenueScale   = (1+g)^t × (1−churn)^t
billedRevenue  = baseMonthlyInflow × revenueScale
AR(t)          = billedRevenue × dsoDays / (365/12)
grossInflow    = billedRevenue − ΔAR                 (cash collected)
grossOutflow   = baseMonthlyOutflow × (1+π)^t
netOperating   = grossInflow − grossOutflow
netBurn        = max(0, −netOperating)
endingCash(t)  = endingCash(t−1) + netOperating + oneOff(t)
runway         = currentCash / avgNetBurn  (∞ if avgNetBurn ≤ 0)
```

Full citations and the `PENDING HUMAN DETERMINATION` list are in
`docs/proposals/fin-design-02.md`.

---

## PR body (for the human-review-required PR)

> **Labels required:** `human-review-required`, `do-not-auto-merge`
> This is financial output — do not let it auto-merge.

```markdown
## FIN-IMPL-02 — 3-scenario cash-flow + Runway engine (通常/悲観/強気)

Adds a scenario engine to `src/services/cashflow` producing base / pessimistic /
optimistic projections for cash position, gross burn, net burn, and runway, each
parameterised by revenue growth, DSO, churn, cost inflation, and one-offs.

### ⚠️ Human review required — verify every formula/assumption
This is **financial output**. Every definition below is standard but the
judgemental defaults must be confirmed before the numbers are trusted.

**Standard definitions (cited)**
- Net burn   = `max(0, −net operating cash flow)`            — Investopedia "Burn Rate"
- Gross burn = total operating cash outflow (spend)          — Investopedia/Carta
- Runway     = `cash ÷ net burn` (months; ∞ if not burning)  — Investopedia "Cash Runway"
- DSO        = `(AR / revenue) × days` ⇔ `AR = revenue × DSO / days`; cash collected = `revenue − ΔAR` — CFA / indirect method
- Revenue path: `revenue_t = revenue_0 × (1+g)^t × (1−churn)^t`
- Cost path:    `cost_t    = cost_0 × (1+π)^t`
- `DAYS_PER_MONTH = 365/12`

**Judgemental — `PENDING HUMAN DETERMINATION` (defaults are conservative)**
1. Opening AR(0) defaults to **steady-state** (`baseInflow × DSO / DAYS`) so ΔAR
   reflects only the ramp; override via `openingReceivables`.
2. Gross burn from indirect-method CF is an **upper-bound proxy** (non-cash
   add-backs classify as inflow). Net burn is exact.
3. One-offs are **excluded from burn/runway** (operating-only); they move cash.
4. Runway uses the **forward-looking horizon average**, not the trailing history.
5. `DEFAULT_SCENARIO_PRESETS` are **uncalibrated** starting points, not forecasts.
6. Cost inflation may be negative (cost cuts); revenue growth floored at −0.99.

**Behaviour to confirm**
- Operating runway vs actual exhaustion can differ: a one-off outflow runs cash
  to zero *before* the operating runway suggests. Both are reported deliberately.
- With non-zero DSO, a shrinking (pessimistic) scenario **releases working
  capital** and can momentarily show more cash than base — a real effect, not a bug.

### Scope & safety
- Additive only. New file `scenario-engine.ts`; `+computeRunwayMonths` in
  `runway-calculator.ts`; `+deriveBurnRunRate` in `calculator.ts`.
- No Class-A path modified (schema/auth/crypto/audit/conversion/valuation/tax/
  kpi/debt/deferred-accrual/journal-proposal/freee + their APIs untouched).
- No new dependencies. All public entries return `Result<T, AppError>` with Zod
  `safeParse` validation.
- Tests: 47 new (golden + property + edge); full cashflow suite 140 green.

### Quality gate
`node scripts/autopm_verify.mjs --changed-only` → exit 0.

Methodology: `docs/proposals/fin-design-02.md`.
```
