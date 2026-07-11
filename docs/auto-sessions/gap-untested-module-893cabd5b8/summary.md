# gap-untested-module-893cabd5b8 — Unit tests for `src/components/conversion/cash-flow-table.tsx`

**Risk class:** C · **Target:** `src/components/conversion/cash-flow-table.tsx` (presentational React component)
**New test file:** `tests/components/conversion/cash-flow-table.test.tsx` (mirrors source path under `tests/components/conversion/`)
**Framework:** Vitest 4.x + @testing-library/react + @testing-library/jest-dom (no new deps). Environment: jsdom (project default).

## What the component does

`CashFlowTable({ data, showSource = false, className })` renders a single `<Table>` for a
`ConvertedCashFlow` (type from `@/types/conversion`):

- Three fixed sections — 営業 / 投資 / 財務 活動によるキャッシュフロー — each rendered via the internal
  `renderSection(title, items, total)` helper: a `bg-muted/50` header cell, one row per line item, and a
  `bg-muted/30` `<section> 合計` subtotal cell.
- A final `bg-primary/5` row for 現金及び現金同等物の純増減, via `renderSubtotal(label, amount)`.
- Amounts go through `formatAmount` = `new Intl.NumberFormat('ja-JP').format(amount)`.
- `showSource` toggles a 4th column (ソース / `sourceAccountCode`, falling back to `'-'` when absent) and
  shifts every `colSpan` by +1.
- `className` is merged onto the root wrapper via `cn('rounded-lg border', className)`.

It is a pure, synchronous, client-only component: **no async work, no external collaborators, no
network/clock/random** — so the "error / dependency-failure / timeout" paths called out in the task brief
do not exist for this module. Their intent is covered by fail-safe assertions (missing optional fields,
empty arrays, zero/negative/large values) — see rationale below.

## Coverage rationale

| Requirement (task brief) | How it is met |
|---|---|
| Happy path for every public entry point | The single export `CashFlowTable` is exercised in every test via `render(<CashFlowTable …/>)`. All three internal helpers (`formatAmount`, `renderSection`, `renderSubtotal`) are closures, so they are covered indirectly but exhaustively through rendered DOM. |
| Edge cases: empty inputs | "renders section headers and subtotal rows even when every line-item array is empty" (all three arrays `[]`); "renders multiple line items within a section". |
| Edge cases: boundary / min / max values | zero amounts → `"0"`; negative outflows → `"-…"`; large value `1,234,567,890` keeps full precision; positive mid values → `1,234,567`. |
| Error paths / dependency failures / timeouts | N/A for a pure presentational component (see note above). Instead the equivalent *fail-safe* surface is asserted: `sourceAccountCode === undefined` degrades to `'-'`; empty arrays still render full section/subtotal skeleton without crashing. |
| Fail-safe degradation to a safe state | `'-'` placeholder for missing source; structure preserved with empty arrays; all-optional-props default render does not throw. |
| Deterministic, no real network/clock/random | `Intl.NumberFormat('ja-JP')` is locale-stable under Node; all data is hand-built via `makeItem`/`makeData`; dates are fixed ISO strings. |
| Mock external collaborators; do not instantiate | No collaborators to mock — the component imports only `@/components/ui/table`, `@/lib/utils` (`cn`), and a type. `@testing-library` + `tests/setup.ts` are reused as-is. |

## Every assertion added (by test)

**Structure (default `showSource=false`)**
- `renders a single table` — exactly one `role="table"`.
- `renders the three section headers and the net-change subtotal label` — 営業/投資/財務 活動… and 現金及び現金同等物の純増減 each present.
- `renders the column headers without the source column by default` — コード, 科目名, 金額 present; ソース **absent**.
- `renders each line item code and name` — 営業/投資/財務項目A names + codes 100/200/300 present.
- `renders the Japanese (name) label, not the English (nameEn) label` — `Net Income Before Tax` **absent** (locks the JA display choice).
- `renders a subtotal row labelled "<section> 合計" for each section` — all three 合計 labels present.
- `does not render the source column in line-item rows by default` — an item row has exactly 3 `<td>`.

**Amount formatting (ja-JP)**
- `formats amounts with the ja-JP thousands grouping` — `1,234,567`, `900,000`, `1,200,000` present.
- `formats negative outflow amounts with a leading minus` — `-500,000`, `-300,000` present.
- `renders the passed-through totals verbatim (does not recompute from line items)` — operating subtotal shows `999` (passed total) though the only line item is `100` → proves totals are displayed, not recomputed.
- `formats zero amounts as "0"` — ≥4 `"0"` cells across the three totals + net change.
- `formats a large (max-ish) amount without losing precision` — `1,234,567,890` present.

**`showSource` column**
- `adds the ソース column header when showSource is true` — ソース present.
- `renders the sourceAccountCode in each line-item row when showSource is true` — 4110 / 1700 / 2100 present.
- `line-item rows have 4 cells (code, name, source, amount) when showSource is true` — exactly 4 `<td>`.
- `falls back to "-" for line items whose sourceAccountCode is missing` — `within(itemRow).getByText('-')`.

**colSpan logic**
- `uses colSpan 3 for section headers and 2 for subtotals when showSource is false` — 3 cells `colspan="3"`, 4 cells `colspan="2"` (3 section subtotals + 1 net change).
- `uses colSpan 4 for section headers and 3 for subtotals when showSource is true` — 3 cells `colspan="4"`, 4 cells `colspan="3"`.
- `places the section title in the colSpan header cell` — 投資活動… cell has `colspan="3"`.

**Edge cases**
- `renders section headers and subtotal rows even when every line-item array is empty` — section header + all 合計 labels + 純増減 present; `tbody tr` count === 7 (3 headers + 3 subtotals + 1 net change).
- `renders multiple line items within a section` — 営業A/B/C all present.
- `applies a merged custom className to the root wrapper` — root has `rounded-lg`, `border`, and `my-extra-class`.
- `renders without showSource and without className (all-optional defaults)` — render does not throw; `role="table"` present.

**Totals:** 23 tests, 57 assertions. `formatAmount`, `renderSection`, `renderSubtotal`, and the
`showSource`/`className` branches are all covered.

## Verification

- `corepack pnpm exec vitest run tests/components/conversion/cash-flow-table.test.tsx` → **23 passed (23)**.
- `corepack pnpm exec eslint --max-warnings=0 tests/components/conversion/cash-flow-table.test.tsx` → **0 errors / 0 warnings**.
- `corepack pnpm exec tsc --noEmit` → **0 errors in the new file.** (6 pre-existing, unrelated errors remain
  in `tests/unit/services/budget/managerial-accounting.test.ts` from prior fin-impl-03 work; none reference
  `cash-flow-table`.)
