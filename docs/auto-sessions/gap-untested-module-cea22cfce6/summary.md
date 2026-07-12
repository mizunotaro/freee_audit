# gap-untested-module-cea22cfce6 — Add unit tests for `src/services/report/cash-flow.ts`

**Risk class:** C · **Target:** `src/services/report/cash-flow.ts` (pure calculation module, no DB/network/clock collaborators) · **Detected:** 2026-07-09

## Outcome

Created `tests/unit/services/report/cash-flow.test.ts` mirroring the source path under `tests/unit/`.
The target module is pure arithmetic (no external collaborators), so tests are fully
deterministic with no mocking required. No production code was changed.

**Results:** 48 tests pass · `tsc --noEmit` 0 errors · `eslint --max-warnings=0` clean on both files.

## Coverage rationale — every public export covered

The module exports 10 symbols (1 interface + 9 functions). Each function has happy-path,
edge (zero/negative/boundary), and fail-safe (finite-output / no-throw) assertions.

### `calculateOperatingCF(inputs)` — 5 tests
- Happy path: `1000+100+50-200-100+150+75 = 1075`.
- All-zero input → `0`.
- Working-capital growth (AR + inventory) reduces cash back to `0`.
- Net loss preserved: `-4000 + 1000 = -3000`.
- Fail-safe: `MAX_SAFE_INTEGER/10` inputs stay finite.

### `calculateInvestingCF(inputs)` — 4 tests
- Happy path: `-300 + 80 = -220`.
- Zero activity → `0`.
- Sales > purchases → positive.
- Fail-safe: large amounts stay finite.

### `calculateFinancingCF(inputs)` — 3 tests
- Happy path: `500 - 200 - 50 = 250`.
- Zero activity → `0`.
- Repayments + dividends > proceeds → negative `-400`.

### `calculateCashFlowStatement(inputs)` — 8 tests
- Full structure: exact equality of all 12 line items (operating/investing/financing) + 3 net sub-totals + netChange/beginning/ending cash.
- **Invariant:** netChange = operating + investing + financing.
- **Invariant:** endingCash = beginningCash + netChange.
- **Invariant:** each section's netCash equals the sum of its own line items.
- periodStart/periodEnd are `Date` instances.
- Fail-safe: all-zero input → netChange/beginning/ending all `0`.
- Positive-net-change path: endingCash > beginningCash.
- Determinism: two calls with identical inputs yield identical sub-totals.

### `calculateGrossProfit(revenue, costOfSales)` — 4 tests
- `1000 - 600 = 400`, breakeven → `0`, loss → negative, zero-cost → revenue unchanged.

### `calculateOperatingIncome(grossProfit, operatingExpenses)` — 3 tests
- `400 - 250 = 150`, breakeven → `0`, operating loss → negative.

### `calculateNetIncome(oi, nonOpInc, nonOpExp, tax)` — 4 tests
- `150 + 30 - 20 - 40 = 120`, all-zero → `0`, net loss, no-non-op/no-tax → equals operating income.

### `aggregateByCategory(items)` — 5 tests
- Groups + sums by category (incl. negative accumulation).
- Items with `category === undefined` → `'default'` bucket.
- Empty array → empty `Map`.
- Three distinct categories kept separate.

### `calculateYoYGrowth(current, previous)` — 7 tests
- Positive growth `50%`, decline `-20%`.
- previous=0 branch: current>0 → `100`, current=0 → `0`, current<0 → `0`.
- Negative previous uses `Math.abs`: `50 vs -100 → 150%`.
- No change → `0`.

### `calculateMoMGrowth(current, previous)` — 5 tests
- Mirrors YoY logic (separate function in source): growth/decline, previous=0 branches,
  negative-previous `Math.abs` branch.

## Assertions added (count: 48 `it` blocks)

Happy-path: 10 · Edge/boundary (zero, negative, breakeven): 22 · Invariant/consistency: 8 ·
Fail-safe (finite/large/deterministic/no-throw): 8.

## Quality gate

- `corepack pnpm exec vitest run tests/unit/services/report/cash-flow.test.ts` → 48 passed.
- `corepack pnpm exec eslint --max-warnings=0 <test> <src>` → exit 0.
- `corepack pnpm exec tsc --noEmit` → exit 0 (prisma client generated to clear phantom TS7006 errors).
