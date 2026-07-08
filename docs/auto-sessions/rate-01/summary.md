# RATE-01 — Outbound rate limiting + explicit User-Agent (non-Class-A callers)

## Outcome

Applied CrystalBall "rate control" (User-Agent header + rate limiting on all
external calls) to the non-Class-A outbound callers: **market-data**,
**external-info**, and **lib/external**. freee integration is Class-A and was
**not touched** (deferred to rate-02).

`node scripts/autopm_verify.mjs --changed-only` → **exit 0**
(typecheck 0 errors, eslint 0 warnings, vitest 83 passed).

## Key design decision — why a new outbound limiter (not the existing one)

The task pointed at `src/lib/api/rate-limiters.ts`. That file re-exports
`rateLimiters` from `src/lib/security/rate-limit-middleware.ts`, whose entire API
is **inbound**: `rateLimit()` / `withRateLimit()` return NextRequest middleware
(`(req) => NextResponse | null`). It has no string-keyed token API and cannot
govern a raw outbound `fetch()`. The same is true of the inbound presets
(`rateLimiters.api/auth/upload/strict`).

So applying it *literally* to outbound calls is impossible without rewriting the
Class-A security module. Instead, the new sibling module
`src/lib/api/outbound-rate-limiter.ts` **reuses the same policy shape and
sliding-window algorithm** as the existing limiters (`{ windowMs, maxRequests,
keyPrefix }` + timestamp-bucket store) but is keyed by outbound host so it can
wrap `fetch()`. `src/lib/api/rate-limiters.ts` is **unchanged** ("do not rewrite
it" honored); `src/lib/security/**` (Class-A) is untouched.

This is documented as a deliberate, minimal-deviation ADR rather than a silent
one. The hybrid store's keyed `check()` would also have worked but was rejected
to avoid coupling outbound HTTP to the security/Redis module.

## What changed

### New module: `src/lib/api/outbound-rate-limiter.ts`
- `OUTBOUND_USER_AGENT` — `freee_audit/1.0.0 (+https://github.com/mizunotaro/freee_audit)`,
  overridable via `APP_USER_AGENT`.
- `withOutboundUserAgent(headers?)` — merges the UA **without clobbering a
  caller-supplied value**, and **preserves original header-key casing** (copies
  entries rather than re-normalising through `new Headers()`, which lowercases
  keys and breaks callers that later read their own `Content-Type`/`Authorization`).
- `OutboundRateLimiter.tryAcquire(key)` → `Result<Decision, AppError>` — sliding
  window; denied attempts consume no token; empty key returns a `VALIDATION_ERROR`
  Result.
- `createOutboundRateLimiter(config: unknown)` → `Result` — validates with **Zod
  `safeParse`**.
- `outboundRateLimiters` registry (mirrors inbound `rateLimiters`):
  - `marketData()` — **60 req/min** per host. ~1 req/s (polite to EDINET/J-Quants)
    yet leaves headroom for legitimate EDINET date-range document scans (which
    can issue up to ~30 sequential calls).
  - `externalInfo()` — 20 req/min per source.
  - `internalService()` — 300 req/min per host (own python/R microservices).
- `assertOutboundAllowed(limiter, key)` — bridges the Result-based limiter to the
  throw-based error contracts existing callers already map to failure results.
- `resolveOutboundHost(url)`, `resetOutboundRateLimiters()` (test/diagnostic).

### Wirings (additive, 1–3 lines each)
- `src/services/market-data/base-provider.ts` — `fetchWithTimeout` (used by both
  EDINET + J-Quants) now acquires a `marketData` token keyed by host and sends
  the UA. Over-limit throws `OutboundRateLimitError`, which the providers already
  map to `{ success:false, error }`.
- `src/lib/external/calculation-client.ts` — `fetchWithRetry` acquires an
  `internalService` token + sends UA; `checkServiceHealth` sends UA (liveness
  probes are deliberately **not** rate-limited, so a probe can't self-throttle
  into a false-negative).
- `src/services/external-info/sources/base-source.ts` — new `protected
  assertOutboundRateLimit()`; `NtaInfoSource`/`WebSearchInfoSource` call it at
  the top of `fetch()`.

## Honesty note — external-info

The external-info **sources are unimplemented stubs**: `NtaInfoSource` and
`WebSearchInfoSource` throw `not implemented` before any HTTP call, and
`MockInfoSource` returns canned data. There is **no live outbound HTTP** there
today. The rate-limit guard is therefore wired at the `fetch()` boundary so the
policy is enforced now and inherited by future real implementations. The
**User-Agent** for these sources is deferred — it only matters once a real
`fetch` exists, so adding it now would be dead code. `BaseInfoSource.assertOutboundRateLimit`
is the seam future implementations should call alongside `withOutboundUserAgent`.

## What was NOT touched (Class-A / out of scope)
`prisma/**`, `src/lib/auth*`, `src/lib/crypto.ts`, `src/lib/security/**`,
`src/lib/audit/**`, `src/services/{audit,conversion,valuation,tax,kpi,debt,deferred-accrual,journal-proposal,freee}/**`,
`src/lib/integrations/freee/**`, the Class-A API routes, `python-service/**`,
`r-service/**`. No new dependencies. No `any`/`@ts-ignore`/`.skip`/lint-disable.

## Tests added
- `tests/unit/lib/api/outbound-rate-limiter.test.ts` (23) — limiter allow/deny,
  sliding-window replenish, denied-no-consume, Zod validation, UA merge/casing,
  registry caching, reset, `assertOutboundAllowed` throw path.
- `tests/unit/services/market-data/outbound-controls.test.ts` (2) — UA sent on
  fetch; over-limit throws and skips fetch.
- `tests/unit/lib/external/calculation-client-outbound.test.ts` (2) — UA on data
  calls and health probes.
- `tests/unit/services/external-info/sources/outbound-rate-limit.test.ts` (3) —
  NTA/WebSearch rate-limit guard engages when budget exhausted; normal path
  unchanged.

Existing affected tests (base-provider, calculation-client, base-source,
nta/web-search sources, EDINET/J-Quants providers) all still pass unchanged.
