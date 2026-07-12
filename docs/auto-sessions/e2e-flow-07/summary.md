# E2E-FLOW-07 — Navigation, auth-guard redirects, 404/error boundary

**Status:** implemented · **DoD:** `node scripts/autopm_verify.mjs --changed-only` exits 0
(typecheck 0 errors repo-wide · eslint 0 warnings on the 1 changed file · vitest n/a: no
related `*.test.ts` resolves for a Playwright `*.spec.ts`). The Playwright spec was also run
locally and passes **4/4 green** (47.9s) against the real middleware + handlers + built-in
404 boundary in mock mode.

## Goal

Exercise **existing** routing/auth behaviour only (no Class-A path touched):

1. unauthenticated access to a protected route → redirect to login;
2. a bad URL → the 404/error boundary;
3. primary nav links resolve.

## What was added (1 file, additive)

**`tests/e2e/nav-auth-guard-flow.spec.ts`** — new Playwright spec, 4 tests. Mirrors the
FLOW-05 idiom: one `beforeAll` login (seeded admin) → store cookies → inject via
`context.addCookies` in the authenticated `describe`'s `beforeEach`; unauthenticated tests
use the default per-test context (no cookies). Exactly **1 login POST** (respects the
5-logins/15-min/IP limiter shared in-memory across the e2e run). No sleeps — Playwright
auto-waits on `toHaveURL` / locator visibility. No DB seeding (pure routing/nav), so the
spec is idempotent and contributes no data writes.

- **`protected pages redirect to the login page`** — fresh (cookie-free) context visits
  `/ja/dashboard`, `/ja/audit/journals`, `/ja/reports/monthly`; each funnels to `/ja/login`
  (the **live** middleware page-redirect branch), then asserts the login form is visible.
- **`a protected API endpoint rejects a token-less request with 401`** — standalone
  `request.get('/api/journals')` (no Authorization header, no cookie) → 401
  `{success:false}`.
- **`primary nav links render and a click resolves within the app`** — authenticated;
  asserts the desktop `DockSidebar` `<aside><nav>` mounts (proves `/api/auth/me` honoured
  the cookie), that 5 representative primary destinations exist as locale-prefixed
  `a[href]`s, and that clicking the Settings link client-navigates to `/ja/settings`
  (URL match + shared authenticated layout persists).
- **`an unmatched route renders the built-in 404 boundary, not a login redirect`** —
  authenticated visit to `/ja/e2e-flow-07-missing-route` → HTTP **404**, not redirected to
  login, with the built-in copy `<h1>404</h1>` + `This page could not be found.`.

## Key behaviour facts (verified, not assumed)

- **No custom `not-found.tsx` / `error.tsx` / `global-error.tsx` exists anywhere under
  `src/app`**, and there is no catch-all segment under `[locale]` (only specific `[id]`
  dynamic routes). So an unmatched `/{locale}/*` path falls through to **Next's built-in
  404**. The exact rendered copy was read from
  `node_modules/next/dist/client/components/builtin/not-found.js` +
  `.../http-access-fallback/error-fallback.js`: `<title>404: This page could not be
  found.</title>`, `<h1 class="next-error-h1">404</h1>`, `<h2>This page could not be
  found.</h2>`, HTTP 404. The spec asserts the message text + the `404` heading + status.
- **The middleware `/api/*` 401 branch is dead code** (`config.matcher` excludes `api` —
  see rev-sec-01). So API auth is **not** enforced by middleware; it is enforced at the
  handler. `/api/journals/route.ts` reads the `Authorization: Bearer` header and returns
  401 when absent — that is what the API test exercises. (Other routes that rely on the
  cookie-set `x-user-id` header have **no** working gate once the matcher exclusion is
  considered; that is a pre-existing security finding, out of scope here and deliberately
  not papered over.)
- **The middleware page-redirect branch IS live**: the matcher does not exclude `ja`/`en`
  page paths, so an unauthenticated `/{locale}/*` page hit is redirected to
  `/{locale}/login`. The `(authenticated)/layout.tsx` adds a second, client-side guard
  (`/api/auth/me` → push to login). Both are existing behaviour; the spec exercises the
  middleware guard for unauthenticated visits and the client guard implicitly (the
  authenticated nav test waits for the dock to mount).

## Design decisions worth recording

- **Anchored on `a[href]`, not on nav labels.** The `DockSidebar` collapses by default and
  expands on hover; the link's accessible name is present regardless, but the locale-prefixed
  `href` (`/ja/reports/monthly`, …) is fully deterministic and locale-stable, so locators
  use `aside nav a[href="…"]` rather than the translated label.
- **Click target = Settings.** A known-good mock-mode destination (proven by E2E-FLOW-03);
  clicking it proves a primary nav link resolves to a real authenticated page (URL match,
  not login, shared layout persists) without depending on any destination page's
  data-rendering quirks.
- **404 test is authenticated on purpose.** Without a valid session the middleware would
  redirect `/ja/<anything>` to login *before* Next could render the 404. Authenticating
  first lets the locale-prefix guard pass so the unmatched segment actually reaches the
  not-found boundary — exercising the intended 404 path rather than the auth path.
- **No API-gate fix attempted.** The dead middleware `/api` branch is Class-A-adjacent
  (`src/middleware.ts` / `src/lib/security/**`); per the task constraints it is left
  untouched and only noted here. The one API assertion uses a handler that self-enforces.

## Local run notes (Windows runbook)

`pnpm` is not on PATH → `corepack pnpm`. Worktree arrived without `node_modules` →
`corepack pnpm install --frozen-lockfile` then `corepack pnpm db:generate` (install does
**not** generate the Prisma client). The Playwright `webServer` boot fails when it spawns
`pnpm dev` (pnpm not on PATH), so the mock dev server was started by hand
(`corepack pnpm dev` with `DATABASE_URL=file:./test.db` + the `lib/env.ts` boot secrets +
`FREEE_MOCK_MODE/AI_MOCK_MODE=true`) and Playwright reused it (`reuseExistingServer`).
`global-setup.ts` ran `prisma db push` + seeded admin into `prisma/test.db` (gitignored).
Run: `corepack pnpm exec playwright test tests/e2e/nav-auth-guard-flow.spec.ts`.
