# gap-untested-module-a74b205757 — Unit tests for `src/app/api/analysis/utils/logger.ts`

**Risk class:** B
**Target:** `src/app/api/analysis/utils/logger.ts` (class `AnalysisLogger`)
**New test file:** `tests/unit/api/analysis/utils/logger.test.ts` (19 tests, all passing)

## Path note

The task body suggested `tests/app/api/analysis/utils/`. The actual repo mirror
convention for this source directory is `tests/unit/api/analysis/utils/` — the
sibling `sanitizer.ts` (same `src/app/api/analysis/utils/` directory) is already
covered at `tests/unit/api/analysis/utils/sanitizer.test.ts`. The new test was
placed alongside it for consistency; the `app/` segment is dropped, matching the
existing pattern. Vitest's `tests/**/*.test.ts` glob discovers it regardless.

## What was tested

`AnalysisLogger` exposes: constructor(context), `debug`, `info`, `warn`, `error`,
`withContext`, and a private `log` driver. All public entry points are covered,
plus every branch of the private driver (sanitize-or-skip, indent-by-NODE_ENV,
3-way console routing).

## Assertions added (per describe block)

### `info` (3)
- Routes to `console.log` with `level: 'info'`; entry has exact ISO timestamp,
  message, and merged context (base + data); `console.warn`/`console.error` not
  called.
- Message-only call (data omitted): context contains exactly the 3 base keys.
- Empty data object `{}`: base context preserved.

### `debug` (1)
- Routes to `console.log` with `level: 'debug'`; data merged; warn/error not
  called (exercises the `default` switch arm).

### `warn` (1)
- Routes to `console.warn` with `level: 'warn'`; `console.log`/`console.error`
  not called (exercises the `warn` switch arm).

### `error` (3)
- Routes to `console.error` with `level: 'error'`; attaches `errorMessage`
  (`error.message`) and `errorStack` (`error.stack`, asserted string containing
  the message); extra `data` merged alongside; log/warn not called.
- Works with no extra data.
- **Fail-safe:** an `Error` whose `.stack` was deleted does not throw; entry
  still carries `errorMessage`, `errorStack` is omitted (undefined) cleanly.

### `sanitization` (fail-safe) (3)
- `password` / `apiKey` / `token` values are `[REDACTED]` and the raw secret
  strings never appear in the serialized output; non-sensitive value preserved.
- Sensitive keys nested inside sub-objects are redacted.
- **Fail-safe:** circular references in `data` do not throw and do not loop
  infinitely (the `sanitizeForLog` depth guard terminates recursion; the entry
  remains JSON-serializable).

### `timestamp` (1)
- Exact faked-clock ISO value (`2024-01-15T10:30:00.000Z`) emitted, and validated
  as round-trippable ISO 8601. Deterministic via `vi.useFakeTimers()` +
  `vi.setSystemTime()` — no real clock.

### `output formatting by NODE_ENV` (2)
- `NODE_ENV='development'` → `JSON.stringify(..., null, 2)` (multi-line,
  indented `"level"`).
- `NODE_ENV='production'` → compact single-line output. `NODE_ENV` is saved and
  restored per test (assigned via the project's `process.env as Record<...>`
  cast, since `NodeJS.ProcessEnv.NODE_ENV` is typed read-only — same pattern as
  `tests/setup.ts`).

### `withContext` (5)
- Returns a new `AnalysisLogger` instance, distinct from the parent.
- Merges additional context onto the base.
- Additional context overrides base for overlapping keys (`module`).
- Does not mutate the original logger (parent log still lacks the child key).
- Child-of-child accumulates context across the chain.

## Coverage rationale

- **Happy path:** every public method + the construct/merge behavior.
- **Edge cases:** omitted data, empty data object, message-only, error without
  stack, child-of-child.
- **Error / fail-safe paths:** stackless error degrades safely; circular data
  does not throw; secrets are provably absent from output (strongest
  non-leakage assertion: raw string scan + parsed `[REDACTED]`).
- **Determinism:** fake timers fix the clock; `NODE_ENV` is mutated and
  restored; collaborators (`sanitizeForLog`, `console.*`) are the real modules
  spied on — no external/network/IO dependencies.

## Quality gate

- `corepack pnpm exec vitest run tests/unit/api/analysis/utils/logger.test.ts`
  → **19 passed**.
- `corepack pnpm exec eslint <file> --max-warnings=0` → clean.
- `corepack pnpm exec tsc --noEmit` (whole repo, after `pnpm db:generate`) →
  **0 errors**.
