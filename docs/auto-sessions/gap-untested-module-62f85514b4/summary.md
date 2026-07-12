# gap-untested-module-62f85514b4 — Unit tests for `src/lib/cache/conversion-cache.ts`

**Risk class:** C
**Target file:** `src/lib/cache/conversion-cache.ts`
**Test file:** `tests/unit/lib/cache/conversion-cache.test.ts`

## Starting state

A mirrored test file **already existed** at `tests/unit/lib/cache/conversion-cache.test.ts`
(22 tests, all passing) — the gap scan was stale. Per the established gap-task practice, the
file was **extended** rather than duplicated.

The existing file already covered the public surface well:
singleton export, the three sub-caches (mapping / targetAccount / cashFlowMapping) with
get/set round-trips, negative (`null`) caching, key isolation by each key component, last-write
overwrite, TTL expiry for all three caches, and basic `clearAll` + `getStats` behavior.

## What was added

A new `describe('edge cases and fail-safe behavior', ...)` block with **7 tests / 22 assertions**
covering edge inputs, boundary conditions, and fail-safe/observability behavior the original
file did not exercise.

### Tests and assertions

| # | Test | Assertions | Category |
|---|------|-----------|----------|
| 1 | round-trips entries when key components are empty strings | `getMapping('','')` ≍ mapping; `getTargetAccount('','')` ≍ acct; `getCashFlowMapping('','')` ≍ `{section:'financing'}` | Edge input (empty strings) |
| 2 | reports an empty snapshot via getStats on a fresh cache | 3× `size === 0`, 3× `keys ≍ []` | Edge state (initial) |
| 3 | can be repopulated after clearAll | after clearAll + re-set, `getMapping().id === 'after'` | Fail-safe (recoverability) |
| 4 | serves a target account up to the exact TTL boundary (600000ms) | `getTargetAccount()` ≍ acct after `advanceTimersByTime(600000)` | Boundary condition |
| 5 | serves a cash flow mapping up to the exact TTL boundary (600000ms) | `getCashFlowMapping()` ≍ `{section:'operating'}` after 600000ms | Boundary condition |
| 6 | getStats size counts expired-but-unread entries while keys excludes them | after 300001ms w/o a get: `size === 1`, `keys ≍ []` | Fail-safe / observability (characterization) |
| 7 | collides when key components contain the ":" delimiter | both `getMapping('a','b:c')` and `getMapping('a:b','c')` return `'second'` | Edge input / characterization |

## Coverage rationale

- **Empty-string inputs** — keys are built as `` `prefix:${a}:${b}` ``; empty components
  produce keys like `mapping::`. The test proves round-trip works for boundary inputs across
  all three caches.
- **Fresh-cache `getStats`** — pins the zero/empty initial snapshot so regressions in
  `MemoryCache.getStats` (which delegates here) are caught.
- **Re-population after `clearAll`** — fail-safe check that `clear()` does not leave the
  underlying `MemoryCache` in a broken state; writes after a clear are retrievable.
- **Exact TTL boundary at 600000ms** — the mapping cache already had both boundary tests
  (serves at exactly 300000, expires at 300001). The two 600000ms caches only tested expiry;
  these additions close the symmetric "still served at exactly TTL" gap. `MemoryCache.get`
  expires only when `now - cachedAt > ttl` (strictly greater), so exactly `ttl` still serves.
- **`getStats` size vs keys divergence** — characterization test documenting that
  `getStats().size` reads the raw `Map.size` (which counts expired-but-not-yet-lazily-evicted
  entries), whereas `keys()` filters by TTL. After the TTL elapses without a `get()`, `size`
  over-reports live entries. Flagged so a future fix to `getStats` (eager eviction) is caught
  and reviewed.
- **`:` delimiter collision** — characterization test documenting that arguments containing
  the `:` delimiter collide (e.g. `('a','b:c')` and `('a:b','c')` both map to key
  `mapping:a:b:c`, last write wins). Pinned as current behavior so a move to a delimiter-safe
  key scheme is surfaced for review rather than changing silently.

## Verification

- `corepack pnpm exec vitest run tests/unit/lib/cache/conversion-cache.test.ts` →
  **29 passed** (22 pre-existing + 7 added)
- `corepack pnpm exec eslint <file> --max-warnings=0` → clean
- `corepack pnpm exec tsc --noEmit` → clean

## Notes

- No new dependencies introduced; uses the existing Vitest harness and `vi.useFakeTimers()`
  for deterministic TTL behavior (no real clock).
- No production code changed — test-only diff.
- Two of the new tests are explicitly `Characterization` tests (commented as such): they pin
  current — not necessarily ideal — behavior so future refactors are deliberate.
