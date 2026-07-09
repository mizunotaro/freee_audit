# IMPL-PERF-01 — Summary

Implemented the **non-Class-A** query/caching recommendations from
`docs/proposals/perf-01.md` in the `report/**`, `reports/**` read paths.
All Class-A paths left untouched. Definition of Done met:
`node scripts/autopm_verify.mjs --changed-only` exits **0**
(typecheck 0 errors, eslint 0, vitest 25/25).

## What changed

### New shared helper — `src/services/report/balance-loader.ts`
- `fetchBalancesByFiscalYear(companyId, fiscalYear)` → `Result<MonthlyBalanceRow[], AppError>`.
  - One indexed query per fiscal year (`@@index([companyId, fiscalYear])` — no new index needed).
  - **Caching via `src/lib/cache`**: backed by `MemoryCache` with a short TTL
    (`CACHE_TTL_REPORT_BALANCES`, default **30 000 ms**) to de-dupe concurrent
    report reads of the same fiscal year (e.g. a dashboard generating monthly +
    periodic + multi-month reports of one FY simultaneously).
  - **Result + Zod**: `safeParse` validates `{ companyId, fiscalYear }`; invalid input
    returns `failure(VALIDATION_ERROR)` without touching the DB.
  - `clearBalanceCache()` exported for test isolation / explicit invalidation.

### PERF-01-01 — `monthly-report.ts` (High)
Collapsed the per-month N+1 loops into **1 indexed query per fiscal year**, grouped
into an in-memory `Map<month, rows>`; BS and PL now read disjoint category subsets of
the **same** fetched rows (the proposal verified the category vocabularies are disjoint,
so reuse is safe). Per-month empty-row → sample-data fallback preserved exactly.
- `generateMonthlyReport`: loads the current-FY map once; current BS / previous-month BS /
  current PL are built from it; the map is passed to `getYearCashFlows` (no re-fetch).
  Previous-year PL (a different fiscal year) is loaded once via the cached loader.
- `getYearCashFlows`: ~35 sequential queries → **1** (0 extra when map is supplied).
- `getMonthlyTrend`: ~24 sequential queries → **1**.
- `getMultiMonthReport`: up to ~36 sequential queries → **1**.

### PERF-01-02 — `periodic-report.ts` (Medium)
- Pre-compute the distinct fiscal years touched by all periods, bulk-load them
  (one cached query per FY, run concurrently) into a `Map<"fy|month", rows>`.
- `getPeriodData` now reads BS / PL / previous-month BS from the map (pure, no awaits) —
  fixes duplicate read per period (Problem A), cross-period re-reads (Problem B), and
  serial awaits within a period (Problem C).
- `calculatePeriodPL` is now a **pure** function of the already-fetched balances
  (the redundant re-query is gone). `getPreviousMonthBS` is a pure map lookup
  (`null` when the previous month is absent — behavior preserved).

### PERF-01-03 — `data-aggregator.ts` (Low)
`getFinancialData` now issues **one** `findMany({ fiscalYear: { in: [fy, fy-1] } })`
and partitions by `fiscalYear` in memory (was 2 queries).

### PERF-01-04 — `$transaction` on single reads (Low)
Dropped the interactive-transaction wrapper from single read-only statements in
`monthly-report.ts` and `periodic-report.ts` (company lookups + balance reads) —
now bare `prisma.X.findMany/findFirst`. Multi-statement transactions elsewhere were
not touched.

## Deferred (not done) — with rationale

- **PERF-01-05 (`@@index([companyId])` on `User`)**: **Class-A** (`prisma/schema.prisma`).
  Explicitly out of scope; left for a schema-level decision. No source change.
- **PERF-01-04 `$transaction` removal on `reports/board-report-service.ts` /
  `reports/ir-*-service.ts`**: the proposal §5 already verified those read paths
  **CLEAN** (no N+1 / no missing include-select), so there is no correctness gain —
  only a Low-severity wrapper removal. Those files sit behind known **fake-green**
  test surfaces (IR service tests re-implement functions locally; shareholder service
  has a legitimate multi-statement transaction in `getLatestShareholderComposition`
  that must stay). Risk > benefit, so left untouched. Nothing here is unsafe to do
  later in a dedicated, test-aware pass.

## Behavior parity notes
- Empty-balance → sample-data fallbacks preserved in every path (monthly per-month,
  periodic per-period, periodic previous-month → `null`).
- `getYearCashFlows` month-1 `previousBS = null` preserved.
- Periodic BS (`current_assets`/`fixed_assets`/`net_assets`) and PL
  (`sales`/`cost_of_sales`/…) consume disjoint category subsets of the same rows —
  reuse is correct (matches the proposal's verification).
- Public export signatures unchanged: `generateMonthlyReport`, `getMonthlyTrend`,
  `getMultiMonthReport`, `generatePeriodicReport`, `formatPeriodicReportForExport`,
  `BusinessReportDataAggregator` — API routes (`/api/reports/monthly`,
  `/api/reports/periodic`) are unaffected (whole-repo typecheck: 0 errors).

## Cache tradeoff (read)
`MonthlyBalance` is a write-sensitive table (journal sync / import / conversion).
The balance cache is **process-local, short-TTL (30 s default), env-tunable**
(`CACHE_TTL_REPORT_BALANCES`; set to `0` to effectively disable). This bounds
staleness for on-demand report generation while de-duping concurrent reads —
consistent with the existing `exchangeRateCache` / `kpiCache` pattern. Write paths
were intentionally not modified (most are out of scope); they may call
`clearBalanceCache()` if immediate freshness is required.

## Tests
- `balance-loader.test.ts` (new): cache miss/hit, Zod validation failures (empty
  companyId, out-of-range fiscalYear) do not query.
- `monthly-report.test.ts`: updated "company not found" to mock the direct
  `prisma.company.findFirst`; added `query efficiency` suite asserting
  `getMonthlyTrend` issues **1** query per FY and serves repeat reads from cache.
- `periodic-report.test.ts`: mock switched from `$transaction` to direct
  `monthlyBalance.findMany`; added query-count tests (1 query/FY, 2 with
  previous year). Cache cleared per test.
- `data-aggregator.test.ts`: asserts current+previous-year balances load in a
  **single** query.
- 16 → 25 passing tests; baseline was green before changes.

## Verification
```
node scripts/autopm_verify.mjs --changed-only   # exitCode 0
  typecheck: ok (0 errors)
  eslint:    ok (8 files)
  vitest:    ok (25 passed)
```
