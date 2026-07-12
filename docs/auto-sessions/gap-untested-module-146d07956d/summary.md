# gap-untested-module-146d07956d — unit tests for `orchestrator-types.ts`

**Target module:** `src/lib/ai/orchestrator/orchestrator-types.ts`
**Risk class:** B
**New test file:** `tests/unit/lib/ai/orchestrator/orchestrator-types.test.ts`
**Result:** 62 tests, all green. `pnpm typecheck` 0 errors, ESLint `--max-warnings=0` clean.

## Nature of the target module

`orchestrator-types.ts` is a **pure type-only module**: 2 exported unions
(`IntentType`, `OrchestratorEvent`) and 11 exported interfaces. There is **no
runtime code** — after type-stripping the module is empty. Per repo convention
(see `tests/unit/types/*`, e.g. `result.test.ts`, `ocr.test.ts`) type-only
modules are still given a real test, and `vitest.config.ts` excludes `src/types/**`
from coverage so line% is never the metric — green tests + clean `tsc` are.

The test follows the established **3-layer pattern** so it is not fake-green:
1. **Runtime `expect()`** per interface — vitest catches this.
2. **Typed assignment** `const x: Iface = {...}` — `tsc` catches removed/renamed required fields.
3. **`expectTypeOf`** (global via `globals:true`) for union membership,
   optional-vs-required, readonly, and `readonly T[]` array variance.

## Placement note

The task generator guessed `tests/lib/ai/orchestrator/`. The actual repo
convention (per `CLAUDE.md §3` "tests/unit/ mirrors src/" and the 6 sibling
test files already present: `orchestrator.test.ts`, `intent-router.test.ts`,
`model-selector.test.ts`, `complexity-analyzer.test.ts`,
`response-synthesizer.test.ts`, `task-classifier.test.ts`) is
`tests/unit/lib/ai/orchestrator/`. The new file is placed there to sit beside
its siblings; `vitest.config.ts` `include: ['tests/**/*.test.ts']` picks it up.

## Coverage rationale — assertion inventory (by surface)

### Module surface
- `await import('@/lib/ai/orchestrator/orchestrator-types')` resolves (type-only → empty object). Smoke test that the path/exports are valid; uses `await import`, not `require` (undefined in vitest's ESM env).

### `IntentType` union (9 literals)
- Fully-typed member array `INTENT_TYPES` asserted at **length 9** and `new Set().size === 9` (catches removal/rename at runtime AND compile time).
- Representative literal satisfies the type at runtime.
- `expectTypeOf<IntentType>().toEqualTypeOf<'...9 literals...'>()` — type-param form (proven green for string-literal unions).
- Closed-union guard: `expectTypeOf<string>().not.toMatchTypeOf<IntentType>()` (arbitrary strings are rejected).

### `IntentClassification`
- Fully-populated construction + runtime field expects.
- **Edge**: empty `secondary: []` and `keywords: []`.
- **Boundary**: `confidence` 0 and 1.
- `confidence` typed `number` (type-param `toEqualTypeOf`).
- **readonly guard**: `@ts-expect-error` (≥3-char desc, satisfies ESLint `ban-ts-comment`) inside a never-invoked closure → runtime object stays pristine; trailing `expect(ic.primary)` still holds.

### `WorkflowStep`
- Fully-populated construction; `dependencies: ['setup-step']`, `parallel`/`optional` booleans.
- **Edge**: dependency-free step (`dependencies: []`, `optional: true`).
- `dependencies` is `readonly string[]` (array variance); `persona` matches `PersonaType`.
- **readonly guard** on `id` and `task`.

### `WorkflowDefinition`
- Fully-populated construction (2 steps).
- **Edge**: empty `steps: []`.
- `steps` is `readonly WorkflowStep[]`.
- **readonly guard** on `id`/`version`.

### `OrchestratorContext`
- Minimal construction (only required fields) — proves `companyId` and `financialData` are truly optional.
- All-optional-fields-populated construction.
- `language` is exactly `'ja' | 'en'`; `companyId` is `string | undefined`; `financialData` is `Record<string, unknown> | undefined`.
- **readonly guard** on `sessionId`.

### `ConversationTurn`
- User turn without `personaUsed`; assistant turn with `personaUsed`.
- `role` is exactly `'user' | 'assistant'`; `personaUsed` is `PersonaType | undefined`; `timestamp` is `Date` (runtime `toBeInstanceOf`).
- **readonly guard** on `role`.

### `OrchestratorRequest`
- Minimal construction (`query` + `context` only — `constraints` optional).
- **Edge**: empty-string `query`.
- Full `constraints` populated (maxCost, maxLatencyMs, preferredPersonas, enableReproducibility, seed, temperature).
- **Boundary**: zero-valued bounds (`maxCost: 0`, `maxLatencyMs: 0`, `seed: 0`, `temperature: 0`).
- Each `constraints` field individually optional (empty `{}`).

### `PersonaAnalysis`
- Fully-populated (uses `buildPersonaResponse` helper for the nested `PersonaResponse`).
- `response` carries the full `PersonaResponse` shape (confidence, metadata.templateVersion).
- **Boundary**: `executionTimeMs: 0` and `tokensUsed: 0`.
- **readonly guard** on `modelUsed`.

### `SynthesizedResponse`
- Fully-populated (`personaAnalyses` = all 5 personas).
- **Edge**: all-empty collections + empty summary + zeroed confidence/cost.
- `personaAnalyses` is `readonly PersonaAnalysis[]`; `confidence`/`totalCost` are `number`.
- **readonly guard** on `summary`.

### `DivergentView`
- Multiple perspectives; **edge**: empty `perspectives: []`.
- `perspective.persona` matches `PersonaType`.
- **readonly guard** on `topic`.

### `OrchestratorResult` (flat interface, NOT a discriminated union)
- Success result construction (response present, error absent).
- **Error path / fail-safe**: error result constructed for **every** of the 4 closed error codes (`no_personas`, `all_failed`, `timeout`, `invalid_input`) — proves the safe-state codes are all constructible.
- `partialResults` optional: error result tolerates its absence **and** carries it when present.
- `metadata` is always present (success and error) — positive shape assertion via `toMatchTypeOf<{4 fields}>`.
- `error.code` closed set: length 4 + `Set.size === 4`; full error shape via `toMatchTypeOf`.
- **Independently-optional**: `response`/`error` stay `T | undefined` regardless of `success` (the flag is `boolean`, not a literal discriminator — asserts the honest optional shape; this substitutes for the "narrows" framing, which does not apply).
- **readonly guard** on `success`.

### `OrchestratorEvent` discriminated union (8 arms)
- 8 documented event types — length 8 + `Set.size === 8`.
- `OrchestratorEvent['type']` is exactly the 8-member literal union (type-param `toEqualTypeOf`).
- **Every arm constructible** with a well-typed payload; the type map equals `EVENT_TYPES`.
- `persona_failed` carries a real `Error` instance; `persona_started.data` is the `{persona, stepId}` pair.
- **Per-discriminator narrowing**: iterate over an `OrchestratorEvent[]` (so `ev` keeps the full 8-arm union — a single object literal would narrow `ev` to one arm and make the other switch cases unreachable, TS2678) and `switch (ev.type)` with `expectTypeOf(ev.data).toEqualTypeOf<...>()` + a runtime expect in each arm.

## Fail-safe / error-path mapping (task spec vs. type-only module)

The task spec asks for "error paths: invalid inputs, dependency failures, timeouts" and "fail-safe behavior." For a type-only module these translate to structural fail-safe assertions rather than thrown errors:
- **Closed unions** (`IntentType`, `error.code`, `OrchestratorEvent['type']`): arbitrary/invalid values are rejected at the type level (`expectTypeOf<string>().not.toMatchTypeOf<IntentType>()` + member-array length/Set checks).
- **All error codes constructible**: each of the 4 `OrchestratorResult.error.code` values is a buildable safe-state (loop over the closed set).
- **Optional fields truly optional**: `partialResults`, `companyId`, `financialData`, `personaUsed`, every `constraints` field, and `response`/`error` all proven optional — fault paths that omit them degrade cleanly.
- **readonly everywhere**: mutating assignments rejected at compile time (`@ts-expect-error` TS2540 guards), so a fault path cannot corrupt an already-built structure.

## Gate results

| Gate | Command | Result |
|------|---------|--------|
| Unit tests | `pnpm exec vitest run tests/unit/lib/ai/orchestrator/orchestrator-types.test.ts` | 62 passed |
| Type check | `pnpm typecheck` (`tsc --noEmit`, whole repo) | 0 errors |
| Lint | `pnpm exec eslint <file> --max-warnings=0` | 0 warnings |

Setup performed for the worktree: `corepack pnpm install --frozen-lockfile` (no `node_modules`),
`corepack pnpm db:generate` (clears the ~298 phantom TS7006 errors).

## Notes for future gap tasks on type-only orchestrator modules

- `OrchestratorResult` is a **flat interface** (`success: boolean`), not a discriminated union — do not write `if (r.success)` narrowing tests; assert `response`/`error` as independently optional instead.
- `OrchestratorEvent` **is** a discriminated union (literal `type`) — but to exercise all switch arms you must keep `ev` as the full union (iterate an array), never a single narrowed object literal.
- `expectTypeOf<Union>().toEqualTypeOf<Union>()` trips vitest 4's internal constraint when the union contains `undefined | {object}` (TS2344) — use `toMatchTypeOf` (assignability) for such unions; the type-param `toEqualTypeOf` form is safe for string-literal unions and for `Interface | undefined`.
