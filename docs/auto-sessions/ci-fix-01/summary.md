# CI-FIX-01 — Fix flaky unit-test shard blocking the merge queue

## Outcome
Fixed a wall-clock flake in shard **34** of the `Unit Tests` matrix. The shard now passes
deterministically. Shard **36** (also reported red in CI) could **not** be reproduced locally
(20/20 green) and has no identifiable flake source; see the dedicated section below.

## Failing test & root cause
- **File:** `tests/unit/services/currency/exchange-rate.test.ts`
- **Test:** `BOJExchangeRateService > getRate > should return cached rate on subsequent calls`
- **Symptom:** `AssertionError: expected { …(11) } to deeply equal { …(11) }`, reproducing ~1 in 8 runs.

### Why it flaked
`BOJExchangeRateService.getRate` (`src/services/currency/exchange-rate.ts`):
- Caches only the **rate number** in the module-level `exchangeRateCache` singleton
  (`src/lib/cache/memory-cache.ts`).
- `createExchangeRate` rebuilds a fresh `ExchangeRate` object on **every** call — cache hits
  included — stamping `createdAt` / `updatedAt` with `new Date()` at call time.

So two sequential `getRate(date, 'JPY', 'USD')` calls return objects whose only possible
difference is the `createdAt`/`updatedAt` timestamp. `expect(rate1).toEqual(rate2)` then fails
whenever the two `new Date()` calls straddle a millisecond boundary (~12% of runs).

Two compounding factors, both on the task's flake checklist:
1. **Wall-clock dependency** — `new Date()` evaluated at call time (the "async/timer" nondeterminism).
2. **Cross-test global state** — `exchangeRateCache` is a module-level singleton; the preceding
   test (`should return exchange rate for valid date`) pre-populates the same cache key, so both
   calls in the flaky test hit the cache and both rebuild with fresh timestamps.

This is a **test flake**, not a Class-A product defect. The product behavior (re-stamping
timestamps on cache read) is left intact — changing the cache to store whole objects is a
riskier, out-of-scope product change no surviving assertion currently requires.

## Fix (test-only, deterministic)
Made the test hermetic **without weakening any assertion**:
- Clear the shared `exchangeRateCache` at the start so the first call is a guaranteed cache miss
  regardless of test order (removes cross-test global-state coupling).
- Freeze the clock via `vi.useFakeTimers()` + `vi.setSystemTime(...)` so both calls produce
  identical `createdAt`/`updatedAt`; restored to real timers in a `finally`.
- Added `vi.spyOn(..., 'fetchBOJRate')` asserting `toHaveBeenCalledTimes(1)` — under a frozen
  clock the test still genuinely verifies the cache (the BOJ fetch runs exactly once across two
  calls), so it cannot go false-green. The original `expect(rate1).toEqual(rate2)` is unchanged.

No assertions were deleted or loosened. No `.skip`. The cache is passive (lazy TTL via
`Date.now()`, no `setTimeout`/interval), so fake timers are safe and `await` resolves normally.

## Validation
- `vitest run tests/unit/services/currency/exchange-rate.test.ts` ×20 → **0 failures**.
- `pnpm test -- --shard=34/64` ×12 → **0 failures** (previously ~1/8).
- `node scripts/autopm_verify.mjs --changed-only` → **exit 0**
  (typecheck 0 errors, eslint `--max-warnings=0` clean, vitest 13/13).

## Shard 36 — no change (non-reproducible)
Reported red in CI alongside shard 34, but:
- `--shard=36/64` passed **20/20** locally (8 + 12 runs).
- Grepped all 7 shard-36 files for `Date.now|new Date()|Math.random|setTimeout|setInterval|
  useFakeTimers|unhandledRejection` → **no matches** (no wall-clock/timer/random source).
- The most timing-sensitive file is `tests/performance/auth-overhead.test.ts`; its bounds are
  generous (`<1000ms`, `<15000ms`, bcrypt cost 12). These are environment-sensitive *performance*
  assertions, not the async/timer flake class described, and loosening them would violate the
  "no loosened assertions" rule.

Conclusion: shard 36 was most likely a transient CI-runner hiccup or a misattribution of the
aggregate red status; no legitimate, non-assertion-weakening fix exists for it. Shard 34's
exchange-rate flake is the actionable root cause and is fixed.

## Files changed
- `tests/unit/services/currency/exchange-rate.test.ts` (the only file changed)
