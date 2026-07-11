# SEC-IMPL-01 — Session Summary

> Branch: `feature/auto/sec-impl-01` · Date: 2026-07-11
> Source proposal: `docs/proposals/rev-sec-01.md` (REV-SEC-01; all findings `PENDING HUMAN DETERMINATION`)
> Scope: implement ONLY the non-Class-A recommendations. All Class-A paths untouched (deferred).

## Required PR labels (security — do not auto-merge)

- `human-review-required`
- `do-not-auto-merge`

---

## 0. Course-correction: SEC-HEADER-01 is already satisfied

The proposal (§8, SEC-HEADER-01) states security headers are "per-route (one route)" with no
global CSP/HSTS. **This is incorrect.** `next.config.js` `headers()` (lines 43-74) already applies
a full defensive header set on the catch-all `/:path*` source — which covers **pages and API
routes** — since the initial commit:

- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `Content-Security-Policy` with `default-src 'self'`, scoped `script-src`/`style-src`/`img-src`/
  `font-src`, an explicit `connect-src` allowlist (self + the LLM provider origins), and the
  hardening directives `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`
- `poweredByHeader: false`

An earlier draft of this session added a redundant middleware header writer + a second CSP. That
was **reverted** — it would have produced duplicate/conflicting headers and needlessly touched
middleware auth-gate semantics. The correct non-Class-A action is a **regression test** that pins
the existing `next.config.js` configuration (see §1). `middleware.ts` is left **unmodified**
(auth-gate semantics are deferred to a human, per proposal §4 SEC-AUTH-01).

## 1. What changed (and why each is safe)

### SEC-HEADER-01 — regression test guarding the existing global headers (TEST ONLY)
`tests/unit/security/global-security-headers.test.ts` text-scans `next.config.js` and asserts the
`headers()` block on `/:path*` carries the defensive set + CSP/HSTS, and that `poweredByHeader` is
disabled. Prevents silent regression. No source change — the protection already exists.

### SEC-AUTH-01 (option b) — auth-adoption guard (TEST ONLY)
`tests/unit/security/auth-adoption.test.ts` walks every `src/app/api/**/route.ts` and fails if one
imports neither `@/lib/api` nor `@/lib/auth` and is not on the public allowlist (`/api/health`
only). Catches the "brand-new route with no auth" regression. Baseline: 117/118 routes adopt auth;
`/api/health` is allowlisted; `/api/investor/accept` imports `@/lib/auth` (session creation). The
dead middleware API gate is left as-is (harmless unreachable code); auth-gate retirement is a human
decision.

### SEC-CRYPTO-06 — remove the well-known `ENCRYPTION_KEY` from user-facing templates (CONFIG)
`.env.example` and `README.md` shipped the sequential value
`0123456789abcdef…0123456789abcdef` (a valid 64-hex key that looks "generated"). Replaced with the
`<generate-32-byte-hex-string>` placeholder used by the sibling `JWT_SECRET`/`CSRF_SECRET` lines.
**Scope is user-facing templates only.** The same value remains the explicit dev/test fixture in
`tests/setup.ts`, `tests/helpers/db.ts`, `tests/e2e/lib/env.ts`, and unit crypto tests — those are
correct (a known test key, not a production secret) and are intentionally **not** changed.
`scripts/security-checklist.js` only flags literal defaults (`change-me`, `test-secret`, …), so the
placeholder does not trip it. Test: `tests/unit/security/env-example.test.ts`.

### SEC-SECRET-03 — refuse `LocalSecretProvider` in production (CODE, non-Class-A)
`src/lib/secrets/index.ts`: `LocalSecretProvider` reads a **plaintext** `./secrets.json`. It now
throws at construction when `NODE_ENV === 'production'` (fail-closed) with guidance to use a managed
provider. `src/lib/secrets/**` is **not** Class-A (only `src/services/secrets/**` is). Default
provider is `env`, so this only fires on the explicit misconfiguration `SECRET_PROVIDER=local` in
prod. No effect in dev/test (`NODE_ENV=test`). Existing `tests/unit/lib/secrets/secrets-manager.test.ts`
still passes (constructs the provider under `NODE_ENV=test`). Test:
`tests/unit/security/local-secret-provider-prod-guard.test.ts` (uses `vi.stubEnv` —
`process.env.NODE_ENV=` is TS-readonly `TS2540`).

## 2. Files touched

| File | Bucket | Note |
|---|---|---|
| `src/lib/secrets/index.ts` | src | SEC-SECRET-03 prod guard (non-Class-A) |
| `.env.example` | config | SEC-CRYPTO-06 placeholder (user-facing) |
| `README.md` | docs | SEC-CRYPTO-06 placeholder (user-facing) |
| `tests/unit/security/global-security-headers.test.ts` | new test | SEC-HEADER-01 guard |
| `tests/unit/security/auth-adoption.test.ts` | new test | SEC-AUTH-01(b) guard |
| `tests/unit/security/env-example.test.ts` | new test | SEC-CRYPTO-06 guard |
| `tests/unit/security/local-secret-provider-prod-guard.test.ts` | new test | SEC-SECRET-03 guard |
| `docs/auto-sessions/sec-impl-01/{summary,decisions}.md` | docs | this session |

No Class-A path modified. No new dependencies. No secrets committed. No new TODO/FIXME.

## 3. Verification

```
node scripts/autopm_verify.mjs --changed-only   → exitCode 0
  typecheck: total errors=0, relevant=0
  eslint:    5 files, exit 0
  vitest:    4 files, 11 tests passed
```

Also run manually: full `pnpm exec tsc --noEmit` → exit 0 (whole repo clean); eslint on all changed
files → exit 0; `tests/unit/lib/secrets/secrets-manager.test.ts` (existing, not in diff-stem set)
run manually → passes with the prod guard in place.

## 4. Deferred to human (Class-A / security-critical / product decision)

See `decisions.md` for ADR-style rationale. Headline:

- **SEC-SECRET-01 (proposal priority #1)** — cross-tenant secret read via unfiltered `userId` in
  `src/services/secrets/api-key-service.ts`. Proposal marks `src/services/secrets/**` Class-A; the
  proper fix needs `companyId` on the `Settings` query/model (schema = Class-A) and the banned caller
  `journal-proposal-service.ts`. **Deferred — human must action.** Minimal fix sketch in `decisions.md`.
- **SEC-HEADER-01 (the fix)** — already satisfied by `next.config.js`; only a regression test added.
- **SEC-AUTH-01 option (a) / SEC-RBAC-05** — middleware gate enablement / `x-user-*` headers.
  Touches middleware auth semantics; deferred.
- **SEC-AUTH-02/03/04/05/06/07, SEC-SESSION-01** — `src/lib/auth*`, `auth-edge.ts`, schema. Class-A.
- **SEC-BF-01, SEC-CSRF-01, SEC-INPUT-01, SEC-DEAD-01** — `src/lib/security/**`. Class-A.
- **SEC-CRYPTO-01..05, 07, 08** — `src/lib/crypto*`, `encryption-v2.ts`, `secure-storage.ts`,
  schema, PBKDF2 iterations. Class-A. (SEC-CRYPTO-06, the one user-facing/low-risk item, is done.)
- **SEC-SECRET-01/02/04/05/06** — `src/services/secrets/**`, `src/lib/secrets/**` secret-internals.
  Class-A. (SEC-SECRET-03, the one non-Class-A config item, is done.)
- **SEC-AUDIT-01/02** — `src/lib/audit/**`, `src/app/api/auth/**`. Class-A.
- **SEC-RBAC-01/02/03** — tenant-isolation centralization, role gates on write endpoints. Cross-cutting
  / product decision; touches many Class-A routes. (RBAC-03 is already partly addressed:
  `hasMinimumRole`/`ROLE_HIERARCHY` exist in `@/lib/api`.)
