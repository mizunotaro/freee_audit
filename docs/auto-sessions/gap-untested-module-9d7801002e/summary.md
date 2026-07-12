# gap-untested-module-9d7801002e — Add unit tests for `src/app/api/analysis/schemas/request-schemas.ts`

**Risk class:** B
**Target:** `src/app/api/analysis/schemas/request-schemas.ts` (pure Zod schema module, no tests)
**Result:** 96 tests, all passing. New test file only — no production code changed.

## Test file

`tests/unit/app/api/analysis/schemas/request-schemas.test.ts`

Mirrors the source path under the repo's `tests/unit/` convention (matching
`tests/unit/app/api/...` neighbours), rather than the literal `tests/app/...`
path named in the auto-generated task brief. The repo has no top-level
`tests/app/` directory; `tests/unit/app/` is the established mirror of
`src/app/`. The new file is a changed `*.test.ts`, so the autopm verify gate
runs it directly regardless of stem resolution.

## Approach

The module exports 15 runtime Zod schemas (the public surface — the four
`*Input` aliases are trivial `z.infer` derivatives of those schemas, so
exercising every schema covers the public contract). Tests drive each schema via
`schema.safeParse(value)` and assert `.success` through two small helpers
(`accepts` / `rejects`). SafeParse keeps assertions deterministic and
exception-free; no network, clock, or randomness is involved.

Shared fixtures (`balanceSheet`, `profitLoss`, `cashFlow`, item literals) supply
minimal valid inputs that are spread + mutated for each edge case, keeping each
assertion's intent legible.

## Coverage rationale (per schema)

| Schema | Happy | Edge / boundary | Error / fail-safe |
|---|---|---|---|
| `BalanceSheetItemSchema` | minimal item; +previousAmount; recursive children (3 levels) | code/name min(1) & max(50/200); amount NaN/±Infinity; negative amount allowed | missing required field; wrong types (string/null/undefined); children not array |
| `BalanceSheetSchema` | full BS; extra-key stripping | fiscalYear 1899/1900/2100/2101 + non-int; month 0/1/12/13 + non-int; totals nonnegative/positive boundaries; zero totals; deficit (negative equity) | non-finite totals; missing nested section; totalAssets ≤ 0 |
| `ProfitLossItemSchema` | minimal; all optionals | percentage 0/100 boundary + -1/101; category max 100 | non-finite amount; empty code/name |
| `ProfitLossSchema` | full P&L | fiscalYear/month bounds; non-finite scalars | missing required section; array field wrong type |
| `CashFlowStatementSchema` | minimal (3 totals only); full (summary + detailed activities + dates) | periodStart as Date vs string; fiscalYear/month bounds | non-finite totals; missing required total; malformed activity section; malformed summary item |
| `AnalysisOptionsSchema` | empty `{}`; full; every category/depth/language enum value | — | unknown category/depth; non-ja/en language; non-boolean flags |
| `BenchmarkOptionsSchema` | empty; full; every sector/companySize | employeeCount 0 / negative / non-int; annualRevenue 0 / negative | unknown sector; unknown companySize |
| `AnalysisRequestSchema` | minimal (BS+PL); full | — | missing BS/PL; invalid nested BS; invalid nested options.category (propagation); invalid benchmarkOptions.sector |
| `RatioCategorySchema` | all 5 enum values | — | `comprehensive`/`cashflow`/unknown/empty rejected (not ratio categories) |
| `RatioAnalysisRequestSchema` | minimal; +categories array | — | invalid category in array; non-array categories; missing BS |
| `BenchmarkRequestSchema` | empty ratios; populated ratios + options | — | non-finite (Infinity/NaN) ratio; non-numeric ratio; unknown sector; negative employeeCount/annualRevenue; missing `ratios` |
| `ReportTypeSchema` | all 5 enum values | — | unknown / empty |
| `ReportFormatSchema` | all 3 enum values | — | unknown / empty (e.g. `pdf`) |
| `ReportOptionsSchema` | empty; full | companyName min(1)/max(200) boundary; fiscalYear bounds + non-int | unknown sector; non-boolean includeCharts |
| `ReportRequestSchema` | minimal (BS+PL+reportType); full | — | missing/unknown reportType; unknown format; invalid nested option (propagation); missing BS |

The "fail-safe" requirement for a pure validation module is interpreted as:
every malformed input is **rejected** (`.success === false`) rather than accepted
or crashing — i.e. the schemas never degrade to silently accepting bad data. The
propagation cases on the composite request schemas (`AnalysisRequestSchema`,
`RatioAnalysisRequestSchema`, `ReportRequestSchema`) additionally confirm that a
fault in a nested sub-schema surfaces as an overall rejection.

## Verification

- `corepack pnpm install --frozen-lockfile` (worktree had no `node_modules`)
- `corepack pnpm db:generate` (avoids phantom TS7006 errors)
- `corepack pnpm exec vitest run tests/unit/app/api/analysis/schemas/request-schemas.test.ts` → **96 passed**
- `corepack pnpm exec eslint --max-warnings=0 <file>` → **exit 0**
- `corepack pnpm exec tsc --noEmit` (whole repo) → **exit 0**

No production code was modified. No new dependencies added.
