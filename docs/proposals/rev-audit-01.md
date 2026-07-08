# REV-AUDIT-01 — Journal-Audit Determination Logic Review (AUDIT-ONLY)

> **Status:** Analysis for a human reviewer. Every conclusion is marked
> **`PENDING HUMAN DETERMINATION`**. This document contains no approvals, no
> reviewer names, and no sign-offs. It proposes changes; it does not decide them.
>
> **Task type:** READ-ONLY audit. No source files were modified. The only artifact
> produced by this task is this file.
> **Scope reviewed:** `src/services/audit/**`, `src/app/api/audit/**`, plus the
> transitively-reachable verdict paths (`src/services/ai/analysis-service.ts`,
> `src/jobs/audit-job.ts`, `src/jobs/scheduler.ts`) and the data model
> (`prisma/schema.prisma` `Journal` / `AuditResult` / `Document`).
> **BACKLOG driver:** `BACKLOG.md:60-62` — *監査精度向上, 目標 >95%（現状: 未測定）*.

---

## 0. TL;DR (the single most important finding)

There is **no single journal-audit verdict engine**. Determination logic is spread
across **five independent code paths** with **incompatible status vocabularies,
different thresholds, and different rules**, and most of the rule logic in
`src/services/audit/**` is **not reachable from any production path** (tests only).

The only production path that exercises `src/services/audit/**` is the scheduled
batch (`audit-job.ts` → `JournalChecker.check()`). The user-facing audit API
(`POST /api/audit/journal`) uses a *different* engine (`analyzeJournalEntry`) that,
in the documented dev default (`AI_MOCK_MODE=true`), reduces to a 4-check stub.

Consequences for the ">95% accuracy" target:

1. **The target is currently undefined.** There is no golden/labeled dataset, no
   single engine to score, and no precision/recall instrumentation. "Accuracy"
   cannot be measured, so ">95%" cannot be verified or falsified. `PENDING HUMAN DETERMINATION`
2. **The live engines are default-pass biased**, so a headline ">95% pass" is
   trivially achievable but meaningless (everything passes when no receipt is
   attached and only `error`-severity issues fail an entry). `PENDING HUMAN DETERMINATION`
3. **Two audit subsystems do not share state.** The API computes verdicts in memory
   and never persists `AuditResult` rows; the scheduled job does persist them. The
   `/api/audit/results` view therefore shows a different (and disjoint) population
   than `/api/audit/journal`. `PENDING HUMAN DETERMINATION`

---

## 1. Reachability map (who actually calls each verdict function)

| Function / class | File | Production caller? | Verdict-bearing? | Notes |
|---|---|---|---|---|
| `JournalChecker.check()` / `.batchCheck()` | `journal-checker.ts` | **YES** — `audit-job.ts:155` (via `scheduler.ts`) | Yes | The only live rule engine in `services/audit/**` |
| `ReceiptAnalyzer.analyzeBuffer()` | `receipt-analyzer.ts` | **YES** — `audit-job.ts:104` | Indirect (feeds `JournalChecker`) | Produces `DocumentAnalysisResult` |
| `analyzeJournalEntry()` | `services/ai/analysis-service.ts` | **YES** — `api/audit/journal/route.ts:92` (POST) | Yes | Generic LLM call; *not* in `services/audit/**` |
| `generateMockIssues()` | `api/audit/journal/route.ts:140` | **YES** — `api/audit/journal/route.ts:41` (GET) | Weak | 3-check hardcoded heuristic |
| `analyzeJournal()` | `services/audit/index.ts:26` | **NO** (tests only: `audit.test.ts`, `audit-service-extended.test.ts`) | Would-be | Confidence-score engine — **dead code** |
| `getAuditStatus()` | `services/audit/index.ts:145` | **NO** (tests only) | No (aggregation) | Counts `auditStatus`; **dead code** |
| `checkAccountingBasis()` / `checkRevenueExpenseMatching()` / `getMonthlyAccrualStatus()` | `accounting-basis-check.ts` | **NO** (tests only) | Would-be | Accrual-basis heuristics — **dead code** |
| `auditExpenseItems()` / `checkDuplicateExpenses()` / `checkTripConsistency()` | `expense-audit.ts` | **NO** (tests only) | Would-be | Travel-expense heuristics — **dead code** |
| `results/route.ts` POST | `api/audit/results/route.ts:103` | **YES** (manual write) | Persists only | Writes `AuditResult` + flips `Journal.auditStatus`; does not *compute* a verdict |

**Implication:** the unit tests for `analyzeJournal`, `accounting-basis-check`,
and `expense-audit` are green but exercise code that no user or job can reach.
This matches the repo's known "fake-green test" pattern. Treating those tests as
evidence of audit coverage is unsafe. `PENDING HUMAN DETERMINATION`

---

## 2. The five verdict paths in detail

### Path A — `JournalChecker.check()` (the live scheduled-job engine)

File: `src/services/audit/journal-checker.ts`. Invoked from `audit-job.ts:155`.

**Determination algorithm (lines 32-86):**

1. If `documentData === null` → return `{ isValid: true, issues: [info "証憑なしでスキップ"] }`.
   **A journal with no receipt passes by default.** (lines 38-50)
2. Run six rule checks (`checkDate`, `checkAmount`, `checkTaxAmount`,
   `checkDescription`, `checkAccountAppropriateness`, `checkTaxRelated`), each of
   which may push `error` / `warning` / `info` issues.
3. **AI is only consulted when the rules found nothing**
   (line 59: `if (this.aiProvider?.validateEntry && issues.length === 0)`). The
   hybrid is **one-directional**: rules short-circuit AI; AI can never override a
   rule, and once any rule fires AI is never asked to catch subtler errors.
4. Final verdict (lines 80-85): `isValid = !issues.some(i => i.severity === 'error')`.
   **Only `error`-severity issues fail an entry.** Warnings and info never affect
   the verdict.

**Status mapping in the job** (`audit-job.ts:157`):
`status = validationResult.isValid ? 'PASSED' : 'FAILED'`, then written to both
`AuditResult.status` and `Journal.auditStatus`. `ERROR` is used only for
document-analysis/processing failures (`audit-job.ts:115, 187`).

### Path B — `analyzeJournalEntry()` (the live API POST engine)

File: `src/services/ai/analysis-service.ts:327`. Invoked from
`api/audit/journal/route.ts:92`.

**Determination algorithm:**

1. If `!config.apiKey || AI_MOCK_MODE === 'true'` → `generateMockJournalAnalysis`
   (lines 344-346). Mock flags only: `amount < 0`, `description.length < 3`,
   `!taxType`, future `entryDate`. `isValid = no error-severity issue`
   (lines 421-461). **This is the entire "audit" under the documented dev default.**
2. Otherwise: a free-text prompt is sent to OpenAI `gpt-4` (lines 375-397); the
   first `{...}` blob is regex-extracted and `JSON.parse`d with **no schema
   validation**; `isValid` is taken verbatim from the model (line 394).
3. On any HTTP error, parse failure, or non-`openai` provider → **silent fallback
   to the mock stub** (lines 398-403). No signal to the caller that the real
   engine was bypassed.
4. **The POST handler does not persist `AuditResult` rows** and sets
   `auditStatus: result.isValid ? 'PASSED' : 'ISSUE'` on the *response* only
   (`route.ts:114`). `'ISSUE'` is **not a member of `AuditStatus`**
   (`PENDING|PASSED|FAILED|SKIPPED`, `types/audit.ts:66`) nor of `AuditResultStatus`
   (`PASSED|FAILED|ERROR`, `types/audit.ts:67`).

### Path C — `generateMockIssues()` (the live API GET heuristic)

File: `api/audit/journal/route.ts:140`. Flags short description, missing `taxType`,
negative amount. It does **not** set a verdict; it only decorates entries with the
`auditStatus` already stored on the journal (default `PENDING`).

### Path D — `analyzeJournal()` (DEAD confidence-score engine)

File: `src/services/audit/index.ts:26`. `confidenceScore` starts at `1.0`; fixed
penalties (`amount −0.3`, `date −0.2`, `tax −0.15`); `status =
confidenceScore >= 0.7 ? 'PASSED' : 'FAILED'`. This is a **completely different
verdict semantics** from Path A (error-count) and Path B (LLM opinion). Not
reachable in production.

### Path E — `results/route.ts` POST (manual verdict persistence)

File: `api/audit/results/route.ts:103`. Accepts a pre-computed `status` from the
request body (no Zod validation), writes an `AuditResult` row, and sets
`Journal.auditStatus = status === 'PASSED' ? 'PASSED' : 'FAILED'` (line 136). It
does not compute a verdict; it records one supplied by the caller.

---

## 3. Correctness & accuracy risks (findings)

Each finding lists **Location**, **Problem**, **Failure scenario**, **Proposed
change**, and is `PENDING HUMAN DETERMINATION`.

### F1 — No-document → auto-pass destroys recall (Path A)
- **Location:** `journal-checker.ts:38-50` (consumed via `audit-job.ts`).
- **Problem:** When no receipt is attached, the entry returns `isValid: true`
  immediately. freee journals frequently have no attached receipt, so the majority
  of the population auto-passes without any rule or AI check.
- **Failure scenario:** A ¥5,000,000 consultancy expense with no receipt, wrong
  debit account, and a future date passes the scheduled audit silently.
- **Proposed change:** Distinguish "skipped (no evidence)" from "passed". Either
  emit a distinct `SKIPPED`/`UNVERIFIED` status (the `AuditStatus` enum already has
  `SKIPPED` but no live code produces it), or run the non-document rules
  (account appropriateness, tax-key consistency, date sanity) even when
  `documentData` is null. `PENDING HUMAN DETERMINATION`

### F2 — AI is gated behind clean rules; hybrid is one-directional (Path A)
- **Location:** `journal-checker.ts:59`.
- **Problem:** `validateEntry` runs only when `issues.length === 0`. If any rule
  fires (even a low-value `info`/`warning`), the AI is never consulted, so it can
  neither confirm nor catch additional errors.
- **Failure scenario:** A `warning`-level account-appropriateness flag suppresses
  an AI pass that would have detected an amount-tampering the rules do not cover.
- **Proposed change:** Decide explicitly whether AI should (a) run on every entry,
  (b) run only on rule-clean entries (current), or (c) run on entries with no
  `error`. Document the choice; today it is implicit. `PENDING HUMAN DETERMINATION`

### F3 — Only `error` severity affects the verdict (Path A)
- **Location:** `journal-checker.ts:80-85`.
- **Problem:** `isValid = !hasErrors`. Warnings/info are purely cosmetic. Many
  genuine issues (tax deviation, missing withholding, unusual transport) are
  emitted at `warning` and therefore never fail the entry.
- **Failure scenario:** A consumption-tax mismatch of ¥9 (under the `>10` error
  bar) or a missing-withholding case (always `warning`) is reported but the entry
  still passes.
- **Proposed change:** Define a severity→verdict policy (e.g., warning counts
  toward a confidence threshold) or accept the current behavior explicitly and
  stop surfacing warnings as if they were verdicts. `PENDING HUMAN DETERMINATION`

### F4 — Date comparison is timezone-fragile and silently swallows bad input (Path A)
- **Location:** `journal-checker.ts:88-113`.
- **Problem:** `entry.date` is built in `audit-job.ts:146` as
  `entryDate.toISOString().split('T')[0]` ("YYYY-MM-DD"); `new Date("YYYY-MM-DD")`
  parses as **UTC midnight**. `documentData.date` (a `string | null` from the AI
  provider) is parsed with `new Date(...)` in **local time** if it carries a time,
  or UTC if ISO date-only. `Math.ceil(diffTime / 86400000)` can turn a sub-day,
  same-calendar-day pair into `diffDays === 1`, tripping the default
  `toleranceDays === 0`. Separately, if `documentData.date` is a non-ISO string
  (和暦, "令和6年…", free-form), `new Date()` yields `NaN` and the check is
  **silently skipped** rather than flagged.
- **Failure scenario:** A same-day receipt whose AI-extracted date string includes
  a JST time component is flagged as a 1-day mismatch; a wholly malformed date is
  ignored.
- **Proposed change:** Normalize both dates to a calendar-day comparison in a
  single explicit timezone (e.g., Asia/Tokyo) using year/month/day fields rather
   than epoch-ms subtraction; treat an unparseable document date as a distinct
  issue rather than a silent skip. `PENDING HUMAN DETERMINATION`

### F5 — Consumption-tax check assumes tax-exclusive document amount (Path A)
- **Location:** `journal-checker.ts:265-290`.
- **Problem:** The check compares `entry.taxAmount` against
  `documentData.amount * 0.10` / `* 0.08`. If the receipt amount is tax-inclusive
  (税込, the common case in Japan), the expected tax is overstated and legitimate
  entries are flagged (¥1,100 税込 → expects ¥110 tax vs correct ¥100). There is
  also no handling of mixed-rate receipts (8% food + 10% standard).
- **Failure scenario:** Every standard tax-inclusive receipt with a correct ¥tax
  produces a spurious warning.
- **Proposed change:** Require the provider to return whether `amount` is 税込/税抜
  (extend `DocumentAnalysisResult`), or compute expected tax from a tax-exclusive
  base; tolerate the 8%/10% band and account for mixed-rate receipts.
  `PENDING HUMAN DETERMINATION`

### F6 — Withholding-rate magic number conflates income tax with social insurance (Path A)
- **Location:** `journal-checker.ts:224-241`.
- **Problem:** The withholding check uses a hardcoded `0.10275` whenever the
  description/accounts mention 給与/賞与/源泉/所得税. This number does not correspond
  to the income-tax withholding schedule (which is bracketed and ~10.021% flat for
  monthly salary in the common bracket) and appears to bundle in social-insurance
  burdens. It only triggers when `taxAmount === 0`.
- **Failure scenario:** A correct salary entry whose withholding was recorded under
  a different line is flagged with a spurious "expected ¥X" warning; conversely a
  genuinely under-withheld bonus is not bounded by the real schedule.
- **Proposed change:** Source the rate from a documented table (income-tax
  withholding brackets vs. social-insurance rates), separate the two concerns, and
  gate on the correct account (源泉徴収税) rather than keyword matching.
  `PENDING HUMAN DETERMINATION`

### F7 — Corporate-tax "fiscal year-end" check hardcodes March/Dec/Sep/Jun (Path A)
- **Location:** `journal-checker.ts:250-263`.
- **Problem:** `isFiscalYearEnd = month ∈ {3,12,9,6}` assumes specific fiscal
  year-ends. A company with a September or June FYE, or any non-standard FYE, gets
  misleading `info` flags (or none) regardless of its actual closing month.
- **Failure scenario:** A December-FYE company books 法人税 in March (its true
  year-end) and is told to "verify fiscal year end"; a June-FYE company gets no
  flag at the correct time.
- **Proposed change:** Read the company's actual fiscal year-end month
  (`Company`/`CompanySettings`) instead of a hardcoded set. `PENDING HUMAN DETERMINATION`

### F8 — Account-appropriateness heuristic is brittle substring matching (Path A)
- **Location:** `journal-checker.ts:180-203`, and pervasively in
  `accounting-basis-check.ts` and `expense-audit.ts`.
- **Problem:** Verdict-adjacent logic keys on Japanese substrings
  (`description.includes('売上')`, `debitAccount.includes('費')`, etc.). Account
  names vary across freee tenants, and the conversion subsystem can rename
  accounts entirely (JGAAP↔IFRS/USGAAP). A post-conversion or English-named
  journal may contain none of these substrings and silently pass every
  substring-based rule.
- **Failure scenario:** A converted IFRS journal ("Revenue", "Expense") passes all
  accounting-basis checks because no Japanese keyword matches.
- **Proposed change:** Key checks off account *codes/types* (from the chart of
  accounts / account-items) rather than display-name substrings; fall back to
  substrings only as a heuristic with a documented false-positive/negative caveat.
  `PENDING HUMAN DETERMINATION`

### F9 — API POST emits an invalid status value `'ISSUE'` and never persists (Path B)
- **Location:** `api/audit/journal/route.ts:114` (and the in-memory-only design of
  the whole POST handler).
- **Problem:** `auditStatus: result.isValid ? 'PASSED' : 'ISSUE'`. `'ISSUE'` is not
  in `AuditStatus` (`PENDING|PASSED|FAILED|SKIPPED`) or `AuditResultStatus`
  (`PASSED|FAILED|ERROR`). The POST also writes nothing to `AuditResult` or to
  `Journal.auditStatus`, so the verdict is ephemeral and the `/api/audit/results`
  view (Path E) can never show API-computed verdicts.
- **Failure scenario:** A UI consumer expecting the `AuditStatus` enum receives
  `'ISSUE'` and either crashes or miscategorizes; an auditor re-opening the audit
  later finds no persisted result for API-run audits.
- **Proposed change:** Map to a valid status (`'FAILED'`), persist an
  `AuditResult` row and update `Journal.auditStatus`, or explicitly document that
  the POST is a preview-only endpoint. `PENDING HUMAN DETERMINATION`

### F10 — API GET/POST `stats` are semantically wrong (Path B/C)
- **Location:** `api/audit/journal/route.ts:44-49` and `120-125`.
- **Problem:** `passed = entries.filter(e => e.issues.length === 0)` counts
  "entries with zero issues", not "verdict PASSED" — an entry can be PASSED yet
  carry `info`/`warning` issues. `pending = entries.filter(e => e.auditStatus ===
  'PENDING')` is always `0` on the POST path (which sets PASSED/ISSUE) and
  reflects stale DB state on GET. The four counts are inconsistent with each other
  and with the verdict semantics.
- **Failure scenario:** A dashboard reports "0 passed, 0 pending" for a batch that
  produced 50 PASSED entries, undermining trust in audit reporting.
- **Proposed change:** Derive counts from a single verdict field (e.g.,
  `auditStatus`) with one definition shared by GET and POST. `PENDING HUMAN
  DETERMINATION`

### F11 — `AI_MOCK_MODE` (the documented dev default) reduces the API engine to a 4-check stub (Path B)
- **Location:** `analysis-service.ts:344-346, 405-462`; CLAUDE.md §11 documents
  `AI_MOCK_MODE=true` as the dev default.
- **Problem:** In mock mode the entire API audit is `amount<0`, short description,
  missing `taxType`, future date. Any accuracy measurement performed in dev/mock
  measures the stub, not the real engine. There is also no telemetry distinguishing
  mock-verdicts from real-verdicts in stored results.
- **Failure scenario:** QA reports ">95% accuracy" measured against mock-mode
  output; production behavior is unrelated.
- **Proposed change:** Stamp every `AuditResult`/response with the engine mode
  (`mock`/`rule`/`llm:<provider>`) so mock results are never conflated with real
  ones; gate any accuracy claim on non-mock data. `PENDING HUMAN DETERMINATION`

### F12 — Silent LLM fallback masks engine degradation (Path B)
- **Location:** `analysis-service.ts:389-403`.
- **Problem:** Any non-OK response, parse failure, or non-`openai` provider falls
  through to `generateMockJournalAnalysis` with only a `console.error`. A quota
  exhaustion or model deprecation silently turns the "AI audit" into the 4-check
  stub.
- **Failure scenario:** OpenAI returns 429 for a month; every API audit silently
  degrades to the mock and is reported as normal.
- **Proposed change:** Surface the fallback in the response (e.g.,
  `engine: 'mock-fallback'`, `degraded: true`) and/or rate/alert on it.
  `PENDING HUMAN DETERMINATION`

### F13 — LLM verdict is taken verbatim with no schema validation (Path B)
- **Location:** `analysis-service.ts:392-395`.
- **Problem:** The first `{...}` substring is `JSON.parse`d and returned directly.
  There is no validation that `isValid` is a boolean, that `issues[].severity` is
  in range, or that the model did not hallucinate fields. The verdict is entirely
  the model's opinion with no deterministic guardrail.
- **Failure scenario:** A model returns `{ "isValid": "yes", "issues": "none" }`;
  the API reports `isValid: "yes"` (truthy) as PASSED.
- **Proposed change:** Validate the parsed object against a Zod schema; on
  validation failure, either retry or record an `ERROR`/`UNVERIFIED` rather than
  trusting the shape. `PENDING HUMAN DETERMINATION`

### F14 — `results/route.ts` POST accepts an unvalidated verdict (Path E)
- **Location:** `api/audit/results/route.ts:103-137`.
- **Problem:** The body (`journalId`, `documentId`, `status`, `issues`,
  `confidenceScore`, `rawAiResponse`) is taken from `req.json()` with **no Zod
  validation** — contrary to the CLAUDE.md §7 API-route mandate. `status` is
  written verbatim to the `String` column (no DB-level enum). GET does
  `JSON.parse(r.issues)` (line 70) which throws → HTTP 500 if the column ever
  holds non-JSON.
- **Failure scenario:** A caller POSTs `status: "WAT"`, polluting the status space;
  a legacy/hand-edited `issues` row 500s the results list.
- **Proposed change:** Validate the body with Zod against the documented
  `AuditResultStatus` union; wrap `JSON.parse(issues)` in a try/catch returning a
  safe default. (Note: this file is Class-A under the task constraints — proposed
  for a future implementation task, not this audit.) `PENDING HUMAN DETERMINATION`

### F15 — Dead engines carry divergent, untested-in-production verdict semantics (Path D + dead code)
- **Location:** `services/audit/index.ts:26-143` (`analyzeJournal`,
  `calculateExpectedTax`, `extractAmountFromDocument`, `extractDateFromDocument`),
  `accounting-basis-check.ts`, `expense-audit.ts`.
- **Problem:** These functions define a *third* verdict model
  (confidence-threshold at `0.7`) and tax/amount extractors with known weaknesses:
  - `calculateExpectedTax` (`index.ts:132-143`) keys on `TAXABLE_10`/
    `TAXABLE_8_REDUCED`/`TAXABLE_8`/`TAX_EXEMPT`/`NON_TAXABLE` and **silently
    falls back to 0.10** for any unrecognized `taxType` or when `taxType` is
    undefined — flagging legitimate 8%/exempt entries. freee tax-type codes do not
    necessarily match these keys.
  - `extractAmountFromDocument` (`index.ts:79-92`) grabs the **first**
    currency-like number in the document (could be a unit price, a subtotal, a
    phone number with commas) with no "合計/total" anchoring, and uses `parseInt`
    (drops any decimals).
  - `extractDateFromDocument` (`index.ts:94-122`) treats `D/M/YYYY` and `M/D/YYYY`
    identically (ambiguous day/month).
  - Because none of this is reachable in production, these weaknesses never
    surface — yet the passing unit tests imply coverage.
- **Failure scenario:** Someone wires `analyzeJournal` (or the accrual/expense
  engines) into a live path expecting production-grade behavior and inherits
  silent-10%-fallback tax logic and grab-the-first-number amount matching.
- **Proposed change:** Either (a) delete the dead engines, or (b) promote one
  engine to canonical, fix the extractors/tax fallback, and remove the others.
  Do not leave three half-implemented verdict models in the tree.
  `PENDING HUMAN DETERMINATION`

### F16 — `getMonthlyAccrualStatus` fetches the whole company 12× (Path: dead code, but accuracy-adjacent)
- **Location:** `accounting-basis-check.ts:357-402`.
- **Problem:** Loops months 1-12, each iteration running
  `prisma.journal.findMany({ where: { companyId } })` with no date filter, then
  filters in JS. On a large tenant this can time out mid-loop and return a partial
  12-month array, silently under-reporting later months.
- **Failure scenario:** A company with 200k journals times out after month 4; the
  accrual status report shows months 5-12 as all-zero.
- **Proposed change:** Single query with a `fiscalYear` date range, group in JS by
  month. `PENDING HUMAN DETERMINATION`

---

## 4. Status-vocabulary inconsistency (cross-cutting)

| Producer | Values it can emit | Target field | Valid enum? |
|---|---|---|---|
| `audit-job.ts` (Path A) | `PASSED`, `FAILED`, `ERROR` | `AuditResult.status`, `Journal.auditStatus` | `ERROR` ok for `AuditResult`; mapped to `FAILED` on the journal |
| `journal/route.ts` POST (Path B) | `PASSED`, **`ISSUE`** | response only (no persist) | **`ISSUE` invalid** |
| `journal/route.ts` GET (Path C) | (none — echoes DB) | — | n/a |
| `results/route.ts` POST (Path E) | any string (unvalidated) | `AuditResult.status`, `Journal.auditStatus` | unvalidated |
| `AuditStatus` enum (`types/audit.ts:66`) | `PENDING`, `PASSED`, `FAILED`, `SKIPPED` | intended `Journal.auditStatus` | — |
| `AuditResultStatus` enum (`types/audit.ts:67`) | `PASSED`, `FAILED`, `ERROR` | intended `AuditResult.status` | — |

Observations (all `PENDING HUMAN DETERMINATION`):
- **`SKIPPED` is defined but produced by no live code**, despite being the
  natural status for the no-receipt case (F1).
- **`PENDING` is the column default** but no live code produces it as an *outcome*
  — it is only the pre-audit state.
- The API POST's `'ISSUE'` is the only outright-invalid value, but the unvalidated
  `results` POST can introduce arbitrary others.

`PENDING HUMAN DETERMINATION` on whether to consolidate to a single enum enforced
at the Zod boundary and (where feasible) at the DB level.

---

## 5. What ">95% accuracy" requires before it can be measured

All items `PENDING HUMAN DETERMINATION`:

1. **A canonical engine.** Pick one of {`JournalChecker`, `analyzeJournalEntry`,
   a new unified engine} as the source of truth; retire or rewire the others
   (F15). Without this, "accuracy" has no denominator.
2. **A golden dataset.** A labeled set of journals (each marked
   correct/incorrect, with expected issues) drawn from realistic freee data
   *including* no-receipt, tax-inclusive, mixed-rate, post-conversion, and
   non-March-FYE cases. None exists today (the unit tests use synthetic mocks).
3. **A precision/recall definition.** Decide whether "accuracy" = verdict-level
   (PASSED/FAILED) agreement, issue-level F1, or both. Decide how `warning`/`info`
   count (F3).
4. **Mode-tagged results.** Every persisted/result must carry the engine + mode
   that produced it (F11, F12) so mock and degraded verdicts are excluded from the
   metric.
5. **Coverage of the no-receipt case.** Decide explicitly whether no-receipt is
   SKIPPED (excluded from the denominator) or must be reasoned about (F1).
6. **Instrumentation.** A harness that runs the canonical engine over the golden
   set in non-mock mode and reports the chosen metric. None exists today; the
   current "現状: 未測定" in BACKLOG reflects this.

Until 1-6 exist, any ">95%" figure is either undefinable or artificially
inflated by the default-pass bias (F1, F3). `PENDING HUMAN DETERMINATION`

---

## 6. Proposed test cases

All proposed additions; none written here (this is an audit-only task).
`PENDING HUMAN DETERMINATION` on which to implement.

### 6.1 Golden-dataset / accuracy harness (new — highest leverage)
- **T-G1** Labeled journal corpus ≥200 cases across categories: correct, amount
  wrong, date wrong, tax wrong (8%/10%/exempt/mixed), wrong account side,
  no-receipt, future date, post-conversion (English/IFRS) names, non-March FYE.
- **T-G2** Harness asserts verdict-level precision ≥ target AND recall ≥ target
  for the canonical engine in non-mock mode (the metric target itself is
  `PENDING HUMAN DETERMINATION`).
- **T-G3** Harness asserts the metric is *reported* (not silently passing) so a
  regression below threshold fails CI.

### 6.2 `JournalChecker` rule-level (Path A) — extensions to `journal-checker.test.ts`
- **T-A1** No-document entry → assert status is distinguishable from a verified
  PASS (F1); today it returns `isValid:true`.
- **T-A2** Same-calendar-day date pair where doc date carries a non-UTC time →
  must NOT be flagged (F4).
- **T-A3** Unparseable `documentData.date` → asserted as an issue, not a silent
  skip (F4).
- **T-A4** Tax-inclusive receipt (¥1,100 税込, tax ¥100) → must NOT be flagged
  (F5).
- **T-A5** Mixed-rate receipt (8%+10%) → behavior asserted per chosen policy (F5).
- **T-A6** Salary entry with correct withholding recorded non-zero → must NOT be
  flagged; under-withheld bonus → flagged with bracket-correct expectation (F6).
- **T-A7** Corporate-tax entry for a non-March FYE company → flagged or not per
  *actual* FYE, not the hardcoded set (F7).
- **T-A8** Converted/English account names → behavior asserted per chosen
  code-based policy (F8).
- **T-A9** Entry with only `warning` issues → assert verdict reflects the chosen
  severity policy, not silently PASS (F3).
- **T-A10** Rule fires `info` → assert AI is/isn't invoked per the documented
  hybrid policy (F2).

### 6.3 `analyzeJournalEntry` / API (Path B) — extensions to
`analysis-service.test.ts` and a route integration test
- **T-B1** Mock mode → response is stamped `engine:'mock'` (F11).
- **T-B2** LLM returns malformed JSON / wrong-typed `isValid` → asserted as
  `ERROR`/`UNVERIFIED`, not trusted (F13).
- **T-B3** OpenAI 429/5xx → response carries `degraded:true` (F12).
- **T-B4** POST verdict → assert `auditStatus` is a valid `AuditStatus` member
  (no `'ISSUE'`) (F9).
- **T-B5** POST verdict → assert an `AuditResult` row is persisted (or the
  endpoint is documented preview-only) (F9).
- **T-B6** GET and POST `stats.passed`/`pending`/`issues` → asserted against a
  single shared definition (F10).

### 6.4 `results/route.ts` (Path E)
- **T-E1** POST with `status:'WAT'` → 400 (Zod), not persisted (F14).
- **T-E2** GET where `AuditResult.issues` holds non-JSON → returns safe default,
  not 500 (F14).

### 6.5 Dead-code guard
- **T-D1** A test/import-graph assertion that `analyzeJournal`,
  `checkAccountingBasis`, `auditExpenseItems` (and siblings) are either wired to
  a production caller or deleted — so green unit tests cannot imply live coverage
  they do not provide (F15, §1).

### 6.6 Status-vocabulary
- **T-V1** Property test: every value written to `Journal.auditStatus` /
  `AuditResult.status` by any live producer is a member of the documented enum
  (§4).

---

## 7. Prioritization (advisory; all `PENDING HUMAN DETERMINATION`)

- **P0 (blocks any accuracy claim):** F15 (canonical engine / dead code), F11
  (mode tagging), F1 (no-receipt verdict), §5 golden-dataset + harness.
- **P1 (correctness of the live engine):** F3 (severity policy), F4 (dates), F5
  (tax-inclusive), F9 (`ISSUE` + persistence), F10 (stats), F13 (LLM schema).
- **P2 (precision of heuristics):** F2, F6, F7, F8, F12, F14, F16.

`PENDING HUMAN DETERMINATION` on the final ranking and on whether F11/§5 should
be treated as prerequisites to declaring the BACKLOG target measurable.

---

## 8. Appendix — file:line index

- `src/services/audit/journal-checker.ts:38-50` no-document auto-pass
- `src/services/audit/journal-checker.ts:59` one-directional AI gate
- `src/services/audit/journal-checker.ts:80-85` error-only verdict
- `src/services/audit/journal-checker.ts:88-113` date check
- `src/services/audit/journal-checker.ts:180-203` account appropriateness
- `src/services/audit/journal-checker.ts:224-241` withholding magic number
- `src/services/audit/journal-checker.ts:250-263` corporate-tax FYE set
- `src/services/audit/journal-checker.ts:265-290` consumption-tax tax-inclusive
- `src/services/audit/index.ts:26-143` dead confidence engine + extractors
- `src/services/audit/index.ts:132-143` silent 10% tax fallback
- `src/services/audit/accounting-basis-check.ts:357-402` 12× full-table fetch
- `src/services/ai/analysis-service.ts:327-462` API verdict engine + mock stub
- `src/app/api/audit/journal/route.ts:41,114,140` GET/POST/mock issues + `'ISSUE'`
- `src/app/api/audit/journal/route.ts:44-49,120-125` broken stats
- `src/app/api/audit/results/route.ts:70,103-137` unvalidated POST / JSON.parse
- `src/jobs/audit-job.ts:104,155,157` live wiring (Path A)
- `src/jobs/scheduler.ts:31,46,60` scheduled triggers
- `prisma/schema.prisma:108-167` `Journal` / `AuditResult` (no enum at DB level)
- `src/types/audit.ts:66-67` status enums
- `BACKLOG.md:60-62` target source

---

*End of REV-AUDIT-01. This document is analysis only; no decisions are recorded
herein. All findings `PENDING HUMAN DETERMINATION`.*
