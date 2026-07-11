# FIN-DESIGN-04 — Strengthening the Class-A Custom-KPI Engine (Definition / Validation / Computation)

**Status:** DESIGN PROPOSAL — ANALYSIS ONLY.
**Every conclusion, finding, and proposed change in this document is `PENDING HUMAN DETERMINATION`.**
This is a safety/strengthening design for a human reviewer. It is **not** an approval, a decision, or a
sign-off. No reviewer name, status of "approved", or acceptance is recorded anywhere in this document. Nothing
here has been implemented; all source cited is **read-only reference** for this task.

**Task scope (non-negotiable):** This document writes **exactly one file** — itself. It touches no source. All
paths enumerated in the task constraints (`prisma/schema.prisma`, `src/services/kpi/**`, `src/app/api/kpi/**`,
`src/lib/**`, etc.) are Class-A and are **read-only** here. Every proposed code/model change below is a
**description for a human**, `PENDING HUMAN DETERMINATION`, not an implementation.

---

## 0. TL;DR

The task asks how to strengthen the custom-KPI engine — definition, validation, and computation — along four
safety axes named in the brief: **formula validation**, **unit consistency**, **divide-by-zero**, and
**period alignment**, in order to "support the metrics in fin-design-03 safely."

Six findings dominate and are all `PENDING HUMAN DETERMINATION`:

1. **The compute half of the engine is dormant.** `calculateAllFormulaKPIs`, `calculateAndSaveKPI`, and
   `setKPIValue` are referenced **only** by the unit test (`tests/unit/services/kpi/custom-kpi-service.test.ts`).
   The only live caller, the `kpi/custom` API route (`src/app/api/kpi/custom/route.ts`), performs CRUD +
   `validateFormula` and **never calls compute** and **never writes `CustomKPIValue`**. A repo-wide search for
   `customKPIValue.(upsert|create|update)` outside the service returns **zero hits**. (Evidence: §4.1.) →
   *Strengthening computation is hypothetical until a live path actually invokes it; the proposal must say so
   explicitly and design the safety layers so they hold whether or not the path is wired.*

2. **No data source ever populates the evaluation context.** `KPIEvaluationContext` (a flat bag of scalars:
   `revenue`, `total_assets`, `labor_cost`, …) is **never constructed from real data anywhere in `src/`**.
   There is no adapter from `MonthlyBalance` / trial balance / financial statement → the evaluator's variable
   namespace. So even if compute were wired, every variable would fall back to its `getDefaultContext()` default.
   (Evidence: §4.4.) → *Period alignment and divide-by-zero safety both reduce to "there is no lineage from real
   financials to the formula variables"; fixing the axes requires such a bridge, which does not exist.*

3. **`validateFormula` throws away the evaluator's structural output.** `SafeFormulaEvaluator.validate()`
   returns `{ usedVariables, usedFunctions }`, but the service's `validateFormula` (and therefore the API route)
   collapses this to `{ valid, error }`. The UI cannot show which variables a formula needs, cannot pre-warn that
   a referenced variable is unpopulated, and cannot run a unit/dimension check. (Evidence: §4.2.)

4. **There is no unit model at all.** `CustomKPI.unit` is free text defaulting to `"number"`; the variable
   registry carries a Japanese **label** but no **dimension**. Nothing stops `revenue + employee_count` (円 + 人)
   or a ratio being labeled `円`. The evaluator computes any such expression as a bare number with no warning.
   (Evidence: §4.3.)

5. **Divide-by-zero is masked, not diagnosed.** With `divisionByZeroBehavior: 'null'`, any non-finite result
   (Infinity from `x/0`, NaN from `0/0`) collapses to `null`, indistinguishable from "invalid formula."
   Worse, `getDefaultContext()` hard-codes `employee_count: 1` while every other ratio denominator
   (`revenue`, `total_assets`, `current_liabilities`, `equity`, `added_value`) defaults to `0` — so
   `revenue / employee_count` on missing data silently yields `0/1 = 0`, a plausible-looking wrong number
   rather than `null`. (Evidence: §4.5.)

6. **`yoyChange` is mislabeled period-over-period, not year-over-year**, and the trend band is a fixed ±5%.
   The "previous value" used for `yoyChange` is the **immediately preceding stored period** (prior month, or
   prior year's last month), computed via `findFirst(... orderBy fiscalYear desc, month desc)`. That is a
   PoP/MoM delta; true YoY compares month M of fiscalYear Y against month M of Y−1. The field is named
   `yoy_change` in schema and surfaced as `yoyChange`, so consumers misread it. (Evidence: §4.6.)

Given the above, this document specifies, all `PENDING HUMAN DETERMINATION`: (a) a **typed variable registry**
that is the single source of truth for allowed names, dimensions, stock-vs-flow semantics, and population status;
(b) an enriched **validation contract** that returns `usedVariables` and supports a dry-run; (c) a **dimensional
(unit) analysis** pass over the parsed AST; (d) an explicit **divide-by-zero policy** that distinguishes
unpopulated / structurally-zero / guarded denominators; (e) a **period-alignment contract** that tags every
context value with its period and stock/flow nature; and (f) the **honest scope statement** that none of this
affects the user-facing KPI report until the compute path is wired and a financials→context bridge exists.

> **Note on "the metrics in fin-design-03".** As of this writing, **no `fin-design-03` proposal exists in any
> worktree** (`docs/proposals/` in `fin-design-02`/`fin-design-03`/`fin-design-04` all contain only
> `fin-design-01-variance-attribution.md`). The "metrics" fin-design-03 refers to are therefore not yet
> specified. This proposal treats them as the **financial-KPI family the engine's own variable namespace already
> implies** — ratios, margins, per-unit productivity, growth, and cash-flow metrics (see §3.2) — and designs the
> hardening to be **metric-agnostic**: any new metric fin-design-03 defines becomes safe to express as long as it
> composes the registered variables. `PENDING HUMAN DETERMINATION` whether fin-design-03 introduces variables or
> semantics (e.g. cohort, retention, CAC/LTV) outside the current namespace, which would require registry
> extension.

---

## 1. Scope & non-goals

**In scope (design only):**
- A finding-by-finding analysis of `src/services/kpi/custom-kpi-service.ts` and its dependency
  `src/lib/utils/safe-formula-evaluator.ts` against the four named safety axes.
- A target design for: formula validation, unit/dimensional consistency, divide-by-zero policy, and period
  alignment — described, not implemented.
- A target data-shape / API contract (request/response) and an edge-case catalog.
- Honest statements about which parts of the engine are currently live vs dormant, so a human does not assume
  the safety layers are exercised today.

**Out of scope (non-goals):**
- Any code change. This task writes this one document only. All proposed model/API/service changes are
  descriptions for a human, `PENDING HUMAN DETERMINATION`.
- The parallel `src/services/analytics/financial-kpi.ts` engine (what `reports/kpi` actually renders today) is
  referenced for context only; redesigning it is out of scope. (See §4.7.)
- Forecasting, targets/threshold UI, benchmark comparison, or the AI-advice layer.
- Multi-company consolidation / elimination.

---

## 2. Subject under analysis

| File | Role | Live? |
|------|------|-------|
| `src/services/kpi/custom-kpi-service.ts` (925 lines) | Definition CRUD, formula validation, compute, persistence of `CustomKPI`/`CustomKPIValue`, default KPI seed | CRUD live; **compute dormant** (§4.1) |
| `src/lib/utils/safe-formula-evaluator.ts` (364 lines) | mathjs-backed sandboxed evaluator: AST validation, dangerous-pattern blocklist, allowed-function allow-list, complexity limits, non-finite handling | Live (via `validateFormula`) |
| `src/app/api/kpi/custom/route.ts` (119 lines) | The only HTTP surface: GET/POST/PUT/DELETE over `CustomKPI`, plus `action: 'validate'` | Live |
| `prisma/schema.prisma` `CustomKPI` (L573) / `CustomKPIValue` (L608) | Persistence | Live / **unwritten** (§4.1) |
| `tests/unit/services/kpi/custom-kpi-service.test.ts` (727 lines) | The **sole** caller of compute functions; mocks Prisma | — |

The custom-KPI engine has three logical layers:

1. **Definition layer** — `CustomKPIInput`/`CustomKPIDetail`, `createCustomKPI`, `updateCustomKPI`,
   `initializeDefaultKPIs`, `DEFAULT_KPIS[]`, `AVAILABLE_VARIABLES`. Live.
2. **Validation layer** — `validateFormula` (wraps `SafeFormulaEvaluator.validate`), `translateError`. Live (used
   by the route on create/update and on `action: 'validate'`).
3. **Computation layer** — `evaluateCustomFormula`, `evaluateCustomFormulaWithResult`, `evaluateKPIStatus`,
   `evaluateTrend`, `setKPIValue`, `getKPIValue(s)`, `calculateAndSaveKPI`, `calculateAllFormulaKPIs`. **Dormant**
   (no live caller; §4.1).

---

## 3. Current architecture (as it stands today)

### 3.1 The evaluator

`SafeFormulaEvaluator` is constructed once at module load (`custom-kpi-service.ts:536-538`) with the fixed
allow-list `KPI_EVALUATOR_VARIABLES` (29 names, `:504-534`) and `divisionByZeroBehavior: 'null'`. It exposes:

- `validate(formula): { isValid, errors[], usedVariables[], usedFunctions[] }` — parses with mathjs, enforces
  length/operator/nesting limits, a regex blocklist of dangerous tokens (`eval`, `Function`, `require`, …),
  a function allow-list (math: `abs/ceil/floor/round/sqrt/pow/log/log10/exp/sign`; statistical:
  `sum/mean/min/max/median/mode/variance/std`; custom: `avg/count/if`), and a symbol allow-list.
- `evaluate(formula, context): number | null` — re-validates, asserts every context key is in the allow-list,
  compiles, evaluates, and maps any non-finite result through `handleNonFinite` (→ `null` under current config).

### 3.2 The variable namespace (the metric family the engine can express today)

`AVAILABLE_VARIABLES` (`:65-91`) and `KPI_EVALUATOR_VARIABLES` (`:504-534`) define the composable vocabulary.
Grouped by economic nature — this is the set "the metrics in fin-design-03" would have to draw on:

- **Stocks (balance sheet, point-in-time):** `total_assets`, `current_assets`, `cash`, `accounts_receivable`,
  `inventory`, `total_liabilities`, `current_liabilities`, `equity`, `fixed_assets`.
- **Flows (P&L, period accumulation):** `revenue`, `gross_profit`, `operating_income`, `net_income`,
  `depreciation`, `sga_expenses`, `interest_expense`, `labor_cost`, `added_value`.
- **Cash flows (period accumulation):** `operating_cf`, `investing_cf`, `financing_cf`, `free_cash_flow`.
- **Counts (period-end or period-average):** `employee_count`, `customer_count`, `active_users`.
- **SaaS metrics:** `burn_rate`, `runway`, `mrr`, `arr`.

> **Dimensional mismatch is already latent in the namespace.** Mixing a stock (`total_assets`) with a flow
  (`revenue`) in `equity_ratio`-style ratios is only correct under an explicit averaging/period convention; the
  engine has no such convention today (§4.6).

### 3.3 The default KPIs shipped today (`DEFAULT_KPIS`, `:93-184`)

Six ratios: `op_margin`, `labor_ratio`, `revenue_per_employee`, `gross_margin`, `current_ratio`, `equity_ratio`.
All are `FORMULA`, four are `unit: '%'` with `* 100` baked into the formula string, two are `unit: '円'`.

### 3.4 Persistence

`CustomKPI` (`schema.prisma:573-606`): `formula`, `unit` (free text, default `"number"`), `displayFormat`,
`decimalPlaces`, thresholds, `comparisonType`. `CustomKPIValue` (`:608-629`): `(customKPIId, fiscalYear, month)`
unique, `value`, `previousValue`, `yoyChange`, `isCalculated`, `notes`.

### 3.5 The only live HTTP surface

`src/app/api/kpi/custom/route.ts`: `GET` → list; `POST` → `initialize`/`updateOrder`/`updateVisibility`/
`validate`/`create`; `PUT` → update; `DELETE`. Create and update call `validateFormula` and reject on invalid.
**No endpoint computes or stores a value.**

---

## 4. Findings (evidence-backed), grouped by the four safety axes + structural

> Every finding and every proposed remedy is `PENDING HUMAN DETERMINATION`.

### 4.1 [Structural] The computation layer is dormant; `CustomKPIValue` is never written by any live path

**Evidence.**
- A repo-wide search for callers of `calculateAllFormulaKPIs | calculateAndSaveKPI | setKPIValue` in `src/`
  (excluding the service itself) returns **only** `src/app/api/kpi/custom/route.ts` — and that route imports none
  of them; the grep match is the unrelated CRUD symbols (`getCustomKPIs`, `createCustomKPI`, …). The actual
  compute functions appear **only** in `tests/unit/services/kpi/custom-kpi-service.test.ts`.
- A repo-wide search for `customKPIValue.(upsert|create|update)` outside the service returns **zero hits**. The
  only writers are inside `setKPIValue` (`:715`) and `calculateAndSaveKPI` (`:837`), both dormant.
- The route (`kpi/custom/route.ts:30-112`) has no branch that calls compute or persists a value.

**Impact on the four axes.** Validation runs live (create/update), so formula-validation hardening has an
immediate user-facing effect. Unit consistency, divide-by-zero, and period-alignment hardening in the **compute**
path are **not exercised today** — a reviewer should not assume a unit-mismatch warning ever reaches a user until
compute is wired. `PENDING HUMAN DETERMINATION` whether wiring compute is in scope for fin-design-03/05; this
proposal designs the safety layers to live in the **validation** path (which is live) wherever feasible, so they
protect users regardless.

**Proposed change (described, not implemented).** `PENDING HUMAN DETERMINATION.`
- State explicitly in the engine's module docstring that compute is not invoked by any live route, so future
  readers do not assume `CustomKPIValue` reflects reality.
- Move as many safety checks as possible (unknown-variable, unit, divide-by-zero-likelihood, period-tag
  consistency) into `validateFormula`, which **is** live, rather than only into the compute path.

---

### 4.2 [Formula validation] `validateFormula` discards `usedVariables`/`usedFunctions`; no dry-run; no unpopulated-variable warning

**Evidence.**
- `SafeFormulaEvaluator.validate` returns `{ isValid, errors[], usedVariables[], usedFunctions[] }`
  (`safe-formula-evaluator.ts:202-207`).
- `validateFormula` (`custom-kpi-service.ts:628-637`) returns only `{ valid, error? }`. The route consumes only
  that (`kpi/custom/route.ts:54-56, 73-76, 90-94`).
- A formula can be saved as **valid** while every variable it references is structurally unpopulated.
  `labor_ratio` (`:110-123`) uses `labor_cost / added_value * 100`; neither `labor_cost` nor `added_value` is
  populated by any data source (§4.4). The KPI passes validation and ships in `initializeDefaultKPIs`, yet can
  never produce a non-null value.
- The evaluator's AST traverse has two inconsistent branches: it pushes `"Function calls are not allowed"` for
  `node.type === 'CallNode'` (`safe-formula-evaluator.ts:197-199`), but mathjs represents calls as
  `FunctionNode` (handled at `:188-195`), so the `CallNode` branch is effectively dead; and harmless math
  constants present on the instance (`pi`, `e`, `phi`) hit the `else if (this.math[name] !== undefined)` branch
  at `:179` and are reported as `"Function not allowed"`. `PENDING HUMAN DETERMINATION` whether these are
  intentional.
- Unknown-variable detection exists twice and the second copy is dead: `validate()` flags unknown symbols via
  AST traverse (`:184`); `evaluate()` separately throws `"Unknown variable: <key>"` for any **context** key not
  in the allow-list (`:92-96`). But `evaluateCustomFormula` always merges `getDefaultContext()` (`:579`) — which
  contains **all** allowed keys — before calling `evaluate`, so the context-key check can never fire. The only
  effective gate is the AST traverse.

**Impact.** The UI cannot tell the author which variables their formula consumes, cannot warn that a referenced
variable has no data source, and cannot preview a result. A user can save a permanently-null KPI with no
feedback.

**Proposed change.** `PENDING HUMAN DETERMINATION.`
- Widen the validation contract to return `{ valid, error?, usedVariables[], usedFunctions[],
  unpopulatedVariables[], resultUnit? }`. Surface `usedVariables` to the route/UI.
- Add a **dry-run** mode: validate against a representative context (e.g. the company's latest period, or a
  documented sample) and return a computed preview + the list of variables that were missing/zero, so an author
  sees "this formula references `labor_cost`, which has no data source" **before** save.
- Add a **constant-folding / literal warning** for the `* 100` antipattern (§4.3) and for formulas whose result
  is a constant independent of all variables.
- Resolve the dead `CallNode` branch and the constant-rejection inconsistency in the evaluator (or document them
  as intentional).

---

### 4.3 [Unit consistency] No unit model; `* 100` baked into formulas; no dimensional analysis

**Evidence.**
- `CustomKPI.unit` is `String @default("number")` (`schema.prisma:587`) — free text.
- `AVAILABLE_VARIABLES` (`:65-91`) maps variable → Japanese **label** only (e.g. `revenue → '売上高'`); there is
  **no** unit/dimension field. `KPI_EVALUATOR_VARIABLES` (`:504-534`) is a bare `string[]`.
- The evaluator treats every operand as a dimensionless `number` (`safe-formula-evaluator.ts:81-83`,
  `number: 'number'`). Nothing rejects `revenue + employee_count` (円 + 人), `cash + revenue` (stock + flow), or
  a ratio labeled `円`.
- Four of six default KPIs embed `* 100` in the formula string to coerce a ratio into a percent
  (`op_margin :97`, `labor_ratio :112`, `gross_margin :142`, `current_ratio :157`, `equity_ratio :172`), while
  the KPI also carries `unit: '%'` and `displayFormat: '0.0%'`. The `*100` and the `%` format are coupled only
  by author discipline; an author who writes `gross_profit / revenue` (no `*100`) and sets `unit: '%'` gets a
  value displayed as `0.4%` instead of `40%` with no warning.

**Impact.** Silent category errors: adding a stock to a flow, labeling a ratio with a currency unit, or
mis-scaling a percentage. These are the most likely "the number looks plausible but is wrong" failures for a
custom-KPI feature.

**Proposed change — introduce a typed variable registry as the single source of truth.** `PENDING HUMAN
DETERMINATION.` Concretely (described, not implemented):

1. **Unit taxonomy.** A closed set of base dimensions: `currency` (円), `count` (人/社/件), `time` (月/日),
   `ratio` (dimensionless), `percent` (dimensionless ×100 for display). Each registry entry carries its base
   dimension and an optional **stock/flow** flag (§4.6).
2. **Dimensional analysis over the AST.** After parsing, derive the result dimension by walking the tree:
   `+`/`−` require **equal** dimensions on both operands (else warn); `×` is dimensionless-only-on-one-side
   (currency × ratio → currency); `÷` of equal dimensions → `ratio` (suggest `percent` display); `÷` of
   currency by count → currency-per-unit (e.g. 円/人). Compare the derived dimension against the author-declared
   `unit`; warn (not block) on mismatch.
3. **De-scope `* 100` from formulas.** Prefer declaring `unit: 'percent'` and letting the formatter apply the
   ×100, so the formula expresses the pure ratio (`gross_profit / revenue`). `PENDING HUMAN DETERMINATION`
   whether to migrate the seeded defaults or keep backward compatibility (a `percentScale` flag on the KPI).
4. **Result-unit suggestion.** When the author leaves `unit` at the default, suggest a unit derived from the
   dimensional analysis.

---

### 4.4 [Period alignment & lineage] No adapter from real financials to the context; no period metadata on values

This is the largest cluster and the root cause behind both "period alignment" and the practical divide-by-zero
behavior.

**Evidence.**
- `KPIEvaluationContext` (`:470-500`) is a flat `Partial<Record<var, number>>` with **no period field**. The
  compute signature is `calculateAndSaveKPI(customKPIId, fiscalYear, month, context)` (`:789`) — the period is a
  parameter, but nothing asserts that the numbers in `context` correspond to `(fiscalYear, month)`.
- **No code constructs this context from real data.** A grep for the context keys (`revenue:`, `labor_cost:`,
  `added_value:`, `gross_profit:`) across `src/` (excluding the service) returns **zero hits**. There is no
  adapter reading `MonthlyBalance` / trial balance / `ProfitLoss` and emitting a `KPIEvaluationContext`. So even
  if compute were wired, `getDefaultContext()` (`:540-572`) supplies every value — all `0` (except
  `employee_count: 1`).
- Stock/flow mixing is unguarded. `equity_ratio = equity / total_assets * 100` (both stocks — fine at an
  instant), but `op_margin = operating_income / revenue * 100` mixes a flow over a flow (fine if same period),
  while a hypothetical `revenue / total_assets` (asset turnover) mixes flow/stock and requires an **average**
  stock — the engine has no notion of averaging or of which variables need it.

**Impact.** "Period alignment" cannot be enforced because the context carries no period truth, and cannot be
**populated** because no bridge exists. Any computed number is either a default or a caller-supplied scalar of
unproven provenance.

**Proposed change.** `PENDING HUMAN DETERMINATION.`
- **Tag every context value with its period.** Replace the bare `Partial<Record<var, number>>` with a typed
  context whose entries carry `{ value, fiscalYear, month, kind: 'stock'|'flow', source }`. The validator then
  asserts all flow variables share the same `(fiscalYear, month)` and warns when a stock is mixed with a flow
  without an averaging convention.
- **Define the bridge as an explicit, audited adapter** (described here, implemented by a human in a Class-A
  follow-up): `MonthlyBalance`/trial-balance → registry variable. This is where the fin-design-01 finding
  ("actuals come from `MonthlyBalance`, not `Journal`") and the fin-design-01 account-mapping breakage
  (`getCategoryFromAccountItem` dead `revenue` branch, no `cost_of_sales` branch) become load-bearing: the
  adapter can only emit a correct `revenue`/`gross_profit` if the account→P&L mapping is fixed. Cross-reference
  `docs/proposals/fin-design-01-variance-attribution.md`. `PENDING HUMAN DETERMINATION` whether to depend on that
  fix or to source the context from the (sample-based) `analytics/financial-kpi` engine in the interim.
- **Make unpopulated explicit, not zero.** Distinguish three states per variable: `populated`, `unpopulated`
  (treated as null → formula returns null with a diagnostic), and `structurally-zero` (a real zero that may be a
  divide-by-zero). This replaces today's "default 0" which silently fabricates data (§4.5).

---

### 4.5 [Divide-by-zero] Non-finite collapses to `null`; `employee_count:1` masks missing data; no denominator guard

**Evidence.**
- Config: `divisionByZeroBehavior: 'null'` (`:536-538`). `handleNonFinite` (`safe-formula-evaluator.ts:337-348`)
  returns `null` for both `Infinity` (`x/0`) and `NaN` (`0/0`). `evaluateCustomFormula` (`:574-587`) wraps
  **all** thrown errors in a bare `catch {}` (`:584`) and returns `null`, so a parse error, an evaluator bug,
  and a divide-by-zero are indistinguishable. (`evaluateCustomFormulaWithResult` `:589-607` is the structured
  variant, but the compute path calls the lossy `evaluateCustomFormula` at `:803`.)
- `getDefaultContext()` (`:540-572`) sets `employee_count: 1` and **every other** denominator candidate
  (`revenue`, `total_assets`, `current_liabilities`, `equity`, `added_value`, `customer_count`, …) to `0`. Thus:
  - `revenue_per_employee = revenue / employee_count` on missing data → `0 / 1 = 0` — a **plausible wrong
    number**, not `null`.
  - `current_ratio = current_assets / current_liabilities * 100` on missing data → `0/0 → NaN → null` —
    indistinguishable from "invalid."
- There is no **source-level** divide-by-zero analysis: the evaluator catches the *result*, not the *structure*.
  A fragile denominator like `operating_income / (revenue - cost)` where `revenue ≈ cost` is not flagged.

**Impact.** Two failure modes, both silent: (a) fabricated zero results from the `employee_count:1` special case
and from "default 0" numerators; (b) null results that hide the reason. Neither tells the author or the audience
*why* a KPI is blank.

**Proposed change.** `PENDING HUMAN DETERMINATION.`
- **Adopt an explicit divide-by-zero policy with three outcomes:** (1) *guarded* — the author writes an explicit
  `if(denominator, numerator/denominator, fallback)` (the `if` function already exists in the evaluator's scope,
  `safe-formula-evaluator.ts:288-290`); (2) *structurally zero* — a real zero denominator → return `null` **with
  a diagnostic** (`"divide-by-zero: <denominator> = 0"`); (3) *unpopulated* — denominator missing → return `null`
  with a `"missing data"` diagnostic. Require (or strongly warn for) a guard on any variable flagged as a common
  denominator in the registry.
- **Remove the `employee_count: 1` special case** in favor of the explicit `unpopulated` state (§4.4); a missing
  employee count must not fabricate a "1."
- **Route compute through `evaluateCustomFormulaWithResult`** (structured errors) instead of the lossy
  `evaluateCustomFormula`, so `CustomKPIValue`/the API can carry a `nullReason`.
- **Structural divisor scan.** During validation, detect `OperatorNode` `/` (and `/=`-equivalent forms) and
  check the denominator sub-tree against the registry's "denominator" or "can-be-zero" flags; emit a warning if
  unguarded.

---

### 4.6 [Period alignment / semantics] `yoyChange` is period-over-period, not year-over-year; trend band is a fixed ±5%

**Evidence.**
- In `setKPIValue` (`:698-713`) and `calculateAndSaveKPI` (`:820-835`), `previousValue` is fetched as the
  **immediately preceding stored period**: `findFirst({ where: { customKPIId, OR: [{ fiscalYear, month: { lt:
  month } }, { fiscalYear: { lt: fiscalYear } }] }, orderBy: [{ fiscalYear: 'desc' }, { month: 'desc' }] })`
  (`:698-704`, `:820-826`). The delta `((value - previousValue) / |previousValue|) * 100` is then stored as
  `yoyChange` (`:710-713`, `:832-835`) and surfaced as `yoyChange` in `CustomKPICalculation` (`:16`). The schema
  column is `yoy_change` (`schema.prisma:618`).
- This is **period-over-period** (MoM for monthly series), **not** year-over-year. True YoY would compare
  `(fiscalYear, month)` against `(fiscalYear − 1, month)`.
- `evaluateTrend` (`:665-675`) uses a hard-coded ±5% band (`change > 5` / `change < -5`) for all KPIs. A 5% move
  is noise for a thin margin but material for revenue; the threshold is not per-KPI configurable.

**Impact.** Any consumer reading `yoyChange` believes it is annual; for a monthly series it is actually monthly.
Combined with the dormant compute path this is latent today, but it becomes a reporting defect the moment compute
is wired.

**Proposed change.** `PENDING HUMAN DETERMINATION.`
- **Rename or split the semantics.** Either (a) rename the field/contract to `popChange` (period-over-period) and
  add a true `yoyChange` computed against `(fiscalYear − 1, month)`, or (b) keep the column name but redefine the
  lookup to same-month-prior-year and document the migration of existing (test-only) rows.
- **Make the trend band per-KPI.** Add an optional `trendThresholdPct` to `CustomKPI` (default 5), or derive a
  sensible band from the KPI's unit/category. `PENDING HUMAN DETERMINATION` whether this needs a schema field
  (Class-A) or can live in `displayFormat`/settings.
- **Tag stock-vs-flow in the registry** so the comparison logic knows that comparing a stock (balance) across
  adjacent months is valid, while comparing a flow (YTD P&L) across months requires a cumulative-vs-cumulative or
  a same-period convention.

---

### 4.7 [Context] Two parallel KPI engines; the user-facing report does not use this service

**Evidence.** `src/app/api/reports/kpi/route.ts` imports from `src/services/analytics/financial-kpi.ts`
(`calculateFinancialKPIs`, `calculateExtendedKPIs`, `getKPIBenchmarks`) and the route calls
`calculateSampleKPIs` / `calculateSampleExtendedKPIs` (note **"Sample"**) — a different engine from
`custom-kpi-service.ts`. The custom-KPI service is not in that import graph.

**Impact.** Strengthening `custom-kpi-service.ts` does not change what the KPI report page renders today. A
reviewer deciding to invest in this engine should know the user-visible KPI report is served by a separate,
sample-based path. `PENDING HUMAN DETERMINATION` whether fin-design-03/05 intends to unify the two engines, keep
them separate (custom KPIs as a user-defined overlay), or retire one.

**Proposed change.** `PENDING HUMAN DETERMINATION.` Whichever direction is chosen, the **validation** hardening
in this proposal (§4.2, §4.3, §4.5-structural) applies to custom-KPI **definition** and is valuable independently
of the compute/lineage questions. Document the two-engine split in the engine module so the relationship is not
rediscovered by accident.

---

## 5. Proposed target design (described, not implemented)

All of the following is `PENDING HUMAN DETERMINATION`. None is implemented by this task.

### 5.1 Typed variable registry (single source of truth)

Replace the two parallel lists (`AVAILABLE_VARIABLES`, `KPI_EVALUATOR_VARIABLES`) — which today can drift, and
indeed already disagree with usage (`cogs` appears in a test formula `(revenue - cogs) / revenue * 100` at
`custom-kpi-service.test.ts:74,101` and in the create path, but `cogs` is **not** in either list, so the same
formula would be **rejected** by `validateFormula`) — with one registry entry per variable:

```
{
  name, label, dimension, stockOrFlow,
  populatedBy: 'monthlyBalance' | 'trialBalance' | 'manual' | 'none',
  canBeDenominator: boolean,   // drives divide-by-zero guard policy
  averaging: 'point' | 'periodAverage' | 'yearend',
}
```

`PENDING HUMAN DETERMINATION` whether `cogs`, `labor_cost`, `added_value` should be added as derived variables
(they are referenced by seeded KPIs/tests but absent from the namespace), and whether `intermediate variables`
(e.g. user-defined sub-totals) are in scope.

### 5.2 Enriched validation contract

`validateFormula(formula, { companyId?, period?, strict? }) → { valid, error?, usedVariables[],
usedFunctions[], unpopulatedVariables[], resultDimension?, suggestedUnit?, divideByZeroWarnings[], preview? }`.

This is the contract the **live** route should return for `action: 'validate'`, and that create/update should
consult. It moves most safety value into the live path (§4.1).

### 5.3 Dimensional (unit) analysis

A post-parse AST walk (reusing the traversal already in `safe-formula-evaluator.ts:166-200`) that computes a
result dimension and emits warnings on `+`/`−` dimension mismatch, stock+flow addition, and ratio-with-currency-
unit declaration. Warn, not block, to preserve backward compatibility. `PENDING HUMAN DETERMINATION` whether to
make any of these hard errors.

### 5.4 Divide-by-zero policy

Three explicit outcomes (guarded / structurally-zero-with-diagnostic / unpopulated-with-diagnostic) plus a
structural divisor scan at validation time (§4.5). Add a `nullReason` channel to computation results so a blank
KPI explains itself.

### 5.5 Period-aligned, lineage-bearing context

A typed context whose entries carry `{ value, fiscalYear, month, kind, source }`; a documented adapter from
`MonthlyBalance`/trial-balance to the registry (the hard part, and the dependency on fin-design-01's
account-mapping fix); and a stock-vs-flow mixing check (§4.4, §4.6).

### 5.6 Honest YoY semantics

Split `yoyChange` (true same-month-prior-year) from `popChange` (prior period); make the trend band per-KPI
(§4.6).

---

## 6. Target data shape / API contract (described; Class-A if it needs schema)

`PENDING HUMAN DETERMINATION.` Sketch only — any schema change is Class-A and described, not implemented.

- **`POST /api/kpi/custom` with `action: 'validate'`** response widens to the enriched contract in §5.2.
- **`CustomKPIValue`** gains (optionally) a `nullReason` / `status` discriminator and a `computedAt`, so a null
  value can carry `"divide_by_zero" | "missing_data" | "ok"`. `PENDING HUMAN DETERMINATION` whether this is a
  schema migration or an overload of the existing `notes` column.
- **`CustomKPI`** gains (optionally) `trendThresholdPct`, `resultDimension`, and a `percentScale` flag (for
  migrating the `* 100` defaults). `PENDING HUMAN DETERMINATION`.
- **Compute endpoint** (does not exist today): `POST /api/kpi/custom` with `action: 'compute'` taking
  `{ fiscalYear, month }` and invoking `calculateAllFormulaKPIs` against the lineage-bearing context. This is the
  wiring that makes the dormant layer live; it is explicitly **out of scope** to implement here.

---

## 7. Worked example (illustrative)

Given a user-defined KPI `rule_of_40 = (revenue_yoy_growth + operating_margin)` (a common VC metric):

- **Today:** `revenue_yoy_growth` is not a registered variable → `validateFormula` rejects with
  `"不明な変数: revenue_yoy_growth"`. The user has no path to express it.
- **Under the proposal:** the registry either (a) adds `revenue_yoy_growth` as a derived flow with documented
  lineage, or (b) the validator explains that the variable is unsupported and suggests composing it from
  registered variables. Dimensional analysis flags that `revenue_yoy_growth` (percent) `+` `operating_margin`
  (percent) is dimension-consistent and the result is percent; it warns if the author declares `unit: '円'`.

All illustrative; `PENDING HUMAN DETERMINATION` whether `rule_of_40` or any specific metric is in fin-design-03.

---

## 8. Edge-case catalog

Each `PENDING HUMAN DETERMINATION` as to the chosen behavior; the point is to ** enumerate** them so a human
decides explicitly rather than by accident.

| # | Case | Today's behavior | Proposed |
|---|------|------------------|----------|
| E1 | Formula references unpopulated variable (`labor_cost`) | Saved as valid; computes to `null` silently | Warn at validate; null-with-`nullReason` at compute |
| E2 | `revenue / employee_count` with both missing | `0 / 1 = 0` (fabricated) | `null` with `"missing_data"` |
| E3 | `current_assets / current_liabilities * 100` with CL=0 | `null` (NaN) | `null` with `"divide_by_zero"` |
| E4 | `revenue + employee_count` (円 + 人) | Computes a number | Dimension warning at validate |
| E5 | Ratio declared `unit: '円'` | Accepted | Dimension-vs-declared warning |
| E6 | `gross_profit / revenue` (no `*100`) with `unit:'%'` | Displays 0.4 instead of 40 | Suggest `percentScale` or `*100` |
| E7 | Stock + flow in one formula (`cash + revenue`) | Accepted | stock/flow warning |
| E8 | `cogs` referenced (not in namespace) | Rejected by validate, but used in tests/seed path | Either register `cogs` or fix the seed/test drift |
| E9 | `yoyChange` read by a consumer | Believed to be YoY; is actually PoP | Split/rename semantics |
| E10 | Formula is a constant (`1 + 2`) | Valid, computes 3 | "constant result" warning |
| E11 | Dangerous token (`eval`, `Function`) | Rejected by blocklist | Unchanged (correct) |
| E12 | mathjs constant `pi`/`e` | Rejected as "Function not allowed" | Allow harmless constants or document |
| E13 | Very long / deeply nested formula | Rejected by complexity limits | Unchanged (correct) |

---

## 9. Risks & open questions (all `PENDING HUMAN DETERMINATION`)

- **R1 — Backward compatibility.** Widening validation to *warn* is safe; widening to *block* can reject
  already-saved KPIs (e.g. the `* 100` defaults, or any KPI using `cogs`). Decide warn-vs-block per check.
- **R2 — Schema changes are Class-A.** `nullReason`, `trendThresholdPct`, `resultDimension`, `percentScale` each
  imply migrations. Each is independently optional; none is required for the validation-only hardening.
- **R3 — The lineage bridge depends on fin-design-01.** A correct `revenue`/`gross_profit` context requires the
  account→P&L mapping fix described in `fin-design-01-variance-attribution.md`. Sequencing matters.
- **R4 — Two-engine split.** Until the custom engine and `analytics/financial-kpi` are reconciled, custom-KPI
  hardening is invisible on the main report page. Decide unify/overlay/retire.
- **R5 — fin-design-03 not yet specified.** If fin-design-03 introduces variables outside the current namespace
  (cohort/retention/CAC/LTV), the registry must be extended and those variables' dimensions/lineage defined.
- **R6 — Performance.** `evaluate()` re-parses/re-compiles on every call (`safe-formula-evaluator.ts:87-101`);
  if compute is ever wired into a scheduled recompute over N KPIs × M months, cache compiled ASTs per formula.

---

## 10. Relationship to sibling tasks

- **fin-design-01 (variance attribution):** owns the `MonthlyBalance`→P&L lineage and the account-mapping fix
  this proposal's context-bridge depends on (§4.4, R3).
- **fin-design-02 / fin-design-03:** no proposal docs exist yet as of this writing; this proposal is designed to
  be metric-agnostic over the variable namespace (§0 note, §3.2) so fin-design-03's metrics compose safely once
  defined.
- **fin-design-05+ (implementation, human-owned):** any code/model change proposed here is implemented there, in
  Class-A paths, under human control.

---

## 11. References (standards/context only; no external code copied)

- Dimensional analysis of financial ratios: stock (balance) vs flow (P&L) variables and the averaging
  convention for asset-turnover ratios. Standard financial-statements practice.
- Year-over-year (YoY) vs period-over-period (PoP/MoM) definitions; the two are not interchangeable.
- Divide-by-zero guarding in user-supplied expression evaluators: explicit guard predicates vs null-result
  policies.
- mathjs expression parsing and sandboxing (the library already in use at `src/lib/utils/safe-formula-evaluator.ts`).

---

*End of proposal. Every item above is `PENDING HUMAN DETERMINATION`. This document is analysis for a human
reviewer, not a decision, an approval, or a sign-off.*
