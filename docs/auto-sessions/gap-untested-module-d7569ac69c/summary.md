# gap-untested-module-d7569ac69c — Unit tests for `src/types/reports/periodic.ts`

**Target file:** `src/types/reports/periodic.ts` (pure TypeScript interfaces, no runtime exports)
**New test file:** `tests/unit/types/reports/periodic.test.ts`
**Result:** 25 tests, all passing. `eslint --max-warnings=0` clean. `tsc --noEmit` clean for the file.

## Module under test

`periodic.ts` declares 7 interfaces (zero runtime values / functions / constants):

| Interface | Kind |
|---|---|
| `PeriodBalanceSheet` | 7 numeric monetary buckets |
| `PeriodProfitLoss` | 6 numeric P&L lines |
| `PeriodCashFlow` | 4 numeric CF buckets |
| `PeriodKPIs` | 6 numeric ratios |
| `PeriodData` | composed period (label/years/months + the 4 sub-objects + endingCash) |
| `PeriodicSummary` | growth/avg-ratios + trend text; `revenueGrowth`/`profitGrowth` are `number \| null` |
| `PeriodicReportData` | `{ periods: PeriodData[]; summary: PeriodicSummary }` |

## Test approach (3-layer idiom)

Because the module is type-only, tests follow the established `tests/unit/types/*.test.ts`
convention (see `ir-report.test.ts`): **runtime `expect`** (construct a valid instance and assert
field values — this is what prevents fake-green), **typed assignment** (the object literal must
satisfy the interface at compile time), and **`expectTypeOf`** (exact structural assertions).
`import type` is used; `src/types/**` is excluded from coverage in `vitest.config.ts`, which is
correct for a types-only module.

## Coverage rationale

- **Happy path:** every interface is constructed with realistic financial figures and every field
  is read back by name via `expect`.
- **Edge / boundary:** zeroed values (empty balance sheet, zeroed P&L/CF/KPIs), negative values
  (insolvent equity, loss-making P&L, net cash drain), over-leveraged ratios, and the empty
  `periods: []` series.
- **Fail-safe behavior:** the `number | null` union on `revenueGrowth` / `profitGrowth` is the
  module's safe-degradation state for "no prior period to compare". It is exercised with both-null
  (first period), mixed null/numeric (profit newly recognized), and asserted at the type level via
  `toEqualTypeOf<number | null>`.
- **Composed types:** `PeriodData` is built both by reference (proving nesting) and inline (proving
  the literal compiles standalone); `PeriodicReportData` is exercised with 0, 1, and 3 periods
  (order preserved).
- **No error/timeout paths** exist for this module — there is no runtime code that can throw or time
  out. Asserting this would require runtime behavior the module does not have.

## Assertions added (by describe block)

### `PeriodBalanceSheet`
- `exposes the seven monetary buckets` — 7 `expect(...).toBe(n)`.
- `accepts zero values across every bucket` — every value is `0`.
- `accepts negative equity / insolvency values` — `equity` < 0.
- `is exactly a flat object of seven numeric fields` — `expectTypeOf(...).toEqualTypeOf<{...}>`.

### `PeriodProfitLoss`
- `exposes the six P&L line items` — 6 `toBe`.
- `accepts a loss-making period with negative bottom lines` — gross/net < 0.
- `is exactly a flat object of six numeric fields` — exact-shape `toEqualTypeOf`.

### `PeriodCashFlow`
- `exposes the four cash-flow buckets` — 4 `toBe`.
- `accepts net cash outflow across all buckets` — all buckets < 0.
- `is exactly a flat object of four numeric fields` — exact-shape `toEqualTypeOf`.

### `PeriodKPIs`
- `exposes the six ratio fields` — 6 `toBe`.
- `accepts boundary ratios including zero and heavily leveraged states` — all-zero + over-leveraged.
- `is exactly a flat object of six numeric fields` — exact-shape `toEqualTypeOf`.

### `PeriodData`
- `exposes the period identity and span` — label/fiscalYear/startMonth/endMonth/endingCash.
- `nests the four financial sub-objects by reference` — `toBe(sameReference)`.
- `still compiles when each sub-object is built inline`.
- `declares the nested sub-object types verbatim` — `PeriodData['balanceSheet']` etc. via `toEqualTypeOf`.

### `PeriodicSummary`
- `exposes the aggregate growth, average ratios, and trend text` — all 6 fields.
- `allows null growth for the first period` — both-null safe degradation + `toBeNull`.
- `allows mixed null / numeric growth`.
- `types the growth fields as nullable numbers and the rest as required scalars` — `toEqualTypeOf<number | null>` for growths; `number`/`string` for the rest.

### `PeriodicReportData`
- `bundles the period series and the summary`.
- `accepts an empty period list (no data yet) — safe degradation` — `periods: []`.
- `accepts a multi-period series preserving insertion order` — 3-period label check.
- `declares periods as a PeriodData array and summary verbatim` — `toEqualTypeOf`.

## Note on `Record<string, number>` assertions

An earlier draft used `expectTypeOf<X>().toMatchTypeOf<Record<string, number>>()` to assert
"every field is a number". Vitest's `expectTypeOf` rejects `Record<string, number>` as a
`toMatchTypeOf` target (TS2344 constraint violation), so these were replaced with exact-shape
`toEqualTypeOf<{ …all numeric fields… }>` assertions, which are strictly stronger (full contract
equality, not assignability) and compile cleanly.
