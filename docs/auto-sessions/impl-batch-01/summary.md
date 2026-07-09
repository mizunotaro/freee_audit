# IMPL-BATCH-01 — PERF-03 implementation summary

Implements the **non-Class-A** streaming / pagination / batching recommendations from
`docs/proposals/perf-03.md` in `src/jobs/**`. Class-A paths (schema, auth/crypto/security,
audit/conversion/valuation/tax/kpi/debt/deferred-accrual/journal-proposal/freee services + their
API trees, python/r services) were treated read-only and **not** modified. The audit/journal-ingest
**verdict logic** (`processJournal` → `journalChecker.check` → PASSED/FAILED/ERROR determination and
per-journal persistence) is untouched in every change below.

## What changed

### PERF-03-01 — bounded keyset cursor paging in `audit-job` (Severity: High) ✅
`src/jobs/audit-job.ts`: replaced the one-shot `findMany` that materialized the **entire** PENDING
set (+ full Document rows) with **keyset cursor paging**.
- `pageSize = concurrency * PAGE_MULTIPLIER (5)` rows fetched per page; processed in concurrency-sized
  sub-batches; cursor advanced on `id` (`skip: 1, cursor: { id }`); `orderBy: [entryDate asc, id asc]`
  adds a deterministic tiebreaker on top of the existing `entryDate` order. Memory is now `O(pageSize)`
  instead of `O(N)`.
- A single `prisma.journal.count({ where })` up front preserves the `Found N journals` log and the
  `Progress: X/Y` denominator (the proposal's "issue a cheap count once" option).

### PERF-03-05 — project only `filePath` from the Document relation (Severity: Medium) ✅
`src/jobs/audit-job.ts`: `include: { document: true }` → `include: { document: { select: { filePath: true } } }`.
`processJournal` consumes only `document.filePath` (verified), so the full Document row is no longer
joined for every journal. `JournalWithDocument.document` narrowed to `{ filePath } | null`, and
`description` corrected to `string` (schema `Journal.description` is `String`, non-nullable).

### PERF-03-03 — collapse journal-sync N+1 into bulk probe + upsert (Severity: High) ✅
`src/jobs/journal-sync.ts`: the per-journal `findUnique` + `update`/`create` (2-3 round-trips × every
synced journal) is replaced by:
- **one** indexed `findMany({ where: { freeeJournalId: { in: ids } }, select: { freeeJournalId } })`
  existence probe per freee page (`@unique freeeJournalId` → indexed `IN`), and
- per-row **`upsert`** (`where: { freeeJournalId }`, indexed) — 1 round-trip/row instead of 2-3.
New/updated accounting is preserved via the probe (no `SyncResult` semantic change); per-row
`try/catch` keeps per-row error isolation (`result.errors++`).

### PERF-03-06 — scheduler inter-job guard + stagger (Severity: Low) ✅
`src/jobs/scheduler.ts`:
- Staggered the weekly/monthly audits off the daily `02:00` minute:
  `weekly-audit` `0 2 * * 1` → `15 2 * * 1`, `monthly-audit` `0 2 1 * *` → `30 2 1 * *`
  (eliminates the same-minute collision with daily `audit-job`; all audits still run — no missed runs).
- Added an in-process re-entrancy guard (`Set<string>` of running job names) in the cron callback so a
  job still in flight when its next tick fires is skipped with a warning rather than run twice.

## Deferred (out of safe scope for this task — rationale)

- **PERF-03-02 (batch audit writes: `createMany` + status-grouped `updateMany`)** — Deferred. Doing this
  safely requires resolving the error-isolation contract: `createMany` is all-or-nothing on a batch, and
  `processJournal`'s two `ERROR` sub-paths differ in journal-status mutation (the document-analysis-error
  path sets `journal.auditStatus='FAILED'`; the catch path leaves it `PENDING`). Re-encoding that into
  batched writes risks altering verdict-adjacent persistence behavior, which this task must not touch.
  The headline memory goal is **already met** by PERF-03-01 paging (pages are bounded regardless of
  per-journal writes), so PERF-03-02 is not a prerequisite for safe scaling here. Left as-is.
- **PERF-03-04 (journal-sync resume / high-water mark)** — Deferred. The proposal itself flags the
  storage target as Class-A-adjacent (a column on `Company`/`CompanySettings` or a new table =
  `prisma/schema.prisma`, which is Class-A and explicitly off-limits). Cannot be done without a schema
  change.
- **PERF-03-07 (default daily audit scans on `auditStatus` alone)** — Deferred. Both remedies in the
  proposal are blocked: adding `@@index([auditStatus])` is a Class-A schema change; the per-company
  rewrite multiplies job count and changes run/notification/summary semantics (behavior-changing, and
  orthogonal to the streaming/pagination scope of this task). Compatible with PERF-03-01 paging if
  actioned later.

## Tests added/modified (run via `pnpm exec vitest run <files>`, never the full suite — known OOM)
- `tests/unit/jobs/audit-job.test.ts` — rewritten: paging-aware `findMany` mock (slices by cursor/skip),
  `count` mock; all original assertions preserved + new PERF-03-01 (bounded cursor) & PERF-03-05
  (projection) cases.
- `tests/unit/jobs/journal-sync.test.ts` (new) — asserts single bulk probe per page, per-row upsert,
  new/updated accounting, and per-row error isolation.
- `tests/unit/jobs/scheduler.test.ts` (new) — asserts staggered schedules + the re-entrancy guard.

## Definition of done
`node scripts/autopm_verify.mjs --changed-only` → **exit 0**
(typecheck: 0 relevant errors · eslint: 0 warnings · vitest: 24/24 pass).

## Notes
- No new dependencies; no `any`/`@ts-ignore`/`@ts-expect-error`/`.skip`/lint-disable/coverage-lowering
  in new production code. Test-side Prisma mocks use typed `Mock` casts / `as unknown as` / `as never`
  (the repo's `no-explicit-any` ESLint rule is off; the established mock idiom).
- A `JournalWithDocument[]` cast is applied to the paged `findMany` result because the
  `cursor: cond ? {id} : undefined` conditional defeats Prisma's generic return-type inference.
