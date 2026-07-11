# gap-untested-module-5474ab0a36 — Unit tests for `resolve-chart-status.ts`

- **Risk class:** C
- **Target file:** `src/components/charts/resolve-chart-status.ts`
- **Detected:** 2026-07-09
- **Deliverable:** `tests/components/charts/resolve-chart-status.test.ts` (new, 36 tests, all passing)

## What the module does

`resolveChartStatus(input: unknown): Result<ChartResolution>` derives one of four
chart states — `loading | error | empty | ready` — from a Zod-validated input
(`{ loading, error, dataLength }`). Precedence is strictly
**loading > error > empty > ready**. Invalid input is never thrown; it degrades
to a `failure(Result)` carrying a `VALIDATION_ERROR` `AppError`.

The module already had *incidental* coverage inside `tests/components/charts/chart-state.test.tsx`,
but that file bundles the function's checks with `ChartState` component rendering tests and
does not exhaustively cover the schema, the exported constant, the error-shape contract, or
fail-safe (non-throwing) behavior. This task adds the dedicated, mirrored-path test file the gap
asked for.

## Coverage rationale

The test file is split into three `describe` blocks mirroring the module's public surface:

1. **`CHART_RESOLUTIONS`** — pins the constant so the priority order is a documented contract,
   not an implementation accident.
2. **`resolveChartStatusInputSchema`** — the schema is an exported public symbol used directly by
   nothing currently, but it is part of the API; tests lock down defaults, value preservation, and
   each field's rejection rules independently of `resolveChartStatus`.
3. **`resolveChartStatus`** — the function itself, organized into happy paths, precedence,
   defaults, edge cases, and error/fail-safe behavior.

## Assertions added (complete list)

### `CHART_RESOLUTIONS`
1. `expect(CHART_RESOLUTIONS).toEqual(['loading', 'error', 'empty', 'ready'])` — exact tuple / priority order.

### `resolveChartStatusInputSchema`
2. `safeParse({})` succeeds → `parsed.data` equals `{ loading: false, error: null, dataLength: 0 }` (all defaults applied).
3. `safeParse({ loading: true, error: 'boom', dataLength: 7 })` preserves all provided values.
4. `safeParse({ error: null })` succeeds (null accepted).
5. `safeParse({ dataLength: -1 })` fails (nonnegative).
6. `safeParse({ dataLength: 1.5 })` fails (int).
7. `safeParse({ loading: 'yes' })` fails (boolean).
8. `safeParse({ error: 123 })` fails (string|null only).
9. `safeParse({ loading: true, extra: 'ignored' })` succeeds and `parsed.data` has no `extra` (lenient strip).

### `resolveChartStatus` — happy paths
10. `{ dataLength: 3 }` → `ready`.
11. `{ loading: false, error: null, dataLength: 0 }` → `empty`.
12. `{ loading: false, error: '通信エラー', dataLength: 5 }` → `error`.
13. `{ loading: true }` → `loading`.

### `resolveChartStatus` — precedence (loading > error > empty > ready)
14. `{ loading: true, error: 'boom', dataLength: 9 }` → `loading` (loading beats error + data).
15. `{ loading: false, error: 'boom', dataLength: 0 }` → `error` (error beats empty).
16. `{ loading: false, error: 'boom', dataLength: 9 }` → `error` (error beats ready).
17. `{ loading: false, error: null, dataLength: 0 }` → `empty` (empty only in the no-loading/no-error/zero case).

### `resolveChartStatus` — defaults
18. `{}` → `empty` (empty object resolves via schema defaults).

### `resolveChartStatus` — edge cases
19. `{ error: '', dataLength: 0 }` → `empty` and `{ error: '', dataLength: 4 }` → `ready` (empty string is falsy ⇒ not an error).
20. `{ error: null, dataLength: 0 }` → `empty`.
21. `{ error: '   ', dataLength: 0 }` → `error` (whitespace string is truthy ⇒ counts as error — documented quirk).
22. Boundary: `{ dataLength: 0 }` → `empty`, `{ dataLength: 1 }` → `ready`.
23. `{ dataLength: Number.MAX_SAFE_INTEGER }` → `ready` (max-value boundary).
24. Every returned resolution for `[{ loading: true }, { error: 'boom' }, { dataLength: 0 }, { dataLength: 5 }]` is contained in `CHART_RESOLUTIONS` (constant ↔ runtime consistency).

### `resolveChartStatus` — error paths & fail-safe behavior
25. `{ dataLength: -1 }` → failure, `error.code === 'VALIDATION_ERROR'`.
26. `{ dataLength: 2.5 }` → failure (non-integer).
27. `{ dataLength: '5' }` → failure (string rejected — no coercion).
28. `{ loading: 'yes' }` → failure (non-boolean).
29. `{ error: 123 }` → failure (numeric error rejected).
30. `null` input → failure.
31. `undefined` input → failure.
32. array input → failure.
33. primitive input (`'loading'`, `42`, `true`) → failure each.
34. `expect(() => resolveChartStatus(bad)).not.toThrow()` across 9 malformed inputs (fail-safe: never throws, always returns a Result).
35. Failure shape: for `{ dataLength: -1 }`, `error.code === 'VALIDATION_ERROR'`,
    `error.message === 'チャート状態の解決に失敗しました'`, `error.timestamp` equals a pinned
    fake-clock instant, and `error.details.issues` is a non-empty array (the Zod issues).
    Determinism: the clock is pinned with `vi.useFakeTimers({ now })` and restored in `finally`,
    so the timestamp assertion does not depend on wall-clock time.
36. Across `[null, undefined, { dataLength: -1 }, { loading: 'x' }, { error: 1 }]`, every failure
    carries `code === 'VALIDATION_ERROR'` and a non-empty user-facing `message`.

## Determinism / mocking

- No network, no real clock, no unseeded randomness in the tests.
- The only time dependency is the module's own `createAppError` (`timestamp: new Date()`); the
  single test that inspects `timestamp` pins the clock via `vi.useFakeTimers` and restores it
  immediately, keeping the assertion deterministic. All other timestamp-free.
- No external collaborators are instantiated (the module's only imports are `zod` and
  `@/types/result`, both pure).

## Verification performed

| Check | Command | Result |
|------|---------|--------|
| New tests | `corepack pnpm exec vitest run tests/components/charts/resolve-chart-status.test.ts` | **36/36 pass** |
| Charts regression | `corepack pnpm exec vitest run tests/components/charts/` | **8 files, 113 tests pass** |
| Lint (new file) | `corepack pnpm exec eslint --max-warnings=0 tests/components/charts/resolve-chart-status.test.ts` | **exit 0** (0 warnings) |
| Typecheck (new + target) | `corepack pnpm exec tsc --noEmit` | **0 errors** in `resolve-chart-status.test.ts` and `src/components/charts/resolve-chart-status.ts` |

### Pre-existing, unrelated note

Full-repo `tsc --noEmit` reports 6 errors, all in
`tests/unit/services/budget/managerial-accounting.test.ts` (a missing `favorable` field on
`StageLevelComparison`). That file is **not** touched by this task and the errors pre-date this
change (working tree was clean before the new test file was added). They are out of scope for a
`resolve-chart-status` test task and are left untouched.
