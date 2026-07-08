# COV-LIB-03 — Unit-test coverage: lib/api + lib/external + lib/i18n

## Outcome

`node scripts/autopm_verify.mjs --changed-only` → **exit 0**
(typecheck 0 errors, eslint clean, vitest 57/57).

## Scope covered

Enumerated exported functions under `src/lib/api`, `src/lib/external`, `src/lib/i18n`
and mirrored those lacking a unit test under `tests/unit/lib`.

### New test files (4)

| Test file | Target | Tests |
|-----------|--------|-------|
| `tests/unit/lib/api/settings-sanitizer.test.ts` | `src/lib/api/settings-sanitizer.ts` | 13 |
| `tests/unit/lib/api/index.test.ts` | `src/lib/api/index.ts` (pure fns) | 13 |
| `tests/unit/lib/api/with-auth.test.ts` | `src/lib/api/with-auth.ts` | 15 |
| `tests/unit/lib/external/calculation-client.test.ts` | `src/lib/external/calculation-client.ts` | 16 |

Key cases:
- **settings-sanitizer** — `sanitizeSettings` null→defaults and populated→field mapping;
  `has*` booleans true/false; secret values never leak into JSON; `validateApiKeyUpdate`
  role gate (ADMIN/SUPER_ADMIN only), explicit-`undefined`-absent rule, `SENSITIVE_FIELDS` membership.
- **api/index** — `ROLE_HIERARCHY` shape + ordering; `hasMinimumRole` (equal/higher/lower,
  unknown-role both sides); `getAuthUser` (valid → user, no-cookie → null, invalid → null,
  throw → null).
- **with-auth** — rate-limit short-circuit vs pass-through; `requiredRoles` delegation and
  rejection routing; `requireCompany` 403 + happy path; authentication-failure routing;
  context forwarding; method wrappers' default rate limits (Get none / Post,Put `api` /
  Delete `strict`); `withAdminAuth` / `withAccountantAuth` required roles.
- **calculation-client** — python cashflow success + TS fallback on network failure / 4xx / 5xx;
  R endpoint selection (normality/trend/forecast); ratios body (`industry_code`);
  z-score; structured `SERVICE_UNAVAILABLE` failures; `healthCheck` (both ok / one down /
  both down); retry-count on 5xx. `fetch` mocked at the boundary; `calculateCashFlow`
  mocked to isolate the fallback.

### Skipped (already covered — no duplicate added)

- **`src/lib/i18n/{config,index,types}.ts`** — `tests/unit/lib/i18n/config.test.ts` and
  `config-extended.test.ts` already exist (committed in `c73cc8e`) and comprehensively cover
  `formatDate`/`formatNumber`/`formatCurrency`/`getDirection`/`getMessages`/`locales`/
  `defaultLocale`/`getRequestConfig`. No third file added.

### Deliberately not tested (low value / out of safe reach)

- `src/lib/api/rate-limiters.ts` — one-line re-export of the Class-A
  `@/lib/security/rate-limit-middleware` `rateLimiters`; a passthrough assertion adds
  near-zero value and couples to read-only Class-A code.
- `src/lib/api/index.ts` `withRole` / `withSuperAdminAuth` — dynamic-`import('./with-auth')`
  factories that are thin wrappers over `withAuth` (covered). Left to avoid fragile
  dynamic-import wiring for no behavioural gain.

## Notable findings

- **`calculation-client.fetchWithRetry` retries 4xx**: the 4xx branch `throw`s inside the
  `try`, but the local `catch` swallows it and the loop still sleeps + retries. So a 4xx is
  retried `retries` times (then falls back), **not** short-circuited as the `Client error`
  message implies. Tests assert the actual behaviour; no source change (Class-A-adjacent /
  out of scope, and changing it would alter retry semantics).
- All public `CalculationServiceClient` methods catch internally and return a
  `ServiceResponse` (never reject), so fake-timer rejection hazards do not apply; real timers
  with small retry counts kept the suite fast and deterministic.

## Constraints honoured

- No Class-A path modified; only additive test files (+ this summary) created.
- No `any`, `@ts-ignore`, `@ts-expect-error`, `.skip`, lint-disable, or coverage-threshold
  changes. `as unknown as <Type>` used only where matching existing test idioms.
- Only the 4 added test files were executed (`vitest run <files>`), never the full suite.
- No new dependencies.

## Environment note

This worktree shipped without `node_modules`; `corepack pnpm install --frozen-lockfile`
then `corepack pnpm db:generate` were required before tests/typecheck could run.
