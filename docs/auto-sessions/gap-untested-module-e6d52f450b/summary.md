# gap-untested-module-e6d52f450b — Unit tests for `wacc-input-panel.tsx`

**Target:** `src/components/valuation/wacc-input-panel.tsx`
**Test file (extended):** `tests/components/valuation/wacc-input-panel.test.tsx`
**Result:** 26 tests, all passing. ESLint 0/0, tsc 0 errors in touched files.

## Starting point

A scan-stale test file already existed (see memory `gap-tasks-often-already-satisfied`) with
3 tests covering only the loading skeleton, the industry `<select>` accessible name, and the
six tooltip info-buttons. It was **extended in place** rather than duplicated.

## Component summary

`WACCInputPanel` is a **controlled presentational** React component (no internal state, no
network calls). Its only real logic is `applyAdvice()`, which scales the AI advisor's decimal
`recommendedValues` into percentage inputs. Everything else is prop→DOM wiring. Tests therefore
exercise the prop contract and the fail-safe rendering branches.

## Assertions added

### Structure / props
- Renders title `WACC Calculator` and description `Weighted Average Cost of Capital`.
- `className` prop is applied to the Card root (verified via a sentinel class).

### Calculate button
- Enabled by default; clicking calls `onCalculate` exactly once.
- `isCalculating` disables the button and relabels it to `Calculating...` (**fail-safe**).

### Simple mode (`mode === 'simple'`)
- The single `WACC (%)` input is bound to `simpleValue` (e.g. `12.5` → `"12.5"`).
- The CAPM grid (`Beta (β)`, `Industry`) is **not** rendered in simple mode.
- `simpleValue: 0` renders `"0"` (not treated as empty / boundary).
- Typing `7.5` calls `onSimpleValueChange(7.5)`.
- Clearing the input calls `onSimpleValueChange(0)` — `Number('') === 0`, **fail-safe** coercion
  (never `NaN`).

### Mode switch (Radix `Switch`, `role="switch"`)
- In simple mode `aria-checked="false"`; clicking toggles `onModeChange('detailed')`.
- In detailed mode `aria-checked="true"`; clicking toggles `onModeChange('simple')`.

### Detailed mode inputs
- All six CAPM inputs render with their current values: Risk-Free Rate `0.8`, Market Risk
  Premium `6`, Beta `1`, Cost of Debt `2.5`, Tax Rate `30`, Debt Ratio `30`.
- Editing Beta fires `onDetailedInputsChange({ ...detailedInputs, beta: 1.5 })` — single-field
  merge, other fields preserved.
- Editing Cost of Debt independently fires `{ ...detailedInputs, costOfDebt: 3.25 }`.
- Industry `<select>` exposes all 8 options (`software … real_estate`) in order, and a change
  forwards `onIndustryChange('saas')`.

### AI advice
- With `advice` present: renders `AI Recommendations`, an `Apply All` button, and the formatted
  recommended values (`0.80%` risk-free, `1.20` beta, `6.0%` MRP).
- Clicking `Apply All` calls `onDetailedInputsChange` with decimals scaled ×100 and beta
  unchanged: `{ riskFreeRate: 0.8, marketRiskPremium: 6, beta: 1.2, costOfDebt: 2.5,
  taxRate: 30, debtRatio: 35 }`.
- `advice: null` → recommendations block and Apply All button are absent (**fail-safe**).
- `mode: 'simple'` hides advice even when it is supplied (the advice block lives in the detailed
  branch).

### Result display
- Detailed result with `components`: renders `8.25%`, the `CAPM-Based` badge, `9.00%`
  (cost of equity) and `1.50%` (after-tax cost of debt).
- Simple result: renders `10.00%`, no `CAPM-Based` badge, no components breakdown.
- `result: null` → no result card rendered (**fail-safe**).
- `wacc: 0` → `0.00%` (boundary).
- `wacc: -0.01` → `-1.00%` rendered without crashing (**fail-safe** for negative/edge values).

## Coverage rationale

The component has no computation besides `applyAdvice`, so coverage focuses on:
1. **Prop→DOM contract** for every interactive element (switch, inputs, select, buttons).
2. **`applyAdvice` scaling** — the one behavioral unit, asserted with exact expected output.
3. **Branch gating** — simple vs detailed rendering, presence/absence of advice and result.
4. **Fail-safe / edge cases** — empty (cleared) input → 0, `wacc` of 0 / negative, null advice
   and null result, `isCalculating` disabled state. These assert the component degrades to a
   safe, non-crashing state rather than emitting `NaN` or errors.

## Determinism

All collaborators are controlled props (`vi.fn()` mocks); no timers, network, RNG, or clock are
involved. Mocks are created fresh per test via a `buildProps()` factory to avoid cross-test call
counting. The shadcn `Switch` click is driven by `fireEvent.click` (Radix wires `onClick →
setChecked(!prev) → onCheckedChange`), and `aria-checked` reflects the controlled `mode`.

## Verification

```
corepack pnpm exec vitest run tests/components/valuation/wacc-input-panel.test.tsx
# 26 passed

corepack pnpm exec eslint --max-warnings=0 tests/components/valuation/wacc-input-panel.test.tsx
# clean (0 errors, 0 warnings)

corepack pnpm exec tsc --noEmit   # after `corepack pnpm db:generate`
# 0 errors in touched files
```
