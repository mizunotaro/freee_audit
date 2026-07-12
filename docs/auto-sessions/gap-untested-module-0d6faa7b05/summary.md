# gap-untested-module-0d6faa7b05 — Unit tests for `src/components/reports/ir/ir-preview.tsx`

**Target file:** `src/components/reports/ir/ir-preview.tsx`
**Test file:** `tests/components/reports/ir/ir-preview.test.tsx` (new)
**Risk class:** C (React component, no DB/network surface)
**Result:** 31 tests, all passing. `tsc --noEmit` 0 errors, `eslint --max-warnings=0` clean.

## What the component does

`IRPreview` is a presentational client component that renders an IR (investor
relations) report for preview/print/export. Its behavior surface:

| Entry point | Logic |
|-------------|-------|
| `handlePrint` | Calls `onPrint` if provided, else falls back to `window.print()` |
| `handleExport` | Calls `onExport` if provided, else no-op (fail-safe) |
| `renderMarkdown` (internal) | Line-by-line markdown→JSX: `## `, `### `, `- `, `\d+. `, blank line, `**bold**`, plain text |
| `getLocalizedTitle` (internal) | `ja`→ja title, `en`→en title, else `${ja} / ${en}` |
| sections | Sorted ascending by `order`; a section whose content for the active language is falsy is skipped |
| financial highlights | Rendered only when `financialHighlights.length > 0`; numbers via `.toLocaleString()` |
| footer | `publishedAt` formatted via `.toLocaleDateString()`, or `-` when missing; plus `Version N` |

## Mocking strategy

- `window.print` — `vi.spyOn` so the fallback path is observable and jsdom's
  "Not implemented" warning is suppressed.
- `Date.prototype.toLocaleDateString` — mocked to a fixed string so the
  `ja-JP`/`en-US` formatting branch is asserted deterministically regardless of
  host ICU/locale.
- `Number.prototype.toLocaleString` — mocked to return `FMT:<value>`. This proves
  the component actually invokes `.toLocaleString()` **and** binds the correct
  field (revenue / operatingProfit / netIncome) to each cell — a raw number would
  render identically, so the `FMT:` prefix is what makes the call observable.

No external collaborators are instantiated; all data comes from inline factories.

## Assertions added (31)

### Toolbar actions (5)
1. Preview header text `プレビュー` and both `印刷` / `PDF出力` buttons render.
2. Click `印刷` with no `onPrint` → `window.print()` called once.
3. Click `印刷` with `onPrint` → `onPrint` called once, `window.print()` **not** called.
4. Click `PDF出力` with `onExport` → `onExport` called once.
5. Click `PDF出力` with no `onExport` → no throw, no-op (fail-safe).

### Localized title — `getLocalizedTitle` (3)
6. `ja` → Japanese report title in `<h1>`.
7. `en` → English report title in `<h1>`.
8. `bilingual` → combined `ja / en` title in `<h1>`.

### Fiscal-year suffix (3)
9. `ja` → `年度` suffix present.
10. `en` → `Fiscal Year` suffix present.
11. `bilingual` → `年度 / Fiscal Year` suffix present.

### Sections (6)
12. Sections rendered sorted ascending by `order` (verified via `compareDocumentPosition`).
13. `en` section title localized.
14. `bilingual` section title is `ja / en`.
15. Section whose active-language content is empty string is skipped entirely (title absent).
16. `bilingual` falls back to Japanese content for the body.
17. Empty `sections[]` → no section card rendered.

### Markdown — `renderMarkdown` (6)
18. `## ` → level-2 heading.
19. `### ` → level-3 heading.
20. `- ` and `\d+. ` → `<li>` (2 list items).
21. Blank line → `<br>`.
22. `**bold**` → markers stripped, rendered as paragraph (raw `**bold**` absent).
23. Plain line → paragraph.

### Financial highlights table (4)
24. Empty `financialHighlights` → no card, no `<table>`.
25. `ja`: card title, JP row/column labels, both fiscal-year headers, and `FMT:`-prefixed values for revenue/operatingProfit/netIncome across two years.
26. `en`: English card title + labels (`Item`/`Revenue`/`Operating Profit`/`Net Income`).
27. Single highlight → exactly one fiscal-year header column (iteration edge).

### Footer metadata (4)
28. `ja` → `公開日: <date>` + `Version 3`.
29. `en` → `Published: <date>`.
30. Missing `publishedAt`, `ja` → `公開日: -` + `Version 1`.
31. Missing `publishedAt`, `en` → `Published: -`.

## Coverage rationale

- **Happy path:** every public prop combination and language is exercised.
- **Edge cases:** empty `sections`, empty `financialHighlights`, single highlight,
  missing `publishedAt`, blank markdown line, empty-content section skip.
- **Error/fail-safe paths:** `handlePrint`/`handleExport` degrade gracefully when
  their optional callbacks are absent (no-op, no throw); empty section content is
  silently dropped rather than rendering an empty card.
- **Determinism:** no real clock (date/number formatting mocked), no network, no
  random — fully reproducible.

## Quality gate

```
corepack pnpm exec vitest run tests/components/reports/ir/ir-preview.test.tsx  → 31 passed
corepack pnpm exec tsc --noEmit                                                → exit 0
corepack pnpm exec eslint --max-warnings=0 tests/components/reports/ir/ir-preview.test.tsx  → exit 0
```
