# ERR-06 — Finish `Result<T,E>` in remaining non-Class-A services + call sites

**Scope:** Sweep of every remaining non-Class-A `src/services/**` and `src/lib/**`
tree for `throw new Error(...)` that signals an **expected, recoverable failure**
and is reachable **only** from non-Class-A paths. err-01..err-05 already covered
`{analytics,budget,cashflow,currency,report,reports,export,import,benchmark,
external-info,closing,market-data,peer-companies,fixed-assets,inventory,
account-items,social-insurance,board,investor,storage,validation}`. err-06 covers
the rest: `services/{ai,ocr,secrets,dd,analysis}` and the non-Class-A `src/lib/**`
trees.

**Date:** 2026-07-12
**Outcome:** Converted the **two** remaining propagating expected-failure throws
whose public signatures are reachable only from non-Class-A paths
(`getPrompt`, `requireAPIKey`). Every other `throw` found in the sweep is either
Class-A-reachable, contracted retry/timeout/circuit-breaker infra, a contained
control-flow throw (caught → graceful fallback), or an env-var/invariant throw at
module load — each left unchanged with rationale below, consistent with the
err-01..err-05 precedent.

## What changed

### 1. `src/services/ai/prompt-service.ts` — `getPrompt`
Before: `getPrompt(analysisType, companyId?): Promise<AnalysisPromptDetail>` threw
`new Error('Unknown analysis type: ${analysisType}')` when `DEFAULT_PROMPTS[analysisType]`
was falsy. `DEFAULT_PROMPTS` is `Record<AnalysisType, …>` (exhaustive over the
union), so the branch is structurally unreachable for valid input — the defensive
default-branch pattern err-02 converted for `createExportService` / err-01 for
`createExchangeRateService`.

After: returns `Promise<Result<AnalysisPromptDetail, AppError>>` —
`success({...})` on both the custom-prompt and default-prompt paths;
`failure(createAppError(ERROR_CODES.BUSINESS_LOGIC_ERROR, 'Unknown analysis type:
${analysisType}', { details: { analysisType } }))` on the defensive branch. Message
text preserved verbatim. Success-path computation unchanged; only failure
*signaling* changed (throw → `failure`).

Call site updated (non-Class-A only):
- `src/app/api/prompts/[type]/route.ts` GET branch: now branches on
  `result.success` — on failure returns `404 { error: 'Prompt not found' }`; on
  success returns `200 { prompt: result.data }` (byte-identical body to the prior
  `{ prompt }`). The outer `try/catch` is **kept** so a Prisma `findFirst`
  rejection still maps to the same `404` (err-0X leaves Prisma promise rejections
  alone — they are not throws in our code). Response bodies and status codes are
  identical to before; the only change is that the unknown-type case is now an
  explicit `Result` branch instead of a thrown-then-caught path.

`getPrompt` is also re-exported from `@/services/ai/prompt-service` directly; a
repo-wide grep confirms the sole production importer is the non-Class-A
`/api/prompts/[type]` route (Class-A list does not include `prompts`).

### 2. `src/services/secrets/api-key-service.ts` — `requireAPIKey`
Before: `requireAPIKey(provider, options?): Promise<string>` threw
`new Error('${provider} API key is required but not configured')` when no key was
resolved from secret-manager / DB / env.

After: returns `Promise<Result<string, AppError>>` — `success(key)` on the happy
path; `failure(createAppError(ERROR_CODES.VALIDATION_ERROR, '${provider} API key
is required but not configured', { details: { provider } }))` when no key is found.
`VALIDATION_ERROR` matches err-03's "not configured" code assignment (missing API
key / search-engine id). Message text preserved verbatim.

`requireAPIKey` has **no production importer** (repo-wide grep: only its own unit
test references it). The Class-A-reachable AI consumers
(`src/lib/integrations/ai/factory.ts`, `src/services/ai/journal-proposal-service.ts`)
call the **non-throwing** `apiKeyService.getAPIKey(…)` method (returns
`Promise<APIKeyConfig | null>`), not the standalone `requireAPIKey` wrapper — so
the signature change cannot reach a Class-A path. This mirrors err-02's
`parseJournalCsv` (no production caller, converted).

## Tests
Updated existing assertions to the `Result` shape (no assertion weakened; both
error-branch tests now also assert `error.code` + exact message; the
`requireAPIKey` failure test additionally asserts `error.details`):
- `tests/unit/services/ai/prompt-service.test.ts`: the 4 success-path `getPrompt`
  tests now `expect(result.success).toBe(true)` + `if (!result.success) return`
  narrowing guard, then read `result.data`; the "unknown analysis type" test is
  renamed `should return failure for unknown analysis type` and asserts
  `success === false`, `error.code === BUSINESS_LOGIC_ERROR`, exact message. Added
  `import { ERROR_CODES } from '@/types/result'`.
- `tests/unit/services/secrets/api-key-service.test.ts`: the success test reads
  `result.data`; the "no key" test is renamed `should return failure when no key is
  configured` and asserts `success === false`, `error.code === VALIDATION_ERROR`,
  exact message, and `error.details).toEqual({ provider: 'openai' })`. Added
  `import { ERROR_CODES } from '@/types/result'`.

The `if (!result.success) return` guard after `expect(result.success).toBe(true)`
is pure TypeScript narrowing (err-05 idiom) — the preceding `expect` is the real
assertion, so the guard never silently passes a failure.

## Scope analysis — throws left unchanged

A repo-wide `\bthrow\b` search over the remaining non-Class-A service + lib trees
found throws in the files below. Each is left as-is for the stated reason
(consistent with err-01..err-05 precedent).

### Class-A-reachable signatures (cannot change public signature)
- **`src/services/ocr/ocr-factory.ts`** — `createEngine` throws `'YomiToku is not
  enabled'` + `'Unknown OCR engine: ${type}'`. `createEngine` is private, called
  only by `getEngine`, whose throw propagates through the public `getOCREngine` →
  imported by `src/app/api/journal-proposal/analyze/route.ts` (**Class-A**).
  Converting would force a `getOCREngine`/`getEngine` signature change reaching a
  Class-A route. Left unchanged.
- **`src/lib/storage/factory.ts`** — `createStorageProvider` throws `'Unsupported
  storage provider: ${config.provider}'`. Imported by
  `src/app/api/journal-proposal/{upload,analyze}/route.ts` (**Class-A**). Left
  unchanged.
- **`src/lib/integrations/ai/factory.ts`** — `'Unknown AI provider'`.
  `createAIProvider*` is imported by `src/services/audit/{receipt-analyzer,
  journal-checker}.ts` (**Class-A audit**) and `src/lib/conversion/{rationale-
  generator,disclosure-ai-enhancer}.ts` (**Class-A conversion**). Left unchanged.
- **`src/lib/ai/config/model-config.ts`** — `getConfig` throws `'Invalid
  provider'`. `ModelConfigService` is the AI config resolver consumed by the
  Class-A-reachable AI factory chain. Left unchanged.
- **`src/lib/secrets/index.ts`** + `src/lib/secrets/providers/*` —
  `getSecretsManager`/`getSecret` throws ('provider not configured', 'Required
  secret not found', provider HTTP errors). Secrets are consumed by the
  Class-A-reachable freee/AI integration paths. Left unchanged.
- **`src/lib/utils/safe-formula-evaluator.ts`** — `FormulaError` throws. Used by
  the Class-A valuation monte-carlo formula path. Left unchanged.
- **`src/services/ai/analysis-service.ts`** — private `analyzeWith{OpenAI,Gemini,
  Claude}` throw 'API key not configured' / 'API error: ${status}'. These are
  **contained** by `analyzeFinancialData`'s try/catch (lines 69-72) which degrades
  to `generateMockAnalysis` — they never propagate. `analyzeJournalEntry` (the
  other export) reaches `src/app/api/audit/journal/route.ts` (**Class-A audit**)
  but does not itself throw (its not-configured branch returns mock directly).
  Converting the contained private throws is cosmetic (zero behavior change —
  already graceful-degrades to success), so left unchanged per the
  "behavior-identical / minimal-diff" bar.

### Contained control-flow throws (caught → graceful fallback; cosmetic to convert)
- **`src/services/ai/journal-proposal-service.ts`** — `parseAIResponse` throws
  'No JSON found' / 'Invalid response format' but is wrapped in its own try/catch
  (lines 485-493) returning a fallback `{entries:[], rationale:'AIレスポンスの
  パースに失敗しました', confidence:0, warnings:[…]}`; `validateAndBuildOutput`
  throws 'Invalid date' inside a try/catch (lines 521-529) that falls back to
  today's date + a warning. All contained, never propagate. Left unchanged.

### Contracted infra throws (retry / timeout / circuit-breaker; tested to throw)
Left as-is, exactly as err-03 treated `fetchWithTimeout`/`retryWithBackoff` and
err-05 left the social-insurance sibling infra:
- `src/services/ai/analyzers/utils.ts` — `checkTimeout`, `checkIterationLimit`,
  `withRetry` (rethrows `lastError`), `CircuitBreaker.execute` ('Circuit breaker
  is open' + rethrow). Throw is the retry/timeout mechanism.
- `src/lib/external/calculation-client.ts`, `src/lib/api/fetch-with-timeout.ts`,
  `src/lib/utils/timeout.ts` — timeout/retry infra.
- `src/lib/integrations/ai/{claude,openai,openrouter,openai-compatible}.ts` —
  per-provider `throw lastError` retry loops.
- `src/lib/integrations/ai/fallback-provider.ts` — 'All providers failed' / 'No
  providers available' (fallback-chain terminal failure, entangled with circuit
  breakers).
- `src/lib/integrations/ai/generate-with-fallback.ts` — rethrow.
- `src/services/external-info/sources/base-source.ts`,
  `src/services/market-data/base-provider.ts`,
  `src/services/market-data/providers/jquants-provider.ts:250` —
  retry/timeout/token infra err-03 already analyzed and left.

### Throw-by-name explicit variants of an already-non-throwing sibling
- **`src/lib/ai/personas/registry.ts`** — `getOrThrow`/`getPersonaOrThrow` throws
  'Persona not found: ${type}'. The module already exposes `getPersona` returning
  `BasePersona | undefined` (the non-throwing / Result-shaped path). `OrThrow` is
  an explicit throw-by-name convenience (like `.unwrap()`) with **no production
  caller** (only its own test). Converting it to `Result` would make the name a
  lie for no signaling gain. Left unchanged.

### Already-Result-shaped / quasi-Result custom types (not realigned)
- `src/services/ocr/*`, `src/services/dd/*`, `src/services/analysis/*` —
  repo-wide `\bthrow\b` returned **no** expected-failure throws (dd and analysis
  have zero throws; ocr throws only in the Class-A-reachable factory above).
- The `reports/ir-*` `$transaction` rollback throws, `reports/ir/ir-report-service.ts`
  browser prototype, and `reports/business-report/data-aggregator.ts` dead code —
  all already analyzed and left by err-02.

### Env-var / invariant throws at module load (config errors, not recoverable)
- `src/lib/auth*`, `src/lib/crypto*`, `src/lib/security/*`, `src/lib/audit/*`,
  `src/lib/storage/base-storage.ts` (integrity / ENCRYPTION_KEY),
  `src/lib/backup/sqlite-backup.ts` — these are Class-A or invariant/config-error
  throws (missing required env var, bad key format). They signal programmer/config
  errors at startup, not expected recoverable operation failures. Left unchanged.
- `src/lib/api/auth-helpers.ts` — `AuthenticationError`/`AuthorizationError`
  throw-based auth-gating bridge consumed by API routes (caught → 401/403). Throw
  is the contracted bridge; converting would be a large cross-route change.
  Left unchanged.
- `src/lib/api/outbound-rate-limiter.ts` — `OutboundRateLimitError` throw-bridge
  (deferred to the rate-0X track per project memory). Left unchanged.

## Class-A safety
- The two converted symbols live in `services/ai/prompt-service.ts` and
  `services/secrets/api-key-service.ts` — neither tree is in the Class-A list, and
  neither is imported by any Class-A service/route tree (grep-verified).
- `getPrompt`'s sole production importer is the non-Class-A `/api/prompts/[type]`
  route (updated).
- `requireAPIKey` has **no production importer**.
- `tsc --noEmit` reports **0 errors repo-wide**; `autopm_verify --changed-only`
  typecheck reports 0/0 — confirming no consumer (Class-A or otherwise) broke.

## Notes / judgment calls
- **"Behavior identical":** success-path computation is unchanged everywhere; only
  failure *signaling* changed (throw → `failure`). The `/api/prompts` GET response
  bodies/status codes are byte-identical (the try/catch is retained so Prisma
  rejections map to the same 404).
- **Zod `safeParse`:** not applied, consistent with err-01..err-05. The converted
  failures are a defensive-unreachable union branch (`getPrompt`) and a
  not-configured config state (`requireAPIKey`), not malformed external input. All
  inputs are already statically typed (`AnalysisType`, `AIProvider`); adding
  `safeParse` would only introduce new failure modes and break "behavior
  identical."
- No `any`/`@ts-ignore`/`@ts-expect-error`/`.skip`/lint-disable/coverage-lowering.
  No new dependencies. No new TODO/FIXME/NotImplementedError. No Class-A path
  touched.

## Verification
- `corepack pnpm install --frozen-lockfile` ✔
- `corepack pnpm db:generate` (Prisma client — required for typecheck) ✔
- `corepack pnpm exec vitest run` on the 2 changed test files → **2 files /
  54 tests passed** ✔
- `corepack pnpm exec tsc --noEmit` → **0 errors repo-wide** ✔
- `corepack pnpm exec eslint --max-warnings=0` on the 5 changed files → **exit 0** ✔
- `node scripts/autopm_verify.mjs --changed-only` → **exit 0**
  (typecheck 0/0, eslint 0, vitest 54 passed) ✔
