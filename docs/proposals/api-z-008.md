# API-Z-008 — Zod Validation Gap Report

**Scope:** `src/app/api/conversion/**`, `src/app/api/freee/**`, `src/app/api/auth/**`,
`src/app/api/investor/**`, `src/app/api/import/**`, `src/app/api/prompts/**`
(44 `route.ts` files total).

**Task type:** AUDIT-ONLY. **No source files were modified to produce this report.**

---

> ## ⚠️ STATUS — READ THIS FIRST
>
> Every conclusion, classification, and schema below is a **PROPOSAL** and is
> **`PENDING HUMAN DETERMINATION`**. This document is not approved, contains no
> reviewer sign-off, and asserts no final decision. The proposed Zod schemas are
> illustrative starting points to be confirmed, adjusted, or rejected by a human
> reviewer before any implementation ticket is opened.
>
> Classifications used:
> - **present** — the route already parses its input with Zod (`safeParse`/`parse`)
>   in a way that covers the meaningful attack surface. No action proposed
>   (optional hardening noted only where relevant).
> - **partial** — Zod is used for *some* inputs but not others, OR a schema is so
>   permissive it does not meaningfully constrain the input.
> - **missing** — the route reads request input (query / body / path / formData)
>   with no Zod validation at all.
> - **N/A** — the route accepts no request input to validate.

---

## 1. Methodology

1. Read each `route.ts` in scope in full (44 files).
2. For every exported HTTP handler, identify the input surfaces:
   - JSON body (`request.json()`)
   - Query / search params (`searchParams`)
   - Dynamic path params (`context.params` / route `[segment]`)
   - `multipart/form-data` fields and uploaded files (`request.formData()`)
3. Determine whether each surface is parsed by a Zod schema, validated manually,
   or unvalidated.
4. For every `missing` or `partial` finding, draft a concrete Zod schema as a
   *proposal*.
5. Mark every finding `PENDING HUMAN DETERMINATION`.

Note on `withAuth` / role helpers: several conversion routes wrap handlers in
`withAuth` / `withAccountantAuth` / `withAdminAuth` from `@/lib/api`. Those
wrappers handle authentication and RBAC, **not** input validation, so they do
not count toward "validation present" for the purpose of this report.

---

## 2. At-a-glance summary

| Directory | Files | Present | Partial | Missing | N/A (no input) |
|-----------|------:|--------:|--------:|--------:|---------------:|
| `freee/` | 10 | 2 | 2 | 3 | 3 |
| `import/` | 3 | 0 | 0 | 3 | 0 |
| `prompts/` | 3 | 0 | 0 | 2 | 1 |
| `investor/` | 3 | 1 | 2 | 0 | 0 |
| `conversion/` | 22 | 13 | 6 | 0 | 3 |
| `auth/` | 3 | 1 | 0 | 0 | 2 |
| **Total** | **44** | **17** | **10** | **8** | **9** |

**Headline (all `PENDING HUMAN DETERMINATION`):** the **freee/**, **import/**,
and **prompts/** directories contain the bulk of the gaps — routes that read
query/body/formData directly with `searchParams.get(...)` + `parseInt(...)` or
`as` casts and no Zod layer. The **conversion/** directory is comparatively
mature (Zod is used on essentially every mutating handler) with only minor
hardening opportunities. **auth/** and the mutating **investor/** handlers are
already validated.

---

## 3. Findings — `freee/` (10 routes)

This directory has the widest validation gaps. Note these routes do **not** use
the shared `withAuth` wrapper; they hand-roll auth via `validateSession(cookie)`
and read query params with `searchParams.get(...)` + `parseInt(...)`.
`PENDING HUMAN DETERMINATION`.

### 3.1 `freee/auth/route.ts` — GET — **N/A**
No request input; derives OAuth state internally. Nothing to validate.

### 3.2 `freee/callback/route.ts` — GET — **partial**
Reads `code`, `state`, `error`, `error_description` straight from
`searchParams` (lines 20–24) with no length/format constraints. The CSRF
`state`-vs-cookie comparison (lines 39–44) is correct and must be preserved.
**Gap:** the query string itself is unvalidated, so arbitrarily long or
malformed `error_description` values are reflected into a redirect URL via
`encodeURIComponent` (line 29) — bounded by encoding, but still better validated.
**Proposal (`PENDING HUMAN DETERMINATION`):**
```ts
const callbackQuerySchema = z.object({
  code: z.string().min(1).max(512).optional(),
  state: z.string().min(1).max(256).optional(),
  error: z.string().max(128).optional(),
  error_description: z.string().max(1024).optional(),
})
// state-vs-cookie and companyId-vs-user checks remain manual (security logic).
```

### 3.3 `freee/companies/route.ts` — GET — **N/A**
No request input. Nothing to validate.

### 3.4 `freee/documents/[id]/download/route.ts` — GET — **partial** (mostly good)
`company_id` is validated via `DownloadParamsSchema` (lines 6–8) and `id` is
validated manually with `parseInt` + `isNaN` (lines 43–46). **Minor gap:** the
`inline` query flag (line 52) is read raw but only compared `=== 'true'`, so
impact is negligible. **Optional proposal (`PENDING HUMAN DETERMINATION`):**
fold `inline` into the schema as `z.enum(['true','false']).optional()`.

### 3.5 `freee/journals/route.ts` — GET — **missing**
Reads `start_date`, `end_date`, `limit`, `offset` with raw `parseInt` and no
bounds (lines 19–22). No date format or range validation; `limit`/`offset` are
unbounded integers passed to the upstream freee client.
**Proposal (`PENDING HUMAN DETERMINATION`):**
```ts
const journalsQuerySchema = z
  .object({
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    limit: z.coerce.number().int().min(1).max(200).default(100),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .refine(
    (d) => !d.start_date || !d.end_date || d.start_date <= d.end_date,
    { message: 'start_date must be on or before end_date' }
  )
```

### 3.6 `freee/journals/[id]/receipts/route.ts` — GET — **partial**
`company_id` is validated via `ParamsSchema` (lines 7–9). **Gap:** `journal_date`
default-falls back to "today" but when supplied (line 39) is not validated as a
date, and the path `id` is consumed as an opaque string. **Proposal
(`PENDING HUMAN DETERMINATION`):**
```ts
const receiptsQuerySchema = z.object({
  company_id: z.string().transform(Number).pipe(z.number().int().positive()),
  journal_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})
```

### 3.7 `freee/receipts/route.ts` — GET — **missing**
Identical unvalidated pattern to `freee/journals` (lines 19–22): raw
`start_date` / `end_date` / `limit` / `offset`. **Proposal
(`PENDING HUMAN DETERMINATION`):** apply the same `journalsQuerySchema` shape as
in §3.5.

### 3.8 `freee/refresh/route.ts` — POST — **N/A**
No request body; operates off the session cookie + stored token only.

### 3.9 `freee/reports/trial/route.ts` — GET — **missing**
Reads `fiscal_year`, `start_month`, `end_month` via raw `parseInt` (lines 19–21)
with no range checks — e.g. `start_month=99` would be forwarded upstream.
**Proposal (`PENDING HUMAN DETERMINATION`):**
```ts
const trialQuerySchema = z
  .object({
    fiscal_year: z.coerce.number().int().min(1900).max(2100).optional(),
    start_month: z.coerce.number().int().min(1).max(12).optional(),
    end_month: z.coerce.number().int().min(1).max(12).optional(),
  })
  .refine(
    (d) => !d.start_month || !d.end_month || d.start_month <= d.end_month,
    { message: 'start_month must be <= end_month' }
  )
```

### 3.10 `freee/sync/route.ts`
- **POST — missing.** Destructures `{ action, fiscalYear, startMonth, endMonth }`
  straight from the parsed JSON body (line 19) with no schema. `action` is only
  guarded by the `switch` default branch; numeric fields are unbounded.
  **Proposal (`PENDING HUMAN DETERMINATION`):**
  ```ts
  const syncBodySchema = z.object({
    action: z.enum(['sync_all', 'sync_journals', 'sync_trial_balance']),
    fiscalYear: z.number().int().min(1900).max(2100).optional(),
    startMonth: z.number().int().min(1).max(12).optional(),
    endMonth: z.number().int().min(1).max(12).optional(),
  })
  ```
- **GET — N/A.** No request input.

---

## 4. Findings — `import/` (3 routes)

All three import routes (`account-items`, `journals`, `monthly-balances`) share
an identical structure and the **same gap profile: `missing` Zod for the textual
query/formData fields.** They already validate `companyId` via `validateCompanyId`
and validate file size/extension manually (functional but non-Zod).
`PENDING HUMAN DETERMINATION`.

Common current pattern (per file):
```ts
const action = searchParams.get('action')
const language = (searchParams.get('language') as 'ja' | 'en') || 'ja'  // unchecked cast
const mode = formData.get('mode') as string | null                       // unchecked cast
const skipDuplicates = formData.get('skipDuplicates') !== 'false'
const updateExisting = formData.get('dryRun') === 'true'
```

### 4.1 `import/account-items/route.ts` — POST / GET — **missing** (text fields)
### 4.2 `import/journals/route.ts` — POST / GET — **missing** (text fields)
### 4.3 `import/monthly-balances/route.ts` — POST / GET — **missing** (text fields)

**Shared proposal (`PENDING HUMAN DETERMINATION`)** — apply to all three:
```ts
// Query string
const importQuerySchema = z.object({
  action: z.enum(['template']).optional(),
  language: z.enum(['ja', 'en']).default('ja'),
  companyId: z.string().max(64).optional(), // authorize via validateCompanyId as today
})

// formData-derived options (after formData.get(...))
const importOptionsSchema = z.object({
  mode: z.enum(['preview', 'import']).optional(),
  skipDuplicates: z.boolean().default(true),
  updateExisting: z.boolean().default(false),
  dryRun: z.boolean().default(false),
})
```
File handling (size against `IMPORT_LIMITS.*`, extension allow-list) is already
checked manually; a reviewer may optionally express it as a small helper but it
is **not** a gap for this report.

---

## 5. Findings — `prompts/` (3 routes)

### 5.1 `prompts/route.ts` — GET — **N/A**
No request input; returns `getAnalysisTypes()`. Nothing to validate.

### 5.2 `prompts/[type]/route.ts` — GET / POST — **missing**
- The path param `type` is cast `as AnalysisType` (line 18) with **no validation**
  — any string is forwarded to `getPrompt` / `setPrompt`.
- The POST body is read and its fields (`body.name`, `body.systemPrompt`, ...)
  are accessed without any schema (lines 30–39).
**Proposal (`PENDING HUMAN DETERMINATION`):**
```ts
import { getAnalysisTypes } from '@/services/ai/prompt-service'
const ANALYSIS_TYPES = getAnalysisTypes() as [string, ...string[]]

const typeParamSchema = z.object({ type: z.enum(ANALYSIS_TYPES) })

const setPromptBodySchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  systemPrompt: z.string().min(1).max(20000),
  userPromptTemplate: z.string().min(1).max(20000),
  variables: z.record(z.string(), z.unknown()).optional(),
})
```
(Exact field set / max lengths to be confirmed against the persistence layer and
`AnalysisType` union — `PENDING HUMAN DETERMINATION`.)

### 5.3 `prompts/[type]/reset/route.ts` — POST — **missing** (path param)
Same unchecked `type as AnalysisType` cast (line 18); body is unused.
**Proposal (`PENDING HUMAN DETERMINATION`):** reuse the `typeParamSchema`
(`z.enum(ANALYSIS_TYPES)`) from §5.2.

---

## 6. Findings — `investor/` (3 routes)

### 6.1 `investor/invite/route.ts` — POST — **present**
Validated with `inviteSchema` (`z.string().email()`). No gap. *(Separately
note, outside validation scope: the `baseUrl` ternary on lines 32–35 has
questionable operator precedence — not a Zod issue, flagged only for awareness.
`PENDING HUMAN DETERMINATION` whether to address.)*

### 6.2 `investor/accept/route.ts`
- **POST — present.** `acceptSchema` validates `token`, `name`, `password`.
- **GET — partial.** `token` is read from the query (line 69) with only a
  presence check; no length/format bound.
  **Proposal (`PENDING HUMAN DETERMINATION`):**
  ```ts
  const acceptQuerySchema = z.object({ token: z.string().min(1).max(256) })
  ```

### 6.3 `investor/access-log/route.ts` — POST — **partial**
`accessLogSchema` is used, but `action` is an unconstrained `z.string()` and
`details` is `z.record(z.unknown())` (line 6–10) — effectively unbounded, and
`action` is concatenated into the audit action string `INVESTOR_${action...}`.
**Proposal (`PENDING HUMAN DETERMINATION`):** constrain `action` shape/length
and bound `details`:
```ts
const accessLogSchema = z.object({
  action: z.string().min(1).max(64).regex(/^[A-Za-z0-9_]+$/, 'action: alnum/underscore only'),
  resourceId: z.string().max(128).optional(),
  details: z.record(z.string(), z.unknown()).optional(),
})
```

---

## 7. Findings — `conversion/` (22 routes)

This is the most mature directory. Zod is used on virtually every mutating
handler and most list/filter GETs. Findings below are minor hardening items only.
`PENDING HUMAN DETERMINATION`.

### Routes graded **present** (no action proposed)
- `conversion/coa/route.ts` — GET (`querySchema`), POST (`createSchema` + nested `createItemSchema`).
- `conversion/coa/templates/route.ts` — GET (`querySchema`).
- `conversion/coa/[id]/import/route.ts` — POST (`querySchema` + manual file size/type checks).
- `conversion/conversion/export/[projectId]/route.ts` — POST (`exportSchema`).
- `conversion/mappings/route.ts` — GET (`querySchema`), POST (`createSchema`).
- `conversion/mappings/batch/route.ts` — POST (`batchSchema` discriminated union).
- `conversion/mappings/export/route.ts` — GET (`querySchema`).
- `conversion/mappings/suggest/route.ts` — POST (`suggestSchema`).
- `conversion/mappings/statistics/route.ts` — GET (`querySchema`).
- `conversion/projects/route.ts` — GET (`querySchema`), POST (`createSchema` with `.refine` date ordering).
- `conversion/projects/[id]/execute/route.ts` — POST (`executeSchema`).
- `conversion/projects/[id]/results/route.ts` — GET (`querySchema`).
- `conversion/coa/[id]/items/route.ts` — POST (`createItemSchema`); GET query is **partial** (see §7.x below).

### Routes graded **N/A** (no request input)
- `conversion/standards/route.ts` — GET.
- `conversion/projects/[id]/progress/route.ts` — GET.
- `conversion/projects/[id]/abort/route.ts` — POST (no body; acts on path id).

### Routes graded **partial** (hardening proposed)

#### 7.1 `conversion/coa/[id]/route.ts` — PUT — **partial**
`updateSchema` has every field optional, so an empty body `{}` parses
successfully and is forwarded to `chartOfAccountService.update` as a no-op
returning 200.
**Proposal (`PENDING HUMAN DETERMINATION`):** require at least one field:
```ts
const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
}).refine((d) => Object.values(d).some((v) => v !== undefined), {
  message: 'At least one field must be provided',
})
```

#### 7.2 `conversion/mappings/[id]/route.ts` — PUT — **partial**
Same issue: `updateSchema` is fully optional; `{}` passes and is forwarded to
`accountMappingService.update(id, {})`.
**Proposal (`PENDING HUMAN DETERMINATION`):** add the same "at-least-one-field"
`.refine` shown in §7.1.

#### 7.3 `conversion/projects/[id]/route.ts` — PUT — **partial**
`updateSchema` is fully optional (`{}` passes). (Note: its `status` enum
deliberately excludes `completed`/`converting`/`error`, which is good.)
**Proposal (`PENDING HUMAN DETERMINATION`):** add the same "at-least-one-field"
`.refine`.

#### 7.4 `conversion/standards/[code]/route.ts` — GET — **partial**
Validates `code` against a manual `VALID_CODES` array (lines 6, 22) —
functionally correct but not via Zod.
**Proposal (`PENDING HUMAN DETERMINATION`):** express as a Zod param schema for
consistency with sibling routes:
```ts
const codeParamSchema = z.object({ code: z.enum(['JGAAP', 'USGAAP', 'IFRS']) })
```

#### 7.5 `conversion/coa/[id]/items/route.ts` — GET query — **partial**
`category` filter is a plain `z.string().optional()` (line 8) whereas the POST
schema on the same route constrains category to a 14-value enum. Inconsistent.
**Proposal (`PENDING HUMAN DETERMINATION`):** reuse the same category enum for
the GET filter.

#### 7.6 Path-param consistency (informational, low risk) — **partial**
Several routes consume dynamic path segments (`id`, `projectId`, `code`) as raw
strings from `context.params` without a Zod parse. For Prisma `cuid` IDs this is
low risk. **Proposal (`PENDING HUMAN DETERMINATION`):** optionally validate path
params as `z.string().min(1).max(64)` (or the relevant enum for `code`) for
defense-in-depth and uniformity; not a correctness gap.

---

## 8. Findings — `auth/` (3 routes)

### 8.1 `auth/login/route.ts` — POST — **present**
Validated with `loginSchema` (`email`, `password`) and a `z.ZodError` catch.
No gap.

### 8.2 `auth/logout/route.ts` — POST — **N/A**
Operates off the session cookie only; no request body.

### 8.3 `auth/me/route.ts` — GET — **N/A**
Reads the session cookie only; no request input.

---

## 9. Cross-cutting recommendations (all `PENDING HUMAN DETERMINATION`)

1. **Adopt a shared "list query" schema** for `page`/`limit`/`offset`/`sortBy`/
   `sortOrder` — already idiomatic in `conversion/`; reuse it in `freee/` GET
   list endpoints (`journals`, `receipts`) once those are migrated.
2. **Migrate the three `import/` routes** off raw `as` casts for `language` /
   `mode` / option flags to a shared `importOptionsSchema`.
3. **Validate path params uniformly** where they are meaningful enums
   (`standards/[code]`, `prompts/[type]`) and at minimum length-bound opaque IDs.
4. **Tighten all-optional PATCH/PUT schemas** (`conversion/coa/[id]`,
   `conversion/mappings/[id]`, `conversion/projects/[id]`) with an
   "at-least-one-field" `.refine` to reject empty no-op updates.
5. Consider centralizing the per-directory hand-rolled auth+validate boilerplate
   seen in `freee/` behind the shared `withAuth` wrapper used elsewhere — this is
   an architectural change and is **out of scope** for a validation-only ticket;
   raised only as an observation.

---

## 10. Out of scope

- Authentication, RBAC, session handling, and CSRF (`freee_oauth_state`) logic —
  reviewed only to confirm they are not the validation layer; no changes
  proposed.
- The freee client / token-store / data-sync internals (`@/lib/integrations/freee/*`)
  and conversion services (`@/services/conversion/*`) — not read for validation
  gaps; input is assumed validated before reaching them.
- The `baseUrl` precedence oddity in `investor/invite` (§6.1) — noted for
  awareness; it is a logic bug, not a Zod gap, and is **not** part of this
  validation proposal.

---

## 11. Definition of done (for this audit task)

- ✅ This single proposal document exists at `docs/proposals/api-z-008.md`.
- ✅ Document is well-structured Markdown covering all 44 in-scope routes.
- ✅ Every conclusion is marked `PENDING HUMAN DETERMINATION`; no "approved",
      reviewer name, or sign-off appears anywhere.
- ✅ No source files were modified (audit-only); the diff is docs-only.
- ☐ `node scripts/autopm_verify.mjs --changed-only` exits 0 (docs-only diff).

> No implementation work is authorized by this document. Any code change arising
> from these proposals requires a separate, human-approved implementation task.
> All findings herein remain **`PENDING HUMAN DETERMINATION`**.
