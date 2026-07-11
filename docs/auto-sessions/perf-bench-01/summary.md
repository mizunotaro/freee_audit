# perf-bench-01 — Synthetic 100k-journal benchmark harness

## Outcome

Added a deterministic synthetic-data generator (100k journal entries, seeded RNG) and
four benchmark specs under `tests/benchmark/` that feed the generated dataset into three
real product code paths and write wall-clock timings to a JSON artifact. The specs run
**standalone only** (`pnpm test:bench`) and are excluded from the default unit shards.

**Definition of Done — MET:** `node scripts/autopm_verify.mjs --changed-only` → exit `0`
(typecheck clean whole-repo, eslint clean on 8 files, vitest-bench 4/4 passed in ~5.8s).

## What was added

| File | Purpose |
|------|---------|
| `tests/benchmark/support/rng.ts` | Seeded mulberry32 PRNG (`createRng(seed)`) — deterministic, no `Math.random`. |
| `tests/benchmark/support/accounts.ts` | Deterministic account catalog (~320 accounts) keeping budget-prefix (rev `4xxx`, cost `5xxx`, SGA `6xxx`) and report-category conventions. |
| `tests/benchmark/support/journal-factory.ts` | `generateJournals({count, companyId, fiscalYear, seed})` → `Result<Journal[], AppError>`, Zod-validated, double-entry realistic. |
| `tests/benchmark/support/derive.ts` | `journalsToBalanceRows` + `journalsToProfitLoss` → `Result<…, AppError>`, Zod-validated. |
| `tests/benchmark/support/bench-reporter.ts` | `recordBench(...)` → min/median/mean/p95/max JSON artifact + merged report. |
| `tests/benchmark/report-aggregation.bench.ts` | `getMultiMonthReport` over balances derived from 100k journals (12 months). |
| `tests/benchmark/budget-variance.bench.ts` | `calculateActualVsBudget` + `analyzeBudgetVariance` over a P&L derived from 100k journals. |
| `tests/benchmark/analysis-queries.bench.ts` | `JournalChecker.batchCheck` over all 100k journals + `analyzeJournal` over a 5k sample. |
| `vitest.bench.config.ts` | Dedicated jsdom config; `include: tests/benchmark/**/*.bench.ts`; `fileParallelism: false`. |
| `tests/benchmark/README.md`, `.gitignore` | How to run; `.artifacts/` is gitignored (machine-specific timings). |

## What was modified (additive, minimal)

- `scripts/autopm_verify.mjs` — added `bench` (`*.bench.ts`) and `benchSupport` (other
  `tests/benchmark/**/*.ts`) buckets. Both are typechecked + linted; `bench` files also
  run under `vitest run --config vitest.bench.config.ts`. Without this, bench files fell
  into the `other` bucket = silently skipped (fake green).
- `package.json` — added `test:bench` script.

## Measured timings (seed `0x12345678`, this worktree, single sample run)

| Bench | Input | Median | Notes |
|-------|-------|--------|-------|
| `report-aggregation` | balances ← 100k journals, 12 months | ~4.4 ms | 4 sections (BS/PL/CF/KPI); compact derived input. |
| `budget-variance` | P&L ← 100k journals, 1 month (220 line items) | ~0.12 ms | 44 significant variances flagged. |
| `analysis-batch-check` | **100k journals**, no AI | **~143 ms** | **Hottest path** — ~1.4 µs/journal, serial `for…await`. |
| `analysis-per-entry` | 5k sample | ~9.7 ms | regex amount/date extraction per entry. |

Artifacts written to `tests/benchmark/.artifacts/bench-report.json` (gitignored).

## Findings / follow-up candidates (no prod code changed in this task)

- **`JournalChecker.batchCheck` is the hotspot.** At ~143 ms / 100k entries it dominates the
  others by ~30×. `batchCheck` is a serial `for { await this.check(...) }` loop; the per-entry
  `check()` is synchronous CPU but wrapped in `await`, so each entry pays a microtask yield.
  Candidate follow-up: batch the synchronous rule checks without per-entry `await` (only the
  optional AI call genuinely needs to be async), or run the rule phase with a plain `for` loop
  and `await` only when `validateEntry` is actually invoked. **Reported, not fixed** (Class-A
  audit path is read-only for this task).
- **Report aggregation and budget variance are not bottlenecks** at realistic scale (monthly
  balances / P&L line items are inherently compact). The 100k journals collapse to ~3,600
  balance rows and ~220 P&L items respectively.
- The nightly `audit-job` runs this exact `JournalChecker` across every journal — so the
  ~1.4 µs/entry cost is the real per-record audit tax (per memory: `batchCheck` is one of only
  two live analysis engines).

## Constraints honored

- **No Class-A path modified** (prisma schema/migrations, auth/crypto/security/audit,
  conversion, valuation, tax, kpi, debt, deferred-accrual, journal-proposal, freee, the listed
  api/** routes, python/r services). All targets are imported read-only.
- **No `any`, `@ts-ignore`, `@ts-expect-error`, `.skip`, lint-disable, or coverage change.**
- New helpers return `Result<T, AppError>` (`@/types/result`) and validate inputs with Zod
  `safeParse`. `AppError` (not `Error`) used consistently so `failure(createAppError(...))`
  typechecks.
- Each bench asserts a **deterministic structural** result (section count, line-item count,
  validation-result count) so a green run proves the real code executed correctly — not a
  no-op.
- Benches run standalone and are **excluded from default shards**: `vitest run
  tests/benchmark/*.bench.ts` under the default config returns "No test files found" (include
  is `*.test.ts(x)`); they require `--config vitest.bench.config.ts`.
- No new dependencies.

## How to run

```bash
pnpm test:bench                                                     # all benches
pnpm exec vitest run --config vitest.bench.config.ts tests/benchmark/report-aggregation.bench.ts
```

See `decisions.md` for the design rationale (bench naming/dedicated config, deriving inputs
from the canonical 100k journals, mocking strategy).
