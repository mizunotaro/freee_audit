# REV-TAX-01 — Audit: Tax / Deferred-Accrual / Debt Calculation Review

| | |
|---|---|
| **Task** | REV-TAX-01 (AUDIT-ONLY, read-only) |
| **Scope read** | `src/services/tax/**`, `src/services/deferred-accrual/**`, `src/services/debt/**` (+ `prisma/schema.prisma` for the relevant models, `src/integrations/freee/client.ts`, the `tax` / `deferred-accrual` / `debt` API routes, and the existing unit tests) |
| **Date** | 2026-07-09 |
| **Source state** | branch `feature/auto/rev-tax-01`; source untouched — no source file was modified for this audit |
| **Verdict legend** | Every conclusion below is tagged **PENDING HUMAN DETERMINATION**. Nothing here is approved, signed off, or a decision. It is analysis prepared for a human reviewer. |

> **How to read this document.** Section 1 is an executive summary. Section 2 maps what is actually live vs. tests-only. Sections 3–7 are individual findings, each with evidence (`file:line` + quoted code), impact, a concrete proposed change, and a **PENDING HUMAN DETERMINATION** verdict. Section 8 proposes test vectors. Section 9 suggests a remediation ordering. The statutory assumptions relied on are collected in Section 10 and are themselves **PENDING HUMAN DETERMINATION** — they must be confirmed by a qualified Japanese tax/accounting reviewer before any code change.

---

## 1. Executive summary

The three subsystems are thin CRUD/scheduling layers with embedded Japanese tax-statutory date logic and accrual/prepaid heuristics. They are broadly functional for record-keeping but contain **one runtime-failing defect**, **several materially wrong calculations**, and a **large tests-only surface** whose heuristics never execute in production. The six highest-impact conclusions (all **PENDING HUMAN DETERMINATION**):

1. **`generateDefaultTaxSchedules` cannot persist its withholding schedules against the real database.** It inserts two `withholding` rows for the same `(companyId, taxType, fiscalYear)`, but `TaxSchedule` carries `@@unique([companyId, taxType, fiscalYear])` (`schema.prisma:517`). The second `create` throws `P2002` at runtime. The unit test is fake-green because the mock does not enforce the constraint. See §3.1.

2. **Every generated due date is ~12 months too late.** `new Date(year + 1, fiscalYearEndMonth + 2, 1)` double-counts the year roll: the `+2` month offset already rolls the year forward via JS `Date` overflow, so the extra `year + 1` shifts corporate / depreciation / consumption / withholding dates by exactly one year (verified: Dec FY 2024 → code yields 2026-03-01, statutory 2025-03-01). See §3.2.

3. **Cash-out forecasts silently exclude overdue (past-due) debts** — the most urgent ones. `getCashOutForecasts` and `getTotalUpcomingCashOut` filter `dueDate: { gte: new Date() }`, so any debt whose due date has passed is dropped, and the `urgency === 'OVERDUE' → high` branch is dead at runtime. The unit test is fake-green because the mock returns the row regardless of the `where` clause. See §5.1.

4. **`syncDebtsFromFreee` fetches by *issue* date, not *due* date**, so it asks freee for deals issued between now and now+6 months (mostly future → near-empty) and misses historically-issued payables that are due soon. Paid-off debts are also never transitioned to `PAID` (settled deals are `continue`-skipped), so stale `PENDING`/`OVERDUE` rows persist. See §5.2–5.3.

5. **Prepaid amortization has a rounding-drift bug and no input validation.** `monthlyAmount = Math.round(originalAmount / totalMonths)` means `Σ monthlyAmount` need not equal `originalAmount` (verified: ¥1000 / 3 → 333 × 3 = 999, drift ¥1), so `remainingAmount` never reaches 0 and the schedule never becomes `FULLY_AMORTIZED`. `totalMonths ≤ 0` stores `Infinity` (verified). See §4.1–4.2.

6. **The "intelligence" methods on both trackers are dead in production.** `detectAccrualExpensesFromJournals`, `matchPaymentsWithAccruals`, `checkPaymentStatus`, `checkAnomalies`, `recordPayment`, `detectPrepaidExpensesFromJournals`, `recordAmortization`, `checkAmortizationSchedule`, `generateAmortizationEntries` have **no route or job consumer** — only the unit tests call them. See §2.

---

## 2. Subsystem map — what is actually live

### 2.1 Live HTTP surface

| Service method | Route caller | Live? |
|---|---|---|
| `TaxService.getTaxSchedules` | `GET /api/tax/schedules` | Yes |
| `TaxService.getTaxScheduleById` | `GET /api/tax/schedules/[id]` (+ ownership verify) | Yes |
| `TaxService.createTaxSchedule` | `POST /api/tax/schedules` | Yes |
| `TaxService.updateTaxSchedule` | `PUT /api/tax/schedules/[id]` | Yes |
| `TaxService.deleteTaxSchedule` | `DELETE /api/tax/schedules/[id]` | Yes |
| `TaxService.createTaxPayment` / `getTaxPayments` | `POST/GET /api/tax/schedules/[id]/payments` | Yes |
| `TaxService.generateDefaultTaxSchedules` | `POST /api/tax/generate` | Yes (defective — §3.1, §3.2) |
| `PrepaidExpenseTracker.get/getActive/create` | `GET/POST /api/deferred-accrual/prepaid` | Yes |
| `AccrualExpenseTracker.get/getUnpaid/create` | `GET/POST /api/deferred-accrual/accrual` | Yes |
| `syncDebtsFromFreee` / `getCashOutForecasts` / `getMonthlyCashOutSummary` | `GET /api/debt/forecast` (actions forecast/monthly/sync) | Yes |
| `getTotalUpcomingCashOut` | — | **No route consumer found** |

### 2.2 Tests-only / dead surface (no `src` or `jobs` caller)

A repository-wide search for the method names returns matches **only inside the two tracker files and `tests/unit/services/deferred-accrual/trackers.test.ts`** — no API route, no `src/jobs/scheduler.ts`, no other service imports them:

| Method | File | Wired? |
|---|---|---|
| `PrepaidExpenseTracker.recordAmortization` | `prepaid-expense-tracker.ts:119` | tests only |
| `PrepaidExpenseTracker.checkAndUpdateStatus` | `:159` | called only by `recordAmortization` (itself tests-only) |
| `PrepaidExpenseTracker.checkAmortizationSchedule` | `:174` | tests only |
| `PrepaidExpenseTracker.detectPrepaidExpensesFromJournals` | `:210` | tests only |
| `PrepaidExpenseTracker.generateAmortizationEntries` | `:268` | tests only |
| `PrepaidExpenseTracker.calculateMonthlyAverage` | `:249` | **no caller at all** (dead) |
| `AccrualExpenseTracker.recordPayment` | `accrual-expense-tracker.ts:80` | tests only |
| `AccrualExpenseTracker.checkPaymentStatus` | `:97` | tests only |
| `AccrualExpenseTracker.detectAccrualExpensesFromJournals` | `:126` | tests only |
| `AccrualExpenseTracker.checkAnomalies` | `:161` | tests only |
| `AccrualExpenseTracker.matchPaymentsWithAccruals` | `:180` | tests only |

**Implication.** The entire auto-detection / payment-matching / anomaly / amortization-suggestion layer of the deferred-accrual subsystem is inert in the running system; only manual create/get is reachable. The defects in §4 that live in these methods therefore do not affect production *today*, but they will activate the moment a job or route is wired to them. **PENDING HUMAN DETERMINATION** whether this is intended phasing or an integration gap.

---

## 3. Findings — Tax Service (`src/services/tax/tax-service.ts`)

### 3.1 Withholding generation violates the unique constraint (runtime P2002) — **critical**

**Evidence.** `generateDefaultTaxSchedules` builds two `withholding` schedules for the same year:

```ts
// tax-service.ts:144-173
if (withholdingSpecialRule) {
  ...
  schedules.push({ companyId, taxType: 'withholding', fiscalYear: year, dueDate: firstPeriodDueDate,  ... })
  schedules.push({ companyId, taxType: 'withholding', fiscalYear: year, dueDate: secondPeriodDueDate, ... })
} else {
  const withholdingDueDates = [5, 11]
  withholdingDueDates.forEach((month) => {
    schedules.push({ companyId, taxType: 'withholding', fiscalYear: year, dueDate: new Date(year + 1, month, 10), ... })
  })
}
...
return Promise.all(schedules.map((s) => this.createTaxSchedule(s)))   // :193
```

But `TaxSchedule` has `@@unique([companyId, taxType, fiscalYear])` (`schema.prisma:517`). Both rows share `taxType: 'withholding'` and `fiscalYear: year`, so the second `prisma.taxSchedule.create` raises `PrismaClientKnownRequestError` (code `P2002`) and `Promise.all` rejects. `POST /api/tax/generate` (`tax/generate/route.ts:36-43`) has no try/catch around uniqueness and returns 500. The unit test `should generate default schedules without withholding special rule` asserts `result.filter((s) => s.taxType === 'withholding').length).toBe(2)` (`tax-service.test.ts:380`) — it passes only because the mocked `create` does not enforce the constraint.

**Impact.** Generating a full default tax schedule set for any company fails halfway: the corporate/depreciation/consumption rows are created, then the second withholding insert throws, leaving a partial set and a 500 to the caller. Re-invoking then also trips §3.6 (non-idempotent).

**Proposed change (concrete).** Either (a) make `taxType` period-specific (`'withholding_h1'` / `'withholding_h2'`) so each row is unique under the existing key; or (b) extend the unique key to include a period discriminator (e.g., `@@unique([companyId, taxType, fiscalYear, dueDate])` or a new `period` column) — note `schema.prisma` is a Class-A path for this task, so any schema change is a separate, explicitly-scoped future task; or (c) collapse the two withholding rows into a single schedule with sub-rows. **PENDING HUMAN DETERMINATION** on the preferred model.

### 3.2 All generated due dates are ~12 months late — **high**

**Evidence.** Corporate, depreciation, and consumption all use:

```ts
// tax-service.ts:135  (also :175, :184)
const corporateDueDate = new Date(year + 1, fiscalYearEndMonth + 2, 1)
```

JS `Date` month-index is 0-based and rolls over, so the `+2` already advances the year when `fiscalYearEndMonth + 2 > 11`. The additional `year + 1` therefore shifts the result by exactly 12 months. Verified with Node (local dates):

| Input | Code produces | Statutory (2-month rule) |
|---|---|---|
| `fiscalYearEndMonth=12, fiscalYear=2024` (Dec FY-end) | `2026-03-01` | `2025-03-01` |
| `fiscalYearEndMonth=3, fiscalYear=2024` (Mar FY-end) | `2025-06-01` | `2024-06-01` |

Withholding is affected identically — special-rule branch:

```ts
// tax-service.ts:145, :153
const firstPeriodDueDate  = new Date(year + 1, 6, 10)   // produces Jul 10 of year+1 ; want Jul 10 of year
const secondPeriodDueDate = new Date(year + 2, 0, 20)   // produces Jan 20 of year+2 ; want Jan 20 of year+1
```

**Impact.** Every default tax schedule reminds the user of a deadline one year too late. For a Dec-2024 FY-end, corporate tax is shown due 2026-03-01 instead of 2025-03-01 — the real deadline has already passed by the time the reminder fires.

**Proposed change (concrete).** Drop the `+1`/`+2` on the year and let the month offset carry the rollover: `new Date(year, fiscalYearEndMonth + 2, 1)` for corporate/depreciation/consumption; `new Date(year, 6, 10)` and `new Date(year + 1, 0, 20)` for the two withholding periods. The exact expression depends on the intended semantics of `fiscalYear` (year of FY-end vs. year of FY-start) and of `fiscalYearEndMonth` (1-indexed vs. 0-indexed) — see §10. **PENDING HUMAN DETERMINATION** on the indexing convention before changing the expression.

### 3.3 償却資産税 (depreciation tax) due date is computed from fiscal-year-end, but the statutory deadline is a fixed calendar date — **high**

**Evidence.**

```ts
// tax-service.ts:175
const depreciationDueDate = new Date(year + 1, fiscalYearEndMonth + 2, 1)   // same as corporate
```

**Impact.** 償却資産税の申告書提出期限 is fixed by each municipality (commonly **5月31日**, based on the price as of January 1), independent of the company's fiscal year. Tying it to `fiscalYearEndMonth + 2` (and with the §3.2 year bug, landing a year late) gives the wrong date for essentially every company. Combined with §3.2 the depreciation reminder is both wrong-basis and one year late.

**Proposed change (concrete).** Set the depreciation schedule's due date to a configurable fixed date (default May 31 of the year following the fiscal year), overridable per municipality. **PENDING HUMAN DETERMINATION** on the exact municipality-specific deadline to encode.

### 3.4 Non-special withholding generates 2 schedules where monthly filing requires 12 — **medium**

**Evidence.**

```ts
// tax-service.ts:162-172
const withholdingDueDates = [5, 11]
withholdingDueDates.forEach((month) => {
  const dueDate = new Date(year + 1, month, 10)   // Jun 10, Dec 10 (of year+1, per §3.2)
  schedules.push({ ..., taxType: 'withholding', ... })
})
```

Without 納期の特例, 源泉徴収税 is filed/paid **monthly** — the 10th of the following month (12 payments/year). The branch instead emits two semi-annual-looking dates (Jun 10 / Dec 10). The 納期の特例 (special-rule) branch also emits two dates (Jul 10 / Jan 20), so the two branches differ only in dates, not in cadence — the non-special branch is semantically wrong.

**Impact.** A company not on the special rule is reminded of only 2 of its 12 withholding due dates.

**Proposed change (concrete).** For the non-special branch, generate 12 monthly schedules (10th of each following month), subject to the §3.1 uniqueness fix (period discriminator or monthly key). **PENDING HUMAN DETERMINATION** on whether the product intends monthly granularity or a summarized cadence.

### 3.5 `createTaxPayment` can never auto-close schedules created by `generateDefaultTaxSchedules` — **high**

**Evidence.**

```ts
// tax-service.ts:96-106
const totalPaid = await this.getTotalPaidAmount(data.taxScheduleId)
const schedule  = await prisma.taxSchedule.findUnique({ where: { id: data.taxScheduleId } })
if (schedule && schedule.amount && totalPaid >= schedule.amount) {   // :101
  await prisma.taxSchedule.update({ where: { id: data.taxScheduleId },
    data: { status: 'PAID', paidDate: data.paymentDate } })
}
```

`generateDefaultTaxSchedules` creates schedules with **no `amount`** (`tax-service.ts:136-191` omits `amount` → column default `null`, `schema.prisma:508` is `Float?`). In the guard, `schedule.amount` is `null` → falsy → the condition short-circuits and the schedule is never marked `PAID`, regardless of how much has been paid.

**Impact.** Any schedule produced by the generator stays `PENDING` forever even after full payment, unless an operator manually sets `amount` first (the API has no flow that back-fills `amount` from payments).

**Proposed change (concrete).** Decide the intended semantics of a null `amount` (unknown total vs. open-ended). Either (a) require `amount` to be set before auto-close is attempted, surfacing a clear "amount unknown — close manually" state; or (b) add an explicit `closeManually` path; or (c) have the generator prompt for/derive the amount. **PENDING HUMAN DETERMINATION** on the intended payment-tracking model.

### 3.6 `generateDefaultTaxSchedules` is not idempotent — **medium**

**Evidence.** `POST /api/tax/generate` (`tax/generate/route.ts:30-43`) calls `generateDefaultTaxSchedules` unconditionally; the service does `create` (not `upsert`) for each schedule. Because of `@@unique([companyId, taxType, fiscalYear])`, a second invocation for the same year throws `P2002` on `corporate` (already exists) → 500.

**Impact.** Users who click "generate" twice, or re-generate after a partial failure (e.g. the §3.1 withholding crash), get a 500 and no clear recovery.

**Proposed change (concrete).** Make generation idempotent: check-for-existing or `upsert` per `(companyId, taxType, fiscalYear[, period])`, and return a "already exists / skipped" result rather than throwing. **PENDING HUMAN DETERMINATION** on whether re-generation should overwrite or no-op.

### 3.7 `createTaxPayment` is not transactional — **medium**

**Evidence.** `tax-service.ts:85-106` performs `taxPayment.create` → `getTotalPaidAmount` (a separate `findMany`) → `taxSchedule.update` as three independent queries with no `prisma.$transaction`.

**Impact.** Concurrent payments on the same schedule race on `totalPaid`: two payments can each read a sub-threshold total and both skip the `PAID` transition, or interleave such that `paidDate` is set from a stale payment. The sum-then-update is also a classic read-modify-write hazard.

**Proposed change (concrete).** Wrap the three steps in `prisma.$transaction`, and prefer a conditional update (`updateMany` with a `where` that checks the summed threshold) or a SQL-level `UPDATE ... WHERE (SELECT SUM ...) >= amount` to make the close atomic. **PENDING HUMAN DETERMINATION** on the isolation level needed.

### 3.8 Service methods take only `id` (no company scoping) — **low**

**Evidence.** `getTaxScheduleById`, `updateTaxSchedule`, `deleteTaxSchedule`, `createTaxPayment` accept only the entity `id` (`tax-service.ts:51, 71, 78, 84`). The HTTP routes compensate via `verifyScheduleOwnership` (`tax/schedules/[id]/route.ts:11-14, 47, 74`; `.../payments/route.ts:42`), so there is **no IDOR at the route layer today**.

**Impact.** Any future non-route caller (job, service-to-service call) bypasses the ownership check.

**Proposed change (concrete).** Add an optional `companyId` parameter to these service methods that, when provided, is included in the `where` (defense-in-depth). **PENDING HUMAN DETERMINATION** on whether to push scoping into the service.

### 3.9 `updateTaxSchedule` passes data through with no validation — **low**

**Evidence.** `tax-service.ts:71-76` forwards `data` straight to `prisma.update` with no status/value validation. `status` is a free `String` in the route body (`tax/schedules/[id]/route.ts:52, 54-58`) — any string is accepted; `PAID` without `paidDate` is allowed; `FILED`→`PENDING` regressions are allowed.

**Proposed change (concrete).** Validate `status ∈ {'PENDING','FILED','PAID'}` and enforce `filedDate`/`paidDate` consistency with the status (e.g. `PAID` requires `paidDate`). **PENDING HUMAN DETERMINATION** on the state machine to enforce.

### 3.10 `getTotalPaidAmount` sums in JS — **low**

**Evidence.** `tax-service.ts:118-124` loads all payment rows and `reduce`s. A `prisma.taxPayment.aggregate({ _sum: { amount } })` would push the work to the DB. Minor, but relevant for schedules with many payments.

**Proposed change (concrete).** Replace with `_sum` aggregate. **PENDING HUMAN DETERMINATION** (cosmetic).

### 3.11 No audit logging of tax payment / status changes — **info**

**Evidence.** Neither the service nor the `tax/schedules/[id]/payments/route.ts` import or call `auditLogger`/`logRouteAudit`. Tax payments are financial events that the project's audit-trail policy (blockchain-chained `AuditLog`) would normally capture.

**Proposed change (concrete).** Add route-level audit logging via `logRouteAudit()` for payment creation and status transitions. **PENDING HUMAN DETERMINATION** on scope (consistent with the broader outstanding route-audit work noted in project memory).

---

## 4. Findings — Deferred-Accrual: Prepaid (`src/services/deferred-accrual/prepaid-expense-tracker.ts`)

> All methods in this section are tests-only today (§2.2); defects activate when wired.

### 4.1 Rounding drift prevents full amortization — **high**

**Evidence.**

```ts
// prepaid-expense-tracker.ts:85
const monthlyAmount = Math.round(data.originalAmount / data.totalMonths)
```

`Math.round` per month means `monthlyAmount × totalMonths` need not equal `originalAmount`. Verified: ¥1000 / 3 → `monthlyAmount = 333`, `333 × 3 = 999`, drift ¥1. `checkAndUpdateStatus` only flips to `FULLY_AMORTIZED` when `remainingAmount <= 0` (`:166`), and `recordAmortization` subtracts `actualAmount` (typically `monthlyAmount`) from `remainingAmount` (`:150`). With drift, `remainingAmount` bottoms out at the drift (e.g. ¥1) and the schedule never reaches `FULLY_AMORTIZED`.

**Impact.** A fully-amortized prepaid lingers as `ACTIVE` with a tiny residual; the residual is never reconciled to ¥0.

**Proposed change (concrete).** Make the final period absorb the remainder: `monthlyAmount = Math.round(original / months)` for months `1..n-1`, and `lastMonthAmount = original - monthlyAmount × (n-1)`; or track `cumulativeAmortized` vs `originalAmount` and close on equality. `generateAmortizationEntries`/`recordAmortization` must use the period-correct amount. **PENDING HUMAN DETERMINATION** on the rounding convention (round-half-up vs. bankers; which period absorbs drift).

### 4.2 No input validation; `totalMonths ≤ 0` stores `Infinity` — **high**

**Evidence.** `createPrepaidExpense` (`:84-103`) performs no validation. `Math.round(data.originalAmount / data.totalMonths)` with `totalMonths = 0` yields `Math.round(Infinity) = Infinity` (verified); negative `totalMonths` yields a negative `monthlyAmount`. There is also no check that `originalAmount > 0` or `endDate >= startDate`. `updatePrepaidExpense` (`:110`) recomputes `monthlyAmount` only when **both** `originalAmount && totalMonths` are truthy, so a partial update can persist `Infinity`/`NaN` or a stale monthly amount.

**Impact.** A bad input (e.g. `totalMonths: 0` from a form default) persists a nonsensical `monthlyAmount`; downstream amortization and remaining-amount math corrupt.

**Proposed change (concrete).** Validate at creation and on update: `totalMonths >= 1`, `originalAmount > 0`, `endDate >= startDate`; return a `failure(Result)` (the project's `Result<T,E>` pattern) rather than persisting. Recompute derived fields whenever either of `originalAmount`/`totalMonths` changes. **PENDING HUMAN DETERMINATION** on whether to validate in the service or via a Zod schema at the route.

### 4.3 `recordAmortization` is not transactional / not idempotent — **medium**

**Evidence.** `:119-157` runs `prepaidAmortization.create` → `prepaidExpense.update` (remaining) → `checkAndUpdateStatus` as separate queries. `PrepaidAmortization` has `@@unique([prepaidId, year, month])` (`schema.prisma:836`), so a duplicate call for the same period throws `P2002` (no `upsert`). Concurrent `recordAmortization` calls on the same prepaid race on `prepaid.remainingAmount` (lost update — both read the same base).

**Proposed change (concrete).** Wrap in `prisma.$transaction` (read `prepaid` inside the tx); use `upsert` for the amortization row; or pre-check existence. **PENDING HUMAN DETERMINATION** on the concurrency expectation.

### 4.4 Over-amortization is unguarded and mis-labeled — **medium**

**Evidence.** `:133` `const status = actualAmount >= prepaid.monthlyAmount ? 'completed' : 'partial'` — an `actualAmount` greater than `monthlyAmount` (or greater than `remainingAmount`) is marked `completed`, and `:150` subtracts it from `remainingAmount`, which can go **negative**. The `AmortizationCheckResult.status` type declares `'over_amortized'` (`:51`), but no code path ever sets it (in `recordAmortization` or `checkAmortizationSchedule`).

**Impact.** Over-payment silently drives `remainingAmount` negative and reports `completed`; the `'over_amortized'` status is dead.

**Proposed change (concrete).** Cap `actualAmount` at `remainingAmount` (or flag `'over_amortized'` when `actualAmount > monthlyAmount`/`> remainingAmount`); reconcile `remainingAmount` to a floor of 0. **PENDING HUMAN DETERMINATION** on whether over-amortization should be an error or a flagged state.

### 4.5 `checkAndUpdateStatus` never flags expired-but-under-amortized prepaids — **medium**

**Evidence.** `:159-172` only transitions to `FULLY_AMORTIZED` when `remainingAmount <= 0`. A prepaid whose `endDate` has passed but `remainingAmount > 0` (under-amortized / missed months) stays `ACTIVE` indefinitely.

**Proposed change (concrete).** Add a branch: `endDate < now && remainingAmount > 0` → a status such as `'OVERDUE'` / `'UNDER_AMORTIZED'`. **PENDING HUMAN DETERMINATION** on the status name and whether to auto-generate catch-up entries.

### 4.6 `updatePrepaidExpense` can leave derived fields inconsistent and can mutate `companyId` — **medium**

**Evidence.** `:109` `const updateData: any = { ...data }` spreads the full `Partial<PrepaidExpenseInput>` (which includes `companyId`) into the update — a caller could change company ownership. `:110` recomputes `monthlyAmount` only when both `originalAmount && totalMonths` are present, and never recomputes `remainingAmount` against the new total.

**Proposed change (concrete).** Allowlist updatable fields (drop `companyId`); recompute `monthlyAmount` whenever `originalAmount` or `totalMonths` changes; reconcile `remainingAmount = originalAmount − Σ existing amortizations`. **PENDING HUMAN DETERMINATION** on whether updating `originalAmount` post-amortization is even allowed.

### 4.7 `detectPrepaidExpensesFromJournals` is an unbounded in-memory scan — **medium**

**Evidence.** `:213-218` `prisma.journal.findMany({ where: { companyId } })` (no date range, no `limit`, `orderBy entryDate desc`) loads the **entire** journal history into memory, then `:220-222` filters in JS by `PREPAID_ACCOUNT_PATTERNS.some(p => j.debitAccount.includes(p))`.

**Impact.** For a company with a large journal table this is unbounded memory and DB load; the DB filter is pushed client-side.

**Proposed change (concrete).** Add a date window and `limit`; push the pattern match into the Prisma `where` (an `OR` of `debitAccount: { contains: p }`). **PENDING HUMAN DETERMINATION** on the detection window.

### 4.8 Month extraction heuristic is fragile — **low**

**Evidence.** `extractMonthsFromDescription` (`:257-266`) matches `/(\d+)[ヶカ月]/` or the literals `年間`/`1年` → 12, else 1. It misses `半年` (6), `四半期`, English ("12 months"), and any free-text variant; `originalAmount` is set to the full `journal.amount` (may include tax or multiple bundled items). Only `months > 1` create a prepaid (`:228`).

**Proposed change (concrete).** Document the limitation and require a structured months input on the create flow, or expand the regex set. **PENDING HUMAN DETERMINATION** on whether detection should remain heuristic.

### 4.9 `calculateMonthlyAverage` is dead and misnamed — **low**

**Evidence.** `:249-255` has no caller anywhere (§2.2). It aggregates `_avg` of `amount` over **all** journals (not per month) with a `1000000` magic-number fallback.

**Proposed change (concrete).** Remove it, or wire and rename it. **PENDING HUMAN DETERMINATION** (housekeeping).

---

## 5. Findings — Debt Service (`src/services/debt/debt-service.ts`)

### 5.1 Cash-out forecasts exclude overdue debts (fake-green test) — **high**

**Evidence.**

```ts
// debt-service.ts:109-127
const startDate = new Date()                       // now
const endDate = new Date()
endDate.setMonth(endDate.getMonth() + monthsAhead)
const debts = await prisma.debt.findMany({
  where: { companyId, dueDate: { gte: startDate, lte: endDate },   // :116  gte: now
           status: { in: ['PENDING', 'OVERDUE'] } },
  orderBy: { dueDate: 'asc' },
})
```

`dueDate: { gte: new Date() }` drops every debt whose due date is in the past — i.e. the overdue ones. The urgency logic then has:

```ts
// debt-service.ts:134-135
if (daysUntilDue <= 7 || debt.status === 'OVERDUE') { urgency = 'high' }
```

The `debt.status === 'OVERDUE'` branch is **dead at runtime**: a real OVERDUE row has `dueDate < now` and is filtered out by `gte`. The test `should calculate urgency as high for overdue debts` (`debt-service.test.ts:331-351`) is fake-green — it mocks `prisma.debt.findMany` to **return** the past-due row regardless of the `where` clause, so the filter never runs.

**Impact.** The single most actionable items (already-overdue payables) are absent from `/api/debt/forecast?action=forecast` and from the default combined response. Cash planning understates immediate obligations.

**Proposed change (concrete).** Remove the `gte: now` lower bound (keep only `lte: endDate`), or union overdue explicitly (`dueDate < now OR dueDate BETWEEN now AND endDate`); preserve the `OVERDUE → high` urgency. The same fix applies to `getTotalUpcomingCashOut` (§5.2). **PENDING HUMAN DETERMINATION** on whether to cap the look-back for how-far-overdue to show.

### 5.2 `getTotalUpcomingCashOut` excludes overdue — **high**

**Evidence.** `:185-200` uses the same `dueDate: { gte: new Date(), lte: endDate }` (`:193`) with `status in ['PENDING','OVERDUE']`. Past-due debts are excluded from the "next N days" total. (Also: this function has **no route consumer** — §2.1.)

**Proposed change (concrete).** Include overdue in the total (or expose a separate `getOverdueTotal`). **PENDING HUMAN DETERMINATION** on presentation (combined vs. split).

### 5.3 `syncDebtsFromFreee` filters by issue date, not due date — **high**

**Evidence.**

```ts
// debt-service.ts:43-47
const startDate = new Date()                       // now
const endDate = new Date()
endDate.setMonth(endDate.getMonth() + monthsAhead)
const result = await freeeClient.getDeals(freeeCompanyId, startDate, endDate)
```

`freeeClient.getDeals` passes these as `start_issue_date` / `end_issue_date` (`src/integrations/freee/client.ts:243-244`), i.e. the API filters by **issue date**. The sync therefore asks for deals *issued* between now and now+6months — but deals are issued in the past, not the future, so the window captures almost nothing, and historically-issued invoices with upcoming due dates are not fetched at all.

**Impact.** The debt forecast feed is starved of real payables; the sync appears to "work" (mock returns 5 sample deals) but against live freee it returns a near-empty set for the upcoming window.

**Proposed change (concrete).** Widen the issue-date window backward (e.g., 12–24 months back to now) and filter by `due_date` client-side, or — if the freee API version supports due-date filtering — switch to a due-date-bounded fetch. **PENDING HUMAN DETERMINATION** on which freee API params are available for the integrated plan.

### 5.4 Paid-off debts never transition to `PAID`; `paymentDate` never written — **high**

**Evidence.**

```ts
// debt-service.ts:56-91
if (!deal.due_date || deal.due_amount <= 0) continue   // :57  settled deals skipped entirely
...
await prisma.debt.upsert({ where: { id: `${companyId}-${deal.id}` },
  update: { ..., amount: deal.due_amount, dueDate, status, category },   // no paymentDate; no PAID
  create: { ..., amount: deal.due_amount, dueDate, status, category },
})
```

A deal whose `due_amount` reached 0 is `continue`-skipped, so its existing `Debt` row is never upserted to `PAID` and `Debt.paymentDate` (`schema.prisma:490`) is never written by any code path. The `deal.payments` array (`FreeeDeal.payments`, `client.ts:55-60`) is ignored. Stale `PENDING`/`OVERDUE` rows therefore persist and keep surfacing in forecasts (compounding §5.1/§5.2).

**Impact.** Paid invoices remain on the cash-out forecast; the forecast overstates obligations and never shows a debt as paid.

**Proposed change (concrete).** On sync, do not `continue` on `due_amount <= 0`; instead upsert the row with `status: 'PAID'`, `paymentDate` derived from the latest entry in `deal.payments` (or `deal.due_date` when fully settled). Reconcile existing rows whose deal is now settled. **PENDING HUMAN DETERMINATION** on the paid-state source of truth (freee `status` vs. `due_amount === 0` vs. `payments`).

### 5.5 `freeeClient.getDeals` does not paginate — **medium**

**Evidence.** `src/integrations/freee/client.ts:228-260` issues a single `fetch` with no `limit`/`offset` loop; it returns `data.deals || []` (`:259`). The freee deals API caps results per page; companies with many unsettled deals are truncated. (This mirrors the non-paginated data-sync truncation pattern noted elsewhere in the project.)

**Proposed change (concrete).** Loop with `limit`/`offset` (or follow `next_cursor` if the API version supports it) until exhausted. **PENDING HUMAN DETERMINATION** on the page-size and cap.

### 5.6 Timezone handling in date parse, urgency, and month grouping — **medium**

**Evidence.**
- `:59` `const dueDate = new Date(deal.due_date)` parses `'YYYY-MM-DD'` as **UTC midnight**; `:60` `isOverdue = dueDate < new Date()` compares against local `now`. On a JST server a due_date of "today" becomes `today 09:00 JST` and can read as overdue before the day ends (and is excluded by the §5.1 `gte: now` window earlier in the day).
- `:131` `Math.ceil((dueDate - now) / dayMs)` mixes the UTC-parsed due date with local `now`.
- `:163` `forecast.date.toISOString().slice(0, 7)` groups by **UTC** YYYY-MM; a JST due date near month-end can roll into the next UTC month.

**Proposed change (concrete).** Parse date-only strings in a fixed timezone (or as local noon) and do date-only comparisons; group months in the same timezone. **PENDING HUMAN DETERMINATION** on the canonical timezone (assume Asia/Tokyo).

### 5.7 `getMonthlyCashOutSummary` category bucket can become `NaN` — **medium**

**Evidence.** `:173` `existing.categories[forecast.category as keyof typeof existing.categories] += forecast.amount`. If `forecast.category` is any string other than `'payable'`/`'loan'`/`'other'` (possible because `Debt.category` is a free `String`), the indexed value is `undefined`, and `undefined += amount` yields `NaN`, poisoning that bucket (though `totalAmount` stays correct). `determineDebtCategory` only returns the three expected values, but a legacy/foreign row could carry another category.

**Proposed change (concrete).** Default unknown categories into `'other'` (or guard with `if (cat in existing.categories)`). **PENDING HUMAN DETERMINATION** (robustness).

### 5.8 `determineDebtCategory` inspects only the first detail line — **low**

**Evidence.** `:205-217` reads only `deal.details[0]?.account_item_name`. Multi-line deals (e.g. an invoice with both 買掛金 and a 借入 line) are categorized by the first line only. `.toLowerCase()` is a no-op for the Japanese keywords. `社債`, `リース`, `預り金` are not recognized (fall to `'other'`).

**Proposed change (concrete).** Inspect all `details` (vote or pick the largest `amount`), and expand the keyword set. **PENDING HUMAN DETERMINATION** on the category taxonomy.

### 5.9 `Debt.paymentDate` is a dead column; `description` truncates multi-line deals — **low**

**Evidence.** `Debt.paymentDate` (`schema.prisma:490`) is never written (§5.4). `:72`/`:84` `description: deal.details[0]?.description || null` captures only the first detail's description.

**Proposed change (concrete).** Either populate `paymentDate` (per §5.4) or drop the column; capture a joined description for multi-line deals. **PENDING HUMAN DETERMINATION** (schema is Class-A — separate task).

### 5.10 `imported` counts attempts; loop aborts on first error — **low**

**Evidence.** `:91` `imported++` counts upserts attempted (not confirmed); a single `upsert` throw aborts the loop and the outer `catch` returns `success: false, imported: 0` (`:95-101`), discarding partial progress.

**Proposed change (concrete).** Continue-on-error with a `failures` count, or wrap the batch in a transaction. **PENDING HUMAN DETERMINATION** on all-or-nothing vs. best-effort.

---

## 6. Findings — Deferred-Accrual: Accrual (`src/services/deferred-accrual/accrual-expense-tracker.ts`)

> All methods in this section are tests-only today (§2.2).

### 6.1 `checkPaymentStatus` payment-term lookup almost never matches — **medium**

**Evidence.** `:108` `const expectedPaymentDays = this.TYPICAL_PAYMENT_TERMS[accrual.accountName] || 30`. `TYPICAL_PAYMENT_TERMS` (`:40-47`) is keyed by exact account names (`未払賃金`, `未払給料`, …). But `detectAccrualExpensesFromJournals` sets `accountName = journal.creditAccount` (`:149`) — the full credit-account string, which rarely equals the exact key. So detected accruals almost always fall back to 30 days.

**Proposed change (concrete).** Match by prefix/`includes` against the pattern list, or store a normalized account category on the accrual row. **PENDING HUMAN DETERMINATION** on the matching strategy.

### 6.2 Detection sets `expectedAmount === actualAmount`, making the anomaly detector inert — **medium**

**Evidence.** `:151-152` sets `expectedAmount: journal.amount, actualAmount: journal.amount`. `checkAnomalies` (`:169-172`) flags items where `|actual − expected| / expected > 0.1`. Because detected items start with `actual === expected`, their variance ratio is 0 and they are never flagged unless `actualAmount` is later mutated (no flow does so).

**Proposed change (concrete).** Leave `actualAmount` null/0 until a payment/invoice is reconciled (so expected vs. actual diverge meaningfully), or redefine the two fields' semantics. **PENDING HUMAN DETERMINATION** on the intended expected/actual model.

### 6.3 `matchPaymentsWithAccruals` only matches the immediately-prior month — **medium**

**Evidence.** `:186-187` computes `previousMonth`/`previousYear` and `:204` only considers accruals from that single prior month. A payment delayed by more than one month never matches its accrual, which then stays `ACCRUED` forever (false "unpaid").

**Proposed change (concrete).** Match against all unpaid accruals within a configurable lookback window, oldest-first. **PENDING HUMAN DETERMINATION** on the window length.

### 6.4 Payment matching has side effects in-loop, is not transactional, and can double-assign a journal — **medium**

**Evidence.** `:203-218` calls `this.recordPayment(...)` (`:212`) inside the loop; not wrapped in a transaction. `:205-209` matches by `j.debitAccount === accrual.accountName && Math.abs(j.amount − accrual.actualAmount) < 1000` using `find` (first match). If two accruals share the same account name and amount, the same payment journal can satisfy both (no mark-as-consumed), and a mid-loop failure leaves partial matches.

**Proposed change (concrete).** Wrap in `prisma.$transaction`; match 1:1 and mark consumed journals (or journals by id) to prevent double-assignment; hard-coded ¥1000 tolerance should be configurable. **PENDING HUMAN DETERMINATION** on the matching uniqueness key.

### 6.5 `PaymentCheckResult.status` has dead values — **low**

**Evidence.** The type (`:23`) includes `'paid' | 'anomaly'`, but `checkPaymentStatus` only ever returns `'overdue' | 'accrued'` (`:118`).

**Proposed change (concrete).** Align the type with behavior (drop `'paid'`/`'anomaly'`) or implement them. **PENDING HUMAN DETERMINATION** (housekeeping).

### 6.6 `recordPayment` is not idempotent and has no status guard — **low**

**Evidence.** `:80-95` unconditionally sets `status: 'PAID'` and overwrites `paymentYear`/`paymentMonth`/`paymentJournalId`. Re-calling on an already-PAID accrual silently overwrites prior payment info.

**Proposed change (concrete).** Guard on `status === 'ACCRUED'` (or accept an explicit override). **PENDING HUMAN DETERMINATION**.

### 6.7 Detection `contains: '未払'` over/under-matches — **low**

**Evidence.** `:138` `creditAccount: { contains: '未払' }` catches `未払費用`/`未払金`/`未払税金` but also any incidental credit containing the substring; it misses `預り金` (源泉預り金) and other accrued-liability accounts.

**Proposed change (concrete).** Drive detection from account codes/categories (freee `account_category`) rather than name substring. **PENDING HUMAN DETERMINATION**.

---

## 7. Cross-cutting findings

### 7.1 Two divergent freee client modules — **info**

**Evidence.** `debt-service.ts:1` imports `@/integrations/freee/client` → `src/integrations/freee/client.ts`. `CLAUDE.md` §3 documents the freee client under `src/lib/integrations/freee/`, which also exists (`src/lib/integrations/freee/client.ts`). Two client implementations risk divergence in `FreeeDeal` shape, pagination, and mock data.

**Proposed change (concrete).** Consolidate to one client; have the debt service import the canonical one. **PENDING HUMAN DETERMINATION** on which is canonical.

### 7.2 Multiple fake-green unit tests mask the defects above — **info**

| Test | File:line | Why fake-green |
|---|---|---|
| Tax due-date generation | `tax-service.test.ts:407-428` | Asserts only `expect(corporateSchedule).toBeDefined()` — never checks the actual date value, so §3.2 is invisible |
| Tax withholding count | `tax-service.test.ts:380` | Asserts 2 `withholding` rows succeed, which the real `@@unique` constraint forbids (§3.1) — mock `create` doesn't enforce it |
| Debt overdue urgency | `debt-service.test.ts:331-351` | Mocks `findMany` to return the past-due row **ignoring the `where`**, so the §5.1 `gte: now` exclusion never runs |
| Prepaid detection | `trackers.test.ts:379` | `expect(result.length).toBeGreaterThanOrEqual(0)` — a tautology, always true |

**Proposed change (concrete).** Replace tautologies and `toBeDefined`-only assertions with concrete invariant checks (exact due-date strings, row counts that respect the unique key, `where`-honoring mocks or a transactional test DB). See §8. **PENDING HUMAN DETERMINATION** on the test substrate (mock vs. test DB).

---

## 8. Proposed test vectors

These are proposed (not written — source is read-only for this task). Each maps a High/Critical finding to a concrete scenario and the invariant the test must assert. Tests should honor the real Prisma `where` clauses (use a test DB or a mock that filters as Prisma would) so they are not fake-green.

| ID | Finding | Proposed test | Invariant to assert |
|---|---|---|---|
| TX-1 | §3.1 (unique) | Call `generateDefaultTaxSchedules(co, 12, 2024, true)` and `(…, false)` against a real/test DB | Either exactly one `withholding` row per `(company,year)` survives, or period-discriminated rows persist without `P2002`; today this throws |
| TX-2 | §3.2 (dates) | `generateDefaultTaxSchedules(co, 12, 2024, false)`; read back due dates | `corporate.dueDate` ≈ 2025-03-01 (not 2026); `depreciation`/`consumption` likewise; withholding special H1 ≈ 2024-07-10, H2 ≈ 2025-01-20 |
| TX-3 | §3.2 (Mar FY) | Same with `fiscalYearEndMonth=3, fiscalYear=2024` | `corporate.dueDate` ≈ 2024-06-01 |
| TX-4 | §3.3 (depreciation) | Read back depreciation due date for a Dec FY | Due date is the fixed municipal date (e.g. 2025-05-31), not FY+2 |
| TX-5 | §3.5 (auto-close) | Create a schedule with `amount: null` (as the generator does), then `createTaxPayment` covering a nominal amount | Document/decide behavior: today it never marks `PAID`; assert the decided behavior |
| TX-6 | §3.6 (idempotency) | Call `POST /api/tax/generate` twice for the same year | Second call no-ops or upserts; no 500 |
| TX-7 | §3.7 (race) | Two concurrent `createTaxPayment` calls crossing the threshold | Exactly one `PAID` transition (no lost update) |
| PP-1 | §4.1 (drift) | `createPrepaidExpense({originalAmount:1000, totalMonths:3})`; record 3 amortizations of `monthlyAmount` | `remainingAmount === 0` and `status === 'FULLY_AMORTIZED'` (today: residual ¥1, stays ACTIVE) |
| PP-2 | §4.2 (validation) | `createPrepaidExpense({totalMonths:0})` and `{totalMonths:-1}` | Returns `failure(Result)`; nothing persisted (today: stores `Infinity`) |
| PP-3 | §4.3 (idempotent amort) | `recordAmortization` twice for same `(prepaidId,year,month)` | No `P2002`; upsert/no-op |
| PP-4 | §4.4 (over-amort) | `recordAmortization` with `actualAmount > remainingAmount` | Capped/flagged, no negative `remainingAmount` |
| PP-5 | §4.5 (expired) | Prepaid with `endDate` in the past and `remainingAmount > 0` | Flagged non-ACTIVE status |
| DB-1 | §5.1 (overdue excluded) | Seed a `Debt` with `dueDate` yesterday, status `OVERDUE`; call `getCashOutForecasts` | Row is returned with `urgency === 'high'` (today: excluded by `gte: now`) — use a test DB so the `where` actually runs |
| DB-2 | §5.2 (total) | Same seed; `getTotalUpcomingCashOut` | Overdue amount is included |
| DB-3 | §5.3 (issue vs due) | Assert `syncDebtsFromFreee` queries a backward issue-date window and filters by `due_date` | Upcoming-due payables issued in the past are imported (mock the client to assert the date params) |
| DB-4 | §5.4 (paid) | Sync a deal with `due_amount === 0` and a `payments` entry | Existing `Debt` row set to `PAID` with `paymentDate` (today: skipped, stays PENDING) |
| DB-5 | §5.5 (pagination) | Mock `getDeals` to require pagination | All pages consumed (no truncation) |
| DB-6 | §5.6 (TZ) | Due date `"today"` / month-boundary dates | Urgency/month grouping stable in Asia/Tokyo |
| AC-1 | §6.3 (lookback) | Accrual in month X, payment in month X+2 | Matched (today: unmatched because only X+1 is considered) |
| AC-2 | §6.4 (1:1) | Two accruals same account+amount, one matching payment | Exactly one matched; journal not double-assigned; transactional |

---

## 9. Suggested remediation ordering

Suggested order for a human to consider (not a decision):

1. **§3.1 + §3.6** — make tax-schedule generation survive its own unique constraint and be idempotent (blocks all use of `POST /api/tax/generate`).
2. **§3.2 + §3.3 + §3.4** — fix due-date arithmetic and the depreciation fixed-date basis (after confirming the §10 conventions).
3. **§5.1 + §5.2 + §5.4** — make debt forecasts include overdue and reconcile paid status (highest user-facing impact).
4. **§5.3 + §5.5** — fix the sync fetch window and pagination so the forecast feed is populated.
5. **§4.1 + §4.2** — prepaid rounding drift and validation (before wiring the dead tracker methods).
6. **§3.5 + §3.7** — tax-payment auto-close semantics and transactionality.
7. **§7.2** — convert the fake-green tests to honor real `where`/constraints (so 1–6 stay fixed).

**PENDING HUMAN DETERMINATION** on the final ordering and scope.

---

## 10. Statutory assumptions relied on (all **PENDING HUMAN DETERMINATION**)

These are the Japanese tax/accounting assumptions used to judge the findings. They must be confirmed by a qualified reviewer before any code change; several are simplified and may depend on the taxpayer's specifics.

- **法人税 確定申告期限** = 事業年度終了の日の翌日から2月を経過した日 (2 months after FY-end). For a Dec 31 FY-end → March 1; for a Mar 31 FY-end → June 1.
- **法人住民税 / 法人事業税** share the 確定申告 deadline with 法人税 (lumped in the schedule note). 均等割 is due even for loss-making companies (not modeled).
- **源泉徴収税（納期の特例なし）** = monthly, 10th of the following month (12/year).
- **源泉徴収税（納期の特例）** = semi-annual: Jan–Jun portion due July 10; Jul–Dec portion due January 20 of the following year (eligibility: 給与支給人数 < 10, etc.).
- **償却資産税 申告期限** = fixed by municipality (commonly 5月31日), based on the Jan-1 price — **not** tied to the company FY-end.
- **消費税 確定申告期限** = 課税期間終了の日の翌日から2月 (2-month rule; for 暎年課税 ≈ March). 中間申告 (interim) based on prior-year tax is not modeled.
- **Prepaid expense (前払費用) amortization** = straight-line over the benefit period; the sum of periodic amortization must equal the original prepaid amount.
- **Accrued expense (未払費用)** = recognized when incurred, reversed on payment; expected (accrual estimate) vs. actual (invoiced/paid) are distinct amounts.

**PENDING HUMAN DETERMINATION** on each of the above, and on the indexing convention of `fiscalYearEndMonth` (1-indexed month assumed: 1=Jan … 12=Dec, consistent with `TaxSettings.fiscalYearStart` default `1`) and on whether `fiscalYear` denotes the FY-end year or FY-start year.

---

## Appendix — files read (read-only reference)

- `src/services/tax/tax-service.ts`
- `src/services/deferred-accrual/index.ts`, `accrual-expense-tracker.ts`, `prepaid-expense-tracker.ts`
- `src/services/debt/debt-service.ts`
- `src/integrations/freee/client.ts`
- `prisma/schema.prisma` — `Journal`, `Debt`, `TaxSchedule`, `TaxPayment`, `PrepaidExpense`, `PrepaidAmortization`, `AccrualExpense`, `TaxSettings`
- `src/app/api/tax/{generate,settings,schedules,schedules/[id],schedules/[id]/payments}/route.ts`
- `src/app/api/deferred-accrual/{prepaid,accrual}/route.ts`
- `src/app/api/debt/forecast/route.ts`
- `tests/unit/services/tax/tax-service.test.ts`, `tests/unit/services/debt/debt-service.test.ts`, `tests/unit/services/deferred-accrual/trackers.test.ts`
- `tsconfig.json` (alias `@/* → ./src/*`), `scripts/autopm_verify.mjs`

No source file was created, modified, or deleted by this audit. The only artifact produced is this document.
