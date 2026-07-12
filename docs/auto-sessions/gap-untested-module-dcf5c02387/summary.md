# gap-untested-module-dcf5c02387 — Unit tests for `src/lib/security/rate-limit-hybrid.ts`

**Risk class:** C · **Target:** `src/lib/security/rate-limit-hybrid.ts` (previously had no `tests/` entry)
**Deliverable:** `tests/unit/lib/security/rate-limit-hybrid.test.ts` (30 tests, all passing)

---

## 1. What was added

A single Vitest spec covering every **public** export of the module:

| Export | Kind | Coverage |
|---|---|---|
| `createHybridRateLimiter(config)` | factory (caches by config) | caching + instance reuse |
| `HybridRateLimiter.check(key)` | instance method | memory path + Redis fail-safe path |
| `HybridRateLimiter.middleware()` | instance method | all branches (skip/keyGen/handler/default-key/429) |
| `HybridRateLimiter.destroy()` | instance method | idempotency |
| `withHybridRateLimit(handler, config)` | wrapper | allow + block |
| `hybridRateLimiters.{api,auth,upload,strict}` | factories | shape + caching + behavioral config |
| `destroyAllLimiters()` | utility | cache clear + empty no-op |

`MemoryRateLimitStore` and `RedisRateLimitStore` are not exported; they are exercised
indirectly through `check()`.

## 2. Determinism strategy

- `vi.useFakeTimers()` + `vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'))` in
  `beforeEach` → `Date.now()` is fixed, so `resetAt`, `retryAfter`, sliding-window pruning
  and the `X-RateLimit-Reset` header are all exact, assertable values.
- The module-level `limiters` Map is reset every test via `destroyAllLimiters()` in
  `afterEach` (each test also uses a unique `keyPrefix` so cached instances never bleed).
- The `MemoryRateLimitStore` cleanup `setInterval` is created under fake timers (never
  auto-fires) and cleared by `destroy()`.
- `next/server` is mocked so `NextResponse.json` returns an object with a controllable
  `headers.set/get` Map — identical pattern to the sibling
  `tests/unit/lib/security/rate-limit-middleware.test.ts`.

## 3. Assertions by test (30 tests)

**Memory store / `check` (8)**
1. `allows the first request…` — `allowed=true`, `remaining=2`, `resetAt=BASE+60000`, `retryAfter` undefined.
2. `decrements remaining and blocks at the boundary…` — remaining 2→1→0 then blocked; `count===max` allowed, `count===max+1` blocked; blocked `remaining=0`, `resetAt`, `retryAfter=60`.
3. `tracks different keys independently` — keys a/b each get their own count.
4. `accepts an empty string key` — `''` → usable bucket, `allowed=true`.
5. `blocks the first request when maxRequests is 0` — edge: `allowed=false`, `remaining=0`, `retryAfter=60`.
6. `resets the count after the window elapses (sliding window)` — exhaust, advance `setSystemTime` past `resetAt` → reset branch, `remaining=1`, new `resetAt`.
7. `handles concurrent checks deterministically` — 10 concurrent `check()`s, max 5 → exactly 5 allowed / 5 blocked (memory `increment` body is synchronous, so counts are 1..10).
8. `caches a limiter per config…` — same config ⇒ identical instance; different `keyPrefix` ⇒ distinct.

**Redis store path — fail-safe (5)** — see §4 for why only fail-safe.
9. `degrades to the memory store when REDIS_URL is set but Redis is unavailable` — `useRedis=true`, ioredis absent ⇒ memory fallback, `remaining=1`, `resetAt=BASE+60000`.
10. `still enforces the limit after fail-over (does not fail open)` — memory count 1,2 allowed, 3 blocked; `remaining=0`, `retryAfter=60`.
11. `tracks distinct keys independently even after fail-over`.
12. `middleware still returns a 429 once the memory fallback limit is exceeded`.
13. `destroy() does not throw when Redis was never connected`.

**`middleware()` (8)**
14. `returns null when the request is within the limit`.
15. `returns a 429 response with rate-limit headers…` — body, `X-RateLimit-Limit=1`, `-Remaining=0`, `-Reset=BASE+60000`, `Retry-After=60`.
16. `skips rate limiting entirely when skip() returns true` — `skip` called each time, never counted.
17. `uses a custom handler when the limit is exceeded` — custom response returned, headers still applied.
18. `uses a custom key generator` — `keyGenerator` invoked with req.
19. `derives the default key from x-forwarded-for (first IP) and isolates IPs` — `1.1.1.1, 2.2.2.2` → `1.1.1.1`; distinct IPs isolated.
20. `falls back to x-real-ip when x-forwarded-for is absent`.
21. `falls back to the "unknown" bucket when no IP header is present` — shared bucket blocks 2nd request.

**`withHybridRateLimit` (2)**
22. `invokes the wrapped handler…when allowed` — handler called once, its response returned.
23. `blocks the wrapped handler and returns a 429…` — handler not called, `status=429`.

**Factories (4)**
24. `exposes api/auth/upload/strict factory functions returning limiter instances` — each returns object with `check`/`middleware`/`destroy`.
25. `caches limiters per config` — `api()`≡`api()`; `auth()`≠`api()`.
26. `auth factory enforces 5 requests per 15 minutes` — 5 allowed, 6th blocked.
27. `strict factory enforces 10 requests per minute` — 10 allowed, 11th blocked.

**`destroy` / `destroyAllLimiters` (3)**
28. `destroyAllLimiters clears the cache…` — re-create returns a new instance.
29. `destroy is idempotent`.
30. `destroyAllLimiters is a no-op on an empty cache`.

## 4. Coverage rationale & the Redis-success gap

Measured source coverage with this spec (v8 provider, scoped to the target file):

```
Statements 78.04% | Branches 74.54% | Functions 85.71% | Lines 80.17%
```

**Uncovered lines** are exclusively the Redis *success* path inside the private
`RedisRateLimitStore`: `new Redis(...)`, the `multi()`/`exec()` sliding-window commands,
`count + 1` return, and the success-branch assignment in `check()`.

This gap is **intentional and unavoidable under the task constraints**:

- `ioredis` is an **optional** runtime dependency — it is not in `package.json` and not
  installed. The source loads it lazily via `require('ioredis')` inside a `try/catch`,
  precisely so the limiter degrades to the in-memory store when it is absent.
- The task forbids adding new library dependencies, so the real `ioredis` cannot be installed.
- Three interception strategies were attempted and proven **ineffective** for a native
  `require()` of an uninstalled module (each still threw `Cannot find module 'ioredis'`):
  1. `vi.mock('ioredis', …)` — vitest does not intercept runtime `require()`.
  2. `resolve.alias` → a CJS stub — vite alias does not apply to native `require()`.
  3. `test.server.deps.moduleDirectories` — also bypassed by native `require()`.
  (All three experiments were reverted; `vitest.config.ts` is byte-identical to HEAD.)

The fail-safe tests (§3 #9–13) cover the **only Redis-path branch that is reachable** in this
environment: `useRedis=true` → `connect()` → `createConnection()` → `require('ioredis')`
throws → caught → `connect()` returns `null` → `increment()` throws `'Redis not available'`
→ `check()` catch → `MemoryRateLimitStore.increment`. They assert the security-critical
contract: **the limiter does not fail open** — it keeps enforcing the limit via memory.

These tests are not fake-green: removing the `try/catch` around `redisStore.increment` in
`check()` (the fail-safe) makes `require('ioredis')`'s throw propagate and fail the tests.

## 5. Quality gate

- `pnpm exec vitest run …rate-limit-hybrid.test.ts` → **30/30 pass**.
- `pnpm exec eslint …rate-limit-hybrid.test.ts --max-warnings=0` → **clean**.
- `pnpm exec tsc --noEmit` (full repo) → **0 errors** (file introduces none).
- No new dependencies; `vitest.config.ts` unchanged; no `node_modules`/`__mocks__` writes.
