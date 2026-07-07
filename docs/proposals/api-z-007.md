# API-Z-007 — Zod validation gap report: valuation / tax / kpi / deferred-accrual / debt APIs

> **READ-ONLY AUDIT.** This document changes **no source**. It records findings per route
> and **proposes** Zod schemas for each identified gap. Every conclusion, schema choice, and
> behavior-change note below is marked **PENDING HUMAN DETERMINATION** — nothing here is
> approved, signed off, or attributed to any reviewer.

---

## 1. Scope & method

**Scope (read-only):** every `route.ts` under

- `src/app/api/valuation/` → 1 file
- `src/app/api/tax/` → 4 files
- `src/app/api/kpi/` → 1 file
- `src/app/api/deferred-accrual/` → 2 files
- `src/app/api/debt/` → 1 file

**Total: 9 files, 10 distinct route modules (tax has 4).**

**Method:**

1. Read each `route.ts` end to end.
2. For each handler (GET/POST/PUT/DELETE), classify input validation as:
   - **Present (Zod)** — uses `z.object(...).safeParse(...)`.
   - **Partial** — has manual checks (truthiness / type guesses) but no schema; some inputs unguarded.
   - **Missing** — request body / params consumed with no validation at all.
3. Cross-reference field types against the service-layer types
   (`ValuationQARequest`, `CustomKPIInput`) and Prisma models
   (`TaxSettings`, `TaxSchedule`, `TaxPayment`, `AccrualExpense`, `PrepaidExpense`).
4. Propose a concrete Zod schema per gap, mirroring the style already used in
   `src/app/api/analysis/schemas/request-schemas.ts` and `src/app/api/reports/ir/route.ts`
   (existing `zod@^3` dependency; **no new dependency proposed**).

**Headline finding: 0 of 10 modules use Zod.** Every input-accepting handler validates with
ad-hoc manual truthiness checks (`if (!x || !y)`) or with **no checks at all**. Several POST
handlers pass request fields straight into service/Prisma calls with zero validation.

**Conventions used in the proposed schemas:**

- `z.coerce.number()` / `z.coerce.date()` are proposed only where the current code already
  implicitly coerces (`parseInt(...)`, `new Date(...)`). Whether to coerce vs. reject
  non-numeric/non-date input is **PENDING HUMAN DETERMINATION** per route — coercing hides
  bad data; rejecting surfaces it.
- String length caps are conservative defaults chosen to match the existing repo style
  (`.max(200)`, `.max(2000)`, etc.). Exact limits are **PENDING HUMAN DETERMINATION**.
- Enum vs. free-string for DB columns typed `String` (e.g. `taxType`, `status`,
  `paymentMethod`, `taxFilingMethod`) is **PENDING HUMAN DETERMINATION** — the Prisma schema
  does not constrain them, so a Zod enum would be a new business rule. The proposals below
  use bounded `z.string()` for those and call out where an enum is *likely* intended.

---

## 2. Summary table

| # | Route file | Methods | Current validation | Proposed action |
|---|------------|---------|--------------------|-----------------|
| 1 | `valuation/qa/route.ts` | POST | Partial (4 truthiness checks) | Add envelope Zod schema |
| 2 | `tax/generate/route.ts` | POST | Partial (2 truthiness checks) | Add Zod schema (int/range) |
| 3 | `tax/schedules/route.ts` | GET, POST | Partial (POST 3 checks; GET raw `parseInt`) | Add query + body Zod schemas |
| 4 | `tax/schedules/[id]/payments/route.ts` | GET, POST | Partial (POST 3 checks) | Add body Zod schema |
| 5 | `tax/schedules/[id]/route.ts` | GET, PUT, DELETE | **Missing** on PUT (no checks) | Add partial-update Zod schema |
| 6 | `tax/settings/route.ts` | GET, PUT | Missing on PUT (only `??` defaults) | Add Zod schema with strict types |
| 7 | `kpi/custom/route.ts` | GET, POST, PUT, DELETE | Partial (manual checks per branch) | Add action-based Zod schemas |
| 8 | `deferred-accrual/accrual/route.ts` | GET, POST | **Missing** on POST | Add Zod schema |
| 9 | `deferred-accrual/prepaid/route.ts` | GET, POST | **Missing** on POST | Add Zod schema + date-order refine |
| 10 | `debt/forecast/route.ts` | GET, POST | Partial (POST `sync` only) | Add query + discriminated body schema |

All rows **PENDING HUMAN DETERMINATION** as to whether/when to implement.

---

## 3. Route-by-route findings

### 3.1 `src/app/api/valuation/qa/route.ts` — POST

**Status: Partial.**

**What exists:** body is cast `as ValuationQARequest`, then a 4-field truthiness guard:

```ts
if (!body.calculationType || !body.inputs || !body.result || !body.steps) { ... 400 }
```

**Gaps (PENDING HUMAN DETERMINATION):**

- `calculationType` is not checked against the `ValuationMethod` union
  (`'dcf' | 'comparable' | 'asset_based' | 'black_scholes' | 'monte_carlo' | 'scenario'`).
- `inputs` is typed `Record<string, unknown>`; a truthy non-object (e.g. a string) passes.
- `result` and `steps` are polymorphic unions — not shape-checked here (service may handle,
  but unbounded size → potential cost/DoS concern when fed to the LLM).
- `executionSource` (required in `ValuationQARequest` type) is **not** checked by the manual
  guard — the guard and the type disagree.
- No payload-size bound. This body is forwarded to an LLM provider; a huge payload is a
  cost/availability risk.

**Proposed schema (PENDING HUMAN DETERMINATION):**

```ts
import { z } from 'zod'

const ValuationMethodSchema = z.enum([
  'dcf', 'comparable', 'asset_based', 'black_scholes', 'monte_carlo', 'scenario',
])
const ExecutionSourceSchema = z.enum(['typescript', 'r-service', 'python-package'])

const ValuationQARequestSchema = z.object({
  calculationType: ValuationMethodSchema,
  inputs: z.record(z.string(), z.unknown()),
  result: z.unknown(),                       // shape validated inside ValuationQAService
  steps: z.array(z.unknown()),
  executionSource: ExecutionSourceSchema.optional(), // type says required; making optional
                                                   // preserves current behavior. PENDING HUMAN
                                                   // DETERMINATION whether to enforce required.
  metadata: z
    .object({
      companyId: z.string().max(100).optional(),
      industry: z.string().max(200).optional(),
      calculationTimestamp: z.string().datetime().optional(),
    })
    .optional(),
})
```

**Behavior-change notes (PENDING HUMAN DETERMINATION):**

- Enforcing the `calculationType` enum will reject unknown methods that today silently reach
  the QA service.
- A payload-size cap (e.g. `.refine` on serialized length) is worth considering but is a
  product decision.

---

### 3.2 `src/app/api/tax/generate/route.ts` — POST

**Status: Partial.**

**What exists:** `if (!fiscalYearEndMonth || !fiscalYear) { ... 400 }`.

**Gaps (PENDING HUMAN DETERMINATION):**

- `fiscalYearEndMonth` is a month; not constrained to an integer in `[1, 12]`. The truthiness
  check rejects `0` but accepts `13`, `"abc"` (truthy string), `1.5`, etc.
- `fiscalYear` has no range/type guard.

**Proposed schema (PENDING HUMAN DETERMINATION):**

```ts
const GenerateTaxSchedulesSchema = z.object({
  fiscalYearEndMonth: z.number().int().min(1).max(12), // coerce? PENDING HUMAN DETERMINATION
  fiscalYear: z.number().int().min(1900).max(2100),
})
```

**Behavior-change note:** strict int/range will reject inputs that currently pass (e.g.
`fiscalYearEndMonth: 13`). Whether that is desirable is **PENDING HUMAN DETERMINATION**
(it almost certainly is, but it is a contract change).

---

### 3.3 `src/app/api/tax/schedules/route.ts` — GET, POST

**GET — Status: Partial.** Query `fiscalYear` is fed to `parseInt(fiscalYear)` with no NaN
guard; a non-numeric value yields `NaN` passed to the service.

**POST — Status: Partial.** `if (!taxType || !fiscalYear || !dueDate) { ... 400 }`, then
`dueDate: new Date(dueDate)`.

**Gaps (PENDING HUMAN DETERMINATION):**

- `taxType` / `fiscalYear` / `dueDate` are presence-checked only.
- `new Date(dueDate)` on garbage yields an `Invalid Date` that is silently persisted (DB
  column is `DateTime`).
- `amount` (model `Float?`) and `note` (model `String?`) are passed through unvalidated —
  no numeric/length bounds.

**Proposed schemas (PENDING HUMAN DETERMINATION):**

```ts
const ListTaxSchedulesQuerySchema = z.object({
  fiscalYear: z.coerce.number().int().min(1900).max(2100).optional(),
})

const CreateTaxScheduleSchema = z.object({
  // taxType is a free String in Prisma; enum values unknown → bounded string.
  // PENDING HUMAN DETERMINATION whether to introduce a TaxType enum.
  taxType: z.string().min(1).max(50),
  fiscalYear: z.number().int().min(1900).max(2100),
  dueDate: z.coerce.date(),
  amount: z.number().finite().optional(),
  note: z.string().max(2000).optional(),
})
```

**Behavior-change note:** `z.coerce.date()` rejects unparseable dates that today become
silent `Invalid Date`s. That is a behavior change — **PENDING HUMAN DETERMINATION**.

---

### 3.4 `src/app/api/tax/schedules/[id]/payments/route.ts` — GET, POST

**GET — Status: Partial.** `params.id` is used unvalidated (path param, ownership checked).

**POST — Status: Partial.** `if (!paymentDate || !amount || !paymentMethod) { ... 400 }`,
then `paymentDate: new Date(paymentDate)`.

**Gaps (PENDING HUMAN DETERMINATION):**

- `amount` (model `Float`, **not nullable**) is only truthiness-checked — a numeric string,
  negative, or `NaN` passes.
- `paymentDate` → `new Date()` silently `Invalid Date`s on bad input.
- `paymentMethod` / `referenceNumber` / `note` unbounded.

**Proposed schema (PENDING HUMAN DETERMINATION):**

```ts
const CreateTaxPaymentSchema = z.object({
  paymentDate: z.coerce.date(),
  amount: z.number().finite(), // .positive()? refunds/adjustments may be negative.
                               // PENDING HUMAN DETERMINATION.
  paymentMethod: z.string().min(1).max(50), // enum? PENDING HUMAN DETERMINATION
  referenceNumber: z.string().max(100).optional(),
  note: z.string().max(2000).optional(),
})
```

**Behavior-change note:** requiring `amount` to be a real number (vs. truthy) will reject
numeric strings. **PENDING HUMAN DETERMINATION.**

---

### 3.5 `src/app/api/tax/schedules/[id]/route.ts` — GET, PUT, DELETE

**GET / DELETE — Status: Partial.** `params.id` unvalidated (ownership checked for GET/PUT/DELETE).

**PUT — Status: Missing.** The body is destructured and forwarded with **no validation at all**:

```ts
const { amount, note, status } = body
await TaxService.updateTaxSchedule(params.id, { amount, note, status })
```

Any value (including `undefined` for all three, or wrong types) flows straight to the service.

**Proposed schema (PENDING HUMAN DETERMINATION):**

```ts
const UpdateTaxScheduleSchema = z
  .object({
    amount: z.number().finite().optional(),
    note: z.string().max(2000).optional(),
    // status defaults to 'PENDING' in Prisma; likely enum (PENDING/FILED/PAID?) but
    // values unknown → bounded string. PENDING HUMAN DETERMINATION.
    status: z.string().min(1).max(50).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, {
    message: 'At least one of amount, note, or status is required',
  })
```

**Behavior-change note:** currently an empty `{}` body succeeds as a no-op update; the refine
would reject it. **PENDING HUMAN DETERMINATION** whether empty updates should be allowed.

---

### 3.6 `src/app/api/tax/settings/route.ts` — GET, PUT

**GET — Status: n/a** (no request input; auto-creates defaults).

**PUT — Status: Missing.** The body fields are read with `??` defaults and **no type
validation**:

```ts
const data = {
  withholdingSpecialRule: body.withholdingSpecialRule ?? false,
  withholdingEmployeeCount: body.withholdingEmployeeCount ?? 0,
  fiscalYearStart: body.fiscalYearStart ?? 1,
  consumptionTaxable: body.consumptionTaxable ?? true,
  taxFilingMethod: body.taxFilingMethod ?? 'BLUE',
}
```

**Gaps (PENDING HUMAN DETERMINATION):**

- `?? false` / `?? true` accept **any** value for the boolean fields — e.g.
  `withholdingSpecialRule: "false"` (a truthy string) persists as a non-boolean into a
  `Boolean` column (Prisma may coerce or error depending on driver).
- `withholdingEmployeeCount` (`Int`) and `fiscalYearStart` (`Int`, semantically a month) are
  not integer/range-checked.
- `taxFilingMethod` defaults to `'BLUE'`; the allowed set is unknown (likely `BLUE`/`WHITE`).

**Proposed schema (PENDING HUMAN DETERMINATION):**

```ts
// Enum members PENDING HUMAN DETERMINATION (confirm with accounting domain).
const TaxFilingMethodSchema = z.enum(['BLUE', 'WHITE'])

const TaxSettingsSchema = z.object({
  withholdingSpecialRule: z.boolean().default(false),
  withholdingEmployeeCount: z.number().int().min(0).default(0),
  fiscalYearStart: z.number().int().min(1).max(12).default(1),
  consumptionTaxable: z.boolean().default(true),
  taxFilingMethod: TaxFilingMethodSchema.default('BLUE'),
})
```

**Behavior-change note:** strict boolean typing rejects truthy non-booleans that the current
`??` logic accepts. **PENDING HUMAN DETERMINATION.**

---

### 3.7 `src/app/api/kpi/custom/route.ts` — GET, POST, PUT, DELETE

**Status: Partial (most complex module).** A single `handler` dispatches on `request.method`
and, for POST, on `body.action`. Manual checks exist in some branches but **no Zod anywhere**.

**What exists (POST branches):**

- `action === 'initialize'` → no input needed.
- `action === 'updateOrder'` → `await updateKPIOrder(body.updates)` — `body.updates` **unvalidated array**.
- `action === 'updateVisibility'` → `updateKPIVisibility(body.id, body.isVisible)` — `body.id`/`body.isVisible` unvalidated.
- `action === 'validate'` → `validateFormula(body.formula)` — `body.formula` unvalidated (service-side checked).
- create (no `action`) → builds `CustomKPIInput` manually; checks
  `if (!data.name || !data.formula || !data.category || !data.unit)`.

**Gaps (PENDING HUMAN DETERMINATION):**

- `updateOrder` / `updateVisibility` / `validate` branches read fields with no schema; bad
  shapes (e.g. `updates` not an array) reach the service.
- create branch: `calculationType` defaults to `'FORMULA'` and is never enum-checked against
  `CalculationType = 'FORMULA' | 'MANUAL' | 'AGGREGATE'`; numeric fields
  (`targetValue`, `warningThreshold`, `criticalThreshold`, `decimalPlaces`) are not
  number-checked.
- PUT: only `body.id` presence and (if present) `body.formula` are checked; the entire body is
  then passed to `updateCustomKPI(body.id, body)` unvalidated.
- DELETE: query `id` presence only.

**Proposed schemas (PENDING HUMAN DETERMINATION):**

```ts
const CalculationTypeSchema = z.enum(['FORMULA', 'MANUAL', 'AGGREGATE'])
const ComparisonTypeSchema = z.enum(['higher_better', 'lower_better', 'range'])

// The create path has NO `action` field, so a pure discriminatedUnion on `action`
// cannot cover it. Recommended structure (PENDING HUMAN DETERMINATION):
//   1. peek body.action; if undefined → CreateCustomKPI; else parse the union below.
const KpiPostActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('initialize') }),
  z.object({
    action: z.literal('updateOrder'),
    updates: z
      .array(z.object({ id: z.string().min(1), sortOrder: z.number().int().min(0) }))
      .min(1),
  }),
  z.object({
    action: z.literal('updateVisibility'),
    id: z.string().min(1),
    isVisible: z.boolean(),
  }),
  z.object({
    action: z.literal('validate'),
    formula: z.string().min(1).max(5000),
  }),
])

const CreateCustomKPISchema = z.object({
  action: z.string().optional(), // ignored on create path
  name: z.string().min(1).max(200),
  code: z.string().max(100).optional(),
  description: z.string().max(2000).optional(),
  category: z.string().min(1).max(100),
  calculationType: CalculationTypeSchema.default('FORMULA'),
  formula: z.string().max(5000).optional(),
  dataSource: z.string().max(200).optional(),
  unit: z.string().min(1).max(50),
  displayFormat: z.string().max(50).optional(),
  decimalPlaces: z.number().int().min(0).max(10).optional(),
  isVisible: z.boolean().optional(),
  targetValue: z.number().finite().optional(),
  warningThreshold: z.number().finite().optional(),
  criticalThreshold: z.number().finite().optional(),
  comparisonType: ComparisonTypeSchema.optional(),
})

const UpdateCustomKPISchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200).optional(),
  code: z.string().max(100).optional(),
  description: z.string().max(2000).optional(),
  category: z.string().min(1).max(100).optional(),
  calculationType: CalculationTypeSchema.optional(),
  formula: z.string().max(5000).optional(),
  dataSource: z.string().max(200).optional(),
  unit: z.string().min(1).max(50).optional(),
  displayFormat: z.string().max(50).optional(),
  decimalPlaces: z.number().int().min(0).max(10).optional(),
  isVisible: z.boolean().optional(),
  targetValue: z.number().finite().optional(),
  warningThreshold: z.number().finite().optional(),
  criticalThreshold: z.number().finite().optional(),
  comparisonType: ComparisonTypeSchema.optional(),
})

const DeleteCustomKPIQuerySchema = z.object({ id: z.string().min(1) })
```

**Behavior-change notes (PENDING HUMAN DETERMINATION):**

- The create path currently derives `code` from `name` when absent; the schema keeps `code`
  optional and leaves derivation to the handler.
- The four-branch dispatch + create-without-`action` means the cleanest schema is
  "peek then parse" rather than one union — a structural choice that is
  **PENDING HUMAN DETERMINATION**.

---

### 3.8 `src/app/api/deferred-accrual/accrual/route.ts` — GET, POST

**GET — Status: n/a** (boolean query flag `unpaid`, harmless).

**POST — Status: Missing.** The body is destructured and forwarded with **no validation**:

```ts
const expense = await AccrualExpenseTracker.createAccrualExpense({
  companyId: user.companyId,
  accountCode: body.accountCode,
  accountName: body.accountName,
  accrualYear: body.accrualYear,
  accrualMonth: body.accrualMonth,
  expectedAmount: body.expectedAmount,
  actualAmount: body.actualAmount,
  accrualJournalId: body.accrualJournalId,
  notes: body.notes,
})
```

**Gaps (PENDING HUMAN DETERMINATION):** every field unchecked. Required model fields
(`accountCode`, `accountName`, `accrualYear`, `accrualMonth`, `expectedAmount`,
`actualAmount`) could arrive `undefined`/wrong-typed; `accrualYear`/`accrualMonth` not
int/range-checked.

**Proposed schema (PENDING HUMAN DETERMINATION):**

```ts
const CreateAccrualExpenseSchema = z.object({
  accountCode: z.string().min(1).max(50),
  accountName: z.string().min(1).max(200),
  accrualYear: z.number().int().min(1900).max(2100),
  accrualMonth: z.number().int().min(1).max(12),
  expectedAmount: z.number().finite(),
  actualAmount: z.number().finite(),
  accrualJournalId: z.string().max(100).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})
```

---

### 3.9 `src/app/api/deferred-accrual/prepaid/route.ts` — GET, POST

**GET — Status: n/a** (boolean query flag `active`).

**POST — Status: Missing.** Body destructured and forwarded unvalidated, with two
`new Date(...)` coercions:

```ts
startDate: new Date(body.startDate),
endDate: new Date(body.endDate),
totalMonths: body.totalMonths,
```

**Gaps (PENDING HUMAN DETERMINATION):**

- `startDate` / `endDate` silently become `Invalid Date` on bad input.
- No check that `endDate > startDate`.
- `totalMonths` (model `Int`) not int/positive-checked; `originalAmount` (model `Float`) not
  numeric; `accountCode`/`accountName` required but unchecked.

**Proposed schema (PENDING HUMAN DETERMINATION):**

```ts
const CreatePrepaidExpenseSchema = z
  .object({
    accountCode: z.string().min(1).max(50),
    accountName: z.string().min(1).max(200),
    originalAmount: z.number().finite().positive(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    totalMonths: z.number().int().min(1).max(600),
    notes: z.string().max(2000).nullable().optional(),
  })
  .refine((d) => d.endDate > d.startDate, {
    message: 'endDate must be after startDate',
    path: ['endDate'],
  })
```

**Behavior-change note:** the `endDate > startDate` refine and strict date parsing are new
guarantees not present today. **PENDING HUMAN DETERMINATION.**

---

### 3.10 `src/app/api/debt/forecast/route.ts` — GET, POST

**GET — Status: Partial.** `action` query param drives a `switch`; the `default` arm handles
unknown actions gracefully. `months` is `parseInt(monthsParam)` with no NaN guard.

**POST — Status: Partial.** Only the `sync` action is supported:

```ts
const { action, freeeCompanyId } = body
if (action === 'sync') {
  if (!freeeCompanyId) { ... 400 }
  const result = await syncDebtsFromFreee(user.companyId, freeeCompanyId)
  ...
}
return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
```

**Gaps / inconsistency (PENDING HUMAN DETERMINATION):**

- **Type inconsistency to flag:** the GET `sync` arm calls
  `syncDebtsFromFreee(companyId, parseInt(company.freeeCompanyId))` (a **number**), but the
  POST `sync` arm calls `syncDebtsFromFreee(user.companyId, freeeCompanyId)` with the **raw
  body value** (no `parseInt`). The second argument's expected type (number vs string) is
  therefore ambiguous from the route alone — **PENDING HUMAN DETERMINATION** which is correct,
  and the schema below assumes `number` to match the GET arm.
- `freeeCompanyId` is only truthiness-checked.

**Proposed schemas (PENDING HUMAN DETERMINATION):**

```ts
const DebtGetQuerySchema = z.object({
  action: z.enum(['forecast', 'monthly', 'sync']).optional(),
  months: z.coerce.number().int().min(1).max(60).optional(),
})

const DebtPostSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('sync'),
    // number to match the GET sync arm; PENDING HUMAN DETERMINATION
    freeeCompanyId: z.coerce.number().int().positive(),
  }),
])
```

**Behavior-change note:** if the service actually expects a string `freeeCompanyId`,
`.coerce.number()` would be wrong — this is exactly the ambiguity flagged above.
**PENDING HUMAN DETERMINATION.**

---

## 4. Cross-cutting observations (PENDING HUMAN DETERMINATION)

1. **No Zod anywhere in scope.** All 10 modules pre-date or bypass the Zod pattern used in
   `analysis/` and `reports/ir/`. Adopting Zod here would make these routes consistent with
   the rest of the API surface.
2. **`new Date(x)` is the dominant silent-failure pattern.** `tax/schedules` (POST),
   `tax/schedules/[id]/payments` (POST), and `deferred-accrual/prepaid` (POST) all coerce via
   `new Date(...)` and silently persist `Invalid Date`. `z.coerce.date()` (or explicit parse)
   would surface these — but that is a behavior change per route.
3. **Truthiness checks reject valid falsy values.** `if (!amount)` rejects a legitimate `0`
   amount/tax; `if (!fiscalYearEndMonth)` already rejects month values the type would otherwise
   allow only via range. Numeric validation (`z.number()`) handles `0` correctly.
4. **Free-string DB columns with implicit enums.** `taxType`, `status` (PENDING/FILED/PAID?),
   `paymentMethod`, and `taxFilingMethod` (BLUE/WHITE?) are `String` in Prisma but read as if
   they have known vocabularies. Whether to encode those as Zod enums is a domain decision.
5. **`kpi/custom` is the highest-risk module** — multi-action dispatch with partial manual
   checks and several unvalidated branches; warrants the most careful schema design.
6. **Auth pattern divergence (informational, out of scope).** `valuation/qa` uses
   `getAuthUser` from `@/lib/api/auth-helpers`; the tax/deferred/debt modules each re-implement
   a local `getAuthUser` reading the `session` cookie; `kpi/custom` reads an `Authorization`
   header instead. This is noted for awareness only — **not a validation gap and not proposed
   for change here** (auth paths are out of scope).

---

## 5. Verification

This task is read-only with respect to source. The only file written by this task is this
proposal document (`docs/proposals/api-z-007.md`), so the diff is docs-only.

`node scripts/autopm_verify.mjs --changed-only` is expected to exit 0 on a docs-only diff —
**PENDING HUMAN DETERMINATION** / to be confirmed by the run after this document is written.

---

## 6. Status

All findings, proposed schemas, and behavior-change notes in this document are
**PENDING HUMAN DETERMINATION.** No source change is proposed to be applied by this task; no
reviewer has approved anything; there is no sign-off.
