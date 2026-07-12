# Gap Task: Unit tests for `src/app/api/analysis/types/input.ts`

**Task ID:** gap-untested-module-d150b959b7
**Target file:** `src/app/api/analysis/types/input.ts`
**Test file:** `tests/app/api/analysis/types/input.test.ts`
**Risk class:** B
**Completed:** 2026-07-12

---

## 1. Nature of the target module

`src/app/api/analysis/types/input.ts` is a **type-only module**: it exports 7 interfaces
(`AnalysisOptions`, `BenchmarkOptions`, `ReportOptions`, `AnalysisRequest`,
`RatioAnalysisRequest`, `BenchmarkRequest`, `ReportRequest`) and 3 type aliases
(`RatioCategory`, `ReportType`, `ReportFormat`). It has **no runtime exports** — at runtime
the module namespace is an empty object.

Because there is no executable code, the test strategy follows the established convention for
this directory (mirroring `tests/app/api/analysis/types/log.test.ts`) and the repo-wide
"pure-types module" recipe: **three layers** — (1) ESM module resolution, (2) runtime
construction + exact key-set assertions, (3) compile-time type contracts via `expectTypeOf`
plus `@ts-expect-error` immutability/fail-safe checks. Every interface gets a runtime
`expect` (avoids fake-green) and a type-level contract.

## 2. Test environment

- Framework: Vitest 4.1.x (already configured). No new dependencies added.
- Test run: `corepack pnpm exec vitest run tests/app/api/analysis/types/input.test.ts`
  → **81 tests passed**.
- Typecheck: `corepack pnpm exec tsc --noEmit` → **0 errors repo-wide** (validates every
  `expectTypeOf` union assertion and every `@ts-expect-error` directive; no TS2344 quirk,
  no TS2578 "unused directive").
- Lint: `corepack pnpm exec eslint tests/app/api/analysis/types/input.test.ts --max-warnings=0`
  → **exit 0**.
- Sibling coexistence: all 4 files in `tests/app/api/analysis/types/` run together →
  155 tests passed.

## 3. Assertions added (by symbol)

### Module resolution
- `await import('@/app/api/analysis/types/input')` resolves to a defined object (type-only
  module → empty namespace at runtime).

### `RatioCategory` (type alias, 5-member union)
- Exact 5 members at runtime: `liquidity | safety | profitability | efficiency | growth`.
- `toEqualTypeOf` exact-union contract.
- Closed-union fail-safe: `string` not assignable; `AnalysisCategory`-only members
  `cashflow` / `comprehensive` not assignable (proves `RatioCategory` ⊊ `AnalysisCategory`).
- Each member assignable.

### `ReportType` (type alias, 5-member union)
- Exact 5 members at runtime: `summary | detailed | investor | management | compliance`.
- `toEqualTypeOf` exact-union contract.
- Closed-union fail-safe: `string`, `executive`, `board` not assignable.
- Each member assignable.

### `ReportFormat` (type alias, 3-member union)
- Exact 3 members at runtime: `json | markdown | html`.
- `toEqualTypeOf` exact-union contract.
- Closed-union fail-safe: `string`, `pdf`, `csv`, `xml` not assignable.
- Each member assignable.

### `AnalysisOptions` (interface, all-optional)
- Fully-populated construction + exact 6-key set
  (`category, depth, includeAlerts, includeBenchmark, includeRecommendations, language`).
- Minimal `{}` construction → every field `undefined`, 0 keys.
- Per-field type: each is `T | undefined` (e.g. `category: AnalysisCategory | undefined`,
  `language: 'ja' | 'en' | undefined`, `depth: 'brief'|'standard'|'detailed'|'comprehensive' | undefined`).
- Accepts every `AnalysisCategory`, every depth literal, every language literal (loop).
- Both polarities for each boolean flag.
- Compile-time fail-safe: out-of-union `category: 'inventory'` rejected.
- Readonly immutability: `@ts-expect-error` (TS2540) on all 6 fields.

### `BenchmarkOptions` (interface, all-optional)
- Fully-populated construction + exact 4-key set
  (`annualRevenue, companySize, employeeCount, sector`).
- Minimal `{}` construction → all `undefined`.
- Per-field `T | undefined` types.
- Accepts every `IndustrySector` (10) and every `CompanySize` (4) (loop).
- Boundary inputs: `employeeCount` / `annualRevenue` at `0`, `-1`, `MAX_SAFE_INTEGER`.
- Readonly immutability on all 4 fields.

### `ReportOptions` (interface, all-optional)
- Fully-populated construction + exact 4-key set
  (`companyName, fiscalYear, includeCharts, sector`).
- Minimal `{}` construction → all `undefined`.
- Per-field `T | undefined` types.
- Accepts every `IndustrySector` (loop).
- Boundary inputs: `companyName: ''`; `fiscalYear` at `0`, `-1`, `MAX_SAFE_INTEGER`;
  `includeCharts` both polarities.
- Readonly immutability on all 4 fields.

### `AnalysisRequest` (interface; required: `balanceSheet`, `profitLoss`)
- Fully-populated construction + exact 7-key set.
- Minimal construction (required pair only) → 2 keys, optionals `undefined`.
- Per-field types: required `BalanceSheet` / `ProfitLoss`; optional
  `cashFlow`, `previousBalanceSheet`, `previousProfitLoss`, `options`, `benchmarkOptions`
  each `T | undefined`.
- Carries `balanceSheet` / `profitLoss` by identity (`toBe`).
- Carries nested `options` / `benchmarkOptions` by identity.
- Compile-time fail-safe: missing `balanceSheet` OR missing `profitLoss` → not assignable.
- Readonly immutability on all 7 fields.

### `RatioAnalysisRequest` (interface; required: `balanceSheet`, `profitLoss`)
- Fully-populated construction + exact 5-key set.
- Minimal construction (required pair only) → 2 keys.
- Per-field types incl. `categories: readonly RatioCategory[] | undefined`.
- Accepts a `readonly RatioCategory[]` for `categories` (by identity).
- Boundary: empty `categories: []` accepted.
- Compile-time fail-safe: missing `balanceSheet` / missing `profitLoss` → not assignable.
- Readonly immutability on all 5 fields.

### `BenchmarkRequest` (interface; required: `ratios`)
- Fully-populated construction + exact 5-key set.
- Minimal construction (`ratios` only) → 1 key.
- Per-field types incl. `ratios: Record<string, number>` (required, non-optional).
- Boundary: empty `ratios: {}` accepted; ratio values at `0`, `-1.5`,
  `MAX_SAFE_INTEGER`, fractional.
- Boundary: `employeeCount` / `annualRevenue` at `0` / `MAX_SAFE_INTEGER`.
- Carries `ratios` by identity.
- Compile-time fail-safe: missing `ratios` → not assignable.
- Readonly immutability on all 5 fields.

### `ReportRequest` (interface; required: `balanceSheet`, `profitLoss`, `reportType`)
- Fully-populated construction + exact 8-key set.
- Minimal construction (required trio only) → 3 keys.
- Per-field types: required `reportType: ReportType`; optional `format`, `options`, etc.
- Accepts every `ReportType` and every `ReportFormat` (loop).
- Carries nested `options` by identity.
- Compile-time fail-safe: missing `reportType` / missing `balanceSheet` → not assignable.
- Readonly immutability on all 8 fields.

## 4. Coverage rationale (requirement mapping)

| Requirement | How satisfied |
|---|---|
| Mirror source path under `tests/` | `tests/app/api/analysis/types/input.test.ts` |
| Cover every public symbol | All 7 interfaces + 3 type aliases + module resolution |
| Happy-path | Fully-populated construction + identity + per-member loops for each entry point |
| Edge cases | Empty `{}` / minimal construction, empty arrays, empty `ratios: {}`, empty `companyName`, `categories: []` |
| Max/min/boundary | `0`, `-1`, `MAX_SAFE_INTEGER` for all numeric fields; both boolean polarities |
| Error paths | Closed-union rejection (`string` / out-of-union literals) for every type alias |
| Fail-safe behavior | Compile-time `not.toMatchTypeOf` for missing-required-field shapes; out-of-union field rejection; readonly enforcement prevents mutation of request payloads |
| Determinism | No network/clock/random — pure type & literal construction; no fake timers needed |
| No new deps | Vitest only (already configured) |

## 5. Note on `@ts-expect-error` directives

The `@ts-expect-error` immutability checks are validated by `tsc --noEmit` (0 errors repo-wide
confirms each directive suppresses a genuine TS2540 "cannot assign to read-only property"),
not by the Vitest runtime (esbuild strips types). The mutation is wrapped in an uncalled
function so no runtime mutation occurs — mirroring `log.test.ts`.
