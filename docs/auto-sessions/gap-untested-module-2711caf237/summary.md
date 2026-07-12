# gap-untested-module-2711caf237 — Unit tests for time-provider

**Target:** `src/app/api/analysis/utils/time-provider.ts`
**Test file:** `tests/app/api/analysis/utils/time-provider.test.ts` (mirrors source path under `tests/`)
**Result:** 26 assertions / 26 passed · `eslint --max-warnings=0` exit 0 · `tsc --noEmit` exit 0

## Public surface covered

The module exposes one interface, two implementations, and three module-level
global-provider functions. Every public entry point is exercised:

| Symbol | Kind | Covered |
|---|---|---|
| `TimeProvider` | interface (`now()`, `timestamp()`) | ✅ (type annotation + duck-typed impl) |
| `SystemTimeProvider.now()` | method | ✅ |
| `SystemTimeProvider.timestamp()` | method | ✅ |
| `MockTimeProvider.now()` | method | ✅ |
| `MockTimeProvider.timestamp()` | method | ✅ |
| `MockTimeProvider.advance(ms)` | method | ✅ |
| `getTimeProvider()` | function | ✅ |
| `setTimeProvider(provider)` | function | ✅ |
| `resetTimeProvider()` | function | ✅ |

## Assertions added (by group)

### SystemTimeProvider (happy path + clock behavior)
1. `now()` is a `Date` equal to the (faked) system time.
2. `timestamp()` is the exact ISO string `'2024-01-15T12:00:00.000Z'`.
3. `new Date(timestamp()).getTime()` round-trips to the same epoch ms.
4. `timestamp()` matches canonical ISO-8601 shape `^\d{4}-\d{2}-...Z$`.
5. Reflects an advancing system clock (`vi.setSystemTime(later)` → `now()`/`timestamp()` follow).
6. Two `now()` calls stay equal while the fake clock is frozen.

### MockTimeProvider (happy path + edge cases)
7. `now()` returns a `Date` equal to the construction time.
8. `timestamp()` returns the ISO string of the fixed time.
9. Stays pinned to the fixed time even when the real/system clock jumps (proves mock ignores wall clock).
10. `advance(0)` leaves the value unchanged.
11. `advance(+ms)` moves forward and updates `timestamp()`.
12. `advance(-ms)` moves backward.
13. Multiple `advance()` calls accumulate (1s+2s+3s = +6s).
14. `advance()` returns `undefined` (void).
15. `now()` returns the stored reference until `advance()` replaces it (documents shared-reference semantics; explains why mutations are visible).

### Global provider management
16. `getTimeProvider()` defaults to a `SystemTimeProvider` instance.
17. Default provider reads the system clock.
18. `setTimeProvider()` installs the exact reference as the global singleton (`===`).
19. Accepts any duck-typed object satisfying the `TimeProvider` contract (not just the two classes).
20. `resetTimeProvider()` restores a **fresh** `SystemTimeProvider` (not the previously-set mock).
21. `resetTimeProvider()` returns `undefined`.
22. `setTimeProvider()` returns `undefined`.

### Fail-safe / error behavior
23. `SystemTimeProvider.now()`/`timestamp()` never throw on repeated calls.
24. `MockTimeProvider` built from an invalid date: `now()` returns the invalid `Date` (`getTime()` is `NaN`) **without** throwing.
25. `MockTimeProvider.timestamp()` **propagates** `RangeError` for an invalid date (does not silently degrade) — documents real behavior, mirroring the `request-id` "propagates failures" pattern.
26. Global accessor functions do not throw for valid providers.

## Coverage rationale

- **Determinism:** The real clock is fenced off with `vi.useFakeTimers()` +
  `vi.setSystemTime(FIXED_DATE)` in `beforeEach`; `afterEach` restores real timers.
  `MockTimeProvider` is deterministic by construction (fixed time). No real
  network, wall clock, or unseeded randomness is involved.
- **Module-state isolation:** `globalTimeProvider` is module-level mutable state.
  `afterEach` calls `resetTimeProvider()` so no test leaks a mock into siblings.
- **Edge/boundary:** zero advance, negative advance, accumulation, invalid date,
  clock-frozen equality, reference identity vs. value equality.
- **Error/fail-safe:** invalid-date input is the only realistic fault mode. The
  module does not validate its constructor argument, so `timestamp()` surfaces a
  `RangeError` rather than silently producing a safe value — asserted honestly
  rather than fabricating a non-existent safe-state contract.
- **No new dependencies; no external collaborators instantiated.** The module is
  pure time logic with no collaborators to mock beyond the clock.

## Note on placement

The test mirrors the source path exactly (`tests/app/api/analysis/utils/`),
matching the sibling `tests/app/api/analysis/types/` convention already present
in the repo. (The `tests/unit/api/analysis/utils/` tree is the alternate layout;
this file follows the explicit task instruction and the `tests/app/api/analysis/`
mirror convention.)
