# Summary — unit tests for `src/app/api/analysis/middleware/security-headers.ts`

**Task:** gap-untested-module-88bd9ff373
**Risk class:** B
**Target:** `src/app/api/analysis/middleware/security-headers.ts` (was untested)
**Test file added:** `tests/unit/app/api/analysis/middleware/security-headers.test.ts` (26 tests, all passing)

## Public surface under test

The module exports three symbols, all exercised directly:

- `SECURITY_HEADERS` — a frozen `as const` map of five response hardening headers.
- `addSecurityHeaders<T>(response)` — mutates the response in place, stamping the five base
  headers unconditionally and adding a `Content-Security-Policy` header **only when
  `process.env.NODE_ENV === 'production'`**; returns the same response instance.
- `withSecurityHeaders()` — a decorator factory returning a higher-order wrapper around a
  `(request: Request) => Promise<NextResponse<T>>` handler that runs `addSecurityHeaders` on the
  handler's response.

## Approach

- **Real `NextResponse`** (no `next/server` mock) — proven to work in this repo's jsdom env
  (see `tests/unit/app/api/chat/route.test.ts` and the sibling
  `tests/unit/app/api/analysis/middleware/rate-limit.test.ts`). Lets assertions read real
  `Headers` values and JSON bodies.
- **`NODE_ENV` is the only external collaborator.** The module reads it at call time (inside
  `addSecurityHeaders`), so each test drives the branch by mutating `process.env.NODE_ENV`. A
  `setNodeEnv` helper casts `process.env` to a mutable record (the project's Node types mark
  `NODE_ENV` read-only — same pattern as `tests/setup.ts`), and `beforeEach`/`afterEach`
  snapshot/restore the original value so production-only tests cannot leak into siblings.
- **Helper factories** (`makeResponse`, `makeHandler`, `expectAllBaseHeaders`) keep the tests
  terse and the contract (the exact five headers + canonical CSP) declared once.
- No fake timers needed — the module is synchronous and clock-free.

## Assertions added (per test)

### `SECURITY_HEADERS` constant
1. **exposes exactly the five hardening headers** — `Object.keys(...).sort()` deep-equals the
   expected five-name set (no more, no fewer).
2. **maps each name to its canonical value** — `nosniff`, `DENY`, `1; mode=block`,
   `strict-origin-when-cross-origin`, `camera=(), microphone=(), geolocation=()`.

### `addSecurityHeaders`
3. **stamps all five base headers** onto a plain response (via `expectAllBaseHeaders`).
4. **returns the same response instance** (`result === response`) — in-place mutation, not a clone.
5. **preserves unrelated headers** already present (`x-request-id: req-123` survives) and still
   sets the five base headers.
6. **overwrites a weaker pre-existing security header** — `x-frame-options: SAMEORIGIN` → `DENY`.
7. **idempotent** — applying twice yields identical single values, no duplication.
8. **no CSP when `NODE_ENV` is not production** (`'test'`) — `content-security-policy` is `null`.
9. **preserves a caller-supplied CSP in non-production** — a pre-set `default-src 'self'` is left
   untouched (the function never strips or overwrites CSP outside production).
10–14. **`it.each` boundary cases** — for `NODE_ENV` ∈
   `['development', 'staging', '', 'Production', 'prod']` the CSP is **not** set. Only the exact
   value `'production'` triggers the branch (asserts case-sensitivity and rejects near-misses).
15. **sets the CSP verbatim in production** — header equals the exact directive string from the
   source (`default-src 'self'; ... frame-ancestors 'none';`).
16. **base headers still applied in production** alongside the CSP (the five + CSP together).
17. **keeps body and status intact** — after stamping, `status === 201` and
   `await response.json()` deep-equals `{ ok: true }`.
18. **fails safe (no throw)** — in production, on a well-formed response, the call never throws.

### `withSecurityHeaders`
19. **wrapper stamps the security headers** — handler called once; response carries all five base
    headers.
20. **forwards the original request unchanged** — `handler` called with the exact `Request`
    instance passed to the wrapper.
21. **preserves handler body and status** — `status === 201`, body `{ created: true }`.
22. **sets CSP through the wrapper in production** — `content-security-policy === EXPECTED_CSP`.
23. **no CSP through the wrapper in non-production** — `content-security-policy` is `null`.
24. **returns the exact instance the handler returned** — the wrapper mutates and returns it, it
    does not clone (`response === handlerResponse`).
25. **propagates handler errors (fails closed)** — a throwing handler's error is re-thrown, not
    swallowed; the handler ran exactly once.
26. **each `withSecurityHeaders()` call yields an independent wrapper** — `wrapA !== wrapB`, and
    `wrapA(handlerA)` / `wrapB(handlerB)` each route to their own handler, each called once, each
    response hardened.

## Coverage rationale

The module has a single conditional branch — the production-only `Content-Security-Policy` — plus
the unconditional five-header stamp and the decorator plumbing. All three must be covered, and the
CSP branch's *fail-safe* direction is "absent unless explicitly production", which is itself a
security-relevant invariant worth pinning.

- **Happy paths:** base headers applied (3); wrapper end-to-end (19, 20, 21); CSP applied in
  production (15, 16, 22).
- **Edge cases:** in-place mutation (4), unrelated-header preservation (5), weaker-value override
  (6), idempotency (7), body/status preservation (17, 21), decorator identity/independence (24,
  26).
- **Boundary conditions:** the `NODE_ENV` predicate is exact and case-sensitive — the `it.each`
  (10–14) probes `development`, `staging`, empty string, the capitalised `Production`, and the
  prefix `prod`, all of which must NOT enable the CSP.
- **Error paths:** a throwing handler must surface its error (25) rather than be silently swallowed
  into a headerless response.
- **Fail-safe behavior:** (a) outside production the function must not inject, strip, or overwrite a
  CSP (8, 9) — a dev-time caller's own CSP is honored; (b) the function must never throw on a
  well-formed response (18), so it can never turn a valid response into a 500 by failing to stamp
  headers.

## Verification (run in this worktree)

```
corepack pnpm install --frozen-lockfile   # worktree ships without node_modules
corepack pnpm db:generate                 # prisma client (needed for repo-wide tsc)
corepack pnpm exec vitest run tests/unit/app/api/analysis/middleware/security-headers.test.ts
  → Test Files  1 passed (1)   Tests  26 passed (26)
corepack pnpm exec eslint --max-warnings=0 <new test file>   → clean
corepack pnpm exec prettier --check <new test file>          → clean
corepack pnpm exec tsc --noEmit                             → 0 errors (whole repo)
```

## Notes

- Test placement follows the convention used by every prior merged `gap-untested-module-*` task
  for `src/app/api/**` (`tests/unit/<src-path-minus-src>/`), matching the sibling
  `tests/unit/app/api/analysis/middleware/rate-limit.test.ts` — not the literal `tests/app/...`
  path printed by the task generator.
- No new dependencies, no production-code changes, no `TODO`/`FIXME`/`NotImplementedError` added.
- The CSP directive string is asserted verbatim (test 15) so any future change to the policy is a
  deliberate, reviewable test update rather than a silent drift.
