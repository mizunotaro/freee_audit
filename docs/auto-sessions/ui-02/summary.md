# UI-02 — Accessibility pass on interactive components (budget/settings/export/import)

**Scope:** `src/components/{export,settings,import}/**` (presentational + interactive elements)
**Date:** 2026-07-08
**Outcome:** Additive-only accessibility hardening. Added missing ARIA roles/names, keyboard
activation, and `<label htmlFor>` associations across 8 components. No visual change, no change
to existing interactive behavior. 21 new role/name-based tests added; all existing tests preserved.
`node scripts/autopm_verify.mjs --changed-only` exits 0 (typecheck 0 errors, eslint 0 warnings,
75 vitest tests pass).

`src/components/budget/**` (`BudgetForm`, `CSVUpload`) was reviewed and **left unchanged**: both
are built on shadcn primitives (`Dialog`, `Form`/`FormLabel`, `Select`) that already provide dialog
semantics and correct label/control associations, and `CSVUpload` already pairs its file input
(`id="csv-upload"`) with a `<label htmlFor>`. Touching them would add risk without benefit.

## What changed

### `src/components/export/export-modal.tsx`
- Modal panel now carries `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing at the
  title `<h2 id="export-modal-title">`. Previously the custom overlay had no dialog semantics at all.
- Added an `Escape`-to-close `keydown` listener (window-scoped, gated on `isOpen`) — keyboard users
  could previously only close via the mouse-only backdrop click or the buttons.
- Icon-only close (✕) button now has `aria-label="閉じる"` and its SVG is `aria-hidden`.
- Format selector (PDF/PowerPoint/Excel/CSV) buttons now carry `aria-pressed`; the group wrapper is
  `role="group" aria-labelledby` and the former (un-associable) `<label>出力形式</label>` became a
  labelled `<span>` — a `<label>` may only wrap a single labelable control.
- Associated every loose `<label>` with its control via `htmlFor` + `id`: 言語, 通貨, 用紙サイズ,
  向き, 為替レート. (`グラフを含める` was already associated — left as-is.)

### `src/components/export/export-progress.tsx`
- Progress track `div` is now `role="progressbar"` with `aria-valuenow/min/max` and
  `aria-label="エクスポート進捗"` (was a decorative div with no programmatic value).
- `ExportProgressOverlay` panel is now `role="dialog" aria-modal="true" aria-labelledby` with the
  heading carrying the referenced `id`.

### `src/components/export/export-button.tsx`
- Decorative spinner / download SVGs marked `aria-hidden="true"` (the button's text label is the
  accessible name; icons should not be announced).

### `src/components/settings/AiSettings.tsx`
- API-key (`id="ai-api-key"`) and model (`id="ai-model"`) `<label>`s now associated via `htmlFor`.
- Provider select buttons now `type="button"` + `aria-pressed` (active provider = pressed).
- Show/hide API-key toggle now has a descriptive `aria-label`, `aria-pressed`, and `aria-controls`
  pointing at the input.
- Error message region is `role="alert"`; success region is `role="status"`. Both dismiss (✕)
  buttons are `type="button"` with `aria-label`. Save button is `type="button"`.

### `src/components/settings/FreeeSettings.tsx`
- Error region `role="alert"`; success region `role="status"`; dismiss (✕) buttons `type="button"`
  + `aria-label`. All action buttons (接続テスト / 連携解除 / freeeと連携する) are now `type="button"`.

### `src/components/import/ImportCard.tsx`
- The dropzone `<div>` was mouse-only (clickable via `onClick`). It is now `role="button"`,
  `tabIndex={0}`, with an `onKeyDown` handler (Enter / Space → open picker, `preventDefault` on
  Space to stop page scroll) and a descriptive `aria-label`. This is the principal keyboard-a11y fix
  of the task.
- To keep keyboard **and** mouse activation from double-opening the picker, the hidden file input
  gained `onClick={(e) => e.stopPropagation()}`: the programmatic `input.click()` it triggers would
  otherwise bubble back up to the dropzone `onClick` and fire a second time. This dedups a latent
  double-trigger that already affected the mouse path; the net user-visible effect is "one dialog
  opens" either way (browsers suppress the second), so there is no behavioral regression.
- Icon-only error-dismiss and clear buttons now have `aria-label`.

### `src/components/import/ImportResult.tsx`
- The custom success/skip/fail bar's track `div` is now `role="progressbar"` with
  `aria-valuenow={validRows}` / `aria-valuemin={0}` / `aria-valuemax={totalRows}` and an
  `aria-label`. Segment `title` tooltips preserved verbatim.

### `src/components/import/JournalImport.tsx`
- Error region `role="alert"`; result region `role="status"`; dismiss (✕) button `type="button"` +
  `aria-label`. All action buttons (インポート実行 / クリア / テンプレートダウンロード / 閉じる) are now
  `type="button"`. The two option checkboxes already use an implicit wrapping-`<label>` association
  (valid) and were left unchanged.

## Tests added (21)

Each new test uses Testing Library **role/name queries** to assert the a11y contract rather than
implementation detail:

| File | New tests |
|------|-----------|
| `export-modal.test.tsx` | dialog role + labelledby; Escape closes; ✕ close label; format `aria-pressed`; label/select associations; exchange-rate label visibility |
| `export-progress.test.tsx` | progressbar role + aria values; overlay dialog role + labelledby |
| `ai-settings.test.tsx` | API-key/model label assoc; provider `aria-pressed`; show/hide toggle label + `aria-controls`/`aria-pressed`; error `role=alert` |
| `freee-settings.test.tsx` | disconnect success `role=status`; disconnect failure `role=alert` + dismiss label |
| `ImportCard.test.tsx` | dropzone focusable + named; Enter **and** Space open picker (spy on `input.click`); clear-button label; error-dismiss label |
| `ImportResult.test.tsx` | processing bar `role=progressbar` + aria values; segment tooltips preserved |
| `JournalImport.test.tsx` | validation error `role=alert` + dismiss label; completed import `role=status` |

## Constraints honored

- No Class-A path touched (schema/auth/crypto/security/audit/conversion/valuation/tax/kpi/debt/
  deferred-accrual/journal-proposal/freee and their API routes) — read-only reference only.
- No `any` / `@ts-ignore` / `@ts-expect-error` / `.skip` / lint-disable / coverage lowering.
- Additive, minimal diffs; new behavior is keyboard a11y that mirrors existing mouse actions.
- Only the touched test files were executed (never the full suite — known OOM).
- No new dependencies.

## Definition of done

`node scripts/autopm_verify.mjs --changed-only` → **exit 0** (typecheck 0 errors, eslint 0 warnings,
75/75 vitest tests pass across the 7 changed test files).
