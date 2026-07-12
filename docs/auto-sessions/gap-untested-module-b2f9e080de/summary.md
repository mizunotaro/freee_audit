# gap-untested-module-b2f9e080de — unit tests for `src/jobs/exchange-rate-fetch-job.ts`

**Task:** Add unit tests for the BOJ exchange-rate fetch job (Risk class C).
**Target:** `src/jobs/exchange-rate-fetch-job.ts` (previously had no `tests/` entry).
**New file:** `tests/unit/jobs/exchange-rate-fetch-job.test.ts`
**Result:** 11 tests, all passing. Coverage on the target file: **100% statements / 100% branches / 100% functions** (v8).

---

## How the SUT is exercised

The module instantiates its collaborator at module top level
(`const bojProvider = new BOJRateProvider()`), so the test mocks
`@/services/currency/providers/boj-rate-provider` whole. This:

- Uses `vi.hoisted` for the `fetchRates` stub so it survives `vi.mock`'s hoist
  boundary and the SUT's import-time `new`.
- Uses a real `function` expression (not an arrow) as the constructor body so
  `new BOJRateProvider()` works under vitest 4.
- Means the real provider — which imports `@/lib/db` / `@prisma/client` — never
  loads, so no Prisma/DB mock is required for this suite.

`setTimeout` backoff and `new Date()` are made deterministic with
`vi.useFakeTimers({ now: FIXED_NOW })`; retries are driven with
`vi.advanceTimersByTimeAsync`. `vi.clearAllTimers()` runs in `afterEach` so a
pending retry can never leak between tests.

---

## Assertions added (per public entry point / behavior)

### `startExchangeRateFetchJob()` (happy path)
1. Returns `undefined` (void).
2. Logs `[ExchangeRateJob] Job module loaded - use scheduler.ts to schedule`.

### `fetchExchangeRates()` — happy path
3. Calls `bojProvider.fetchRates` exactly once and passes it the current date
   (pinned to `FIXED_NOW` via fake timers — `toHaveBeenCalledWith(FIXED_NOW)`).
4. Logs `[ExchangeRateJob] Starting daily fetch...`.
5. Logs `[ExchangeRateJob] Success: <N> rates fetched` with the real array length.
6. Emits the success notification: `[ExchangeRateJob] Notification: <N> rates fetched successfully`.
7. Schedules **no** retry (`getTimerCount() === 0`) and writes nothing to
   `console.error`.

### `fetchExchangeRates()` — edge cases
8. **Empty success** (`success([])`): treated as success — logs `Success: 0
   rates fetched` + `Notification: 0 rates fetched successfully`, no retry.
   (Documents that the job does not special-case zero rates — it reports 0 and
   degrades safely rather than crashing.)
9. **Large batch** (100 rates): exact count propagated to both log and
   notification (`Success: 100` / `Notification: 100`).

### `fetchExchangeRates()` — retry / backoff
10. **Single failure**: logs `Attempt 1 failed:` + the error object, logs
    `Retrying in 300 seconds...`, and schedules exactly one retry
    (`getTimerCount() === 1`).
11. **5-minute boundary**: advancing `5*60*1000 - 1` ms leaves the retry pending
    (fetch still called once); advancing the final 1 ms fires attempt 2 — proves
    the first backoff delay is exactly `RETRY_DELAYS[0]`.
12. **Recovery on retry**: first call fails, second succeeds after the 5-min
    advance — `fetchRates` called twice, success + notification logged, no timer
    left pending.
13. **Escalating schedule**: across the full failure chain the retry log messages
    are exactly `300s → 900s → 3600s` (i.e. `RETRY_DELAYS = [5,15,60] min`), and
    no fourth "Retrying" message is ever emitted.

### `fetchExchangeRates()` — fail-safe exhaustion
14. **Bounded retries + failure notification**: persistent failure runs the
    initial attempt + 3 retries = **4 total `fetchRates` calls** (no infinite
    loop), leaves `getTimerCount() === 0`, and emits exactly one
    `[ExchangeRateJob] Notification: Fetch failed - <error.message>`.
15. **Does not throw or hang** under the documented Result failure contract:
    `fetchExchangeRates()` resolves to `undefined` with exactly one retry
    pending.

### `fetchExchangeRates()` — contract violation
16. **Unexpected provider rejection** (provider throws instead of returning a
    Result): the job has no `try/catch` around `fetchRates`, so the rejection
    surfaces as a rejected `fetchExchangeRates()` (`rejects.toThrow('provider
    crashed')`) rather than being silently swallowed. Documents the dependency
    contract: the provider must return a `Result`, not throw.

---

## Coverage rationale

| SUT element | How covered |
|---|---|
| `fetchExchangeRates` | happy/empty/large/failure/recovery/exhaustion/contract-violation tests |
| `executeWithRetry` (private) | every branch: success path, each retry step, exhaustion, the `attempt < RETRY_DELAYS.length` true/false |
| `sendSuccessNotification` (private) | count value asserted in happy/empty/large/recovery tests |
| `sendFailureNotification` (private) | failure message asserted in exhaustion test |
| `startExchangeRateFetchJob` | dedicated test |
| top-level `new BOJRateProvider()` | exercised at import via the hoisted constructor mock |
| `RETRY_DELAYS` values | asserted via the 300s/900s/3600s log sequence and the 5-min boundary test |

Result: 18/18 statements, 5/5 branches, 6/6 functions.

## Determinism / no external collaborators
- No network, no clock (fake timers), no randomness.
- `BOJRateProvider` is fully mocked; Prisma is never reached.
- `console.log` / `console.error` are spied (not the real sinks) and restored each test.

## Quality gate
- `corepack pnpm exec vitest run tests/unit/jobs/exchange-rate-fetch-job.test.ts` → 11 passed.
- `corepack pnpm exec tsc --noEmit` → 0 errors.
- `corepack pnpm exec eslint --max-warnings=0 tests/unit/jobs/exchange-rate-fetch-job.test.ts` → 0 errors/warnings.
