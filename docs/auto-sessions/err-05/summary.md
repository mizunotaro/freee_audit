# ERR-05 — Standardize `Result<T,E>` in `social-insurance` / `board` / `investor` / `storage` / `validation`

**Scope:** `src/services/{social-insurance,board,investor,storage,validation}/**` (and the one
non-Class-A route caller touched).
**Date:** 2026-07-09
**Outcome:** Same approach as err-03 — converted every `throw` for an *expected failure* whose
signature is reachable from a non-Class-A path into an explicit `Result<T, AppError>` return.
Only **two** such throws existed across all five service trees; the remaining services contain no
expected-failure throws and were left unchanged (see “Scope analysis”). Faithful to the err-03
precedent: DB/Prisma promise rejections (not throws in our code) are left untouched, and already
Result-shaped custom types are not realigned absent a throw→`Result` conversion.

## What changed

### 1. `src/services/social-insurance/payment-checker.ts` — `updatePayment`
Before: `static async updatePayment(id, data): Promise<SocialInsurancePayment>` threw
`new Error('Payment not found')` when `prisma.socialInsurancePayment.findUnique` returned null.
After: signature is now
`Promise<Result<SocialInsurancePayment, AppError>>` — the not-found branch returns
`failure(createAppError(ERROR_CODES.NOT_FOUND, 'Payment not found', { details: { id } }))`, and the
happy path returns `success(updated)`. Message text is preserved verbatim.

The status-recalculation logic and the `prisma.…update` call are unchanged; only the failure
*signaling* changed (throw → `failure`). `updatePayment` has **no production importer**
(repo-wide grep of `src/` confirms only its own unit tests reference it), so the public-signature
change breaks no caller.

### 2. `src/services/board/board-meeting-service.ts` — `analyzeAgendaItemWithAI`
Before: `static async analyzeAgendaItemWithAI(…): Promise<string>` threw
`new Error('Agenda item not found')` when `prisma.agendaItem.findUnique` returned null.
After: signature is now `Promise<Result<string, AppError>>` — the not-found branch returns
`failure(createAppError(ERROR_CODES.NOT_FOUND, 'Agenda item not found', { details: { agendaItemId } }))`,
the happy path returns `success(analysis)`. Message text preserved verbatim. The AI-analysis
generation and `aiAnalysis` persistence are unchanged.

This method has **one** production caller — the non-Class-A route
`src/app/api/board/items/[id]/analyze/route.ts` — updated below.

### 3. `src/app/api/board/items/[id]/analyze/route.ts` — caller updated (non-Class-A)
The POST handler now branches on the `Result` returned by `analyzeAgendaItemWithAI`:
- on failure with `ERROR_CODES.NOT_FOUND` → `NextResponse.json({ error: message }, { status: 404 })`
  (previously this case threw into the route’s `catch` and returned a generic **500**; surfacing a
  precise 404 for a missing agenda item is strictly more correct and is the observable improvement);
- any other (defensive) failure → 500;
- on success → `NextResponse.json({ analysis: result.data })`, byte-identical to the prior
  `{ analysis }` body.

Audit logging is preserved exactly: the success branch logs `BOARD_AGENDA_ITEM_ANALYZE` with no
`result` field (defaults to SUCCESS), matching prior behavior; the new failure branch logs
`result: 'FAILURE'` with `details.error`, matching the shape the prior `catch` produced. The
`board` route tree is **not** in the Class-A list.

## Tests
Updated existing assertions to the `Result` shape (no assertion weakened; both not-found tests now
also assert `error.code === 'NOT_FOUND'` in addition to the message):
- `tests/unit/services/social-insurance/payment-checker.test.ts`
  - `updatePayment › should update existing payment` → asserts `result.success` then
    `result.data.actualAmount`.
  - `updatePayment › should throw error…` → renamed to `should return NOT_FOUND failure when
    payment not found`; asserts `result.success === false`, `error.code === 'NOT_FOUND'`,
    `error.message === 'Payment not found'`.
  - `updatePayment › should recalculate status on update` — unchanged (asserts only the
    `prisma.update` call args; the update still runs before `success(...)`).
- `tests/unit/services/social-insurance/payment-checker-extended.test.ts` — unchanged; its single
  `updatePayment` test asserts only the `prisma.update` call args (fallback `??`-logic coverage).
- `tests/unit/services/board/board-meeting-service.test.ts`
  - the 3 success-path `analyzeAgendaItemWithAI` tests now assert `result.success` then read
    `result.data`; the not-found test asserts the `NOT_FOUND` failure shape.
- `tests/unit/services/board/board-meeting-service-extended.test.ts` — the 3
  `analyzeAgendaItemWithAI` decision-type tests now assert `result.success` then read
  `result.data` (including the `aiAnalysis: result.data` expectation).

`if (!result.success) return` is used in the success-path tests purely as a TypeScript narrowing
guard so `result.data` type-checks; the preceding `expect(result.success).toBe(true)` is the real
assertion, so the guard never silently passes a failure.

## Scope analysis — services left unchanged

A repo-wide grep (`\bthrow\b` over `{investor,storage,validation}/**/*.ts`) plus reading every file
in the five trees found **no expected-failure throws** outside the two converted above. Consistent
with err-03 (which left `benchmark`/`closing` unchanged for the same reason), these are left as-is:

### `investor/invitation-service.ts` — no throws; custom result types
All functions already return Result-shaped custom unions (`InvitationResult`, `ValidateTokenResult`,
`AcceptInvitationResult`) and use `try/catch → { success:false, error }` / `{ valid:false, error }`.
There are no `throw`s to convert. err-01/err-02/err-03 all declined to realign already-Result-shaped
custom types absent an accompanying throw→`Result` conversion (would change the public contract of a
module imported by `investor` API routes for no failure-signaling gain). Left unchanged.

### `storage/file-service.ts` — already `Result`-returning; no throws
`FileService` already returns `Result<…>` from `@/lib/storage/types` for `putFile`/`getFile`/
`deleteFile`/`getMetadata` and forwards provider failures unchanged. No throws. Left unchanged.

### `validation/calculation-validator.ts` — no throws; `try/catch → []`
`validateWithLLM` and `parseValidationResponse` swallow errors into `[]`; `validateCashFlow`
returns a `CalculationValidationResult`. No expected-failure throws. Left unchanged.

### `social-insurance` siblings — no throws
`schedule-manager.ts`, `journal-matcher.ts`, `employee-insurance-tracker.ts` contain no throws;
their DB operations surface failures via Prisma promise rejections (not throws in our code) — the
same pattern err-01 left untouched in `budget`/`cashflow` and err-03 in `closing`. Left unchanged.

> Note on `any`: these files contain pre-existing `any` (e.g. `const where: any`, `Promise<any[]>`),
> but `@typescript-eslint/no-explicit-any` is **`off`** in `eslint.config.mjs`, so it does not affect
> the lint gate, and err-03 likewise did not retrofit `any` cleanups. No new `any` was introduced.

## Class-A safety
- The two converted methods live in `services/social-insurance` and `services/board` — neither is in
  the Class-A service list, and neither is imported by any Class-A service/route tree.
- `updatePayment` has **no production importer** (grep-confirmed), so its signature change cannot
  reach a Class-A path.
- `analyzeAgendaItemWithAI`’s sole production importer is `src/app/api/board/items/[id]/analyze/
  route.ts` — a non-Class-A `board` route, updated here. No Class-A route imports it.
- `tsc --noEmit` reports **0 errors repo-wide**, confirming no consumer (Class-A or otherwise)
  broke.

## Notes / judgment calls
- **Behavior identical on the success path; failure signaling only:** the only observable error-path
  change is that the board route now returns a precise **404** (with the verbatim message) for a
  missing agenda item instead of a generic 500 — the intended effect of moving an expected failure
  onto `Result`.
- **Zod `safeParse`:** not applied, consistent with err-01/err-02/err-03. The converted failures are
  resource-not-found states (a missing DB row by id), not malformed external input. All inputs are
  already statically typed (`string` ids, the existing `CreatePaymentInput` / company-info types);
  adding `safeParse` would introduce new failure modes and break “behavior identical.” The task
  constraints frame `safeParse` for *new helpers*; no new helper was needed here.
- No `any`/`@ts-ignore`/`@ts-expect-error`/`.skip`/lint-disable/coverage-lowering. No new
  dependencies. No Class-A path touched.

## Verification
- `corepack pnpm install --frozen-lockfile` ✔
- `corepack pnpm db:generate` (Prisma client — required for typecheck) ✔
- `corepack pnpm exec tsc --noEmit` → **0 errors repo-wide** ✔
- `corepack pnpm exec eslint --max-warnings=0` on the 7 changed files → **exit 0** ✔
- `corepack pnpm exec vitest run` on the 4 affected test files → **4 files / 57 tests passed** ✔
- `node scripts/autopm_verify.mjs --changed-only` → **exit 0** (typecheck 0 / eslint 0 / vitest 55)
  ✔
