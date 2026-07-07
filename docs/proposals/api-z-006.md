# API-Z-006 — Zod Validation Gap Report: `audit/`, `journals/`, `journal-proposal/` APIs

> **Document type:** Audit-only proposal (no source changes).
> **Status:** DRAFT — every conclusion below is marked **`PENDING HUMAN DETERMINATION`**.
> This document records findings and proposes Zod schemas. It contains **no approvals**, names
> **no reviewer**, and asserts **no sign-off**.
>
> **Task ref:** API-Z-006 (read-only Zod validation gap report).
> **Scope read:** every `route.ts` under `src/app/api/audit/`, `src/app/api/journals/`,
> `src/app/api/journal-proposal/`, plus the shared `src/app/api/journal-proposal/_utils.ts`.
> **Scope written:** this file only (`docs/proposals/api-z-006.md`).

---

## 1. Methodology

1. Enumerated all `route.ts` files in the three target trees (12 files, see §3).
2. For each HTTP method handler, classified input validation as:
   - **`PRESENT`** — a Zod schema is defined and applied to the input via `safeParse`, and the
     handler uses the parsed output.
   - **`PARTIAL`** — some hand-rolled guard exists (e.g. a presence check, an `parseInt`, a
     TypeScript `as` cast) but no schema; or a schema exists but is not applied; or a path/body
     parameter is checked while siblings are not.
   - **`MISSING`** — the request body and/or query string is consumed with no validation at all
     (raw `req.json()`, raw `searchParams.get(...)`, raw `parseInt`).
3. Cross-referenced the Prisma columns touched (read-only) to determine whether invalid enum
   values would be rejected by the database. Finding: **all relevant status/auditStatus columns
   are plain `String`, not Prisma enums** (see §4) — so the application layer is the only line of
   defense, which materially raises the severity of every enum gap.
4. For each gap, proposed a concrete Zod schema matching the idioms already used in
   `_utils.ts` (`z.coerce.number()`, `YYYY-MM-DD` regex, `z.enum(...)`, `.safeParse()`).

The proposed schemas are illustrative defaults, not final designs — field-by-field semantics
(ranges, enum membership, optionality, max lengths) are **`PENDING HUMAN DETERMINATION`**.

---

## 2. Summary

| Route | Method(s) | State | Headline gap |
|-------|-----------|-------|--------------|
| `audit/journal` | GET, POST | **MISSING** | Query/body parsed raw; `fiscalYear`/`month` unvalidated (`NaN`, out-of-range). |
| `audit/journals` | GET | **MISSING** | `page`/`limit` `NaN` + no cap; `auditStatus` enum unenforced; dates unvalidated. |
| `audit/results` | GET, POST | **MISSING** | GET same as above; POST body written straight to DB with no schema. |
| `journals` | GET | **PARTIAL** | `companyId` presence-only; dates unvalidated; no access-scope check on `companyId`. |
| `journal-proposal` | GET | **PARTIAL** | A `listQuerySchema` already exists in `_utils.ts` but the route hand-rolls parsing instead. |
| `journal-proposal/[id]` | GET, PATCH, DELETE | **PARTIAL** | PATCH `PRESENT`; GET/DELETE only check `id` presence (no format/shape). |
| `journal-proposal/analyze` | POST | **PRESENT** | `analyzeSchema` applied. |
| `journal-proposal/upload` | POST | **PRESENT** | `uploadSchema` + `validateFile` (custom). |
| `journal-proposal/[id]/approve` | POST | **PRESENT** | `approveUpdateSchema` applied. |
| `journal-proposal/[id]/reject` | POST | **PRESENT** | `rejectSchema` applied. |
| `journal-proposal/[id]/regenerate` | POST | **PRESENT** | local `regenerateSchema` applied. |
| `journal-proposal/[id]/export` | POST | **PRESENT** | local `exportSchema` applied. |

**Net:** the `audit/` tree and the `journals` route are the validation gap; the
`journal-proposal/` tree is largely covered, except its GET list handler (which ignores an
existing schema) and the `id` path parameter on the `[id]` handlers.

---

## 3. Route inventory (12 files)

```
src/app/api/audit/journal/route.ts                 (GET, POST)
src/app/api/audit/journals/route.ts                (GET)
src/app/api/audit/results/route.ts                 (GET, POST)
src/app/api/journals/route.ts                      (GET)
src/app/api/journal-proposal/route.ts              (GET)
src/app/api/journal-proposal/[id]/route.ts         (GET, PATCH, DELETE)
src/app/api/journal-proposal/analyze/route.ts      (POST)
src/app/api/journal-proposal/upload/route.ts       (POST)
src/app/api/journal-proposal/[id]/approve/route.ts (POST)
src/app/api/journal-proposal/[id]/reject/route.ts  (POST)
src/app/api/journal-proposal/[id]/regenerate/route.ts (POST)
src/app/api/journal-proposal/[id]/export/route.ts  (POST)
```

Shared helper module read for context: `src/app/api/journal-proposal/_utils.ts`
(exports `paginationSchema`, `listQuerySchema`, `uploadSchema`, `analyzeSchema`,
`updateProposalSchema`, `approveSchema`, `rejectSchema`, `validateFile`, etc.).

---

## 4. Cross-cutting findings (apply to multiple routes)

> All items in this section are **`PENDING HUMAN DETERMINATION`**.

### 4.1 Status columns are plain `String`, not Prisma enums

Verified in `prisma/schema.prisma` (read-only):

- `Journal.auditStatus String @default("PENDING")` (line 122) — plain `String`.
- `AuditResult.status String` (line 157) — plain `String`.
- `JournalProposal.status String @default("pending")` (line 1458) — plain `String`.

Consequence: the routes' TypeScript casts such as
`searchParams.get('auditStatus') as 'PENDING' | 'PASSED' | 'FAILED' | 'SKIPPED'`
(`audit/journals/route.ts:13-18`) are **compile-time only**. At runtime any string is accepted
and, for write paths, persisted. There is **no DB-level enum** to catch invalid values. Any
Zod `z.enum(...)` proposed below is therefore the sole runtime guard for these fields, not a
redundant one.

### 4.2 Status vocabulary drift (no single source of truth)

Different handlers assume different status sets for the *same logical field*:

- `audit/journals` GET filter recognizes: `PENDING | PASSED | FAILED | SKIPPED`.
- `audit/journal` POST **writes** audit status: `PASSED | ISSUE` (`route.ts:114`) — note `ISSUE`
  is **not** in the `audit/journals` filter set.
- `audit/results` GET filter recognizes: `PASSED | FAILED | ERROR`; its POST writes `status`
  verbatim and maps to journal `auditStatus` of `PASSED` else `FAILED` (`route.ts:136`).

This drift means a chosen enum must reconcile these sets or split them by column. **`PENDING HUMAN
DETERMINATION`** — the canonical status vocabulary (per column, plus write vs. read
restrictions) must be decided before a Zod enum can be finalized.

### 4.3 `JournalProposal.status` lifecycle vs. the existing (unused) `listQuerySchema`

The `journal-proposal` handlers write these statuses: `proposed` (analyze), `modified`
(`[id]` PATCH), `approved` (approve), `rejected` (reject), `exported` (export); Prisma default
is `pending`. The `listQuerySchema.status` enum in `_utils.ts:156` is
`['pending','proposed','approved','rejected']` — it **omits `modified` and `exported`**, both of
which are actually written. Whichever schema ships for the list endpoint must include the full
observed set. **`PENDING HUMAN DETERMINATION`** — confirm `modified`/`exported` are first-class
statuses (or decide they should be filtered out of the list).

### 4.4 `parseInt` without coercion guard

Every `audit/` and `journals` handler parses pagination/numeric query params with bare
`parseInt(searchParams.get('x') || '1', 10)`. On garbage input `parseInt` returns `NaN`, which
then flows into `skip`/`take`/`new Date(NaN, …)`/`Math.ceil(total/limit)`. Prisma will error on
`NaN` `take`/`skip` (→ 500), and `new Date(NaN,…)` produces `Invalid Date`. `z.coerce.number()`
(used in `_utils.paginationSchema`) rejects non-numeric input with a clean 400 instead.
**`PENDING HUMAN DETERMINATION`** — adopt the coerce-based pattern for all numeric query params.

---

## 5. Per-route findings and proposed schemas

> Each schema block is a **proposal**. Final field semantics are
> **`PENDING HUMAN DETERMINATION`**. Schemas reuse the conventions in `_utils.ts`.

### 5.1 `audit/journal/route.ts` — GET, POST — **MISSING**

**GET** (`route.ts:7-62`): reads `fiscalYear`, `month`, `companyId` from `searchParams` via bare
`parseInt` (lines 10-13). `month` is not constrained to 1–12; `fiscalYear` has no range; both can
be `NaN`. `companyId` is access-validated via `validateCompanyId` (line 15). Dates built with
`new Date(fiscalYear, month-1, 1)` (lines 17-18) silently become `Invalid Date` on bad input.

**POST** (`route.ts:64-138`): `await req.json()` then destructures `{ fiscalYear, month,
companyId }` (line 67) with **no schema**. Missing/`undefined`/non-numeric `fiscalYear`/`month`
→ `Invalid Date` → empty result or 500. `companyId` falls back to the user's company.

**Proposed GET schema** (`PENDING HUMAN DETERMINATION` on ranges/defaults):

```ts
const auditJournalQuerySchema = z.object({
  fiscalYear: z.coerce.number().int().min(1900).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  companyId: z.string().min(1).optional(), // access still enforced by validateCompanyId
})
```

**Proposed POST schema** (`PENDING HUMAN DETERMINATION` on whether fiscalYear/month are required):

```ts
const auditJournalBodySchema = z.object({
  fiscalYear: z.number().int().min(1900).max(2100),
  month: z.number().int().min(1).max(12),
  companyId: z.string().min(1).optional(),
})
```

---

### 5.2 `audit/journals/route.ts` — GET — **MISSING**

`route.ts:8-18`: bare `parseInt` for `page`/`limit` (defaults `'1'`/`'50'`, no upper cap on
`limit` → unbounded `take`), `auditStatus` cast via `as` with no runtime check,
`startDate`/`endDate` passed to `new Date()` unvalidated. `companyId` access-validated (line 20).

**Proposed schema** (mirrors `_utils.listQuerySchema`; enum membership **`PENDING HUMAN
DETERMINATION`** per §4.2):

```ts
const auditJournalsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  auditStatus: z.enum(['PENDING', 'PASSED', 'FAILED', 'SKIPPED']).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  companyId: z.string().min(1).optional(),
})
```

---

### 5.3 `audit/results/route.ts` — GET, POST — **MISSING**

**GET** (`route.ts:8-15`): same shape as §5.2 — bare `parseInt` (no `limit` cap), `status` cast
via `as 'PASSED' | 'FAILED' | 'ERROR'`, unvalidated dates.

**POST** (`route.ts:103-132`): destructures `{ journalId, documentId, status, issues,
confidenceScore, rawAiResponse }` from `req.json()` with **no schema**, then writes them straight
to `prisma.auditResult.create` (lines 122-132) and uses `status` to set `journal.auditStatus`
(line 136). Because `AuditResult.status` and `Journal.auditStatus` are plain `String` (§4.1),
arbitrary values are persisted. `issues` is `JSON.stringify`'d (throws on non-serializable
input). `confidenceScore` is unbounded (no 0–1, no type). `rawAiResponse` has no size cap.

**Proposed GET schema** (`PENDING HUMAN DETERMINATION` on enum membership):

```ts
const auditResultsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  status: z.enum(['PASSED', 'FAILED', 'ERROR']).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  companyId: z.string().min(1).optional(),
})
```

**Proposed POST schema** (`PENDING HUMAN DETERMINATION` on `issues` shape, `confidenceScore`
range, and `rawAiResponse` max length):

```ts
const auditResultIssueSchema = z.object({
  field: z.string().max(200).optional(),
  issue: z.string().max(1000),
  severity: z.enum(['error', 'warning', 'info']).optional(),
})

const createAuditResultSchema = z.object({
  journalId: z.string().min(1),
  documentId: z.string().min(1).optional(),
  status: z.enum(['PASSED', 'FAILED', 'ERROR']),
  issues: z.array(auditResultIssueSchema).default([]),
  confidenceScore: z.number().min(0).max(1).optional(),
  rawAiResponse: z.string().max(50000).optional(),
})
```

---

### 5.4 `journals/route.ts` — GET — **PARTIAL**

`route.ts:18-43`: checks `companyId` presence (returns 400 if missing, lines 24-26) but performs
**no format validation** and, notably, **no company-access authorization** on the supplied
`companyId` — unlike the `audit/` handlers which call `validateCompanyId`/`verifyCompanyAccess`.
Any authenticated user can pass another tenant's `companyId`. `startDate`/`endDate` are passed to
`new Date()` unvalidated. Auth here is manual (Bearer header + `validateSession`, line 13) rather
than the `withAuth` cookie wrapper used elsewhere — a consistency note, not a Zod gap.

> The missing access-scope check is an **authorization** gap, out of strict Zod scope, but flagged
> here because it shares the same unvalidated `companyId` input. **`PENDING HUMAN DETERMINATION`**
> on whether to treat it as part of this proposal.

**Proposed query schema** (note: schema alone does **not** fix the authorization gap):

```ts
const journalsQuerySchema = z.object({
  companyId: z.string().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})
```

---

### 5.5 `journal-proposal/route.ts` — GET (list) — **PARTIAL**

`route.ts:13-34`: hand-rolls `Object.fromEntries(searchParams.entries())` instead of using the
**already-defined** `listQuerySchema` from `_utils.ts:154-165`. Consequences: `page`/`pageSize`
go through bare `parseInt` (`NaN` risk; only `pageSize` is capped via `Math.min`, line 31), and
`status` is taken raw with no enum check (line 32) — passed to `prisma.where.status`, which is a
plain `String` so invalid values silently match nothing. Dates are `new Date()`'d unvalidated.

Two layers of **`PENDING HUMAN DETERMINATION`**:

1. Adopt the existing `listQuerySchema` (it already encodes the coerce/cap/regex/enum pattern).
2. Reconcile its `status` enum with reality — currently `['pending','proposed','approved',
   'rejected']` but the handlers also write `modified` and `exported` (§4.3).

**Proposed** (reuse + extend the shared schema):

```ts
// In _utils.ts (extend listQuerySchema.status membership — PENDING HUMAN DETERMINATION):
export const listQuerySchema = paginationSchema.extend({
  companyId: z.string().min(1),
  status: z
    .enum(['pending', 'proposed', 'modified', 'approved', 'rejected', 'exported'])
    .optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})
```

```ts
// In route.ts (replace hand-rolled parsing):
const parsed = listQuerySchema.safeParse(queryParams)
if (!parsed.success) {
  return NextResponse.json(
    createErrorResponse('VALIDATION_ERROR', 'Invalid query', parsed.error.flatten()),
    { status: 400 }
  )
}
const { companyId, page, pageSize, status, startDate, endDate } = parsed.data
```

---

### 5.6 `journal-proposal/[id]/route.ts` — GET, PATCH, DELETE — **PARTIAL**

- **PATCH** (`route.ts:98-106`): **`PRESENT`** — applies `updateProposalSchema.safeParse(body)`
  (entryDate `YYYY-MM-DD`, description ≤200, amount non-negative). ✅
- **GET** (`route.ts:31-37`): **`PARTIAL`** — only `id` presence is checked; no format validation.
- **DELETE** (`route.ts:181-187`): **`PARTIAL`** — only `id` presence is checked; no format
  validation. (DELETE takes no body, so this is the lowest-priority gap.)

**Proposed shared path-param schema** (a cuid/prefixed format check is **`PENDING HUMAN
DETERMINATION`**; `cuid()` ids begin with a lowercase letter, but some ids here are
`proposal-${Date.now()}`-style strings synthesized in `analyze/route.ts:393`, so a strict cuid
regex would be wrong — hence the loose proposal):

```ts
const proposalIdParamSchema = z.object({
  id: z.string().min(1).max(100),
})
```

Apply uniformly across the `[id]` handlers (GET/PATCH/DELETE here and the action sub-routes) to
replace the repeated `if (!id) return 400` blocks.

---

### 5.7 `journal-proposal/analyze/route.ts` — POST — **PRESENT**

`route.ts:66-74`: applies `analyzeSchema.safeParse(body)` (`receiptId` ≥1 char,
`additionalContext` ≤2000 chars) and uses `parseResult.data` thereafter. ✅

No gap. (Observation only, **`PENDING HUMAN DETERMINATION`**: `analyzeSchema` does not cap
`receiptId` length; the file/content-type checks happen later via storage, which is acceptable.)

---

### 5.8 `journal-proposal/upload/route.ts` — POST — **PRESENT**

`route.ts:27-48`: applies `uploadSchema.safeParse({ companyId })` (`companyId` ≥1) and validates
the file separately via `validateFile` (type allow-list + ≤10 MB), `_utils.ts:337-353`. ✅

Observation (**`PENDING HUMAN DETERMINATION`**, not a strict Zod gap):
`validateFile`'s `ALLOWED_FILE_TYPES` (`_utils.ts:322-328`) includes `image/gif` and
`image/webp`, but the route's inline `storageConfig.allowedTypes`
(`route.ts:56`) lists only `application/pdf, image/png, image/jpeg, image/jpg`. The two allow-lists
disagree; whether that is intentional and which is authoritative is **`PENDING HUMAN
DETERMINATION`**. (The storage `allowedTypes` is not consulted before `validateFile`, so today the
broader `validateFile` set governs uploads.)

---

### 5.9 `journal-proposal/[id]/approve/route.ts` — POST — **PRESENT**

`route.ts:42-49`: applies `approveUpdateSchema` (`updateProposalSchema.merge(approveSchema)`) and
uses `parseResult.data`. ✅ No gap.

---

### 5.10 `journal-proposal/[id]/reject/route.ts` — POST — **PRESENT**

`route.ts:31-37`: applies `rejectSchema.safeParse(body)` (`reason` required, 1–1000 chars). ✅
No gap.

---

### 5.11 `journal-proposal/[id]/regenerate/route.ts` — POST — **PRESENT**

`route.ts:13-15, 46-54`: defines a local `regenerateSchema` (`additionalContext` ≤2000) and
applies it to a body that defaults to `{}` on parse failure. ✅ No gap.

(Observation: unlike the shared schemas, this one is defined locally rather than in `_utils.ts`.
Consolidating it into `_utils.ts` is **`PENDING HUMAN DETERMINATION`**.)

---

### 5.12 `journal-proposal/[id]/export/route.ts` — POST — **PRESENT**

`route.ts:13-19, 38-46`: defines a local `exportSchema` (`targetPeriod` `YYYY-MM` regex,
`description` ≤500) and applies it. ✅ No gap.

(Same consolidation observation as §5.11 — **`PENDING HUMAN DETERMINATION`**.)

---

## 6. Suggested implementation order (if a follow-up task is opened)

> Ordering is advisory; sequencing is **`PENDING HUMAN DETERMINATION`**.

1. **Decide the canonical status vocabularies** (§4.2, §4.3) — unblocks every enum proposal.
2. **`audit/results` POST** (§5.3) — highest-risk write path; unvalidated body persisted to DB.
3. **`audit/journal` GET/POST** and **`audit/journals`/`audit/results` GET** (§5.1–§5.3) — adopt
   the `_utils` coerce/cap/regex pattern; convert `as` casts to `z.enum`.
4. **`journals` GET** (§5.4) — add query schema **and** resolve the `companyId` authorization gap.
5. **`journal-proposal` GET list** (§5.5) — adopt the existing `listQuerySchema` and reconcile its
   `status` enum.
6. **`[id]` path-param schema** (§5.6) — small, uniform hardening across all `[id]` handlers.
7. (Optional) consolidate `regenerateSchema`/`exportSchema` into `_utils.ts` (§5.11–§5.12) and
   reconcile the upload allow-list mismatch (§5.8).

---

## 7. Open questions for human determination

All items below are **`PENDING HUMAN DETERMINATION`**:

1. What is the canonical, per-column status vocabulary for `Journal.auditStatus` and
   `AuditResult.status`? (See §4.2 — `ISSUE`, `SKIPPED`, `ERROR` appear in different handlers.)
2. Should write paths be restricted to a narrower status set than read paths (e.g. POST may only
   set `PASSED | FAILED`, never `ERROR`)?
3. Is `confidenceScore` bounded to `[0, 1]`, or is a wider range allowed?
4. What is the max length / shape of `rawAiResponse`, and what is the expected shape of the
   `issues` array persisted by `audit/results` POST?
5. Are `modified` and `exported` first-class `JournalProposal.status` values that the list filter
   must accept (§4.3), or should they be excluded from filtering?
6. Should the `journals` GET route (§5.4) enforce company-access authorization on `companyId`, and
   should it migrate from Bearer-header auth to the `withAuth` cookie wrapper?
7. Which upload allow-list is authoritative — `validateFile` (`gif`/`webp` included) or the route's
   `storageConfig.allowedTypes` (§5.8)?
8. Should the `[id]` path parameter enforce any format beyond non-empty (e.g. a length cap or
   prefix), given some ids are synthesized as `proposal-${Date.now()}` (§5.6)?

---

## 8. Out of scope (explicitly not assessed)

- Service-layer / business logic beyond what is needed to evaluate input validation at the route
  boundary.
- Authorization/RBAC correctness in depth (only flagged where it shares an unvalidated input,
  e.g. §5.4).
- Performance, rate-limit tuning, or retry behavior.
- Any file outside the three named route trees and `_utils.ts`.

---

*End of document. No approvals recorded. No reviewer named. No sign-off asserted. All findings
`PENDING HUMAN DETERMINATION`.*
