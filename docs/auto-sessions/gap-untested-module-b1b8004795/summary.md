# gap-untested-module-b1b8004795 — Unit tests for `src/types/reports/common.ts`

**Risk class:** C · **Detected:** 2026-07-09 · **Target:** `src/types/reports/common.ts`

## What was done

Added `tests/unit/types/reports/common.test.ts` — unit tests for the pure-types module
`src/types/reports/common.ts`, which exports five type-only interfaces and has no
runtime values or functions:

| Interface | Shape |
|-----------|-------|
| `PeriodRange` | `{ startDate: Date; endDate: Date }` |
| `ComparisonData` | `{ current, previous, change, changePercent: number }` |
| `TrendData` | `{ category: string; score: number; status: string; summary: string }` |
| `ChartDataPoint` | `{ name: string; value: number; previousValue?: number; color?: string }` |
| `StatusBadge` | `{ status: 'good' \| 'warning' \| 'bad'; label: string }` |

The tests follow the established repo convention for type modules
(see `tests/unit/types/{result,accounting-standard,ir-report}.test.ts`): three layers —
**runtime `expect`** + **typed assignment** + **`expectTypeOf`** type-level assertions.
Every interface gets at least one runtime assertion (avoids the "fake-green" trap where a
type-only module's tests silently pass without exercising anything at runtime).

### File placement decision

The gap task suggested `tests/types/reports/`. The repo's established convention for
`src/types/**` unit tests is `tests/unit/types/<name>.test.ts` (flat). To satisfy both,
the file was placed at **`tests/unit/types/reports/common.test.ts`** — the established
`tests/unit/types/` root (preserving the `unit` test tier) with the source path's
`reports/common` tail mirrored as a subfolder. `vitest.config.ts` includes
`tests/**/*.test.ts`, so the file is discovered from either location.

## Assertions added

### `PeriodRange`
- Happy: constructs with start/end dates; both retained and `instanceof Date`.
- Edge: zero-length range (start === end); reversed range preserved as data; epoch and
  far-past/far-future boundaries (`±8.64e15` ms).
- Type: exactly `{ startDate: Date; endDate: Date }` (exact-equality + `toEqualTypeOf`).

### `ComparisonData`
- Happy: positive growth; decline (negative change/percent); no-change (zeros).
- Edge: numeric boundaries — `0`, `Number.MAX_VALUE`, `Number.MIN_VALUE`, `±Infinity`,
  `NaN` (all valid `number`); asserts `changePercent` can be `NaN` via `.toBeNaN()`.
- Type: exactly four numeric fields.

### `TrendData`
- Happy: typical entry.
- Edge: zero and negative score; empty strings for every text field; fractional and
  `MAX_VALUE` scores.
- Type: `category`/`status`/`summary` are `string`, `score` is `number`; exact shape.

### `ChartDataPoint`
- Happy: all fields populated.
- Edge: optional `previousValue`/`color` omitted (asserts `undefined` + key set is exactly
  `['name','value']`); zero value + empty name; `previousValue: NaN` / `color: ''`.
- Type: optionals are genuinely optional (minimal object `toMatchTypeOf`); full shape
  `toEqualTypeOf`; **fail-safe**: an object missing the required `name` is rejected
  (`.not.toMatchTypeOf`).

### `StatusBadge`
- Happy: `it.each` over all three union members (`good`/`warning`/`bad`).
- Edge: empty label.
- Type / fail-safe: `status` is exactly the 3-member literal union (`toEqualTypeOf`);
  an out-of-union literal (`'unknown'`) and a wider type (`number`) are both rejected
  (`.not.toMatchTypeOf`) — the safe state where only valid statuses are permitted.

### `module surface`
- All five interfaces resolve as non-`any` type contracts (`.not.toBeAny()`), confirming
  the module exports exactly these named types.

## Coverage rationale

`src/types/**` is excluded from the v8 coverage config (`vitest.config.ts`), so these
tests do not move coverage numbers. Their purpose is **contract regression protection**:
if an interface's required fields, optionality, or the `StatusBadge` literal union drift,
the `expectTypeOf` assertions fail the typecheck step of the gate. Runtime assertions
guard the data shapes against accidental restructuring (renamed keys, dropped fields).

## "Error / fail-safe" interpretation for a pure-types module

A type-only module has no runtime functions that throw, no dependencies that can fail,
and no I/O to time out. Its fail-safe behavior **is** type enforcement: invalid inputs
(an unknown status, a dropped required field) are rejected at compile time rather than
degrading silently at runtime. The `.not.toMatchTypeOf` assertions in the `ChartDataPoint`
and `StatusBadge` blocks encode exactly that guarantee. This is the honest, non-fake-green
way to cover "error paths / fail-safe" for a pure-types target.

## Verification

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm exec vitest run tests/unit/types/reports/common.test.ts
corepack pnpm exec tsc --noEmit   # type-level (expectTypeOf) checks
```

All assertions pass and typecheck cleanly (see run output in the session).
