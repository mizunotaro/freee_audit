# Summary — gap-untested-module-cdaa1d611c

Add unit tests for `src/components/conversion/balance-sheet-table.tsx` (Risk class C,
no prior `tests/` entry).

- **Target file:** `src/components/conversion/balance-sheet-table.tsx`
- **New test file:** `tests/components/conversion/balance-sheet-table.test.tsx`
- **Result:** 15 tests, 15 passing. `eslint --max-warnings=0` clean. `tsc --noEmit`
  clean for the new file (6 pre-existing errors live in an unrelated file,
  `tests/unit/services/budget/managerial-accounting.test.ts`, which this task does not touch).

## What the component does

`BalanceSheetTable` is a purely presentational client component. It takes a
`ConvertedBalanceSheet` and renders a three-section table (資産 / 負債 / 株主資本).
Each section is one title row, N item rows, and one total row (`{title} 合計`).
`showSource` toggles a fourth column (ソース) that shows each item's
`sourceAccountCode`, falling back to `-` when absent. Amounts are formatted with
`new Intl.NumberFormat('ja-JP')`. The only public entry point is the
`BalanceSheetTable` named export; `renderSection` is an internal closure exercised
indirectly.

## Coverage rationale

The component has no failure paths of its own (it never throws), so "error paths"
are interpreted as fail-safe / degradation behavior: missing optional data
(empty arrays, missing `sourceAccountCode`) and boundary numeric values.

## Assertions added

### Default render (`showSource` off) — 5 tests
- Table role present.
- Header columns コード / 科目名 / 金額 present; ソース absent.
- Section titles 資産 / 負債 / 株主資本 each render, each with a matching
  `{title} 合計` total label.
- Body row count = 10 (3 title rows + (2 + 1 + 1) item rows + 3 total rows),
  verifying the title + items + total structure per section.
- Each item renders its code, name, and ja-JP formatted amount in the same row
  (asserted via `within(row)`).
- Three section totals render as distinct formatted amounts.
- Section title cell `colspan="3"` and total cell `colspan="2"` when source hidden.

### `showSource` on — 3 tests
- ソース column header appears; total header count = 4.
- Section title cell `colspan="4"` and total cell `colspan="3"` when source shown.
- Each item renders its `sourceAccountCode` value in the source cell.
- Fail-safe: an item with no `sourceAccountCode` renders `-`.

### Amount formatting (ja-JP) — 4 tests
- Large value grouped with thousands separators (`1234567890` → `1,234,567,890`).
- Zero renders as `0`.
- Negative renders with leading minus + grouping (`-1000000` → `-1,000,000`).
- Amount cells carry the `text-right` utility (right-alignment contract).

### Fail-safe / edge cases — 3 tests
- Empty sections render only the title + total rows (6 body rows, no item rows).
- Zero total for an empty section renders as `0`.
- `className` is merged onto the root alongside the base `rounded-lg border`
  classes (the `cn` / tailwind-merge contract).

## Notes / environment

- Worktree arrived with no `node_modules`; ran `corepack pnpm install --frozen-lockfile`.
- Ran `corepack pnpm db:generate` before the final typecheck (repo-known requirement
  to avoid phantom TS7006 errors).
- Test data uses totals that are numerically distinct from every item amount so that
  item-cell and total-cell text queries never collide.
- The required `asOfDate` field is included in the factory even though the component
  does not render it, to satisfy the `ConvertedBalanceSheet` type.
