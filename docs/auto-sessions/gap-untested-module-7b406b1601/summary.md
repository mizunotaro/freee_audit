# gap-untested-module-7b406b1601 — unit tests for mapping-editor.tsx

**Target:** `src/components/conversion/mapping-editor.tsx` (Risk class C, previously untested)
**Deliverable:** `tests/components/conversion/mapping-editor.test.tsx` — **26 tests, all passing.**

## Verification

| Gate | Result |
|------|--------|
| `vitest run tests/components/conversion/mapping-editor.test.tsx` | 26/26 pass (3.8s) |
| `eslint --max-warnings=0` on the new file | clean |
| `tsc --noEmit` (whole project) | rc=0, no errors |

## Test strategy / mocking rationale

`MappingEditor` composes several Radix-based shadcn primitives that are hostile to
jsdom. The mocks mirror the established patterns in sibling conversion tests
(`account-code-selector.test.tsx`, `audit-trail-viewer.test.tsx`):

- **`@/components/ui/select`** → native `<select>/<option>` wired to `onValueChange`
  (Radix Select breaks in jsdom and rejects empty option values).
- **`@/components/ui/alert-dialog`** → renders content only while `open`, wires
  `AlertDialogAction` `onClick` (Radix focus-trap/portal removed).
- **`@/components/conversion/account-code-selector`** → thin surface exposing
  `data-selected` / `data-placeholder` / `data-disabled` plus one `<button>` per
  item that drives `onChange(id, item)`. (That component has its own dedicated
  test file; we don't re-test it through the editor.)

`AccountCodeSelector` is mocked rather than driven because source/target item
names are kept disjoint (`現金`/`当座預金` vs `Cash`/`Accounts Receivable`), so
item clicks are unambiguous, and the percentage `<input type="number">` (role
`spinbutton`) is unique per split row — no query ambiguity.

The failure-path test reuses the repo's scoped `process.on('unhandledRejection')`
swallow idiom (cf. `ProposalActions.test.tsx`) because `handleSave`'s async
`try/finally` lets an `onSave` rejection propagate from the onClick handler.

## Assertions added (26 tests, grouped)

### create vs edit mode (2)
- create mode renders title `新規マッピング` and leaves the source selector enabled (`data-disabled="false"`).
- edit mode renders title `マッピング編集`, disables the source selector, defaults the type `<select>` to `1to1`.

### initialization from the `mapping` prop (5) — covers the `find(... sourceAccountId || sourceItemId)` branches
- source + target pre-selected by matching account ids.
- **alias branch:** falls back to `sourceItemId` when `sourceAccountId` doesn't match.
- **alias branch:** falls back to `targetItemId` when `targetAccountId` doesn't match.
- **fail-safe:** unknown ids leave source/target unset and keep save disabled.
- `mappingType` from the mapping is reflected in the type selector (`1toN`).

### validation (1)
- 1to1 save stays disabled until both source and target are chosen, then enables.

### save — 1to1 create (3)
- emits `{ sourceItemId, targetItemId, mappingType:'1to1', percentage:undefined, notes:undefined }` with **no** `conversionRule`.
- includes `notes` when the memo textarea is filled; empty memo → `undefined`.
- `キャンセル` invokes `onCancel` exactly once.

### loading + failure resilience (2)
- while `onSave` is pending: button label `保存中...`, save + cancel disabled; both restore after resolve.
- **error path:** when `onSave` rejects, the loading flag still resets (button re-enables) — exercises the `finally` block; the propagated rejection is swallowed.

### 1toN split mapping (4)
- save builds `conversionRule: { type:'percentage', percentage:100 }` with `targetItemId:''`.
- add-split (`追加`) and remove-split (trash icon) track the spinbutton count 1 → 2 → 1.
- **percentage boundary:** sum ≠ 100 shows the warning `配分の合計が100%になりません` and disables save; sum = 100 hides it and re-enables.
- **itemId rule:** a split row with no target keeps save disabled even when the sum is 100 (`every(t => t.itemId)`).

### complex conditional mapping (2)
- save disabled at 0 conditions; still disabled after adding a condition with empty target; enabled once the condition target is set (`every(c => c.targetItemId)`).
- save builds `conversionRule: { type:'formula', conditions:[{ field:'description', operator:'contains', value:'', targetAccountId:'tgt-1' }] }` with `targetItemId` from the seeded target.

### Nto1 consolidation mapping (1)
- `isValid` falls through to `return true` once a source is set; save emits `{ targetItemId, mappingType:'Nto1', percentage:100 }` with no `conversionRule`.

### AI suggestion (4)
- panel renders `AI推奨` badge, `信頼度: 85%`, reasoning, and `推奨を適用` button **only** in create mode (hidden when `mapping` is supplied).
- confidence boundary: `1` → `信頼度: 100%`.
- applying a matching suggestion sets the target (verified via save payload `targetItemId:'tgt-1'`) and switches to `1to1`.
- **fail-safe:** applying a suggestion whose code matches no item is a no-op (target stays unset, save stays disabled).

### delete flow (2)
- `削除` button is hidden in create mode and when `onDelete` is omitted.
- footer `削除` opens the dialog; the dialog `削除` (`AlertDialogAction`) calls `onDelete` once and the dialog closes on success.

## Coverage notes / known limitation

- All four `MappingType` save paths (`1to1`, `1toN`, `complex`, `Nto1`) are exercised, plus every
  `isValid` branch and both `conversionRule` construction branches (`percentage`, `formula`).
- **Pre-existing defect observed (not fixed — test-only task):** `isValid()` does not require
  `targetItem` for `complex`/`Nto1`, but `handleSave` reads `targetItem!.id` for any non-`1toN`
  type. A **fresh** (no `mapping`) complex or Nto1 save therefore null-dereferences. To exercise
  those save paths without locking in the crash, the complex and Nto1 save tests seed `targetItem`
  via the `mapping` prop (target is set internally from `mapping.targetAccountId`, even though no
  target selector is rendered in those modes). No code markers (TODO/FIXME) were added, per task
  constraints; flagging here for maintainer awareness.
