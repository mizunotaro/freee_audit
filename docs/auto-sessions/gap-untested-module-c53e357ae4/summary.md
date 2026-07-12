# Gap: unit tests for `src/app/api/analysis/types/response.ts`

**Task ID:** gap-untested-module-c53e357ae4
**Target:** `src/app/api/analysis/types/response.ts`
**Risk class:** B
**Deliverable:** `tests/app/api/analysis/types/response.test.ts`

## What the module does

A pure, synchronous helper module (no external collaborators) that builds the
standard analysis-API envelope. Two runtime functions plus two interfaces:

- `createSuccessResponse<T>(data, metadata)` → `ApiResponse<T>` with `success: true`
- `createErrorResponse(error, metadata)` → `ApiResponse<never>` with `success: false`
- Interfaces `ResponseMetadata` and `ApiResponse<T>` (type-only)

Both functions fill omitted `metadata` fields with defaults. The interesting
runtime behavior under test:

- `createSuccessResponse` defaults: `requestId → 'unknown'`,
  `processingTimeMs → 0`, `cached → false`, `version → '1.0.0'`,
  `timestamp → new Date().toISOString()`.
- `createErrorResponse` defaults are the same **except**:
  - `requestId` resolves through a fallback chain:
    `metadata.requestId ?? error.requestId ?? 'unknown'`.
  - `cached` is **hard-coded `false`** and ignores `metadata.cached` — a
    fail-safe guarantee that error responses are never reported as cached.

## Determinism

The default `timestamp` reads `new Date()`. The whole file pins the clock with
`vi.useFakeTimers()` + `vi.setSystemTime(FIXED_DATE)` in `beforeAll` (restored in
`afterAll`), so every default-timestamp assertion is deterministic. No network,
no real clock, no unseeded randomness.

## Coverage rationale

`createSuccessResponse` and `createErrorResponse` are the only public entry
points; both are exercised on three axes each:

1. **Happy path** — full metadata supplied, every field passed through verbatim
   (structural `toEqual`).
2. **Edge / defaults** — empty `metadata: {}` object yields exactly the five
   documented defaults; partial input defaults only the omitted fields; payloads
   of every kind (primitive, array, object, `null`) are carried **by identity**
   (`toBe`), and the error object reference is preserved (`toBe`).
3. **Fail-safe / error paths** —
   - `requestId` fallback chain (metadata → `error.requestId` → `'unknown'`) is
     verified in four mutually exclusive cases.
   - `cached` forced to `false` on error responses even when `metadata.cached`
     is `true` — pinned as an explicit fail-safe contract.
   - success responses carry **no** `error`; error responses carry **no** `data`.
4. **Shape invariants** — exactly the five metadata keys are present on both
   response kinds; `expectTypeOf` confirms the `ApiResponse<T>` contract
   (note `data?`/`error?` are optional, asserted as `T | undefined`).

## Result

- **24 tests, all passing.**
- **Coverage of target file: 100%** (2/2 functions, 19/19 branches, 2/2
  statements, 2/2 lines) via
  `vitest run ... --coverage.include='src/app/api/analysis/types/response.ts'`.
- `tsc --noEmit`: 0 errors.
- `eslint --max-warnings=0` on the new file: 0 warnings.

## Assertions added (per test)

`createSuccessResponse`
1. returns `success: true` and carries the data payload by identity
2. applies every provided metadata field verbatim (full-shape `toEqual`)
3. fills every metadata default when given an empty object
4. defaults only the omitted metadata fields on partial input
5. honors `cached: true` for success responses
6. does not attach an `error` field on success
7. supports primitive / array / object / `null` payloads (identity)
8. produces a valid ISO-8601 default timestamp pinned to the clock
9. exposes exactly the five metadata keys
10. conforms to the `ApiResponse<number>` contract (`expectTypeOf`)

`createErrorResponse`
11. returns `success: false` and carries the error by identity
12. applies every provided metadata field verbatim (full-shape `toEqual`)
13. fills every metadata default when given an empty object and no `error.requestId`
14. uses `metadata.requestId` when provided
15. falls back to `error.requestId` when metadata omits it
16. prefers `metadata.requestId` over `error.requestId`
17. falls back to `'unknown'` when neither source provides a `requestId`
18. forces `cached: false` even when `metadata.cached` is `true` (fail-safe)
19. does not attach a `data` field on error
20. produces a valid ISO-8601 default timestamp pinned to the clock
21. exposes exactly the five metadata keys
22. conforms to the `ApiResponse<never>` contract (`expectTypeOf`)

`response shape invariants`
23. success and error responses are mutually exclusive on the `data`/`error` channels
24. both responses share the same five-key metadata shape regardless of outcome
