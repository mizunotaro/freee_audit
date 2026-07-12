# gap-untested-module-1236c7f0d1 — Unit tests for `src/app/api/analysis/types/log.ts`

## Target

`src/app/api/analysis/types/log.ts` — a **pure-types module** exposing:

- `interface LogEntry` (`readonly timestamp`, `level`, `message`, `context`)
- `interface LogContext` (`readonly requestId`, `module`, `version` required; `userId`,
  `companyId`, `durationMs`, `cached` optional; index signature `readonly [key: string]: unknown`)
- `type LogLevel = 'debug' | 'info' | 'warn' | 'error'`

The module has no runtime code (no functions/classes/constants), so the test follows the
repo's established **3-layer pattern for pure-types modules** (see `tests/unit/types/journal.test.ts`):
runtime `expect` + typed assignment + type-level `expectTypeOf` / `@ts-expect-error`.

## Deliverable

New test file: `tests/app/api/analysis/types/log.test.ts` (mirrors the source path per the
task spec; matches the `tests/**/*.test.ts` include glob in `vitest.config.ts`). **25 tests**.

## Verification (run in this worktree)

| Gate | Command | Result |
|------|---------|--------|
| Unit tests | `corepack pnpm exec vitest run tests/app/api/analysis/types/log.test.ts` | **25 passed (25)** |
| Typecheck | `corepack pnpm exec tsc --noEmit` (full repo) | **0 errors** |
| Lint | `corepack pnpm exec eslint --max-warnings=0 tests/app/api/analysis/types/log.test.ts` | **0 errors, 0 warnings** |

`tsc` passing is the load-bearing check for the type-level assertions: it proves every
`expectTypeOf` holds AND that each of the four `@ts-expect-error` directives corresponds to a
real `TS2540` (readonly assignment) error — a directive that doesn't suppress an error would
surface as `TS2578 "Unused '@ts-expect-error' directive"` and fail the typecheck.

## Assertions added (by group)

### `module resolution`
- `await import('@/app/api/analysis/types/log')` resolves to a defined object namespace
  (proves the ESM module is importable even though it is type-only at runtime).

### `LogLevel`
- Runtime: `LOG_LEVELS` has length 4, 4 unique members, equals
  `['debug','info','warn','error']`.
- Type: `LogLevel` `toEqualTypeOf` the exact 4-literal union.
- Fail-safe (closed union): `string` and `'trace'|'fatal'` both
  `not.toMatchTypeOf<LogLevel>` (arbitrary/foreign severities are rejected).

### `LogContext`
- Happy path: fully-populated construct → 7 fields read back with correct values.
- Key-set serialization: `Object.keys` equals exactly the 7 populated keys (catches
  accidental extra/renamed fields).
- Minimal construction: only the required triplet (`requestId/module/version`) → the 4
  optional keys are `undefined`, key count is 3.
- Type shape: `requestId/module/version` are `string`; `userId/companyId` are
  `string | undefined`; `durationMs` is `number | undefined`; `cached` is
  `boolean | undefined`.
- Edge: empty strings accepted for all required string fields.
- Edge (boundary numbers): `durationMs` accepts `0`, `-1`, `Number.MAX_SAFE_INTEGER`.
- Edge (boolean polarity): `cached` accepts both `true` and `false`.
- Index signature (runtime): extra keys (`traceId`, `featureFlags`, `retryCount`) survive a
  `Record<string, unknown>` read.
- Index signature (type): `LogContext['traceId']` / `LogContext['arbitraryExtension']`
  `toEqualTypeOf<unknown>` — extensions are `unknown`, never `any` (fail-safe).
- Fail-safe (compile-time): `{ module; version }` (no `requestId`) and `{ requestId }` (no
  `module`/`version`) both `not.toMatchTypeOf<LogContext>` — required fields are enforced.

### `LogEntry`
- Happy path: fully-populated construct → 4 fields read back correctly, `context` deep-equal.
- Key-set serialization: exactly `['context','level','message','timestamp']`.
- Type shape: `timestamp` `string`, `level` `LogLevel`, `message` `string`,
  `context` `LogContext` (all required, none optional).
- Alignment: `LogEntry['level']` `toEqualTypeOf` both the literal union and `LogLevel`
  (keeps the two declarations in lock-step).
- Happy path over the union: every one of the 4 `LogLevel` values constructs a valid entry.
- Edge: empty `message` accepted.
- Nesting: a rich `LogContext` (incl. index-signature key) round-trips inside `entry.context`.
- Fail-safe (compile-time): a `{ level: 'fatal' }` payload and a payload missing `context`
  both `not.toMatchTypeOf<LogEntry>` — the level union and required `context` are enforced.
- Immutability (fail-safe): four `@ts-expect-error` directives prove `timestamp`, `level`,
  `message`, and `context` are all `readonly` (reassignment is a compile error). The mutating
  statements live inside a never-invoked `tryMutate` closure so the runtime object stays
  pristine and the trailing value assertions hold.

## Coverage rationale

- **Happy path**: covered for `LogContext`, `LogEntry`, and the `LogLevel` union
  (fully-populated construction + every union member).
- **Edge cases**: empty strings (required fields), empty `message`, boundary numbers for
  `durationMs` (`0`/`-1`/`MAX_SAFE_INTEGER`), both `cached` polarities, minimal (optional
  fields omitted) construction.
- **Error / invalid-input paths**: for a types-only module the analog of "invalid input" is a
  shape that must NOT satisfy the contract — covered via negative `expectTypeOf
  ...not.toMatchTypeOf` (missing `requestId`, missing `module`/`version`, foreign level
  `'fatal'`, missing `context`, arbitrary string vs `LogLevel`).
- **Fail-safe behavior**: (1) the `LogLevel` union is closed — unrecognised severities are
  rejected so downstream log filtering/routing can't silently accept garbage; (2) the
  `LogContext` index signature widens to `unknown` (not `any`) so callers must narrow before
  use; (3) `LogEntry`/`LogContext` fields are all `readonly`, so audit-log records cannot be
  tampered with after creation — asserted via the four `@ts-expect-error` directives.
- **Determinism**: no clock/network/random — `FIXED_TIMESTAMP` is a pinned literal; tests are
  pure value/type construction with no external collaborators to mock.
