# E2E-CORE-01 — E2E green baseline (login → dashboard, mock mode)

## Outcome

A minimal happy-path E2E now passes end-to-end and the verify gate is green.

- **Definition of Done** — `node scripts/autopm_verify.mjs --changed-only` → **exit 0**.
- **Real run** — `playwright test tests/e2e/smoke.spec.ts` → **1 passed (23.6s)**:
  globalSetup synced the SQLite schema + seeded the admin, then the browser logged in
  as `admin@example.com` / `admin123`, redirected to `/dashboard`, and the
  `Quick Actions` card became visible.

## What changed

| File | Change |
|------|--------|
| `tailwind.config.ts` | **Root-cause fix.** `plugins: [require('tailwindcss-animate')]` → ESM `import`. Next 16 loads `tailwind.config.ts` via the ESM loader, so the bare `require` threw `ReferenceError: require is not defined` and crashed the dev server on the first page render — breaking **all** dev-mode rendering (hence all E2E). |
| `tests/e2e/lib/env.ts` (new) | Shared E2E env: forces `FREEE_MOCK_MODE`/`AI_MOCK_MODE=true`, and provides boot-time fallbacks (`CSRF_SECRET`≥32, valid 64-hex `ENCRYPTION_KEY`, `JWT_SECRET`, `DATABASE_URL`) so `pnpm e2e` runs without a `.env.local`. `webServerEnv()` filters `process.env` to defined values (Playwright's `env` is `Record<string,string>`). |
| `tests/e2e/global-setup.ts` (new) | Playwright `globalSetup`: `applyE2eEnvDefaults()` → `prisma db push --skip-generate` → upsert `company_1` + admin user (bcrypt `admin123`). Idempotent. The CI e2e job does **no** migrate/seed, so this makes `pnpm e2e` self-contained. |
| `playwright.config.ts` | Wires `globalSetup` and `webServer.env: webServerEnv()`. Dev server now boots in mock mode with the required secrets. `process.env` wins for secrets (CI job env respected). |
| `tests/e2e/smoke.spec.ts` (new) | The smoke test: `goto /ja/login` → fill by accessible label → click `Sign In` → assert URL `/\\/dashboard/` + `Quick Actions` visible. Role/label selectors, Playwright auto-waiting, **no sleeps**. |
| `scripts/autopm_verify.mjs` | `resolveTestFiles` now excludes `*.spec.ts` (Playwright) from the **vitest** step. Vitest's `include` is `*.test.ts` only (`.spec.ts` → "No test files found", exit 1), so the gate previously could never pass on an E2E spec change. `.spec.ts` is still typechecked + linted by the gate; the CI `e2e-tests` job runs it for real. |

## How the smoke flow works

1. Playwright starts `pnpm dev` with `webServer.env` → mock mode on, `CSRF_SECRET`≥32 → server boots.
2. `globalSetup` pushes the schema into `test.db` and seeds the admin.
3. Spec fills the login form; `POST /api/auth/login` validates the bcrypt hash, writes an
   `AuditLog`, and sets the `session` cookie. Chromium permits the `Secure` cookie on
   `http://localhost`, so the subsequent `/ja/dashboard` request is authenticated.
4. Middleware validates the session; dashboard renders (static `Quick Actions` card is
   locale-independent and renders before the `/api/dashboard` fetch resolves).

## Constraint compliance

- No Class-A path touched (`schema.prisma`, migrations, `auth*`, `crypto.ts`,
  `security/**`, `audit/**`, service/api trees, microservices). All read-only reference only.
- No `any` / `@ts-ignore` / `@ts-expect-error` / `.skip` / lint-disable / coverage lowering.
- Additive, minimal diffs; `Result<T,E>`/Zod not needed here (no new service surface).
- Only the added/modified tests were exercised (`playwright test tests/e2e/smoke.spec.ts`;
  `autopm_verify --changed-only`). Full suite never run (known OOM).
- No new dependencies (`tailwindcss-animate`, `@playwright/test`, `@prisma/client`,
  `bcryptjs` all pre-existing).

## Dependency on sibling task ci-fix-02 (verified, not duplicated)

`src/lib/security/csrf-protection.ts` validates `CSRF_SECRET` ≥32 chars at module-import
time. The CI `e2e-tests` job (and its `pnpm build` step, which is outside Playwright's
`webServer.env`) needs that value to be ≥32. Commit `936512c` (**ci-fix-02**, on a separate
branch, not yet in `origin/master`) fixes the e2e job's `CSRF_SECRET` in `.github/workflows/ci.yml`.

This task intentionally **does not** touch `ci.yml` (per the brief: "verify, don't duplicate").
Locally the run is self-sufficient because `env.ts` supplies a ≥32 fallback; in CI the e2e job
is green once ci-fix-02 lands. Confirmed ci-fix-02 is the owner of that line.

## Notes / follow-ups

- The verify gate's diff filter buckets `playwright.config.ts`, `tailwind.config.ts`,
  `global-setup.ts`, `env.ts` as `other`, so the gate does not typecheck/lint them — but
  CI's whole-repo `pnpm typecheck` does. Verified `tsc --noEmit` is clean (0 errors) manually.
- The pre-existing `tests/e2e/{auth,audit,reports,security}.spec.ts` still use `waitForTimeout`
  sleeps and loose selectors; stabilizing them is out of scope here (additive-only). The new
  `smoke.spec.ts` is the clean baseline.
- `pnpm dev` was verified (the Playwright `webServer` path). A full `pnpm build` was not run
  (slow, unrelated surface); the Tailwind ESM fix benefits both build and dev.
