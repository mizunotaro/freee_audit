# Gap: unit tests for `src/components/conversion/ai-advisor-panel.tsx`

**Risk class:** C · **Detected:** 2026-07-09 · **Resolved:** 2026-07-11

## Change

Added `tests/components/conversion/ai-advisor-panel.test.tsx` (36 tests). The target
module previously had no `tests/` entry. The only public export is `AIAdvisorPanel`; the
internal `MappingSuggestionCard` / `AdjustmentCard` / `RiskCard` helpers are exercised
through the panel (they are not exported, so they are covered via the props that render them).

## Environment notes

- `AIAdvisorPanel` renders a Radix `ScrollArea` while not loading. Radix instantiates a
  `ResizeObserver` in a layout effect, which jsdom does not provide, so the test file adds a
  no-op `ResizeObserver` shim in `beforeAll` (mirroring the `IntersectionObserver` shim in
  `tests/setup.ts`).
- Collapsible open/close is asserted via the Radix `CollapsibleTrigger` `aria-expanded`
  attribute rather than content visibility, to avoid Radix `Presence` exit-animation timing
  flakiness in jsdom while still exercising `toggleSection`'s Set add/delete branches.

## Coverage rationale & assertions

### Loading state
- 3 `Skeleton` blocks (`.animate-pulse`) render and section headers are absent while `isLoading`.
- `isLoading` wins over populated lists (data + loading → skeletons, suggestion content not rendered).

### Empty state & fail-safe behavior
- Empty inputs → the two `推奨はありません` copies and `リスクは検出されませんでした`, with each section header count badge reading `0`.
- **Fail-safe:** clicking 採用/却下 with no `onAcceptMappingSuggestion`/`onRejectMappingSuggestion` does not throw (optional-callback guards `?.`).
- **Fail-safe:** clicking 調整を追加 with no `onAcceptAdjustment` does not throw.

### MappingSuggestionCard
- Renders source code/name, suggested target code/name, and reasoning.
- **Confidence badge variant boundaries** (parametrized, exercises `Math.round(confidence*100)` and the `>=90 ? default : >=70 ? secondary : outline` branch): 1.0/0.9 → `bg-primary`; 0.89/0.7 → `bg-secondary`; 0.69/0 → `text-foreground`. Percent text also asserted.
- Alternatives present → `代替案:` label with each alternative code + percent.
- Alternatives empty → `代替案:` omitted.
- `onAcceptMappingSuggestion` fired once with the exact suggestion object on 採用.
- `onRejectMappingSuggestion` fired once with the exact suggestion object on 却下.
- Multiple suggestions → one card each, two 採用 buttons, each card scoped to its own data.

### AdjustmentCard
- Priority labels (parametrized): high→高優先度, medium→中優先度, low→低優先度.
- Renders title, description, reasoning.
- Estimated impact sign/format: `assetChange: 500` → `+500`, `netIncomeChange: -250` → `-250` (values kept < 1000 so `toLocaleString()` output is locale-independent).
- Zero impact → `+0` (exercises the `>= 0 ? '+'` branch at the boundary).
- `estimatedImpact` runtime-absent (cast, since the type marks it required) → impact grid omitted.
- `estimatedImpact` with only `liabilityChange`/`equityChange` → asset/netIncome rows omitted.
- References present → joined by `, ` after `参照:`.
- References empty → references line omitted.
- `onAcceptAdjustment` fired once with the exact adjustment object on 調整を追加.

### RiskCard
- Risk-level labels (parametrized): low→低リスク, medium→中リスク, high→高リスク.
- Renders category, description, mitigation suggestion.
- Multiple risks → one card each.

### Collapsible sections
- All three sections expanded by default (`aria-expanded="true"`).
- Toggling one section collapses then re-expands it (`aria-expanded` `true → false → true`) while leaving sibling sections expanded — exercises `toggleSection` Set delete + add.
- Each section header count badge reflects the supplied list length (2/1/3).

## Verification

- `corepack pnpm exec vitest run tests/components/conversion/ai-advisor-panel.test.tsx` → 36/36 passed.
- `corepack pnpm exec eslint <file> --max-warnings=0` → 0 errors/warnings.
- `corepack pnpm exec tsc --noEmit` → no errors in the new file.
  (Pre-existing errors in `tests/unit/services/budget/managerial-accounting.test.ts` are
  unrelated to this change and present on master HEAD.)
