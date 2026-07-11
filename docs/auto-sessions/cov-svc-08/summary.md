# COV-SVC-08 — Unit-test coverage: `services/ai` (non-security) + `services/analytics` deeper

## Scope recap
Add focused, real-assertion unit tests for exported functions under `src/services/ai`
and `src/services/analytics` that lacked mirror coverage, without touching any Class-A path.

## Enumeration (what already had a mirror test — not re-done)
The `analyzers/**` subtree is heavily covered by prior cov waves (category/*, ratios/*,
utils, validators, constants, config, reproducibility/stability/robustness). Also already
well-covered: `analysis-service.ts`, `prompt-service.ts`, `journal-proposal-service.ts`,
`analytics/kpi.ts` (13 fns, all happy + zero-denom edges), `analytics/managerial-accounting.ts`
(fin-impl-03). These were left untouched to avoid fake-green padding.

## Genuine gaps closed (4 new test files, 59 tests, all green)

### 1. `tests/unit/services/ai/prompts/journal-proposal.test.ts` (new — module had NO test)
`src/services/ai/prompts/journal-proposal.ts` exported `JOURNAL_PROPOSAL_PROMPT` and
`PROMPT_VERSION` with no mirror test.
- `PROMPT_VERSION === '1.0.0'`
- system/user are non-empty; system carries the CPA/税理士 persona + JSON/勘定科目/消費税法 rules
- user prompt declares all 8 OCR template placeholders (`{{ocrDate}}` … `{{chartOfAccounts}}`)
- user prompt documents the full JSON response schema (entries/entryDate/debit*/credit*/amount/taxAmount/taxType/rationale/confidence/warnings)
- frozen shape: exactly `{ system, user }`

### 2. `tests/unit/services/analytics/financial-kpi-benchmarks.test.ts` (deepen)
Previously only the `good` status branch of `getKPIBenchmarks` was asserted, and the
benchmark-comparison percentile logic (`createComparison`) was never directly verified.
- `INDUSTRY_BENCHMARKS`: all 8 `IndustrySector` keys present; `min ≤ median ≤ max` for every
  metric; service/technology/finance carry `{0,0,0}` inventoryTurnover
- `getKPIBenchmarks`: good / warning / **bad** status branches pinned across all 8 KPIs
  (synthetic `FinancialKPIs`, no DB) + documented benchmark targets
- benchmark comparison: all 4 statuses (`below_range`/`below_median`/`above_median`/`above_range`)
  with exact percentile interpolation (0 / 25 / 67 / 100) via `calculateFinancialKPIs({sector:'manufacturing'})`
- efficiency sector branch: `service` → `inventoryTurnover === 0` even with inventory present; `retail` → computed
- inventory/receivables/payables name-token matching: `商品` / `受取手形` / `支払手形`
- growth with no previousPL → 0/0
- VC `nrr` derived from `arRevenue` + prior period (`((2·arRevenue − revenue)/prev)·100`)
- memoization identity: identical inputs return the same object ref (`Object.is`)

### 3. `tests/unit/services/analytics/financial-kpi-advice.test.ts` (deepen — fake-green fix)
The existing extended test asserted advice with `if (advice) { … }` guards — vacuously green
if no advice was generated. This file pins the exact critical/warning/**none** threshold of
every `generateKPIAdvice` category with a neutral baseline (asserted `advice === []`) then a
single-axis mutation per case:
- Runway (<6 critical / 6–11 warning / ≥12 none)
- LTV/CAC (<3 critical / 3–5 warning / ≥5 none)
- Rule of 40 (<20 critical / 20–40 warning / ≥40 none)
- 成長率 (<10 critical / 10–20 warning / ≥20 none)
- DSCR (<1.0 critical / 1.0–1.2 warning / ≥1.2 none)
- D/E (>3 critical / 2–3 warning / ≤2 none)
- 売上総利益率 (<20 critical / 20–30 warning / ≥30 none)

### 4. `tests/unit/services/ai/input-suggester-extended.test.ts` (deepen)
Existing test only covered `per` peer/benchmark adjustment at in-range values.
- clamp overflow/underflow of peer average to field min/max
- non-positive peer values filtered out of the average; fallback to default when none positive
- `evEbitda` / `beta` peer-field mappings; `growthRate`→`avgGrowthRate` benchmark mapping
- industry benchmark **overrides** peer average; benchmark value also clamped
- `generateReasoning` text: exact label+percent+source string for `growthRate`; peer-count suffix
- unknown-field fallback: min/max derived from `defaultValue` (`*0.5`/`*1.5`); `0/0` range when absent

## Constraints honored
- No Class-A source modified (read-only reference only). All 4 files are new test files under `tests/unit/services/`.
- No `any`, `@ts-ignore`, `@ts-expect-error`, `.skip`, lint-disable, or coverage-threshold change.
- IO/DB mocked at the boundary (`@/lib/db` is globally mocked in `tests/setup.ts`; `kpiCache.clear()` per test for determinism).
- No new dependencies. Additive only.

## Verification
`node scripts/autopm_verify.mjs --changed-only` → **exitCode 0**
(typecheck 0 errors, eslint 0 warnings, vitest 59/59).

## Observation (not fixed — out of scope, non-Class-A module)
`calculateFinancialKPIs` memoizes via `generateKPIHash`, whose key is
`{bsTotal, plNetIncome, cfNetCash, prevNetIncome, standard, sector}` — it omits
`grossProfitMargin`, `operatingMargin`, `revenue`, etc. Two calls sharing those key fields but
differing in grossProfitMargin collide and the second returns stale cached `baseKPIs`. Tests
work around this with `kpiCache.clear()` in `beforeEach`. Flagged for a future fin-* task; not
touched here (would require editing `src/services/analytics/financial-kpi.ts`, outside this
test-only task's intent).
