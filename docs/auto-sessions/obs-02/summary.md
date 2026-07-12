# OBS-02 — Structured-logging completeness across remaining non-Class-A services

## Goal
Migrate `console.*` → project `secureLogger` (structured fields + levels) in the
remaining **non-Class-A** backend services. Keep all Class-A paths untouched. Add /
update tests where log output is contractual. No new deps.

## Scope — what changed (12 source files, 35 `console.*` call sites)

### AI provider integration layer (`src/lib/integrations/ai/`)
| File | Calls | Notes |
|------|------:|-------|
| `factory.ts` | 11 | mock-mode info, missing/no-API-key warns, fallback-chain info |
| `fallback-provider.ts` | 5 | circuit-breaker warn, success info, per-provider failure warn |
| `openai.ts` | 1 | retry warn (`withRetry`) |
| `openrouter.ts` | 1 | retry warn (`withRetry`) |
| `openai-compatible.ts` | 1 | retry warn (`withRetry`) |
| `register-providers.ts` | 1 | one-shot "providers registered" info |

### AI analysis service (`src/services/ai/`)
| File | Calls | Notes |
|------|------:|-------|
| `analysis-service.ts` | 3 | LLM-failure / parse-failure / journal-analysis error fallbacks |

### Secret providers (`src/lib/secrets/`)
| File | Calls | Notes |
|------|------:|-------|
| `providers/gcp-secret-manager.ts` | 3 | init / get / list error paths |
| `providers/aws-secrets-manager.ts` | 3 | init / get / list error paths |
| `providers/azure-keyvault.ts` | 3 | init / get / list error paths |
| `providers/onepassword.ts` | 2 | get / list error paths |
| `index.ts` | 1 | `LocalSecretProvider.loadSecrets` error path |

## Convention used
- Every call carries a `component: '<Svc>'` field (e.g. `AIProviderFactory`,
  `FallbackAIProvider`, `AWSSecretsManagerProvider`, `AnalysisService`).
- Level map: `info` (lifecycle / success), `warn` (validation / fallback / retry),
  `error` (unexpected catch). Matches the OBS-01 convention.
- Structured context replaces interpolated prefixes — e.g.
  `console.warn('[AI] Missing API key for gemini, skipping')` →
  `secureLogger.warn('Missing API key for provider, skipping', { component, provider })`.
- Error objects are passed as `error` in context (secureLogger masks sensitive keys
  and truncates).

## Tests (4 files modified)
Log output was **contractual** in 3 files (existing tests asserted exact `console`
strings) and is now asserted via `getSecureLogger()` spies on the singleton:

- `factory.test.ts` — 10 exact-string console assertions rewritten to
  `secureLoggerInstance` spy assertions (`objectContaining({ component, chain, … })`).
  Removed 3 unused top-level imports flagged by lint.
- `register-providers.test.ts` — exact-string + count assertions rewritten to
  `secureLoggerInstance.info` spy. Removed unused `afterEach` import and dead
  `importCallCount`.
- `fallback-provider.test.ts` — the one two-arg `console.warn` assertion rewritten to
  a `getSecureLogger().warn` spy. Removed unused `FallbackAIProvider` import and 3
  unused mock-fn args (`_request` / `_options`).
- `analysis-service.test.ts` — **added** a new contract test that forces the
  LLM-failure path (mock `fetch` rejects, real apiKey, mock-mode off) and asserts
  `secureLogger.error('LLM analysis failed', { component:'AnalysisService', provider })`.

### Key gotcha — `vi.resetModules()` + `secureLogger` singleton
`secureLogger` is a Proxy that resolves `getSecureLogger()` (the module singleton) at
call time. Tests that call `vi.resetModules()` + dynamic `import()` (factory,
register-providers) re-evaluate the logger module → a **fresh** singleton that the
top-level `getSecureLogger` import does NOT see. Fix: capture the fresh singleton in
`beforeEach` right after `resetModules` and spy on that:
`secureLoggerInstance = (await import('@/lib/utils/secure-logger')).getSecureLogger()`.
Tests with **static** imports and no `resetModules` (fallback-provider,
analysis-service) can spy on a top-level `getSecureLogger()` directly.

## Verification
- `pnpm exec eslint --max-warnings=0` on all 16 changed files → clean.
- `pnpm exec vitest run <changed>` → 273 tests pass (incl. new analysis-service test).
- `node scripts/autopm_verify.mjs --changed-only` → **exitCode 0**
  (typecheck 0 errors, eslint 0, vitest 11 files / 273 tests).
- The 2 secrets tests the gate does not resolve by stem
  (`secrets-manager.test.ts`, `onepassword-extended.test.ts`) were run manually
  (109 secrets tests pass) — not fake-green.

## Deliberately left unchanged (with reasons)
- `src/services/ai/analyzers/utils.ts` `ConsoleLogger` class — its `console.log` is
  the implementation of a logging abstraction (`ConsoleLogger implements Logger`),
  not a call site; converting it would change its contract. Left as-is.
- `src/services/reports/ir-*-service.ts` — the grep hits were **JSDoc** examples
  (`* console.log(result.data)`), not executable calls. Nothing to migrate.
- `src/services/ai/journal-proposal-service.ts` (5 console calls) — Class-A-adjacent
  (journal-proposal logic). The constraint enumerates `src/services/journal-proposal/**`
  as Class-A; this file sits under `src/services/ai/` but is journal-proposal logic, so
  it was skipped to err on the side of caution.
- All enumerated Class-A paths (audit, conversion, valuation, tax, kpi, debt,
  deferred-accrual, freee, auth, crypto, security, prisma, microservices) — untouched.

## Remaining non-Class-A `console.*` for future OBS-NN
Frontend pages/components (`src/app/**/page.tsx`, `src/components/**`), hooks
(`src/hooks/**`), chat error boundaries, API routes (`src/app/api/**`, mostly
`console.error` in catch blocks), `src/jobs/**`, and `src/lib/external/`,
`src/lib/ai/{tokenizer,config,input-suggestion}/**`, `src/lib/integrations/{box,slack}`
were out of scope for this batch (~250+ calls repo-wide remain, consistent with the
OBS-01 estimate).
