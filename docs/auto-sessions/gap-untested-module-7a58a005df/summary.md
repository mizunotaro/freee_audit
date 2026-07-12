# Summary — unit tests for `src/app/api/analysis/middleware/rate-limit.ts`

**Task:** gap-untested-module-7a58a005df
**Risk class:** B
**Target:** `src/app/api/analysis/middleware/rate-limit.ts` (was untested)
**Test file added:** `tests/unit/app/api/analysis/middleware/rate-limit.test.ts` (21 tests, all passing)

## Public surface under test

The module exports a single runtime entry point — `withRateLimit(config)` — which returns a
higher-order decorator wrapping a `(request) => Promise<NextResponse>` handler. The internal
collaborators (`getClientIdentifier`, `getHybridRateLimit`, the module-level `rateLimitStore`)
are exercised through that entry point.

## Approach

- **Real `NextRequest` / `NextResponse`** (no `next/server` mock) — proven to work in this repo's
  jsdom env (see `tests/unit/app/api/chat/route.test.ts`). Lets assertions read real status codes,
  header values, and JSON bodies.
- **Fake timers** (`vi.useFakeTimers({ now: BASE_TIME })`) with `BASE_TIME = 2025-01-01T00:00:00Z`
  (an epoch divisible by 60 000) so `Date.now()`-based window math, `retryAfter`, and
  `X-RateLimit-Reset` are deterministic. The window-reset test advances the clock past `windowMs`.
- **`@/lib/security/rate-limit-hybrid` mocked** via `vi.hoisted` + `vi.mock` so the hybrid branch
  (a dynamic `await import`) can be driven without `ioredis`/Redis. The mock also serves as an
  observation point for the derived key (`limiter.check(key)`).
- **Store isolation:** the module-level `rateLimitStore` Map persists across tests, so every test
  that accumulates counts uses a per-test-unique key (counter-based `keyGenerator` or unique IP),
  preventing cross-test bleed. The module-load `setInterval` cleanup is a *real* timer (scheduled
  before fake timers activate), so it never fires during the fast test run.

## Assertions added (per test)

### Memory store (no `REDIS_URL`)
1. **allows first request** — `handler` called once; `status === 200`; body `{ ok: true }`.
2. **X-RateLimit headers + decrement** — `Limit='3'`; `Remaining` goes `'2' → '1' → '0'`;
   `Reset = BASE + WINDOW_MS`; handler called 3×.
3. **blocks past maxRequests** — 3rd request → `status === 429`; handler called only 2×.
4. **429 body + headers** — `status 429`; `body.success === false`;
   `body.error.code === 'RATE_LIMIT_EXCEEDED'`; `body.error.details.retryAfter === 60`;
   `body.metadata.requestId === 'req-abc'` (from `x-request-id`);
   `Limit='1'`, `Remaining='0'`, `Reset=BASE+WINDOW_MS`, `Retry-After='60'`.
5. **requestId defaults to "unknown"** when `x-request-id` absent.
6. **window reset** — after `advanceTimersByTime(WINDOW_MS + 1)`, request is allowed again;
   `Reset = BASE + 2·WINDOW_MS`; `Remaining='0'`; handler called 2×.
7. **default config** — `withRateLimit()` uses `RATE_LIMIT_CONFIG` (`Limit === '100'`).
8. **default IP key blocks** — `getClientIdentifier`-derived IP key: 1st allowed, 2nd → 429.
9. **distinct keys independent** — two buckets each `maxRequests:1`: a1✓ a2✗ b1✓ b2✗; handler 2×.

### `getClientIdentifier` key derivation (observed via hybrid `check` spy)
10. **first IP from comma list** — `'203.0.113.9, 198.51.100.4'` → key `'203.0.113.9'`.
11. **trims whitespace** — `'  203.0.113.10  '` → `'203.0.113.10'`.
12. **x-real-ip fallback** when `x-forwarded-for` absent → `'203.0.113.11'`.
13. **'unknown' fallback** when no IP headers → `'unknown'`.
14. **empty XFF treated as absent** — `'x-forwarded-for': ''` → `'unknown'`.

### Custom `keyGenerator`
15. **invoked with request & drives bucket** — alpha bucket: 1st✓ 2nd✗; beta bucket: ✓;
   `keyGenerator` called; first call's arg `instanceof Request`; handler 2×.

### Hybrid path (`REDIS_URL` set, mocked limiter)
16. **allowed result** — handler called; `Limit` from config (`'10'`); `Remaining='7'`,
    `Reset=BASE+5000` from hybrid result; `createHybridRateLimiter` called with
    `{ keyPrefix:'analysis-api', windowMs, maxRequests }`.
17. **denied result** — `429`; handler NOT called; `error.code === 'RATE_LIMIT_EXCEEDED'`;
    `details.retryAfter === 30`; `Reset=BASE+30000`; `Retry-After='30'`; `Remaining='0'`.
18. **fail-safe (createHybridRateLimiter throws)** — degrades to memory store; handler called;
    `Remaining='3'` (memory-computed, not hybrid).
19. **fail-safe (check rejects)** — degrades to memory store; handler called; `Remaining='3'`.

### Hybrid gating
20. **`useHybrid:false`** — even with `REDIS_URL` set, hybrid never invoked
    (`createHybridRateLimiter` & `check` not called); memory path serves the request.
21. **no `REDIS_URL`** — hybrid never invoked; memory path serves the request.

## Coverage rationale

The module has two execution branches — a fixed-window **in-memory store** and an optional
**hybrid (Redis) store** reached only when `useHybrid !== false && process.env.REDIS_URL`. Both
must be covered, plus the key-derivation logic and the fail-safe fallthrough that connects them.

- **Happy paths:** first/within-limit requests for memory and hybrid stores (tests 1, 2, 7, 16).
- **Edge cases:** window rollover, comma/whitespace IP parsing, header fallbacks, empty-XFF,
  distinct-key independence, default config (tests 2, 6, 8, 9, 10–14).
- **Error paths:** over-limit 429 for both stores, with full body/header contract; missing
  `x-request-id` (tests 3, 4, 5, 8, 17).
- **Fail-safe behavior:** any hybrid failure (import/construct throws, `check` rejects) MUST
  degrade to the memory store and still serve allowed requests rather than 500 — asserted by
  tests 18 & 19. Gating tests 20 & 21 assert the hybrid path is unreachable when disabled.

## Verification (run in this worktree)

```
corepack pnpm install --frozen-lockfile   # worktree ships without node_modules
corepack pnpm db:generate                 # prisma client (needed for repo-wide tsc)
corepack pnpm exec vitest run tests/unit/app/api/analysis/middleware/rate-limit.test.ts
  → Test Files  1 passed (1)   Tests  21 passed (21)
corepack pnpm exec eslint --max-warnings=0 <new test file>   → clean
corepack pnpm exec tsc --noEmit                             → 0 errors (whole repo)
```

## Notes

- Test placement follows the convention used by every prior merged `gap-untested-module-*` task
  (`tests/unit/<src-path-minus-src>/`), not the literal `tests/app/...` in the generator template.
- No new dependencies, no production-code changes, no `TODO`/`FIXME`/`NotImplementedError` added.
- The module's module-load cleanup `setInterval` is intentionally left untouched; it is a real
  timer that does not fire during the test run.
