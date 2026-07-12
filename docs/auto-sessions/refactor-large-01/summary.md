# REFACTOR-LARGE-01 — Summary

Split the largest non-Class-A source file (`src/services/analytics/financial-kpi.ts`,
1928 lines) into three cohesive modules. **No behavior change.** Public API preserved
via re-export. Definition of Done met: `node scripts/autopm_verify.mjs --changed-only`
exits 0.

## What was split

`src/services/analytics/financial-kpi.ts` contained two independent systems divided by
a `FIN-IMPL-04` comment banner at line 889:

1. **Legacy KPI system** — `calculateFinancialKPIs`, `calculateExtendedKPIs`,
   startup/VC/bank KPIs, `generateKPIAdvice`, `INDUSTRY_BENCHMARKS`, `getKPIBenchmarks`.
   Consumed by `monthly-report`, the reports+kpi routes, and the analysis routes.
2. **Modern strengthened ratio set (FIN-IMPL-04)** — 35 `calc*` ratio functions,
   `calculateFinancialRatios`, DuPont decomposition, all returning `Result<T, AppError>`
   with Zod `safeParse` validation.

Only five primitives were genuinely shared between the two systems: `roundTo2`,
`roundTo4`, `getTotalRevenue`, `getTotalInventory`, `getTotalReceivables`,
`getTotalPayables`. The modern system never calls back into the legacy system (no
reverse dependency).

## Resulting files

| File | Lines | Contents |
|------|-------|----------|
| `src/services/analytics/financial-statement-helpers.ts` (new) | 48 | Shared primitives: `roundTo2`, `roundTo4`, `getTotalRevenue/Inventory/Receivables/Payables` |
| `src/services/analytics/financial-ratios.ts` (new) | 1056 | Modern ratio system: schemas, `parseOrFail`, all `calc*`, `calculateFinancialRatios`, DuPont |
| `src/services/analytics/financial-kpi.ts` (modified) | 851 (was 1928) | Legacy KPI system only + `export * from './financial-ratios'` |

`financial-kpi.ts` keeps its full 59-symbol public surface: its own legacy exports
plus everything re-exported from `financial-ratios.ts` via `export *`. The shared
primitives are imported from `financial-statement-helpers.ts` by both modules
(one-directional dependency — `financial-ratios.ts` does not import from
`financial-kpi.ts`, so there is no cycle).

## Why this preserves behavior and API

- Every test imports from `@/services/analytics/financial-kpi`. Since that module
  re-exports `./financial-ratios` and still defines the legacy exports, no test or
  consumer import changed.
- The moved code is byte-identical; only its location and the sourcing of the five
  shared primitives changed.
- Now-unused imports (`zod`, `success/failure/createAppError/ERROR_CODES/Result/AppError`)
  were removed from `financial-kpi.ts` since they were modern-only.

## Verification

- `pnpm exec vitest run` on the 5 analytics/financial-kpi test files: **144 passed**.
- `pnpm exec vitest run` on the 3 downstream report consumers (monthly-report,
  report-extended): **39 passed**.
- `eslint --max-warnings=0` on all three files: **clean**.
- `node scripts/autopm_verify.mjs --changed-only`: **exitCode 0**
  - typecheck: whole-repo `tsc --noEmit` → **0 total errors** (so every consumer of
    the split module — including `detailed-actual-vs-budget`, loaders, routes — still
    resolves).
  - eslint: 3 files clean.
  - vitest: `--changed-only` resolved no related tests for `src/services/analytics/**`
    (known stem-gap), which is why the tests were run explicitly above.

## Candidates considered but not split (with rationale)

- `src/services/budget/variance-attribution.ts` (707) — **clean future candidate**.
  Has a clear seam: six dependency-free primitives (`signConventionForCategory`,
  `classifyFavorable`, `signJournalAmount`, `expectedAmountUniform`, `computeZScores`,
  `isPeriodBoundary` + `SignConvention`) vs. the `attributeVariance` orchestrator.
  Not done here because the extraction is **non-contiguous** (`materialityThreshold`
  sits between two extractable blocks and must stay due to its `AttributionOptions`
  dependency), which would require either large multi-line edits or fragile line-based
  deletion — higher risk for modest gain (707 → ~560). The helpers are part of the
  public API (imported by `detailed-actual-vs-budget.ts` and two test files), so a
  future split must re-export them.
- `src/services/analysis/variance-attribution.ts` (619) — similar pure Result+Zod
  module; feasible but same secondary-priority profile.
- `src/services/ai/analyzers/financial-analyzer.ts` (732) — **avoided**: a stray
  `financial-analyzer.ts.new` sits beside it, indicating in-progress/uncommitted
  refactor work; touching it risks conflict.
- `src/services/report/monthly-report.ts` (858), `board-report-service.ts` (826) —
  DB-coupled; no clean dependency-free seam comparable to the KPI split.

## Class-A compliance

No Class-A path was modified. Only `src/services/analytics/**` was touched (analytics
is not in the Class-A list). Class-A paths were used read-only for reference only.
