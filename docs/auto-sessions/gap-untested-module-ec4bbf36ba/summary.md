# gap-untested-module-ec4bbf36ba — Unit tests for `account-search-dialog.tsx`

**Risk class:** C
**Target:** `src/components/conversion/account-search-dialog.tsx`
**Test file:** `tests/components/conversion/account-search-dialog.test.tsx`
**Result:** 17 / 17 passing · `tsc --noEmit` clean · `eslint --max-warnings=0` clean

---

## What the module does

`AccountSearchDialog` is a controlled Radix-Dialog-based picker over a list of
`ChartOfAccountItem`. Its public surface is entirely prop-driven:

- controlled open state (`open` / `onOpenChange`)
- `items` → filtered by a case-insensitive search across `code`, `name`, `nameEn`
- `onSelect(item)` → called on row click, then the dialog is closed and the
  internal query is reset
- `selectedId` → row gets `border-primary` styling + a `Check` marker
- items grouped by `category` (missing category → `other`), group label looked up
  in a fixed `categoryLabels` map with a `|| category` fallback

There are no exported helper functions — the unit of behaviour is the component,
so tests render it and assert on DOM output / mock-callback invocations.

## Test environment notes

- The module renders Radix `Dialog` (content is **portaled to `document.body`**)
  and Radix `ScrollArea` (reads `ResizeObserver` at mount). `tests/setup.ts`
  mocks `IntersectionObserver` but **not** `ResizeObserver`, so the test file
  stubs `ResizeObserver` at the top via `vi.stubGlobal`.
- Because the dialog content is portaled, queries use `screen` / `document.body`
  (NOT the render `container`) — an early draft asserted on `container` and saw
  zero headings.
- Radix injects its own Close (`X`) button, so "no buttons" can never be true;
  the empty-list test asserts zero `<code>` chips (each item row renders one)
  instead.

## Assertions added (17 tests)

### rendering & defaults (3)
1. **default title/description** — `getByText('勘定科目検索')`, `getByText('勘定科目を検索して選択してください')`, search `getByPlaceholderText('コードまたは名称で検索...')`.
2. **custom title/description override** — custom strings present, default title absent.
3. **closed state renders nothing** (`open={false}`) — title, placeholder, and item name all `not.toBeInTheDocument()`.

### search filtering (6)
4. **empty query → all items visible** — three distinct items all `getByText`.
5. **filter by code, case-insensitive** — type `'10'`, match `現金`, hide `売掛金`.
6. **filter by Japanese name** — type `売掛金`, keep `売掛金`, hide `現金`.
7. **filter by English name, case-insensitive** — type `'receivable'`, match the `Accounts Receivable` row.
8. **no matches → empty state** — `getByText('検索結果がありません')`, item absent.
9. **clearing the query restores the full list** — type a non-match → empty state, then `''` → both items return.

### grouping & labels (4)
10. **groups by category with Japanese labels** — `流動資産` (current_asset) and `売上` (revenue) labels both render.
11. **two items in one category collapse to a single group** — `getAllByText('流動資産')` length 1.
12. **missing category → `other` / `その他` fail-safe** (`category: undefined` cast).
13. **unmapped category → raw string fallback** (`category: 'mystery_bucket'` cast → label `'mystery_bucket'`).

### selection (2)
14. **row click invokes `onSelect` with the full item, then `onOpenChange(false)`, then resets the query** — `onSelect` called once with the item object; `onOpenChange` called once with `false`; input value back to `''` even when the row was reached via an active filter (proves the reset is unconditional).
15. **`selectedId` highlights the matching row** — selected button `toHaveClass('border-primary')` and contains an `<svg>` (Check); other row has neither.

### edge cases (2)
16. **empty item list → only empty state, no rows** — `検索結果がありません` present, zero `<code>` chips in body.
17. **each row renders code + name + English name** — `1000`, `現金`, `Cash` all present.

## Coverage rationale

| Module behaviour | How covered |
|---|---|
| `useMemo` filter (`code`/`name`/`nameEn`, `.toLowerCase().includes`) | tests 4–9 incl. case-insensitivity, no-match, and query-clear restoration |
| `useMemo` grouping (`category \|\| 'other'`) | tests 10–13 |
| `categoryLabels[category] \|\| category` lookup incl. fallback | tests 10–13 |
| `handleSelect` ordering (`onSelect` → `onOpenChange(false)` → reset) | test 14 (asserts order-independence of the reset by filtering first) |
| `selectedId` styling + Check marker | test 15 |
| default prop values | tests 1–2 |
| `filteredItems.length === 0` empty state | tests 8, 16 |
| `open` gating | test 3 |

Edge / boundary / fail-safe cases explicitly requested by the task: empty
inputs (8, 16), case boundaries (5, 7), the missing-category and
unmapped-category fail-safes (12, 13), and the always-reset-on-select safety
(14). There are no network/clock/random collaborators; the only external
collaborators (`onSelect`, `onOpenChange`) are `vi.fn()` mocks.

## Out of scope

- No new test-framework dependencies were added (Vitest + @testing-library/react
  + jest-dom matchers, already configured).
- The shadcn/Radix primitives themselves (`ui/dialog`, `ui/scroll-area`) are not
  under test and are excluded from coverage in `vitest.config.ts`.
