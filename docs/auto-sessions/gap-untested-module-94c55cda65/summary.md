# Summary — Add unit tests for ProposalActions.tsx

- **Task ID:** `gap-untested-module-94c55cda65`
- **Risk class:** C
- **Target file:** `src/app/[locale]/(authenticated)/journal-proposal/components/ProposalActions.tsx`
- **New test file:** `tests/unit/app/[locale]/(authenticated)/journal-proposal/components/ProposalActions.test.tsx`
- **Framework:** Vitest 4 + @testing-library/react 16 + @testing-library/user-event 14 (existing project harness, jsdom env via `tests/setup.ts`).

## What the component does

`ProposalActions` is a client component that renders the action toolbar for a journal
proposal: an **approve** button, a **reject** button, and a **More** dropdown holding
**regenerate** and **exportToFreee**. Approve/reject open confirmation `Dialog`s. An
internal `handleAction(action, name)` helper drives a per-action loading flag, setting it
before the awaited promise and clearing it in a `finally`. The component returns `null`
when no proposal is supplied.

The component has a single public entry point (the React component itself); `handleAction`
is a private closure, so it is exercised through the rendered UI.

## Location rationale

Placed under `tests/unit/app/[locale]/(authenticated)/journal-proposal/components/` to
mirror the source path under the repo's established `tests/unit/app/...` convention and to
sit beside the existing sibling `tests/unit/app/[locale]/(authenticated)/journal-proposal/page.test.tsx`.
The gen-task suggested `tests/app/...`, but every existing `src/app/...` mirror in the repo
lives under `tests/unit/app/...`; following that convention keeps the verify-gate stem
resolution consistent. The vitest glob (`tests/**/*.test.tsx`) picks the file up either way.

## How collaborators are mocked

- `next-intl`'s `useTranslations` is mocked to `(key) => key`, so each translated label
  surfaces verbatim (`approve`, `reject`, `regenerate`, `exportToFreee`, `confirmApprove`,
  `confirmReject`). This matches the sibling `page.test.tsx` pattern.
- The four action callbacks (`onApprove`, `onReject`, `onRegenerate`, `onExportToFreee`)
  are `vi.fn()` mocks; happy-path cases resolve, loading cases use a controlled deferred
  promise, error cases reject.
- Radix `DropdownMenu`/`Dialog` are exercised as the **real** shadcn wrappers. Local
  `beforeAll` pointer-capture polyfills (`hasPointerCapture`/`setPointerCapture`/
  `releasePointerCapture`) are added because jsdom lacks them and Radix v2 requires them to
  open the menu. No external dependencies were added.
- Fire-and-forget `handleAction` rejections would surface as `unhandledRejection` and crash
  the vitest worker, so the error-path tests install a scoped `process.on('unhandledRejection')`
  swallower that is removed in `finally` (same pattern as `export-modal.test.tsx`).

## Assertions added (18 tests)

### Rendering
1. `renders nothing when there is no proposal` — `proposal={null}` ⇒ container is empty
   (`toBeEmptyDOMElement`). Covers the `if (!proposal) return null` guard.
2. `renders the approve, reject and More actions when a proposal is present` — three buttons
   present by accessible name.
3. `applies the supplied className to the action container` —
   `approve.parentElement` has class `my-actions`.

### Processing state (`isProcessing` prop)
4. `disables every action while isProcessing is true` — approve, reject, More all
   `toBeDisabled`.
5. `leaves every action enabled by default` — all three `toBeEnabled` (default
   `isProcessing=false`).

### Approve flow
6. `opens the confirmation dialog when the approve button is clicked` — dialog role present,
   `confirmApprove` text and dialog confirm button visible.
7. `closes the dialog without approving when Cancel is clicked` — dialog gone, `onApprove`
   never called.
8. `approves and closes the dialog when the confirm button is clicked` — `onApprove` called
   once, dialog closed.

### Reject flow
9. `opens the confirmation dialog when the reject button is clicked` — dialog present,
   `confirmReject` text visible.
10. `closes the dialog without rejecting when Cancel is clicked` — dialog gone, `onReject`
    never called.
11. `rejects and closes the dialog when the confirm button is clicked` — `onReject` called
    once, dialog closed.

### More menu actions (regenerate / export)
12. `reveals the regenerate and export actions inside the More menu` — both `menuitem` roles
    present after opening.
13. `invokes onRegenerate when the regenerate item is selected` — `onRegenerate` called once;
    approve/export not called (correct routing).
14. `invokes onExportToFreee when the export item is selected` — `onExportToFreee` called once;
    approve/regenerate not called.

### Loading state (`handleAction` happy path)
15. `shows the loading indicator on approve and locks the actions until onApprove resolves` —
    while the controlled promise is pending: approve button label is `...` and disabled,
    reject and More disabled, no button named `approve`; after `resolve()`: approve re-enabled
    and `...` gone. Verifies the loading flag is set on entry and cleared on success.
16. `locks the actions while a regenerate is in flight and releases them on completion` —
    while pending: More/approve/reject disabled; after `resolve()`: More re-enabled. Confirms
    the loading lock applies to dropdown-initiated actions too.

### Error handling — fail-safe
17. `clears the loading state and re-enables the actions when onApprove rejects` — despite
    rejection, the `finally` clears loading: approve re-enabled, no `...` button. `onApprove`
    called once. Unhandled rejection swallowed.
18. `clears the loading state when an export action rejects` — More/approve re-enabled after a
    rejected export; `onExportToFreee` called once. Unhandled rejection swallowed.

## Coverage rationale

- **Happy-path** for every entry point: render, approve, reject, regenerate, export
  (tests 2, 8, 11, 13, 14).
- **Edge cases**: null proposal (test 1), default vs. explicit `isProcessing` (4–5), custom
  `className` (3).
- **Boundary / state transitions**: loading set on entry and cleared on both success (15–16)
  and failure (17–18) — i.e. the `finally` branch of `handleAction`.
- **Error paths / fail-safe**: rejecting callbacks must not leave the UI stuck in a loading
  state (17–18); the unhandled rejection is contained so it cannot crash the worker.
- **Determinism**: no real network/clock/random. Callbacks are `vi.fn()` mocks; the loading
  tests gate state observations behind a controlled deferred promise and `waitFor`; the result
  was stable across three consecutive full runs (18/18 each time).

## Verification

- `corepack pnpm exec vitest run <file>` → 18/18 passed (stable across 3 runs).
- `corepack pnpm exec tsc --noEmit` → no errors attributable to the test file.
- `corepack pnpm exec eslint --max-warnings=0 <file>` → exit 0.

## Notes / out of scope

- No source changes were made; the task is test-only.
- `JournalProposalOutput` is cast from a minimal placeholder because `ProposalActions` only
  reads the proposal for a truthiness check and never inspects its fields — building a full
  schema-valid fixture would add noise without exercising any additional branch.
- The dropdown-item `disabled` attribute during loading is not asserted directly (Radix renders
  it as `data-disabled`/`aria-disabled` on a non-native element, and the menu auto-closes on
  select). The equivalent user-visible guard — the **More** trigger being disabled during
  loading, which prevents opening the menu at all — is asserted in tests 15 and 16.
