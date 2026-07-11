# perf-bench-01 — Design decisions (ADR)

## ADR-1: `*.bench.ts` + dedicated `vitest.bench.config.ts` (not `*.test.ts`)

**Context.** Specs must run standalone yet stay out of the default unit shards. The default
`vitest.config.ts` uses `include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx']`.

**Options considered.**
- Name them `*.test.ts` under `tests/benchmark/` and add `tests/benchmark/**` to the default
  config's `exclude`. **Rejected:** an `exclude` entry also blocks the explicit CLI path
  (`vitest run tests/benchmark/x.test.ts` → "No test files found"), so standalone would break.
- Name them `*.bench.ts` with a dedicated config whose `include` matches `*.bench.ts`.

**Decision.** `*.bench.ts` + `vitest.bench.config.ts`. The default `include` (`*.test.ts(x)`)
already excludes `*.bench.ts`, so no `exclude` is needed and shards are clean. Standalone runs
go through `--config vitest.bench.config.ts` (wrapped as `pnpm test:bench`). This matches the
prior session note on vitest shard exclusion.

**Consequence.** `autopm_verify` needed a dedicated `vitest-bench` step (the default vitest
step only resolves `*.test.ts`).

## ADR-2: One canonical 100k-journal dataset; derive each bench's input from it

**Context.** The three target workloads consume different shapes: the report pipeline reads
`MonthlyBalanceRow[]`, budget variance reads a `ProfitLoss` + budget rows, and analysis reads
journals directly. No product function reduces journals → balances (balances are ingested
directly via import), so "report aggregation" cannot be fed journals literally.

**Decision.** The factory generates 100k journals once (seeded). Each bench derives the input
shape its real target actually consumes:
- balances: group journals by (month, account) — `journalsToBalanceRows`
- P&L: classify journals by account category (revenue credited, cost/SGA debited) —
  `journalsToProfitLoss`
- analysis: use journals directly.

The derivation lives in the harness (`support/derive.ts`), is deterministic, and is Zod-gated.
The bench measures the **real exported product function** (`getMultiMonthReport`,
`calculateActualVsBudget`+`analyzeBudgetVariance`, `JournalChecker.batchCheck`/`analyzeJournal`),
not the derivation.

**Consequence / honest framing.** Report aggregation and budget variance operate on compact,
realistic inputs (monthly balances / P&L line items are inherently small), so their timings are
sub-millisecond-to-single-ms. Only the analysis bench runs over all 100k journals. This reflects
the genuine cost profile of each workload rather than inflating compact workloads to 100k.

## ADR-3: Targeted `vi.mock` per bench (no real DB)

**Context.** `getMultiMonthReport` and `calculateActualVsBudget` are async + DB-backed
(`prisma.company.findFirst`, `fetchBalancesByFiscalYear`, `getBudgetsByMonth`). A real DB seed
of 100k rows would be slow and non-deterministic.

**Decision.** Each DB-backed bench installs a file-scoped `vi.mock` for the narrowest
dependency it touches (`@/lib/db` company.findFirst; `@/services/report/balance-loader`
fetchBalancesByFiscalYear; `@/services/budget/budget-service` getBudgetsByMonth), returning the
derived dataset. This isolates the measurement to the **pure aggregation/variance logic**, not
DB I/O, and keeps it deterministic. The analysis bench needs no DB at all (`JournalChecker` is
constructed with a no-`validateEntry` AI stub so the AI branch is skipped).

## ADR-4: `fileParallelism: false` in the bench config

**Context.** The merged `bench-report.json` is assembled by each bench writing its section then
re-merging all sections present.

**Decision.** Disable file parallelism so files run sequentially. The last-finishing file's
merge sees every section → the final on-disk `bench-report.json` is complete and deterministic.
A side benefit is stabler timings (no cross-file CPU contention). Per-section files are always
correct regardless.

## ADR-5: Structural assertions, not hard timing thresholds, guard against fake green

**Context.** Wall-clock assertions are machine-dependent and flaky; a bench that only logs
time is effectively unverified.

**Decision.** Each bench asserts a **deterministic structural** property of the real function's
output (4 report sections / 12 months; budget line-items > 0 and finite variance; validation
results count === 100k; every `analyzeJournal` result has a known status). Timing is recorded
but not hard-asserted. A green run therefore proves the real code executed correctly over the
synthetic dataset — a no-op or broken implementation fails the structural check.

## ADR-6: New `bench`/`benchSupport` buckets in `autopm_verify`

**Context.** `classifyChanged` previously routed `tests/benchmark/**` (non-`*.test.ts`) files
to `other`, which the gate never verifies — i.e. a bench file change would pass the gate
without being typechecked, linted, or run (fake green).

**Decision.** Split into `bench` (`*.bench.ts` → typecheck + lint + `vitest-bench`) and
`benchSupport` (other `tests/benchmark/**/*.ts` → typecheck + lint only). Added to the
typecheck changedSet and eslint targets, plus a new `runVitestBench` step using the dedicated
config. This is the change that makes the DoD (`--changed-only` exits 0) meaningful for this
task rather than vacuously green.
