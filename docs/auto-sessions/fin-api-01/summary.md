# FIN-API-01 — API endpoints for variance / scenarios / managerial analysis

**Status:** IMPLEMENTED — ready for human review.
**⚠️ This is financial output. The PR MUST be labelled `human-review-required` and
`do-not-auto-merge`. The complete formula/assumption list for owner verification is
in §3 below (also intended as the PR body).**

## 1. What was built

Three new non-Class-A route handlers under `src/app/api/analysis/**`, each backed by a
pure, `Result<T,E>`-returning, Zod-`safeParse`-validated service module. No Class-A path
was modified; no new dependency added; journal/ledger data is accepted as read-only input
only.

| Endpoint | Service | Purpose |
|----------|---------|---------|
| `POST /api/analysis/variance` | `src/services/analysis/variance-attribution.ts` | Budget-variance driver attribution (account + journal level) |
| `POST /api/analysis/cashflow-scenario` | `src/services/analysis/cashflow-scenario.ts` | Cash what-if projection + runway per scenario |
| `POST /api/analysis/managerial` | `src/services/analysis/managerial-accounting.ts` | Cost-Volume-Profit (break-even, CM, DOL) |

**Routes** reuse the existing `/api/analysis/financial` pattern: `getAuthUser` (401) →
`parseJsonSafely` (400) → `checkInputSize` (400) → `checkBoundaryLimits` (400) → service
`Result` (400 on validation failure) → `logRouteAudit` → `withRateLimit` + `withTimeout`
+ `addSecurityHeaders`.

## 2. Tests (real assertions, no fake green)

- Golden unit tests (hand-computed numbers + edge cases): `tests/unit/services/analysis/`
  - `variance-attribution.test.ts` — sign convention, new_unbudgeted/absence/run_rate,
    outlier+run_rate+unreconciled split, z-score, reconciliation identity, materiality/
    immaterial bucket, validation.
  - `cashflow-scenario.test.ts` — burn-rate, runway interpolation (5.0 / 6.25 / 4.1667 mo),
    cash-positive→null, custom adjustments/horizon, validation.
  - `managerial-accounting.test.ts` — CM/break-even/target-profit/MoS/DOL, loss-making
    per-unit, at-break-even, zero-fixed-cost, validation.
- Integration tests (real POST handler, real service): `tests/integration/api/analysis-*.test.ts`
  — 401 (no cookie), 400 (Zod / malformed JSON / bad ordering), 200 (real computed output).

**Totals: 6 files, 46 tests, all passing.**

## 3. Formula / assumption list (for human review — PR body)

Every formula is cited in-code at its definition. Judgemental treatments are marked
`// PENDING HUMAN DETERMINATION` and default to the most conservative option.

### 3.1 Variance attribution (`/api/analysis/variance`)

| # | Formula / rule | Reference |
|---|----------------|-----------|
| V1 | `variance = actual − budget` (static-budget, Level 1) | Horngren, Datar & Rajan, *Cost Accounting* |
| V2 | Favourable when variance increases operating income: revenue `variance ≥ 0 → F`; expense `variance ≤ 0 → F` | Horngren (sign convention) |
| V3 | `variancePct = variance / budget × 100` (null when budget = 0) | — |
| V4 | `achievementRate = actual / budget × 100` (**null when budget = 0**, not 0 — corrects existing misleading behaviour) | **PENDING HUMAN DETERMINATION** |
| V5 | Materiality: `\|variance\| > max(absoluteFloor, pctOfRevenue × totalRevenue)`; defaults `absoluteFloor=0`, `pct=0.05` | Garrison; **PENDING HUMAN DETERMINATION** (thresholds) |
| V6 | Drivers: `new_unbudgeted` (budget=0, actual≠0), `absence` (budget>0, actual=0), `outlier` (\|z\|≥threshold), `run_rate` (residual), `unreconciled` (actual − Σ journal) | methodology §6.1 |
| V7 | Journal signing: expense debit=+/credit=−; revenue credit=+/debit=− | methodology §6.4 step 1 |
| V8 | M0 expected amount = `budget / \|J\|`; `deviation = signedAmount − expected` | methodology §6.4 (M0) |
| V9 | `z = (signedAmount − mean) / σ`; population σ (÷N); outlier threshold default **2σ** | **PENDING HUMAN DETERMINATION** (cutoff) |
| V10 | Reconciliation identity enforced: `outlier + run_rate + unreconciled = variance` (sub-yen tolerance) | methodology §6.5 |
| V11 | Summary `operatingIncome = revenue − expenses`; `favorable = OI.variance ≥ 0` | — |

**PENDING HUMAN DETERMINATION (variance):** materiality thresholds (V5); outlier z-cutoff
(V9); M0 as the only expected-amount model — M1/M2/M3 need data the schema does not
persist (partner/segment/quantity; see `fin-design-01` §7); `timing`/`FX`/`mix` drivers are
**not** computed (no persisted dimensions) and are documented as such.

### 3.2 Cash-flow scenario (`/api/analysis/cashflow-scenario`)

| # | Formula / rule | Reference |
|---|----------------|-----------|
| C1 | `baseMonthlyNet = mean(monthlyNetCashFlows)` | — |
| C2 | `burnRate = \|monthlyNet\|` when `monthlyNet < 0`, else 0 | standard "cash runaway" |
| C3 | `monthlyNet_scenario = baseMonthlyNet × adjustment` | — |
| C4 | `runwayMonths = (crossingMonth − 1) + \|beginningCash\| / \|monthlyNet\|` (interpolated); `null` if never crosses within horizon | standard "months of runway" |
| C5 | Projection: `endingCash_t = beginningCash_t + monthlyNet` (rolls forward) | Garrison (cash-budget projection) |
| C6 | Alert thresholds reused from `runway-calculator.getRunwayAlert` (≥12 safe, ≥6 warning, ≥3 critical) | reused module |

**PENDING HUMAN DETERMINATION (cashflow):** adjustment semantics (C3 — multiplier on net
cash flow; for a burning company `>1` = worse); defaults `optimistic=0.8, realistic=1,
pessimistic=1.2`; horizon default 12 months. **Decision (documented):** user what-if is NOT
routed through `calculateRunway`'s `[0.5, 2.0]` clamp + reason-required guard (a product
guard, not a formula) — this module owns the math; only `getRunwayAlert` is reused.

### 3.3 Managerial CVP (`/api/analysis/managerial`)

| # | Formula / rule | Reference |
|---|----------------|-----------|
| M1 | `CMPerUnit = sellingPrice − variableCostPerUnit` | Garrison; Horngren |
| M2 | `CMRatio = CMPerUnit / sellingPrice` | Garrison |
| M3 | `breakEven(units) = fixedCosts / CMPerUnit` (null if `CMPerUnit ≤ 0`) | Garrison |
| M4 | `breakEven(sales) = fixedCosts / CMRatio` (null if `CMRatio ≤ 0`) | Garrison |
| M5 | `targetProfit(units) = (fixedCosts + targetProfit) / CMPerUnit` | Garrison |
| M6 | `marginOfSafety = actualSales − breakEvenSales`; `% = MoS / actualSales` | Garrison |
| M7 | `operatingLeverage (DOL) = contributionMargin / operatingIncome` (null if `operatingIncome ≤ 0`) | Garrison |

**PENDING HUMAN DETERMINATION (managerial):** mathematically-undefined results (break-even
when price ≤ variable cost; DOL at/below break-even) are returned as `null` + warning
rather than erroring (conservative). Assumes linear CVP within the relevant range.

## 4. Definition of Done — evidence

```
$ node scripts/autopm_verify.mjs --changed-only   # exit 0
  typecheck : ok, 0 relevant errors
  eslint    : ok, 0 warnings on all 12 changed files
  vitest    : ok, 6 files / 46 tests passed
```

Golden tests pass (hand-computed); integration tests exercise the real handler.

## 5. Files added

```
src/services/analysis/variance-attribution.ts
src/services/analysis/cashflow-scenario.ts
src/services/analysis/managerial-accounting.ts
src/app/api/analysis/variance/route.ts
src/app/api/analysis/cashflow-scenario/route.ts
src/app/api/analysis/managerial/route.ts
tests/unit/services/analysis/variance-attribution.test.ts
tests/unit/services/analysis/cashflow-scenario.test.ts
tests/unit/services/analysis/managerial-accounting.test.ts
tests/integration/api/analysis-variance.test.ts
tests/integration/api/analysis-cashflow-scenario.test.ts
tests/integration/api/analysis-managerial.test.ts
```

## 6. Action required from the PR owner

1. **Do not auto-merge.** Verify every formula in §3 against the cited standard.
2. Confirm the `PENDING HUMAN DETERMINATION` defaults (materiality, z-cutoff, scenario
   adjustments, horizon) before trusting any number in production.
3. The endpoints compute from **caller-supplied** actuals/budgets/journals/cashflows. They
   do NOT read `Journal`/`MonthlyBalance`/`Budget` from the DB — that wiring (and the
   account-key crosswalk + category-mapping fixes in `fin-design-01` §7) is intentionally
   out of scope for this task and remains `PENDING HUMAN DETERMINATION`.

## 7. ⚠️ MERGE NOTE — managerial-accounting overlaps FIN-IMPL-03 (dedup required)

This branch (`feature/auto/fin-api-01`) was cut from `ad1382b`, which **predates** FIN-IMPL-03
(merged to `master` as `ce8db45`, PR #87). FIN-IMPL-03 already shipped
**`src/services/analytics/managerial-accounting.ts`** — a CVP superset exporting
`classifyCostBehavior`, `buildCVPAggregateFromProfitLoss`, `calculateContributionMargin`,
`calculateBreakEvenPoint`, `analyzeCVP`, `analyzeSegmentProfitability`. It did **not** expose
any of it via an API route (master's `api/analysis/` has only benchmark/financial/ratios/report).

Consequence: my **`src/services/analysis/managerial-accounting.ts`** is a logical duplicate of
FIN-IMPL-03's module (different directory — no file conflict at merge, but two CVP engines).

**My `variance-attribution` and `cashflow-scenario` services are genuinely new** (master has only
their design docs `fin-design-01` / `fin-design-02`, no implementation) — no overlap.

*Caveat:* a separate `fin-impl-02` branch reportedly added `src/services/cashflow/scenario-engine.ts`;
it is **not** on master at this branch's base, so no current overlap — but if it lands before this PR,
the reviewer should similarly prefer it over `cashflow-scenario.ts`.

**Recommended dedup at merge time (human):** replace `src/services/analysis/managerial-accounting.ts`
with a thin wrapper over `@/services/analytics/managerial-accounting`'s `analyzeCVP`, keeping the
`/api/analysis/managerial` route + its integration test. The route itself is net-new value
(managerial CVP was previously unexposed). This could not be done in-branch because FIN-IMPL-03 is
not in this branch's base and merges/commits are framework-owned.

