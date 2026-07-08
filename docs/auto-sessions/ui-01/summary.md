# UI-01 — Loading / error / empty states for report & chart components

## Goal
Ensure each data-driven report/chart component renders explicit **loading**
(skeleton), **error**, and **empty** states, matching the existing skeleton
pattern (`src/components/ui/skeleton.tsx` → `.animate-pulse`), with tests
asserting each state.

## Approach
Two new shared primitives in `src/components/charts/` (the existing charts
home — not a Class-A path), reused by every data-driven chart:

1. **`resolve-chart-status.ts`** — pure helper that encodes the state
   precedence `loading > error > empty > ready`. Returns
   `Result<ChartResolution, AppError>` and validates input with Zod
   `safeParse` (honours the project Result + Zod conventions). Centralising
   the precedence here keeps it DRY and unit-testable in isolation.
2. **`chart-state.tsx`** — presentational component rendering the three
   non-ready states with existing tokens: `Skeleton` (`animate-pulse`),
   `AlertCircle` + `text-destructive` (error, `role="alert"`), and
   `text-muted-foreground` (empty). Loading uses `role="status" aria-busy`.

Each chart component gained optional `loading?: boolean` and
`error?: string | null` props and early-returns the resolved state before
rendering data (so recharts is never touched while loading/error/empty, and
no formatting work runs). Existing empty-state copy is preserved verbatim,
including the IR components' `language` aware messages.

## Components changed (7)
- `src/components/charts/MonthlyTrendChart.tsx`
- `src/components/charts/CashFlowChart.tsx` (`CashFlowChart` + `CashFlowWaterfallChart`)
- `src/components/charts/BudgetVsActualChart.tsx` (`BudgetVsActualChart` + `BudgetVsActualHorizontalChart`)
- `src/components/reports/ir/financial-highlights-chart.tsx`
- `src/components/reports/ir/shareholder-pie-chart.tsx`

State precedence: `loading` → `error` → empty (`data.length === 0`) → render chart.

## Tests
- **New** `tests/components/charts/chart-state.test.tsx` — covers
  `resolveChartStatus` (precedence, defaults, Zod failure →
  `Result` failure with `VALIDATION_ERROR`) and `ChartState` (all three
  states, custom/default messages, accessibility roles, skeleton line count).
- **New** `tests/components/reports/ir/shareholder-pie-chart.test.tsx` —
  loading/error/empty + content assertions.
- **Updated** the three recharts test files and
  `financial-highlights-chart.test.tsx`: the old "renders without crashing
  for empty data" cases (which asserted the recharts payload) now assert the
  empty state, and loading/error/precedence cases were added.

recharts stays mocked (`vi.mock('recharts', …)`) exactly as before; the new
state branches never reach recharts, so the mock is sufficient and no
ResizeObserver handling was needed.

## Constraints honoured
- No Class-A path modified (read-only reference only).
- No `any`, `@ts-ignore`, `@ts-expect-error`, `.skip`, lint-disable, or
  coverage-threshold change.
- Additive, minimal diffs; existing idioms matched; new helper returns
  `Result<T,E>` and validates with Zod `safeParse`.
- No new dependencies.
- Only the added/modified test files were executed (known whole-suite OOM).

## Verification
- `pnpm exec vitest run <the 6 files>` → 64 passed.
- `pnpm typecheck` → 0 errors.
- `pnpm exec eslint --max-warnings=0 <all changed files>` → exit 0.
- `node scripts/autopm_verify.mjs --changed-only` → **exit 0** (typecheck 0 errors, eslint 0 warnings on 13 changed files, vitest 64 passed / 6 files).
