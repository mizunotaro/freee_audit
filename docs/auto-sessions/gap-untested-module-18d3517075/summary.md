# gap-untested-module-18d3517075 — unit tests for `profit-loss-table.tsx`

**Target:** `src/components/conversion/profit-loss-table.tsx`
**Test file:** `tests/components/conversion/profit-loss-table.test.tsx`
**Risk class:** C (presentational React component)
**Date:** 2026-07-12

## What was added

`ProfitLossTable` is a pure presentational component. It renders a shadcn
`<Table>` of a `ConvertedProfitLoss`, formatting every amount with
`new Intl.NumberFormat('ja-JP')` and optionally exposing a `showSource` column.
There are no async collaborators, no side effects, and no props that can make
the component throw — so "error paths / timeouts" map to graceful handling of
extreme/empty inputs (covered in the edge-case suite), not to thrown exceptions.

The suite adds **19 tests** across 5 `describe` blocks. Amount assertions use a
`lastCellText(anchor)` helper that anchors on a unique label/code and reads the
trailing `<td>` of the row, so assertions never collide on duplicate amounts.

## Assertions by group

### structure & defaults
- `screen.getByRole('table')` is present; container `firstElementChild` has
  `rounded-lg` and `border` classes.
- Custom `className` (`"my-extra"`) is merged onto the container alongside the
  base classes.
- Default (no `showSource`): headers `コード`, `科目名`, `金額` render; `ソース`
  is absent; `getAllByRole('columnheader')` length is **3**; a known
  `sourceAccountCode` (`4000`) is **not** rendered.

### sections & subtotals
- All five section titles render: `売上高`, `売上原価`, `販売費及び一般管理費`,
  `営業外収益`, `営業外費用`.
- All six subtotal labels render: `売上高合計`, `売上総利益`, `営業利益`,
  `経常利益`, `税引前当期純利益`, `当期純利益`.
- Section-title cell `colspan` = `"3"` (3-column body).
- Every line item's `code` and `name` render.

### amount formatting (ja-JP) — happy path + boundaries
- Line-item amounts are grouped with commas: `600,000`, `511,000`, `10,000`, …
- Subtotal amounts render verbatim from the supplied numbers.
- **Computed subtotal:** revenue subtotal = sum of revenue items
  (`333,333 + 222,222 → 555,555`), proving the live `reduce` path, not a stored
  value.
- **Zero boundary:** amount `0` formats as `"0"` (and revenue subtotal of an
  empty-sum path is `"0"`).
- **Negative (loss) boundary:** `-1,000`, `-1,234,567`, `-50,000` — leading
  minus preserved.
- **Large-value boundary:** `1,000,000,000,000` and `999,999,999,999` format
  without precision loss or overflow.

### showSource column
- `showSource` adds the `ソース` header and a **4th** columnheader cell.
- Section-title cell `colspan` widens to `"4"`.
- Each item's `sourceAccountCode` renders (`4000`, `4090`, `5000`, `7000`,
  `8000`, `9000`).
- **Fail-safe:** missing (`undefined`) and empty-string (`""`) `sourceAccountCode`
  both degrade to `"-"`; two missing sources yield exactly two dash cells.

### empty / fail-safe
- With all five arrays empty, every section title and the `売上高合計` subtotal
  still render; no item `code`s appear; the empty revenue list sums to `"0"`.
- The unreachable per-section total row (text `"売上高 合計"` etc., from the
  `renderSection(total?)` branch that is never invoked) is **never** emitted,
  under both `showSource` states — guarding against phantom totals.

## Coverage rationale

- **Happy path:** structure, defaults, all sections/subtotals/items rendered.
- **Edge cases:** empty arrays, zero, negative, and large (trillion-scale)
  amounts; missing/empty source codes.
- **Fail-safe:** graceful degradation to `"-"` for absent sources, `"0"` for
  empty sums, and confirmation that the dead `total` branch produces no output.
- **Determinism:** no network, clock, or randomness — `Intl.NumberFormat('ja-JP')`
  is deterministic under Node ≥ 20 full ICU; dates are constructor-supplied.

## Verification

- `pnpm vitest run tests/components/conversion/profit-loss-table.test.tsx` →
  **19 passed**.
- `eslint --max-warnings=0` on the new test file → **clean** (0 warnings).
- `tsc --noEmit` (full project, after `pnpm db:generate`) → **exit 0**.
