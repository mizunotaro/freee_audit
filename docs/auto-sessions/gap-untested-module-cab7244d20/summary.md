# gap-untested-module-cab7244d20 — Unit tests for `request-id.ts`

**Target:** `src/app/api/analysis/utils/request-id.ts`
**Test file:** `tests/unit/api/analysis/utils/request-id.test.ts` (mirrors the sibling tests
`boundary-check` / `circuit-breaker` / `retry` / `sanitizer` / `validation`, which drop the
`app/` segment of the source path).
**Result:** 23 tests, all passing. `eslint --max-warnings=0` clean on both files;
`tsc --noEmit` clean for the whole project.

---

## Public surface under test

The module exports three pure generators:

| Function | Format |
|----------|--------|
| `generateRequestId(prefix = 'req')` | `${prefix}-${Date.now().toString(36)}-${randomBytes(4).toString('hex')}` |
| `generateTraceId()` | `trace-${Date.now().toString(36)}-${randomBytes(8).toString('hex')}` |
| `generateSpanId()` | `span-${randomBytes(4).toString('hex')}` (no timestamp) |

External collaborators — `Date.now()` and `crypto.randomBytes` — are mocked so the suite is
fully deterministic (no live clock, no unseeded randomness), per the task constraints.

---

## Determinism strategy

- **Clock:** `vi.useFakeTimers()` + `vi.setSystemTime(new Date('2024-01-15T12:00:00Z'))` in
  `beforeEach`; restored with `vi.useRealTimers()` in `afterEach`. The expected base36
  timestamp segment is derived from the same constant
  (`FIXED_DATE.getTime().toString(36)`), so no manual epoch arithmetic is needed.
- **Randomness:** `vi.spyOn(crypto, 'randomBytes')` in `beforeEach`, defaulting to
  `Buffer.alloc(size, 0xab)` (→ `abababab…`). Per-call overrides via `mockReturnValueOnce`
  for exact-value cases and `mockImplementationOnce` for the failure case. Restored with
  `vi.restoreAllMocks()` in `afterEach`.

> **Note on the builtin mock (important).** Vitest externalizes Node builtins, so the SUT's
> original `import { randomBytes } from 'crypto'` captured the **real** binding at link time.
> Neither `vi.mock('crypto', …)` / `vi.mock('node:crypto', …)` nor a post-import
> `vi.spyOn` could intercept it (verified empirically). To make the dependency mockable **at
> call time**, `request-id.ts` was changed from `import { randomBytes } from 'crypto'` to
> `import crypto from 'crypto'` + `crypto.randomBytes(…)` — behavior-identical, matching the
> already-proven pattern in `src/lib/crypto/encryption-v2.ts` (whose test spies on
> `crypto.scrypt` the same way). `esModuleInterop: true` is set in `tsconfig.json`, so the
> default import of the CJS builtin is clean. **No exported API, output, or behavior
> changed.** The 10 modules that import these three functions are unaffected.

---

## Assertions added (23 tests)

### `generateRequestId` (10)
1. Default `'req'` prefix + base36 timestamp + 4 random bytes → exact
   `req-${ts}-abababab`.
2. Custom prefix `'audit'` → exact `audit-${ts}-abababab`.
3. Empty-string prefix (`''`, default-param **not** triggered) → exact `-${ts}-abababab`.
4. `undefined` argument → default `'req'` applied → exact `req-${ts}-abababab`.
5. Unicode / special-char prefix `'請求_001'` round-trips verbatim → exact.
6. Requests **exactly 4** random bytes: `toHaveBeenCalledWith(4)` + `toHaveBeenCalledTimes(1)`.
7. Faithfully embeds the bytes as 8 lowercase hex: `mockReturnValueOnce('deadbeef')` → exact,
   and `split('-').pop() === 'deadbeef'`.
8. Embeds `Date.now()` as a base36 segment: `segments[1] === expectedTimestamp` and
   matches `/^[0-9a-z]+$/`.
9. Matches canonical format `/^req-[0-9a-z]+-[0-9a-f]{8}$/`.
10. Yields distinct ids when bytes differ (two `mockReturnValueOnce`) → `not.toBe` +
    `endsWith` checks on each.

### `generateTraceId` (5)
11. `'trace'` prefix + timestamp + 8 bytes → exact `trace-${ts}-abababababababab`.
12. Requests **exactly 8** random bytes: `toHaveBeenCalledWith(8)` + `toHaveBeenCalledTimes(1)`.
13. Faithfully embeds 16 lowercase hex: `mockReturnValueOnce('0011223344556677')` → exact.
14. Matches canonical format `/^trace-[0-9a-z]+-[0-9a-f]{16}$/`.
15. Yields distinct trace ids when bytes differ.

### `generateSpanId` (6)
16. `'span'` prefix + 4 bytes, **no timestamp** → exact `span-abababab`.
17. Requests **exactly 4** random bytes: `toHaveBeenCalledWith(4)` + `toHaveBeenCalledTimes(1)`.
18. Does **not** embed a timestamp: `split('-')` has length 2 and the id does not contain the
    timestamp segment.
19. Faithfully embeds 8 lowercase hex: `mockReturnValueOnce('cafef00d')` → exact.
20. Matches canonical format `/^span-[0-9a-f]{8}$/`.
21. Yields distinct span ids when bytes differ.

### Fail-safe behavior (2)
22. Never throws and always returns a non-empty string for all three generators
    (`typeof === 'string'`, `length > 0`).
23. **Propagates** `randomBytes` failures instead of silently returning a weak/guessable id —
    `mockImplementationOnce(() => { throw … })` → `toThrow('entropy depleted')`. (This is the
    correct fail-safe posture for an id generator: fail loudly rather than degrade to a
    low-entropy fallback.)

---

## Coverage rationale

- **Happy-path:** every public entry point has a format + exact-output assertion (1, 2, 11,
  16) plus a canonical-regex check (9, 14, 20).
- **Edge / boundary:** empty-string and `undefined` prefix (default-parameter behavior) (3, 4);
  unicode prefix (5); the 4-vs-8 byte-size boundary asserted explicitly per generator
  (6, 12, 17); span's structural difference (no timestamp) called out (16, 18).
- **Error path:** the only failing collaborator is `randomBytes`; the module has no try/catch
  by design, so failure propagation — not silent recovery — is asserted (23).
- **Fail-safe:** no-throw for valid inputs (22) and no silent degradation on entropy failure
  (23).
- **Determinism:** clock pinned via fake timers; randomness pinned via `vi.spyOn`; uniqueness
  asserted deterministically by feeding **distinct** mocked bytes rather than relying on real
  randomness (10, 15, 21).

No new test-framework dependencies were added; the suite uses the project's existing Vitest
configuration and `tests/setup.ts`.
