# Performance benchmarks (perf-bench-01)

Deterministic synthetic-data benchmarks that feed **100k generated journal entries**
into three real product code paths and record wall-clock timings to a JSON artifact.

The specs use the `*.bench.ts` extension and a dedicated vitest config so they run
**standalone only** and are excluded from the default unit shards (`vitest.config.ts`
matches `*.test.ts(x)`).

## Run

```bash
# all benchmarks
pnpm test:bench

# equivalent explicit form
pnpm exec vitest run --config vitest.bench.config.ts tests/benchmark

# a single benchmark file
pnpm exec vitest run --config vitest.bench.config.ts tests/benchmark/report-aggregation.bench.ts
```

`fileParallelism` is disabled in `vitest.bench.config.ts` so timings are stable and the
merged report is written deterministically.

## What is measured

| Bench | Product code path | Input |
|-------|-------------------|-------|
| `report-aggregation` | `getMultiMonthReport` (BS/PL/CF/KPI section builders) | balances derived from 100k journals, 12 months |
| `budget-variance` | `calculateActualVsBudget` + `analyzeBudgetVariance` | P&L derived from 100k journals for one month |
| `analysis-batch-check` | `JournalChecker.batchCheck` | all 100k journals w/ synthetic receipts (no AI) |
| `analysis-per-entry` | `analyzeJournal` (amount/date regex extraction) | 5k sample |

## Dataset

`support/journal-factory.ts` generates 100k double-entry `Journal` records from a seeded
mulberry32 RNG (`seed = 0x12345678`), so every run produces byte-identical data. Accounts
are drawn from `support/accounts.ts`, whose codes keep the budget-prefix and report-category
conventions intact (revenue `4xxx`, cost of sales `5xxx`, SGA `6xxx`).

## Output

Each run writes one JSON file per bench plus a merged report to
`tests/benchmark/.artifacts/` (gitignored — machine-specific timings):

```
tests/benchmark/.artifacts/
├── bench-report.json          # merged report
├── report-aggregation.json
├── budget-variance.json
├── analysis-batch-check.json
└── analysis-per-entry.json
```

Each section records `min/median/mean/p95/max` ms, iteration count, input size, and a
structural `assertion` (`passed`/`failed`) so a green run proves the real code executed
correctly over the synthetic dataset — not a no-op.
