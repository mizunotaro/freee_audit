# gap-untested-module-b500492a36 — unit tests for `mapping-list.tsx`

**Target:** `src/components/conversion/mapping-list.tsx`
**Test file:** `tests/components/conversion/mapping-list.test.tsx` (extended; not duplicated)
**Risk class:** C
**Date:** 2026-07-12

## Situation on arrival

A test file already existed (committed in master as `e7abaf8 auto(C):
Loading/error/empty states + a11y`). The gap-analysis snapshot predated it. The
existing 5 tests covered only the **state delegation** surface — the component
hands loading/error/empty/ready off to `resolveListStatus` + `ListState`. They
did **not** exercise any of the interactive logic that lives in `MappingList`
itself. Rather than create a redundant second file, the existing file was
extended with comprehensive coverage of the untested behavior.

## Public surface covered

`MappingList` exports one component; its observable contract is driven by
internal handlers (`handleSelectAll`, `handleSelectOne`, `handleApprove`,
`handleDelete`, `getMappingTypeBadge`) plus rendering of status/confidence/menu
content. All are now exercised through the rendered DOM.

## Test idiom

Matches the canonical repo pattern for driving Radix primitives, taken from
`tests/unit/app/[locale]/(authenticated)/journal-proposal/components/ProposalActions.test.tsx`:

- `beforeAll` stubs `hasPointerCapture` / `setPointerCapture` /
  `releasePointerCapture` on `HTMLElement.prototype` so `userEvent` can open the
  `DropdownMenu` and toggle `Checkbox` under jsdom.
- `userEvent.setup()` for all interactions (no raw pointer sequencing).
- A `deferred()` promise controls async handler resolution so the in-flight
  `processingId` lock can be asserted deterministically.
- `process.on('unhandledRejection', swallow)` + `process.off` in `finally`
  guards the fail-safe (reject) cases so the vitest worker is not killed.
- `window.confirm` is `vi.spyOn`-ed per delete test and restored in `finally`.
- Fresh `makeHandlers()` per test (no shared mock state); existing module-level
  `handlers` and its 5 tests left untouched.

## Assertions added (26 new tests)

### select-all header checkbox (`handleSelectAll`) — 6
- Header checkbox unchecked when `selectedIds` is empty.
- Header checkbox checked only when `selectedIds.length === mappings.length`.
- Toggling on from empty selection → `onSelectionChange(['m1','m2'])`.
- Toggling off from full selection → `onSelectionChange([])`.
- Partial selection renders the indeterminate affordance (`opacity-50`) and the
  checkbox is **not** checked.
- Full selection omits `opacity-50`.

### per-row selection (`handleSelectOne`) — 3
- Clicking an unchecked row checkbox → `onSelectionChange(['m1'])`.
- Clicking a checked row checkbox → `onSelectionChange([])` (id removed).
- Row checkbox `checked` state tracks membership; the selected row gains
  `bg-muted/50`, an unselected row does not.

### mapping-type badge (`getMappingTypeBadge`) — 5 (parameterized + 1)
- `1to1 → 1:1`, `1toN → 1:N`, `Nto1 → N:1`, `complex → 複合`.
- Unknown type falls back to the raw string (`custom-x`) with `outline` variant.

### status badge — 4
- Default unreviewed/unapproved → `未承認`.
- `isManualReview` → `要確認`.
- Runtime `isApproved` (field is not on the `AccountMapping` type; component
  narrows with `'isApproved' in mapping`) → `承認済`.
- Precedence: `承認済` wins over `要確認` when both are set.

### confidence passthrough — 1
- `ConfidenceIndicator` receives `mapping.confidence`; `aria-valuenow` equals
  `Math.round(confidence * 100)` (e.g. `0.923 → 92`).

### row action menu — 3
- Edit link `href = /conversion/mappings/{id}/edit`, detail link `href =
  /conversion/mappings/{id}` (menu opened, anchors queried as `menuitem`).
- Approve menu item calls `onApprove('m1')`; the trigger button is `disabled`
  while `onApprove` is pending and re-enabled on resolve.
- **Fail-safe:** trigger re-enables even when `onApprove` rejects.

### delete flow (`handleDelete` + `confirm`) — 4
- `confirm() → false`: `onDelete` is **not** called.
- `confirm() → true`: `onDelete('m1')` is called.
- Trigger `disabled` while `onDelete` pending; re-enabled on resolve.
- **Fail-safe:** trigger re-enables even when `onDelete` rejects.

## Coverage rationale per requirement

- **Happy-path** for every entry point: render ready, select-all on/off,
  per-row toggle, type badges, approve, delete-with-confirm, edit/detail links.
- **Edge cases:** empty vs full vs partial selection; all four mapping types plus
  the unknown-type fallback; the `isApproved`-beats-`isManualReview` precedence;
  confidence rounding.
- **Error paths:** `onApprove` and `onDelete` rejection (no unhandled crash).
- **Fail-safe behavior:** both reject cases assert the `processingId` lock is
  released (trigger re-enabled) so a failed action never leaves the row
  permanently disabled — the `try/finally` in the handlers is the behavior under
  test.

## External collaborators

All collaborators are mocked: handlers are `vi.fn()`s, `window.confirm` is
spied, `ConfidenceIndicator` / `ListState` / `resolveList-status` are exercised
through the real component (no service/DB/network touched). Deterministic — no
clock or randomness.

## Verify gate (run in worktree)

| Check | Result |
|---|---|
| `pnpm exec vitest run tests/components/conversion/mapping-list.test.tsx` | 31 passed (5 existing + 26 new) |
| `pnpm exec vitest run tests/components/conversion/` | 46 passed (2 files) |
| `pnpm exec tsc --noEmit` (full repo) | 0 errors |
| `pnpm exec eslint --max-warnings=0 <touched file>` | 0 warnings |

Worktree was bootstrapped with `corepack pnpm install --frozen-lockfile` +
`corepack pnpm db:generate` before running the gate (per repo worktree setup).
