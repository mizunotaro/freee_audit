# gap-untested-module-4d6451a362 — Unit tests for `src/lib/ai/context/context-types.ts`

**Risk class:** B
**Target:** `src/lib/ai/context/context-types.ts`
**Test file:** `tests/unit/lib/ai/context/context-types.test.ts` (new, 51 tests)
**Date:** 2026-07-12

## Module shape

`context-types.ts` is a mostly-type-only module: 11 interfaces, 1 generic
discriminated-union type (`ContextResult<T>`), and a single runtime export —
the `DEFAULT_SESSION_CONFIG` constant. There are no functions/classes with
runtime behavior to exercise, so the test follows the repo's established
pure-types testing pattern (see `tests/unit/types/ocr.test.ts`):

1. **Runtime `expect`** on the live `DEFAULT_SESSION_CONFIG` constant.
2. **Runtime `expect`** constructing a value of every interface (proves the
   declared shape is usable and not fake-green).
3. **`expectTypeOf`** assertions for union equality (type-parameter form) and
   assignability (`toMatchTypeOf` for value→type), per the expectTypeOf
   union-equality quirk.

## Placement rationale

The task suggested `tests/lib/ai/context/`, but the established mirror for
this exact source directory is `tests/unit/lib/ai/context/` (its siblings
`context-manager.test.ts` and `token-counter.test.ts` live there). Placing
the file alongside them keeps it under the runner's `tests/**/*.test.ts`
include and consistent with the existing tree.

## Assertion inventory (51 tests)

### `DEFAULT_SESSION_CONFIG` (runtime constant) — 8 tests
- `maxMessages === 50`
- `maxTokens === 8000`
- `ttlMs === 86_400_000` (exactly one day — boundary value)
- `compressionThreshold === 0.8`
- exposes exactly the 4 `SessionConfig` keys (no extra/missing fields)
- **fail-safe bounds**: `maxMessages`, `maxTokens`, `ttlMs` all `> 0` and
  `0 < compressionThreshold <= 1` (the defaults must be a usable non-degenerate
  cap even before any caller config)
- `expectTypeOf(DEFAULT_SESSION_CONFIG).toMatchTypeOf<SessionConfig>()`
- each `SessionConfig` field typed as `number`

### `SessionConfig` — 3 tests
- accepts a fully-populated object (runtime expect on all 4 fields)
- accepts boundary zero-ish values a caller might still configure (`1`, `0`)
- value matches the `SessionConfig` type

### `MessageRole` — 3 tests
- `type` is exactly `'user' | 'assistant' | 'system'` (union equality)
- each role literal accepted at runtime
- `persona` optional, typed `PersonaType | undefined`

### `ContextMessage` — 4 tests
- minimal required shape (persona/metadata omitted → undefined)
- full shape with persona + metadata
- empty metadata record + empty content (boundary)
- `role` accepts every `MessageRole['type']` literal

### `TrackedEntity` — 5 tests
- `type` is exactly the 6-member union (`company | period | account | amount | ratio | concept`)
- all 6 type literals accepted at runtime
- `value` optional (omit valid)
- `value` as string **and** as number; typed `string | number | undefined`
- `mentionCount` accepts `0` (boundary)

### `SessionSummary` — 3 tests
- `sentiment` is exactly `'positive' | 'neutral' | 'negative'`
- each sentiment literal accepted at runtime
- accepts empty readonly arrays (boundary)

### `Session` — 3 tests
- minimal session with empty `messages`/`entities` (boundary); companyId/summary undefined
- optional `companyId` and `summary` accepted
- `messages`/`entities` typed `readonly ContextMessage[]` / `readonly TrackedEntity[]`

### `ContextManagerOptions` — 3 tests
- empty object valid (both fields optional)
- partial `defaultConfig` (`Partial<SessionConfig>`) accepted
- `storageAdapter` accepted alongside `defaultConfig`

### `StorageAdapter` (contract + fail-safe behavior) — 6 tests
An in-memory adapter (plain `Map`, no external deps) exercises the contract:
- `get(missing)` resolves to `null` — the **safe not-found** state
- `set` → `get` round-trips a session
- `set` resolves to `void`
- `delete` removes a stored session (subsequent `get` → null)
- `delete` of a **missing** session resolves without throwing (idempotent fail-safe)
- the three methods are typed `(id) => Promise<Session | null>`,
  `(id, session) => Promise<void>`, `(id) => Promise<void>`

### `AddMessageOptions` — 2 tests
- empty object valid
- persona-alone and metadata-alone both valid

### `ContextFitResult` — 3 tests
- `fits=true` with `tokensToTrim=0` (everything fits — boundary)
- `fits=false` requesting compression
- boolean/number field types asserted

### `CompressionResult` — 3 tests
- result without optional `summary`
- result with `summary`
- boundary ratios (`0` = no compression, `1` = full savings) and `compressedTokenCount=0`

### `ContextResult<T>` (discriminated union) — 5 tests
- success branch carries `data: T`
- failure branch carries `error: { code, message }`
- narrows correctly: success branch exposes `data`, failure branch exposes `error`
  (built via a factory returning the full union so both branches stay reachable)
- generic substitution verified with `ContextResult<Session>`
- failure-branch `error` is exactly `{ code: string; message: string }`

## Edge / boundary / fail-safe coverage summary

- **Boundary values**: `tokenCount: 0`, `mentionCount: 0`, `mentionCount` empty,
  empty `messages`/`entities`/`keyEntities`/`topicCategories`, empty `metadata`,
  `compressionRatio` 0 and 1, `compressedTokenCount` 0, `SessionConfig` minima (`1`/`0`),
  `ContextFitResult` `tokensToTrim: 0` / `messagesToFit: 0`.
- **Optional-field omission**: every optional field (`persona`, `metadata`,
  `value`, `companyId`, `summary`, `defaultConfig`, `storageAdapter`, `summary` on
  CompressionResult) is asserted both present and absent.
- **Fail-safe behavior**: `DEFAULT_SESSION_CONFIG` always provides positive,
  in-range bounds (a usable cap with zero caller config); `StorageAdapter.get`
  degrades missing sessions to `null` (not a throw); `StorageAdapter.delete` is
  idempotent on missing keys (no throw).

## Determinism

No network, clock, or unseeded random is used. All `Date` instances are
`new Date(0)` / `new Date(1)` (fixed epoch). The `StorageAdapter` exercises use a
local `Map`.

## Quality gate results

- `vitest run tests/unit/lib/ai/context/context-types.test.ts` → **51 passed**
- `tsc --noEmit` (full repo, after `db:generate`) → **0 errors**
- `eslint <file> --max-warnings=0` → **0 warnings**

## Notes / non-issues

- Coverage for this file is driven almost entirely by the `DEFAULT_SESSION_CONFIG`
  import (interfaces are erased at runtime). The value of these tests is contract
  correctness (runtime shape + `expectTypeOf`), not line coverage.
- `expectTypeOf` union-equality assertions use the type-parameter form
  (`expectTypeOf<X>().toEqualTypeOf<Union>()`); value→type checks use
  `toMatchTypeOf` to avoid the vitest-4 union `toEqualTypeOf` never-constraint quirk.
