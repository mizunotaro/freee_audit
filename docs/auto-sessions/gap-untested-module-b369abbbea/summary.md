# gap-untested-module-b369abbbea — unit tests for `app-error.ts`

**Target:** `src/app/api/analysis/types/app-error.ts`
**Test file (new):** `tests/app/api/analysis/types/app-error.test.ts`
**Risk class:** B
**Result:** 60 tests, all passing. ESLint 0/0, `tsc --noEmit` 0 errors.

## What the module exports

A pure, dependency-free error-shape module for the analysis API:

- `ErrorCode` — closed union of 10 string literals.
- `AppError` — `readonly` interface (`code`, `message`, `timestamp` required; `details?`, `requestId?` optional).
- 6 creator functions: `createError`, `createValidationError`, `createMissingFieldsError`,
  `createInternalError`, `createTimeoutError`, `createCircuitBreakerError`.

`CreateErrorOptions` is internal (not exported) and is exercised indirectly through `createError`.

## Coverage rationale

The module is pure data-shaping logic; the tests therefore focus on (a) the branch matrix
inside `createError`, (b) boundary inputs, and (c) compile-time type contracts. Determinism
is guaranteed by pinning the clock with `vi.useFakeTimers()` / `vi.setSystemTime()` so the
`new Date().toISOString()` timestamp is stable and assertable — mirroring the sibling
`response.test.ts`.

## Assertions added (by group)

### Module resolution
- Importable as ESM; exports exactly the 6 public creator functions at runtime (no surface
  leakage), each typed `function`.

### `ErrorCode` (type-only)
- Exactly 10 members at runtime; alias equals the 10-literal union; closed union
  (`string` / out-of-union literal not assignable).

### `AppError` (interface)
- Minimal construction (required triplet) and full construction (details + requestId) with
  exact key sets.
- Per-field types (`code: ErrorCode`, `message/timestamp: string`,
  `details: Record<string,unknown> | undefined`, `requestId: string | undefined`).
- `readonly` enforced via `@ts-expect-error` TS2540 on every field (mutate fails to compile).
- Fail-safe compile-time checks: out-of-union code, and payloads missing `code`/`message`/
  `timestamp` each fail to satisfy `AppError`.

### `createError` (core — full branch matrix)
- Base shape (3 keys): no options, explicit `undefined`, empty object `{}`.
- Details-only branch (4 keys), requestId-only branch (4 keys), both branch (5 keys).
- **Truthiness boundary:** empty `details: {}` is truthy → included; empty-string
  `requestId: ''` is falsy → dropped (documents real truthiness semantics of the
  `options?.details && options?.requestId` guards).
- `details` preserved by identity.
- Accepts every `ErrorCode`; empty-message boundary; valid ISO-8601 timestamp pinned to clock.
- Conforms to `AppError` contract (`expectTypeOf`).

### `createValidationError`
- Code `VALIDATION_ERROR`; base shape with message only; attaches details; attaches requestId
  when passed `undefined` details; attaches both; empty-message boundary.

### `createMissingFieldsError`
- Code `MISSING_REQUIRED_FIELDS`; single-field and multi-field join formatting.
- **Boundary:** empty list → message `" are required"` (empty join) and `details.fields === []`.
- `details.fields` stored by identity; requestId passthrough; accepts a readonly tuple
  (`as const`) — matches the `readonly string[]` parameter contract.

### `createInternalError`
- Code `INTERNAL_ERROR`; base shape and **never** attaches details (it passes only
  `{ requestId }`); requestId branch; empty-message boundary.

### `createTimeoutError`
- Code `TIMEOUT`; message formatting from `operation`/`timeoutMs`; details holds both values.
- **Boundaries:** `timeoutMs` of `0`, `-1` (interpolated verbatim), `Number.MAX_SAFE_INTEGER`;
  empty `operation` string; requestId passthrough.

### `createCircuitBreakerError`
- Code `CIRCUIT_BREAKER_OPEN`; fixed unavailable message; base shape with no args; requestId branch.

### Fail-safe invariants (cross-cutting)
- Every creator returns a code that is a member of `ErrorCode`.
- Every creator returns a string `message` and **never throws** on empty/zero/boundary inputs.
- Every creator stamps a valid ISO-8601 timestamp.
- Degrades to the safe base shape (`code`/`message`/`timestamp`) when no optional context is given.

## Verification

```
pnpm vitest run tests/app/api/analysis/types/app-error.test.ts   # 60 passed
pnpm exec eslint --max-warnings=0 <file>                          # exit 0
pnpm typecheck                                                    # exit 0
```

No production code was changed. No new dependencies added.
