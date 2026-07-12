# PERF-IMPL-02 — Summary

Implement the **remaining non-Class-A** recommendations from `docs/proposals/perf-02.md`
and `docs/proposals/perf-03.md` in non-Class-A **read paths**, with no regression.

> **Headline:** Every *safe, non-Class-A, read-path* recommendation across both proposals
> was already implemented in the codebase before this session (cursor paging, relation
> projection, scheduler mutex/stagger, the journal-sync bulk existence probe + `upsert`).
> The only items still open are either **Class-A** (all schema/index work), **write-path**
> changes the proposals explicitly defer to a human error-isolation decision, or
> **behaviour-change** decisions the proposals mark `PENDING HUMAN DETERMINATION`.
>
> This session therefore (a) verified each already-shipped read-path optimisation against
> its proposal, (b) closed the one genuine regression gap in their test coverage, and
> (c) documents — with constraint-based rationale — every item left untouched.

Definition of Done: `node scripts/autopm_verify.mjs --changed-only` exits **0**.

---

## 1. Classification of every recommendation

### PERF-02 — all schema → **Class-A, none actionable**

All seven proposals (P-01…P-07) are `prisma/schema.prisma` index changes (add/drop
`@@index`). `prisma/schema.prisma` and `prisma/migrations/**` are Class-A. PERF-02's own
Appendix A lists code-shaped issues, but four of five live in Class-A services:

| PERF-02 Appendix A | Location | Class-A? | Action |
|----|----|----|----|
| #1 no-`take` `findMany` of the PENDING set | `src/jobs/audit-job.ts` | No (= PERF-03-01) | **Already done** |
| #2 12 full scans in a month loop | `src/services/audit/accounting-basis-check.ts` | **Yes** | Forbidden |
| #3 JS-side count instead of `groupBy` | `src/services/audit/index.ts` | **Yes** | Forbidden |
| #4 offset deep-pagination streaming | `src/services/conversion/journal-converter.ts` | **Yes** | Forbidden |
| #5 unindexed-column `groupBy` scan | `src/services/conversion/journal-converter.ts` | **Yes** | Forbidden |

### PERF-03 — `src/jobs/**` (non-Class-A) read/write paths

| ID | Proposal | Status | Evidence |
|----|----------|--------|----------|
| PERF-03-01 | Bounded cursor paging of the PENDING set (High) | **Already done** | `audit-job.ts:265-324` — `while(true)` keyset cursor (`cursor:{id}`, `skip: cursor?1:0`, `take: pageSize`) |
| PERF-03-02 | Batch per-journal writes (High) | **Deferred** (see §3) | — |
| PERF-03-03 | Collapse journal-sync N+1 (High) | **Safe parts done; risky part deferred** | bulk probe `journal-sync.ts:100-104` + `upsert` `:131-135` |
| PERF-03-04 | Resume / high-water mark (Medium) | **Forbidden** (Class-A storage) | needs a watermark column/table |
| PERF-03-05 | Project only `filePath` from `document` (Medium) | **Already done** | `audit-job.ts:268` `include:{document:{select:{filePath:true}}}` |
| PERF-03-06 | Inter-job mutex / stagger (Low) | **Already done** | `scheduler.ts:21` `runningJobs` guard + staggered `15 2` / `30 2` |
| PERF-03-07 | Drive default audit per-company / add `[auditStatus]` index (Medium) | **Deferred** (see §3) | — |

The four done items are also already covered by tests that name the proposal IDs
(`audit-job.test.ts`: PERF-03-01 cursor, PERF-03-05 projection; `journal-sync.test.ts`:
PERF-03-03 bulk probe + per-row error isolation; `scheduler.test.ts`: PERF-03-06 stagger +
re-entrancy guard). The prior session that shipped them is not in `docs/auto-sessions/`
(the only perf session there, `impl-perf-01`, covered `perf-01.md` — the `report/**` read
paths — not perf-02/03), but the code and tests are present on `master`.

---

## 2. What this session changed

### `tests/unit/jobs/audit-job.test.ts` — two non-redundant regression tests

The existing PERF-03-01 test asserts paging *happens* (`findMany` called >1×, cursor
shape) but does **not** assert the two properties that are the actual point of PERF-03-01.
Both new tests fail if the optimisation is reverted:

1. **`bounds every page query to pageSize so heap stays O(pageSize), not O(N)`** —
   asserts every `findMany` call passes a numeric `take === 25` (`concurrency(5) ×
   PAGE_MULTIPLIER(5)`). This is the **memory guarantee**. Removing `take: pageSize`
   (reverting to the one-shot load) would leave the other PERF-03-01 assertions green
   while reintroducing the O(N) heap blowup — this test is what catches that.

2. **`pages to completion, processing each journal exactly once across a non-multiple
   page count`** — 130 journals at `concurrency:5` (6 data pages of 25/25/25/25/25/5 + 1
   terminating empty page). Asserts `findMany` called exactly **7×**, `totalProcessed`
   **130**, and — via a `journalChecker.check` spy — that all 130 distinct ids are
   processed with **no duplicates** (`skip:1` prevents the boundary row from being
   re-read) and **none skipped** (no off-by-one cursor). This is the cursor-correctness
   property PERF-03-01's own "stability" caveat worried about.

No source files were modified. No Class-A path touched. The audit/journal-sync/scheduler
job files were read-only reference.

Result: `vitest run tests/unit/jobs/audit-job.test.ts` → **20 passed** (18 → 20).

---

## 3. Deferred items — with rationale

All deferred items are flagged in the PR body per the "if it cannot be done safely, say so
and leave it" constraint. None is a fake-green skip: each is blocked by an explicit
constraint or by the proposal's own `PENDING HUMAN DETERMINATION` on a strategy decision.

### PERF-03-02 — Batch per-journal writes in `audit-job` (High) — **write path, human-deferred**

- **Scope mismatch:** the task targets non-Class-A *read* paths (pagination / query
  shaping / cache). PERF-03-02 is a **write**-path change (`auditResult.create` +
  `journal.update` → `createMany` + status-grouped `updateMany`).
- **Proposal defers the strategy:** PERF-03-02 §4 states *"The human must decide a
  strategy: keep per-row writes for the error rows, or wrap each batch's bulk write in its
  own try/catch and fall back to per-row on failure."* `createMany` is all-or-nothing on
  the batch, which breaks the per-journal error isolation the job currently relies on.
- **Subtle interaction:** `processJournal` writes inline in three return paths (success,
  document-analysis error, catch-all). Deferring writes to fold them into bulk writes
  restructures all three paths and shifts the timing of the `auditStatus` flip relative to
  the cursor loop. The proposal lists this as a behaviour-parity caveat, not a mechanical
  edit.
- **Decision:** leave. Safe to revisit in a dedicated, test-aware write-path pass once a
  human picks the error-isolation strategy.

### PERF-03-03 (remainder) — `createMany` for new journals in `journal-sync` — **breaks tested isolation**

- The **safe** parts are already shipped: the per-row `findUnique` existence probe was
  replaced by one indexed bulk probe (`journal.findMany({where:{freeeJournalId:{in}}})`,
  `journal-sync.ts:100-104`) and the 2-3 round-trip `findUnique`+`update`/`create` was
  collapsed to a single `upsert`/row (`:131-135`).
- The remaining `createMany`+`skipDuplicates` step is what the proposal flags as losing
  per-row error accounting. That isolation is an **asserted** behaviour
  (`journal-sync.test.ts` "preserves per-row error isolation when an upsert fails"), and
  `updateMany` cannot apply per-row `data`, so updates must stay per-row regardless.
- **Decision:** leave.

### PERF-03-04 — Resume / high-water mark (Medium) — **Class-A storage**

- Persisting a per-company last-synced position needs a home on a schema model
  (`Company`/`CompanySettings` column or a new table). The proposal itself says "Storage
  target is Class-A-adjacent … schema = Class-A, listed for decision."
- **Decision:** forbidden — no non-Class-A code-only form exists.

### PERF-03-07 — Index-serve the default audit run (Medium) — **behaviour change or Class-A**

- The default `runAuditJob()` filters `{ auditStatus: 'PENDING' }` with no `companyId`, so
  `[companyId, auditStatus]` cannot apply (leftmost-prefix) → status-alone full scan.
- The two fixes are: (a) drive the default run **per-company** — a *behaviour* change
  (multiplies job count, changes single-job summary / `notifyOnComplete` /
  `auditLogger.logAuditRun` semantics) the proposal marks a human tradeoff ("weigh against
  the one-shot scan"); or (b) add `@@index([auditStatus])` — **Class-A schema**.
- There is **no** non-Class-A, behaviour-preserving, code-only fix: a status-alone
  predicate cannot use a `companyId`-leading index without either adding `companyId` to
  the predicate (the behaviour change) or adding the index (Class-A).
- Note the urgency is already reduced: PERF-03-01 (the High item) bounds *memory*; the
  only remaining cost here is query-planner efficiency on the unindexed predicate, not a
  heap blowup.
- **Decision:** leave for human decision.

### PERF-02 P-01…P-07 — **Class-A schema**

- All seven are `prisma/schema.prisma` index add/drops. Forbidden.

---

## 4. Constraints respected

- **No Class-A path modified.** `prisma/**`, `src/lib/{auth,crypto,security,audit}/**`,
  `src/services/{audit,conversion,valuation,tax,kpi,debt,deferred-accrual,journal-proposal,
  freee}/**`, `src/lib/integrations/freee/**`, the Class-A `src/app/api/**` trees, and the
  microservices were read-only reference only.
- **No `any` / `@ts-ignore` / `@ts-expect-error` / `.skip` / lint-disable / threshold
  lowering.** New test params carry explicit types; no faked-green skips.
- **Additive, minimal diff** — one test file extended by two tests; no source change.
- **No new dependencies.**
- **No new TODO / FIXME / `raise NotImplementedError`.**

## 5. Verification

```
corepack pnpm exec vitest run tests/unit/jobs/audit-job.test.ts   # 20 passed
node scripts/autopm_verify.mjs --changed-only                      # exit 0 (DoD)
```
