# gap-untested-module-a7f0ad2f46 — Unit tests for `comparison-table.tsx`

**Target:** `src/components/conversion/comparison-table.tsx`
**Risk class:** C (presentational React component, no I/O)
**New test file:** `tests/components/conversion/comparison-table.test.tsx`
**Result:** 25 tests, all passing. `eslint --max-warnings=0` clean. No new typecheck errors.

---

## What the module exports

`comparison-table.tsx` exports a single public symbol: the `ComparisonTable` React
component. The four formatting/decision helpers (`formatAmount`, `formatPercent`,
`getDifferenceIcon`, `isSignificant`) are closures defined *inside* the component
and are not exported, so they are exercised through rendered output rather than
called directly.

`ComparisonTable` renders a title `<h3>`, a two-row `<TableHeader>` (group headers
変換元/変換後 + per-column コード/科目名/金額/%), and one `<TableRow>` per
`ComparisonItem` showing source → target codes, names, locale-formatted amounts,
and (when `showPercentage` is on) a difference cell with a trend icon, a signed
percent, and a 要確認 badge when the change is "significant".

## Coverage rationale

The component is pure/presentational — there are no external collaborators,
network calls, or timers to mock, so the "dependency failure / timeout" error
paths from the task spec map instead to **non-finite input fail-safety**
(NaN / Infinity), which is the realistic fault mode for a numeric table.

| Area | Rationale |
|------|-----------|
| Structure & headers | Verifies the title element, all group/per-column headers, header count (12 with %, 10 without), and that the table shell renders with zero body rows on empty input. |
| Item rows & `formatAmount` | One-row-per-item mapping, codes/names rendered, and amounts go through `toLocaleString()`. Assertions mirror the implementation's own `(n).toLocaleString()` so they are locale-independent and deterministic. Covers large, zero, and negative amounts. |
| `formatPercent` | Sign prefix rule (`>= 0 → +`, negatives keep their own minus), one-decimal rounding, and the zero case (`+0.0%`). |
| `getDifferenceIcon` | Up (green) for `> 0`, down (red) for `< 0`, neutral for `|p| < 0.1`, plus the strict `< 0.1` boundary at exactly `0.1`. Icon assertions read the `class` attr of the svg inside the scoped difference cell. |
| `isSignificant` / `highlightThreshold` | Default threshold 5: at-threshold (±5) flagged, below (4.9) not, row gets `bg-yellow-50` + 要確認 badge. Custom `highlightThreshold` rerender asserts both sides of the boundary. |
| `showPercentage={false}` | Entire difference cell (icon + percent + badge) and the 差異/% headers are omitted; codes/names/amounts remain. |
| Fail-safe | NaN does not crash and degrades to non-significant (no badge, no highlight). +Infinity is treated as a significant positive change. Optional props (`currency`, `highlightThreshold`) are accepted without breaking output. |

## Assertions added (per test)

**Structure**
1. `heading` is `<h3>` with the title text.
2. 変換元 / 変換後 / 差異 headers present; コード / 科目名 / 金額 each appear **2×**; `%` present.
3. `getAllByRole('columnheader')` length === **12** (percentage shown).
4. Empty `items`: table + 変換元 header present, no row text, no 要確認.
5. `showPercentage={false}`: no 差異/% headers, columnheader count === **10**.

**Item rows & `formatAmount`**
6. Single row renders 現金 / Cash / `1000` / `1010` + both locale-formatted amounts.
7. Two items → 現金 and 預金 rows; `Cash` appears **2×**.
8. Large (`1,234,567,890`) and zero (`0`) amounts formatted via `toLocaleString`.
9. Negative amounts render with leading minus (`-5,000`, `-2,500`).

**`formatPercent`**
10. `12.5 → "+12.5%"`.
11. `12.34 → "+12.3%"` (rounding).
12. `-3.2 → "-3.2%"` (no extra sign).
13. `0 → "+0.0%"`.

**`getDifferenceIcon`** (svg `class` attr, scoped to the difference cell)
14. `+5.0%` row icon class contains `text-green-600`.
15. `-5.0%` row icon class contains `text-red-600`.
16. `+0.0%` (from 0.04) icon class contains neither green nor red.
17. `0.1 → "+0.1%"` icon class contains `text-green-600` (boundary `0.1` is **not** `< 0.1`).

**`isSignificant` / `highlightThreshold`**
18. `+5.0%`: 要確認 present, row class contains `bg-yellow-50`.
19. `4.9%`: 要確認 absent, row class has no `bg-yellow-50`.
20. `-5.0%` (|p| === threshold): 要確認 present.
21. Custom threshold 10: `8` → no badge, `10` → badge (rerender).

**`showPercentage={false}`**
22. Codes/names/amounts render; no 要確認, no `+99.0%`, no 差異 header.

**Fail-safe**
23. `NaN` differencePercent: row still renders, no 要確認, no `bg-yellow-50`.
24. `+Infinity`: 要確認 present, row has `bg-yellow-50`, `+Infinity%` icon is green.
25. `currency="USD"` + `highlightThreshold={1}` + `showPercentage={false}`: renders without crashing; row content intact.

## Notes / caveats

- The `currency` prop is destructured as `_currency` with a default of `'円'` but is
  **intentionally unused** in the JSX (underscore prefix). It is therefore not
  observable in output; test 25 only asserts it is accepted without error.
- Amount assertions use `(value).toLocaleString()` on both sides, so they hold
  regardless of the host locale/ICU configuration and remain deterministic.
- No new dependencies were added. Tests use the existing Vitest + React Testing
  Library + jsdom stack already configured in `vitest.config.ts` / `tests/setup.ts`.
  `@radix-ui/react-scroll-area` (used by the component's `ScrollArea`) was verified
  not to depend on `ResizeObserver`, so no extra DOM mock was required.
