# FIN-IMPL-01 — Journal-Level Budget-Variance Attribution (予実要因分析)

**Status:** Implementation complete. Verify gate green.
**⚠️ FINANCIAL OUTPUT — human review required before merge.**

---

## ⚠️ PR Labels (REQUIRED — do NOT auto-merge)

This is financial output. The PR for this branch **MUST** be labelled:

- `human-review-required`
- `do-not-auto-merge`

Both labels exist in the repo. **Do NOT let this PR auto-merge.** The owner must verify every
formula and assumption listed below (§"Formula list", §"Assumptions / PENDING HUMAN
DETERMINATION") before merge. If the automation framework defaults to `auto-merge`, override
it with `do-not-auto-merge`.

---

## What was implemented

Implements the methodology in `docs/proposals/fin-design-01-variance-attribution.md` (Phase 1 +
Phase 2 of its suggested phasing): account-level driver decomposition (Layer A) and journal-level
attribution with M0 expected amounts + reconciliation gap (Layer B). Journals are read-only inputs;
all computation is in the non-Class-A budget service. No Class-A path was modified.

### Files

| File | Change |
|------|--------|
| `src/services/budget/variance-attribution.ts` | **NEW** — pure attribution core. Types, Zod schemas, `attributeVariance()` (returns `Result<T,E>`), and helpers. No Prisma/I/O. |
| `src/services/budget/variance-attribution-loader.ts` | **NEW** — account-key resolver, journal→account resolution, `prepareAttributionInput()` (pure), and `computeVarianceAttribution()` (async, reads Budget+Journal+AccountItem read-only, returns `Result`). |
| `src/services/budget/detailed-actual-vs-budget.ts` | **STRENGTHENED** — added `favorable: boolean\|null` (§6.2 sign convention) to `StageLevelComparison` and `AccountLevelComparison`. Additive; no existing field/test changed. |
| `tests/unit/services/budget/variance-attribution.test.ts` | **NEW** — 30 golden tests, hand-computed expected numbers + edge cases + reconciliation-identity property. |
| `tests/unit/services/budget/variance-attribution-loader.test.ts` | **NEW** — resolver, journal resolution, `prepareAttributionInput`, and async `computeVarianceAttribution` (mocked DB). |
| `tests/unit/services/budget/detailed-actual-vs-budget.test.ts` | **STRENGTHENED** — added favorable-classification assertions. |

### Verification

`node scripts/autopm_verify.mjs --changed-only` → **exit 0**
(typecheck 0 errors, eslint 0 warnings, 68 tests pass across the 3 resolved test files;
170 tests pass in the full budget suite).

---

## Architecture

Pure core + thin DB loader, so the attribution math is fully testable with hand-computed numbers
and never coupled to Prisma mocks:

- `attributeVariance(input, options)` — pure. Validates input with Zod `safeParse`; returns
  `Result<VarianceAttribution, AppError>`. Does the variance/driver/ranking/reconciliation math.
- `prepareAttributionInput({actuals, budgets, journals, accountItems, ...})` — pure. Builds the
  name→account resolver, resolves journals to P&L accounts (debit/credit side), unions actuals ∪
  budgets into per-account inputs.
- `computeVarianceAttribution({companyId, fiscalYear, month, actuals, options})` — async. Loads
  Budget + Journal + AccountItem (read-only), delegates to the two pure functions, returns `Result`.

### Reconciliation identity (enforced by construction, asserted in tests)

```
StaticVariance_a = (Σ deviation_j) + ReconciliationGap_a
  deviation_j       = signedAmount_j − expected_j
  expected_j        = Budget_a / |J_a|            (M0; Σ expected_j = Budget_a when |J_a|>0)
  ReconciliationGap = Actual_a − Σ signedAmount_j
```

So `Σ driver amounts (incl. unreconciled) = variance` and `Σ pctOfVariance = 100` (signed). Both
are asserted as golden/property tests.

---

## Formula list (for owner verification)

Every formula below is cited to a standard definition or to the proposal section. Verify each.

| # | Formula | Citation |
|---|---------|----------|
| 1 | `variance = actual − budget` | Static-budget (Level 1) variance — Horngren/Datar/Rajan, *Cost Accounting*; proposal §3 |
| 2 | Favorable when variance increases operating income: revenue/profit over budget = F; expense under budget = F; `null` when variance = 0 | Standard sign convention; proposal §3, §6.2 |
| 3 | `signedAmount = side==='credit' ? +amount : −amount` (revenue); `side==='debit' ? +amount : −amount` (expense) | Double-entry (credit↑revenue, debit↑expense); proposal §6.4 step 1 |
| 4 | `expected = budget / |J_a|` (M0 uniform spread) | Proposal §6.4 step 2, model M0 |
| 5 | `deviation = signedAmount − expected` | Proposal §6.4 step 3 |
| 6 | `variance = Σ deviation_j + unreconciled`, `unreconciled = actual − Σ signedAmount_j` | Proposal §6.5 reconciliation identity |
| 7 | `z = (x − μ) / σ` over the account's signed journal amounts (population stddev); `null` when `n<2` or `σ=0` | Proposal §6.4 step 3 (outlier flagging) |
| 8 | `materialityThreshold = max(absoluteFloor, pctOfRevenue × totalRevenue)`; account material when `|variance| ≥ threshold` | Proposal §6.2 |
| 9 | Driver precedence per journal: `new_unbudgeted` (budget=0) > `outlier` (`|z| ≥ threshold`) > `timing` (period-boundary date) > `run_rate` (residual) | Proposal §6.1, §6.4 |
| 10 | `driverAmount = Σ deviation_j for j in driver`; `Σ driverAmounts + unreconciled = variance` | Proposal §6.4 step 5, §6.5 |
| 11 | `contributionPct = deviation / variance × 100`; `pctOfVariance = amount / variance × 100` (both signed); `Σ pctOfVariance = 100` | Proposal §6.4 step 3 / §8 |
| 12 | `achievementRate = actual / budget × 100`, `null` when `budget = 0` | Proposal §6.2 |
| 13 | `variancePct = variance / budget × 100`, `null` when `budget = 0` | Proposal §6.2 |
| 14 | `unreconciledPct = unreconciled / max(|actual|, |journalSum|) × 100`, `null` when denominator 0 | Proposal §6.5 / §8 |
| 15 | `journalAttributionConfidence = 'low'` when `|unreconciled| / max(|actual|, |budget|, 1) > unreconciledTolerancePct`, else `'high'` | Proposal §6.5 |
| 16 | Edge cases: immaterial → aggregated (not exploded to journals); `n=0 & actual≈0` → `absence`; `n=0 & actual material` → `unreconciled`; `budget=0 & actual≠0` → `new_unbudgeted` | Proposal §6.2, §6.3 |
| 17 | `budgetCoveragePct = (actual-bearing accounts with budget>0) / (actual-bearing accounts) × 100` | Proposal §8 `dataQuality` |
| 18 | Summary at operating-income level: `totalBudget = Σ revenue.budget − Σ (cost+sga).budget`; `totalActual` likewise; `totalVariance = totalActual − totalBudget` | Proposal §8 `summary` |

### Default thresholds (all `PENDING HUMAN DETERMINATION` — proposal §6.2, §11.5)

`topK=10`, `materialityAbsoluteFloor=10000`, `materialityPctOfRevenue=0.005` (0.5%),
`outlierZThreshold=2.5`, `unreconciledTolerancePct=0.10` (10%), `expectedModel='M0'`.

---

## Assumptions / `PENDING HUMAN DETERMINATION`

These are the judgemental choices. Each defaults to the most conservative option and is flagged
`// PENDING HUMAN DETERMINATION` in the source. The owner must decide.

1. **Full PVVM (price/volume/mix) is NOT computed.** `Journal` stores no quantity/unit-price and no
   partner/segment/tag dimensions (proposal §4.3 — both sync paths discard them). The combined
   volume×price effect that cannot be split is reported as the `run_rate` residual. Splitting it
   needs §7.1 (dimension capture) + §7.2 (quantity) — Class-A schema changes, out of scope.
2. **Account-key crosswalk is best-effort.** Journals store the account *name*; budgets store a
   user *code*; `MonthlyBalance` stores a freee numeric *id* or user code (§4.3). The resolver
   matches by name (actuals authoritative, then budget prefix, then `AccountItem`). Journals that
   fail to resolve are counted as `unmatched` and never attributed. A canonical crosswalk (§7.3) is
   Class-A, out of scope.
3. **Category mapping on the freee path is broken and NOT fixed.** `getCategoryFromAccountItem`
   (`data-sync.ts:187`) has a dead `revenue` branch and no `cost_of_sales` branch (§4.4). The fix is
   Class-A (freee integration). Revenue/COGS variances are flagged `category_mapping_unverified_freee_path`.
4. **Period window assumes calendar alignment.** `fiscalYear`/`month` are treated as calendar
   year/month. Fiscal-year-start handling is out of scope (PENDING).
5. **Timing driver is a period-boundary heuristic only.** Reversing-pair detection and
   `Prepaid`/`Accrued` linkage are NOT implemented (PENDING). Only first/last-day-of-month journals
   are tagged `timing`.
6. **Absence vs unreconciled boundary (no journals).** When `|actual|` is below the materiality
   floor → `absence`; otherwise the whole variance is `unreconciled` (actual with no journal backing).
   PENDING.
7. **Department-level variance is NOT feasible.** `Journal` has no `departmentId`/segment (§4.3).
   `departmentId` filters budgets only; journals stay company-wide. Needs §7.6 (Class-A).
8. **Driver precedence** (`new_unbudgeted > outlier > timing > run_rate`) is a proposal; PENDING.
9. **Population (n) stddev** chosen over sample (n−1); PENDING.
10. **All thresholds** (§"Default thresholds") are starting points; PENDING human tuning.
11. **`expectedModel` M0 only.** M1 (temporal), M2 (prior-year), M3 (driver-based PVVM) are not
    implemented and return `BUSINESS_LOGIC_ERROR` if requested.
12. **No route integration.** The budget API route (`src/app/api/reports/budget/route.ts`) feeds
    hardcoded sample P&L, and `mapBalancesToProfitLoss` silently falls back to sample data when
    `MonthlyBalance` is empty (§4.2). Wiring the new service to the route is deferred pending the
    Class-A data fixes (§7.3/§7.4) so attribution is never run on synthetic actuals. Callers must
    pass `actualsSource: 'sample'|'mock'` when feeding synthetic P&L (fires `actuals_are_synthetic`).

### Conservative defaults (non-judgemental safety)

- Unsupported `expectedModel` → `failure` (no silent fallback).
- Invalid input → `failure` (Zod `safeParse`).
- DB error → `failure` (`DATABASE_ERROR`).
- Immaterial variance → aggregated, not exploded to journals.
- `unreconciled` is its own bucket, never absorbed into `run_rate`.
- `dimensionCoverage` is always `{partner:false, segment:false, quantity:false}` (factual).

---

## Scope compliance

- No Class-A path modified (schema, migrations, auth, crypto, security, audit, conversion,
  valuation, tax, kpi, debt, deferred-accrual, journal-proposal, freee integration, the listed
  api routes, python/r services). All were read-only reference at most.
- Journals / `MonthlyBalance` / `Budget` / `AccountItem` are read-only inputs.
- Additive/strengthening; reuses existing `getBudgetsByMonth`, `safeDivide`, `Result`/`AppError`,
  `ProfitLoss` types. No new dependencies.
- New helpers return `Result<T,E>`; inputs validated with Zod `safeParse`.
- Golden tests: hand-computed expected numbers (summer-bonus outlier, reconciliation gap, new
  unbudgeted, absence, unreconciled, immaterial, revenue sales-return, negative actual) plus a
  reconciliation-identity property test. Real assertions only; no fake green.
