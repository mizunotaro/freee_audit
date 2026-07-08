# REV-CONV-01 — Audit: JGAAP ↔ IFRS/USGAAP Conversion Mapping

| | |
|---|---|
| **Task** | REV-CONV-01 (AUDIT-ONLY, read-only) |
| **Scope read** | `src/services/conversion/**`, `src/lib/conversion/**` (+ `src/types/conversion.ts`, `prisma/schema.prisma`, conversion API routes) |
| **Date** | 2026-07-09 |
| **Source state** | branch `feature/auto/rev-conv-01` @ `0b3359e`; source untouched |
| **Verdict legend** | Every conclusion below is tagged **PENDING HUMAN DETERMINATION**. Nothing here is approved, signed off, or a decision — it is analysis prepared for a human reviewer. |

> **How to read this document.** Section 1 is an executive summary. Section 2 maps the live data flow and the (large) dead surface area. Sections 3–9 are individual findings, each with evidence (`file:line` + quoted code), impact, a concrete proposed change, and a **PENDING HUMAN DETERMINATION** verdict. Section 10 proposes test vectors. Section 11 suggests a remediation ordering. No source was modified.

---

## 1. Executive summary

The conversion subsystem is extensively scaffolded but a large fraction of it is **not wired into execution** and the part that is wired has a **structural correctness defect in the converted Profit & Loss**. The five highest-impact conclusions (all **PENDING HUMAN DETERMINATION**):

1. **Standard-difference adjustment entries are never generated.** `AdjustmentCalculator` (8 strategies) exists but is imported by nothing in production. `conversion-engine.execute()` only does *load approved mappings → convert journals → aggregate BS/PL/CF*. `ConversionResult.adjustingEntries` is never populated (`conversion-engine.ts:200-209`, `:532-544`). The same is true of `DisclosureGenerator`, `AuditTrailService`, and `RationaleGenerator` (zero production importers). See §3.

2. **The converted P&L is scrambled by a code-range category inference that disagrees with the shipped COA templates.** `financial-statement-converter.aggregateByTargetAccount` categorizes every P&L line via `inferCategoryFromCode()` (`financial-statement-converter.ts:440`, `:470-488`), whose ranges (6000–6999→equity, 7000–7999→revenue, 8000–8999→cogs) contradict the IFRS/USGAAP templates (6100=revenue, 7100=cogs, 8100=SGA). Net effect with default mappings: converted **revenue (6100) is dropped**; **COGS (7100) is reported as revenue**; **SGA (8100) is reported as COGS**. The Balance Sheet is unaffected (it re-derives category from the DB). See §4.

3. **1-to-N mapping is impossible by construction.** `AccountMapping` carries `@@unique([companyId, sourceItemId, targetCoaId])` (`schema.prisma:1010`) — one source → one target per COA — and `journalConverter.createSplitLines` never emits more than one line (`journal-converter.ts:399-452`). `mappingType: '1toN'`/`'complex'` are accepted but cannot produce split output. See §5.

4. **Mapping coverage has systemic gaps and a dead name-matching path.** Default suggestions cover ~24 numeric patterns but omit consumption tax, allowances, retirement benefit, leases, goodwill, deferred revenue; the keyword fallback in `matchSourceAccount` compares account-name keywords against numeric regex sources and so can never match (`default-mappings.ts:390-404`). See §6.

5. **Even if adjustments were wired in, the strategies are incorrect.** Hardcoded account codes that collide with template accounts (lease debits 2200 which is *intangibles* in the template), arbitrary magic-number percentages presented as accounting measurements (revenue 10%/5%, goodwill 5%-RoI trigger, foreign-currency `amount/150*150*0.02` which is an algebraic no-op), structurally-dead logic (deferred-tax fixed-asset difference is always 0), and entries that do not balance and are forced even via `雑費`/`雑益` plug accounts. See §7.

---

## 2. Subsystem map — what is actually live

### 2.1 The only live execution path

```
POST /api/conversion/projects/[id]/execute  (execute/route.ts)
  └─ conversionEngine.execute()                                   conversion-engine.ts:100
       ├─ loadMappings()  → AccountMappingService.getByCompany    (isApproved:true only)   :416
       ├─ validateMappings()  → only checks mappings.size > 0                              :433
       ├─ convertJournals() → JournalConverter.convertBatch                               :465
       │     └─ convertSingle → convertAccountLine (1to1/1toN/Nto1/complex)               :283
       ├─ FinancialStatementConverter.convertBalanceSheet / convertProfitLoss / convertCashFlow :170
       └─ saveResult()  → prisma.conversionResult.create (journalConversions+BS+PL+CF; NO adjustingEntries/disclosures) :506
```

### 2.2 Reachability of the generated surface area (production callers)

| Component | Live in production? | Evidence |
|---|---|---|
| `ConversionEngine`, `JournalConverter`, `FinancialStatementConverter`, `AccountMappingService`, `ConversionProjectService`, `COAImporter`, `COAValidator` | **Yes** | called by conversion API routes / execute path |
| `AdjustmentCalculator` + all 8 `adjustments/*` strategies | **No** (tests only) | `adjustmentCalculator`/`AdjustmentCalculator`/`calculateAll`/`generateRecommendations` appear in `src` **only inside `adjustment-calculator.ts` itself**; every other `generateRecommendations` hit is an unrelated class (valuation/qa, financial-analyzer, import-auditor, dd/report-generator) |
| `DisclosureGenerator` | **No** | `disclosureGenerator`/`DisclosureGenerator` referenced only inside its own file; no disclosure API route exists |
| `AuditTrailService` | **No** | `auditTrailService` referenced only inside its own file (+ tests/docs) |
| `RationaleGenerator` | **No** | `rationaleGenerator` referenced only inside its own file (+ tests) |
| `AIConversionAdvisor` | **Partial** | only `suggestMappings` is reachable, via `mappings/suggest/route.ts`; `analyzeConversion`, `suggestAdjustments`, `assessRisks`, `generateDisclosures`, `reviewQuality` have no production caller. Suggestions are advisory and are **not** persisted to `AccountMapping` by that route |

**Implication:** the entire "standard-difference adjustment" and "disclosure/rationale/audit-trail" machinery — the parts that distinguish a real standard *conversion* from a mere chart-of-accounts *relabeling* — is dead in the running system. **PENDING HUMAN DETERMINATION** whether this is intended phasing (build-then-wire) or an integration omission.

---

## 3. Finding — adjustment entries are never generated (dead subsystem)

**Severity: critical (feature gap).**

**Evidence.** `conversion-engine.ts:154-209` — `execute()` converts journals and FS only:

```ts
const journalConversions = await this.convertJournals(...)          // :154
...
const [bs, pl, cf] = await Promise.all([ fsConverter.convertBalanceSheet(...), ... ])  // :174
...
const result = await this.saveResult({ projectId, journalConversions, balanceSheet, profitLoss, cashFlow,
                                       conversionDurationMs, warnings: [], errors: [] })  // :200
```

`saveResult` (`:506-545`) builds the persisted `ConversionResult` from exactly those fields; `adjustingEntries`, `disclosures`, `aiAnalysis` (all optional on the type, `types/conversion.ts:815-830`) are never set. The `generateAdjustingEntries` setting is referenced exactly once, at `:286`, inside `dryRun()`:

```ts
adjustingEntries: project.settings.generateAdjustingEntries ? 10 : 0,   // hardcoded constant
```

i.e. the dry-run *forecast* is a literal `10`, not a computed count. A repository-wide search (`[Aa]djustmentCalculator|calculateAll|generateRecommendations`) returns matches only inside `adjustment-calculator.ts` and unrelated classes — there is no call site in the engine, the project service, or any API route. Downstream symptom: `lib/conversion/exporters/pdf-exporter.ts:46` has an adjusting-entries section keyed off `result.adjustingEntries`, which is therefore always empty in exported PDFs.

**Impact.** A "conversion" produces a re-mapped trial balance and re-aggregated statements under the target codes, but performs **no JGAAP→IFRS/USGAAP difference adjustments** (leases, revenue recognition, financial instruments, deferred tax, retirement benefits, FX, business combinations, goodwill impairment). The output is a re-labeled chart of accounts, not a standard-converted set of financial statements.

**Proposed change (concrete).** Wire `AdjustmentCalculator` into `execute()`: after journal conversion, build `SourceFinancialData` from the source BS/PL/journals/fixed assets/debts/leases, call `adjustmentCalculator.calculateAll(projectId, sourceData, targetStandard)` gated on `project.settings.generateAdjustingEntries`, validate each entry balances (`validateAdjustingEntry`), and include the survivors in the `ConversionResult.adjustingEntries` field that `saveResult` already (de)serializes. Replace the dry-run literal `10` with the actual applicable-type count from `getApplicableTypes`. **PENDING HUMAN DETERMINATION** on whether to wire the calculator as-is (given the per-strategy defects in §7) or to first repair the strategies.

---

## 4. Finding — converted P&L is scrambled by code-range category inference

**Severity: critical (correctness).**

**Evidence.** The PL converter categorizes lines purely by numeric code range:

```ts
// financial-statement-converter.ts
private aggregateByTargetAccount(...) {
  ...
  category: this.inferCategoryFromCode(line.targetAccountCode),   // :440  — only source of category for PL
}
private inferCategoryFromCode(code: string): AccountCategory {     // :470
  const codeNum = parseInt(code, 10); if (isNaN(codeNum)) return 'sga_expense'
  if (codeNum >= 1000 && codeNum < 2000) return 'current_asset'
  if (codeNum >= 2000 && codeNum < 3000) return 'fixed_asset'
  if (codeNum >= 3000 && codeNum < 4000) return 'deferred_asset'   // ← disagrees with templates
  if (codeNum >= 4000 && codeNum < 5000) return 'current_liability'
  if (codeNum >= 5000 && codeNum < 6000) return 'fixed_liability'
  if (codeNum >= 6000 && codeNum < 7000) return 'equity'           // ← revenue lands here
  if (codeNum >= 7000 && codeNum < 8000) return 'revenue'          // ← COGS lands here
  if (codeNum >= 8000 && codeNum < 9000) return 'cogs'             // ← SGA lands here
  ...
}
```

`convertProfitLoss` (`:159-263`) switches on `data.category` with cases `revenue | cogs | sga_expense | non_operating_income | non_operating_expense` — no `equity`/`deferred_asset` cases, so any line bucketed there is **silently dropped**.

**The shipped templates use a different scheme.** From `templates/ifrs-coa-template.ts` and `templates/usgaap-coa-template.ts`:

| Code range | Template category | `inferCategoryFromCode` says | Result in converted PL |
|---|---|---|---|
| 3100–3400 | `current_liability` | `deferred_asset` | (liabilities — dropped from PL, harmless) |
| 4100–4400 | `fixed_liability`/`deferred_liability` | `current_liability` | (liabilities — dropped from PL, harmless) |
| 5100–5400 | `equity` | `fixed_liability` | (equity — dropped from PL, harmless) |
| **6100–6120** | **`revenue`** | **`equity`** | **Revenue DROPPED** |
| **7100** | **`cogs`** | **`revenue`** | **COGS reported as revenue** |
| **8100–8180** | **`sga_expense`** | **`cogs`** | **SGA reported as cost of sales** |
| 9100–9140 | `non_operating_expense` (finance cost) | `sga_expense` | finance cost → SGA |
| 9200–9230 | `non_operating_income` (finance income) | `sga_expense` | finance **income** → SGA expense |
| 9300–9320 | `non_operating_expense` (income tax) | `sga_expense` | tax → SGA |

(`incomeBeforeTax` and `netIncome` are also set equal to `ordinaryIncome` — `:213-214`, `:260-261` — so tax is never deducted even where it is captured.)

**Why BS is fine.** `convertBalanceSheet` ignores the inferred category and re-derives it from the DB: `accountMap.get(accountCode).category` via `fetchTargetAccounts(targetCoaId)` (`:83-84`, `:105`). `convertProfitLoss` does **not** receive `targetCoaId` and has no equivalent DB lookup (`conversion-engine.ts:182-188` passes it only to BS).

**Impact.** With the shipped templates and the default mapping suggestions (which target these exact codes — `default-mappings.ts` revenue→6100, COGS→6200/6100-family, SGA→7100+), the converted P&L is unusable: real revenue vanishes, COGS inflates revenue, SGA becomes gross-profit input. Gross profit, operating income, and net income are all wrong.

**Proposed change (concrete).** Make PL categorization use the same source BS already uses: pass `targetCoaId` into `convertProfitLoss`, fetch target-account categories once (`fetchTargetAccounts`), and bucket by DB `category` instead of `inferCategoryFromCode`. Delete `inferCategoryFromCode` (or keep only as a last-resort fallback with a loud warning). Separately, introduce an `income_tax`/`tax` category (see §6/§8) and compute `netIncome = incomeBeforeTax − tax`. **PENDING HUMAN DETERMINATION** on whether to also re-derive BS categories from DB for consistency (already done) and whether the cash-flow section mapping (§8) should switch to the same DB-category source.

---

## 5. Finding — 1-to-N (and conditional complex) mapping cannot produce split output

**Severity: high (correctness/feature).**

**Evidence.**

(a) **Data model forbids it.** `schema.prisma:1010` — `@@unique([companyId, sourceItemId, targetCoaId])`. A single source item can map to exactly one target item per target COA, so there is no place to store a second target for a 1-to-N split.

(b) **The converter never splits.** `journal-converter.ts:399-452` (`createSplitLines`) emits exactly one line. With a percentage rule it scales that single line; without one it falls back to a direct line + warning:

```ts
lines.push(this.createDirectLine(mapping, debitAmount, creditAmount))
warnings.push('1toN mapping without percentage rule, using direct mapping')   // :432-433
```

(c) **Condition-matched targets are computed then discarded.** Both `createSplitLines` (`:411-429`) and `createComplexLines` (`:471-511`) call `ruleEngine.evaluateConditions(...)` and receive a `targetAccountId`, then push a line using `mapping.targetAccountCode`/`targetAccountName` — the mapping's *primary* target — ignoring the matched id:

```ts
const targetAccountId = this.ruleEngine.evaluateConditions(rule.conditions, {...})  // :412
if (targetAccountId) {
  lines.push({ ...mapping.targetAccountCode, mapping.targetAccountName, ... })     // :419 — matched id unused
}
```

**Impact.** A core need in standard conversion — splitting one JGAAP account across several IFRS/USGAAP accounts (e.g., one payroll account split into "employee benefits" vs "officer compensation"; R&D split into expensed research vs capitalized development; a single asset split into ROU vs non-ROU) — is not supported. Selecting different targets by condition (amount band, partner, tag) is also a no-op.

**Proposed change (concrete).** Either (i) drop `1toN`/`complex` from the UI and type union and document mapping as strictly 1:1 (matching the unique constraint), or (ii) model splits properly: relax the unique constraint to allow multiple `targetItemId` per `sourceItemId`+`targetCoaId` (or introduce a `MappingSplit` child table with `targetItemId` + `percentage`), and have the converter iterate splits to emit one line per target, applying each split's rule. Wire `evaluateConditions`' matched `targetAccountId` into the emitted line. **PENDING HUMAN DETERMINATION** on option (i) vs (ii) — note (ii) touches `prisma/schema.prisma`, a Class-A path excluded from this task's edit scope, so it would be a separate change request.

---

## 6. Finding — mapping coverage gaps and a dead name-matching path

**Severity: medium.**

**Evidence — `default-mappings.ts`.**

(a) **Two inconsistent code schemes within one file.** `CATEGORY_MAPPINGS` (Nto1 fallback) assigns `current_liability→3000`, `equity→4000`, `revenue→5000`, `cogs→6000`, `sga→7000` (`:22-121`); `JGAAP_TO_TARGET` (1to1) assigns `AP→3100`, `common stock→5100`, `revenue→6100`, `salaries→7100` (`:123-298`). These disagree with each other and with `inferCategoryFromCode` (§4). A third scheme lives in the templates. Three mutually inconsistent code→category maps.

(b) **Keyword fallback is dead.** `matchSourceAccount` (`:390-404`) extracts keywords from the account *name* and tests them against `patternStr` — but `patternStr` is the numeric regex source (e.g. `/^1[0-9]{3}$/`), which contains no Japanese/English name tokens, so the test can never succeed:

```ts
const patternStr = pattern.toString().toLowerCase()     // "/^1[0-9]{2}$/" — no keywords
for (const keyword of keywords) {
  if (patternStr.includes(keyword.toLowerCase())) { ... }   // always false
}
```

The `jgaapKeywords` arrays (`:131`ff) are never carried onto the emitted `DefaultMappingSuggestion` at all (`generateDefaultMappings`, `:325-337`). So name-based matching does not function; only numeric code patterns match.

(c) **Coverage omissions.** No suggestions for: consumption-tax accounts (仮払/仮受消費税), allowance for doubtful accounts (貸倒引当金), accrued/deferred revenue specifics, retirement benefit liability (退職給付引当金), lease accounts (despite a lease *adjustment* strategy), goodwill (のれん), research/development split, treasury stock, OCI components. The Nto1 fallback confidence is `0.7` (`:319`).

**Evidence — `coa-importer.ts`.** `CATEGORY_MAPPING` (`:39-66`) has no key for `finance_cost`, `income_tax`, `impairment`/`impairment_loss` — categories the templates themselves use — so importing a COA row tagged with one of them is rejected `INVALID_CATEGORY` (`:208-216` CSV / `:418-426` Excel). CSV import also splits on physical newlines before quote-aware parsing (`:90`), breaking quoted cells that contain embedded newlines.

**Impact.** Auto-suggested mappings miss common Japanese accounts and cannot match by name; the default end-to-end path under-maps, and unmapped accounts are passed through with their JGAAP code (see §8), which then either drop out of the BS or get miscategorized in the PL.

**Proposed change (concrete).** (1) Consolidate to a single authoritative code→category map (derive it from the templates, or better, always read category from the target `ChartOfAccountItem.category` and stop inferring). (2) Either remove the dead keyword path or make it match name→keyword properly (store `jgaapKeywords` on the suggestion and match against the source name, not the regex source). (3) Extend `CATEGORY_MAPPING`/default suggestions to cover the missing account families; add `income_tax` and `impairment` categories. (4) Make CSV import quote-aware across newlines (parse RFC-4180 fields before splitting rows). **PENDING HUMAN DETERMINATION** on the target coverage list and whether to source categories from DB exclusively.

---

## 7. Finding — adjustment strategies are incorrect even if wired in

**Severity: high (correctness) — and currently masked only because the subsystem is dead (§3).**

All eight strategies share the same failure modes. Sampled in detail: `lease-classification`, `deferred-tax`, `revenue-recognition`, `goodwill-impairment` (read directly); `financial-instrument`, `retirement-benefit`, `foreign-currency`, `business-combination` (agent-reviewed, citations below). Systemic defects:

### 7.1 Hardcoded account codes collide with the shipped templates
Each strategy posts to fixed codes that mean something *else* in the IFRS/USGAAP templates:

| Strategy | Code used (meaning claimed) | Same code in IFRS template |
|---|---|---|
| lease | `2200` 使用権資産 / `3100` リース負債 (`lease-classification.ts:73,79`) | `2200`=無形資産 (intangibles) / `3100`=買掛金 (trade payables) |
| deferred tax | `1650` DTA / `4650` DTL / `9430` (`deferred-tax.ts:54,70,87`) | DTA=`2500`, DTL=`4400`; `9430` undefined |
| revenue | `7000` 売上高 / `4200` 前受収益 / `1300` 未収収益 (`revenue-recognition.ts:74,79,87,93`) | `7000` undefined; revenue=`6100`; deferred rev=`3210`; accrued=`3121` |
| goodwill | `9280` 減損 / `2600` のれん (`goodwill-impairment.ts:49,56`) | impairment=`9500/9510`; goodwill=`2210` |
| financial-instrument | `1690`,`6900`,`2550`,`9650`,`9550` (`financial-instrument.ts:71,79,86,97,104,111`) | none in any template band |
| retirement-benefit | `5310`,`9370`,`6950`,`1790` (`retirement-benefit.ts:55,89,99,196`) | `5310` is equity band; pension liability=`4200` |
| foreign-currency | `4550`,`6750` (`foreign-currency.ts:93,111`) | neither in any band |
| business-combination | `2600`,`2500`,`4900`,`9800`,`9490`,`9390` (`business-combination.ts:64,82,101,117,198,205`) | `4900` undefined; contingent liability not in any band |

**Impact:** adjustment lines, if persisted, would attach amounts to the wrong target accounts (e.g., a lease ROU asset booked to *intangibles*; trade payables inflated by a lease liability).

### 7.2 Arbitrary magic-number percentages presented as accounting measurements
- revenue: `amount * 0.1` and `* 0.05` (`revenue-recognition.ts:139,150`) — flat 10%/5% of a balance, not an IFRS-15 5-step analysis.
- goodwill: impairment triggered when `operatingIncome/totalAssets < 0.05`, loss = `goodwill × min(1,(0.05−RoI)/0.05)` (`goodwill-impairment.ts:106-111`) — not an IAS-36 recoverable-amount test; CGU hardcoded `本社`.
- financial-instrument: flat 2% / 1% fair-value uplift (`financial-instrument.ts:161,178`).
- retirement-benefit: `dbo*(rate−0.015)`, `planAssets*0.03`, `dbo*0.01`, `dbo*-0.005` (`retirement-benefit.ts:165-168`).
- business-combination: `goodwill*0.05`, `intangibles*0.10`, `goodwill*0.02` (`business-combination.ts:174-176`).
- **foreign-currency is an algebraic no-op:** `foreign-currency.ts:173-175` computes `amount / 150 * 150 * 0.02`, which equals `amount * 0.02`; the "translation at the closing rate" described in `descriptionEn` never occurs (the `DEFAULT_EXCHANGE_RATE = 150` constant has zero effect). Same at `:196-198`.

### 7.3 Structurally-dead detection logic
- **deferred tax fixed-asset branch is always zero.** `deferred-tax.ts:129-142`:
  ```ts
  const bookValue = asset.netBookValue
  const impliedTaxBase = asset.acquisitionCost - asset.accumulatedDepreciation  // == netBookValue by definition
  const diff = bookValue - impliedTaxBase                                          // always 0
  ```
  The primary driver of deferred tax (depreciation timing between book and tax) produces nothing. (There is no tax-base data in `SourceFinancialData` at all — the "tax base" is assumed equal to accounting NBV.)

### 7.4 Entries that do not balance, forced via plug accounts
- **deferred tax** with mixed DTA+DTL: Dr DTA 100, Cr DTL 50, then balancing line Cr 100 (`deferred-tax.ts:84-92`) → total debit 100 vs total credit 150; `validateAdjustingEntry` (`adjustments/types.ts:143-165`, ±0.01 tolerance) rejects and the entry is silently dropped (`adjustment-calculator.ts:58-63`). Real mixed cases never surface.
- **retirement-benefit** and **business-combination** are unbalanced by construction and only balance because a `balanceEntry` helper pushes the residual into `雑費`/`雑益` (`retirement-benefit.ts:186-210`; `business-combination.ts:188-212`). The plug account — not the economics — makes debits equal credits.

### 7.5 Fragile applicability detection
Every strategy detects its trigger by Japanese/English substring matching on account names (e.g., `name.includes('リース')`, `'退職'`, `'外貨'`, `'のれん'`, `'投資有価証券'`). Any synonym, language variant, or different naming convention is missed. Several strategies also have an `isApplicable`/`calculate` scope mismatch: `isApplicable` scans a superset of what `calculate` reads, so a project can be flagged applicable yet produce `null` (financial-instrument `:10-34` vs `:156-172`; foreign-currency `:31-42` vs balance-sheet-only; business-combination `:46-52` omits `bargainPurchaseGain`).

**Impact.** Even after the §3 wiring fix, the adjustment output would be wrong-coded, fabricated in magnitude, sometimes silently dropped, and sometimes only "balanced" by dumping residuals into misc expense/income.

**Proposed change (concrete).** (1) Replace hardcoded account codes with lookups against the target COA by `subcategory`/`category` (the templates already tag `lease`, `tax`, `impairment`, `pension`, `intangible`, `investment` subcategories). (2) Remove magic-% heuristics; require real driver data (lease cash flows + term + incremental borrowing rate; tax base vs carrying amount; recoverable amount) and emit `null` with a "要確認" flag when the data is absent — consistent with the project's `uncertain isolated` policy. (3) Fix the deferred-tax tax-base computation (introduce a tax-base input). (4) Make each strategy emit balanced double-entry by construction; remove the `雑費`/`雑益` plug. (5) Replace substring detection with category/subcategory-based detection. **PENDING HUMAN DETERMINATION** on data-source availability for real driver amounts (leases, tax bases, pension DBO) — if unavailable, the strategies may need to become advisory-only.

---

## 8. Finding — engine, validation, and statement-conversion weaknesses

**Severity: medium–high.**

- **Mapping validation is trivial.** `validateMappings` (`conversion-engine.ts:433-447`) only checks `mappings.size === 0`. It does not detect unmapped source accounts (the dry-run separately calls `findUnmappedAccounts`, but execution itself does not), low-confidence mappings, or target codes absent from the target COA.
- **Unmapped accounts pass through silently.** `journal-converter.ts:297-313` emits a line with `targetAccountCode = accountCode` (the JGAAP code) and `targetAccountName = "UNMAPPED: …"`. In the BS aggregator, `accountMap.get(accountCode)` then returns `undefined` → `continue` (dropped from BS, `financial-statement-converter.ts:93-94`); in the PL aggregator it is categorized by `inferCategoryFromCode` on the *JGAAP* code. No error is raised; the count appears only in dry-run warnings.
- **Source account codes are free text.** `Journal.debitAccount`/`creditAccount` are `String` with no FK to `ChartOfAccountItem` (`schema.prisma:115-116`) and no validation that they equal source-COA codes. Any divergence (e.g., freee's code space) makes every journal "UNMAPPED".
- **Only one direction.** `conversion-project-service.ts:41-46` hardcodes `sourceStandardId = JGAAP`. The task title's bidirectional `<->` (IFRS/USGAAP → JGAAP) is unsupported.
- **Tax is never deducted.** `convertProfitLoss` sets `incomeBeforeTax === netIncome === ordinaryIncome` (`financial-statement-converter.ts:213-214, 260-261`); there is no `tax`/`income_tax` category in `AccountCategory` (`types/conversion.ts:31-45`) — the template's 法人税 (`9300`) is filed under `non_operating_expense`.
- **Cash flow depends on pre-existing, string-matched rows.** `convertCashFlow` (`:265-341`) maps each target account to an operating/investing/financing section via `prisma.cashFlow.findMany` keyed by `cf.itemName` string-equal to the target account code (`:490-513`). If no `CashFlow` rows exist (or names don't match codes), every line is skipped → an empty CF statement. CF sign conventions are also ignored (capex not negated).
- **`asOfDate`/period math.** `convertBalanceSheet` computes `asOfDate` from `fiscalYear = periodStart.getFullYear()` and `month = periodEnd.getMonth()+1` (`conversion-engine.ts:171-172`, `financial-statement-converter.ts:126-128`). For a fiscal year crossing calendar years (e.g., 2024-04 → 2025-03), this yields March-end *2024*, not 2025. PL period end uses the same `fiscalYear`/`month` (`:216-217`).
- **Excel export is CSV.** `AccountMappingService.exportToExcel` returns `exportToCSV(...)` verbatim (`account-mapping-service.ts:739-752`) — the "excel" format emits CSV bytes.
- **Circular-reference check is not company-scoped.** `checkCircularReference` traverses `accountMapping.findMany({ where: { sourceItemId: currentId } })` with no `companyId` filter (`account-mapping-service.ts:632-635`), so another company's mappings can produce a false circular-reference failure.

**Proposed change (concrete).** (1) Harden `validateMappings`: require every source account used in-period to have an approved mapping; warn on confidence < threshold; reject target codes not in the target COA. (2) Decide an explicit policy for unmapped accounts (fail-fast vs. flag-and-include) instead of silent passthrough. (3) Add `income_tax`/`tax` category and compute net income after tax. (4) Derive CF section from target-account category/subcategory rather than external `CashFlow.itemName` strings; apply sign conventions. (5) Fix period/as-of date to use `periodEnd`'s calendar year for the statement date. (6) Implement a real Excel export or rename the option. (7) Scope the circular-reference BFS to `companyId`. **PENDING HUMAN DETERMINATION** on the unmapped-account policy and on whether reverse-direction (IFRS→JGAAP) conversion is in scope.

---

## 9. Finding — dead supporting services and unvalidated AI output

**Severity: medium.**

- **`DisclosureGenerator`, `AuditTrailService`, `RationaleGenerator` are entirely dead** (no production importer — §2.2). When revived, note their own defects: `disclosure-generator.ts` writes AI-enhanced content to the DB with no validation (`:124-130`), swallows per-category errors (`:42-49`), renders difference/impact tables as literal `-` placeholders (`:503-522`), and never sets `sortOrder` while ordering by it (`:295-310` vs `:162`); `audit-trail-service.ts` advertises `excel`/`pdf` export that throws "not yet implemented" (`:265-273`), silently truncates at 10 000 rows (`:266`), and displays stale denormalized user names (`:379-380`).
- **`AIConversionAdvisor` is partially live.** Only `suggestMappings` is reachable (`mappings/suggest/route.ts`); suggestions are advisory and are **not** persisted to `AccountMapping` by that route (persistence happens elsewhere after approval). Mock responses fabricate fixed code pairs (`1000→1100`…) with high confidence regardless of the real COA (`ai-conversion-advisor.ts:37-57, 215-227`). A shared `timeoutPromise` is reused across retries, so once the 60 s timer fires every subsequent retry races an already-rejected promise and the retry/backoff logic cannot recover (`:116-130`); the `setTimeout` is also never cleared (leaky timer). `standardId: 'jgaap'` is hardcoded (`:499`), and Prisma rows are cast `as unknown as` domain types in several places (`:468, 492, 507`).
- **`RationaleGenerator`** (dead) trusts AI/mock output without schema or bound validation (`rationale-generator.ts:346-367`), returns context-free fabricated references/impact in mock mode (`:137-155`), ignores its `mappings`/`targetFS` parameters (`:264-267, 305-308`), and has a leaky uncleared timeout (`:107-109`).

**Proposed change (concrete).** Before wiring any of these in: validate AI output with a Zod schema and bound `confidence` to [0,1]; clear timeout timers on success; construct the timeout promise inside the retry loop; replace mock fabrications with explicit "mock" markers; stop shadowing live `User` data with denormalized `notes`; implement advertised export formats or narrow the signature. **PENDING HUMAN DETERMINATION** on which of these services are intended to ship.

---

## 10. Proposed test vectors

Each vector is a concrete input → expected behavior. The "current behavior" column reflects the code as read; the "proposed assertion" is what a corrected system should satisfy. All **PENDING HUMAN DETERMINATION** as to whether they should be added as unit/integration tests (they would require no source edits to *write*, only to *pass*).

| # | Target | Input | Proposed assertion (corrected) | Current behavior (as read) |
|---|---|---|---|---|
| TV-1 | `FinancialStatementConverter.convertProfitLoss` | `journalConversions` with one revenue line `targetAccountCode:'6100'`, debit 0 / credit 1 000 000; one COGS line `'7100'` debit 600 000 | `result.revenue[0].amount === 1_000_000`; `result.costOfSales[0].amount === 600_000`; `grossProfit === 400_000` | revenue dropped (6100→`equity`); COGS reported as revenue; `grossProfit` wrong |
| TV-2 | `inferCategoryFromCode` removal | call with `'6100'` | returns category sourced from target COA DB (`revenue`) | returns `'equity'` |
| TV-3 | `JournalConverter` 1toN | a `1toN` mapping with two splits 60%/40% to targets A,B; one journal hitting the source | emits **two** lines (A×0.6, B×0.4), balancing | emits one line (DB unique constraint forbids 2 targets; `createSplitLines` emits 1) |
| TV-4 | condition routing | a `complex` mapping whose condition matches target X for amount > 1000 | emitted line targets X | matched `targetAccountId` discarded; primary target used |
| TV-5 | `ConversionEngine.execute` adjustment wiring | project with `generateAdjustingEntries:true` + a detectable operating lease in source data | `result.adjustingEntries.length >= 1` | `result.adjustingEntries` is `undefined` (calculator never called) |
| TV-6 | `dryRun` adjustingEntries count | project as above | count equals `getApplicableTypes(...).length` | always literal `10` |
| TV-7 | `DeferredTaxAdjustment` fixed-asset diff | a `FixedAsset` with `netBookValue` ≠ tax base | non-zero temporary difference | always 0 (`impliedTaxBase === netBookValue`) |
| TV-8 | `ForeignCurrencyAdjustment` rate effect | two runs with `DEFAULT_EXCHANGE_RATE` 150 vs 100 | adjustment differs | identical (`/r * r * 0.02` cancels) |
| TV-9 | `validateAdjustingEntry` on mixed deferred tax | DTA +100, DTL +50, balancing Cr 100 | entry rejected (or strategy emits a balanced entry) | rejected and silently dropped |
| TV-10 | `COAImporter` categories | a CSV row with `category=income_tax` | accepted | rejected `INVALID_CATEGORY` |
| TV-11 | `COAImporter` embedded newline | a quoted cell containing `\n` | parsed as one field | split across two rows |
| TV-12 | `matchSourceAccount` name fallback | source name `現金預金`, no numeric match | matches the cash suggestion | never matches (tests name vs numeric regex) |
| TV-13 | `convertProfitLoss` tax | revenue/expense set + a tax line | `netIncome === incomeBeforeTax − tax` | `netIncome === incomeBeforeTax === ordinaryIncome` |
| TV-14 | `convertCashFlow` with no CashFlow rows | journalConversions present, `prisma.cashFlow` empty | non-empty CF derived from account categories | empty CF (every line skipped) |
| TV-15 | `convertBalanceSheet` as-of date | periodStart 2024-04-01, periodEnd 2025-03-31 | `asOfDate === 2025-03-31` | `asOfDate === 2024-03-31` |
| TV-16 | adjustment account codes | any strategy emitting a line | every `line.accountCode` exists in the target COA template | codes collide with unrelated template accounts (§7.1) |
| TV-17 | unmapped account policy | a journal hitting an unmapped source code | execution fails or flags review (per chosen policy) | silent passthrough, dropped from BS |

---

## 11. Suggested remediation ordering (analysis, not a decision)

Presented only as a sequencing suggestion for the human reviewer. Each item is **PENDING HUMAN DETERMINATION**.

1. **Decide scope first.** Confirm whether adjustment/disclosure/rationale/audit-trail generation is intended to be live (§3, §9). If yes, the rest follows; if deliberately deferred, document it and trim the dead surface from the execution-path UI/export claims.
2. **Fix the converted P&L (§4) and add `income_tax` handling (§8).** This is the highest-impact correctness defect on the *live* path and is independent of the adjustment subsystem. Single-source category from the target COA; remove `inferCategoryFromCode`.
3. **Decide 1-to-N policy (§5).** Either remove the fiction or model splits (schema change — separate CR, Class-A).
4. **Repair mapping coverage and the dead name matcher (§6).** Low risk, improves auto-suggestion quality.
5. **If adjustments are to be live, repair strategies (§7)** — codes-via-subcategory, remove magic %/plugs, fix deferred-tax tax-base, balanced-by-construction — *then* wire per §3.
6. **Harden validation, unmapped-account policy, CF derivation, date math, Excel export, company-scoping (§8).**

---

## 12. Files examined (read-only)

**Services (`src/services/conversion/`):** `conversion-engine.ts`, `conversion-project-service.ts`, `journal-converter.ts`, `financial-statement-converter.ts`, `mapping-rule-engine.ts`, `account-mapping-service.ts`, `adjustment-calculator.ts`, `adjustments/{types,lease-classification,deferred-tax,revenue-recognition,goodwill-impairment,financial-instrument,retirement-benefit,foreign-currency,business-combination}.ts`, `disclosure-generator.ts`, `audit-trail-service.ts`, `ai-conversion-advisor.ts`, `chart-of-account-service.ts` (referenced). **Lib (`src/lib/conversion/`):** `default-mappings.ts`, `coa-validator.ts`, `coa-importer.ts`, `rationale-generator.ts`, `templates/{ifrs,usgaap}-coa-template.ts`. **Types:** `src/types/conversion.ts`. **Schema:** `prisma/schema.prisma` (`Journal`, `AccountMapping`, `ChartOfAccountItem`). **Routes:** `api/conversion/projects/[id]/execute/route.ts`, `api/conversion/mappings/route.ts`, `api/conversion/mappings/suggest/route.ts`. **Other:** `lib/conversion/exporters/pdf-exporter.ts` (referenced for downstream symptom).

**Not individually line-audited in this pass** (correctness of these specific lines is **PENDING HUMAN DETERMINATION**): `conversion-export-service.ts`, `conversion-rationale-service.ts`, `approval-workflow-service.ts`, `standard-reference-service.ts`, `accounting-standard-service.ts`, `chart-of-account-service.ts` body, the `exporters/*` and `disclosure-templates/*` modules beyond the symptom reference above, and the conversion UI components.

---

*End of analysis. No source files were modified. All conclusions are **PENDING HUMAN DETERMINATION**.*
