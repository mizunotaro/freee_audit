# gap-untested-module-d6d35a885c — unit tests for journal-sync.ts

**Target:** `src/jobs/journal-sync.ts`
**Test file:** `tests/unit/jobs/journal-sync.test.ts` (extended — a 4-test file already existed)
**Risk class:** C
**Result:** 21 tests (4 pre-existing + 17 new), all passing. ESLint 0 warnings, `tsc --noEmit` clean for the file.

## What the module does

`syncJournals(options)` is the **scheduled-job ingest path** (run daily 1:00 AM by
`src/jobs/scheduler.ts`). For each company it:

1. Resolves a stored freee API key via `prisma.apiKey.findFirst`, building a `FreeeClient`
   (returns `null` if no key / no `encryptedKey`).
2. Reads the company's `freeeCompanyId`, `parseInt`s it.
3. **Paginates** `client.getJournals(...)` with `limit=100`, advancing `offset` until
   `offset + limit >= meta.total_count`.
4. Per page, runs a **single bulk existence probe** (`journal.findMany` on the page's
   freee ids) then `upsert`s each row, classifying new vs. updated.
5. Logs each freee API call via `auditLogger.logFreeeApiCall`.
6. Optionally fires `notifier.notifySyncComplete(count, {start,end})` when
   `notifyOnComplete && totalSynced > 0`.

Per-row and per-company errors are isolated — a failure increments `result.errors`
and the run continues rather than aborting.

## Why this task arrived "already satisfied" and what was actually missing

A `tests/unit/jobs/journal-sync.test.ts` already existed (4 tests, scoped to the
PERF-03-03 bulk-probe refactor). Those tests covered the existence probe, the
upsert new/update split, per-row error isolation, and the no-API-key skip — but
left the rest of the public surface untested:

- **Pagination loop** (the defining behavior of this ingest path vs. the non-paginated
  `data-sync.ts` API path — see `dual-journal-ingest-paths` memory) was unexercised.
- **Boundary conditions** on `offset + limit < total_count`.
- **Empty / malformed** API responses.
- **Skip branches** beyond the API-key one (no `freeeCompanyId`).
- **All-companies** fan-out (`companyId` omitted).
- **Audit logging** of the API call.
- **Fail-safe behavior** under API rejection and across multiple companies.
- **Notification gating** (fire / suppress-by-count / suppress-by-flag).
- **Data-mapping defaults** for journals missing debit details or all details.

The 17 new tests below close those gaps; the original 4 were left intact.

## Mocking strategy

Mirrors the existing file and sibling `audit-job.test.ts`: `vi.mock` for
`@/lib/db` (only the `apiKey`/`company`/`journal` delegates touched),
`@lib/integrations/freee/client` (`createFreeeClient` → `{ getJournals: mockGetJournals }`),
`@lib/integrations/slack/notifier`, and `@lib/audit/audit-logger`. A dedicated
`describe` block holds its own `beforeEach` with safe defaults so each test
overrides only the collaborator it cares about. `console.{warn,error,log}` are
spied and silenced (the source logs liberally) and restored in `afterEach`.
No timers/network/random — where dates matter, explicit `startDate`/`endDate`
are supplied; durations are asserted only as `expect.any(Number)`.

## Assertions added (17 tests)

### Pagination & boundaries (3)
- **Multi-page:** total_count=150 → exactly 2 `getJournals` calls with offsets
  `[0, 100]`, one bulk `findMany` probe per page, `totalSynced=150`, `newJournals=150`,
  `errors=0`.
- **Boundary (exact):** total_count=100 (== limit) → a single page, no second fetch,
  `totalSynced=100`.
- **Off-by-one boundary:** total_count=101 (limit+1) → 2 calls, offsets `[0, 100]`,
  `totalSynced=101` (proves the second partial page is consumed).

### Empty / edge inputs (2)
- Empty `journals: []` → no `upsert`, `totalSynced=0`, `newJournals=0`, `errors=0`
  (safe no-op; the `(response).journals || []` fallback plus the `findMany({in:[]})`
  probe resolve cleanly).
- **Missing `journals` property** (`{ meta: {...} }` only) → treated as empty,
  no `upsert`, zero counts (fail-safe coercion).

### Skip branches (2)
- Company with `freeeCompanyId: null` → `getJournals` never called, `totalSynced=0`.
- API key row present but `encryptedKey: null` → client is `null`, `getJournals` and
  the downstream `company.findUnique` never called, `totalSynced=0`.

### All-companies fan-out (1)
- No `companyId` → `company.findMany({ select: { id: true } })` is called and each
  returned company is synced (2 companies → 2 `getJournals` calls, `totalSynced=2`).

### Audit logging (1)
- On a successful page, `auditLogger.logFreeeApiCall` is called once with
  `('/api/1/journals', 'GET', 200, <number>, 'company-1')`.

### Fail-safe behavior (2)
- **API rejection:** `getJournals` rejects → the company is counted as
  `errors=1`, `totalSynced=0`, the function **resolves** (does not throw), and
  `logFreeeApiCall` is **not** emitted for the failed page (the call site sits
  after the awaited `getJournals`, so the `statusCode=500` branch in the source
  never reaches the logger — asserted as actual behavior).
- **Multi-company continuation:** company `c-bad` (`freeeCompanyId 111`) throws,
  company `c-ok` (`222`) succeeds → `getJournals` called twice, `errors=1`,
  `totalSynced=1`, `newJournals=1` (the outer `try/catch` isolates per-company
  failure and the loop continues).

### Notification gating (3)
- `notifyOnComplete: true` + synced > 0 → `notifySyncComplete` called once with
  `(1, { start: '2024-03-01', end: '2024-03-31' })` (the requested date range is
  forwarded to the notifier).
- `notifyOnComplete: true` but `totalSynced === 0` → `notifySyncComplete` **not**
  called (the `result.totalSynced > 0` guard).
- `notifyOnComplete: false` with journals present → `notifySyncComplete` **not** called.

### Data-mapping defaults (2)
- **Credit-only journal** (no debit detail) → upserted once; create payload maps
  `debitAccount=''`, `creditAccount='売上'`, `amount=0`, `taxAmount=500` (credit's
  `vat`), `taxType='課税売上'` (credit's `vat_name`), `description`, and
  `entryDate=new Date(issue_date)` — the `creditDetail || 0/null` fallbacks.
- **No details, no description** → upserted once; all fields degrade to safe
  defaults (`debitAccount=''`, `creditAccount=''`, `amount=0`, `taxAmount=0`,
  `taxType=null`, `description=''`) — proves missing `details`/`description` cannot
  null-deref or produce `undefined` columns.

### Config forwarding (1)
- `freeeCompanyId` is parsed to a number and the requested range is forwarded:
  `getJournals` called with `(123, '2024-03-01', '2024-03-31', 100, 0)`.

## Notes / decisions

- **Extended, did not duplicate.** A test file already existed; per the
  `gap-tasks-often-already-satisfied` memory, the new coverage was appended as a
  second `describe` block so the PERF-03-03 tests stay grouped and untouched.
- **No new dependencies.** Only `vitest` (already configured).
- **Determinism.** No fake timers needed — the only clock reads (`new Date()` for
  default range, `Date.now()` for duration) are never asserted on by value; durations
  use `expect.any(Number)` and date-sensitive assertions pass explicit ranges.
- **Faithful to source behavior on the error path.** The `statusCode = 500` line in
  the source's inner `catch` is effectively dead w.r.t. `logFreeeApiCall` (the log
  call precedes it on the success line). The test asserts the *actual* contract
  (no log emitted on failure, error counted, run continues) rather than a 500 log
  that never occurs — no failing/optimistic assertion was added.

## Verification run

```
corepack pnpm install --frozen-lockfile   # worktree started without node_modules
corepack pnpm db:generate                 # prisma client (TS7006 phantom errors otherwise)
corepack pnpm exec vitest run tests/unit/jobs/journal-sync.test.ts
# Test Files 1 passed (1) — Tests 21 passed (21)
corepack pnpm exec eslint --max-warnings=0 tests/unit/jobs/journal-sync.test.ts  # exit 0
corepack pnpm exec tsc --noEmit            # 0 errors in the test file
```
