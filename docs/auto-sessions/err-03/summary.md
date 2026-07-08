# ERR-03 — Standardize `Result<T,E>` in `benchmark` / `external-info` / `closing` / `market-data`

**Scope:** `src/services/{benchmark,external-info,closing,market-data}/**`
**Date:** 2026-07-09
**Outcome:** Converted every `throw` for *expected failures* whose signatures are
reachable only from non-Class-A paths. Two of the four services (`benchmark`, `closing`)
contain no expected-failure throws and were left unchanged (see “Scope analysis”). The
remaining throws are contracted retry/timeout infrastructure that is unit-tested to throw
(`retryWithBackoff`, `fetchWithTimeout`, `executeWithTimeout`) — left as-is with rationale,
mirroring err-02’s treatment of Prisma `$transaction` rollback throws.

## What changed

### 1. `src/services/market-data/providers/jquants-provider.ts` — `ensureToken`
Before: private `ensureToken(): Promise<void>` threw `new Error('Not authenticated')` (no
credential) and `new Error(result.error.message)` (token refresh failed); the four public
methods (`getQuotes`, `getFinancials`, `getCompanyInfo`, `searchCompanies`) each wrapped it
in `try/catch` and mapped any throw to `MarketDataResult` failure `fetch_failed`.
After: `ensureToken(): Promise<Result<void, AppError>>` — `success(undefined)` when the token
is valid or freshly acquired; `failure(createAppError(ERROR_CODES.UNAUTHORIZED, …))` for the
no-credential and refresh-failed branches. The four callers now branch on the `Result`
before the fetch `try` block; on failure they return the same `{ code: 'fetch_failed',
message }` shape they produced before. Message text (`'Not authenticated'`, the auth-error
message) is preserved verbatim.

Public signatures are **unchanged** (still `Promise<MarketDataResult<…>>`); `ensureToken` is
private. `fetchWithAuth` (defensive `'No token available'` guard, unreachable after
`ensureToken` succeeds, and entangled with `retryWithBackoff`) and the base-class
`fetchWithTimeout`/`retryWithBackoff` are left throwing — see “Left unchanged”.

### 2. `src/services/external-info/sources/nta-source.ts` — `performScraping`
Before: private `performScraping` threw `'NTA scraping not implemented…'`; the throw
propagated through `scrapeNtaSite` → `executeWithTimeout` → `executeFetch` →
`retryWithBackoff` (which retried the **permanent** stub error `maxRetries` times with
exponential backoff) → `fetch`’s `catch`, which recorded failure and returned
`ExternalInfoResult` failure `nta_fetch_error`.
After: `performScraping(): Promise<Result<ExternalInfoItem[], AppError>>` returns
`failure(createAppError(BUSINESS_LOGIC_ERROR, <same message>))`. `scrapeNtaSite` now returns
`Result<…>` (through the unchanged `executeWithTimeout`), and `executeFetch` unwraps it — on
failure it returns an `ExternalInfoResult` failure with the **same** `nta_fetch_error` code
and message. `fetch` now branches on `result.success` to call `recordSuccess` vs.
`recordFailure` (previously `recordSuccess` ran unconditionally in the `try` block, which
would have mis-recorded a Result failure as success).

### 3. `src/services/external-info/sources/web-search-source.ts` — `performSearch` + 4 search methods
Before: `performSearch` threw `'Unknown search provider: …'` in the `default` branch;
`searchWithOpenAI`/`searchWithSerpAPI`/`searchWithGoogle`/`searchWithBing` each threw a
“not configured” `Error` (missing API key / search-engine id) and a “not implemented”
`Error`. All propagated through `retryWithBackoff` (retried as permanent errors) → `fetch`
`catch` → `web_search_error`.
After: all five return `Result<ExternalInfoItem[], AppError>` — “not configured” failures use
`ERROR_CODES.VALIDATION_ERROR`, “not implemented” / “unknown provider” use
`BUSINESS_LOGIC_ERROR`; every message is preserved verbatim. `executeSearch` unwraps the
`Result` into an `ExternalInfoResult` failure with the **same** `web_search_error` code and
message; `fetch` branches on `result.success` for `recordSuccess`/`recordFailure`.

### Behavior note (nta + web-search)
Observable failure signaling is identical: same `success: false`, same `error.code`
(`nta_fetch_error` / `web_search_error`), same `error.message`, and same health progression
(`recordFailure` → `consecutiveFailures=1` → `degraded`). The one change on the error path is
that a **permanent** stub failure (not-implemented / not-configured / unknown-provider) is no
longer retried `maxRetries`× with exponential backoff — it short-circuits to a `Result`
failure. This is the intended standardization: an expected permanent failure returns a
`Result` instead of being wastefully retried (the nta “not implemented” test dropped from
~7020 ms to ~7 ms; the web-search “API key not configured” test from ~1520 ms to ~7 ms).
Transient failures (a future real network implementation that **throws**) still retry via
`retryWithBackoff` and still land in `fetch`’s `catch` → `recordFailure` → failure result,
because `executeFetch`/`executeSearch` propagate throws unchanged.

## Tests
Added **9 error-branch tests** (no existing assertion weakened):
- `jquants-provider.test.ts` (8 → 9): new “fails with `fetch_failed` when token refresh
  fails” — stores a credential via a failing `authenticate`, then asserts `getQuotes`
  returns `fetch_failed` with the auth-error message (exercises the `ensureToken` Result
  failure branch).
- `nta-source.test.ts` (8 → 9): new “preserves not-implemented message and records failure
  health” — asserts `nta_fetch_error` + `/NTA scraping not implemented/` message **and**
  `health.status === 'degraded'`, `consecutiveFailures === 1`, `lastError` contains the
  message (confirms the `fetch` restructure records failure, not success).
- `web-search-source.test.ts` (9 → 16): new “error branches per provider” describe — openai
  (not-configured + not-implemented), serpapi, google, bing, unknown-provider each assert
  `web_search_error` + the exact message fragment; plus “records failure health on error”.

The single `as never` cast (unknown-provider test) is a minimal type assertion over the
exhaustive `WebSearchProvider` union (not `any`) — same pattern err-02 used for the
unreachable `ExportFormat` default.

## Scope analysis — services left unchanged

### `benchmark` (no `throw` for expected failures)
`BenchmarkService.compare` already returns a Result-shaped `BenchmarkResult`
(`| {success:true; data} | {success:false; error: BenchmarkError}`) and the data files
(`industry-ratios.ts`, `company-size-benchmarks.ts`) contain no throws. The existing test
already consumes it via `isSuccess`/`isFailure` from `@/types/result` (structurally
compatible). `BenchmarkError` is a custom `{code, message}` rather than `AppError`, but
err-01/err-02 did not realign already-Result-shaped custom types absent an accompanying
throw→`Result` conversion, so benchmark is left as-is.

### `closing` (no `throw` for expected failures)
`closing-entries.ts` has no explicit throws. DB operations surface failures via Prisma
promise rejections (not throws in our code), exactly the pattern err-01 left untouched in
`budget`/`cashflow`. `generateClosingEntries`/`calculateTaxEffectAccounting`/etc. return raw
values; edge cases (empty lookups) return empty arrays/sentinels, never throw. No
production importer exists (only its own unit test imports it), so there is no caller to
update. Left unchanged.

### Contracted infra throws (tested to throw) — `market-data` & `external-info`
- `BaseMarketDataProvider.fetchWithTimeout` (throws `HTTP <status>`) and `retryWithBackoff`
  (throws `lastError` after exhaustion): unit-tested to throw
  (`base-provider.test.ts`, `base-provider-extended.test.ts` assert `.rejects.toThrow`).
  Throw is the retry/timeout mechanism. Left as-is.
- `BaseInfoSource.retryWithBackoff` / `executeWithTimeout`: same — `base-source.test.ts`
  asserts `retryWithBackoff` `.rejects.toThrow` after retries exhausted. Left as-is.
- `JQuantsProvider.fetchWithAuth`: thin wrapper over `retryWithBackoff`; its
  `'No token available'` guard is unreachable after `ensureToken` succeeds and is entangled
  with the throwing retry infra. Left as-is.

## Class-A safety
A repo-wide check confirms **no Class-A path imports any changed symbol**:
- `ensureToken` is private; the four changed J-Quants methods keep their public
  `MarketDataResult` signatures, so the sole external importer
  (`src/app/api/settings/market-data/jquants/test/route.ts`, a non-Class-A settings route)
  is unaffected.
- `nta-source` / `web-search-source` have **no importer outside `src/services/external-info`**
  (verified by repo-wide grep); their `fetch` signature (`ExternalInfoResult`) is unchanged.
- `benchmark` / `closing` were not modified.

`benchmark`/`closing`/`external-info`/`market-data` are not in the Class-A service/route
list, and none of the Class-A trees import these services. `tsc --noEmit` reports 0 errors
repo-wide, confirming no consumer broke.

## Notes / judgment calls
- **“Behavior identical”:** success-path computation is unchanged everywhere; only failure
  *signaling* changed (throw → `failure`). The one observable error-path change is that
  permanent stub failures no longer trigger `retryWithBackoff` retries (see “Behavior note”)
  — the explicit goal of moving expected failures onto `Result`.
- **Zod `safeParse`:** not applied, consistent with err-01/err-02. The converted failures are
  business-logic / configuration states (unimplemented source, missing API key, not
  authenticated), not malformed external input. All inputs are already statically typed
  (`WebSearchProvider`, `MarketDataCredential`, `ExternalInfoQuery`); adding `safeParse`
  would introduce new failure modes and break “behavior identical.”
- No `any`/`@ts-ignore`/`@ts-expect-error`/`.skip`/lint-disable/coverage-lowering. No new
  dependencies.

## Verification
- `corepack pnpm install --frozen-lockfile` ✔
- `corepack pnpm db:generate` (Prisma client — required for typecheck) ✔
- `corepack pnpm exec tsc --noEmit` → **0 errors repo-wide** ✔
- `corepack pnpm exec eslint --max-warnings=0` on the 6 changed files → **exit 0** ✔
- `corepack pnpm exec vitest run` on the 3 changed test files + 4 related infra test files
  (base-provider, base-provider-extended, base-source, jquants-extended) → **7 files /
  62 tests passed** ✔
- `node scripts/autopm_verify.mjs --changed-only` → **exit 0** ✔
