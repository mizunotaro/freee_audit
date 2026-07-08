# COV-SVC-01 — Unit-test coverage: analytics + benchmark + external-info

## Outcome

Added focused unit tests for the **3 modules** under the task scope that had
exported functions lacking a mirror test under `tests/unit/services`. All other
modules in scope already had dedicated, assertion-bearing tests (enumerated
below), so no work was needed there.

**Definition of Done met:** `node scripts/autopm_verify.mjs --changed-only` → exit 0
(typecheck 0/0, eslint clean, vitest 81 passed).

## Coverage gap enumeration (scope: analytics / benchmark / external-info)

| Module | Status before | Action |
|---|---|---|
| `src/services/analytics/kpi.ts` | **No test file** — 14 exported pure fns untested | **Added** `tests/unit/services/analytics/kpi.test.ts` |
| `src/services/analytics/financial-kpi.ts` | Covered (`financial-kpi-extended.test.ts`) | none |
| `src/services/benchmark/data/company-size-benchmarks.ts` | **No test** — `determineCompanySize` et al. only indirectly hit | **Added** `tests/unit/services/benchmark/company-size-benchmarks.test.ts` |
| `src/services/benchmark/data/industry-ratios.ts` | **No test** — lookups only indirectly hit via `BenchmarkService` | **Added** `tests/unit/services/benchmark/industry-ratios.test.ts` |
| `src/services/benchmark/benchmark-service.ts` | Covered (`benchmark-service.test.ts`, 30+ cases) | none |
| `src/services/external-info/external-info-service.ts` | Covered | none |
| `src/services/external-info/cache/info-cache.ts` | Covered | none |
| `src/services/benchmark/types.ts`, `index.ts` / `external-info/{index,types}.ts` | Type/re-export only (coverage-excluded by `vitest.config.ts`) | n/a |
| `src/services/external-info/sources/{base,nta,mock,web-search}-source.ts` | All 4 covered | none |

→ **3 modules added** is the full set of genuine gaps; the remaining scope modules
were already well-tested. Adding more would be redundant / low-value, so 3 (not 10)
is the correct, honest count.

## What the new tests assert

### `tests/unit/services/analytics/kpi.test.ts` (33 tests)
All 14 exported pure functions in `kpi.ts`:
- Profitability/return: `calculateROE`, `calculateROA`, `calculateROS`,
  `calculateGrossMargin`, `calculateOperatingMargin` — happy path value checks
  **+ zero-denominator → 0 edge case** for each.
- `calculateEBITDA` — sum incl. negative operating income.
- `calculateEBITDAMargin` — happy + zero revenue.
- Liquidity/structure: `calculateCurrentRatio`, `calculateQuickRatio`,
  `calculateDERatio`, `calculateEquityRatio` — happy + zero-denominator + format/unit.
- `calculateRunway` — finite vs **Infinity** (no-burn) runway, scenario multipliers
  (0.8×/1.0×/1.2× burn), and the no-burn Infinity propagation to all scenarios.
- `calculateRunwayKPI` — finite value passthrough **and Infinity → 999 cap**.
- `calculateAllKPIs` — returns exactly the 10 expected KPIs in order, EBITDA margin
  derived from `operatingIncome + depreciation`, default-depreciation=0, and
  consistency with the standalone `calculateROE`.

### `tests/unit/services/benchmark/company-size-benchmarks.test.ts` (28 tests)
- `determineCompanySize` — **boundary table** for employee-count (9/10, 49/50,
  299/300) and revenue (100M, 500M, 3B), employee-count precedence over revenue,
  and the `→ 'small'` default when neither is given.
- `getCompanySizeBenchmark` — defined for all 4 sizes, `undefined` for unknown,
  valid non-overlapping employee/revenue ranges.
- `getAllCompanySizeBenchmarks` — one entry per size.
- `COMPANY_SIZE_BENCHMARKS` — completeness + **sorted-range invariant**
  (`min ≤ q1 ≤ median ≤ q3 ≤ max`, finite).

### `tests/unit/services/benchmark/industry-ratios.test.ts` (20 tests)
- `getIndustryBenchmark` — defined for all 10 sectors (incl. `healthcare`,
  `education`), `undefined` for unknown.
- `getAllIndustryBenchmarks` — one entry per sector.
- `getMetricBenchmark` — known sector+metric, **`undefined` for unknown sector**,
  **`undefined` for unknown metric**, consistency with the full-sector lookup.
- `INDUSTRY_BENCHMARKS` — completeness, common-metric coverage per sector, sorted
  ranges, positive `sampleSize`.

## Constraints honoured

- **No Class-A path touched** — all 3 modules are non-Class-A
  (analytics + benchmark data). Diff = 3 new test files only.
- **No** `any` / `@ts-ignore` / `@ts-expect-error` / `.skip` / lint-disable /
  threshold change. Two `as CompanySize` / `as IndustrySector` casts are used solely
  to exercise the "unknown input → undefined" branches (matches the existing
  `benchmark-service.test.ts` idiom; eslint `--max-warnings=0` passes).
- **No new dependencies.** Pure-logic targets; no IO/DB to mock
  (these functions take numbers / plain objects and return values, so the
  `Result<T,E>` / Zod patterns don't apply here).
- **Only the 3 added files were run** (`pnpm exec vitest run <files>` and the
  diff-scoped gate) — full suite never executed (known OOM).

## Verify

```
node scripts/autopm_verify.mjs --changed-only   # exit 0
  typecheck: totalErrors=0, relevantErrors=0
  eslint:    ok (--max-warnings=0)
  vitest:    3 files, 81 passed
```

Local setup note: `node_modules` was absent in this worktree; ran
`corepack pnpm install --prefer-offline` then `corepack pnpm db:generate`
(prisma client) before the gate. These are gitignored artifacts, not part of the diff.

## Files changed

- `tests/unit/services/analytics/kpi.test.ts` (new)
- `tests/unit/services/benchmark/company-size-benchmarks.test.ts` (new)
- `tests/unit/services/benchmark/industry-ratios.test.ts` (new)
