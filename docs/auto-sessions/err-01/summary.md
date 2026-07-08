# ERR-01 — Standardize `Result<T,E>` in non-Class-A services

**Scope:** `src/services/{analytics,budget,cashflow,currency}`
**Date:** 2026-07-08
**Outcome:** Only `currency` had functions that `throw` for expected failures. Converted both;
the other three services already avoid throwing for expected failures (see “Scope analysis”).

## What changed

### 1. `src/services/currency/exchange-rate.ts` — `createExchangeRateService`
Before: `throw new Error(\`${source} exchange rate service not implemented\`)` for
`ECB | MURC | OPEN_EXCHANGE | MANUAL`.
After: returns `Result<ExchangeRateService, AppError>` — `success(new BOJExchangeRateService())`
for BOJ/default, `failure(createAppError(ERROR_CODES.BUSINESS_LOGIC_ERROR, …))` for the
unimplemented sources. Message text preserved exactly.

### 2. `src/services/currency/currency-converter.ts` — `DefaultCurrencyConverter.convert`
Before: `throw new Error('Cannot convert from … with rate …')` when the requested currency
pair does not match the supplied `ExchangeRate`.
After: returns `Result<CurrencyConversion, AppError>` — `success(…)` on both conversion
directions and the same-currency shortcut; `failure(createAppError(BUSINESS_LOGIC_ERROR, …,
{details}))` on mismatch (details include `from`, `to`, `rateFrom`, `rateTo`).

Call sites updated within the same service:
- `convertWithLatestRate` now returns `Promise<Result<CurrencyConversion, AppError>>`. The
  `getLatestRate` await is wrapped in try/catch so a rate-service rejection is surfaced as
  `failure(createAppError(EXTERNAL_SERVICE_ERROR, …))` instead of propagating a throw.
- `createCurrencyConverter(service?)` now returns `Result<CurrencyConverter, AppError>` and
  propagates the inner `createExchangeRateService('BOJ')` result (the failure branch is
  unreachable for `'BOJ'` but kept for type-safety without re-introducing a throw).

### 3. `src/services/currency/types.ts` — `CurrencyConverter` interface
`convert` → `Result<CurrencyConversion, AppError>`;
`convertWithLatestRate` → `Promise<Result<CurrencyConversion, AppError>>`. Added
`type AppError` to the existing `@/types/result` import.

## Class-A safety check
The changed symbols (`convert`, `convertWithLatestRate`, `createCurrencyConverter`,
`createExchangeRateService`, `CurrencyConverter`, `DefaultCurrencyConverter`) are used **only**
within `src/services/currency/**` and re-exported from `src/services/currency/index.ts`. The
sole external importer is `src/jobs/exchange-rate-fetch-job.ts`, which only uses
`BOJRateProvider.fetchRates` (already a `Result`). **No Class-A path imports any changed
signature**, so changing these public signatures is within the task constraints. A full-repo
`tsc --noEmit` reports zero currency-related errors, confirming no other consumer broke.

## Tests
Updated the three affected test files to unwrap `Result` (repo idiom:
`expect(r.success).toBe(true/false)` + guarded `if (r.success)` / `if (!r.success)`),
replacing the old `expect(() => …).toThrow()` assertions, and **added/extended error-branch
coverage**:
- `currency-converter.test.ts`: incompatible-rate pair now asserts `BUSINESS_LOGIC_ERROR`
  failure with exact message; **new** test “should return failure when the rate service
  rejects” covers the `convertWithLatestRate` catch branch (`EXTERNAL_SERVICE_ERROR`).
- `exchange-rate.test.ts`: `createExchangeRateService('ECB')` asserts failure with code +
  message.
- `exchange-rate-extended.test.ts`: `it.each(['MURC','OPEN_EXCHANGE','MANUAL'])` asserts
  failure (code + message); BOJ source asserts success + instance.

`currency-converter.test.ts` grew 21 → 22 tests.

## Scope analysis — services left untouched (no `throw` for expected failures)
A repo-wide `throw` search across the four service trees found throws **only** in currency
(see above). The others were left unchanged because they do not throw on expected failures:

- **analytics** (`financial-kpi.ts`, `kpi.ts`): all division goes through `safeDivide`
  (returns 0 on zero denominator); division-by-zero and missing-data are handled by guards /
  sentinels, never throws.
- **budget** (`budget-service.ts`, `budget-import.ts`, `actual-vs-budget.ts`,
  `detailed-actual-vs-budget.ts`): no explicit throws. DB ops surface failures via Prisma
  promise rejections (not throws in our code). `importBudgetFromCsv` already returns a
  structured `BudgetImportResult { success, errors[] }` and `validateBudgetCsv` returns
  `{ valid, errors }` — both are already Result-shaped, no throws.
- **cashflow** (`calculator.ts`, `cash-position.ts`, `runway-calculator.ts`): no throws.
  Edge cases use `console.warn` + empty/sentinel returns (`createEmptyRunwayResult`,
  999-runway, etc.); `validateAndApplyAdjustments` clamps values instead of throwing.

## Notes / judgment calls
- “Keep behavior identical”: success-path computation is unchanged; only the failure
  *signaling* changed (throw → `failure`). The one new failure mode surfaced by
  `convertWithLatestRate` (rate-service rejection) previously propagated as a thrown/rejected
  promise — now returned as a `Result`, which is the intended standardization.
- Zod `safeParse`: not applied here. The converted failures are **business-logic mismatches**
  (currency pair incompatible with the rate; unsupported provider source), not malformed input.
  All inputs are already statically typed (`Currency`, `ExchangeRateSource`, `ExchangeRate`),
  so adding `safeParse` would only introduce *new* failure modes and break “behavior
  identical.” No new helpers were added.
- No `any`/`@ts-ignore`/`.skip`/lint-disable/coverage-lowering. No new dependencies.

## Verification
- `corepack pnpm install --frozen-lockfile` ✔
- `corepack pnpm db:generate` (Prisma client — required for typecheck) ✔
- `corepack pnpm exec vitest run` on the currency test dir → **6 files / 64 tests passed** ✔
- `corepack pnpm exec tsc --noEmit` → 0 currency-related errors ✔
- `node scripts/autopm_verify.mjs --changed-only` → **exit 0**
  (typecheck 0/0, eslint exit 0, vitest 43 passed) ✔
