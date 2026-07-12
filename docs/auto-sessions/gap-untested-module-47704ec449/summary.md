# gap-untested-module-47704ec449 — Unit tests for `src/contexts/page-context.tsx`

- **Risk class:** C
- **Target file:** `src/contexts/page-context.tsx`
- **New test file:** `tests/unit/contexts/page-context.test.tsx`
- **Framework:** Vitest + React Testing Library (existing config; no new deps)
- **Result:** 102 / 102 tests pass · `eslint --max-warnings=0` clean · `tsc --noEmit` clean

## Public surface covered

| Export | Kind | Coverage |
|---|---|---|
| `inferPageTypeFromPath(path)` | pure fn | happy-path (all 16 keywords + locale-prefixed), edge (empty / root / unknown / arbitrary), specificity ordering, first-match-wins quirk |
| `getPageTypeLabel(pageType, language)` | pure fn | all 17 `PageType`s × {ja, en, default-omitted}, fallback for unknown pageType |
| `PageContextProvider` | component | default state, mount-time `pagePath` from `window.location.pathname`, renders children, partial/full updates, clear, idempotency, `useCallback` referential stability |
| `usePageContext()` | hook | default-without-provider fail-safe, no-op default setters |

## Assertions added (102 tests)

### `inferPageTypeFromPath` (28 tests)
- `it.each` (19): `/dashboard`, `/ja/dashboard`, `/audit`, `/en/audit/journals`, `/reports`, `/ja/reports/monthly`, `/reports/kpi`, `/reports/cashflow`, `/reports/budget`, `/analysis`, `/settings`, `/chat`, `/journal-proposal`, `/conversion`, `/tax`, `/social-insurance`, `/deferred-accrual`, `/board`, `/investor` → expected `PageType`.
- Empty string → `'other'`.
- Root `'/'` → `'other'`.
- Unknown `'/unknown/xyz'` → `'other'`.
- Arbitrary non-path `'not-a-path'` → `'other'`.
- `/reports/kpi`, `/reports/cashflow`, `/reports/budget` each win over the generic `/reports` branch (specificity ordering).
- `/ja/board-reports/123` → `'board'` (documents substring matching).
- `/tax/settings` → `'settings'` (documents that `/settings` is checked **before** `/tax` in the if-chain — first-match-wins).

### `getPageTypeLabel` (54 tests)
- `it.each` × 17: correct **ja** label per `PageType`.
- `it.each` × 17: correct **en** label per `PageType`.
- `it.each` × 17: defaults to **ja** when `language` is omitted.
- 1: every `PageType` returns a non-empty string in ja.
- 1: unknown `pageType` → `'その他'` (ja fallback via `?.` + `??`).
- 1: unknown `pageType` → `'Other'` (en fallback).

### `usePageContext` (3 tests)
- 1: `typeof usePageContext === 'function'`.
- 1: used **without** a provider → returns safe defaults (`pageType:'other'`, `pageTitle:''`, `pagePath:''`, `financialData:null`) and **does not throw**.
- 1: the no-provider default `setPageContext`/`clearPageContext` are harmless no-ops (calling them throws nothing, state unchanged).

### `PageContextProvider` (17 tests)
- Default values on mount (`pageType:'other'`, `pageTitle:''`, `financialData:null`, setters are functions).
- `pagePath` initialized from `window.location.pathname` on mount — jsdom default `'/'`.
- `pagePath` initialized from a custom pathname set via `history.pushState('/ja/audit')`.
- Renders its children.
- `setPageContext` updates `pageType` / `pageTitle` / `pagePath` / `financialData` individually.
- Stores a complete `FinancialDataContext` (all 8 optional fields incl. nested `customData`).
- Accepts an empty financialData object `{}`.
- Clears `financialData` when `null` is passed.
- Partial update preserves untouched fields.
- Empty object `{}` to `setPageContext` is a no-op.
- Successive `setPageContext` calls accumulate.
- `clearPageContext` resets every field to its default.
- `clearPageContext` is idempotent on the default state.
- `setPageContext` and `clearPageContext` keep the same reference across re-renders (`useCallback([])`).

## Coverage rationale

- **Happy path:** every public entry point exercised with representative inputs (all 16 path keywords, all 17 `PageType` labels in both locales, every setter field).
- **Edge cases:** empty/`'/'`/unknown/arbitrary paths; empty `{}` financialData; complete financialData; empty-object update; locale-prefixed (`/ja`, `/en`) paths; jsdom default vs custom pathname.
- **Error / fail-safe paths:**
  - `inferPageTypeFromPath` degrades to `'other'` for anything unrecognized.
  - `getPageTypeLabel` degrades to the `other` label for an unrecognized `pageType` (the `labels[pageType]?.[language] ?? labels.other[language]` branch).
  - `usePageContext` used outside a provider **degrades to safe defaults instead of crashing**.

## Notable finding (informational, no source change)

The guard inside `usePageContext`:

```ts
const context = useContext(PageContext)
if (context === undefined) {
  throw new Error('usePageContext must be used within a PageContextProvider')
}
```

is **unreachable**: `PageContext` is created with a non-`undefined` default (`defaultPageContext`), so `useContext` never returns `undefined` and the throw can never fire. Outside a provider the hook silently returns the no-op default instead. The two "without a provider" tests above pin this *actual* fail-safe behavior (no throw → safe default) rather than the guard's intended throw. Flagged for a future hardening task; no production code was modified here (test-only change).

## Verification

```
corepack pnpm exec vitest run tests/unit/contexts/page-context.test.tsx  → 102 passed
corepack pnpm exec eslint tests/unit/contexts/page-context.test.tsx --max-warnings=0 → clean
corepack pnpm exec tsc --noEmit → 0 errors
```
