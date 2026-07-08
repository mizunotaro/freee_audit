# ERR-02 — Standardize `Result<T,E>` in `report` / `reports` / `export` / `import` services

**Scope:** `src/services/{report,reports,export,import}/**`
**Date:** 2026-07-08
**Outcome:** Converted the 4 functions that `throw` for *expected failures* and whose
signatures are reachable only from non-Class-A paths. Every other `throw` in these trees is
either Prisma `$transaction` rollback control-flow (already wrapped in `failure()` at the
boundary) or lives in dead/prototype code — left unchanged with rationale below.

## What changed

### 1. `src/services/export/index.ts` — `createExportService`
Before: `throw new Error('Unsupported export format: ${format}')` in the `default` branch.
After: returns `Result<ExportService<ReportData>, AppError>` — `success(...)` for
`pdf`/`pptx`/`excel`/`csv`; `failure(createAppError(BUSINESS_LOGIC_ERROR, …, {details:{format}}))`
in the default branch. `ExportFormat` is the exhaustive union `'pdf' | 'pptx' | 'excel' | 'csv'`,
so the default branch is structurally unreachable for valid input — this mirrors the err-01
`createCurrencyConverter`/`createExchangeRateService` factory conversion (defensive failure kept
for type-safety without re-introducing a throw).

Call sites updated (non-Class-A only):
- `src/app/api/export/pdf/route.ts`, `src/app/api/export/pptx/route.ts`: unwrap the `Result`
  (literal valid formats, so the failure branch is unreachable but type-checked); return
  `400` on the (impossible) failure.

### 2. `src/services/import/journal-import.ts` — `parseJournalCsv`
Before: two `throw new Error(...)` for malformed CSV structure — (a) `< 2` lines, (b) missing
required headers.
After: returns `Result<JournalImportRow[], AppError>` — both failures become
`failure(createAppError(VALIDATION_ERROR, …))` (the missing-headers failure also carries
`{details:{missingHeaders}}`); success path returns `success(rows)`. Message text preserved
exactly. This is the clearest malformed-input case in the scope.

`parseJournalCsv` has no production caller (the import API routes use
`journal-importer.ts`); it is exercised only by its own unit test, which was updated to unwrap
the `Result` and assert `VALIDATION_ERROR` failures.

### 3. `src/services/report/monthly-report.ts` — `generateMonthlyReport`, `getMultiMonthReport`
Before: `throw new Error('Company not found')` when `company.findFirst` returns null.
After: both return `Promise<Result<MonthlyReport | MultiMonthReport, AppError>>` —
`failure(createAppError(NOT_FOUND, 'Company not found'))` on the null lookup; success-path
computation unchanged and wrapped in `success(...)`.

Call site updated (non-Class-A only):
- `src/app/api/reports/monthly/route.ts`: unwrap the `Result`; a not-found now returns `404`
  with the error message instead of the previous catch-all `500` (the throw previously fell
  through to the `try/catch` → `500`). This is the intended standardization: an expected
  failure is now surfaced with the correct status code, not a generic 500.

## Tests
Updated the four affected test files to unwrap `Result` (repo idiom:
`expect(r.success).toBe(true/false)` + guarded `if (r.success)` / `if (!r.success)`),
replacing `expect(() => …).toThrow()` assertions, and **added error-branch coverage**:
- `export-service.test.ts`: unsupported format now asserts `success === false` +
  `/Unsupported export format/` message (was `toThrow`).
- `journal-import.test.ts`: no-data-rows and missing-headers now assert `VALIDATION_ERROR`
  failure + message; cleaned a pre-existing unused `beforeEach` import that the lint gate
  (`--max-warnings=0`) flags on any touched file.
- `monthly-report.test.ts`: **new** test "should return failure when company is not found"
  asserts `NOT_FOUND` failure + exact message for `generateMonthlyReport` (9 → 10 tests).

`monthly-report.test.ts` 9 → 10 tests; the other three files keep their counts (50 total).

## Scope analysis — services left unchanged

### `src/services/reports/ir-{faq,event,shareholder,report}-service.ts` (Prisma-backed)
Every `throw new Error('NOT_FOUND' | 'INVALID_FAQ' | 'INVALID_SECTION' | 'ALREADY_PUBLISHED')`
here lives **inside a `prisma.$transaction(async (tx) => { … })` callback** and is caught by an
outer `try/catch` that maps it to `failure(createServiceError(...))`. These throws are
**transaction-rollback control flow**: throwing is the only way to abort and roll back a Prisma
interactive transaction. The enclosing functions already return `Result` (`Promise<…Result>`);
converting the inner throw to a `failure()` return would silently *commit* partial writes
instead of rolling back — a behavior change, not a signaling change. **Correctly left as-is.**

### `src/services/reports/ir/ir-report-service.ts` (file-based `irReportService`)
A **browser-only `localStorage` prototype** (`if (typeof window === 'undefined') return null`).
Its `throw new Error('Report not found' / 'Section not found')` therefore fire on every
server-side call from its 4 API routes today (the store is empty server-side). Converting these
to `Result` across ~7 methods + 4 routes + 1 test file would change server behavior in a
prototype and is a large, higher-risk diff — out of scope for a "minimal, behavior-identical"
Result standardization. Left unchanged.

### `src/services/reports/business-report/data-aggregator.ts` — `getCompanyInfo`
The `throw new Error('Company not found: ${companyId}')` is in a `private` method of
`BusinessReportDataAggregator`. The exported singleton `businessReportDataAggregator` and the
`business-report` barrel (`index.ts`) have **no importer anywhere in `src`** (verified by
repo-wide grep) — the class is reachable only from its own unit test (dead production code).
Per the minimal-diff principle it is left unchanged.

### No other throws
A repo-wide `throw` search over the four trees found throws **only** in the files above.
`report/{periodic-report,cash-flow}.ts`, `export/{pdf,excel,pptx}-export.ts`,
`import/{account-item,journal,monthly-balance}-importer.ts`, `import/{parsers,ai}/**`,
`reports/board-report-service.ts`, `reports/ir-{pdf-exporter,pptx-exporter,report-service}.ts`,
and `reports/business-report/{content-validator,exporter,report-validator,workflow-service}.ts`
contain no throws for expected failures.

## Class-A safety
A repo-wide check confirms **no Class-A path imports any changed symbol**:
- `createExportService` → only `src/app/api/export/{pdf,pptx}/route.ts`.
- `parseJournalCsv` → only `tests/unit/services/import/journal-import.test.ts` (no production caller).
- `generateMonthlyReport` / `getMultiMonthReport` → only `src/app/api/reports/monthly/route.ts` + the two report test files.

`export`/`import`/`reports`/`report` are not in the Class-A API-route list, and none of the
Class-A service trees import these services. `autopm_verify --changed-only` typecheck reports
0 errors, confirming no consumer broke.

## Notes / judgment calls
- **"Behavior identical":** success-path computation is unchanged everywhere; only failure
  *signaling* changed (throw → `failure`). The one observable behavior change is the monthly
  route now returning `404` (not-found) instead of `500` for a missing company — the explicit
  goal of standardizing expected failures onto `Result`.
- **Zod `safeParse`:** not applied to the converted functions, consistent with err-01. The
  `createExportService` failure is an unreachable defensive branch over a statically-typed
  union; the `parseJournalCsv` failures are structural CSV checks (line count, required
  headers) whose existing logic is preserved verbatim — rewriting them as Zod schemas would
  introduce new failure modes and break "behavior identical" / "minimal diff." (Row-level Zod
  validation already exists via `JournalImportSchema.safeParse` in `validateJournalRows`.)
- No `any`/`@ts-ignore`/`@ts-expect-error`/`.skip`/lint-disable/coverage-lowering. No new
  dependencies. The single `as never` cast in the new not-found test is a minimal type
  assertion (not `any`) to satisfy the full `Prisma.TransactionClient` shape for a partial mock.

## Verification
- `corepack pnpm install --frozen-lockfile` ✔
- `corepack pnpm db:generate` (Prisma client — required for typecheck) ✔
- `corepack pnpm exec vitest run` on the 4 affected test files → **4 files / 50 tests passed** ✔
- `node scripts/autopm_verify.mjs --changed-only` → **exit 0**
  (typecheck 0/0, eslint exit 0, vitest 50 passed) ✔
