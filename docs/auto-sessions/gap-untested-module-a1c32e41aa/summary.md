# Summary — gap-untested-module-a1c32e41aa

Add unit tests for `src/components/conversion/resolve-list-status.ts`.

## Scope

`resolve-list-status.ts` is a small pure-logic module that turns a list-view's
`{ loading, error, dataLength }` triple into one of four resolution states
(`loading | error | empty | ready`), using Zod for input validation and the
project `Result<T>` pattern for return values.

Public exports covered:

| Export | Kind | Covered |
|---|---|---|
| `LIST_RESOLUTIONS` | readonly tuple const | ✅ |
| `ListResolution` | type | ✅ (runtime + type-level helper) |
| `resolveListStatusInputSchema` | Zod object schema | ✅ |
| `ResolveListStatusInput` | type | ✅ (typed-input ergonomics test) |
| `resolveListStatus(input)` | function → `Result<ListResolution>` | ✅ |

## Deliverable

New test file: `tests/components/conversion/resolve-list-status.test.ts`
(41 tests, all passing). No production code changed.

> Note: `tests/components/conversion/list-state.test.tsx` already exercised
> `resolveListStatus` superficially alongside the `ListState` component. This
> task adds a dedicated, exhaustive module-level suite focused solely on
> `resolve-list-status.ts` — it is not a duplicate.

## Assertions added (41)

### `LIST_RESOLUTIONS` (2)
- Exposes `['loading', 'error', 'empty', 'ready']` in precedence order.
- Readonly tuple of 4 unique values.

### `resolveListStatusInputSchema` (6)
- Defaults every omitted field → `{ loading: false, error: null, dataLength: 0 }`.
- Preserves explicitly provided values.
- Accepts nullable error (`null` and string).
- Strips unknown fields (default Zod strip behavior).
- Rejects negative `dataLength`.
- Rejects non-integer `dataLength`.

### Happy paths (5)
- `ready` when data present and nothing wrong.
- `empty` when no data and nothing wrong.
- `error` when not loading but error is a non-empty string.
- `loading` when `loading: true`.
- Empty object `{}` → `empty` (all defaults).

### Precedence `loading > error > empty > ready` (4)
- Loading wins over error and empty.
- Error wins over empty.
- Error wins over ready (even with data present).
- Empty vs ready boundary at `dataLength` 0 → 1.

### Edge cases (6)
- `null` error treated as "no error".
- Empty-string `''` error treated as "no error" (fail-safe: falsy ignored).
- `Number.MAX_SAFE_INTEGER` dataLength → `ready`.
- 10 000-char error string → `error`.
- Only `loading` provided → `loading`.
- Only `dataLength: 0` provided → `empty`.

### Validation / error paths (11)
- Negative `dataLength` → failure with `VALIDATION_ERROR`.
- Non-integer `dataLength` (2.5) → failure.
- Numeric-string `dataLength` (`'5'`, no coercion) → failure.
- `NaN` dataLength (fails `.int()`) → failure.
- `Infinity` dataLength (fails `.int()`) → failure.
- Non-boolean `loading` (`'yes'`, `1`) → failure.
- Non-string/non-null `error` (`123`, object, array) → failure.
- `null` input → failure.
- `undefined` input → failure.
- Primitive non-object input (`'loading'`, `42`, `true`) → failure.
- Array input → failure.

### Failure Result shape (4)
- Localized message: `リスト状態の解決に失敗しました`.
- Zod issues attached under `details.issues` (array, length 1 for single-field fault).
- Offending path reported (`dataLength`).
- `error.timestamp` is a `Date`.

### Fail-safe behavior (2)
- A battery of 14 invalid inputs (incl. `Symbol`, `±Infinity`, `NaN`, `null`,
  `undefined`, arrays, wrong-typed fields) never throws — function always
  returns a `Result`.
- Every fault mode degrades to a structured failure (truthy `error` with a
  string `code`), never a thrown exception.

### Type ergonomics (1)
- A fully-formed `ResolveListStatusInput` object resolves without coercion.

## Coverage rationale

The module's risk surface is (a) the precedence chain and (b) Zod validation
feeding the `Result` boundary. The suite therefore:

- **Happy paths** pin each branch of the precedence chain.
- **Precedence block** independently verifies the `loading > error > empty >
  ready` ordering by combining contradicting signals — guarding against an
  accidental reorder of the four `if` returns.
- **Edge cases** cover boundary (`dataLength` 0/1), falsy-but-valid `error`
  (`''`), and extremes (max safe int, very long string).
- **Error paths** enumerate every field-level rejection (negative,
  non-integer, non-numeric, NaN, Infinity, wrong type) plus every shape-level
  rejection (null, undefined, primitive, array) so a schema loosening is
  caught.
- **Failure shape** locks the contract downstream callers depend on:
  `VALIDATION_ERROR` code, localized message, `details.issues` payload, and
  timestamp.
- **Fail-safe** asserts the hard guarantee that bad input degrades to a
  structured `Result` rather than throwing — the property that lets callers
  treat the return value uniformly without try/catch.

## Verification

- `corepack pnpm exec vitest run tests/components/conversion/resolve-list-status.test.ts`
  → 1 file, 41 tests, all pass.
- `corepack pnpm exec eslint --max-warnings=0` on the new file → 0 warnings.
- `corepack pnpm exec tsc --noEmit` → no errors referencing the new file.
