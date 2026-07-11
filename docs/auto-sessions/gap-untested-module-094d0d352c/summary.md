# gap-untested-module-094d0d352c — unit tests for approval-workflow.tsx

**Target:** `src/components/conversion/approval-workflow.tsx`
**Test file:** `tests/components/conversion/approval-workflow.test.tsx`
**Risk class:** C (UI component, no direct DB/external I/O)
**Result:** 35 tests, all passing. ESLint 0 warnings, Prettier clean, `tsc --noEmit` clean for the new file.

## What the component does

`ApprovalWorkflowComponent` is a controlled presentational React component for an
accounting-standard conversion approval workflow. It renders:

- a 5-stage stepper (`STAGE_CONFIG`: mapping → rationale → adjustment → fs → final)
- a status badge (`STATUS_CONFIG`)
- assignee chips (with required/approved markers)
- a conditional action panel (approve / reject / escalate)
- a conditional "advance to next stage" button
- an approval history list
- two Radix dialogs (reject reason, escalate reason)

It takes `onApprove`, `onReject`, `onEscalate`, and optional `onAdvanceStage`
callbacks plus a `workflow` prop and `currentUserId`. All UI gating is derived
from props via `isAssignee`, `hasApproved`, `allRequiredApproved`.

## Coverage rationale

The component is pure presentation whose entire surface is conditional rendering
and callback wiring. Tests therefore drive every guard expression and callback
path through `@testing-library/react` + `userEvent`, mirroring the established
pattern in `tests/.../ProposalActions.test.tsx` (Radix dialog open/close via
`findByRole('dialog')` / `within(dialog)` scoping / `queryByRole` after close).

## Assertions added (35 tests)

### Stage stepper (3)
- All five stage labels render (`getAllByText` for each — current-stage label also
  appears in the detail header, so presence-not-uniqueness is asserted).
- Current stage description pulled from `STAGE_CONFIG` for `mapping_review`.
- Current stage description updates to `final_approval` when the stage advances.

### Status badge (5 — one per `ApprovalStatus`)
- `pending`→保留中, `in_review`→レビュー中, `approved`→承認済み,
  `rejected`→却下, `escalated`→エスカレーション. Each rendered with a non-assignee
  current user so the action panel / approved notice cannot shadow the badge text.

### Assignee chips (1)
- Renders every assignee name and the `(必須)` marker for required assignees only.

### Action panel visibility (4) — the core guard `isAssignee && !hasApproved && status === 'in_review'`
- Happy: panel shown for an in-review assignee who hasn't approved.
- Not an assignee → panel hidden (all three buttons absent).
- Already approved → panel hidden, "承認済み" notice shown.
- Status `pending` → panel hidden.

### Approve flow (3)
- Empty comment → `onApprove(stage, undefined)` called once (covers the
  `comment || undefined` coercion).
- Typed comment → `onApprove(stage, 'LGTM')` and the field is cleared afterwards
  (covers `setComment('')`).
- `isLoading` → 承認/却下/エスカレーション buttons disabled.

### Reject flow (5) — dialog-gated, `rejectReason.trim()` guard
- Dialog opens on trigger click; title "却下理由" + dialog confirm present.
- Valid reason → `onReject(stage, reason)` called once, dialog closes.
- **Edge:** blank reason → `onReject` NOT called, dialog stays open (fail-safe).
- **Edge:** whitespace-only reason → treated as blank (`.trim()`).
- Cancel button → dialog closes, `onReject` NOT called.

### Escalate flow (4) — dialog-gated, `escalateReason.trim()` guard
- Dialog opens on trigger click.
- Valid reason → `onEscalate(stage, reason)` called, dialog closes.
- Blank reason → NOT called, dialog stays open.
- Cancel → closes without calling.

### Advance to next stage (6) — guard `allRequiredApproved && status === 'approved' && onAdvanceStage`
- All required approved + approved + handler → button visible; click calls
  `onAdvanceStage(projectId)` with `'proj-1'`.
- `onAdvanceStage` omitted (undefined) → button hidden.
- A required assignee still pending → button hidden.
- Status not `approved` → button hidden.
- **Edge:** no required assignees → vacuous `.every()` is `true`, button still works.
- `isLoading` → advance button disabled.

### History (3)
- Empty history → "履歴はありません".
- Populated history → each entry's userName, comment, and action badge render.
- Entry without comment → comment line omitted.

### Dialog accessibility (1)
- Reject dialog exposed with `role="dialog"`, `data-state="open"`, and
  `aria-labelledby` resolving to an element whose text is "却下理由".

## Notes / decisions

- **No `aria-modal` assertion.** This installed version of Radix `Dialog.Content`
  emits `role`, `aria-labelledby`, `aria-describedby`, and `data-state` but does
  **not** emit `aria-modal="true"`. Verified empirically; the meaningful contract
  (title labels the dialog via `aria-labelledby`) is asserted instead.
- **`ResizeObserver` mocked in `beforeAll`.** The component renders a radix
  `ScrollArea`, which consults `ResizeObserver` (absent in jsdom). Mock mirrors
  the existing `IntersectionObserver` pattern in `tests/setup.ts`.
- **Determinism.** Dates are fixed ISO strings; the locale-formatted history date
  string is never asserted on. No network/clock/random.
- **No new dependencies.** Uses only `vitest`, `@testing-library/react`,
  `@testing-library/user-event` (all already used by sibling tests).
- **Handlers are synchronous `vi.fn()`s.** The component invokes them without
  awaiting, so there is no unhandled-rejection surface and no need for the
  `process.on('unhandledRejection')` swallow pattern used elsewhere.

## Verification run

```
pnpm exec vitest run tests/components/conversion/approval-workflow.test.tsx
# Test Files 1 passed (1) — Tests 35 passed (35)
eslint --max-warnings=0 → exit 0
prettier --check → All matched files use Prettier code style
tsc --noEmit → 0 errors in the new file
```

The 6 remaining `tsc` errors in the repo are pre-existing in
`tests/unit/services/budget/managerial-accounting.test.ts` (unrelated, not
touched by this change).
