# PERF-03 — Large-Dataset Batch Processing Plan (Journal Ingest / Audit)

> **Status: ANALYSIS ONLY — every conclusion below is `PENDING HUMAN DETERMINATION`.**
> This document contains no approvals, no reviewer names, and no sign-offs. It is a read-only
> analysis produced for a human reviewer to decide and action. Nothing here has been authorized,
> accepted, or merged. No source file was modified to produce it.

---

## 1. Task & constraints (recap)

- **Scope (read paths audited):** `src/jobs/**` (`scheduler.ts`, `journal-sync.ts`, `audit-job.ts`,
  `exchange-rate-fetch-job.ts`) and the read paths those jobs exercise (`Journal`, `AuditResult`,
  `Document` via Prisma). The target workload is **100k+ records** in journal ingest and the audit
  ingest/processing sweep.
- **Mode:** AUDIT ONLY. No source files were modified. This file is the **only** artifact produced.
- **Class-A paths** (`prisma/**`, `src/lib/auth*`, `src/lib/crypto.ts`, `src/lib/security/**`,
  `src/lib/audit/**`, `src/services/{audit,conversion,valuation,tax,kpi,debt,deferred-accrual,
  journal-proposal,freee}/**`, the corresponding `src/app/api/**` trees, `python-service/**`,
  `r-service/**`) were treated as read-only reference and were **not** proposed for change. The
  parallel API ingest path `src/lib/integrations/freee/data-sync.ts` and `src/app/api/freee/sync/**`
  are Class-A; they are referenced for comparison only (§5).
- **Every recommendation is `PENDING HUMAN DETERMINATION`.**

## 2. Executive summary

| ID | File:line | Pattern | Cost today @ 100k | Proposed | Severity |
|----|-----------|---------|--------------------|----------|----------|
| PERF-03-01 | `jobs/audit-job.ts:250-256` | `findMany` loads **entire** PENDING set + `include:{document:true}` into one JS array before any processing | O(N) heap (100k rows + N Document rows) materialized up-front; existing `logMemoryUsage` is observational, not preventive | cursor/keyset paging: bounded `take`, re-query `auditStatus:'PENDING'` each page | **High** |
| PERF-03-02 | `jobs/audit-job.ts:159,171,111,128,184` | Per-journal `auditResult.create` + `journal.update` inside the worker (2 sequential writes/journal) | 200k individual INSERT/UPDATE round-trips | batch per concurrency-group: `createMany` + status-grouped `updateMany` | **High** |
| PERF-03-03 | `jobs/journal-sync.ts:121-136` | Per-journal `findUnique` (existence) then `update`/`create` (2-3 round-trips × every synced journal) | 200k-300k sequential round-trips | `upsert` (1/row) + bulk existence probe (`freeeJournalId:{in:…}`, `@unique`) + `createMany` for new | **High** |
| PERF-03-04 | `jobs/journal-sync.ts` (whole) | No resume/checkpoint; on partial failure re-fetches every freee page from window start | full re-scan of the whole date window after any mid-run crash | persist per-company high-water mark (last `entryDate`/`freeeJournalId` synced) | **Medium** |
| PERF-03-05 | `jobs/audit-job.ts:252` | `include:{document:true}` over-fetches full `Document` rows; only `filePath` is consumed and most journals have no document | 100k full-row joins for a single field | `select:{ document:{ select:{ filePath:true } } }`, or defer to the processing slice | **Medium** |
| PERF-03-06 | `jobs/scheduler.ts:21-69` | No inter-job mutex; weekly/monthly audit at 02:00 share the minute with the daily `audit-job` 02:00 | two `runAuditJob` instances → 2× the up-front `findMany` load + 2× AI concurrency | in-process running-job lock or stagger cron minutes | **Low** |
| PERF-03-07 | `jobs/audit-job.ts:224-248` | Default daily job queries `auditStatus:'PENDING'` with **no** `companyId` → index `[companyId,auditStatus]` cannot serve it (leftmost-prefix) | full table scan over `journals` for the default run | drive the default run per-company, or add `@@index([auditStatus])` (schema = Class-A) | **Medium** |

**Streaming/chunking conclusion (`PENDING HUMAN DETERMINATION`):** the single highest-leverage change is
**PERF-03-01** — replacing the one-shot `findMany` with bounded cursor pages. It is also a prerequisite
for safely bounding memory for every other item, because today *all* proposed write-batching
(PERF-03-02/03) still depends on a result set that is already fully in memory. No schema change is
required to realize PERF-03-01..05; PERF-03-07 *may* warrant an index but that is Class-A and listed
for decision only.

## 3. Methodology

1. Enumerated `src/jobs/**`; read all four job files end-to-end.
2. Traced each job's read/write surface: `journal-sync.ts` → `freee/client.ts getJournals` (pagination
   contract) → `Journal`; `audit-job.ts` → `Journal` (+`Document`) → `AuditResult`.
3. For the audit per-journal cost, read `services/audit/journal-checker.ts` and
   `services/audit/receipt-analyzer.ts` (Class-A, reference) to confirm the worker is **AI/IO-bound**
   (file read → base64 → LLM/OCR call, optionally a second `validateEntry` AI call) — which makes the
   *read path* (memory + write count), not AI latency, the targetable large-dataset concern.
4. Cross-checked every queried field set and write target against `prisma/schema.prisma` (`Journal`
   108-131, `Document` 133-149, `AuditResult` 151-167) to confirm index support for paging and bulk
   writes.
5. Verified reachability of each audited path (per the project rule that "reachable" must be
   confirmed): `syncJournals` is reached by `scheduler.ts:25` (daily 01:00) + `runJobManually` + CLI;
   `runAuditJob` by `scheduler.ts:31,46,60` (daily/weekly/monthly 02:00) + CLI. Both are live.

## 4. Findings

### PERF-03-01 — `audit-job` materializes the entire PENDING set in memory  *(Severity: High)*

**Location:** `src/jobs/audit-job.ts:250-256`

```ts
const journals = await prisma.journal.findMany({
  where: whereClause,
  include: { document: true },
  orderBy: { entryDate: 'asc' },
})
```

**Problem.** This is a single unbounded `findMany`. For the target workload (100k+ PENDING journals)
it loads **every** matching `Journal` row **and** every related `Document` row into one JS array
*before* the processing loop starts. The subsequent concurrency loop (270-314) only ever slices
`batch = journals.slice(i, i + concurrency)` from this already-fully-realized array — so **memory is
O(N) regardless of `concurrency` or `AUDIT_CONCURRENCY`**. The `logMemoryUsage` calls (263-265,
308-313) only *observe* growth; they cannot prevent the initial allocation. Concurrency mitigates AI
*latency*, not *memory*.

**Proposed change (`PENDING HUMAN DETERMINATION`) — bounded cursor paging.** Read in pages sized to
the concurrency unit, process, then fetch the next page. Because processing mutates `auditStatus`
(`PENDING` → `PASSED`/`FAILED`/`ERROR`) inside the loop, re-issuing the same `where:{ auditStatus:
'PENDING' }` each page naturally consumes the set without needing a stable external cursor:

```ts
const PAGE = concurrency * PAGE_MULTIPLIER // e.g. 5 * 20 = 100 rows/page
let processed = 0
while (true) {
  const page = await prisma.journal.findMany({
    where: whereClause,            // auditStatus still mutates, so the set shrinks each iteration
    include: { document: { select: { filePath: true } } }, // see PERF-03-05
    orderBy: { entryDate: 'asc' },
    take: PAGE,
  })
  if (page.length === 0) break
  for (let i = 0; i < page.length; i += concurrency) {
    const batch = page.slice(i, i + concurrency)
    await Promise.allSettled(batch.map((j) => processJournal(j, options, ...)))
  }
  processed += page.length
}
```

**Caveats the human must resolve (`PENDING HUMAN DETERMINATION`):**
- **Re-query cost vs. stability.** Re-running `findMany` each page re-scans the (shrinking) PENDING
  set. With PERF-03-07 unresolved this is a re-scan per page; the human should weigh that against a
  true keyset cursor on `(entryDate, id)` (which needs a composite index — Class-A).
- **`totalCount` reporting.** The summary (318-326) prints `totalProcessed` from the loop counter,
  not a pre-computed `count`, so it survives paging — confirm the human is OK losing the "Found N
  journals" log (258) up front (or issue a cheap `count` once).
- **Behavior parity** of `notifyOnComplete` and `issues[]` accumulation across pages.

---

### PERF-03-02 — Per-journal writes in `audit-job` are not batched  *(Severity: High)*

**Location:** `src/jobs/audit-job.ts` — `processJournal` issues `prisma.auditResult.create`
(line **159**) **and** `prisma.journal.update` (line **171**) per journal; error paths add further
per-journal writes (**111**, **128**, **184**).

**Problem.** Each journal = ≥2 individual write statements, each in its own implicit transaction
(2 network round-trips minimum). At 100k journals that is **≥200k sequential round-trips** to the DB,
independent of the PERF-03-01 memory fix.

**Proposed change (`PENDING HUMAN DETERMINATION`) — batch per concurrency-group.** After a
concurrency-batch settles, fold its results into bulk writes instead of writing inside each worker:

```ts
// group settled results by terminal status, then:
await prisma.auditResult.createMany({ data: batchResultRows })     // one INSERT for the whole batch
await prisma.journal.updateMany({                                  // one UPDATE per status value
  where: { id: { in: passedIds } }, data: { auditStatus: 'PASSED' } })
await prisma.journal.updateMany({
  where: { id: { in: failedIds } }, data: { auditStatus: 'FAILED' } })
```

`AuditResult.journalId` is `@@index([journalId])` and `Journal.id` is the `@id` — both bulk paths are
index-backed. Net: from `2 × N` writes to ~3 per batch.

**Caveats (`PENDING HUMAN DETERMINATION`):**
- **Error isolation.** The current per-journal `try/catch` (139-142, 181-206) lets one bad journal
  fail without aborting the batch. `createMany` is all-or-nothing on the batch (unless the connector
  returns per-row errors). The human must decide a strategy: keep per-row writes for the error rows,
  or wrap each batch's bulk write in its own try/catch and fall back to per-row on failure.
- **`createMany` caveats:** does not run `@default`-unfriendly hooks, and on **SQLite** skips
  nested creates (not used here). Confirm both connectors (SQLite dev / PostgreSQL prod) behave as
  expected for the `rawAiResponse`/`confidenceScore` nullable columns.

---

### PERF-03-03 — `journal-sync` is a classic read-then-write N+1  *(Severity: High)*

**Location:** `src/jobs/journal-sync.ts:121-136` — inside the per-page `for (const freeeJournal of
journals)` loop:

```ts
const existing = await prisma.journal.findUnique({ where: { freeeJournalId: … } })
if (existing) { await prisma.journal.update({…}); result.updatedJournals++ }
else          { await prisma.journal.create({…});  result.newJournals++ }
```

**Problem.** For every synced journal: 1 `findUnique` + 1 `update`/`create` = **2-3 round-trips ×
every journal × every company**, sequential. At 100k journals that is **200k-300k round-trips**. The
freee API side is already paginated correctly (offset/limit loop, 76-152); the DB side is not.

**Proposed change (`PENDING HUMAN DETERMINATION`):**
1. **Collapse to `upsert`** (1 round-trip/row) — exactly what the parallel `data-sync.ts` path
   already does (`upsertJournal`, 62-102). `freeeJournalId` is `@unique`, so the `where` is indexed.
2. **Batch within a page.** A page is 100 rows; resolve existence in **one** query and bulk-insert
   the rest:

```ts
const ids = page.map((j) => String(j.id))
const existing = await prisma.journal.findMany({
  where: { freeeJournalId: { in: ids } },          // @unique → indexed IN-probe
  select: { id: true, freeeJournalId: true },
})
const known = new Set(existing.map((e) => e.freeeJournalId))
const toCreate = page.filter((j) => !known.has(String(j.id)))
await prisma.journal.createMany({ data: toCreate.map(toJournalData), skipDuplicates: true })
// updates remain per-row (updateMany can't set per-row values); batch them in one $transaction
```

**Caveats (`PENDING HUMAN DETERMINATION`):**
- `updateMany` cannot apply *different* `data` per row, so updates stay per-row (or per-row inside a
  single `$transaction` to share one connection). The human picks the trade-off.
- The current per-journal `try/catch` (139-142) gives per-row error accounting (`result.errors++`).
  `createMany`/`skipDuplicates` loses that granularity — the human must decide whether to sacrifice
  it or do a post-batch reconciliation.
- `createMany` does not set `auditStatus:'PENDING'` via the same path as `create`? It *does* honor
  `@default("PENDING")`, so this is safe — but confirm with the schema default (line 122).

---

### PERF-03-04 — `journal-sync` has no resume/checkpoint  *(Severity: Medium)*

**Location:** `src/jobs/journal-sync.ts` (whole `syncJournals`).

**Problem.** The job is all-or-nothing: if the process dies at, say, journal #50k of a 100k window,
there is no record of progress. On restart it re-issues **every** freee page from the window start
and re-upserts everything (idempotent thanks to `@unique freeeJournalId`, but wasteful — it re-hits
the freee API and re-writes all rows). The default window is the current month (48-51), which bounds
the *daily* cost, but `runJobManually` and explicit `--start/--end` ranges can span arbitrarily far.

> **Contrast (positive).** `audit-job` **is** naturally resumable: because it filters on
> `auditStatus:'PENDING'` and flips each processed row, a restart simply continues with the remaining
> PENDING set — no checkpoint needed. This is a good pattern to mirror in `journal-sync`.

**Proposed change (`PENDING HUMAN DETERMINATION`) — high-water mark.** Persist, per company, the last
successfully synced position (e.g. max `entryDate` or max `freeeJournalId` seen) so incremental runs
start at the watermark instead of the window start. Storage target is Class-A-adjacent; the human
decides the home (a column on `Company`/`CompanySettings`, or a dedicated table — schema = Class-A,
listed for decision).

**Caveat (`PENDING HUMAN DETERMINATION`):** freee `id`s are not guaranteed monotonic with
`issue_date`; the human must pick a watermark that is actually monotonic (entryDate + id tiebreak, or
freee's own `updated_at` if exposed).

---

### PERF-03-05 — `include:{document:true}` over-fetches the `Document` relation  *(Severity: Medium)*

**Location:** `src/jobs/audit-job.ts:252` (`include: { document: true }`).

**Problem.** `processJournal` consumes exactly **one** field of the relation —
`journal.document.filePath` (line 84) — and `journal.document.id` (via `documentId`). The full
`Document` row (`fileName`, `fileType`, `fileSize`, `uploadDate`, `freeeDocumentId`, `createdAt`,
`companyId`) is fetched for every journal, and **most journals have no document** (`documentId` is
nullable; `document` is `Document?`). At 100k rows this is a large, mostly-unused join payload.

**Proposed change (`PENDING HUMAN DETERMINATION`):** project only what is consumed:

```ts
include: { document: { select: { filePath: true } } }
```

This compounds with PERF-03-01 (smaller pages) and PERF-03-02 (no per-row write fan-out). If paging
is adopted, the document can alternatively be fetched lazily only for the slice being processed.

**Caveat (`PENDING HUMAN DETERMINATION`):** confirm `processJournal`'s `JournalWithDocument` shape
(50-65) is satisfied by the projected `{ filePath }` (it is — no other `document.*` field is read).

---

### PERF-03-06 — No inter-job mutex in the scheduler  *(Severity: Low)*

**Location:** `src/jobs/scheduler.ts:21-69`.

**Problem.** Cron schedules: `journal-sync` 01:00, `audit-job` 02:00 **daily**, `weekly-audit` Mon
02:00, `monthly-audit` 1st 02:00. The weekly/monthly audits share the **same minute** as the daily
`audit-job`, and `startScheduler` (71-104) imposes no lock — so on Monday the 1st, **two** (or three)
`runAuditJob` instances can run concurrently. Under PERF-03-01's current one-shot read that doubles
the up-front heap allocation, and the AI concurrency is `2 × AUDIT_CONCURRENCY` in flight.

**Proposed change (`PENDING HUMAN DETERMINATION`):** a minimal in-process running-job guard
(`Set<string>` of active job names checked in the cron callback, 82-100) **or** simply stagger the
minutes (e.g. weekly/monthly at 02:15). The latter is the lower-risk change.

**Caveat (`PENDING HUMAN DETERMINATION`):** an in-process lock only helps if all jobs share one Node
process. If the deployment runs jobs as separate workers/processes (Class-A infra decision), the lock
must be distributed (a DB row or Redis) — out of scope to specify here.

---

### PERF-03-07 — Default daily audit filters on `auditStatus` alone (no `companyId`)  *(Severity: Medium)*

**Location:** `src/jobs/audit-job.ts:224-248, 250`.

**Problem.** The default `runAuditJob()` (scheduler.ts:31, no options) builds `whereClause =
{ auditStatus: 'PENDING' }` with **no `companyId`**. The only status-supporting index is
`@@index([companyId, auditStatus])` (schema 129); by the leftmost-prefix rule it **cannot** serve a
query that filters on `auditStatus` without `companyId` → the default run is a **full table scan** of
`journals`, worsened by the PERF-03-01 one-shot load and PERF-03-05 over-fetch. This is reachable
(daily 02:00), so it is a real, not theoretical, cost at scale.

**Proposed change (`PENDING HUMAN DETERMINATION`) — two non-exclusive options:**
- **Drive the default run per-company.** Iterate `prisma.company.findMany({ select:{ id:true } })`
  and run the audit with `companyId` set each iteration (mirrors `journal-sync`'s company loop,
  53-57). Each per-company query is then index-backed by `[companyId, auditStatus]`. No schema change.
- **Add `@@index([auditStatus])`** so the status-alone query is supported. **Schema is Class-A** —
  this is listed for human decision only and was not applied.

**Caveat (`PENDING HUMAN DETERMINATION`):** the per-company loop multiplies job count; weigh against
the one-shot scan. Either choice is compatible with PERF-03-01 paging.

## 5. Related paths — observed but out of scope to modify

These were read for context. They are **Class-A** and were **not** proposed for change; they are
noted because any human actioning §4 should be aware of them.

- **`src/lib/integrations/freee/data-sync.ts` `syncJournalsToDatabase` (20-60)** — the *API*-triggered
  ingest path (`src/app/api/freee/sync/route.ts`). It calls `client.getJournals(fy, startMo, endMo)`
  **without** a `limit`/`offset` loop, so it uses the client defaults (`limit=100, offset=0`) and
  **silently fetches only the first 100 journals of each month** (data-sync.ts:38; client.ts:240-275).
  For any month with >100 journals this is a **latent data-truncation bug** on the API ingest path,
  independent of the perf items above. Its per-journal `upsert` (62-102) is the same N+1 class as
  PERF-03-03 (1 round-trip/row). **Action on the scheduler path (`journal-sync.ts`) does NOT fix this
  path — they are separate implementations.** `PENDING HUMAN DETERMINATION` whether to file this as a
  separate correctness task (it lives entirely under Class-A `freee/**`).
- **`src/jobs/exchange-rate-fetch-job.ts`** — not a journal/audit path; fetches a handful of BOJ rates
  daily. Its retry loop (12-29) uses un-cancellable recursive `setTimeout`, which can stack if the
  job is re-invoked mid-retry, but the data volume is tiny. Not a large-dataset concern; noted only
  for completeness. `PENDING HUMAN DETERMINATION`.
- **`src/jobs/scheduler.ts` `runJobManually` (133-151)** — exposes the jobs to ad-hoc invocation;
  relevant because it is how a human could trigger a large-range `syncJournals` / `runAuditJob` that
  exercises the 100k+ paths outside the bounded daily windows.

## 6. Read paths verified CLEAN (no action proposed)

- **`exchange-rate-fetch-job.ts`** — single BOJ API call per run; no DB bulk read; out of the
  large-dataset profile (see §5 note).
- **`scheduler.ts` orchestration** — aside from PERF-03-06, the cron wiring itself issues no DB
  reads; the cost lives in the handlers it calls.

## 7. Index review (all conclusions `PENDING HUMAN DETERMINATION`)

Model → existing index → supports which proposed change?

| Model | Relevant existing index(es) | Used by | Supports proposed change? |
|-------|------------------------------|---------|---------------------------|
| `Journal` | `@@index([companyId, entryDate])` (128) | PERF-03-01 paging `orderBy:entryDate` | **Yes** when `companyId` is set; the default no-company run cannot use it |
| `Journal` | `@@index([companyId, auditStatus])` (129) | PERF-03-07; PERF-03-01 default run | **Yes** per-company; **No** for status-alone (leftmost-prefix) — basis of PERF-03-07 |
| `Journal` | `@unique freeeJournalId` (112) | PERF-03-03 existence probe/upsert | **Yes** — `freeeJournalId:{in:…}` and `upsert` are index-backed |
| `Journal` | `@id id` (109) | PERF-03-02 `updateMany({ id:{in} })`; cursor | **Yes** |
| `AuditResult` | `@@index([journalId])` (164) | PERF-03-02 `createMany` consumer side | **Yes** (write target itself is unindexed-write, fine) |
| `Document` | (consumed via `Journal.document`) | PERF-03-05 | n/a — projection only |

**Bottom line:** PERF-03-01..06 need **no** schema change. PERF-03-07 *optionally* wants
`@@index([auditStatus])`, but the per-company rewrite avoids it entirely; the index is listed only as
a Class-A decision for the human.

## 8. Streaming / chunking primitives summary (`PENDING HUMAN DETERMINATION`)

A consolidated view of the patterns proposed across §4, for the human to decide on as a set:

| Primitive | Where applied | Mechanism |
|-----------|---------------|-----------|
| **Cursor paging (read)** | PERF-03-01 | bounded `take` + re-query on mutating `auditStatus`; bounded heap |
| **Bulk insert (`createMany`)** | PERF-03-02, PERF-03-03 | one INSERT per batch; `skipDuplicates` for idempotent ingest |
| **Bulk update (`updateMany`, status-grouped)** | PERF-03-02 | one UPDATE per distinct status value per batch |
| **Bulk existence probe (`where:{id:{in}}`)** | PERF-03-03 | replace per-row `findUnique` with one indexed `findMany` |
| **Projection (`select`)** | PERF-03-05 | fetch only `filePath`, not the full `Document` row |
| **Resume / high-water mark** | PERF-03-04 | persist per-company last-synced position; mirrors audit's status-based resumability |
| **Job mutex / stagger** | PERF-03-06 | in-process guard or offset cron minutes |

**Backpressure / AI concurrency note (`PENDING HUMAN DETERMINATION`):** the audit worker is AI-bound
(one LLM/OCR call, optionally two). Paging bounds *memory*, but the AI call rate is governed solely by
`AUDIT_CONCURRENCY` (default 5). If 100k journals each trigger an AI call, total wall-time is
`100k / concurrency × per-call-latency` regardless of paging. The human should confirm whether the AI
provider's rate limiter (separate concern, see outbound rate-limiting) is the real ceiling before
optimizing DB round-trips further.

## 9. Suggested implementation ordering (for the human, not prescriptive)

`PENDING HUMAN DETERMINATION` — if any of this is actioned, an order by impact/risk:

1. PERF-03-01 (highest impact; bounds memory; prerequisite for safely raising volumes).
2. PERF-03-05 (trivial, compounds 01; no behavior risk).
3. PERF-03-07 (removes the full-scan default run; per-company rewrite is schema-free).
4. PERF-03-02 / PERF-03-03 (write batching; needs the error-isolation strategy resolved first).
5. PERF-03-04 (resume; depends on a Class-A storage decision).
6. PERF-03-06 (cheap stagger; lowest risk).

## 10. Constraints respected

- **One file written:** `docs/proposals/perf-03.md` (this file). No source modified.
- **Class-A untouched:** every proposal that would touch `prisma/schema.prisma` (PERF-03-07 index,
  PERF-03-04 watermark storage) is framed as "for human decision" and was **not** applied. The
  Class-A API ingest path (`freee/data-sync.ts`, `api/freee/sync/**`) is referenced in §5 only.
- **No approvals / no reviewers / no sign-offs** appear anywhere in this document.
- **Every conclusion is marked `PENDING HUMAN DETERMINATION`.**

---

*End of analysis — all items `PENDING HUMAN DETERMINATION`.*
