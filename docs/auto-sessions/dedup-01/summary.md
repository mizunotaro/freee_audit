# DEDUP-01 — Consolidate duplicated safe-number helpers into `src/lib/utils`

## Outcome
Extracted **one canonical** safe-number module (`src/lib/utils/safe-numbers.ts`, Result+Zod)
and rewired the duplicated rich implementations in `src/services/ai/analyzers/utils.ts` to
delegate to it. Also collapsed the private `round2`/`round4` duplicates in
`src/services/validation/journal-quality-validator.ts` onto the existing canonical
`roundToDecimal` in `src/lib/utils.ts`. Behavior-preserving; no Class-A path touched.

## What was duplicated (survey)

| Helper | Locations found | Non-Class-A? | Action |
|--------|-----------------|--------------|--------|
| `safeDivide` (rich: isSafeNumber + epsilon + percentage + fallback) | `services/ai/analyzers/utils.ts` | yes | **delegate to canonical** |
| `toSafeNumber` (coerce unknown→finite, comma/fullwidth strip, min/max/allowNegative) | `services/ai/analyzers/utils.ts` | yes | **delegate to canonical** |
| `clamp` (NaN-guarded) | `services/ai/analyzers/utils.ts` | yes | **delegate to canonical** |
| `round2` / `round4` | `services/validation/journal-quality-validator.ts` | yes | **replace with `roundToDecimal(x,2/4)`** |
| `safeDivide` (simple, no NaN guard) | `lib/utils.ts` | yes | **left — see below** |
| `safeDivide` (simple + `console.warn`) | `lib/ai/input-suggestion/utils.ts` | yes | **left — see below** |
| `clamp` (no NaN guard) | `lib/ai/input-suggestion/utils.ts` | yes | **left — see below** |
| `validateNumber` (`Number()`-based) | `lib/ai/input-suggestion/utils.ts` | yes | **left — see below** |
| `formatNumber`/`formatCurrency`/`formatPercent` | many | — | **left — not true duplicates** (each variant uses different scaling/units/locale; consolidating would change output) |

`src/services/valuation/**` also defines `formatNumber`/`formatPercent` but valuation is
Class-A (read-only reference only).

## Changes

### 1. NEW `src/lib/utils/safe-numbers.ts` (canonical, Result + Zod `safeParse`)
- `parseSafeNumber(value: unknown): Result<number, AppError>` — coerces `unknown` to a finite
  number: number passthrough, string normalization (strips half/fullwidth commas `[,，]`,
  converts fullwidth digits `[０-９]`, `parseFloat` leading-numeric semantics), rejects
  NaN/±Infinity/null/undefined/objects via a `z.number().refine(Number.isFinite)` schema.
- `safeDivide(numerator, denominator, { epsilon?, percentage? }): Result<number, AppError>` —
  Zod-validates both operands finite, guards `|denominator| <= epsilon`, validates the
  quotient finite, then applies `percentage` scaling (matches analyzers' order exactly:
  quotient is checked *before* scaling, so an overflow in `*100` is not re-caught — same as
  legacy).
- `clampNumber(value, min, max): Result<number, AppError>` — validates `value` finite only
  (not `min`/`max`), so NaN bounds propagate to `NaN` exactly like the legacy `clamp`.
  Returns `success(Math.max(min, Math.min(max, value)))`.
- All three return `Result<T, AppError>` from `@/types/result` and use `createAppError` /
  `ERROR_CODES.VALIDATION_ERROR`.

### 2. `src/services/ai/analyzers/utils.ts` — delegates (behavior-identical)
- `toSafeNumber` → `parseSafeNumber(value)`; on failure returns `fallback`; then applies
  `allowNegative` (reject→fallback) and `min`/`max` **clamp** (`Math.max/Math.min`). The
  canonical owns the coercion+finite logic; the wrapper owns option parsing + clamp + fallback.
- `safeDivide` → `safeDivideResult(...)`; parses the `number | {fallback,epsilon,percentage}`
  overload locally, maps `Result` failure→`fallback`, success→`data`.
- `clamp` → `clampNumber(value, min, max)`; maps failure→`min` (preserves the legacy
  NaN-value→min behavior).
- `isSafeNumber` (type guard) **kept as-is** — it is a leaf predicate still used by
  `approximatelyEqual` / `calculateSafeGrowthRate`; a `Result`-returning function cannot be a
  `value is number` guard, so it is out of scope for this canonical.
- Public re-exports in `analyzers/index.ts` (`safeDivide`, …) unchanged in name/signature.

### 3. `src/services/validation/journal-quality-validator.ts` — `round2`/`round4` removed
- Deleted private `round2`/`round4`; 6 call sites now call `roundToDecimal(x, 2)` /
  `roundToDecimal(x, 4)` from `@/lib/utils`.
- `round2(x) ≡ roundToDecimal(x, 2)` and `round4(x) ≡ roundToDecimal(x, 4)` are byte-identical
  (`Math.round(x·10^d)/10^d` with `Math.pow(10,2)=100`, `Math.pow(10,4)=10000` exact).

## Behavior-preservation evidence
- `tests/unit/services/ai/analyzers/utils.test.ts` pins `toSafeNumber` / `safeDivide` / `clamp`
  edge cases (NaN, Infinity, null/undefined, `'1,000'`, `'１００'`, epsilon, percentage, NaN→min).
  All pass unchanged against the delegating wrappers.
- Full analyzers suite (`tests/unit/services/ai/analyzers`, 23 files / 506 tests) passes —
  confirms no regression in `ratios/*` and `category/*` which call `safeDivide`.
- `tests/unit/services/validation/journal-quality-validator.test.ts` (41 tests) passes.

## Intentionally left untouched (cannot be done safely → documented, not done)
Per the task's "if something cannot be done safely, say so and leave it" clause:

- **`src/lib/utils.ts` `safeDivide` (simple variant).** Used by 20+ call sites in
  `services/ai/analyzers/ratios/*` and re-exported from `analyzers/index.ts`. Its semantics are
  `denominator===0 → 0, else numerator/denominator` with **no** NaN guard, so
  `safeDivide(5, NaN)` returns `NaN`. The canonical validates operands finite and would map
  NaN-denominator to a failure/fallback (`0`). Rewiring the 20+ call sites would therefore
  change NaN-propagation behavior for ratio computation. Left as-is.
- **`src/lib/ai/input-suggestion/utils.ts`** (`safeDivide`, `clamp`, `validateNumber`).
  Drifted semantics make consolidation a behavior change, not a dedup:
  - `safeDivide` emits `console.warn('Division by zero, returning 0')` (asserted by its test)
    and returns `NaN` for a NaN denominator (canonical would fail→0).
  - `validateNumber` uses `Number(value)` (no comma/fullwidth strip; `'1,000'`→`undefined`)
    whereas `toSafeNumber`/`parseSafeNumber` use `parseFloat`+normalization (`'1,000'`→`1000`).
  - `clamp` has no NaN guard (NaN value→`NaN`) vs analyzers' `clamp` (NaN value→`min`).
  Only `clamp` is imported by `src` (`input-suggester.ts`); `safeDivide`/`validateNumber` are
  test-only here. Left as-is to avoid behavior change.

## Constraints honored
- No Class-A path modified (`prisma/**`, `lib/auth*`, `lib/crypto`, `lib/security`,
  `lib/audit`, `services/{audit,conversion,valuation,tax,kpi,debt,deferred-accrual,
  journal-proposal,freee}`, `lib/integrations/freee`, `app/api/{audit,journals,…}`,
  `python-service`, `r-service`). Valuation's `formatNumber`/`formatPercent` were read-only.
- No `any` / `@ts-ignore` / `@ts-expect-error` / `.skip` / lint-disable / coverage lowering.
- New helpers return `Result<T, AppError>` and validate with Zod `safeParse`.
- Additive / minimal diffs; matched existing `lib/utils/*` + `analytics/*` Result+Zod idiom.
- No new dependencies (reuses `zod@^3.23`).
- Ran only affected tests + the diff-scoped gate (never the full suite).

## Tests added — `tests/unit/lib/utils/safe-numbers.test.ts` (22 tests)
Covers `parseSafeNumber` (passthrough, comma/fullwidth strip, parseFloat semantics, NaN/
Infinity/null/undefined/object rejection, AppError shape), `safeDivide` (basic, negative,
decimal, zero/`-0`, epsilon boundary, NaN/Infinity operands, percentage), `clampNumber`
(within/below/above range, boundaries, NaN/Infinity value failure, NaN-bounds propagation).

## Verification
`node scripts/autopm_verify.mjs --changed-only` → **exit 0**
- typecheck (whole repo, filtered to diff): total errors=0, relevant=0
- eslint: 4 files, `--max-warnings=0`, clean
- vitest: 3 resolved files (`safe-numbers.test.ts`, `analyzers/utils.test.ts`,
  `journal-quality-validator.test.ts`) — 153 tests passed
