# gap-untested-module-1ac96ca985 — Add unit tests for valuation-formula-display.tsx

**Target:** `src/components/valuation/valuation-formula-display.tsx`
**Test file:** `tests/components/valuation/valuation-formula-display.test.tsx`
**Risk class:** C
**Result:** 30 tests pass (was 2). `eslint --max-warnings=0` clean, `tsc --noEmit` clean.

## Starting point

A stale gap scan flagged the module as untested, but a test file already existed
(see memory `gap-tasks-often-already-satisfied`). The existing file had only 2
tests — empty-state and step-name rendering — leaving the bulk of the component's
logic uncovered. This session **extended** the existing file rather than creating
a duplicate.

## Public entry point covered

`ValuationFormulaDisplay` (default export). The two module-private helpers
`formatResult` and `formatNumber` are not exported, so they are exercised
indirectly through the rendered result string `{formatResult(step.output, step.unit)}`.

## Assertions added (coverage rationale)

### Empty state & header (fail-safe / props)
- Renders the accessible `role="status"` empty state with "No calculation steps
  available" when `steps={[]}`.
- Badge reads `0 steps` for empty input.
- Default title `Calculation Steps` is shown when no `title` prop is supplied.
- A custom `title` is rendered and the default title is dropped.
- Badge count reflects `steps.length` (`2 steps`).

### Step rendering (conditional rendering branches)
- Step `name` renders; the empty-state fallback is suppressed.
- Multiple steps all render by name.
- `step.unit` renders as a Badge.
- Empty `unit` omits the badge without breaking layout.
- `step.formula` and `step.formulaWithValues` both render.
- Falsy `formula` / `formulaWithValues` are omitted (`{step.formula && ...}` branch).

### Result unit formatting — `formatResult` branches
- `currency` → ` MM JPY` suffix.
- `MM JPY` alias → ` MM JPY` suffix.
- `percent` → `%` suffix.
- `%` alias → `%` suffix.
- `multiple` → `x` suffix.
- `x` alias → `x` suffix.
- Unknown unit (e.g. `shares`) → bare number, no suffix.

### Number magnitude formatting — `formatNumber` boundaries
- `>= 1e9` → `B` suffix (e.g. `5.00B`).
- Negative billions keep the sign (`-5.00B`) — confirms `Math.abs` is used only
  for the threshold, not the rendered value.
- `>= 1e6` → `M` suffix (e.g. `2.50M`).
- `>= 1e3` → grouped thousands (e.g. `1,500`).
- `0 < |num| < 0.01` → exponential (e.g. `5.00e-3`).
- Exactly `0` does **not** trigger exponential (`num !== 0` guard) → `0`.
- Regular magnitude uses up to 4 fraction digits (e.g. `909.09`).

### Nesting & depth
- A top-level step (depth 0, open by default via `useState(depth === 0)`)
  renders its child step name — also proves Radix `Collapsible` mounts open
  content synchronously in jsdom.
- `step.description` renders inside the expanded content.
- An empty `children: []` array is treated as a leaf (`hasChildren` false) —
  no expandable content block, index shown instead.
- `maxDepth={0}` clips a depth-1 child even though the parent's content is open,
  verifying the `if (depth > maxDepth) return null` guard. The positive nesting
  test above rules out a false-green here.

### Leaf index display
- A childless step shows its 1-based index (`index + 1` → `1`) instead of a
  chevron icon.

### className passthrough
- The `className` prop is applied to the root container via `cn(...)`.

## Why no click/toggle interaction test

The expand/collapse toggle is Radix `Collapsible` behaviour (triggered via
pointer events), not component logic. Depth-0 steps are open by default, so the
open-content rendering path is already covered without the DropdownMenu-style
pointer-stub ceremony (see memory `radix-dropdown-test-idiom`). All of the
component's own logic — depth guard, formatting, conditional rendering — is
covered by deterministic render assertions.

## Verification

```
corepack pnpm exec vitest run tests/components/valuation/valuation-formula-display.test.tsx
  Test Files  1 passed (1)
       Tests  30 passed (30)
corepack pnpm exec eslint --max-warnings=0 <file>   # exit 0
corepack pnpm exec tsc --noEmit                      # exit 0
```
