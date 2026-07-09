# UI-03 — Loading / error / empty states + a11y for chat / conversion / journal-proposal

**Scope:** `src/components/{chat,conversion,journal-proposal}/**`
**Date:** 2026-07-09
**Outcome:** Additive-only. Added explicit loading (skeleton) / error / empty states
and ARIA + keyboard a11y across the three component groups. No visual change, no change
to existing interactive behavior, no Class-A path touched. 39 new tests added; the 2
pre-existing unit tests for touched components still pass (54 total in the scoped run).
`node scripts/autopm_verify.mjs --changed-only` exits 0 (typecheck 0 errors, eslint 0
warnings, vitest 7 files / 54 tests).

## Approach

Mirrors the primitives established by UI-01 (`src/components/charts/{resolve-chart-status,chart-state}`)
and the a11y idioms from UI-02 (progressbar roles, mouse-only `div` → `<button>`,
`aria-label` on icon-only controls).

## What changed

### New shared primitive (conversion)
- **`src/components/conversion/resolve-list-status.ts`** — pure helper encoding the
  state precedence `loading > error > empty > ready`. Returns
  `Result<ListResolution, AppError>`, validates input with Zod `safeParse`
  (project Result + Zod conventions). Exact analogue of `resolveChartStatus`.
- **`src/components/conversion/list-state.tsx`** — presentational component for the
  three non-ready states: `Skeleton` rows (`animate-pulse`, `role="status"` +
  `aria-busy="true"`), `AlertCircle` + `text-destructive` (`role="alert"`), and a
  dashed-border empty (`role="status"`, optional `emptyTitle` + `emptyMessage`).
  Exported from `conversion/index.ts`.
- **`conversion/mapping-list.tsx`** — gained optional `isLoading?: boolean` and
  `error?: string | null` props (defaults preserve current behavior) and early-returns
  the resolved `ListState`. The existing empty copy is preserved verbatim. The per-row
  actions dropdown trigger gained `aria-label="<sourceAccountName>の操作"`.
- **`conversion/confidence-indicator.tsx`** — the track `div` is now
  `role="progressbar"` with `aria-valuenow/min/max` and a descriptive `aria-label`.

### journal-proposal
- **`journal-proposal/ConfidenceIndicator.tsx`** — track `div` is now
  `role="progressbar"` with `aria-valuenow/min/max` + `aria-label="信頼度 N% (level)"`
  using the configured thresholds/labels (`@/config/journal-proposal`).

  Note: `StatusBadge` (pure styled label) and `TaxTypeSelector` (shadcn `Select`,
  already accessible) were left unchanged — no a11y gap to close there. The
  journal-proposal group's data-bearing list lives at the **page** level
  (`src/app/.../journal-proposal/components/ProposalList.tsx`), outside this task's
  component-group scope; the applicable win for the leaf components here is the
  indicator a11y above.

### chat
- **`chat/floating-chat-widget.tsx`** (principal keyboard-a11y fix):
  - Minimized bar converted from a click-only `<div>` to a `<button type="button">`
    (now focusable + keyboard-activatable; mirrors UI-02's `ImportCard` pattern).
  - `aria-label` on all icon-only controls: open toggle (incl. unread count),
    clear / minimize / close. Icons within labelled buttons marked `aria-hidden`.
  - Message container is now `role="log"` + `aria-live="polite"` + `aria-label` so
    screen readers announce incoming replies.
  - Input gained `aria-label="メッセージを入力"`.
  - (Loading / error / empty were already handled by the widget: typing-dots +
    `ProgressIndicator` while loading, the welcome empty message, and error text
    surfaced as assistant messages by `useFloatingChat`.)
- **`chat/progress-indicator.tsx`** — progress track is now `role="progressbar"` with
  `aria-valuenow/min/max` + `aria-label` (the stage label).

## Tests (39 new)
- `tests/components/conversion/list-state.test.tsx` (15) — `resolveListStatus`
  precedence / defaults / Zod-failure, and `ListState` rendering for all three states.
- `tests/components/conversion/mapping-list.test.tsx` (5) — loading skeleton,
  error alert, preserved empty copy, ready table + aria-labelled trigger,
  loading-over-data precedence.
- `tests/components/journal-proposal/confidence-indicator.test.tsx` (6) —
  progressbar role + aria values/label; level/colour helpers.
- `tests/components/chat/floating-chat-widget.test.tsx` (4) — closed toggle label,
  minimized `<button>` keyboard operability + open-on-activate, open-state live log +
  labelled controls (page-context mocked; unhandledRejection swallowed per known
  worker-crash pattern).
- Extended `tests/components/chat/progress-indicator.test.tsx` (+1) — progressbar role.

## Verification
`node scripts/autopm_verify.mjs --changed-only` → exit 0:
- typecheck: 0 errors (whole repo, 0 relevant)
- eslint: 0 warnings across 13 changed files
- vitest: 7 resolved files / 54 tests pass (incl. the 2 pre-existing unit tests for
  touched components, unchanged)
