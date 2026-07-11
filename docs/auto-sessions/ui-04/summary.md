# UI-04 — Loading / error / empty states + a11y for valuation / currency

**Scope:** `src/components/{valuation,currency}/**` (presentational UI only).
`src/services/valuation/**` (Class-A) was NOT touched — read-only reference only.
**Date:** 2026-07-09
**Outcome:** Additive-only. Added explicit loading (skeleton) / error / empty states
and ARIA + keyboard a11y across the valuation component group and the dual-currency
display. No visual change to existing render paths, no change to existing interactive
behavior, no Class-A path touched. 39 new tests added; `node scripts/autopm_verify.mjs
--changed-only` exits 0.

## Approach

Mirrors the primitives established by UI-01 (`charts/resolve-chart-status` + `chart-state`)
and the a11y idioms from UI-02/UI-03 (progressbar roles, loading `role="status"` +
`aria-busy`, error `role="alert"`, icon-only controls → `<button>` + `aria-label`,
`aria-label` on icon-only controls). A new sibling resolver,
`resolve-display-state`, gives the valuation stateful components a single testable
precedence unit identical in shape to `resolve-chart-status` / `resolve-list-status`.

## What changed

### New shared helper (valuation)
- **`src/components/valuation/resolve-display-state.ts`** — pure helper encoding the
  state precedence `loading > error > empty > ready`. Returns
  `Result<DisplayState, AppError>`, validates input with Zod `safeParse` (project
  Result + Zod conventions). Exact analogue of `resolve-chart-status` /
  `resolve-list-status`, using a boolean `hasData` (the valuation components expose
  one-of-several optional results, not a list length).

### valuation-charts.tsx
- Gained optional `isLoading?: boolean` and `error?: string | null` props (defaults
  preserve current behavior) and resolves state via `resolveDisplayState`.
- **loading:** Card with a `Skeleton` block, `role="status"` + `aria-busy="true"` +
  `aria-label="Loading charts"`.
- **error:** `AlertCircle` + `text-destructive` message in a `role="alert"` block
  (with the standard defensive `error || 'Failed to load charts'` fallback, matching
  `chart-state`/`list-state`).
- **empty:** the existing "Run calculations to see charts" copy is preserved verbatim;
  its container gained `role="status"`.

### valuation-ai-advisor.tsx
- Gained optional `error?: string | null` prop and resolves state via
  `resolveDisplayState`.
- **loading:** the existing skeleton Card gained `role="status"` + `aria-busy="true"` +
  `aria-label="Loading AI advisor"`.
- **error:** new Card with `AlertCircle` + `text-destructive` (`role="alert"`); when
  `onRefresh` is provided it renders a keyboard-accessible "Retry" button.
- **empty:** the existing empty copy is preserved verbatim; its container gained
  `role="status"`.
- **QASection quality-score bar:** the track `div` is now `role="progressbar"` with
  `aria-valuenow={score}` / `aria-valuemin={0}` / `aria-valuemax={100}` and a
  descriptive `aria-label="Quality score N of 100"` (same idiom as the
  `confidence-indicator`/`progress-indicator` fixes in UI-03).

### valuation-formula-display.tsx
- When `steps.length === 0`, renders a `role="status"` "No calculation steps available"
  message instead of an empty body (the header "N steps" badge is unchanged). The
  shadcn `Collapsible` trigger was already an accessible `<button>` — no change there.

### wacc-input-panel.tsx
- The `isLoadingAdvice` skeleton gained `role="status"` + `aria-busy="true"` +
  `aria-label="Loading AI recommendations"`.
- The industry `<select>` (previously unlabeled) gained `aria-label="Industry"` so it
  has an accessible name (no visual change).
- The per-field `Info` tooltip trigger was a mouse/hover-only `<Info>` SVG (not
  keyboard-focusable). It is now a `<button type="button">` wrapping `aria-hidden`
  icon with `aria-label="Information: <field>"` — focusable, keyboard-operable
  (Radix Tooltip opens on focus), and visually equivalent (inline-flex, no
  padding/border). Mirrors UI-02's `ImportCard` "mouse-only div → button" idiom.

### currency/dual-currency-display.tsx
- In dual mode the secondary (converted) `<span>` now carries an `aria-label` of
  `"<Converted|換算>: <converted amount> @ <rate>"` so screen readers announce the
  value as a converted equivalent with its rate, rather than two bare numbers. The
  prefix respects the `locale` prop (`'Converted'` / `'換算'`). Visible text is
  unchanged.

## Notes / scope decisions
- The valuation **page** (`src/app/[locale]/(authenticated)/valuation/page.tsx`) was
  intentionally left untouched: it already surfaces a top-level destructive `Alert`
  for errors and never passes `isLoading`/`error` to these components. The new props
  are additive and default-preserving (the page's current behavior is identical);
  wiring them is a separate, page-level concern (and would duplicate the existing
  top-level error Alert). This matches UI-03's component-only approach.
- `ValuationAIAdvisor`'s `AdviceSection` (WACC recommendations) was left unchanged —
  no a11y/state gap to close there beyond the QASection progressbar already addressed.
- The defensive `error || '<default>'` fallback in the two error branches is
  unreachable through normal props (`status === 'error'` already requires a non-empty
  `error`), but is kept for consistency with the `chart-state`/`list-state` siblings.

## Tests (39 new)
- `tests/components/valuation/resolve-display-state.test.ts` (8) — precedence
  (`loading > error > empty > ready`), null/empty-error handling, Zod-failure,
  schema defaults.
- `tests/components/valuation/valuation-charts.test.tsx` (5) — accessible loading
  skeleton, loading-over-error precedence, error alert, accessible empty state, and
  ready card (no status/alert) when data is present.
- `tests/components/valuation/valuation-ai-advisor.test.tsx` (6) — accessible
  loading, loading-over-error precedence, error alert, keyboard-operable Retry
  button, accessible empty state, and the quality-score progressbar aria values.
- `tests/components/valuation/valuation-formula-display.test.tsx` (2) — accessible
  empty state (`0 steps`) and a rendered step.
- `tests/components/valuation/wacc-input-panel.test.tsx` (3) — accessible advice
  skeleton, industry select accessible name, and the 6 info tooltip buttons
  (`<button>` + `aria-label`).
- Extended `tests/components/currency/dual-currency-display.test.tsx` (+2) — the
  converted-amount `aria-label` (en + ja). The 13 pre-existing cases still pass.

## Verification
`node scripts/autopm_verify.mjs --changed-only` → exit 0:
- typecheck: 0 errors (whole repo, 0 relevant to the diff)
- eslint: 0 warnings across all changed files
- vitest: 6 resolved files / 39 tests pass
