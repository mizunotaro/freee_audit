# ERR-04 — Standardize `Result<T,E>` in `peer-companies` / `fixed-assets` / `inventory` / `account-items`

**Scope:** `src/services/{peer-companies,fixed-assets,inventory,account-items}/**`
**Date:** 2026-07-09
**Outcome:** **No source changes.** A repo-wide `throw` search across all four service trees
returned **zero** `throw` statements — the exact situation err-01 found in
`analytics`/`budget`/`cashflow` and err-03 found in `benchmark`/`closing`. Under the err-0X
contract (convert `throw` for *expected failures* → `Result<T,E>`; leave no-throw services
untouched with documented rationale), every service here is left as-is. Nothing was forced, and
no fake-green conversion was manufactured.

## Why no `throw` → `Result` conversion was possible

The err-0X series has one narrow target: a `throw new Error(...)` that signals an **expected,
recoverable failure** (business-logic / validation / config state) and is therefore better
expressed as a `Result` value. err-01's `currency` and err-03's `market-data`/`external-info`
each had exactly such throws. A `grep -nE '\bthrow\b'` over the four target directories returns
**no matches**:

```
src/services/peer-companies   →  No matches found
src/services/fixed-assets     →  No matches found
src/services/inventory        →  No matches found
src/services/account-items    →  No matches found
```

The only failure-signaling throw anywhere in these trees is a **negated** assertion in the
fixed-assets *test*: `tests/unit/services/fixed-assets/depreciation.test.ts:499`
`expect(() => calculateDepreciation(zeroLifeAsset, …)).not.toThrow()` — i.e. the production
function is explicitly asserted **not** to throw on degenerate input (`usefulLife = 0`). There
is nothing to convert.

## Per-service scope analysis (services left unchanged)

### `peer-companies` — already fully `Result`-shaped (local `Result`/`AppError`)
- `peer-company-service.ts`: every method (`create`, `findById`, `list`, `update`, `delete`,
  `bulkCreate`, `setSimilarityScores`) already returns `Result<…>` and signals expected
  failures (`not_found`, `duplicate_ticker`, `*_failed`) as `{ success:false, error:{code,
  message} }` — never by throwing. DB failures are caught and mapped to the same shape.
- `peer-selector-ai.ts`: `suggestPeers` already returns `Result<PeerCandidate[]>`; AI failures
  are caught and fall back to the rule-based path (`suggestWithRules`), which also returns
  `Result`. `parseAIResponse` swallows parse errors → `[]`.
- Both consume a **local** `Result<T,E>` / `AppError` defined in `peer-companies/types.ts`.
  That local `AppError` is `{ code; message; details?: unknown }` — it lacks the canonical
  `@/types/result` `AppError`'s **required** `timestamp: Date` (and optional `cause`), so the
  inline error literals (e.g. `{ code:'not_found', message:'…' }`) are not structurally
  assignable to the canonical `AppError`. err-03 faced the identical situation with
  `benchmark`'s `BenchmarkError` and **declined to realign** an already-Result-shaped custom
  type absent an accompanying throw→`Result` conversion. err-04 follows that precedent:
  realigning would force a `timestamp: new Date()` onto every error literal (8+ sites), change
  the error shape, and update every consumer/test — a behavior-changing expansion of scope, not
  a signaling standardization. Left as-is.
- Tests already consume the Result contract (`peer-company-service.test.ts`,
  `peer-company-service-extended.test.ts`, `peer-selector-ai*.test.ts`) via
  `expect(result.success).toBe(false)` + guarded `if (!result.success) expect(result.error.code)`.

### `fixed-assets` — no `throw`; raw values + Prisma rejections
`depreciation.ts` is pure calculation + CRUD. All exported functions return raw values
(`FixedAsset`, `DepreciationResult`, `DepreciationSchedule`, arrays, `void`); the only failure
mode is a **Prisma promise rejection** (`createFixedAsset`, `deleteFixedAsset`,
`calculateMonthlyDepreciation`'s `update`), which is not a `throw` in our code — precisely the
pattern err-01 left untouched in `budget`/`cashflow` and err-03 left untouched in `closing`.
- `importFixedAssetsFromFreee` already converts failures to a return value:
  `{ imported: number; error?: string }` (freee `result.error` mapped inline; unexpected errors
  caught). It never throws an expected failure. This quasi-Result custom shape is the same class
  err-03 declined to realign for `benchmark` — converting it to canonical `Result<{imported},
  AppError>` would be a "realign already-Result-shaped custom type" expansion, out of scope.
- `calculateDepreciation`'s `default: depreciationAmount = 0` for an unknown method is a silent
  fallback, not a throw; turning it into a `Result` failure would introduce a **new** failure
  mode and break "behavior identical" (err-01/err-03 explicitly avoided this).
- Note (out of scope): `generateDepreciationSchedule` can yield `Infinity` for
  `monthlyDepreciation`/`annualDepreciation` when `usefulLife === 0` (division by zero). That is
  a **numerical-robustness** concern, not a Result-signaling concern — it belongs to the
  valuation/numerics review track (REV-VAL family), not the err-0X throw→Result track. It is
  also currently untested as a failure and is not a throw, so it is left untouched here.

### `inventory` — no `throw`; raw values + Prisma rejections
`inventory-adjustment.ts` has no throws whatsoever. Every function returns a value
(`InventoryAdjustmentResult[]`, `InventoryAlert[]`, the trend object, `void`); edge cases return
sentinels (`{ hasAdjustment:false }`, empty arrays, the zero-balance `stable` trend). Failure
surfaces only via Prisma promise rejections (`upsert`/`update`/`findUnique`), exactly the
budget/cashflow/closing pattern. No conversion target. Left unchanged.

### `account-items` — already quasi-`Result`; no `throw`
`account-items-service.ts`:
- `syncAccountItemsFromFreee` already returns `{ success:boolean; imported:number; error?:string }`
  and maps the freee `result.error` inline, catching unexpected errors. It never throws an
  expected failure — the quasi-Result custom shape err-03 declined to realign for `benchmark`.
- `getAccountItems` / `getAccountItemsByCategory` return raw arrays; failure = Prisma rejection.
- `mapCategoryType` maps an unknown category to `'sga_expenses'` (silent default, not a throw);
  converting it to a `Result` failure would change behavior and is out of scope.
- Tests already consume the `{ success }` contract
  (`account-items-service.test.ts:89/101/114/140/149`). Left unchanged.

## Class-A safety
**No source file was modified**, so no caller — Class-A or otherwise — is affected. The four
service trees are not in the Class-A list (`audit`, `conversion`, `valuation`, `tax`, `kpi`,
`debt`, `deferred-accrual`, `journal-proposal`, `freee` + their libs/routes). A precise import
search (`from '@/services/(peer-companies|fixed-assets|inventory|account-items)'`) resolves to
two non-Class-A API routes only: `src/app/api/settings/peer-companies/suggest/route.ts` and
`src/app/api/inventory/route.ts`; both are unaffected because nothing changed.

## Notes / judgment calls
- **Why not realign the local `peer-companies` `Result`/`AppError` to `@/types/result`?** The
  local `AppError` lacks the canonical `timestamp: Date`; the inline error literals are not
  assignable to it. err-03 set the precedent of not realigning already-Result-shaped custom
  types without a throw→Result conversion. Doing so here would be behavior-changing scope
  creep. Declined, consistent with the series.
- **Why not wrap raw-value functions in `Result`?** err-01 deliberately left `budget`/`cashflow`
  raw-value functions alone (their only failure mode is Prisma promise rejection, not a throw in
  our code). `fixed-assets`/`inventory`/`account-items` reads are the same pattern. Wrapping them
  would introduce new failure signaling where none currently exists — a behavior change, not a
  standardization.
- **Zod `safeParse`:** not applied, consistent with err-01/err-03. The (non-)converted paths are
  business-logic / silent-default states (unknown category, unknown depreciation method),
  already statically typed; adding `safeParse` would only introduce new failure modes and break
  "behavior identical."
- No `any`/`@ts-ignore`/`@ts-expect-error`/`.skip`/lint-disable/coverage-lowering. No new
  dependencies. No new TODO/FIXME/NotImplementedError.

## Verification
- `grep -nE '\bthrow\b'` over all four service dirs → **0 matches** (the conversion target is
  empty). ✔
- The one `toThrow` in the service tests is `not.toThrow()` (fixed-assets robustness assertion). ✔
- `node scripts/autopm_verify.mjs --changed-only` → **exit 0** ✔ (this change is doc-only:
  `docs/auto-sessions/err-04/summary.md`; the gate classifies it as `other`, skips
  typecheck/eslint/vitest, and reports success. No TS/test file was added or modified, so per
  the task constraint of running only added/modified tests, there is nothing to run.)
