# Summary — unit tests for `src/components/conversion/confidence-indicator.tsx`

**Task:** gap-untested-module-41de1029d1
**Target:** `src/components/conversion/confidence-indicator.tsx` (Risk class C)
**New test file:** `tests/components/conversion/confidence-indicator.test.tsx`
**Result:** 24 tests, all passing · `tsc --noEmit` clean · ESLint `--max-warnings=0` clean

---

## What the component does (surface covered)

`ConfidenceIndicator` is a pure presentational React component (`'use client'`) with no
external collaborators — it imports only the local `cn` class-merge util. Public surface:

| Prop | Type | Default | Behavior |
|------|------|---------|----------|
| `confidence` | `number` (required) | — | `percentage = Math.round(confidence * 100)` |
| `showLabel` | `boolean` | `true` | toggles the visible `${percentage}% (${label})` span |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | track height/width classes |
| `className` | `string` | — | merged onto the root div |

Internal (unexported) logic driven through rendered output:
- `getColor()`: `>=0.9`→`bg-green-500`, `>=0.7`→`bg-yellow-500`, `>=0.5`→`bg-orange-500`, else→`bg-red-500`
- `getLabel()`: `>=0.9`→`高`, `>=0.7`→`中`, `>=0.5`→`低`, else→`要確認`
- `sizeClasses`: `sm`→`h-1.5 w-16`, `md`→`h-2 w-24`, `lg`→`h-3 w-32`
- Accessibility: `role="progressbar"`, `aria-valuenow/min/max`, `aria-label="信頼度 N% (label)"`

## Coverage rationale

| Requirement | How covered |
|-------------|-------------|
| Every public entry point | The single export `ConfidenceIndicator` is exercised across every prop combination. Internal helpers (`getColor`/`getLabel`/`sizeClasses`) are not exported, so they are covered via their observable rendered output (fill className, label text, aria-label, track classes). |
| Happy-path | Default render, default `showLabel`/`size`, a mid-range value (`0.85`), `aria-*` round-trip. |
| Edge cases (min/max/boundary) | All four threshold boundaries asserted exactly (`0.9`, `0.7`, `0.5`, plus `0` and `1`); one step below each boundary (`0.89`, `0.69`, `0.49`); all three `size` variants + default; `showLabel` true/false. |
| Error / dependency failures | **N/A — intentionally none.** The component has no async, network, clock, random, or external-collaborator surface (the only import, `cn`, is a pure local util), so there is no dependency to fail and nothing to mock. Asserting a fabricated failure would be testing non-existent behavior. |
| Fail-safe degradation | Out-of-range `confidence` (`-0.2`, `1.5`): asserts `render(...)` does not throw, the bar still renders with a sensible color bucket (red/`要確認` for negative, green for >1), and `aria-*` still reflects the computed percentage. |

## Every assertion added (24 tests)

### percentage computation (4)
1. `0.927` → `aria-valuenow="93"` and fill `style.width === '93%'` (proves `Math.round`, not floor)
2. `0.923` → `aria-valuenow="92"` (rounds down)
3. `confidence=0` → `aria-valuenow="0"`, fill `width '0%'`
4. `confidence=1` → `aria-valuenow="100"`, fill `width '100%'`

### color & label buckets at each threshold boundary (9 — `it.each` over 8 cases + 1)
5–12. For each of `{0.9, 1.0, 0.89, 0.7, 0.69, 0.5, 0.49, 0}`: fill className contains expected
`bg-{green,yellow,orange,red}-500`; `aria-valuenow` = expected integer;
`aria-label` = `信頼度 N% (label)` with expected label (`高`/`中`/`低`/`要確認`).
13. The bucket color lives only on the fill (`bg-green-500`), never on the track; the track keeps `bg-gray-200`.

### visible label (2)
14. Default render shows the span text `'85% (中)'`.
15. `showLabel={false}` removes the span (`queryByText` → null) but keeps `aria-label='信頼度 85% (中)'` (value still accessible to AT).

### size variants (4 — `it.each` over 3 + default)
16. `size="sm"` → track has `h-1.5` and `w-16`.
17. `size="md"` → track has `h-2` and `w-24`.
18. `size="lg"` → track has `h-3` and `w-32`.
19. size omitted → defaults to `md` (`h-2`, `w-24`).

### accessibility & structure (3)
20. `role="progressbar"` with `aria-valuenow="75"`, `aria-valuemin="0"`, `aria-valuemax="100"`, and `rounded-full` track.
21. Fill `style.width === '60%'`, `style.height === '100%'`, plus `rounded-full` and `transition-all`.
22. Custom `className` merges onto the root alongside base classes (`flex`, `items-center`).

### fail-safe on out-of-range input (2)
23. `confidence=-0.2` → `render` does not throw; fill is `bg-red-500`; `aria-label='信頼度 -20% (要確認)'`.
24. `confidence=1.5` → `render` does not throw; fill is `bg-green-500`; `aria-valuenow='150'`.

## Notes / decisions

- **No mocking needed.** The component is synchronous and dependency-free; per the project's
  component-test conventions (`tests/components/conversion/list-state.test.tsx`,
  `mapping-list.test.tsx`) only `@testing-library/react`'s `render`/`screen` and the jest-dom
  matchers are used. No `ResizeObserver`, no async-rejection swallowing, no `File`/`FormData`
  workarounds were triggered (those gotchas apply to chart/async/file-upload components, not this one).
- **Threshold boundaries are asserted exactly** (`0.9`, `0.7`, `0.5`) because the spec uses `>=`,
  so the boundary value must land in the upper bucket — this is the highest-value regression guard.
- **Floating-point safety:** all expected percentages use values whose `confidence*100` is
  unambiguous under `Math.round` regardless of IEEE-754 noise (e.g. `0.927`→`92.7`→`93`,
  `0.923`→`92.3`→`92`). The known trap value `0.855` (which FP-misrepresents to `85.4999…`→`85`)
  was deliberately avoided.
- **Out-of-range behavior is documented, not "fixed."** Negative/`>1` inputs are outside the
  component's intended `[0,1]` domain; the tests assert the actual (non-crashing) behavior rather
  than an idealized clamp, so a future intentional guard would surface as a clear test update.
