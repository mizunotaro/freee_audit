# FIN-DESIGN-01 — Journal-Level Budget-Variance Attribution Methodology (予実要因分析)

**Status:** DESIGN PROPOSAL — ANALYSIS ONLY.
**Every conclusion, finding, and proposed change in this document is `PENDING HUMAN DETERMINATION`.**
This is a methodology design for a human reviewer. It is **not** an approval, a decision, or a sign-off. No
reviewer name, status of "approved", or acceptance is recorded anywhere in this document. Nothing here has been
implemented; source code is read-only reference for this task.

---

## 0. TL;DR

The task asks for a methodology to attribute budget-vs-actual variance **down to the individual journal entry**,
decomposing each account/department/period variance into drivers (price / volume / mix / timing) and ranking the
journal entries that most explain each variance.

Three findings dominate the design and are `PENDING HUMAN DETERMINATION`:

1. **Actuals are not journal-derived today.** The P&L that feeds the existing variance calc is built from the
   `MonthlyBalance` table (freee trial balance / CSV import / seed) — *never* from `Journal`. Worse, the live budget
   API route computes variance against **hardcoded sample P&L** (`generateSamplePL`). Journals are synced but never
   read by the report path. (Evidence: §4.2.) → *Journal-level attribution requires a brand-new
   journal→actual reconciliation that does not exist.*

2. **The `Journal` row carries no attribution dimensions.** freee returns `partner`, `tag`, `segment_1/2/3`,
   `item`, `deal_type`, and multi-line `details[]`, but both sync paths persist only `debitAccount`/`creditAccount`
   (stored as the **account name**, not code), `amount`, `taxAmount`. There is no `Department` table;
   `departmentId` exists **only** on `Budget`. → *Price/volume/mix decomposition and department/partner attribution
   are not feasible on persisted data.* (Evidence: §4.3.)

3. **The account→P&L mapping is structurally broken on the freee path.** `getCategoryFromAccountItem` makes the
   `revenue` branch unreachable dead code (identical `account_item_id 400–499` condition as `equity`, evaluated
   first) and has **no `cost_of_sales` branch at all**. So revenue and COGS amounts do not reach
   `ProfitLoss.revenue` / `ProfitLoss.costOfSales` via freee sync. → *The account-level variance the methodology
   must attribute is itself unreliable for the top two P&L lines.* (Evidence: §4.4.)

Given the above, this document specifies (a) the **standard variance-analysis framework** to adopt, (b) a
**two-layer attribution model** — an account-level driver decomposition that *is* computable from today's data plus
a journal-level deviation-from-expected ranking — and (c) the **target data model + API shape** needed for the full
price/volume/mix/timing decomposition, all `PENDING HUMAN DETERMINATION`. Most proposed changes touch Class-A
paths (`prisma/schema.prisma`, freee integration) and are therefore **described, not implemented**.

---

## 1. Scope & non-goals

**In scope (design only):**
- A methodology to decompose per-account/period budget variance into named drivers.
- A method to rank individual journal entries by their contribution to each account's variance.
- A target data model, API request/response shape, edge-case catalog, and a worked example.
- Cited, standard variance-analysis definitions the methodology is grounded in.

**Out of scope (non-goals):**
- Any code change. This task writes this one document only. All proposed model/API changes are descriptions for a
  human, `PENDING HUMAN DETERMINATION`.
- Forecasting, rolling reforecast, or budget *entry* UX.
- Cross-entity consolidation / multi-company elimination.

---

## 2. Background — current variance code (read-only reference)

| File | Role |
|------|------|
| `src/services/budget/actual-vs-budget.ts:18-138` | `calculateActualVsBudget`: joins `ProfitLoss` (actual) to `Budget` by `accountCode`; `variance = actual − budget`; achievement rate. |
| `src/services/budget/actual-vs-budget.ts:167-207` | `analyzeBudgetVariance`: flags items where `\|variance/budget\| ≥ threshold` (default 10%). No drivers. |
| `src/services/budget/detailed-actual-vs-budget.ts:54-187` | `calculateDetailedActualVsBudget`: stage-level (売上高…当期純利益) + account-level with good/warning/bad status. Category inferred by **account-code prefix** (4xx revenue, 5xx cost, 6xx/7xx SGA) at `:193-197`. Net-income **budget** is hardcoded `operatingIncomeBudget * 0.7` at `:121`. |
| `src/services/budget/budget-service.ts` | CRUD + `upsertBudget` keyed by `(companyId, fiscalYear, month, departmentId, accountCode)` (`:102-129`). |
| `src/app/api/reports/budget/route.ts` | The budget endpoint. `action=variance/detailed/trend` all call `*WithSample` helpers (`:293-365`) that feed **hardcoded sample P&L**, not real actuals. |

**What the current code does *not* do:** no driver decomposition (price/volume/mix/timing), no journal-level
attribution, no department/partner dimension, no reconciliation of actuals to journals, and no data-availability
signaling (it silently substitutes sample data). All of these are the subject of this design.

---

## 3. Standard variance-analysis framework (cited definitions)

The methodology is grounded in the canonical management-accounting variance framework (Horngren, Datar & Rajan,
*Cost Accounting: A Managerial Emphasis*; Garrison, Noreen & Brewer, *Managerial Accounting*). The "Level 1/2/3"
layering below is the standard presentation. These are definitional references, not repo citations.

**Level 1 — Static-budget (master-budget) variance.**
> `StaticBudgetVariance = Actual result − Static (master) budget`

This is what the current `variance = actual − budget` computes. It is always available but mixes together
"we spent differently because volume differed" and "we spent differently because price/efficiency differed".

**Level 2 — Flexible-budget & activity (sales-volume) variance.**
> `StaticBudgetVariance = FlexibleBudgetVariance + ActivityVolumeVariance`
> `FlexibleBudgetVariance = Actual − FlexibleBudget`
> `ActivityVolumeVariance = FlexibleBudget − StaticBudget`

where the **flexible budget** = budgeted unit economics × **actual** volume (i.e., "what we would have budgeted
had we known the true volume"). The activity-volume variance isolates the "we did more/less business" effect;
the flexible-budget variance isolates the "given actual volume, we priced/consumed differently" effect.

**Level 3 — Price × Efficiency decomposition (per input).**
> `PriceVariance = (ActualPrice − BudgetedPrice) × ActualQuantity`
> `EfficiencyVariance = (ActualQuantity − BudgetedQuantity) × BudgetedPrice`

Classic direct-materials / direct-labor decomposition. `PriceVariance + EfficiencyVariance = FlexibleBudgetVariance`.

**Revenue PVVM — Price / Volume / Mix (multi-product sales).**
> `SalesPriceVariance = (ActualPrice − BudgetedPrice) × ActualUnits` (per product, summed)
> `SalesVolumeVariance = (ActualUnits − BudgetedUnits) × BudgetedPrice` (per product, summed)
> `SalesVolumeVariance = SalesMixVariance + SalesQuantityVariance`
> `SalesMixVariance = (ActualMix% − BudgetedMix%) × ActualTotalUnits × BudgetedPrice`
> `SalesQuantityVariance = (ActualTotalUnits − BudgetedTotalUnits) × BudgetedMix% × BudgetedPrice`

Price variance isolates rate changes; mix variance isolates product-mix shifts at constant total volume; quantity
variance isolates total-volume changes at constant mix.

**Sign convention (standard).** A variance is *favorable (F)* when it increases operating income relative to
budget (revenue actual > budget is F; expense actual < budget is F) and *unfavorable (U)* otherwise. The current
code labels "over/under" by raw sign only, which is **ambiguous for expenses** (`actual − budget > 0` for an
expense is unfavorable but coded the same as a favorable revenue over-run). Correcting this is
`PENDING HUMAN DETERMINATION`.

> **PENDING HUMAN DETERMINATION:** Which level(s) of this framework the product will commit to. Level 1 is free
> today; Levels 2–3 and PVVM require data the model does not persist (volume, price, mix dimensions). See §6.

---

## 4. Current-state findings (evidence-backed)

### 4.1 Current variance analysis is account-level with no drivers
`calculateActualVsBudget` (`actual-vs-budget.ts:18-138`) iterates `actualPL.revenue/costOfSales/sgaExpenses`,
joins each to `Budget` by `accountCode`, and emits `variance = actual − budget` + achievement rate.
`analyzeBudgetVariance` (`:167-207`) only thresholds by variance-percent. No driver taxonomy, no journal link.

### 4.2 Actuals data lineage — journals never feed the P&L
Confirmed by tracing the full path (the report path reads only `MonthlyBalance`, never `Journal`):

```
freee GET /reports/trial_balance  →  data-sync.ts:104 syncTrialBalanceToDatabase
                                     → upsertMonthlyBalance (data-sync.ts:148)  [accountCode=account_item_id, category=range-test]
CSV import /api/import/monthly-balances  →  monthly-balance-importer.ts:192
seed.ts:377
                                  ─── all three converge on ───►  MonthlyBalance (schema.prisma:377)

MonthlyBalance.findMany (balance-loader.ts:52, no Journal join)
  → mapBalancesToProfitLoss (monthly-report.ts:235)   [filter by category → ProfitLoss.revenue/costOfSales/sgaExpenses]
  → ProfitLoss (types/index.ts:81)
  → calculateActualVsBudget (actual-vs-budget.ts:18)

Fallback when no MonthlyBalance rows for the month: generateSampleProfitLoss (monthly-report.ts:382) — synthetic.
Budget API route: does NOT use any of the above — feeds hardcoded generateSamplePL (budget/route.ts:24-61, 293-365).

DEAD END: Journal table (schema.prisma:108) is synced daily (journal-sync.ts) but NEVER read for P&L.
```

Consequences directly relevant to attribution:
- `actual (per account) ≠ Σ journal amounts` in general, because the actual comes from the trial balance
  (which includes accruals, closing/reclassifying entries, and entries never captured as `Journal` rows), while the
  synced `Journal` set may itself be incomplete (the repo has two ingest paths; the API path does not paginate and
  truncates — see project memory on dual journal ingest). A reconciliation gap is **guaranteed** and must be an
  explicit variance bucket (§6.6).
- The trial-balance sync is **not scheduled** (only manual `POST /api/freee/sync action=sync_trial_balance`). The
  daily cron syncs *journals*, which the report ignores. So in steady state the P&L can be stale or empty and the
  code silently falls back to sample data.
- Mock mode (`FREEE_MOCK_MODE=true`, the repo default) returns a 3-account hardcoded trial balance.

### 4.3 The `Journal` row has no attribution dimensions
`Journal` (`schema.prisma:108-131`) stores exactly: `companyId, freeeJournalId, entryDate, description,
debitAccount, creditAccount, amount, taxAmount, taxType, documentId, auditStatus, syncedAt`. It is **single-line**
(one debit account, one credit account, one amount) — there is no `JournalLine`/`JournalDetail` model.

Critically, `debitAccount`/`creditAccount` are stored as **`account_item_name`** (the Japanese account name), not
a code or id (`data-sync.ts:66-67`, `journal-sync.ts:108-127`). Meanwhile:
- `Budget.accountCode` is a user code from CSV import (e.g. `"510"`).
- `MonthlyBalance.accountCode` is `account_item_id.toString()` (freee numeric id) on the trial-balance path, or a
  user code on the CSV path.
- `AccountItem` (`schema.prisma:454-478`) carries `freeeId` (= `account_item_id`), `name`, `shortcut`,
  `shortcutNum`, `categoryId/Name/Type`.

So there are **three incompatible account keys** (name / user-code / freee-numeric-id). Joining a journal to its
budget or its actual requires a crosswalk that does not exist as a resolver. This is a first-order blocker for
journal-level attribution. `PENDING HUMAN DETERMINATION`.

freee **does** return attribution dimensions — `FreeeJournal`/`FreeeJournalDetail`
(`src/lib/integrations/freee/types.ts:58-93`) include `partner_id/name`, `tag_ids/names`, `segment_ids`,
`segment_1/2/3_id`, `walletable_id/name`, `deal_id`, `deal_type`, multi-line `details[]`. Both sync paths
**discard all of them** (`data-sync.ts:62-101`, `journal-sync.ts:108-127`). Therefore even a future
journal-aggregation job could not recover partner/segment/item/tag attribution from persisted rows — a re-sync from
freee (with schema changes) would be required. `PENDING HUMAN DETERMINATION`.

There is **no `Department` model**; `departmentId` exists only on `Budget`. `Journal` and `MonthlyBalance` have no
department, partner, segment, item, or tag. Therefore **department-level and partner/mix-level variance are not
computable on current data.** `PENDING HUMAN DETERMINATION`.

`Journal` indexes are `[companyId, entryDate]` and `[companyId, auditStatus]` only (`schema.prisma:128-129`) — no
index on `debitAccount`/`creditAccount`, so a journal-attribution scan/grouping by account would be unindexed.
`PENDING HUMAN DETERMINATION`.

### 4.4 The account→P&L category mapping is broken on the freee path
`getCategoryFromAccountItem` (`data-sync.ts:187-205`):

```ts
if (closingCr > 0 && closingDr === 0) {
  if (id >= 400 && id < 500) return 'equity'      // line 199 — evaluated FIRST
  if (id >= 400 && id < 500) return 'revenue'     // line 200 — UNREACHABLE (identical condition, after equity)
  if (id >= 700 && id < 800) return 'nonoperating_revenue'
}
// no branch ever returns 'cost_of_sales'
return 'current_asset'                            // default
```

- The `revenue` branch (`:200`) is **dead code**: `:199` returns `'equity'` for the same `400–499` range first.
  freee sales accounts commonly fall in a revenue id range, so they are mislabeled `'equity'` (or fall through to
  the default `'current_asset'`), **never** `'revenue'`.
- **No branch returns `'cost_of_sales'`.** COGS accounts become `'sga_expense'` (if id 500–599) or default
  `'current_asset'`.

Because `mapBalancesToProfitLoss` (`monthly-report.ts:240-250`) filters by literal category strings, on the freee
path `ProfitLoss.revenue` and `ProfitLoss.costOfSales` are effectively empty/misrouted — so `grossProfit`,
`operatingIncome`, and every variance derived from them are unreliable for the top P&L lines. Note this id-range
method also **disagrees** with the prefix method in `detailed-actual-vs-budget.ts:193-197` (4xx→revenue,
5xx→cost, 6xx/7xx→SGA), so an account lands in a different P&L bucket depending on which path classifies it.

Below-the-line sections are hardcoded synthetic regardless of source: `mapBalancesToProfitLoss` sets
`nonOperatingIncome/Expenses`, `extraordinaryIncome/Loss` to `[]`, `incomeTax = operatingIncome*0.3`,
`netIncome = operatingIncome*0.7` (`monthly-report.ts:274-281`). Variance for those sections cannot be attributed
to journals at all today. `PENDING HUMAN DETERMINATION`.

---

## 5. Proposed methodology — overview

Two layers, because the data supports different depths:

- **Layer A — Account-level driver decomposition** (§6.1–6.3): split each account's static-budget variance into a
  *computable* driver taxonomy today, and define the *target* full PVVM decomposition gated on data the model lacks.
- **Layer B — Journal-level attribution** (§6.4): for each account, rank individual journals by deviation from an
  *expected* amount, with contributions that reconcile to the account variance.

Both layers must respect (§6.5) sign convention + materiality and (§6.6) the journal-sum-vs-actual reconciliation
gap.

> **PENDING HUMAN DETERMINATION:** Whether to ship Layer A only (computable now, after the §4.4 mapping fix and a
> journal→actual reconciliation), or commit to the data-model work (§7) required for Layer B at full PVVM depth.

---

## 6. Proposed methodology — detail

### 6.1 Computable driver taxonomy today (Layer A)

For each account `a` in period `p`: `StaticVariance_a = Actual_a − Budget_a` (Level 1). Decompose `StaticVariance_a`
into the following drivers, all computable from persisted data:

| Driver | Definition | Data required (today) | Detectable now? |
|--------|------------|-----------------------|-----------------|
| **Timing** | Amount recognized in the wrong period vs budget (cut-off, accrual reversal, prepaid amortization). | `Journal.entryDate` vs period window; reversing-pair detection; `PrepaidExpense`/`AccruedExpense` tables. | Partial — period-boundary journals and reversing pairs are detectable; the deferred-accrual subsystem is the authoritative timing source. |
| **New / unbudgeted** | Account or (future) partner/item with `Budget = 0` but actual ≠ 0. | `Budget` presence per account. | Yes (account level). |
| **Absence / under-run** | `Budget > 0`, actual = 0 or materially below. | `MonthlyBalance` + `Budget`. | Yes. |
| **Outlier / one-off** | A single journal (or small set) whose magnitude is a statistical outlier vs the account's history. | Historical `Journal` amounts per account. | Yes (z-score / IQR), once journals feed actuals. |
| **FX** | Variance caused by exchange-rate movement on foreign-currency journals. | `ForeignCurrencyTransaction` (linked on `Journal`) + `ExchangeRate`. | Partial. |
| **Run-rate (residual)** | `StaticVariance − (Timing + New + Absence + Outlier + FX)` — the combined volume×price effect that cannot be split without unit data. | — | Yes (as a residual). |

**Full price/volume/mix split (target, Layer A+):** Splitting `Run-rate` into `Volume`, `Price`, `Mix` requires
the Level 2/3 + PVVM machinery from §3, which in turn requires a **quantity/unit-price** field and a
**product/partner dimension** on journals — neither persisted today (§4.3, §7.2–7.3). `PENDING HUMAN DETERMINATION`.

> **PENDING HUMAN DETERMINATION:** Driver set and boundary rules (e.g., should "Outlier" be a driver or a flag on a
> journal within another driver?). The taxonomy above is a starting proposal.

### 6.2 Sign convention & materiality (applies to all layers)
- Classify every variance **favorable/unfavorable** by P&L-line direction (§3), not raw sign. Revenue/asset over =
  F; expense/liability over = U. The current "over/under" labeling must be replaced. `PENDING HUMAN DETERMINATION`.
- Only attribute where `|StaticVariance_a|` is **material** (proposed: `> max(absoluteFloor, pctOfRevenue)`).
  Immaterial variances are aggregated and reported as a single "immaterial" bucket, not exploded to journals.
  `PENDING HUMAN DETERMINATION` on thresholds.
- Achievement rate is **undefined when `Budget = 0`**; the current code reports `0`, which is misleading and should
  become `null`/`'N/A'`. `PENDING HUMAN DETERMINATION`.

### 6.3 Edge-case catalog
| Case | Detection | Handling (proposal) |
|------|-----------|---------------------|
| **Missing budget** (`Budget_a = 0`, actual ≠ 0) | no `Budget` row | Driver = `new_unbudgeted`; achievement rate `null`; variance = actual. |
| **Missing actual** (no `MonthlyBalance`, sample/mock fallback) | data-quality flag (§8) | Suppress attribution; surface `actualsSource: 'sample'|'mock'|'none'`. Do **not** attribute sample data. |
| **Budget but no journals** (`Budget_a > 0`, actual ≈ 0) | `Σ journals = 0` | Driver = `absence`; no journal ranking. |
| **Reclassification** (entry moved between accounts mid-period) | offsetting journals across two accounts | Attribute net-zero across the pair; tag `reclass`; exclude from single-account driver sums. |
| **Accrual / reversing entry** | reversing pair or `Prepaid`/`Accrued` linkage | Driver = `timing`; net reversing pairs within the period; cross-period remainder stays `timing`. |
| **Cut-off / period boundary** | `entryDate` at month start/end | Driver = `timing`; flag if the same journal appears across adjacent periods. |
| **Multi-currency** | `ForeignCurrencyTransaction` present | Compute variance in base currency; isolate `FX` driver. |
| **Unreconciled** (`Σ journals ≠ Actual_a`) | reconciliation gap (§6.6) | Bucket = `unreconciled`; never silently absorb into other drivers. |
| **Below-the-line** (non-op/extraordinary/tax) | sections currently synthetic (`§4.4`) | Not attributable to journals until those sections are sourced from real data; report as `not_applicable`. |

> **PENDING HUMAN DETERMINATION:** Detection thresholds and exact handling for each case (e.g., what counts as a
> "reversing pair", the materiality floor, the reconciliation tolerance).

### 6.4 Journal-level attribution (Layer B) — deviation from expected

Problem: the budget is a single monthly aggregate per account; an individual journal has no budget of its own. So
we cannot ask "did this journal beat its budget" directly. Proposal: give each journal an **expected amount** and
rank by **deviation**, where `Σ deviation_j = StaticVariance_a` (reconciling).

For account `a`, period `p`, with journals `j ∈ J_a` (the journals whose debit or credit side resolves to account
`a` in `p`), and `Actual_a` reconciled from `MonthlyBalance`:

1. **Sign each journal to the account's P&L direction.** For a revenue/expense account, only the relevant side
   contributes (e.g., the debit side for an expense, the credit side for revenue); `signedAmount_j` applies the
   favorable/unfavorable convention from §6.2.
2. **Compute expected amount per journal.** Four model options, increasing in data requirement and quality:
   - **(M0) Uniform spread:** `expected_j = Budget_a / |J_a|`. Deviation captures *concentration* (one large entry
     against an evenly-budgeted account). Always available.
   - **(M1) Temporal pattern:** `expected_j = Budget_a × weight(entryDate_j)`, where `weight` is derived from
     historical day-of-month / weekday distribution for the account. Deviation captures *timing* surprises.
   - **(M2) Prior-year match:** match each journal to the same account/partner/month last year;
     `expected_j = priorYearAmount`. Deviation captures *year-over-year change*. Best attribution quality; needs ≥1
     year of history **and** the partner dimension (§7.1).
   - **(M3) Driver-based (full PVVM):** `expected_j = budgetedUnitPrice × actualVolume_j`; deviation splits into
     price vs volume. Needs quantity/unit-price (§7.2).
3. **Deviation & contribution:**
   - `deviation_j = signedAmount_j − expected_j`
   - `contribution_j = deviation_j` (so `Σ contribution_j = Σ signedAmount_j − Budget_a`, which equals
     `Actual_a − Budget_a = StaticVariance_a` **only when `Σ signedAmount_j = Actual_a`**; otherwise see §6.6).
   - `contributionPct_j = deviation_j / StaticVariance_a`
   - `zScore_j = (signedAmount_j − μ_a) / σ_a` over the account's historical journal distribution (for outlier flagging).
4. **Rank:** return top-K journals per account by `|contribution_j|` (and optionally by `|zScore_j|`), each tagged
   with its driver from §6.1.
5. **Driver roll-up:** `driverAmount_a = Σ_{j∈driver} contribution_j`.

> **PENDING HUMAN DETERMINATION:** Which expected-amount model(s) to implement. M0 is the only zero-data option;
> M2/M3 are the target once §7 lands. The contribution-reconciliation identity in step 3 depends on §6.6.

### 6.5 Reconciliation of journal sums to actuals (the unreconciled bucket)
Because actuals come from the trial balance and journals are an independent (possibly incomplete) sync
(§4.2), define explicitly:

```
ReconciliationGap_a = Actual_a − Σ_{j∈J_a} signedAmount_j
StaticVariance_a   = (Σ deviation_j) + ReconciliationGap_a
```

`ReconciliationGap_a` is reported as its own `unreconciled` driver, **never** absorbed into `Run-rate`. Sources of
the gap (to diagnose, not necessarily eliminate): accruals/closing entries absent from `Journal`; the API ingest
truncation; reclassifications; FX remeasurement booked at trial-balance level. A large `unreconciled` share
disqualifies fine-grained journal attribution for that account (surface a confidence flag).

> **PENDING HUMAN DETERMINATION:** The tolerance above which `unreconciled` suppresses journal ranking, and whether
> to build a journal→trial-balance reconciliation job (would touch the freee integration, a Class-A path).

---

## 7. Target data model (PROPOSED — descriptions only, `PENDING HUMAN DETERMINATION`)

Every item below is a **proposal for a human decision**. All touch Class-A paths (`prisma/schema.prisma`,
`src/lib/integrations/freee/**`) and are therefore out of bounds to implement in this task; they are described so
the methodology's data dependencies are explicit.

**7.1 Journal dimension capture.** Extend the journal persistence (schema + both sync paths) to store the
dimensions freee already returns: `partnerId/partnerName`, `segmentIds` (freee `segment_1/2/3` — the
department/profit-center analog), `tagIds`, `itemId/itemName`, `walletableId`, `dealType`, and the full multi-line
`details[]` (replacing the single debit/credit collapse). This is the **prerequisite** for department, partner, and
mix attribution.

**7.2 Quantity / unit price.** Add optional `quantity` and `unitPrice` to journal details (freee does not always
provide these; they may require a per-account driver mapping, e.g., headcount for 給与手当, kWh for 水道光熱費).
This is the **prerequisite** for Level 3 price/efficiency and revenue PVVM.

**7.3 Account-key crosswalk.** Introduce a single canonical resolver `account_item_id ↔ shortcut_num (user code)
↔ name` (sourced from `AccountItem`) and standardize `Budget.accountCode`, `MonthlyBalance.accountCode`, and
`Journal` account fields on **one** key. Without this, journal↔budget↔actual joins are lossy (§4.3).

**7.4 Fix the category mapping (§4.4).** Replace the dead-code/missing-branch `getCategoryFromAccountItem` and the
disagreeing prefix method with one authoritative account→P&L-category map (preferably driven by
`AccountItem.categoryType`, not id ranges). **Prerequisite for any meaningful revenue/COGS variance.**

**7.5 Attribution result cache (optional).** A computed/results table for `VarianceAttribution` rows
(account × period × driver × top journals) to avoid recomputation. Optional; could also be computed on demand.

**7.6 Department master.** If department-level variance is in scope, add a `Department`/segment master and tag both
`Budget` and `Journal` with it (Journal via the freee segment dimension, §7.1).

> **PENDING HUMAN DETERMINATION:** Which of 7.1–7.6 to accept, and in what order. 7.3 and 7.4 are the minimum to
> make *account-level* variance trustworthy; 7.1 + 7.2 unlock *journal-level* and PVVM depth.

---

## 8. API & response shape (PROPOSED — `PENDING HUMAN DETERMINATION`)

**Request (new):**
```
GET /api/reports/budget/variance-attribution
    ?fiscalYear=2025&month=6
    &accountCode=510            // optional: single account
    &driver=timing              // optional: filter
    &topK=10                    // journals per account
    &expectedModel=M0           // M0|M1|M2|M3 (§6.4)
```

**Response (proposed shape):**
```jsonc
{
  "fiscalYear": 2025, "month": 6,
  "dataQuality": {
    "actualsSource": "monthly_balance",   // monthly_balance | sample | mock | none
    "budgetCoveragePct": 0.82,            // % of actual accounts that have a budget
    "dimensionCoverage": { "partner": false, "segment": false, "quantity": false },
    "warnings": ["revenue_category_misrouted", ...]
  },
  "accounts": [
    {
      "accountCode": "510", "accountName": "給与手当", "category": "sga_expense",
      "signConvention": "expense",          // favorable when actual < budget
      "budget": 800000, "actual": 950000,
      "variance": 150000, "variancePct": 18.75, "favorable": false,
      "material": true,
      "reconciliation": { "journalSum": 940000, "actual": 950000, "unreconciled": 10000, "unreconciledPct": 1.05 },
      "drivers": [
        { "driver": "outlier",     "amount": 90000, "pctOfVariance": 60.0, "journalsCount": 1 },
        { "driver": "run_rate",    "amount": 50000, "pctOfVariance": 33.3, "journalsCount": 24 },
        { "driver": "unreconciled","amount": 10000, "pctOfVariance": 6.7,  "journalsCount": 0 }
      ],
      "journals": [
        { "journalId": "...", "freeeJournalId": "9871", "entryDate": "2025-06-25",
          "description": "夏賞与 (summer bonus)", "partnerName": null, "segment": null,
          "signedAmount": 90000, "expected": 6666, "deviation": 83334,
          "contributionPct": 55.6, "zScore": 3.8, "driver": "outlier", "direction": "unfavorable" }
      ]
    }
  ],
  "summary": {
    "totalBudget": 6800000, "totalActual": 7300000, "totalVariance": 500000,
    "favorable": false, "immaterialBucket": 12000
  }
}
```

Notes:
- `dataQuality` makes the silent-sample-data fallback (§4.2) **visible** so consumers never mistake demo numbers
  for real variance.
- `drivers[].amount` and `reconciliation` sum to `variance` (the §6.5 identity).
- When `dimensionCoverage` is all-false, `partner`/`segment`/mix fields are omitted and PVVM drivers are absent.

> **PENDING HUMAN DETERMINATION:** Endpoint path, field names, pagination, and whether this lives under
> `/api/reports/budget/*` (consistent with today) or a new `/api/analysis/*` namespace.

---

## 9. Algorithm sketch (pseudo-code, `PENDING HUMAN DETERMINATION`)

```
function attributeVariance(companyId, fiscalYear, month, opts):
  budgets   = getBudgetsByMonth(companyId, fiscalYear, month)          // Budget table
  actuals   = loadMonthlyBalance(companyId, fiscalYear, month)         // via balance-loader
  if actuals empty: return { dataQuality.actualsSource: sample|mock|none, accounts: [] }

  accounts = joinActualToBudget(actuals, budgets, crosswalk)          // §7.3
  for a in accounts:
    a.variance = signed(a.actual - a.budget, a.signConvention)        // §6.2
    if |a.variance| < materiality: bucket.immaterial += a.variance; continue

    J_a = journalsForAccount(companyId, a, fiscalYear, month)         // debit OR credit side resolves to a
    J_a = signJournals(J_a, a.signConvention)                         // §6.4 step 1
    expected = expectedAmounts(J_a, a.budget, opts.expectedModel)     // M0..M3
    for j in J_a:
       j.deviation = j.signedAmount - expected[j]
       j.driver    = classifyDriver(j, a, history)                    // §6.1
    gap = a.actual - sum(J_a.signedAmount)                            // §6.5 reconciliation
    a.drivers     = groupBy(sum deviation by driver) ∪ { unreconciled: gap }
    a.journals    = topK(J_a, by=|deviation|, k=opts.topK)            // §6.4 step 4
  return { dataQuality, accounts, summary }
```

The reusable primitive `journalsForAccount` (group journals by account + month) **does not exist today** — the only
`prisma.journal.groupBy` in the repo is in the conversion subsystem (`services/conversion/journal-converter.ts:544`)
for account-usage analysis. Building an analogous grouped read for the budget path is part of any implementation.
`PENDING HUMAN DETERMINATION`.

---

## 10. Worked example (`PENDING HUMAN DETERMINATION` — illustrative numbers only)

Account 給与手当 (510), June 2025, expense (favorable when actual < budget):
- `Budget = ¥800,000`, `Actual = ¥950,000` → `variance = +¥150,000` (unfavorable), material.
- 25 payroll journals in June, `Σ signedAmount = ¥940,000` → `unreconciled = ¥10,000` (accrual not in `Journal`).
- One journal = summer bonus (夏賞与) `¥90,000` on 6/25; M0 expected `= 800,000/25 = ¥32,000` → deviation `+¥58,000`,
  z-score 3.8 → driver `outlier`, ~39% of variance.
- Remaining 24 journals deviate `+¥42,000` net → driver `run_rate` (cannot split price/volume without headcount
  data; if 給与手当's driver were headcount and headcount were captured, this would split into volume vs rate).
- Net check: `58,000 + 42,000 + 10,000(unreconciled) ... ` reconciles toward `¥150,000` per §6.5.

This shows Layer A (drivers) working at account level today (post §7.3/7.4), and Layer B (journal ranking)
working at M0 depth without any new dimension — the summer-bonus journal is correctly surfaced as the top
contributor. Splitting `run_rate` into volume/price needs §7.2.

---

## 11. Risks, assumptions, open questions (all `PENDING HUMAN DETERMINATION`)

1. **Trustworthiness of the base variance.** Until §4.4 (category mapping) and §7.3 (key crosswalk) are resolved,
   the account-level variance itself is unreliable for revenue/COGS; attributing it to journals would amplify the
   error. Decide whether to gate the whole feature on those fixes.
2. **Actuals ≠ journal sums.** The reconciliation gap (§6.5) may be large for some accounts, making journal
   ranking misleading. Decide the tolerance and the confidence-flag threshold.
3. **Completeness of the journal set.** The API ingest path does not paginate (project memory: dual journal ingest
   paths). Journal attribution is only as good as journal completeness; decide whether to require the paginated
   scheduler path as a precondition.
4. **Expected-amount model choice (§6.4).** M0 is trivially gameable (one huge journal dominates); M2/M3 need
   data. Decide the default and the upgrade path.
5. **Materiality / thresholds (§6.2).** All numbers (`absoluteFloor`, `% of revenue`, top-K, outlier z-score) are
   placeholders pending decision.
6. **Department scope.** If department-level variance is required, §7.1 + §7.6 are mandatory and large.
7. **No new external dependencies / no copied code** (per task constraints). The methodology is implementable with
   existing Prisma + the existing freee client; it adds no libraries.

---

## 12. Suggested phasing (`PENDING HUMAN DETERMINATION` — for sequencing only, not a commitment)

- **Phase 0 (trust the base):** §7.4 category-mapping fix, §7.3 key crosswalk, and surface `dataQuality` /
  actuals-source so variance is real and the sample fallback is visible. (Class-A schema + freee changes.)
- **Phase 1 (Layer A, account drivers):** implement the §6.1 driver taxonomy + §6.2 sign/materiality + §6.3 edge
  cases on top of `MonthlyBalance` actuals. No journal dimensions required.
- **Phase 2 (Layer B, M0 journal ranking + reconciliation):** add `journalsForAccount`, the §6.5 reconciliation
  bucket, and M0 expected amounts.
- **Phase 3 (depth):** §7.1 dimension capture → enables M2 (prior-year/partner) and department attribution;
  §7.2 quantity → enables full PVVM (M3).

> **PENDING HUMAN DETERMINATION:** Whether and when each phase proceeds. This is a recommendation for a human, not
> a plan to execute.

---

## 13. References

- Horngren, Datar & Rajan, *Cost Accounting: A Managerial Emphasis* — static-/flexible-budget, sales-volume,
  price/efficiency, and sales-mix/quantity variances (Level 1/2/3 framework).
- Garrison, Noreen & Brewer, *Managerial Accounting* — master-budget variance, flexible-budget, and standard-cost
  variance analysis.
- Repo evidence: `src/services/budget/actual-vs-budget.ts`; `src/services/budget/detailed-actual-vs-budget.ts`;
  `src/services/budget/budget-service.ts`; `src/app/api/reports/budget/route.ts`;
  `src/services/report/monthly-report.ts`; `src/services/report/balance-loader.ts`;
  `src/lib/integrations/freee/data-sync.ts`; `src/lib/integrations/freee/types.ts`;
  `src/services/conversion/journal-converter.ts`; `prisma/schema.prisma` (Journal `:108`, Budget `:191`,
  MonthlyBalance `:377`, AccountItem `:454`).

---

*End of proposal. All content above is analysis for a human reviewer. Nothing is approved, decided, or signed off.
Every conclusion is `PENDING HUMAN DETERMINATION`.*
