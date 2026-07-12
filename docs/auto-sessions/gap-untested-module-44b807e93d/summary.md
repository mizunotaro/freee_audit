# gap-untested-module-44b807e93d — unit tests for `conversion-result-viewer.tsx`

**Target:** `src/components/conversion/conversion-result-viewer.tsx`
**New file:** `tests/components/conversion/conversion-result-viewer.test.tsx`
**Framework:** Vitest + @testing-library/react (jsdom) — existing project harness, no new deps.
**Result:** 41 tests, all passing. `pnpm typecheck` and `eslint --max-warnings=0` clean.

## What the module exposes

The component exports a single React function component, `ConversionResultViewer({ result, projectId })`.
Two helpers are module-private (not exported) and are therefore exercised **through the public
render/interaction surface**:

- `formatDuration(ms)` — drives the "変換所要時間" stat text.
- `handleExport(format)` — wired to the Excel/PDF/CSV buttons.

## Mocking strategy

- The three child table collaborators (`BalanceSheetTable`, `ProfitLossTable`,
  `CashFlowTable`) are replaced with `vi.fn(() => null)` mocks. This isolates the viewer's own
  logic and lets us assert the exact props passed (`data` + `showSource: true`), per the
  "mock external collaborators" requirement.
- `global.fetch` is stubbed via `vi.stubGlobal`; `window.open` via `vi.spyOn`.
- Radix Tabs v1.1.13 switches the active tab on `mouseDown` (not `click`/`pointerDown`), so
  `fireEvent.mouseDown(tab)` is used to reveal inactive panels. Inactive `TabsContent` panels
  render empty + `hidden`, which keeps assertions naturally scoped to the active panel.

## Determinism

- `formatDuration` output is pure (no locale) — asserted exactly.
- `toLocaleString('ja-JP')` on the conversion date is locale/timezone-dependent, so the date is
  asserted only via its stable prefix label (`/変換完了/`), never as an exact formatted string.
- Money amounts are kept `< 1000` (e.g. 500/800) so `toLocaleString()` produces no thousands
  separator, making debit/credit cell assertions locale-invariant.

## Assertions added (by behaviour)

### Summary header (3 tests)
- `変換結果` title and `/変換完了/` label render.
- The three export buttons `Excel` / `PDF` / `CSV` are present.
- `formatDuration` boundaries via parametrised cases — 6 values: `0ms→0秒`, `45000→45秒`,
  `59999→59秒` (seconds boundary), `60000→1分0秒` (cross into minutes), `125000→2分5秒`,
  `3600000→60分0秒`.

### Summary stat counters (5 tests)
- `変換仕訳数` / `警告` / `エラー` counts mirror the result (2/2/0).
- `変換仕訳数` falls back to `0` when `journalConversions` is `undefined` (the `?.length || 0` path).
- 0 errors → green `CheckCircle2` icon (`svg.text-green-500`) present, destructive icon absent.
- >0 errors → destructive `AlertTriangle` (`svg.text-destructive`) present, green icon absent.
- Warning icon (`svg.text-yellow-500`) appears only when warnings exist.

### Warning & error cards (4 tests) — conditional rendering
- Warnings card hidden when `warnings` empty; shown with `警告 (N件)` heading, each code + message otherwise.
- Errors card hidden when `errors` empty; shown with `エラー (N件)` heading, each code, message, and
  `affectedItem` (rendered parenthesised) otherwise.

### Statement tabs (8 tests) — delegation + empty states + conditional trigger
- Active `bs` tab delegates to `BalanceSheetTable` with `{ data, showSource: true }`.
- Absent `balanceSheet` → `貸借対照表データがありません`.
- Switching to `pl` delegates to `ProfitLossTable` with the right props (asserted **not** called before switch).
- Absent `profitLoss` → `損益計算書データがありません`.
- Switching to `cf` delegates to `CashFlowTable` with the right props.
- Absent `cashFlow` → `キャッシュフロー計算書データがありません`.
- The `調整仕訳` tab trigger exists **only** when `adjustingEntries` is non-empty (rerender checked both states).

### Journals tab (12 tests) — table logic
- Empty state (`仕訳データがありません`) + `0件の仕訳が変換されました` when none.
- Count description (`2件の仕訳が変換されました`) + one row per journal.
- Source/target account codes rendered per line.
- Credit-only line: 借方 cell empty, 貸方 cell `500`.
- Debit-only line: 借方 cell `800`, 貸方 cell empty (the `> 0 ? toLocaleString() : ''` branch both ways).
- Confidence rounding: `0.951→95%`, `0.8→80%`, `0.5→50%` (`Math.round(x*100)`).
- Badge variant mapping: `>=0.9 → bg-primary`, `>=0.7 → bg-secondary`, `<0.7 → bg-destructive`.
- >100 journals: exactly 100 rows rendered (`.slice(0, 100)`) + `上位100件を表示中（全150件）` note.

### Adjusting-entries tab (2 tests)
- Each entry renders type, description, and `承認済み` badge when approved; count description.
- Each line renders `accountCode accountName`, debit cell populated / credit empty for the debit line
  and the mirror for the credit line.

### Export handlers (5 tests) — happy path + fail-safe
- Parametrised over `excel`/`pdf`/`csv`: each button fires
  `fetch("/api/conversion/export/<projectId>?format=<format>")` and `window.open(fileUrl, '_blank')`
  with the returned URL.
- Non-ok response → `window.open` **not** called (graceful no-op).
- `fetch` rejection → `console.error('Export failed:', …)` logged and swallowed, no crash,
  `window.open` not called.

## Coverage rationale

Every public surface of the target module is covered: the export's rendering across all four
always-on tabs plus the conditional adjustments tab, both internal helpers, all conditional cards,
the journal table's row-cap/confidence-rounding/debit-credit branching, and the full
export state machine including its two fail-safe paths. Edge (empty/undefined inputs, boundary
durations, >100-row truncation) and error (failed/failed-response export) cases are included.
