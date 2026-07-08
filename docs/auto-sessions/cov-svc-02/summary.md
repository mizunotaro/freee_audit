# COV-SVC-02 — Unit-test coverage: budget + cashflow + closing

## Scope
Add focused unit tests for exported functions lacking a mirror test under
`tests/unit/services` for:
- `src/services/budget`
- `src/services/cashflow`
- `src/services/closing`

## Coverage enumeration

Every export in the three service areas was mapped against `tests/unit/services`.
Only **one** source module had no mirror test file:

| Module | Exports | Status before |
|---|---|---|
| `budget/budget-service.ts` | 11 | fully covered (2 files) |
| `budget/budget-import.ts` | 4 | fully covered |
| `budget/detailed-actual-vs-budget.ts` | 1 | covered |
| **`budget/actual-vs-budget.ts`** | `calculateActualVsBudget`, `analyzeBudgetVariance`, `getMonthlyBudgetTrend` | **no test file** |
| `cashflow/calculator.ts` | `calculateCashFlow`, `calculateFreeCashFlow` | covered, but the documented interest-classification branch (JGAAP/USGAAP/IFRS + `interestPaidAsOperating`) was only asserted with `toBeDefined()` |
| `cashflow/cash-position.ts` | 2 | covered |
| `cashflow/runway-calculator.ts` | 3 | covered |
| `closing/closing-entries.ts` | 5 | covered |

## Changes (additive only — no source or existing tests modified)

### `tests/unit/services/budget/actual-vs-budget.test.ts` (new, 15 tests)
- `calculateActualVsBudget`: exact budget→actual mapping, variance, achievement rate
  (incl. one-decimal rounding), totals aggregation (revenue/expenses/operating income),
  no-budget (rate 0 via `safeDivide`), empty PL, and rejection propagation from
  `getBudgetsByMonth`.
- `analyzeBudgetVariance` (pure): threshold filtering with over/under classification,
  sort by `|variancePercent|` desc, one-decimal rounding, custom threshold, zero-budget
  skipping, operating-income-level summary, empty/zeroed totals.
- `getMonthlyBudgetTrend`: per-month budget summing across accounts, 12-month shape,
  missing-actual-as-zero, all-zero case, rejection propagation.
- Mocks `@/services/budget/budget-service` at the boundary; uses the **real**
  `safeDivide` (pure logic). No `any`.

### `tests/unit/services/cashflow/calculator-extended.test.ts` (new, 11 tests)
- Interest classification across standards with **exact** operating/financing net values:
  JGAAP (default) moves interest to financing; USGAAP keeps it in operating; IFRS = JGAAP
  path; `interestPaidAsOperating` override in both directions; multi-line interest summing
  with an unrelated expense ignored; no-interest path.
- Depreciation add-back (exact value) and `depreciation` fallback to 0.
- `beginningCash`/`endingCash` derivation with/without a previous BS.
- Uses a cash-only BS fixture so every BS-driven CF delta is 0 and operating CF reduces
  to `netIncome + depreciation + interestAdjustment` (deterministic). No `any`.

## Constraints honored
- No Class-A path touched. No source files modified at all — additive test files only.
- No `any`, `@ts-*`, `.skip`, lint-disable, or coverage-threshold change. No new deps.
- Real assertions (exact expected values); error paths use `mockRejectedValue` + `rejects.toThrow`.
  No fake timers are advanced in these files, so the vitest worker-crash pattern does not apply.
- Only the two new test files were executed (never the full suite).

## Verification
```
node scripts/autopm_verify.mjs --changed-only  →  exitCode 0
  typecheck: total errors=0, relevant=0
  eslint:    ok (2 files, 0 warnings)
  vitest:    26 passed (2 files)
```

Prereq note: this worktree had no `node_modules`; ran `corepack pnpm install` then
`corepack pnpm db:generate` before verify (prisma client needed for the `Budget` type
import in `actual-vs-budget.test.ts`).
