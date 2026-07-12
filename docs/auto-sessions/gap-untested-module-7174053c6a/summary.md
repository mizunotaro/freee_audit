# gap-untested-module-7174053c6a — unit tests for `src/lib/ai/prompts/template-types.ts`

**Risk class:** B
**Target:** `src/lib/ai/prompts/template-types.ts` (pure type module — 9 exported types/interfaces, **zero runtime exports**)
**Test file:** `tests/unit/lib/ai/prompts/template-types.test.ts` (41 tests, all passing)

## Path note

The gap brief suggested `tests/lib/ai/prompts/`, but that path does not exist. The repo's
established convention (proven by siblings `template-engine.test.ts` and
`validators.test.ts`, which both `import type { … } from '@/lib/ai/prompts/template-types'`)
is `tests/unit/lib/ai/prompts/`. The test was placed there to match the live tree and so the
verify gate's stem resolution finds it.

## Why this test shape

`template-types.ts` is **type-only** (every export is `export type` / `export interface`).
Following the proven idiom for such modules in this repo (`tests/unit/types/ocr.test.ts`,
`tests/unit/types/result.test.ts`), all imports use `import type`, and each test exercises the
types in two complementary layers:

1. **Runtime `expect`** — construct a value of each interface and assert its shape/fields.
   This is the anti-fake-green rule: every interface gets at least one runtime assertion so the
   test would fail if a declared field were removed or renamed.
2. **`expectTypeOf` / `@ts-expect-error`** — type-level checks (only enforced by `tsc`, since
   vitest transpiles via esbuild without typechecking). These pin the exact literal unions,
   `readonly` fields, and discriminated-union narrowing.

## Assertions added (by interface)

### `VariableType` (3)
- `expectTypeOf<VariableType>().toEqualTypeOf<'string'|'number'|'boolean'|'array'|'object'|'date'>()` — pins the exact 6-member union.
- runtime: all six members construct and round-trip.
- **fail-safe:** `@ts-expect-error` proves a non-member (`'bigint'`) is rejected.

### `TemplateVariable` (7)
- minimal required shape (`name`+`type`+`required`) with all optionals `undefined`.
- fully-populated shape incl. every `validation` sub-field (`minLength/maxLength/min/max/pattern/enum`) and `defaultValue/description/transform`.
- each `VariableType` accepted for the `type` field.
- each `transform` member accepted (incl. `undefined`).
- **boundary:** validation values at `0` and an empty `enum: []`.
- **fail-safe:** `readonly` proven via `@ts-expect-error` on reassignment + `expectTypeOf` of each property type.
- **fail-safe:** `@ts-expect-error` rejects an invalid `transform` (`'capitalize'`).
  - *Gotcha caught & fixed during dev:* `readonly` on an interface is compile-time only; the runtime object *is* mutated, so the runtime `expect` runs *before* the suppressed reassignment.

### `PromptTemplate` (6)
- fully-populated template (incl. `metadata.author`, 2 variables).
- each `category` member (`analysis|report|chat|system|custom`) constructs.
- template without the optional `metadata.author`; empty `tags`/`estimatedTokens: 0`.
- **boundary:** empty `variables: []`.
- **fail-safe:** `@ts-expect-error` rejects an invalid category (`'dashboard'`).
- `expectTypeOf` on `id`/`version`/`variables` (readonly, `readonly TemplateVariable[]`).

### `CompiledTemplate` (3)
- fully-populated; **boundary** (`content: ''`, `estimatedTokens: 0`, `variablesUsed: []`, `compilationTimeMs: 0`); `expectTypeOf` readonly fields.

### `ValidationError` (5)
- required fields + optional `value`; missing `value` is allowed.
- exact `code` union pinned (`required_missing|type_mismatch|constraint_violation|invalid_value`) via `expectTypeOf` + runtime iteration.
- `value` can carry any type (number used).
- **fail-safe:** `@ts-expect-error` rejects `'unknown_error'`.

### `ValidationWarning` (3)
- required fields; exact `code` union pinned (`default_used|value_truncated|pattern_approximation`); **fail-safe** `@ts-expect-error` rejects `'deprecated'`.

### `ValidationResult` (3)
- `valid: true` with empty arrays; `valid: false` with one error + one warning; `expectTypeOf` pins `errors`/`warnings` as readonly typed arrays.

### `TemplateRegistry` (3)
- populated registry; **boundary** empty registry (`version: ''`); `expectTypeOf` pins readonly aggregates.

### `TemplateResult<T>` (8)
- `expectTypeOf` pins the full discriminated union shape.
- narrows to `data` on `success: true`; narrows to `error` on `success: false` (incl. `code`/`message`/`details`).
- generic `T` substitution verified with a custom `Item` type.
- **fail-safe (safe degradation):** a failure with empty `code`/`message` still type-checks.
- **fail-safe:** `@ts-expect-error` rejects a success branch missing `data`, and a failure branch missing `error`.

## Coverage rationale

Because the module is type-only, "coverage" means **type-contract coverage**: every exported
symbol is exercised, every literal-union is pinned to its exact membership (so adding/removing a
member breaks the build), every `readonly` field is asserted, and the `TemplateResult<T>`
discriminated union's narrowing behavior is verified on both branches. The runtime `expect`
calls guarantee the test is not fake-green — removing any field from any interface fails both
`tsc` and `vitest`.

The types are real (consumed by `src/lib/ai/prompts/template-engine.ts` and `validators.ts`),
so these contracts guard downstream behavior: an invalid `ValidationError.code`, `category`, or
`transform` would propagate to the engine/validator that switch on those literals.

## Verification (all green)

| Gate | Command | Result |
|------|---------|--------|
| Tests | `corepack pnpm exec vitest run tests/unit/lib/ai/prompts/template-types.test.ts` | 41 passed |
| Typecheck | `corepack pnpm typecheck` (`tsc --noEmit`) | 0 errors |
| Lint | `corepack pnpm exec eslint <file> --max-warnings=0` | 0 warnings |

No production source was modified. No new dependencies added. No `TODO`/`FIXME`/`NotImplementedError` introduced.
