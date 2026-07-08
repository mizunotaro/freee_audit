# REV-SEC-01 — Security Review Proposal: auth / crypto / RBAC / secrets

> **AUDIT-ONLY document.** This file is analysis produced for a human reviewer. It contains
> **no approvals, no sign-offs, and no reviewer attributions**. Every conclusion, severity
> rating, and recommended change below is marked **`PENDING HUMAN DETERMINATION`** and must be
> independently validated before any source change is made. The Class-A paths referenced
> (`src/lib/auth*`, `src/lib/crypto*`, `src/lib/security/**`, `src/services/secrets/**`,
> `src/app/api/auth/**`, `prisma/**`, etc.) are **read-only** for this task; this document only
> *proposes* changes to them.

---

## 0. Review metadata

| Field | Value |
|---|---|
| Review ID | REV-SEC-01 |
| Scope | `src/lib/{auth.ts, auth-edge.ts, crypto.ts, crypto/encryption-v2.ts, security/**}`, `src/services/secrets/**`, `src/lib/secrets/**`, `src/lib/api/{auth-helpers,with-auth,rate-limiters,route-audit}.ts`, `src/app/api/auth/**`, `middleware.ts`, `.env.example` |
| Mode | Read-only audit (no source modifications) |
| Date | 2026-07-09 |
| Status of all findings | **`PENDING HUMAN DETERMINATION`** |

### Severity scale (potential impact *if the finding is confirmed*)
- **Critical** — direct, unauthenticated compromise or cross-tenant data/secret exposure.
- **High** — auth/RBAC bypass or secret-handling defect reachable in normal operation.
- **Medium** — weakens a security control (defense-in-depth, brute-force, revocation, isolation).
- **Low** — hardening / maintainability / correctness with security flavor.
- **Informational** — strength or context worth recording.

> All severities are provisional and **`PENDING HUMAN DETERMINATION`**.

---

## 1. Methodology

Evidence was gathered by reading the files in scope in full and by running targeted greps across
`src/app/api/**` (118 route handlers) and `src/**` to determine:

1. How identity is established and verified (cookie → `validateSession` vs edge JWT-only).
2. Whether the middleware gate actually covers API routes.
3. Per-route adoption of the shared auth layer (`@/lib/api`).
4. RBAC role enforcement and tenant-isolation enforcement points.
5. AES-256-GCM correctness and key management.
6. Secret retrieval, storage, caching, and provider resolution.

Quantitative coverage figures were computed with normalized path comparisons (grep emits `\`,
`find` emits `/`) to avoid false positives; the headline numbers below were re-derived until stable.

---

## 2. Executive summary

The authentication **foundation is sound and consistently adopted**: near-universal use of a
shared, DB-backed auth helper (`getAuthUser`/`requireAuth`/`withAuth`), bcrypt password hashing
with a timing-equalized user-enumeration defense, hashed session tokens at rest, encrypted API-key
storage, and correctly-implemented AES-256-GCM.

However, several **controls are either dead, decentralized, or rely on assumptions that do not hold
in a scaled deployment**. The most material risks (all `PENDING HUMAN DETERMINATION`):

- The middleware `config.matcher` **excludes all `/api/*`**, so the in-middleware API auth branch is
  **dead code** — every API route is solely responsible for its own auth (defense-in-depth removed).
- Edge session validation is **JWT-only with no DB/revocation check**; logout deletes the DB row
  but the JWT stays valid up to 24h on any path that trusts only the edge.
- A **concrete cross-tenant secret-read path** exists: `getAPIKey('openai', { companyId })` from
  `journal-proposal-service` resolves via `findFirst({ where: { userId: undefined } })`, which
  returns **any tenant's** `Settings` row.
- Tenant isolation helper (`requireCompanyAccess`) is **defined but called 0 times**; isolation is
  enforced ad-hoc per route/query.
- Brute-force protection and rate limiting use **in-memory, per-instance state** keyed on a
  **spoofable `x-forwarded-for`**; the Redis-backed hybrid limiter that would fix this is wired to
  exactly one route.
- **CSRF, PII-detector, anomaly-detector, and client-side secure-storage modules are dead**, yet
  `CSRF_SECRET` is a hard runtime dependency because the security barrel is imported.
- A second, stronger crypto stack (`encryption-v2`, scrypt passwords, key versioning) exists but is
  **only half-wired** — persisted secrets use the older key-less-versioning path, so **key rotation
  is impossible** today.

---

## 3. How authentication actually works (as-implemented)

```
Browser ──(cookie 'session' = JWT)──▶ Next.js
   │
   ├─ Page route (/ja/..., /en/...) ─▶ middleware.ts
   │     • matcher EXCLUDES /api/*  (see SEC-AUTH-01)
   │     • validateSessionEdge(cookie)  ── JWT signature/exp/iss/aud ONLY (no DB)  (SEC-AUTH-02)
   │     • sets x-user-id/role/company-id on the RESPONSE (not request)  (SEC-RBAC-05)
   │
   └─ API route (/api/...) ─▶ NO middleware gate
         • handler calls getAuthUser()/requireAuth()/withAuth()
         │     └─ validateSession(cookie) ── DB-backed (Session row + expiry)  ✓ revocable
         • role check via withAuth({requiredRoles}) / withAdminAuth / withAccountantAuth
         • tenant scope via inline companyId checks (e.g. verifyReportAccess)  (SEC-RBAC-02)
```

Key consequence: **API auth is DB-backed and revocable; page/edge auth is JWT-only and is not.**

---

## 4. Findings — Authentication & JWT lifecycle

### SEC-AUTH-01 — Middleware API auth branch is dead code (matcher excludes `/api/*`)
- **Location:** `middleware.ts:69-97` (dead branch) and `middleware.ts:127-131` (`config.matcher`).
- **Observation:** The matcher is `/((?!api|_next/static|_next/image|favicon.ico|...).*)`. The
  negative lookahead excludes any path beginning with `api`, so **`middleware()` never runs on
  `/api/*`**. The explicit `if (pathname.startsWith('/api/')) { … validateSessionEdge … }` block is
  therefore unreachable. There is no other middleware (only one `middleware.ts` exists at repo root).
- **Risk (PENDING HUMAN DETERMINATION):** There is no centralized gate on API routes. Authentication
  correctness depends on every handler remembering to call the shared auth layer. Today 117/118
  routes do (see SEC-RBAC-04), so the practical exposure is low, but the safety net is absent and
  any future route that forgets `requireAuth` is immediately unauthenticated.
- **Proposed change (PENDING HUMAN DETERMINATION):** Either (a) include API routes in the matcher
  and have middleware set identity on the **request** (see SEC-RBAC-05) to provide a real gate, or
  (b) explicitly document that API auth is handler-only and add an ESLint rule / integration test
  that fails when a `route.ts` under `src/app/api/**` does not import from `@/lib/api` (excluding an
  allow-list of public routes). Option (b) is the lower-risk incremental step.
- **Tests:** a fixture-based test that boots the app and asserts `GET /api/<protected>` returns 401
  without a cookie for a sample of routes; a lint test counting routes lacking an auth import.

### SEC-AUTH-02 — Edge session validation is JWT-only (no DB, no revocation)
- **Location:** `src/lib/auth-edge.ts:27-79` (`verifyJwtEdge`/`validateSessionEdge`);
  `src/lib/auth.ts:207-209` (`logout` deletes the `Session` row).
- **Observation:** `validateSessionEdge` verifies only the JWT signature, `exp`, `iss`, `aud`. It
  never reads the `Session` table. `logout()` deletes the DB row, which makes the token invalid for
  handlers that call the DB-backed `validateSession` (i.e., the API), but **not** for anything that
  trusts only the edge (page gating via middleware, and the dead API branch).
- **Risk (PENDING HUMAN DETERMINATION):** A stolen/observed session cookie remains valid for page
  access up to the 24h JWT `exp` after the user logs out, because the edge layer cannot observe
  revocation. Impact is bounded by the fact that data access flows through the DB-backed API, but
  any future edge-runtime endpoint trusting `validateSessionEdge` inherits the gap.
- **Proposed change (PENDING HUMAN DETERMINATION):** Introduce a revocation signal the edge can read
  cheaply — e.g., a short-lived revocation list / "session version" in a KV store, or a token
  `jti` checked against a denylist. At minimum, reduce JWT `exp` and document that edge-gated page
  access is not instantly revocable.
- **Tests:** unit test that after `logout()`, a previously-valid cookie is rejected by the API
  (passes today) and a test asserting the documented revocation lag for edge paths.

### SEC-AUTH-03 — Brute-force protection is in-memory, per-instance, and keyed on spoofable IP
- **Location:** `src/lib/auth.ts:137` (`loginAttempts = new Map`), `:139-141` (`getLockoutKey` =
  `${email}:${ip}`), `:155-163` (`recordFailedAttempt`); IP source at
  `src/app/api/auth/login/route.ts:20-21` (`x-forwarded-for`/`x-real-ip`).
- **Observation:** Lockout state lives in a module-global `Map`. In a multi-instance or
  serverless deployment, each instance keeps its own counter, so an attacker gets
  `LOCKOUT_MAX_ATTEMPTS × instance_count` attempts. The key mixes `email` and `ip`; the IP is read
  verbatim from `x-forwarded-for`/`x-real-ip`, which a client can forge unless a trusted proxy
  overwrites it. Forging the IP also defeats the per-IP rate limiter and poisons the audit log's
  `ipAddress` (see SEC-AUDIT-02). Additionally, `Map` entries whose lock has expired are only purged
  when that exact key is next probed, so abandoned keys leak (unbounded growth).
- **Risk (PENDING HUMAN DETERMINATION):** Online brute-force and credential-stuffing defenses are
  weaker than they appear, and a spoofed `XFF` can lock a victim out or hide an attacker.
- **Proposed change (PENDING HUMAN DETERMINATION):** (a) Move lockout state to a shared store
  (Redis — reuse `rate-limit-hybrid`'s store) keyed by email (account-level) and optionally IP;
  (b) read client IP from a single configured trusted-proxy header (or rightmost untrusted hop),
  not raw `XFF`; (c) cap/expire the in-memory map and/or replace it entirely.
- **Tests:** unit tests for lock/unlock transitions; a test simulating two "instances" sharing a
  Redis store to confirm the 6th attempt is blocked across instances.

### SEC-AUTH-04 — `JWT_SECRET` has no minimum strength validation
- **Location:** `src/lib/auth.ts:15`, `src/lib/auth-edge.ts:15` (`getRequiredEnvVar('JWT_SECRET')`
  only checks presence).
- **Observation:** `ENCRYPTION_KEY` is validated to exactly 64 hex chars (`crypto.ts:11-13`) and
  `CSRF_SECRET` to ≥32 chars (`csrf-protection.ts:9-12`), but `JWT_SECRET` accepts any non-empty
  string. A short/low-entropy secret directly weakens HS256 signing and offline brute-force
  resistance.
- **Risk (PENDING HUMAN DETERMINATION):** Misconfigured weak secret → forgeable tokens.
- **Proposed change (PENDING HUMAN DETERMINATION):** Enforce a minimum length (and document a
  generation command, already present in `.env.example`) at module load, mirroring `CSRF_SECRET`.
- **Tests:** unit test that module load throws for a short `JWT_SECRET`.

### SEC-AUTH-05 — Edge defaults a missing `role` to `'USER'` (not a defined role)
- **Location:** `src/lib/auth-edge.ts:77` (`role: decoded.role || 'USER'`).
- **Observation:** The defined roles are `ADMIN`/`SUPER_ADMIN`/`ACCOUNTANT`/`VIEWER`/`INVESTOR`
  (schema default `VIEWER`, seed `ADMIN`). `'USER'` is not among them. A validly-signed token
  lacking a `role` claim is treated as `'USER'`.
- **Risk (PENDING HUMAN DETERMINATION):** Low today (signing requires `JWT_SECRET`), but the
  default is neither least-privilege nor a real role; if any code branches on role equality it may
  behave unexpectedly.
- **Proposed change (PENDING HUMAN DETERMINATION):** Default to the most restrictive real role
  (`VIEWER`) or reject tokens without a valid role claim.
- **Tests:** unit test on `validateSessionEdge` for a token with no `role`.

### SEC-AUTH-06 — `role` is a free-text `String`, not a constrained enum
- **Location:** `prisma/schema.prisma` (User `role String @default("VIEWER")`), compared as string
  literals in `src/lib/api/auth-helpers.ts:179-195` and `with-auth.ts:64-79`.
- **Observation:** Any string is accepted at the DB layer; role checks are literal `.includes()`
  matches. Role-value drift (e.g., `'Admin'` vs `'ADMIN'`) silently degrades to "no access" or
  "unintended access" with no compile/DB-time guard.
- **Risk (PENDING HUMAN DETERMINATION):** Misconfiguration leads to silent authorization failure or
  over-grant. (Current seed/code agree on uppercase, so no live mismatch observed.)
- **Proposed change (PENDING HUMAN DETERMINATION):** Introduce a Prisma enum or a shared
  role-constant module referenced by both schema and code. *(Schema is Class-A — proposal only.)*
- **Tests:** type/enum tests asserting every compared role string is a member of the role set.

### SEC-AUTH-07 — Redundant manual `iat` in JWT payload
- **Location:** `src/lib/auth.ts:48-55`.
- **Observation:** `iat` is set manually and also derived by `jsonwebtoken`. Cosmetic; no security
  impact. **Informational.**
- **Proposed change (PENDING HUMAN DETERMINATION):** Drop the manual `iat` to avoid confusion.

---

## 5. Findings — RBAC & Authorization

### SEC-RBAC-01 — Tenant-isolation helper exists but is never called; isolation is ad-hoc
- **Location:** `requireCompanyAccess` defined at `src/lib/api/auth-helpers.ts:187-195` (including a
  `SUPER_ADMIN` bypass at `:188-190`), **0 callers** in `src/app/api/**` (grep confirmed). Good
  inline example: `src/app/api/reports/ir/[id]/route.ts:36-41` (`verifyReportAccess` checks
  `report.companyId !== companyId`).
- **Observation:** Multi-tenant isolation is enforced inconsistently — some routes inline a
  `companyId` equality check (IR report route), others rely on service-layer queries being scoped by
  `user.companyId`. There is no single chokepoint, and the dedicated helper (plus its admin bypass)
  is dead code. The risk is **IDOR / cross-tenant access in any route or query that forgets to
  scope by company.**
- **Risk (PENDING HUMAN DETERMINATION):** Without per-route review of all 117 handlers (out of scope
  here), cross-tenant exposure cannot be ruled out. The IR route proves the *pattern* is known; it
  does not prove universal adoption.
- **Proposed change (PENDING HUMAN DETERMINATION):** (a) Adopt one helper
  (`requireCompanyAccess`/`validateCompanyId`) at every company-scoped route; (b) introduce a
  scoped data-access layer that injects `companyId` into every query by default; (c) add an
  integration test per resource that requests another tenant's resource ID and expects 404.
- **Tests:** parametrized IDOR tests: authenticated as tenant A, request tenant B's resource by ID
  → expect 404 (not 200 and not tenant B's data).

### SEC-RBAC-02 — Most sensitive routes enforce authentication but not role
- **Location:** Role-gated wrappers (`withAdminAuth`/`withAccountantAuth`,
  `src/lib/api/with-auth.ts:64-79`) are used **almost exclusively** in `conversion/**` and
  `settings/api-keys/**`. Routes under `reports/**`, `analysis/**`, `board/**`, `chat/**`,
  `dashboard`, `freee/**`, `debt/**`, `tax/**`, `kpi/**`, `deferred-accrual/**` use plain
  `withAuth` (authentication only).
- **Observation:** Any authenticated user — including `VIEWER` and `INVESTOR` — can call many of
  these, including write mutations (POST/PUT/DELETE) on financial data, unless an inline role check
  exists.
- **Risk (PENDING HUMAN DETERMINATION):** Whether this is intended (e.g., "VIEWER may read
  reports") vs. over-permissive is a product decision. At minimum, **state-changing financial
  endpoints should require `ACCOUNTANT`/`ADMIN`**, and `INVESTOR` should be confined to the investor
  portal.
- **Proposed change (PENDING HUMAN DETERMINATION):** Apply role gates to write endpoints; audit
  read endpoints for whether `INVESTOR`/`VIEWER` should see them.
- **Tests:** role-matrix tests (one per role × representative endpoint) asserting 403 where
  disallowed.

### SEC-RBAC-03 — `hasPermission` ignores role hierarchy
- **Location:** `src/lib/auth.ts:211-213` (`requiredRoles.includes(userRole)`); same flat semantics
  in `requireRole` (`auth-helpers.ts:179-185`).
- **Observation:** Authorization is a flat membership test; there is no hierarchy (e.g.,
  `ADMIN` ⊇ `ACCOUNTANT` ⊇ `VIEWER`). Adding a role to `requiredRoles` lists is therefore
  error-prone (e.g., an `ADMIN`-only endpoint that lists `['ACCOUNTANT','ADMIN']` is fine, but
  forgetting `ADMIN` silently excludes admins).
- **Risk (PENDING HUMAN DETERMINATION):** Maintenance hazard leading to accidental lockout or
  over-grant.
- **Proposed change (PENDING HUMAN DETERMINATION):** Define an explicit role rank/hierarchy and a
  `hasMinimumRole(userRole, minimum)` helper; migrate call sites.
- **Tests:** unit tests over the hierarchy matrix.

### SEC-RBAC-04 — (Strength) Auth adoption is near-universal
- **Location:** `src/app/api/**` (118 `route.ts` files).
- **Observation:** 117/118 routes import `@/lib/api` or otherwise resolve identity via the DB-backed
  `validateSession`. The only exceptions are `/api/health` (intentionally public) and
  `/api/investor/accept` (invite-acceptance flow, rate-limited, creates the user). No route was
  found to trust the client-supplied `x-user-id`/`x-user-role` request headers. **Informational — a
  real strength.**

### SEC-RBAC-05 — Identity headers are set on the response, not the request
- **Location:** `middleware.ts:92-94` sets `x-user-id`/`x-user-role`/`x-user-company-id` on the
  `NextResponse`. The documented API pattern in `CLAUDE.md` §7 (`request.headers.get('x-user-id')`)
  is therefore non-functional.
- **Observation:** Confirmed by grep: **no handler reads these headers from the request** (only
  `src/lib/route-audit.ts:16` uses `x-user-id` as an audit fallback). So there is **no forgeable-
  header privilege escalation today** — handlers resolve identity from the cookie. However, the
  documented pattern is misleading and the headers are useless to handlers.
- **Risk (PENDING HUMAN DETERMINATION):** Low immediate risk; main hazard is a future developer
  following the documented pattern and trusting a client-forgeable header.
- **Proposed change (PENDING HUMAN DETERMINATION):** Either (a) forward identity on the request
  (e.g., via `request.headers.set` on a cloned request in middleware — note Next.js App Router
  constraints) and keep handlers reading it, **or (b) update `CLAUDE.md` §7** to show the
  cookie→`requireAuth` pattern actually in use, and remove the response-header writes.
- **Tests:** contract test that handlers obtain the correct user; a docs/lint check.

---

## 6. Findings — Cryptography & AES-256-GCM

### SEC-CRYPTO-01 — (Strength) AES-256-GCM is implemented correctly for at-rest secrets
- **Location:** `src/lib/crypto.ts:23-55`; used by `src/app/api/settings/api-keys/[provider]/route.ts:101`
  (`encrypt` before DB write), `src/services/secrets/api-key-service.ts:179` (`decrypt`).
- **Observation:** Random 16-byte IV per encryption (`crypto.randomBytes`), auth tag produced on
  encrypt and verified on decrypt (`getAuthTag`/`setAuthTag`), key validated to 32 bytes (64 hex).
  API keys are stored encrypted and the admin GET returns only `hasKey: boolean` (never plaintext).
  **Informational — a strength.**

### SEC-CRYPTO-02 — `crypto.ts` uses a 16-byte IV for GCM (non-standard)
- **Location:** `src/lib/crypto.ts:4` (`IV_LENGTH = 16`).
- **Observation:** NIST SP 800-38D recommends a 96-bit (12-byte) IV for GCM for best performance and
  security bounds. 16 bytes is accepted and safe here because the IV is random and never reused, but
  it deviates from the standard and from the project's own `encryption-v2.ts` (`DEFAULT_IV_LENGTH =
  12`, line 53).
- **Risk (PENDING HUMAN DETERMINATION):** No practical vulnerability; interoperability/perf
  concern and a consistency wart.
- **Proposed change (PENDING HUMAN DETERMINATION):** Standardize on a 12-byte IV across both
  modules. *(crypto.ts is Class-A — proposal only.)*
- **Tests:** known-vector round-trip tests; assert IV length.

### SEC-CRYPTO-03 — Two divergent crypto stacks; migration incomplete; no key rotation
- **Location:**
  - Password hashing: live = **bcryptjs** (`src/lib/auth.ts:34-40`); alternative
    `hashPasswordV2`/**scrypt** at `src/lib/crypto/encryption-v2.ts:112-147` is **never called**.
  - At-rest encryption: persisted secrets use **v1** `crypto.ts` (no `keyId`, no version, no AAD);
    `encryption-v2.ts` (`encryptV2` with `keyId`, `version: '2.0'`, optional AAD,
    `KeyVersion`/allowlist) is used **only** for the APIKeyService in-memory cache
    (`api-key-service.ts:3,73,54` → `encryptForCache`/`decryptFromCache`).
  - A third path, `src/lib/security/secure-storage.ts` (Web Crypto, client-side), is dead.
- **Observation:** The "v2" module is strictly stronger (key versioning, AAD, algorithm allowlist,
  scrypt) but is only half-wired. Persisted ciphertexts carry **no key id / version**, so there is
  **no way to rotate `ENCRYPTION_KEY`** without breaking decryption of every existing row.
- **Risk (PENDING HUMAN DETERMINATION):** Key compromise = all secrets exposed with no recovery
  path; rotation is a destructive operation today.
- **Proposed change (PENDING HUMAN DETERMINATION):** (a) Finish the migration: persist new
  ciphertexts via `encryptV2` (with `keyId`) and read both v1 and v2 on decrypt (lazy re-encrypt);
  (b) adopt `hashPasswordV2`/scrypt (or keep bcrypt deliberately and delete the dead scrypt path)
  — pick one; (c) delete the unused `secure-storage.ts` or finish wiring it; (d) introduce envelope
  encryption (DEK wrapped by KEK) for rotation.
- **Tests:** round-trip tests for v1+v2; a rotation test that decrypts v1 rows after a key change
  via the lazy-re-encrypt path; a "no plaintext in DB" assertion test.

### SEC-CRYPTO-04 — Single master key for everything; no KEK/DEK separation
- **Location:** `ENCRYPTION_KEY` consumed directly in `crypto.ts:6-15`,
  `encryption-v2.ts:69-84`, (and `SECURE_STORAGE_KEY` in `secure-storage.ts:18-35`).
- **Observation:** One symmetric key protects all ciphertexts (API keys, market-data tokens,
  settings, cache). There is no data-encryption-key / key-encryption-key separation.
- **Risk (PENDING HUMAN DETERMINATION):** Single point of failure; no granular rotation.
- **Proposed change (PENDING HUMAN DETERMINATION):** Envelope encryption — random DEK per secret,
  stored encrypted by the KEK; rotate the KEK without touching DEKs.
- **Tests:** unit tests for wrap/unwrap; rotation test.

### SEC-CRYPTO-05 — Name collision: two `encrypt`/`decrypt` exports with incompatible signatures
- **Location:** `src/lib/crypto.ts` (`encrypt(plaintext): string`) and
  `src/lib/security/secure-storage.ts` (`encrypt(data, password?): Promise<EncryptedData>`); the
  barrel `src/lib/security/index.ts:36-43` re-exports the **secure-storage** pair.
- **Observation:** Importing the wrong module yields silently different behavior (sync string vs
  async object). `@/lib/crypto` is the server at-rest path; `@/lib/security`'s `encrypt` is the
  client-side Web-Crypto path (currently dead).
- **Risk (PENDING HUMAN DETERMINATION):** A caller could accidentally encrypt secrets with the
  client-side variant, or pass a string where an object is expected.
- **Proposed change (PENDING HUMAN DETERMINATION):** Rename one pair (e.g., `encryptForBrowser`)
  and/or remove the dead secure-storage re-export.
- **Tests:** type-level / import-path lint guard.

### SEC-CRYPTO-06 — `.env.example` ships a real-looking `ENCRYPTION_KEY`
- **Location:** `.env.example` (Encryption section):
  `ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"`.
- **Observation:** Unlike `JWT_SECRET`/`CSRF_SECRET` (which use `<generate-...>` placeholders), the
  encryption key ships a valid, low-entropy, sequential 64-hex value. Copy-paste without replacement
  means all ciphertexts are under a publicly known key.
- **Risk (PENDING HUMAN DETERMINATION):** Misconfiguration → total loss of confidentiality.
- **Proposed change (PENDING HUMAN DETERMINATION):** Replace with a `<generate-32-byte-hex-string>`
  placeholder and fail-fast at startup if the key equals the example value.
- **Tests:** startup test rejecting the well-known example key.

### SEC-CRYPTO-07 — Client-side `secure-storage` keeps its key next to the data
- **Location:** `src/lib/security/secure-storage.ts:27-35` (random key persisted in
  `sessionStorage['__secure_key']`) and `:139-160` (`SecureStorage` writes encrypted blobs to
  `localStorage`).
- **Observation:** The browser key lives in `sessionStorage`, readable by any XSS on the page,
  alongside the `localStorage` blobs it protects. (Module is dead today — only re-exported by
  `security/index.ts`.)
- **Risk (PENDING HUMAN DETERMINATION):** If ever wired in, XSS defeats the encryption.
- **Proposed change (PENDING HUMAN DETERMINATION):** Do not store secrets in client storage; if
  required, derive from a server-issued short-lived token, not a locally-held key.
- **Tests:** n/a (design review).

### SEC-CRYPTO-08 — PBKDF2 iteration count below current guidance
- **Location:** `encryption-v2.ts:91` (`pbkdf2Sync … 100000`) and `secure-storage.ts:5`
  (`ITERATIONS = 100000`).
- **Observation:** OWASP (2023) recommends ≥600,000 iterations for PBKDF2-HMAC-SHA-256. These derive
  from a full-entropy master key (so brute-force is not the primary threat), but the count is dated.
- **Risk (PENDING HUMAN DETERMINATION):** Low (entropy of input is high); still, align with guidance.
- **Proposed change (PENDING HUMAN DETERMINATION):** Raise to ≥600k (parameterize; version-stamp
  derived keys so old data can be re-derived).

---

## 7. Findings — Secret handling

### SEC-SECRET-01 — Cross-tenant secret read when `userId` is absent (concrete live caller)
- **Location:** `src/services/secrets/api-key-service.ts:161-206` (`getFromDatabase`) — specifically
  `:166-170`:
  ```ts
  const settings = await (prisma as any).settings.findFirst({
    where: { userId: userId || undefined },
  })
  ```
  and the resolver `fetchAPIKey` at `:109` forwards **only `options?.userId`** (never `companyId`)
  to it. Live caller: `src/services/ai/journal-proposal-service.ts:353`:
  `getAPIKey('openai', { companyId })` — **no `userId`**.
- **Observation:** When `getAPIKey` is called without `userId`, Prisma treats `userId: undefined` as
  "no filter", so `findFirst` returns **the first `Settings` row in the table — any tenant's**. The
  OpenAI key (and any other resolved field) is then decrypted and returned. The cache key also
  collapses to `:default`, so the wrong tenant's key can be served to other callers within the TTL.
- **Risk (PENDING HUMAN DETERMINATION):** Cross-tenant API-key/secret disclosure. The code defect
  is definitive; the real-world impact (whether distinct tenants store distinct keys, and which row
  is "first") depends on data and is **`PENDING HUMAN DETERMINATION`**.
- **Proposed change (PENDING HUMAN DETERMINATION):** Never query secrets with an unfiltered
  `userId`. Require an explicit user *and* company context: `findFirst({ where: { userId, companyId } })`
  (add `companyId` to `Settings`/query) and throw/return null when neither is provided. Pass
  `companyId` through `fetchAPIKey`→`getFromDatabase`. Scope the cache key to `userId+companyId`.
- **Tests:** integration test with two tenants' `Settings` rows asserting that a `getAPIKey` call
  scoped to tenant A never returns tenant B's key, including when `userId` is omitted; cache-
  isolation test.

### SEC-SECRET-02 — (Strength) API keys are encrypted at rest and never disclosed on read
- **Location:** `src/app/api/settings/api-keys/[provider]/route.ts:101` (encrypt before upsert),
  `:49-62` (GET returns `hasKey: boolean` only), `:208-210` (`withAdminAuth` on GET/PUT/DELETE).
- **Observation:** Storage is encrypted (SEC-CRYPTO-01), reads are boolean-only, and writes are
  admin-gated. **Informational — a strength.** Minor wart: GET returns a fabricated
  `lastUpdated = now` (`:61`) rather than a stored timestamp.

### SEC-SECRET-03 — `LocalSecretProvider` reads secrets from a plaintext file
- **Location:** `src/lib/secrets/index.ts:201-250` (`loadSecrets` reads `LOCAL_SECRETS_PATH ||
  './secrets.json'`).
- **Observation:** A plaintext JSON map of secrets on disk. Fine for local dev; a footgun if
  `SECRET_PROVIDER=local` in any non-dev environment.
- **Risk (PENDING HUMAN DETERMINATION):** Secrets at rest in plaintext if misconfigured.
- **Proposed change (PENDING HUMAN DETERMINATION):** Guard with `NODE_ENV !== 'production'` and
  document; ensure `secrets.json` is gitignored and flagged in CI.
- **Tests:** config test refusing `local` provider in production.

### SEC-SECRET-04 — `EnvSecretProvider.listSecrets()` enumerates all env-var names
- **Location:** `src/lib/secrets/index.ts:188-194` (`Object.keys(process.env)` with optional prefix).
- **Observation:** Returns names (not values) of every environment variable. Low risk in isolation,
  but it widens the surface if any admin/diagnostic surface ever echoes the list.
- **Risk (PENDING HUMAN DETERMINATION):** Information leakage of secret *names*.
- **Proposed change (PENDING HUMAN DETERMINATION):** Require a prefix for `listSecrets` and mask
  anything outside an explicit allowlist.
- **Tests:** unit test that `listSecrets()` without a prefix returns nothing/error.

### SEC-SECRET-05 — Decrypted secrets cached in an unbounded module `Map`
- **Location:** `src/services/secrets/api-key-service.ts:31-39` (cache), `:52-68`/`:71-82`
  (re-encrypted-at-rest via `encryptForCache`).
- **Observation:** The cache re-encrypts values (good) but is keyed by `provider:user:company` with
  no eviction cap; distinct combinations grow without bound. Plaintext exists transiently during
  decrypt.
- **Risk (PENDING HUMAN DETERMINATION):** Memory growth; brief plaintext residency.
- **Proposed change (PENDING HUMAN DETERMINATION):** Bound the cache (LRU) and keep the TTL.
- **Tests:** cache-size bound test.

### SEC-SECRET-06 — `Settings` access uses `as any`, bypassing type safety
- **Location:** `src/services/secrets/api-key-service.ts:166` (`(prisma as any).settings`) and the
  dynamic `[keyField]` access; `src/app/api/settings/api-keys/[provider]/route.ts:52-56`.
- **Observation:** The `Settings` model exists (`prisma/schema.prisma:422`) with the relevant
  `*ApiKey` fields, so the cast is for dynamic field access, not a missing model — but it disables
  the type checker exactly where secret fields are read/written.
- **Risk (PENDING HUMAN DETERMINATION):** Typos in field mapping silently read/write the wrong
  column.
- **Proposed change (PENDING HUMAN DETERMINATION):** Use a typed mapping (e.g., a switch returning
  typed `Prisma.SettingsSelect`) instead of `as any`.
- **Tests:** type-only test / compile-time guard.

---

## 8. Findings — CSRF, input validation, security headers

### SEC-CSRF-01 — CSRF protection module is dead, yet `CSRF_SECRET` is a hard runtime dependency
- **Location:** `src/lib/security/csrf-protection.ts` (entire module); imported via barrel
  `src/lib/security/index.ts:1-10`; `investor/accept/route.ts:5` imports
  `withRateLimit` from `'@/lib/security'` → the barrel → `csrf-protection.ts:17`
  (`getRequiredEnvVar('CSRF_SECRET')`) executes at load.
- **Observation:** Grep confirms **no route uses** `withCsrfProtection`/`consumeCsrfToken`/
  `createCsrfToken`/`attachNewCsrfToken`. So CSRF protection is inactive, but because the security
  barrel is imported (for rate limiting), `CSRF_SECRET` must be set or the app fails to start — a
  required secret for a feature that does nothing. The `sameSite: 'strict'` session cookie
  (`login/route.ts:50`, `investor/accept/route.ts:54`) provides real browser-CSRF mitigation for
  modern browsers, but not against same-site/XSS-originated requests.
- **Risk (PENDING HUMAN DETERMINATION):** Misleading posture (looks defended, isn't) plus an
  unnecessary hard dependency.
- **Proposed change (PENDING HUMAN DETERMINATION):** **Decide and commit:** either (a) wire CSRF
  tokens for state-changing routes (issue on a safe endpoint, enforce `withCsrfProtection` on
  POST/PUT/DELETE) and keep `CSRF_SECRET`, or (b) remove the module and the barrel re-export (then
  `rate-limit-middleware` can be imported directly, dropping the `CSRF_SECRET` startup dependency).
- **Tests:** if (a): token issue + single-use + rejection tests; if (b): startup test with no
  `CSRF_SECRET`.

### SEC-INPUT-01 — `input-sanitizer` SQLi patterns are naive denylists (and not used on requests)
- **Location:** `src/lib/security/input-sanitizer.ts:12-17` (flags `SELECT/UPDATE/AND/OR`/`--` etc.);
  usage only in `src/lib/ai/**` (personas/prompts), `src/lib/utils/secure-logger.ts`,
  `src/services/import/parsers/excel-parser.ts` — **not** in API request validation.
- **Observation:** API input validation correctly uses **Zod** + **Prisma parameterization**, so SQL
  injection is mitigated at the query layer regardless. The denylist, if ever applied to free-text
  request fields, would cause false positives (legit text containing "select"/"update"/"and"). The
  module's name oversells protection it should not be relied upon for.
- **Risk (PENDING HUMAN DETERMINATION):** Low (not gating requests); risk is over-reliance or
  accidental adoption that breaks legitimate input.
- **Proposed change (PENDING HUMAN DETERMINATION):** Keep Zod + parameterized queries as the
  control; relabel/repurpose the sanitizer (output encoding only) or remove the SQLi denylist.
- **Tests:** n/a (policy); add a test asserting request bodies are validated by Zod, not the
  sanitizer.

### SEC-HEADER-01 — Security headers are per-route (one route), not global; no CSP/HSTS
- **Location:** `src/app/api/reports/ir/[id]/route.ts:27-32` (`addSecurityHeaders` sets
  `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`) — appears to be the only route
  doing this. Middleware adds none.
- **Observation:** Defensive headers are applied inconsistently (one route) and several are absent:
  no `Content-Security-Policy`, no `Strict-Transport-Security`, no `Referrer-Policy`,
  no `Permissions-Policy`. (`X-XSS-Protection` is also deprecated by modern browsers.)
- **Risk (PENDING HUMAN DETERMINATION):** Clickjacking, MIME-sniffing, and injection-surface
  exposure are inconsistently mitigated.
- **Proposed change (PENDING HUMAN DETERMINATION):** Add a global header writer — for pages via
  `middleware.ts` `NextResponse.next().headers.set(...)` and for APIs via a shared
  `withSecurityHeaders` wrapper; add CSP, HSTS (behind TLS), Referrer-Policy.
- **Tests:** response-header assertions across a representative set of routes/pages.

### SEC-DEAD-01 — PII detector and anomaly detector are dead code
- **Location:** `src/lib/security/pii-detector.ts`, `src/lib/security/anomaly-detector.ts` — grep
  finds **no callers** outside their own module / barrel.
- **Observation:** Intended defenses (PII redaction, behavioral anomaly detection) are not wired.
- **Risk (PENDING HUMAN DETERMINATION):** Missing advertised protections (e.g., PII before logging
  or before sending to LLM prompts).
- **Proposed change (PENDING HUMAN DETERMINATION):** Either wire them at the relevant chokepoints
  (PII detector before logging/LLM; anomaly detector on auth/audit events) or remove and stop
  claiming the capability.
- **Tests:** if wired: PII-redaction and anomaly-trigger tests.

---

## 9. Findings — Session policy & brute-force controls

### SEC-SESSION-01 — Documented session-policy knobs are unimplemented
- **Location:** `.env.example` documents `SESSION_MAX_CONCURRENT`, `SESSION_MAX_AGE_MS`,
  `SESSION_IDLE_TIMEOUT_MS`, `SESSION_REFRESH_WINDOW_MS`, `SESSION_ENFORCE_SINGLE`;
  `src/lib/auth.ts:17` hardcodes `SESSION_DURATION_HOURS = 24` with no idle/concurrency/refresh.
- **Observation:** The only session limit is a fixed 24h absolute expiry. There is **no idle
  timeout, no concurrent-session cap, no single-session enforcement, no token refresh/rotation.** A
  stolen cookie is valid for a full 24h regardless of activity.
- **Risk (PENDING HUMAN DETERMINATION):** Stolen-session blast radius is maximal.
- **Proposed change (PENDING HUMAN DETERMINATION):** Implement the documented policy: idle +
  absolute timeouts, concurrent-session cap, and refresh/rotation (mint a new JWT on activity within
  a refresh window; rotate the `Session` row). Honor the listed env vars or remove them.
- **Tests:** idle-timeout, concurrency-cap, and rotation tests.

### SEC-SESSION-02 — (Strength) Session tokens are hashed at rest; cookies are hardened
- **Location:** `src/lib/auth.ts:86-88` (`hashToken` SHA-256), `:99-105` (store hashed token),
  `:114-117` (lookup by hash); cookie flags at `login/route.ts:47-54` and
  `investor/accept/route.ts:51-58` (`httpOnly`, `secure`, `sameSite: 'strict'`, `maxAge 24h`).
- **Observation:** DB stores only the SHA-256 of the JWT, and cookies carry strict flags.
  **Informational — a strength.** Note `secure: true` prevents the cookie from being set over plain
  HTTP (correct for prod; dev must use HTTPS or override).

### SEC-BF-01 — Rate limiter is in-memory and XFF-keyed (see SEC-AUTH-03)
- **Location:** `src/lib/security/rate-limit-middleware.ts:10` (`const store = {}`),
  `:23-25` (XFF key), `:113` (`auth: 5/15min`), `:122` (`setInterval` cleanup); the Redis-capable
  `src/lib/security/rate-limit-hybrid.ts` is wired to **only one** route
  (`src/app/api/analysis/middleware/rate-limit.ts`). The app-wide `rateLimiters`
  (`src/lib/api/rate-limiters.ts`) re-exports the **in-memory** one.
- **Observation:** Same multi-instance/spoofable-IP weaknesses as the lockout. `setInterval` at
  module load is also operationally awkward in serverless.
- **Risk (PENDING HUMAN DETERMINATION):** Per-instance effective limits; XFF spoofing evades or
  weaponizes limits.
- **Proposed change (PENDING HUMAN DETERMINATION):** Make the hybrid (Redis) limiter the default
  app-wide; key on authenticated user where available else trusted-proxy IP; gate cleanup on app
  lifetime rather than a bare `setInterval`.
- **Tests:** two-"instance" shared-Redis test; XFF-spoof test asserting limit still applies via
  trusted-proxy parsing.

---

## 10. Findings — Audit logging (cross-cutting; auth paths are Class-A/deferred)

> These are flagged for completeness because they affect security assurance of the auth surface.
> The auth routes are Class-A and out of edit scope here; they are slated for the separate
> audit-log track. All items below are **`PENDING HUMAN DETERMINATION`**.

### SEC-AUDIT-01 — Login/logout bypass the hash-chained audit logger
- **Location:** `src/app/api/auth/login/route.ts:31-40` and `logout/route.ts:11-20` call
  `prisma.auditLog.create()` directly instead of `auditLogger.log()`/`logRouteAudit()`.
- **Observation:** Direct writes break the blockchain-style `contentHash + previousHash` integrity
  chain that `src/lib/audit/audit-logger.ts` maintains, so login/logout events sit outside the
  tamper-evident trail. Also, **failed** logins are never audited (only `result: 'SUCCESS'`).
- **Risk (PENDING HUMAN DETERMINATION):** Auth events are non-integrity-protected and incomplete;
  brute-force/lockout events are not recorded.
- **Proposed change (PENDING HUMAN DETERMINATION):** Route all auth events through
  `logRouteAudit()`/`auditLogger.log()`; log `FAILURE` (incl. lockout) and use a stable actor
  identifier.
- **Tests:** integrity-chain test asserting auth events are linked; failed-login audit test.

### SEC-AUDIT-02 — `logRouteAudit` actor fallback reads a never-set request header
- **Location:** `src/lib/route-audit.ts:16`
  (`input.userId ?? input.request.headers.get('x-user-id') ?? undefined`).
- **Observation:** Middleware sets `x-user-id` on the **response**, not the request
  (SEC-RBAC-05), so the header is absent on the request and the fallback resolves to `undefined`.
  Any caller that forgets to pass `userId` produces an audit record with **no actor**. IP/user-agent
  are also taken from raw `x-forwarded-for` (spoofable, SEC-AUTH-03).
- **Risk (PENDING HUMAN DETERMINATION):** Loss of actor attribution in audit records; spoofed IPs.
- **Proposed change (PENDING HUMAN DETERMINATION):** Resolve the actor from the authenticated
  session in `logRouteAudit` (or require `userId`); use the trusted-proxy IP.
- **Tests:** audit test asserting `userId` is populated for an authenticated request.

---

## 11. Strengths summary (balance)

- Near-universal adoption of DB-backed auth (117/118 routes) — SEC-RBAC-04.
- bcrypt hashing with user-enumeration timing defense (`DUMMY_HASH`) — `auth.ts:132,179`.
- Session tokens hashed at rest; strict cookie flags — SEC-SESSION-02.
- AES-256-GCM at rest for secrets with verified auth tags — SEC-CRYPTO-01.
- API keys encrypted at rest, read as boolean, admin-gated — SEC-SECRET-02.
- Layered secret resolution (secret manager → DB → env) — `api-key-service.ts:87-134`.
- Exemplary inline tenant check on the IR report route — `reports/ir/[id]/route.ts:36-41`.
- Manual HMAC-SHA256 JWT verification at the edge with `iss`/`aud`/`exp` checks — `auth-edge.ts`.

---

## 12. Prioritized remediation roadmap (all `PENDING HUMAN DETERMINATION`)

1. **SEC-SECRET-01** — Fix the unfiltered `userId` secret query (concrete cross-tenant path).
2. **SEC-AUTH-01 / SEC-RBAC-05** — Decide the middleware/API-gate story; fix or formally retire the
   `x-user-*` headers and the dead API branch; correct `CLAUDE.md` §7.
3. **SEC-RBAC-01** — Centralize tenant isolation; add IDOR integration tests.
4. **SEC-AUTH-03 / SEC-BF-01** — Move lockout + rate limiting to a shared store; trusted-proxy IP.
5. **SEC-AUTH-02 / SEC-SESSION-01** — Edge revocation + session timeouts/rotation.
6. **SEC-CRYPTO-03 / SEC-CRYPTO-04** — Finish crypto-v2 migration + key versioning/rotation.
7. **SEC-CSRF-01 / SEC-DEAD-01** — Wire or remove dead defense modules; drop the dead
   `CSRF_SECRET` startup dependency.
8. **SEC-RBAC-02** — Apply role gates to state-changing financial endpoints.
9. **SEC-HEADER-01** — Global security headers + CSP/HSTS.
10. **SEC-AUDIT-01 / SEC-AUDIT-02** — Route auth events through the integrity chain; fix attribution.

---

## 13. Proposed test matrix (all `PENDING HUMAN DETERMINATION`)

| Area | Test | Covers |
|---|---|---|
| Auth | Unauthenticated request to N protected routes → 401 | SEC-AUTH-01 |
| Auth | Cookie rejected by API after `logout()` | SEC-AUTH-02 |
| Auth | `JWT_SECRET` length validation at load | SEC-AUTH-04 |
| Brute force | 6th failed login blocked across "instances" (shared store) | SEC-AUTH-03, SEC-BF-01 |
| Brute force | XFF spoof does not reset the counter (trusted proxy) | SEC-AUTH-03, SEC-BF-01 |
| RBAC | IDOR: tenant A → tenant B resource → 404 | SEC-RBAC-01 |
| RBAC | Role matrix (5 roles × key endpoints) | SEC-RBAC-02, SEC-AUTH-06 |
| Crypto | v1 + v2 round-trip; rotation via lazy re-encrypt | SEC-CRYPTO-03 |
| Crypto | Startup rejects the example `ENCRYPTION_KEY` | SEC-CRYPTO-06 |
| Secrets | `getAPIKey` without `userId` returns no cross-tenant key | SEC-SECRET-01 |
| Secrets | Two tenants' keys never collide in cache | SEC-SECRET-01, SEC-SECRET-05 |
| Session | Idle timeout + concurrent cap + rotation | SEC-SESSION-01 |
| CSRF | (If wired) token issue / single-use / replay-rejected | SEC-CSRF-01 |
| Headers | CSP/HSTS/nosniff present on pages + APIs | SEC-HEADER-01 |
| Audit | Auth events linked in the hash chain; failed login recorded | SEC-AUDIT-01 |
| Audit | Audit record carries the real actor + trusted-proxy IP | SEC-AUDIT-02 |

---

## 14. Appendix — coverage figures

- Total API route handlers: **118** (`route.ts` under `src/app/api/**`).
- Handlers resolving identity via `@/lib/api` / cookie / `validateSession`: **117**.
- Handlers with **no** auth marker: **2** — `/api/health` (intentional) and
  `/api/investor/accept` (invite flow, rate-limited).
- Handlers reading client-supplied `x-user-id`/`x-user-role` request headers: **0** (only
  `route-audit.ts` uses `x-user-id` as an audit fallback).
- Routes calling `requireCompanyAccess`: **0** (helper is dead).
- Routes using role-gated wrappers (`withAdminAuth`/`withAccountantAuth`): primarily
  `conversion/**` and `settings/api-keys/**`.
- Dead defense modules: CSRF protection, PII detector, anomaly detector, client-side
  `secure-storage`; Redis `rate-limit-hybrid` used in exactly one route.

---

*End of REV-SEC-01 proposal. All findings, severities, and proposed changes are
**`PENDING HUMAN DETERMINATION`**. This document confers no approval and names no reviewer.*
