# COV-COMP-01 — Unit-test coverage: components/charts + components/currency

## Scope
Added focused unit tests (50 cases) for all 12 exported components across the two
in-scope directories. No production source was modified — the changes are purely
additive test files (`tests/components/**`).

## Test files added

| File | Exports covered | Tests |
|------|-----------------|-------|
| `tests/components/charts/KPIGauge.test.tsx` | `KPIGauge`, `KPIRing`, `KPIBar`, `KPICard` | 17 |
| `tests/components/charts/BudgetVsActualChart.test.tsx` | `BudgetVsActualChart`, `BudgetVsActualHorizontalChart` | 8 |
| `tests/components/charts/CashFlowChart.test.tsx` | `CashFlowChart`, `CashFlowWaterfallChart` | 8 |
| `tests/components/charts/MonthlyTrendChart.test.tsx` | `MonthlyTrendChart` | 4 |
| `tests/components/currency/dual-currency-display.test.tsx` | `DualCurrencyDisplay`, `DualCurrencyInline`, `ExchangeRateBadge` | 13 |

## What is actually asserted (real logic, not rendering smoke)
- **KPIGauge**: gauge fill cap at 100 (via captured Pie `data`), the four status-color
  thresholds (green/blue/amber/red) via the value element's inline style, custom unit/size.
- **KPIRing**: percentage cap at 100, partial percentage, custom color passthrough.
- **KPIBar**: percentage text cap at 150 vs. bar width cap at 100 (two distinct caps),
  `showValue` toggle.
- **KPICard**: numeric locale grouping, string-value passthrough, up/down change
  computation `(value-previous)/|previous|*100`, description rendering.
- **BudgetVsActualChart / Horizontal**: `achievementRate = budget>0 ? actual/budget*100 : 0`
  including the divide-by-zero guard for `budget === 0` and `budget < 0`, formatted
  currency attachments, and the `showVariance` bar toggling (3 vs 2 bars).
- **CashFlowChart**: formatted attachments, and `showCumulative` toggling of the right
  Y-axis + cumulative line (2 vs 1 YAxis, 1 vs 0 Line).
- **CashFlowWaterfallChart**: running `start`/`end` accumulation across the series and the
  color rule (`total` → gray, `value >= 0` → green, `value < 0` → red).
- **MonthlyTrendChart**: per-metric formatted currency attachments, four lines rendered,
  original fields preserved.
- **dual-currency-display**: `showDual` / missing-`exchangeRate` branching, JPY→USD
  (division) vs non-JPY→JPY (multiplication) direction verified against the real
  `formatCurrency`/`formatDualCurrency` service functions, `@rate` marker, rate rounding,
  date rendering.

## How the recharts boundary was handled
recharts is mocked at the top of each chart test file (via `vi.hoisted` + `vi.mock`) with
stub components that (a) return `props.children` so the component tree still mounts, and
(b) capture the `data` array each chart wrapper receives plus a render log. This makes the
components' **own** transform logic (achievement rate, waterfall accumulation, formatted
fields, conditional series) directly observable without depending on recharts' SVG/Resize
behavior in jsdom, and without touching any production code. The currency component uses no
recharts and is rendered plainly.

## Notes / honesty
- No Class-A path was touched (read-only reference only).
- No `any`, `@ts-ignore`, `.skip`, lint-disable, or coverage-threshold change.
- The numeric formatting in the chart components delegates to `@/lib/utils` `formatCurrency`
  (asserted via the same function rather than hard-coded Intl output, to stay locale-agnostic).
- The inline `color` status values are asserted through a hex↔rgb tolerant helper because
  jsdom normalizes inline `color` hex values to `rgb(...)`.

## Verification
```
corepack pnpm exec vitest run <the 5 files>   # 50 passed
node scripts/autopm_verify.mjs --changed-only  # exit 0
```
