# EDGE-01 — Deepen error/edge-case tests in analytics + budget services

## Scope
Added edge-case tests for already-tested, non-Class-A modules under
`src/services/analytics/**` and `src/services/budget/**`. No source code was
modified; no Class-A path touched. All new helpers already return `Result<T,E>`;
inputs validated with Zod `safeParse` (the new tests exercise the failure paths).

## What was done
Six **new**, additive `-edge.test.ts` files (created rather than editing existing
files, to avoid inheriting pre-existing lint warnings in touched files — the
autopm gate lints changed files with `--max-warnings=0`):

| File | Module deepened | Branches/lines closed |
|------|-----------------|----------------------|
| `tests/unit/services/budget/variance-attribution-edge.test.ts` | `variance-attribution.ts` | `isPeriodBoundary` malformed (<3 parts) & non-numeric dates (L197/201); journal `direction: 'neutral'` when deviation === 0 (L526); `freeeJournalId ?? null` right-branch (L537); sga-only input → no `category_mapping` warning (L672); `actualsSource: 'mock'` → `actuals_are_synthetic` warning (L678/679) |
| `tests/unit/services/analytics/managerial-accounting-edge.test.ts` | `analytics/managerial-accounting.ts` | `safeRatio` overflow → null (L262); `classifyCostBehavior` invalid `overrides` value (L321); `calculateContributionMargin` non-finite/missing input (L372); `analyzeCVP` undefined break-even + supplied volume → null margin-of-safety (L476/480/481) |
| `tests/unit/services/budget/managerial-accounting-edge.test.ts` | `budget/managerial-accounting.ts` | `buildVarianceBridge` per-stage missing detection — revenue / cost-of-sales / SGA missing one at a time (lines 133–135 + the "stage present" branch of each guard; previously only operating-income-missing was tested) |
| `tests/unit/services/budget/detailed-actual-vs-budget-edge.test.ts` | `detailed-actual-vs-budget.ts` | `getRevenueStatus` budget 0 & actual < 0 → `'bad'` (L229); `getExpenseStatus` budget 0 & actual === 0 → `'good'` (L237); positive-actual zero-budget → `'good'` arm |
| `tests/unit/services/budget/budget-import-edge.test.ts` | `budget-import.ts` | `parseBudgetCsv` non-month header column skipped (L40); short data row (<2 cells) skipped (L48); `validateBudgetCsv` short data row → row error (L202/203/204) |
| `tests/unit/services/budget/variance-attribution-loader-edge.test.ts` | `variance-attribution-loader.ts` | `inferCategoryFromType` income/cogs/expense hits + null `categoryType` `?? ''` (L112–115); AccountItem code fallback chain shortcutNum→shortcut→`String(freeeId)` (L161); costOfSales resolver loop (L142); `pushJournal` second-journal-to-same-account `existing` branch (L258); `prepareAttributionInput` costOfSales actuals (L348) + null-departmentId budget excluded by dept scope (L299); `computeVarianceAttribution` non-integer fiscalYear (L395, pre-DB return) |

**35 new tests, all real assertions** (no `toBeDefined()` cop-outs; hand-computed
golden values for the CVP/overflow/boundary cases). No `any`, `@ts-ignore`,
`.skip`, or lint-disable.

## Dead branches intentionally NOT covered (no faking)
- `variance-attribution.ts` L543/563/570 (`variance !== 0 ? … : null` in the
  material+has-journals path): `variance === 0` is unreachable there because
  `material = |variance| ≥ threshold` already forced a variance ≠ 0.
- `variance-attribution.ts` L564 (`driverCounts.get(driver) ?? 0`): the driver
  key is always populated by the preceding roll-up loop, so the `?? 0` fallback
  is unreachable.
- `analytics/managerial-accounting.ts` L266 (`toAppError` `details ? … : undefined`):
  the only caller (`fromZodError`) always passes `details`, so the no-details
  branch is dead given the current module.

These are flagged here rather than papered over with contrived calls.

## Verification
- `node scripts/autopm_verify.mjs --changed-only` → **exit 0**
  (typecheck 0 errors, eslint 0 warnings on all 6 files, vitest 35/35).
- Full `tests/unit/services/{analytics,budget}/` suite: **20 files / 407 tests
  pass** (was 14/372; +6 files, +35 tests) — confirms no mock cross-contamination.

## Out of scope
- `src/services/budget/sample-pl.ts` is untested but is a sample-data generator;
  EDGE-01 deepens *already-tested* modules, so it was left for the separate
  gap-untested-module auto-task.
- `analytics/kpi.ts`, `budget/budget-service.ts` were already at 100% line/branch
  coverage — nothing to deepen.
- `financial-kpi.ts` FIN-IMPL-04 `calc*` validation-failure paths are uncovered
  but repetitive (`if (!ok.success) return ok` × ~30); a dedicated 58-test golden
  file already exists. Left untouched to avoid low-value duplication.
