# RATE-02 — Rate-Control & Audit-Log Gap Report: Outbound freee Callers

> **TASK TYPE:** AUDIT-ONLY / READ-ONLY investigation. This document is the **only** artifact
> produced by RATE-02. No source code, schema, or configuration was modified. Source under
> `src/services/freee/**`, `src/lib/integrations/freee/**`, and `src/app/api/freee/**` was read
> for analysis only.
>
> **STATUS OF EVERY CONCLUSION BELOW:** `PENDING HUMAN DETERMINATION`.
> Nothing in this document is approved, signed off, or finalized. No reviewer name is attached.
> Each finding, proposed call site, and proposed payload is a recommendation awaiting human
> decision.

---

## 0. Executive Summary

RATE-02 audited the **outbound freee HTTP callers** — every site where a real network request
leaves the process for `api.freee.co.jp` / `accounts.secure.freee.co.jp` — to determine where
the platform's own stated policy ("**rate control: User-Agent header + rate limiting on all
external calls**" and "**audit required: All API calls must have audit logs**", per `CLAUDE.md`
§13 CrystalBall Policy) is satisfied, partially satisfied, or absent.

All outbound freee calls originate in one file: `src/lib/integrations/freee/client.ts`. There are
exactly **four distinct `fetch` sites**. Three of the four were found to have material gaps. All
findings are `PENDING HUMAN DETERMINATION`.

### 0.1 Central finding — the rate-control/audit funnel is incomplete

The integration has a well-built central funnel, `FreeeClient.request<T>()`
(`client.ts:172`), which **does** apply a per-second token-bucket rate limiter
(`freeeRateLimiter.waitForToken`, `client.ts:187`), a circuit breaker (`client.ts:189`), and retry
with exponential backoff (`client.ts:190`). However:

- **No `User-Agent` header is sent on any freee outbound call** (grep for `User-Agent`/`userAgent`
  across `src/lib/integrations/freee` → **0 matches**). The CrystalBall "User-Agent header"
  requirement is **0% met**. `PENDING HUMAN DETERMINATION` on whether freee enforces this, but the
  internal policy is unmet regardless.
- **No outbound freee call writes the audit log from within the integration layer.** A dedicated
  helper `auditLogger.logFreeeApiCall(...)` exists (`audit-logger.ts:223`) but is invoked **exactly
  once** in the entire codebase — at `src/jobs/journal-sync.ts:94`, for one endpoint, and even
  there with a hard-coded `statusCode: 200`. **0 of the in-scope call sites audit.**
- **Two of the four fetch sites bypass the central funnel entirely**, so they get **none** of the
  rate-limit / circuit-breaker / retry protections: `downloadDocument` (`client.ts:326`) and the
  OAuth token calls `exchangeCodeForToken` / `refreshToken` (`client.ts:75`, `client.ts:106`).

### 0.2 Second finding — the daily-quota infrastructure exists but is dead code

freee enforces a **per-day request quota by plan** (3,000–10,000/day, modelled in
`rate-limiter.ts:8` and `quota-manager.ts`). The codebase contains a full quota/batch/scheduler
stack to respect it, but **none of it is wired into the live request path**:

- `dailyUsageTracker.increment(...)` (`rate-limiter.ts:105`) — **never called** anywhere in `src/`.
- `freeeApiQuotaManager.recordUsage(...)` (`quota-manager.ts:152`) — **never called** anywhere.
- `freeeApiScheduler` / `api-scheduler.ts` — exported (`api-scheduler.ts:289`) but **imported
  nowhere** outside its own file (grep-confirmed). `getQuotaStatus` is read only by the scheduler's
  own `planSchedule`, which nothing drives.

Consequence: the **per-second throttle** (token bucket) works, but the **per-day quota** is neither
counted nor enforced against live traffic. A runaway caller can exhaust the freee daily quota with
no in-app guardrail. `PENDING HUMAN DETERMINATION` on severity and whether the scheduler was
intentionally deferred.

### 0.3 Coverage at a glance (`PENDING HUMAN DETERMINATION`)

Legend: ✅ present · ⚠️ partial / wrong · ❌ absent.

| Fetch site (client.ts) | Rate-limit (per-sec) | Rate-limit (per-day quota) | User-Agent | Circuit breaker | Retry | Audit log |
|---|---|---|---|---|---|---|
| `request<T>` :172 (9 endpoints) | ✅ :187 | ❌ (dead) | ❌ | ✅ :189 | ✅ :190 | ❌ |
| `downloadDocument` :326 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `exchangeCodeForToken` :75 | ❌ | ❌ (auth cat.) | ❌ | ❌ | ❌ | ❌ |
| `refreshToken` :106 | ❌ | ❌ (auth cat.) | ❌ | ❌ | ❌ | ❌ |

None of the 10 `src/app/api/freee/**` routes apply the HTTP-layer `rate-limit-middleware` /
`rate-limit-hybrid` (grep-confirmed — the `limit`/`rate` strings found in those files are the
`limit` query-param parser, not rate limiting). So the per-second token bucket is the **only**
freee rate control, it is **in-process / in-memory** (not shared across server instances), and it
does not cover auth or download calls.

---

## 1. Methodology & Evidence

- Enumerated every file under the three scope trees (`Glob src/{services,lib/integrations,app/api}/freee/**`).
- Read all 7 integration files, all 10 API routes, and the 1 service file in full.
- Located every outbound `fetch`/`fetchWithTimeout` to a `*.freee.co.jp` host by reading `client.ts`.
- Verified the wiring claims with repo-wide greps (authoritative):
  - `User-Agent|userAgent` in `src/lib/integrations/freee` → **0 matches**.
  - `audit-logger|auditLogger|logFreeeApiCall|prisma.auditLog` in `src/lib/integrations/freee` → **0 matches**.
  - `logFreeeApiCall|withApiLogging|logApiCall` in `src/` → only `journal-sync.ts:94` (out of scope) plus the logger's own definitions.
  - `dailyUsageTracker` in `src/` → only the definition/export line `rate-limiter.ts:157`.
  - `freeeApiQuotaManager.recordUsage` / `\.recordUsage\(` → only the method definition `quota-manager.ts:152`.
  - `freeeApiScheduler|api-scheduler` → only `api-scheduler.ts` itself (self-reference at `:289`).
  - `rate-limit-middleware|rateLimit|applyRateLimit` under `src/app/api/freee` → **0 matches**.
- Read the reference logger `src/lib/audit/audit-logger.ts` (read-only) to ground proposed call sites, and read the HTTP-layer limiter `src/lib/security/rate-limit-middleware.ts` to confirm the route-protection story.
- Cross-checked the sibling proposal `docs/proposals/log-002.md` (LOG-002) to avoid scope overlap — see §6.

All conclusions `PENDING HUMAN DETERMINATION`.

---

## 2. Policy baseline (the bar this audit measures against)

From `CLAUDE.md` §13 — **CrystalBall Policy**:

- `rate control`: **User-Agent header + rate limiting on all external calls.**
- `audit required`: **All API calls must have audit logs.**

From `CLAUDE.md` §9 — the audit log is a **blockchain-style integrity chain** written by
`auditLogger.log(...)` (`src/lib/audit/audit-logger.ts`), and there is a freee-specific convenience
method `auditLogger.logFreeeApiCall(endpoint, method, statusCode, durationMs, companyId?)`
(`audit-logger.ts:223`) whose signature matches exactly what an outbound caller should record.

Everything below measures the four freee fetch sites against this bar. `PENDING HUMAN DETERMINATION`.

---

## 3. Outbound call inventory — the four fetch sites

All four live in `src/lib/integrations/freee/client.ts`. Token/refresh calls hit
`https://accounts.secure.freee.co.jp/public_api/token`; data calls hit `https://api.freee.co.jp`.

### 3.1 `request<T>()` — `client.ts:172` (the central funnel)

Used by: `getCompanies` :230, `getJournals` :240, `getDocuments` :277, `getReceipts` :347,
`getTrialBalance` :361, `getAccountItems` :376, `getDeals` :426, `getDeal` :442,
`getReceiptDetails` :450.

- Rate-limit: ✅ `await freeeRateLimiter.waitForToken(options?.rateLimitType || 'data')` (`:187`).
- Circuit breaker: ✅ `freeeCircuitBreaker.execute(...)` (`:189`).
- Retry: ✅ `withRetry(...)` (`:190`, 3 attempts, exp backoff).
- Host allow-list + path-traversal guard: ✅ (`:158`, `:195`).
- **User-Agent: ❌** — headers sent are only `Authorization` + `Content-Type` (`:211-214`).
- **Audit log: ❌** — no `auditLogger.*` call before or after the fetch.
- **Per-day quota: ❌** — `dailyUsageTracker.increment` / `recordUsage` not called.

### 3.2 `downloadDocument()` — `client.ts:314` (bypasses the funnel)

Used by: `GET /api/freee/documents/[id]/download` (`documents/[id]/download/route.ts:49`). Returns
file **bytes** (potentially large).

- Fetch: direct `fetchWithTimeout(...)` at `:326-334`, **not** via `request<T>()`.
- Rate-limit: ❌ · Circuit breaker: ❌ · Retry: ❌ · Per-day quota: ❌.
- **User-Agent: ❌** — only `Authorization` sent (`:329-331`).
- **Audit log: ❌**.
- Note: this is a binary, user-triggerable, potentially heavy download with the **fewest
  protections** of any freee call. `PENDING HUMAN DETERMINATION` on severity.

### 3.3 `exchangeCodeForToken()` — `client.ts:70` (bypasses the funnel)

Used by: `GET /api/freee/callback` (`callback/route.ts:50`, after OAuth redirect).

- Fetch: direct `fetchWithTimeout` at `:75-91`. Rate-limit ❌ · CB ❌ · Retry ❌ · UA ❌ · Audit ❌.
- Auth-category calls are typically the most strictly throttled by OAuth providers; an unthrottled
  exchange is a policy gap even if rare. `PENDING HUMAN DETERMINATION`.

### 3.4 `refreshToken()` — `client.ts:101` (bypasses the funnel; can auto-fire)

Used by: `POST /api/freee/refresh` (`refresh/route.ts:30`) **and** automatically inside
`getValidAccessToken()` (`client.ts:150`) whenever a data-call token is expired.

- Fetch: direct `fetchWithTimeout` at `:106-121`. Rate-limit ❌ · CB ❌ · Retry ❌ · UA ❌ · Audit ❌.
- Risk amplifier: because refresh fires **automatically inside** the throttled `request<T>()`
  path, a retry/backoff storm on data calls can cascade into unthrottled token-refresh calls.
  `PENDING HUMAN DETERMINATION`.

---

## 4. Findings & proposed call sites

> Each block states the **status**, the **evidence** (`file:line`), the **gap**, and a **proposed**
> change with an exact insertion point. Nothing here is written to source — RATE-02 is read-only.
> Every proposal is `PENDING HUMAN DETERMINATION`.

### 4.1 FINDING R-1 — No `User-Agent` header on any freee outbound call

- **Evidence:** `client.ts:79-81`, `:110-112`, `:211-214`, `:329-331` — every `headers` block omits
  `User-Agent`. Repo grep for `User-Agent|userAgent` under `src/lib/integrations/freee` → 0 matches.
- **Gap:** violates CrystalBall `rate control` (User-Agent required on all external calls).
- **Proposed change (single funnel — recommended):** introduce a private header builder on
  `FreeeClient` and use it at all four sites, e.g.:
  ```ts
  // proposed: src/lib/integrations/freee/client.ts (new private helper)
  private buildHeaders(accessToken?: string): Record<string, string> {
    const h: Record<string, string> = {
      'User-Agent': process.env.FREEE_USER_AGENT
        || 'freee_audit/1.0 (+https://github.com/your-org/freee_audit)',
    }
    if (accessToken) h.Authorization = `Bearer ${accessToken}`
    return h
  }
  ```
  Then replace each literal `headers: {...}` at `:79`, `:110`, `:211`, `:329` with
  `headers: this.buildHeaders(<token?>)`. Exact UA string and env-var name
  `PENDING HUMAN DETERMINATION`.

### 4.2 FINDING R-2 — `downloadDocument` bypasses the rate-limit / CB / retry funnel

- **Evidence:** `client.ts:326-334` calls `fetchWithTimeout` directly; `getValidAccessToken` at
  `:325` is the only shared piece. No `waitForToken`, no `freeeCircuitBreaker`, no `withRetry`.
- **Gap:** the heaviest, user-triggerable call has the fewest protections; an attacker or script
  looping over `documentId` can hammer freee download endpoints with no throttle.
- **Proposed change:** route the call through the same guard-rails as `request<T>()`. Two options
  (`PENDING HUMAN DETERMINATION`):
  - **(a) Preferred:** extend `request<T>()` to support a binary/arrayBuffer response mode and have
    `downloadDocument` call it with `rateLimitType: 'receipt_download'` (a bucket that already
    exists at `rate-limiter.ts:20` but is currently unused).
  - **(b) Minimal:** keep the direct fetch but wrap it:
    ```ts
    // proposed insertion at client.ts:325 (before the existing fetch)
    await freeeRateLimiter.waitForToken('receipt_download')
    // …and wrap the fetch in freeeCircuitBreaker.execute(() => withRetry(() => fetchWithTimeout(...)))
    ```
  Either way, also add the `User-Agent` header (R-1) and audit logging (R-4) at the same site.

### 4.3 FINDING R-3 — OAuth token calls (`exchangeCodeForToken`, `refreshToken`) bypass the funnel

- **Evidence:** `client.ts:75-91` and `:106-121` call `fetchWithTimeout` directly with no
  `waitForToken`. Note `rate-limiter.ts:17` already defines an `auth` bucket
  (`{ maxRequests: 10, windowMs: 1000 }`) and `quota-manager.ts:55` defines `CATEGORY_QUOTA_COST.auth = 0`.
- **Gap:** unthrottled auth calls; `refreshToken` can auto-fire inside `request<T>()` (cascading).
- **Proposed change:** apply the `auth` rate-limit bucket to both, e.g.:
  ```ts
  // proposed insertion at client.ts:74 (exchangeCodeForToken) and :105 (refreshToken),
  // immediately after the isMockMode() early return:
  await freeeRateLimiter.waitForToken('auth')
  ```
  Whether to also wrap them in `freeeCircuitBreaker`/`withRetry` (token endpoints can 5xx) is
  `PENDING HUMAN DETERMINATION` — a circuit breaker that opens on the token endpoint could lock out
  all data calls, so a human should decide thresholds. Add `User-Agent` (R-1) and audit logging
  (R-4) here too.

### 4.4 FINDING R-4 — No outbound-call audit logging anywhere in the integration

- **Evidence:** grep for `auditLogger|audit-logger|logFreeeApiCall` under
  `src/lib/integrations/freee` → 0 matches. The dedicated helper
  `auditLogger.logFreeeApiCall(endpoint, method, statusCode, durationMs, companyId?)`
  (`audit-logger.ts:223`) is called only at `src/jobs/journal-sync.ts:94` (one endpoint, and even
  there `statusCode` is hard-coded `200` at `journal-sync.ts:82` — a pre-existing quality bug,
  out of scope to fix but noted).
- **Gap:** violates CrystalBall `audit required`. No record of which freee endpoints were called,
  by whom, when, or whether they succeeded — for any of the 9 data endpoints, downloads, or token
  calls.
- **Proposed change (central funnel — recommended):** instrument `request<T>()` once so every data
  endpoint is covered, capturing the real status code and duration:
  ```ts
  // proposed: src/lib/integrations/freee/client.ts, inside request<T>() around the fetch (client.ts:207-225)
  const startedAt = Date.now()
  let statusCode = 200
  try {
    const response = await fetchWithTimeout(url.toString(), { method, headers: this.buildHeaders(accessToken), body: ... }, API_TIMEOUTS.FREEE_API)
    statusCode = response.status
    if (!response.ok) {
      const error = (await response.json()) as FreeeError
      throw new FreeeApiError(error)   // statusCode captured for the catch branch
    }
    return response.json()
  } catch (err) {
    statusCode = (err instanceof FreeeApiError && err.status) ? err.status : 500
    throw err
  } finally {
    auditLogger.logFreeeApiCall(endpoint, method, statusCode, Date.now() - startedAt, this.companyId)
      .catch(() => {})
  }
  ```
  - Mirror the same `finally { auditLogger.logFreeeApiCall('POST /public_api/token', 'POST', status, ms, this.companyId) }`
    pattern at `exchangeCodeForToken` (`:75`), `refreshToken` (`:106`), and `downloadDocument`
    (`:326`).
  - Import: `import { auditLogger } from '@/lib/audit/audit-logger'`. (`@/lib/audit/**` is read-only
    reference for RATE-02; the import is a proposed *consumer* change in `client.ts`, which is a
    Class-A file — `PENDING HUMAN DETERMINATION` before any edit, and note §7 on the
    do-not-modify list.)
  - `FreeeApiError.status` currently may not be exposed — exact field name
    `PENDING HUMAN DETERMINATION` (see `types.ts` `FreeeApiError`).

### 4.5 FINDING R-5 — Per-day quota accounting is dead code; daily freee plan limit not enforced

- **Evidence:** `dailyUsageTracker.increment` (`rate-limiter.ts:105`) and
  `freeeApiQuotaManager.recordUsage` (`quota-manager.ts:152`) are **never called** (repo grep).
  `freeeApiScheduler` (`api-scheduler.ts:289`) is imported nowhere outside its own file. The plan
  limits `PLAN_DAILY_LIMITS` (`rate-limiter.ts:8`) and `FREEE_PLAN_DAILY_LIMITS` (`types.ts`) are
  defined but never decremented by live traffic.
- **Gap:** only the per-second token bucket throttles traffic; the per-day quota (3,000–10,000/day
  by plan) is uncounted and unenforced. A batch sync (`sync_all` loops 12 months × endpoints via
  `data-sync.ts`) can approach/exhaust the daily quota with no guardrail or early-warning.
- **Proposed change (two independent options — `PENDING HUMAN DETERMINATION`):
  - **(a) Lightweight:** in `request<T>()` `finally` block (same site as R-4), increment the
    existing tracker:
    ```ts
    if (this.companyId) {
      dailyUsageTracker.increment(this.companyId).catch(() => {})
      if (dailyUsageTracker.isLimitExceeded(this.companyId)) {
        // proposed: throw a typed QuotaExceededError (429-style) BEFORE the next fetch
      }
    }
    ```
    and check `dailyUsageTracker.isLimitExceeded(companyId)` at the **top** of `request<T>()`
    (before `waitForToken`) to short-circuit when the day is exhausted.
  - **(b) Full:** activate the existing quota-manager + scheduler by calling
    `freeeApiQuotaManager.recordUsage(companyId, category, 1)` per call and gating
    `canMakeCall(...)` — larger change, decides whether to retire or wire `api-scheduler.ts`.
  - Which (if either), and whether to persist usage across restarts (the current trackers are
    in-memory and reset on deploy), is `PENDING HUMAN DETERMINATION`.

### 4.6 FINDING R-6 — No HTTP-layer rate limiting on the 10 freee API routes

- **Evidence:** grep for `rate-limit-middleware|rateLimit|applyRateLimit` under `src/app/api/freee`
  → 0 matches. The per-user/per-IP `rate-limit-middleware.ts` / `rate-limit-hybrid.ts` are not
  applied. (LOG-002 §4.9 similarly notes no audit logging at these route handlers.)
- **Gap:** a single authenticated user can drive unbounded freee calls through these routes; the
  only backstop is the **process-local** in-memory token bucket, which is **not shared across
  server instances** and covers neither auth nor download.
- **Proposed change:** `PENDING HUMAN DETERMINATION` on whether to add an HTTP-layer limiter
  (e.g. `withRateLimit`-style wrapper, or `rate-limit-middleware` applied per route) keyed by
  `user.companyId` / IP for the freee route group, especially `documents/[id]/download`,
  `journals`, `receipts`, `sync`, and `refresh`. This complements (does not replace) the
  provider-side bucket in R-2/R-3.

---

## 5. Vestigial / partially-wired infrastructure (context, `PENDING HUMAN DETERMINATION`)

These exist in the integration but are not on the live request path. A human should decide whether
to wire, retire, or leave them. They are **not defects by themselves** — listed so the human knows
what is already built before deciding R-5.

- `rate-limiter.ts` — `DailyUsageTracker` / `dailyUsageTracker` (`:98-157`): defined, never
  incremented by live traffic. Has `setPlan`, `getUsage`, `isLimitExceeded`, `reset`.
- `quota-manager.ts` — `FreeeApiQuotaManager` / `freeeApiQuotaManager` (`:78-355`): full
  quota/priority/batch model (`canMakeCall`, `reserveQuota`, `recordUsage`, `enqueue`/`dequeue`,
  `getOptimalBatchSize`, `getRecommendedSchedule`). Only `getQuotaStatus` is read, and only by the
  scheduler below.
- `api-scheduler.ts` — `FreeeApiScheduler` / `freeeApiScheduler` (`:53-289`): batch creation,
  `planSchedule`, `optimizeBatchOrder`. Exported but imported nowhere else.
- `rate-limiter.ts` — `receipt_download` bucket (`:20`, `{ maxRequests: 3, windowMs: 1000 }`):
  defined in `DEFAULT_LIMITS` but no call site passes `rateLimitType: 'receipt_download'`
  (`downloadDocument` bypasses the funnel — see R-2). Unused today.

---

## 6. Relationship to LOG-002 (scope boundary)

The sibling report `docs/proposals/log-002.md` (LOG-002) covers **route-handler-level audit
logging of mutations** across Class-A groups. Its §4.9 already proposes route-level audit entries
for `GET /api/freee/callback`, `POST /api/freee/refresh`, and `POST /api/freee/sync` (the
*business events*: credential stored, bulk data written).

RATE-02 is **complementary, not overlapping**: it audits the **outbound HTTP layer**
(`FreeeClient` fetch sites) for **rate-control + per-call audit** of the *provider calls
themselves* (which endpoint, status, duration) — the job `auditLogger.logFreeeApiCall` was built
for. The two layers are independent and both are needed: LOG-002 answers "did a user trigger a
sync?", RATE-02 answers "which freee endpoints fired, did they succeed, were they throttled?".
No conclusion carried over; both reports stand at `PENDING HUMAN DETERMINATION`.

---

## 7. Cross-cutting recommendations (all `PENDING HUMAN DETERMINATION`)

1. **Make `request<T>()` the single funnel.** Routing `downloadDocument`, `exchangeCodeForToken`,
   and `refreshToken` through it (or through shared `waitForToken` + `buildHeaders` + audit
   helpers) fixes R-1, R-2, R-3, R-4 in one place rather than four. `client.ts` is a Class-A file
   (`src/lib/integrations/freee/**` is on the do-not-modify list for RATE-02); these are proposals
   for a later implementation task, not changes made here.
2. **Add the `User-Agent` header everywhere** (R-1) — lowest-cost, highest-coverage fix; satisfies
   the literal CrystalBall requirement regardless of freee enforcement.
3. **Wire the daily-quota tracker** (R-5) or explicitly retire the scheduler/quota stack (§5) to
   remove the impression of protection that does not exist. Decide persistence (in-memory resets
   on every deploy — likely unacceptable for a daily counter).
4. **Capture real status codes in audit logs.** The one existing `logFreeeApiCall` site
   (`journal-sync.ts:94`) hard-codes `200`; the proposed `request<T>()` instrumentation (R-4)
   reads `response.status` / the error status so failures are recorded as `result: 'FAILURE'`.
5. **Avoid secrets/PII in audit `details`.** Never log `access_token`/`refresh_token`, request
   bodies, or downloaded document bytes. `logFreeeApiCall` already logs only endpoint/method/
   status/duration/companyId — keep it that way.
6. **Add HTTP-layer rate limiting on freee routes** (R-6) as defense-in-depth alongside the
   provider-side bucket, keyed by company/IP, especially for `download` and `sync`.
7. **Decide circuit-breaker policy for the token endpoint** (R-3): an open breaker on
   `accounts.secure.freee.co.jp` would block all data calls — thresholds need a human decision.

---

## 8. Definition of Done for RATE-02 (this task)

- ✅ Single artifact produced: `docs/proposals/rate-02.md` (this file). No source touched; the
  three scope trees were read-only.
- ⏳ `node scripts/autopm_verify.mjs --changed-only` must exit 0 (docs-only diff) — to be
  confirmed by running it after this file is written.

---

### Final reminder

Every finding, status, call site, payload, and recommendation above is
**`PENDING HUMAN DETERMINATION`**. This report approves nothing, names no reviewer, and
constitutes no sign-off. It is analysis for a human, not a decision.
