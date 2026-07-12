# A11Y-01 — Accessibility + states audit: dashboard / analysis / settings

**Status:** complete · **Verify gate:** `node scripts/autopm_verify.mjs --changed-only` → exit 0
(typecheck 0 errors · eslint 0 warnings on 21 changed files · 85 tests pass)

## Scope

UI layer only. No Class-A path touched. The three component groups:

- **analysis** — `src/app/[locale]/(authenticated)/analysis/components/*` (the canonical i18n
  route; the legacy `src/app/(dashboard)/analysis/components/*` is a byte-identical duplicate and
  was intentionally left untouched so the existing `tests/components/analysis/analysis-page.test.tsx`
  still passes).
- **dashboard** — `src/app/[locale]/(authenticated)/dashboard/page.tsx`.
- **settings** — `src/components/settings/{AiSettings,FreeeSettings}.tsx`.

## Findings & fixes

Every loading skeleton announced nothing to screen readers (pure `animate-pulse` with no role);
the gauge and chart bars conveyed their value only visually; the custom dropdowns/disclosures lacked
ARIA wiring and keyboard dismissal; trend direction was colour/glyph-only; and the dashboard page
**swallowed fetch errors silently** (falling back to sample data with zero feedback).

| Component | Loading | Error | Empty | aria roles/labels | Keyboard |
|---|---|---|---|---|---|
| score-gauge | `role=status`+`aria-busy`+label | — | — | gauge `role=img`+`aria-label` (score/status); SVG `aria-hidden` | — |
| alerts-list | `role=status`+`aria-busy` | — | `role=status` msg | filter `<select>` `aria-label`; disclosure `aria-expanded`+`aria-controls`+panel `id`; emoji/chevrons `aria-hidden` | native button |
| period-selector | — | — | — | trigger `aria-haspopup`+`aria-expanded`+`aria-controls`+`aria-label`; popup `role=group`+label+`id`; group `<label>`→`<span>` (no orphan control) | **Escape-to-close** added |
| export-button | trigger `aria-busy` while exporting | — | — | same dropdown semantics as period-selector | **Escape + click-outside** added |
| recommendations-panel | `role=status`+`aria-busy` | — | `role=status` msg | toggle `role=checkbox`+`aria-checked`+`aria-label`; check icon `aria-hidden` | native button |
| ai-insights | `role=status`+`aria-busy` | — | `role=status` msg (new) | emoji `aria-hidden`; **sr-only trend direction** (改善/悪化/安定) | — |
| ratio-cards | `role=status`+`aria-busy` | — | `role=status` msg (new) | emoji `aria-hidden`; sr-only trend direction | — |
| financial-overview | `role=status`+`aria-busy` | — | `role=status` msg (new) | sr-only trend direction | — |
| trend-charts | `role=status`+`aria-busy` | — | `role=status` msg (new) | each bar `role=img`+`aria-label` (名前 点数); legend swatch `aria-hidden` | — |
| dashboard/page | KPI grid `aria-busy` | **`role=alert`+retry (new)** — was silently swallowed | — | — | retry button |
| AiSettings | `role=status`+`aria-busy`+label | (already `role=alert`) | — | (already labelled) | — |
| FreeeSettings | `role=status`+`aria-busy`+label | (already `role=alert`) | — | (already labelled) | — |

`AiSettings`/`FreeeSettings` were already strong on a11y (`role=alert`/`role=status`, `aria-pressed`,
`aria-controls`, labelled selects); only the loading skeleton needed the `aria-busy`+label.

## Tests added/extended (85 passing)

New files:
- `tests/components/analysis/score-gauge.test.tsx`
- `tests/components/analysis/alerts-list.test.tsx`
- `tests/components/analysis/period-selector.test.tsx`
- `tests/components/analysis/export-button.test.tsx`
- `tests/components/analysis/recommendations-panel.test.tsx`
- `tests/components/analysis/loading-and-empty.test.tsx` (ai-insights / ratio-cards / financial-overview / trend-charts)
- `tests/app/[locale]/(authenticated)/dashboard/page.test.tsx` (error state + loading `aria-busy`)

Extended (added `aria-busy`/`role=status` assertions to existing loading tests):
- `tests/components/settings/ai-settings.test.tsx`
- `tests/components/settings/freee-settings.test.tsx`

Each asserts the **state** (loading/empty/error) and the **a11y contract** (role, `aria-busy`,
`aria-expanded`/`aria-controls`, `aria-checked`, `aria-label`, Escape/outside-click dismissal,
onExport wiring).

## Constraints honoured

- Additive, minimal diffs; matched existing idioms (Japanese labels, `cn()`, `memo`).
- No `any` / `@ts-ignore` / `@ts-expect-error` / `.skip` / lint-disable / coverage lowering.
- No Class-A path modified (only UI components + one dashboard page).
- No new dependencies; no new business-logic helpers (changes are presentational ARIA attributes +
  a small keyboard handler + the dashboard error state).
- Only the added/modified tests were executed (known full-suite OOM avoided).

## Notes / non-changes

- The dashboard's decorative milestone status dots were left as-is: they are empty `<div>`s with no
  text/role, so AT already ignores them, and the status is also conveyed by the adjacent text badge.
- `period-selector`/`export-button` remain "disclosure of grouped controls" (`role=group` + `aria-haspopup`)
  rather than full ARIA `menu`/`listbox` — honest about the keyboard behaviour actually implemented
  (Tab between controls, Escape/outside-click to dismiss). Arrow-key navigation within the popup is a
  possible future enhancement.
- `trend-charts` still renders the raw English `analysis.status` string under each bar; localising it
  needs a status→label map and was judged out of scope for this a11y/state pass.
