# PERF-01 — N+1 Query / Prisma `include`-`select` Audit (Report & Analytics Reads)

> **Status: ANALYSIS ONLY — every conclusion below is `PENDING HUMAN DETERMINATION`.**
> This document contains no approvals, no reviewer names, and no sign-offs. It is a read-only
> analysis produced for a human reviewer to decide and action. Nothing here has been authorized,
> accepted, or merged.

---

## 1. Task & constraints (recap)

- **Scope (read paths audited):** `src/services/report/**`, `src/services/reports/**`,
  `src/services/analytics/**`.
- **Mode:** AUDIT ONLY. No source files were modified. This file is the **only** artifact produced.
- **Class-A paths** (`prisma/**`, `src/lib/auth*`, `src/lib/crypto.ts`, `src/lib/security/**`,
  `src/lib/audit/**`, `src/services/{audit,conversion,valuation,tax,kpi,debt,deferred-accrual,
  journal-proposal,freee}/**`, the corresponding `src/app/api/**` trees, and the microservices)
  were treated as read-only reference and were **not** proposed for change.
- **Every recommendation is `PENDING HUMAN DETERMINATION`.**

## 2. Executive summary

| ID | File | Pattern | Query cost today | Proposed | Severity |
|----|------|---------|------------------|----------|----------|
| PERF-01-01 | `report/monthly-report.ts` | Per-month loop of `monthlyBalance.findMany` (BS + prev-BS + PL per month) + duplicate BS/PL fetches | up to ~35 sequential queries per report; ~24 in trend | 1 indexed query per fiscal year | **High** |
| PERF-01-02 | `report/periodic-report.ts` | Per-period duplicate `monthlyBalance` read (BS == PL same month) + cross-period previous-month re-reads | 3 queries/period (1 redundant); re-reads across periods | 1 read/period (or 1 bulk for all periods) | **Medium** |
| PERF-01-03 | `reports/business-report/data-aggregator.ts` | Current-year and previous-year balances fetched as 2 separate queries | 2 queries | 1 query (`fiscalYear: { in: [...] }`) | **Low** |
| PERF-01-04 | `report/**`, `reports/**` | Single read queries wrapped in `prisma.$transaction(async tx => …)` | BEGIN/COMMIT round-trips per read (compounds in loops) | bare `prisma.X.findMany` for read-only | **Low** |
| PERF-01-05 | `reports/business-report/data-aggregator.ts` → `User` | `User` model has no index on `companyId`; officer query filters on it | full scan of `users` | optional `@@index([companyId])` | **Low** |

**Index review conclusion (`PENDING HUMAN DETERMINATION`):** the proposed single-query bulk fetches
in PERF-01-01 / PERF-01-02 are **already fully backed by existing indexes** — no new index is
required to realize those gains (see §6). The only optional index addition is `User.companyId`
(PERF-01-05).

## 3. Methodology

1. Enumerated every `prisma.*` call in the three scope trees (grep).
2. Read each service file end-to-end; flagged (a) loops that issue one query per iteration
   (classic N+1), (b) duplicate reads of identical rows, (c) missing `include`/`select` causing
   relation fan-out, (d) missing `select` causing over-fetch, (e) reads wrapped in unnecessary
   transactions.
3. Cross-checked every queried field set against `prisma/schema.prisma` indexes to confirm whether
   the existing indexes already support each query (and the proposed changes).

## 4. Findings

### PERF-01-01 — Per-month query loop in `monthly-report.ts`  *(Severity: High)*

**Location:** `src/services/report/monthly-report.ts`
- `getYearCashFlows()` — lines **141–156** (called by `generateMonthlyReport`, line **60**)
- `getMonthlyTrend()` — lines **414–435**
- `getMultiMonthReport()` — lines **478–533** (loop at **507–516**)
- Shared helpers `getBalanceSheet()` (91–114) and `getProfitLoss()` (116–139), each issuing one
  `prisma.$transaction(async tx => tx.monthlyBalance.findMany({ where:{ companyId, fiscalYear, month } }))`.

**Problem (N+1).** These functions iterate over months (1–12) and `await` one DB query per month per
statement. They are **sequential** (`for … await`), not concurrent.

- `getYearCashFlows` per iteration: `getBalanceSheet(month)` + `getBalanceSheet(month-1)` +
  `getProfitLoss(month)` ⇒ **12 + 11 + 12 = ~35 sequential queries** for a single report.
- `getMonthlyTrend`: 2 queries × 12 months ⇒ **~24 sequential queries**.
- `getMultiMonthReport` (monthCount up to 12): 3 queries × up to 12 ⇒ **up to ~36 sequential
  queries**.

**Redundancy compounding the above (`PENDING HUMAN DETERMINATION` to confirm intent):**
1. `getBalanceSheet(month-1)` at iteration *M* re-reads the same `(companyId, fiscalYear, M-1)`
   rows already fetched as `getBalanceSheet(month)` at iteration *M-1* (≈11 redundant reads in
   `getYearCashFlows`).
2. For the same `(companyId, fiscalYear, month)`, `getBalanceSheet` and `getProfitLoss` issue
   **two separate queries returning the identical row set**; they differ only by which `category`
   values they keep in memory (`mapBalancesToBalanceSheet` keeps `current_asset`/`fixed_asset`/…;
   `mapBalancesToProfitLoss` keeps `revenue`/`cost_of_sales`/`sga_expense`/…). One fetch suffices.

**Evidence the rows are identical:** both helpers filter `where: { companyId, fiscalYear, month }`
with no other predicate (monthly-report.ts:96–104 and 121–129). The category split is purely
client-side.

**Proposed change (`PENDING HUMAN DETERMINATION`):** add a bulk helper that fetches all months for
a fiscal year in one indexed query and groups by `month`, then drive the loops off the in-memory
map, reusing the same rows for both BS and PL.

```ts
// One indexed query per fiscal year instead of N queries per month.
async function getBalancesByMonth(
  companyId: string,
  fiscalYear: number
): Promise<Map<number, MonthlyBalance[]>> {
  const rows = await prisma.monthlyBalance.findMany({
    where: { companyId, fiscalYear }, // uses @@index([companyId, fiscalYear])
  })
  const byMonth = new Map<number, MonthlyBalance[]>()
  for (const r of rows) (byMonth.get(r.month) ?? byMonth.set(r.month, []).get(r.month)!).push(r)
  return byMonth
}
```

`getYearCashFlows` / `getMonthlyTrend` / `getMultiMonthReport` would then read from the map:
a missing month ⇒ fall back to `generateSample*` (see caveats). This collapses ~24–36 sequential
round-trips to **1 query per fiscal year** (2 if a prior fiscal year is also needed, e.g.
`getProfitLoss(fiscalYear - 1, month)` at line 55).

**Caveats the human must resolve (`PENDING HUMAN DETERMINATION`):**
- **Empty-month fallback semantics:** today an empty result for a month triggers
  `generateSampleBalanceSheet` / `generateSampleProfitLoss`. The bulk version must preserve that
  per-month behavior (a month absent from the map ⇒ sample data), or the report output changes.
- **Category vocabulary:** BS and PL mappers currently assume different category strings
  (singular `current_asset` vs `revenue`/…). Reusing one row set is safe **only** because each
  mapper filters disjoint subsets; the human should confirm the stored `category` values actually
  match both vocabularies (a mismatch is a latent correctness bug independent of this perf change).
- **Behavior parity** of `getMonthlyTrend` / `getMultiMonthReport` after switching to the map.

---

### PERF-01-02 — Duplicate & redundant reads in `periodic-report.ts`  *(Severity: Medium)*

**Location:** `src/services/report/periodic-report.ts`

**Problem A — duplicate read per period.** `getPeriodData()` fetches the period's balances twice for
the same `(companyId, fiscalYear, month)`:
- BS read: `tx.monthlyBalance.findMany({ where:{ companyId, fiscalYear: period.fiscalYear,
  month: period.endMonth } })` — line **154–165**.
- PL read (inside `calculatePeriodPL(companyId, period.fiscalYear, period.endMonth)`):
  `tx.monthlyBalance.findMany({ where:{ companyId, fiscalYear, month } })` — line **225–236**.

These are **identical filters** (`period.endMonth` ⇒ `month`). `mapToPeriodBS` (192–218) and
`calculatePeriodPL` (220–278) consume disjoint `category` subsets of the same rows, exactly like
PERF-01-01. ⇒ **1 redundant query per period**.

**Problem B — cross-period re-reads.** Periods step backward month-by-month
(`calculatePeriods`, 101–148), and each period also calls `getPreviousMonthBS()` (280–311) for
`month-1`. For consecutive periods, period[i]'s "current month" equals period[i+1]'s "previous
month", so the same months are read multiple times across the `Promise.all` fan-out
(generatePeriodicReport, 89–91). With `includePreviousYear` the period count doubles (up to ~24).

**Problem C — serial awaits within a period.** Inside `getPeriodData`, BS → PL → previousBS are
`await`ed in sequence (154, 172, 173) even though PL does not depend on BS and previousBS does not
depend on PL.

**Proposed change (`PENDING HUMAN DETERMINATION`):**
- Minimum: make `calculatePeriodPL` accept the already-fetched `balances` array instead of
  re-querying (eliminates Problem A — 1 query/period). Within `getPeriodData`, run the previous-BS
  read concurrently with PL (`Promise.all`) since they are independent (addresses Problem C).
- Larger: pre-compute the distinct `(fiscalYear, month)` keys across all periods, issue **one**
  `findMany({ where:{ companyId, OR:[ {fiscalYear, month:{in:[…]}}, … ] } })` (or one per fiscal
  year), build a `Map<"fy|month", rows>`, and have `getPeriodData` read from it — eliminating
  Problem B too. Net: from `3 × N` queries (N = period count) down to ~1 per fiscal year involved.

**Caveats (`PENDING HUMAN DETERMINATION`):**
- Preserve the empty-balances ⇒ `generateSamplePeriodData` fallback (167–169) per period.
- Confirm category vocabularies (`mapToPeriodBS` uses `current_assets`/`fixed_assets`/…;
  `calculatePeriodPL` uses `sales`/`cost_of_sales`/… — note these differ from `monthly-report.ts`'s
  strings; the human should verify which is authoritative).

---

### PERF-01-03 — Two-query year split in `data-aggregator.ts`  *(Severity: Low)*

**Location:** `src/services/reports/business-report/data-aggregator.ts:69–100` (`getFinancialData`).

**Problem.** Current- and previous-year balances are fetched as two separate
`monthlyBalance.findMany` (lines **70–75** and **77–82**).

**Proposed change (`PENDING HUMAN DETERMINATION`):** one query with
`where: { companyId, fiscalYear: { in: [fiscalYear, fiscalYear - 1] } }`, then partition the
result by `fiscalYear` in memory (2 queries → 1). The existing `@@index([companyId, fiscalYear])`
covers both years in a single index range scan.

**Note (positive):** the rest of `data-aggregator.ts` is clean — `aggregate()` (17–51) fans out 8
single queries via `Promise.all` (concurrent), each is one `findMany` with no per-row fan-out. No
N+1 there. `getRelatedPartyData` is a stub returning `[]` (no query).

---

### PERF-01-04 — Single reads wrapped in `$transaction`  *(Severity: Low, cross-cutting)*

**Location:** pervasive — `report/monthly-report.ts`, `report/periodic-report.ts`,
`reports/board-report-service.ts`, `reports/ir-*-service.ts`, etc. Pattern:

```ts
const x = await prisma.$transaction(
  async (tx) => tx.monthlyBalance.findMany({ where: {...} }),
  { maxWait: 5000, timeout: DB_TIMEOUT_MS }
)
```

**Problem.** For a **single read-only** query this opens an interactive transaction (extra
`BEGIN`/`COMMIT` round-trips) for no consistency benefit. The cost is small per call but compounds
inside the PERF-01-01 loops (~35×) and across the periodic `Promise.all`.

**Proposed change (`PENDING HUMAN DETERMINATION`):** for genuinely single, read-only statements,
call `prisma.X.findMany(...)` directly and drop the wrapper. Keep `$transaction` only where
multiple statements actually need atomicity (e.g. `ir-report-service` `deleteIRReport` 360–366,
`duplicateIRReport` 446–505, `publishIRReport` 387–411 — these are correct as transactions).

**Caveat (`PENDING HUMAN DETERMINATION`):** the wrapper may be an intentional team policy for
uniform timeout/retry handling; the human decides whether to relax it for reads.

---

### PERF-01-05 — Missing index `User.companyId`  *(Severity: Low)*

**Location:** `prisma/schema.prisma:10–25` (`User`); consumer
`reports/business-report/data-aggregator.ts:132–138` (`getOfficerData`:
`user.findMany({ where:{ companyId, role:{ in:['ADMIN','MANAGER'] } } })`).

**Problem.** `User` declares no `@@index([companyId])` (and `companyId` is `String?`, nullable).
The officer query therefore has no index support on `companyId`.

**Proposed change (`PENDING HUMAN DETERMINATION`):** optionally add `@@index([companyId])` to
`User`. **Caveat:** user counts per company are typically tiny, so a scan may be cheaper than index
maintenance; the human decides whether the benefit justifies a migration. (This is a schema/index
observation only — schema changes are Class-A and out of scope to modify here; listed for decision.)

## 5. Read paths verified CLEAN (no action proposed)

These were audited and found to use correct eager loading / projection — no N+1, no missing
`include`/`select`:

- `reports/board-report-service.ts` — list & detail use `include: { sections: { orderBy } }`
  (141–149, 177–186); `getUpcomingPayments` is a single indexed `debt.findMany` with `take:10`
  (419–432). Proper pattern.
- `reports/ir-report-service.ts` — list uses `select` (no section over-fetch, 178–198); detail uses
  `include: { sections }` (224–236); `duplicateIRReport` reads original once with `include` then
  nested-creates sections in one transaction (446–505). Clean.
- `reports/ir-event-service.ts` — list/upcoming use `select` + `take:10` (78–94, 260–281). Clean.
- `reports/ir-shareholder-service.ts` — single `findMany` reads (64–72); `getLatestShareholderComposition`
  is a bounded 2-query pattern (latest-date probe + fetch) inside one transaction (220–241). Clean.
- `reports/ir-faq-service.ts` — list/active use `select` (56–72, 311–327); detail is `findUnique`
  (281–286). Clean.
- `reports/business-report/{content-validator,exporter,report-validator,workflow-service,index}.ts`
  — read calls are single `findUnique`/`findMany` (e.g. workflow-service 14, 59, 120, 171, 199); no
  per-row fan-out. (`workflow-service` also contains writes; writes are out of scope for this
  read-path audit.)
- `analytics/financial-kpi.ts` and `analytics/kpi.ts` — **pure calculation modules**: no `prisma`
  import, no DB calls; they compute from already-fetched `BalanceSheet`/`ProfitLoss`/`CashFlowStatement`
  arguments. `financial-kpi.ts` memoizes via an in-memory `kpiCache` (good). No query-layer concern
  here; the DB cost for KPIs is paid by the upstream callers covered in PERF-01-01.
- `reports/ir/ir-report-service.ts` — **client-side only** (`localStorage`, guarded by
  `typeof window === 'undefined'`); not a DB read path. Out of DB-scope (its `listReports` iterates
  `localStorage` keys — a client concern, not a Prisma N+1).

## 6. Index review (all conclusions `PENDING HUMAN DETERMINATION`)

Queried model → existing index → supports proposed change?

| Model | Relevant existing index(es) | Used by | Supports proposed change? |
|-------|------------------------------|---------|---------------------------|
| `MonthlyBalance` | `@@unique([companyId, fiscalYear, month, accountCode])`, `@@index([companyId, fiscalYear])` | PERF-01-01, 01-02, 01-03 | **Yes** — bulk `findMany({ companyId, fiscalYear })` is an index range scan; **no new index needed** |
| `Journal` | `@@index([companyId, entryDate])` | data-aggregator `getJournalData` | Yes (already optimal) |
| `BoardReport` / `BoardReportSection` | `@@index([companyId, fiscalYear])` / `@@index([reportId])` | board-report-service | Yes (`include: { sections }` is index-backed) |
| `IRReport` / `IRReportSection` | `@@index([companyId, fiscalYear])` / `@@index([reportId])` | ir-report-service | Yes |
| `ShareholderComposition` | `@@index([companyId, asOfDate])` | ir-shareholder-service, data-aggregator | Yes |
| `IREvent` | `@@index([companyId, scheduledDate])` | ir-event-service | Yes |
| `FAQ` | `@@index([companyId])`, `@@index([companyId, category])`, `@@index([companyId, isActive])` | ir-faq-service | Yes |
| `BoardMeeting` | `@@index([companyId, meetingDate])` | data-aggregator `getBoardMeetingData` | Yes |
| `FixedAsset` | `@@index([companyId])` | data-aggregator `getFixedAssetData` | Yes |
| `Debt` | `@@index([companyId, dueDate])`, `@@index([companyId, status])` | board-report `getUpcomingPayments` | Yes |
| `User` | **(none on `companyId`)** | data-aggregator `getOfficerData` | Optional addition — PERF-01-05 |

**Bottom line:** no new index is required to realize PERF-01-01 / 01-02 / 01-03. The one optional
index is `User.companyId` (PERF-01-05).

## 7. Suggested implementation ordering (for the human, not prescriptive)

`PENDING HUMAN DETERMINATION` — if any of this is actioned, a sensible order by impact/risk:

1. PERF-01-01 (highest impact; largest reduction; needs careful fallback-parity testing).
2. PERF-01-02 (medium impact; same class of change).
3. PERF-01-03 / PERF-01-04 (low impact, low risk).
4. PERF-01-05 (only if `users` growth warrants it).

## 8. Constraints respected

- **One file written:** `docs/proposals/perf-01.md` (this file). No source modified.
- **Class-A untouched:** all proposals that touch `prisma/schema.prisma` are explicitly framed as
  "for human decision" and were not applied (schema is Class-A / read-only reference here).
- **No approvals / no reviewers / no sign-offs** appear anywhere in this document.
- **Every conclusion is marked `PENDING HUMAN DETERMINATION`.**

---

*End of analysis — all items `PENDING HUMAN DETERMINATION`.*
