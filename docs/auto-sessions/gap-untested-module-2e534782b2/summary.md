# gap-untested-module-2e534782b2 — unit tests for `audit-trail-viewer.tsx`

**Risk class:** C · **Target:** `src/components/conversion/audit-trail-viewer.tsx` · **Detected:** 2026-07-09

## Outcome

Added `tests/components/conversion/audit-trail-viewer.test.tsx` (24 tests, all passing)
covering the sole public export `AuditTrailViewer` plus its exported interfaces
(`AuditTrailEntry`, `AuditTrailFilters`, `PaginatedResult<T>`) used as fixture types.

```
Test Files  1 passed (1)
     Tests  24 passed (24)
```

Quality gates on the new file:
- `eslint --max-warnings=0` → 0 errors / 0 warnings
- `tsc --noEmit` → 0 errors in the target file
- `vitest run` → 24/24 passing

## Infrastructure decisions (and why)

The component is a presentational React client component. Two collaborators are
Radix-based UI primitives that misbehave under jsdom, so they are mocked as
test-friendly equivalents — the component logic under test is untouched:

1. **`@/components/ui/select` → native `<select>`/`<option>`.** The viewer renders a
   `<SelectItem value="">` ("すべて" option); `@radix-ui/react-select` throws on
   empty-string item values in jsdom (the same issue `BudgetForm.test.tsx` documents).
   Unlike BudgetForm's opaque passthrough, this mock wires `onValueChange` onto a real
   native select so the component's filter-state wiring (`action` / `entityType`
   handlers, including the `value || undefined` coalescing) is exercised faithfully
   rather than stubbed.
2. **`@/components/ui/scroll-area` → passthrough `<div>`.** Radix `ScrollArea`
   instantiates a `ResizeObserver` on mount; `tests/setup.ts` does not provide one.
   It is a pure layout wrapper (excluded from coverage as `src/components/ui/**`), so
   children are rendered directly.

**Determinism:** the timestamp cell calls `new Date(createdAt).toLocaleString('ja-JP')`,
whose output depends on the runtime ICU data and is therefore non-deterministic across
environments. Tests assert structural neighbours (userName, userRole, entity label) and
**never** the formatted date string, per the "no real clock/locale" constraint.

## Assertions added (24 tests)

### Rendering (8)
- `監査証跡` title is present; `フィルタ` button exists; `更新` and `CSV出力` are enabled.
- An entry renders its action badge label (`プロジェクト作成`), entity-type label
  (`プロジェクト`), entity id (`ent-1`), actor name (`山田 太郎`), role (`(admin)`),
  and the `変更フィールド: name, status` line.
- The `変更フィールド` line is omitted when `changedFields` is `[]`.
- The `変更フィールド` line is omitted when `changedFields` is `undefined`.
- The entity-id span is omitted when `entityId` is `undefined`.
- Unknown action (`'mystery_action'`) falls back to a badge whose label is the raw
  action string (exercises `getActionConfig`'s `?? { label: action }` default).
- Unknown entity type (`'custom_entity'`) falls back to the raw string (exercises
  `getEntityTypeLabel`'s `?? entityType` default).
- Empty `data` renders the `監査ログがありません` empty state.

### Filters panel (6)
- Panel is hidden by default (`適用`/`リセット`/userId input absent), opens on
  `フィルタ` toggle, and closes on a second toggle.
- Typing a userId then `適用` calls `onFilterChange` once with `userId === 'user-42'`.
- Selecting an action in the action combobox then `適用` yields `action === 'project_execute'`.
- Selecting an entity type in the entity-type combobox then `適用` yields
  `entityType === 'mapping'`.
- Re-selecting `すべて` clears the action (`action === undefined` — the
  `value || undefined` coalescing edge case).
- `リセット` clears local state and propagates `{}`: after a userId apply the arg is
  `{ userId: 'abc' }`, after reset it is `{}`, the userId input is cleared, and a
  follow-up apply still yields `{}`.

### Toolbar actions (2)
- `CSV出力` calls `onExport` exactly once with `'csv'`.
- `更新` calls `onRefresh` exactly once.

### Pagination (5)
- No `前へ`/`次へ` controls when `totalPages <= 1`.
- With `page=2, limit=10, total=25, totalPages=3`: range summary
  `全 25 件中 11 - 20 件` and indicator `2 / 3` are rendered.
- `前へ` → `onPageChange(1)`; `次へ` → `onPageChange(3)`.
- `前へ` is disabled on the first page (`次へ` enabled).
- `次へ` is disabled on the last page (`前へ` enabled).

### Loading / fail-safe state (3)
- `isLoading` disables `更新` and `CSV出力` and adds `animate-spin` to the `RefreshCw` icon.
- When not loading, the refresh icon lacks `animate-spin`.
- `isLoading` disables both pagination buttons (fail-safe: no page change while loading).

## Coverage rationale

- **Every public entry point** (`AuditTrailViewer`) is rendered across all states.
- **Happy path:** populated list, filter apply/reset, export, refresh, pagination navigation.
- **Edge/boundary:** empty list, single page vs multi-page, first/last page, empty/absent
  optional fields, unknown action/entity fallbacks, action re-select clearing.
- **Fail-safe:** `isLoading` disables every mutating control (refresh, export, pagination).
- **No external collaborators instantiated:** Radix Select & ScrollArea mocked;
  callbacks are `vi.fn()` mocks; no network/clock/random involved.
