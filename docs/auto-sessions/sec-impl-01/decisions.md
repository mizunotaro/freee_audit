# SEC-IMPL-01 — Decisions (ADR)

> Branch: `feature/auto/sec-impl-01` · Date: 2026-07-11
> Scope rule: implement non-Class-A recommendations only; defer the rest for a human.

## ADR-1 — Treat the proposal's named Class-A set as authoritative (union)

**Context.** The task's Class-A list and the proposal's scope header overlap but differ. The
proposal explicitly names `src/services/secrets/**` Class-A ("read-only for this task") though the
task's literal exclude-list does not repeat that path.

**Decision.** Off-limits = **union** of both. `src/lib/secrets/**` is editable (only
`src/services/secrets/**` is Class-A); `src/services/secrets/**` is not.

**Consequence.** SEC-SECRET-03 (`src/lib/secrets/index.ts`) is implemented; SEC-SECRET-01
(`src/services/secrets/api-key-service.ts`) is deferred.

---

## ADR-2 — SEC-HEADER-01 is ALREADY satisfied; add a regression test, do NOT add a second writer

**Context.** An earlier draft added a canonical header module + middleware application. Inspection
of `next.config.js` showed `headers()` on `/:path*` already sets the full defensive set + a strong
CSP (with an LLM-provider `connect-src` allowlist) globally, covering pages AND API. The proposal
missed this.

**Decision.** Revert the second writer (it would cause duplicate/conflicting headers — two CSPs —
and needlessly touch middleware auth semantics). Ship a regression test
(`tests/unit/security/global-security-headers.test.ts`) that pins the `next.config.js` block so it
cannot regress. A stricter/nonce-based CSP is a human follow-up.

**Consequence.** SEC-HEADER-01 is satisfied and guarded; no `middleware.ts` change.

---

## ADR-3 — Leave `middleware.ts` unmodified (auth-gate semantics are human-scope)

**Context.** The middleware API auth branch is dead (matcher excludes `/api/*`). Options: (a) wire
a real gate, (b) document handler-only + guard. Enabling an edge-JWT gate is net-negative: it
cannot observe DB-side revocation (logout), so it would let revoked sessions through while adding no
real rejection (a valid session always has a valid JWT).

**Decision.** Option (b), without editing `middleware.ts`. The dead branch is harmless unreachable
code. Retiring it / changing the matcher is an auth-semantics change the proposal ranks as priority
#2 and defers to a human. The guard is the SEC-AUTH-01(b) auth-adoption test.

---

## ADR-4 — SEC-AUTH-01 guard tests auth *imports*, not AST enforcement

**Context.** True enforcement proof needs AST analysis (does each handler actually call
`validateSession`?). An import check has false negatives (import without gating).

**Decision.** Ship the import-marker guard. It reliably catches the named regression — a brand-new
route wired with **no** auth import. AST enforcement is out of scope for an automated pass.

**Verified baseline:** 117/118 routes import `@/lib/api` or `@/lib/auth`; `/api/health` allowlisted;
`/api/investor/accept` imports `@/lib/auth`.

---

## ADR-5 — SEC-CRYPTO-06: edit user-facing templates only; keep the dev/test fixture

**Context.** `.env.example` + `README.md` shipped the sequential `0123…abcd` key. The same value is
the explicit dev/test fixture in `tests/setup.ts`, `tests/helpers/db.ts`, `tests/e2e/lib/env.ts`,
and crypto unit tests.

**Decision.** Replace the value **only** in user-facing templates (`.env.example`, `README.md`) with
the `<generate-32-byte-hex-string>` placeholder. Do NOT change the dev/test fixture files — that is
a known test key, not a production secret, and changing it risks breaking the test harness. The
fail-fast startup check in `crypto.ts` (rejecting the example value) is Class-A and deferred.

**Consequence.** Copy-paste footgun closed on user-facing surfaces; test/CI/dev behavior unchanged.

---

## ADR-6 — SEC-SECRET-03: fail-closed LocalSecretProvider in production

**Context.** `LocalSecretProvider` (`src/lib/secrets/index.ts`) loads plaintext `./secrets.json`.
Fine for dev; a silent footgun if `SECRET_PROVIDER=local` in prod. Default provider is `env`.

**Decision.** Throw at construction when `NODE_ENV === 'production'`. Non-Class-A file. No effect in
dev/test. Existing `secrets-manager.test.ts` (runs under `NODE_ENV=test`) still passes.

---

## ADR-7 — Deferred: SEC-SECRET-01 (proposal priority #1) — minimal fix sketch for the human

**Context.** `src/services/secrets/api-key-service.ts` `getFromDatabase` runs
`findFirst({ where: { userId: userId || undefined } })`. The live caller
`src/services/ai/journal-proposal-service.ts:353` calls `getAPIKey('openai', { companyId })` with no
`userId`; Prisma treats `undefined` as "no filter" → returns **any tenant's** `Settings` row; cache
key collapses to `:default`. Definitive cross-tenant secret-read path.

**Why deferred.** Proposal marks `src/services/secrets/**` Class-A; the `Settings` model has only
`userId @unique` (no `companyId`), so the proper fix needs a `prisma/schema.prisma` migration
(Class-A) AND editing the banned caller `journal-proposal-service.ts:353`. Fail-closed-only
(`return null` when `userId` absent) would break the journal-proposal runtime path today.

**Minimal fix sketch (for the human — NOT applied here):**
1. Add `companyId` to `Settings` (migration) OR resolve the caller's `userId` before calling
   `getAPIKey`.
2. `getFromDatabase`: `findFirst({ where: { userId, companyId } })`; never query with
   `userId: undefined`.
3. Pass `companyId` through `fetchAPIKey` → `getFromDatabase`; never forward `undefined` userId.
4. Scope cache key to `${provider}:${userId}:${companyId}`; never `:default` for a tenant call.
5. Tests: two tenants' rows → tenant A's `getAPIKey` never returns tenant B's key (incl. omitted
   `userId`); cache-isolation test.

---

## ADR-8 — Deferred: RBAC role gates + tenant-isolation centralization (product decision)

**Context.** SEC-RBAC-01 (centralize `requireCompanyAccess`, currently 0 callers) and SEC-RBAC-02
(role gates on write endpoints) are cross-cutting and partly touch Class-A route trees (tax, kpi,
debt, deferred-accrual, freee, conversion, journal-proposal). Whether `VIEWER`/`INVESTOR` may call
read/write financial endpoints is a product policy decision. SEC-RBAC-03 is already partly served
(`hasMinimumRole`/`ROLE_HIERARCHY` in `@/lib/api`). A single-route IDOR regression test was
considered but deferred — the real fix is centralization (human), and a brittle real-handler
integration test adds risk without fixing the underlying gap.

---

## ADR-9 — Deferred: all crypto / session / brute-force / CSRF / audit findings

Class-A paths: `src/lib/auth*`, `src/lib/crypto*`, `src/lib/security/**`, `src/lib/audit/**`,
`src/app/api/auth/**`, `prisma/**`, `.env.example`'s crypto startup check. Out of scope for an
automated non-Class-A pass; enumerated in `summary.md` §4.
