# VALIDATE-01 — Zod input-validation completeness on non-Class-A API routes

## Outcome

Added Zod `safeParse` request validation (returns **400** on bad input) to **8 non-Class-A
route handlers** across 4 clusters, plus real-handler tests for every new 400 path. No Class-A
path was touched.

Gate: `node scripts/autopm_verify.mjs --changed-only` → **exitCode 0**
(typecheck 0 errors · eslint 0 · vitest 4 files / 43 tests passed).

## Pattern applied

Matches the existing validated route idiom (`src/app/api/inventory/route.ts`):

- Query: `schema.safeParse(Object.fromEntries(searchParams))`
- Body: `schema.safeParse(await request.json())`
- Path param: `schema.safeParse(type)`
- On failure: `NextResponse.json({ error: '…', details: parsed.error.flatten() }, { status: 400 })`
- Numbers from query/body use `z.coerce.number().int().min().max()`; enums use `z.enum([...])`
  mirroring the service-layer union types.

Ad-hoc `if (!body.x) return 400 'Missing…'` checks were **replaced** by the schema (not
duplicated), so there is a single validation source of truth. Existing tests that asserted the
old ad-hoc messages were updated to assert the new 400 shape; the 400-on-bad-input contract is
preserved and extended.

## Changes

### Cluster A — `export` (csv GET, excel/pdf/pptx POST)
- New `src/app/api/export/schemas.ts`: `reportTypeSchema` (enum of the 8 `ReportType` values),
  `exportOptionsSchema` (typed partial of `ExportOptions`), `exportBodySchema`, `exportQuerySchema`.
- csv/excel/pdf/pptx routes: replaced manual presence/type checks with `safeParse`.
  `reportType` now enum-validated; `fiscalYear` coerced int ∈ [1900,2100]; `month` ∈ [1,12];
  `quarter` ∈ [1,4]; `options` validated as a typed partial.
- `tests/integration/api/export.test.ts`: updated 2 existing 400 assertions; added 6 new 400
  cases (invalid `reportType` enum, non-integer `fiscalYear`, out-of-range `fiscalYear`,
  missing-fields for pdf & pptx).

### Cluster B — `board/meetings` POST
- `src/app/api/board/meetings/route.ts`: `createMeetingSchema` — `meetingDate: z.coerce.date()`,
  `meetingType: z.enum(['regular','extraordinary'])` (matches `MeetingType`), `minutes: z.string().nullish()`.
- `tests/integration/api/board-meetings.test.ts`: updated missing-fields 400 assertion; added
  invalid-`meetingType` and invalid-`meetingDate` 400 cases.

### Cluster C — `prompts/[type]` (GET/POST) + `prompts/[type]/reset` (POST)
- New `src/app/api/prompts/schemas.ts`: `analysisTypeSchema` (`z.enum` of the 6 `AnalysisType`
  values), `promptBodySchema` (name/systemPrompt/userPromptTemplate/variables).
- These routes previously cast `type as AnalysisType` with **zero** validation — an unknown
  `type` was passed straight to Prisma. Now `type` is enum-validated (400 on unknown) and the
  POST body is schema-validated.
- New `tests/integration/api/prompts.test.ts`: 8 cases (401, 400 unknown type for GET/POST/reset,
  400 missing body fields, 200 happy paths for GET/POST/reset). Uses Bearer-token auth seam.

### Cluster D — `reports/cashflow` GET
- `src/app/api/reports/cashflow/route.ts`: `cashflowQuerySchema` — `fiscalYear` coerced int
  ∈ [1900,2100], optional (defaults to current year). Previously `parseInt('abc')` → `NaN`
  flowed into the 12-month balance-sheet loop.
- New `tests/integration/api/reports-cashflow.test.ts`: 401 + 400 (non-integer & out-of-range
  `fiscalYear`). Mocks `@/lib/api/auth-helpers.getAuthUser`.

## Deliberately left (documented, not "fake green")

These non-Class-A routes still lack `safeParse` and were **not** touched in this increment to
keep the diff bounded and fully verified (each route needs its own real-handler test; the full
suite has a known OOM risk so verification is per-file). They are straightforward follow-ups
applying the same pattern:

- `board/items/[id]`, `board/items/[id]/analyze`, `board/meetings/[id]`, `board/meetings/[id]/items`,
  `board/meetings/[id]/generate` — path `id` + body unvalidated; no existing tests.
- `dd/checklists` (GET query + POST body) and `dd/checklists/[id]` (PUT/DELETE) — use ad-hoc
  checks incl. a manual type-enum; `tests/integration/api/dd-checklists.test.ts` already asserts
  the 400 path. Converting to `safeParse` is low-risk but touches the `withAuth`/`validateCompanyId`
  cross-tenant seam — deferred.
- `reports/budget` (GET action query + POST/PUT/DELETE body), `reports/kpi`, `reports/periodic`,
  `reports/business/{generate,export}`, `reports/ir/[id]/{export,publish}` — unvalidated; `reports.test.ts`
  is **fake-green** (calls mocked services directly, never the handlers) so no real coverage exists.
- `import/{journals,account-items,monthly-balances}` — POST body unvalidated at the route layer
  (service-layer validation may exist).
- `chat/stream` — already has a `typeof body.message === 'string'` check; SSE streaming makes a
  real-handler test costly. Skipped.

### Note on `investor/*`
`investor/{invite,accept,access-log}` already validate via `schema.parse(body)` + `catch z.ZodError`
returning 400 — functionally equivalent to `safeParse` (bad input → 400, no service call). They do
**not** use `safeParse` literally. Converting is cosmetic and would touch the rate-limit-wrapped
`accept` handler, so it was left as-is. Flagged here for transparency.

## Verification commands run

```bash
corepack pnpm exec vitest run tests/integration/api/{export,board-meetings,prompts,reports-cashflow}.test.ts   # 43 passed
corepack pnpm typecheck                 # 0 errors
corepack pnpm exec eslint --max-warnings=0 <all changed files>   # 0
node scripts/autopm_verify.mjs --changed-only   # exitCode 0
```
