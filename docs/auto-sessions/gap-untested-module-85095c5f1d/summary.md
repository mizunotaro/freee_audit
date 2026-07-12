# gap-untested-module-85095c5f1d — Unit tests for `src/lib/api/rate-limiters.ts`

**Risk class:** B
**Target file:** `src/lib/api/rate-limiters.ts`
**Test file:** `tests/unit/lib/api/rate-limiters.test.ts`
**Result:** 13 tests, all passing. ESLint `--max-warnings=0` clean. `tsc --noEmit` clean for the new file.

---

## What the target module is

`src/lib/api/rate-limiters.ts` is a thin re-export surface (3 lines):

```ts
import { rateLimiters as securityRateLimiters } from '@/lib/security/rate-limit-middleware'
export const rateLimiters = securityRateLimiters
```

Its only public export is `rateLimiters` — an object of four pre-configured inbound
NextRequest rate-limit middlewares:

| Limiter | windowMs | maxRequests | Purpose |
|---------|----------|-------------|---------|
| `api`    | 60_000  | 100 | General API |
| `auth`   | 900_000 | 5   | Login (5 attempts / 15 min — ties to lockout policy) |
| `upload` | 3_600_000 | 20 | File uploads |
| `strict` | 60_000  | 10  | Sensitive endpoints |

The underlying engine (`@/lib/security/rate-limit-middleware`) already had a test, but it
imports from the **security** path — the `@/lib/api/rate-limiters` module itself had **0
coverage** and no test (it is counted in coverage because the `**/index.ts` exclusion does
not apply to `rate-limiters.ts`). This task closes that gap and locks in the public contract
of the re-export plus the four configured limiters.

---

## Placement rationale

Placed at `tests/unit/lib/api/rate-limiters.test.ts` (not the task-suggested `tests/lib/api/`)
because:

1. It matches the existing convention (`tests/unit/lib/security/rate-limit-middleware.test.ts`
   and the sibling `tests/unit/lib/api/*.test.ts`).
2. `scripts/autopm_verify.mjs` `resolveTestFiles()` probes the `tests/unit/<stem>` root for
   changed source files. Stem `lib/api/rate-limiters` resolves under `tests/unit/` but **not**
   under a bare `tests/lib/` (that root is not in the probe list). Using `tests/unit/lib/api/`
   means future edits to the source file will have their test auto-resolved by the gate.

---

## Determinism / anti-contamination strategy

The underlying engine keeps a **module-level singleton `store`** keyed by `rate-limit:<ip>`.
All four limiters inherit the default IP-based key generator, so they share that store for a
given IP. To keep tests deterministic despite this singleton (and despite the pre-existing
`tests/unit/lib/security/rate-limit-middleware.test.ts`, which is isolated to its own vitest
module registry anyway):

- Every test obtains a **globally unique IP** via a never-resetting counter (`uniqueIp()`), so
  no two tests (and no two limiters exercised in one test) collide on a store key.
- `vi.useFakeTimers()` freezes `Date.now()` so window expiry is controlled only by explicit
  `vi.advanceTimersByTime()` — no real clock, no flakiness.
- No network, no random, no external collaborators. `next/server` is mocked so the default 429
  handler is a plain inspectable object.

---

## Assertions added (by test)

### re-export contract
1. `rateLimiters` is defined and is an object.
2. `rateLimiters` is **reference-identical** (`toBe`) to the export of
   `@/lib/security/rate-limit-middleware` — catches any future divergence (e.g. accidental
   shallow copy).
3. `Object.keys` is exactly `['api','auth','strict','upload']` and each value is a function.

### api limiter (100 req / 60s)
4. 50 requests from one IP all return `null` (allowed).
5. After 100 allowed requests, the 101st returns a 429 with body
   `{success:false, error:'Too many requests, please try again later'}`, `status === 429`,
   `X-RateLimit-Limit === '100'`, `X-RateLimit-Remaining === '0'`, `X-RateLimit-Reset`
   is a positive integer string, and `Retry-After === '60'`.

### auth limiter (5 req / 15 min)
6. 5 requests allowed, 6th returns 429 with `X-RateLimit-Limit === '5'`.

### upload limiter (20 req / 1 h)
7. 20 requests allowed, 21st returns 429 with `X-RateLimit-Limit === '20'`.

### strict limiter (10 req / 60s)
8. 10 requests allowed, 11th returns 429 with `X-RateLimit-Limit === '10'`.

### isolation between clients
9. Distinct IPs are tracked independently for one limiter (exhausting strict for IP A leaves
   IP B untouched).
10. Blocking one limiter/IP does not impair a different limiter on a different IP.

### window reset (time-based recovery)
11. After the strict limiter is exhausted, advancing fake time by 60_001 ms restores the
    allowance (next request returns `null`).

### fail-safe behavior
12. Every over-limit request within the window is **denied** (429, `Remaining === '0'`) — the
    limiter never silently allows traffic once the cap is hit.
13. A request with no `x-forwarded-for` / `x-real-ip` and `ip === undefined` is handled without
    throwing (degrades to the `rate-limit:unknown` key, allowed on first hit).

---

## Coverage rationale (mapping to the task's required categories)

| Required category | Where covered |
|---|---|
| Happy-path for each public entry point | Tests 4–8 exercise each of the 4 limiter functions under the limit (returns `null`). |
| Edge cases (empty/min/max/boundary) | Boundary tested at the exact threshold for every limiter (5th/6th, 10th/11th, 20th/21st, 100th/101st); missing-IP edge in test 13. |
| Error paths / dependency failures | The module is pure in-memory with no external collaborator; the "failure" mode is rate-limit denial — tests 5–8, 12 assert the denial response shape/headers. Test 13 asserts graceful handling of a malformed request. |
| Fail-safe behavior | Tests 5, 12 assert that overload degrades to the **safe state** (deny, 429, never allow-through, never throw). |
| Deterministic, no real network/clock/random | Fake timers + unique IPs + mocked `next/server`; see "Determinism" above. |

---

## Verify results

```
corepack pnpm exec vitest run tests/unit/lib/api/rate-limiters.test.ts
 Test Files  1 passed (1)
      Tests  13 passed (13)

corepack pnpm exec eslint --max-warnings=0 tests/unit/lib/api/rate-limiters.test.ts   → exit 0
corepack pnpm exec tsc --noEmit   → no errors referencing the new file
```
