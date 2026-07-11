# Summary — gap-untested-module-a7090adcdc

**Task:** Add unit tests for `src/app/[locale]/(authenticated)/journal-proposal/components/ProposalCard.tsx`
**Risk class:** C
**Detected:** 2026-07-09T02:09:31Z

## Deliverable

- New test file: `tests/app/[locale]/(authenticated)/journal-proposal/components/ProposalCard.test.tsx`
- **41 tests, all passing.** Mirrors the source path under `tests/` as required.

## What is under test

`ProposalCard` is a React client component that renders one journal-entry proposal:
it splits entries into debit/credit columns, shows risk/confidence, toggles an AI
reasoning panel, and supports a view mode (edit / approve / reject) and an edit mode
(save / cancel) that mutates a local draft and reports it via callbacks.

The test imports and renders the **real** `ProposalCard` with React Testing Library
(`render` / `fireEvent` / `within`) — it does not re-implement the component, so it is
not "fake green" (verified by a negative control: swapping the debit/credit filter in
the source fails 3 tests; reverting restores green).

## Mocks (external collaborators only)

| Mock | Why |
|------|-----|
| `next-intl` → `useTranslations: () => (key) => key` | Required; component uses `useTranslations('journalProposal')`. Matches the repo's existing pattern (e.g. `tests/components/layout/sidebar.test.tsx`). |
| `@/components/journal-proposal` barrel (`ConfidenceIndicator`, `TaxTypeSelector`, `getTaxTypeLabel`) | `TaxTypeSelector` is backed by `@radix-ui/react-select`, which refuses to render in jsdom (see `tests/components/budget/BudgetForm.test.tsx` for the same boundary treatment). `ConfidenceIndicator`/`TaxTypeSelector` already have their own unit tests, so they are treated as a UI boundary. The `TaxTypeSelector` stub is kept interactive via a native `<select>` so the edit-mode tax-type path is still exercised. |

No new dependencies were added. Real shadcn primitives (`Card`, `Button`, `Badge`,
`Input`, `Textarea`) render for real, so `cn`, the `isSelected` ring, the `className`
forwarding, and `toLocaleString` formatting are all exercised against actual output.

## Assertions added (by group)

### View-mode rendering (11 tests)
- Rank `#1` rendered in the badge; translated title present.
- Parametrized rank `#1` / `#2` / `#3` each render the correct badge text.
- `ConfidenceIndicator` receives the proposal `confidence` and `size="sm"`.
- Boundary confidence values `0`, `0.5`, `1` forwarded unchanged.
- Debit entries placed under the debit column, credit under the credit column (and **not** vice-versa, via `within`).
- Multiple debit + multiple credit entries all render.
- Amount formatted with locale thousands separators (`¥1,234`, `¥5,678`).
- Tax-type label rendered per entry (`tax:taxable_10`, `tax:non_taxable`).
- Description node (`.truncate`) rendered when present (count = 2).
- Description node omitted when description is empty (count = 0).
- Empty `entries[]` renders no rows and does not crash; column headings still present.

### Risk assessment (5 tests)
- Parametrized `low` / `medium` / `high` overall risk → `bg-green-100` / `bg-yellow-100` / `bg-red-100` (exercises `getRiskColor`).
- Recommendation count shown when recommendations exist (`2 recommendations`).
- Recommendation count omitted when the list is empty.

### Selection (4 tests)
- `isSelected` applies `ring-2 ring-primary` to the card root.
- Ring absent by default.
- Extra `className` forwarded to the card root.
- Clicking the card body invokes `onSelect` exactly once.

### Reasoning toggle (3 tests)
- First click reveals `accountSelection`, `taxClassification`, and all `keyAssumptions`; second click hides them.
- Toggle click does **not** propagate to `onSelect` (`stopPropagation`).
- Assumptions list omitted when `keyAssumptions` is empty.

### View-mode action buttons (4 tests)
- View mode shows edit/approve/reject and hides save/cancel.
- Edit calls `onEdit` with the **original** proposal and does not propagate to `onSelect`.
- Approve calls `onApprove`, no propagation.
- Reject calls `onReject`, no propagation.

### Edit mode (7 tests)
- Edit mode shows save/cancel and hides edit/approve/reject.
- Editing `accountName` then Save → `onEdit` receives the mutated draft; unchanged entry untouched.
- Editing `amount` coerces to `Number` and persists (`Number(e.target.value)` path).
- Editing `taxType` via the selector persists (debit updated, credit untouched).
- Editing `description` via the textarea persists.
- **Cancel** discards edits and calls `onEdit` with the original proposal reference.
- Save does not propagate to `onSelect`.

### Fail-safe (3 tests)
- No crash when `onApprove` / `onReject` / `onEdit` are all omitted; clicking the buttons is a no-op.
- Card click is a no-op when `onSelect` is omitted.
- Edit mode does not crash when `onEdit` is omitted (save/cancel are no-ops).

## Coverage rationale

The target file's public surface is the `ProposalCard` component plus the file-local
`EntryRow` helper and the `getRiskColor` mapper (both private, covered indirectly).
The suite covers, per the task requirements:

- **Happy paths:** rendering, selection, reasoning reveal, each action button, the full
  save-edit cycle, and each editable field (accountName / amount / taxType / description).
- **Edge cases:** rank boundaries (1/2/3), confidence boundaries (0/0.5/1), empty
  `entries[]`, empty `description`, empty `keyAssumptions`, empty `recommendations`,
  multiple entries per column.
- **Error/fail-safe paths:** every callback is optional; the suite asserts the component
  degrades safely (no throw, no-op) when callbacks are absent in both view and edit mode.

## Verification

- `vitest run <file>` → **41 passed**.
- Negative control: inverting the debit/credit filter in the source fails 3 tests (then reverted).
- `eslint --max-warnings=0 <file>` → clean.
- `tsc --noEmit` (whole repo) → **0 errors**.

```
Test Files  1 passed (1)
     Tests  41 passed (41)
```
