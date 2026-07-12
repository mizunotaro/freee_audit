# gap-untested-module-85300ed847 — Unit tests for `mapping-batch-operations.tsx`

**Target:** `src/components/conversion/mapping-batch-operations.tsx`
**Test file:** `tests/components/conversion/mapping-batch-operations.test.tsx`
**Risk class:** C · **Framework:** Vitest 4 + @testing-library/react + jsdom (existing stack, no new deps)

## Component under test

`MappingBatchOperations` is a client component rendering a batch action bar for the
account-mapping screen. Props:

- `selectedCount: number` — number of selected mappings (renders `null` when `0`).
- `onApprove: () => Promise<void>` — async, fired after the approve `AlertDialog` is confirmed.
- `onDelete: () => Promise<void>` — async, fired after the delete `AlertDialog` is confirmed.
- `onClear: () => void` — synchronous, fired by 選択解除.

Internal state: two controlled `AlertDialog` open-flags (`showApproveDialog`,
`showDeleteDialog`) and a `loading` flag toggled inside `try { … } finally { … }`
handlers (`handleApprove`, `handleDelete`) with **no catch**.

## Coverage rationale

The public surface is a single React component plus its three user-action entry points
(`onApprove`, `onDelete`, `onClear`) and one fail-safe render branch (`selectedCount === 0`).
Tests are grouped by entry point and exercise happy-path, edge, and error/fail-safe behavior
exactly as the gap task requires.

## Assertions added (13 tests)

### Fail-safe / rendering
1. `selectedCount === 0` → renders nothing (`container` is empty). **Fail-safe hidden state.**
2. `selectedCount > 0` → renders `{n}件選択中` plus the three action buttons
   (一括承認 / 一括削除 / 選択解除). **Happy-path render.**
3. Different `selectedCount` values (1 vs 12) drive the visible copy, and stale copy is absent. **Boundary / interpolation.**
4. The destructive `bg-destructive` class lands only on the delete trigger, never the approve trigger. **Variant correctness.**

### Clear (synchronous handler)
5. Clicking 選択解除 calls `onClear` exactly once with no dialog. **Happy-path sync.**

### Approve flow
6. 一括承認 opens the confirm dialog with the count-interpolated title/description
   (`一括承認の確認`, `選択した4件のマッピングを承認しますか？`); confirming fires `onApprove`. **Happy-path async.**
7. Cancelling the approve dialog calls **neither** handler and dismisses the dialog. **Edge / no-op path.**
8. While `onApprove` is pending the action-bar buttons are disabled; after resolve they re-enable
   (drives the `loading` flag and the `finally` reset via a controllable pending promise). **In-flight + completion.**

### Delete flow
9. 一括削除 opens the confirm dialog with the irreversibility copy
   (`…削除しますか？この操作は取り消せません。`); confirming fires `onDelete`. **Happy-path async.**
10. Cancelling the delete dialog calls **neither** handler and dismisses the dialog. **Edge / no-op path.**
11. While `onDelete` is pending the action-bar buttons are disabled; after resolve they re-enable. **In-flight + completion.**

### Fail-safe on dependency errors
12. `onApprove` rejecting still resets `loading` so the UI stays usable. **Error path / finally.**
13. `onDelete` rejecting still resets `loading` so the UI stays usable. **Error path / finally.**

## Notes on determinism & robustness

- **No real network / clock / randomness.** All collaborators are `vi.fn()` mocks. Async
  handlers are driven by controllable promises (`new Promise(r => { resolveApprove = r })`),
  not timers.
- **`loading` is asserted via the outer action-bar buttons** (`disabled={loading}`) rather than
  the in-dialog `'処理中…'` label. This is robust to Radix `AlertDialogAction`'s synchronous
  auto-close behavior and avoids coupling assertions to dialog-open timing during async work.
- **Unhandled-rejection handling.** `handleApprove`/`handleDelete` use `try/finally` with no
  `catch`, so a rejecting dependency escapes as an unhandled rejection on the async event
  handler. The two error-path tests register a scoped `process.on('unhandledRejection')`
  no-op listener and remove it in `afterEach` so the vitest worker is not killed (matches the
  repo's documented pattern for leaky async try/finally handlers).
- Follows the existing sibling-test conventions (`tests/components/conversion/mapping-list.test.tsx`,
  `list-state.test.tsx`): `@testing-library/react` + `@testing-library/user-event`, jest-dom
  matchers, fresh mocks per test, kebab-case file name.

## Verification

- `corepack pnpm exec vitest run tests/components/conversion/mapping-batch-operations.test.tsx` → 13 passed.
- `corepack pnpm exec vitest run tests/components/conversion/` → 3 files / 33 tests passed (no regressions).
- `corepack pnpm typecheck` (`tsc --noEmit`) → 0 errors.
- `corepack pnpm exec eslint <file> --max-warnings=0` → exit 0.
