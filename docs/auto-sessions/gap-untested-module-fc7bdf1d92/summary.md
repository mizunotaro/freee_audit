# Gap: unit tests for `src/components/reports/ir/faq-manager.tsx`

**Task ID:** gap-untested-module-fc7bdf1d92
**Risk class:** C
**Target:** `src/components/reports/ir/faq-manager.tsx` (previously had no `tests/` entry)
**Deliverable:** `tests/components/reports/ir/faq-manager.test.tsx`

## Result

- New test file: `tests/components/reports/ir/faq-manager.test.tsx`
- **27 tests, all passing** (Vitest + @testing-library/react, jsdom).
- `tsc --noEmit` clean for the new file; `eslint --max-warnings=0` clean.
- No new dependencies added; no source changes; no new TODO/FIXME.

## Coverage rationale

`FAQManager` is a controlled React component (`faqs` in, `onChange` out) with
internal UI state (`expandedId`, `draggedIndex`). Each `handle*` handler is
exercised through the DOM the way a user would trigger it, then the emitted
`onChange` payload is asserted. This covers every public entry point
(`handleAdd`, `handleUpdate`, `handleDelete`, `handleMoveUp`, `handleMoveDown`,
`handleDragStart`/`handleDragOver`/`handleDragEnd`, `getLocalizedText`) plus the
render branches (title, empty state, ordering, fallback text, read-only mode,
language variants).

## Assertions added (per test)

### rendering
- `renders the default title and an add button` — default `title='FAQ管理'` is shown; the 追加 button is present (happy path defaults).
- `renders a custom title when provided` — `title` prop overrides default; default text gone.
- `shows the Japanese empty state when there are no FAQs` — empty input → `FAQがありません` (edge: empty list, ja).
- `shows the English empty state for language en` — empty input + `language='en'` → `No FAQs`.
- `hides the add button in read-only mode` — `readOnly` suppresses the 追加 button (fail-safe: no mutation affordance).
- `renders FAQs sorted by order regardless of array order` — `sortedFaqs` orders by `order`; passed `[B(order1), A(order0)]`, A precedes B in DOM (`compareDocumentPosition`).
- `shows the Japanese fallback question when the question is empty` — empty `question` → `質問 1` placeholder text (edge: empty fields).
- `shows the English fallback question when language is en and en is empty` — `language='en'` + empty `en` → `Question 1` fallback.

### read-only mode
- `renders no action buttons` — `readOnly` renders zero `<button>` elements (no add/up/down/delete) (fail-safe).
- `reveals the answer when a row is expanded` — clicking a row toggles `expandedId`; answer label `回答:` and answer text appear (read-only render branch).

### handleAdd
- `appends a new empty FAQ and notifies the parent` — `onChange` called once; new item has `id` matching `/^faq_\d+_[a-z0-9]+$/`, empty `question`/`answer`, `order=0`.
- `assigns the new FAQ an order equal to the current length` — with 1 existing FAQ, new item `order=1`; existing item preserved unchanged.

### handleUpdate
- `updates the Japanese question field while preserving other fields` — `onChange` payload merges only `question.ja`; `en`, `answer`, `id`, `order` untouched.
- `updates the English answer field for language en` — `language='en'` exposes the EN textarea; editing it updates `answer.en` only.

### handleDelete
- `removes the FAQ and re-numbers the remaining orders` — deleted item gone; survivor re-indexed to `order=0`.
- `collapses the edit form when the expanded FAQ is deleted` — after deleting the open FAQ, the edit input is no longer in the document (internal `expandedId` cleared) (fail-safe).

### handleMoveUp
- `swaps the FAQ with the previous one and re-numbers` — `[A,B]` → `onChange` ids `[B,A]`, orders `[0,1]`.
- `disables move-up on the first FAQ` — first row's up button `disabled` (boundary: index 0).

### handleMoveDown
- `swaps the FAQ with the next one and re-numbers` — `[A,B]` → `onChange` ids `[B,A]`, orders `[0,1]`.
- `disables move-down on the last FAQ` — last row's down button `disabled` (boundary: last index).

### drag and drop reordering
- `reorders FAQs on dragOver and notifies the parent` — `dragStart(A)` + `dragOver(B)` → `onChange` ids `[B,A]`, orders `[0,1]`.
- `does not reorder when dragging over the same item` — `dragOver` on the dragged item is a no-op (edge: `draggedIndex === index`).
- `does not reorder on dragOver without a prior dragStart` — `dragOver` with `draggedIndex===null` is a no-op (edge: stale/missing drag).
- `clears the dragged state on dragEnd without notifying the parent` — `dragEnd` resets state and emits no `onChange`.

### localization (`getLocalizedText`)
- `prefers the Japanese text in bilingual mode` — `language='bilingual'` shows `ja` when present.
- `falls back to the English text in bilingual mode when Japanese is empty` — empty `ja` → `en` shown (edge: `obj.ja || obj.en`).
- `renders both language edit fields when expanded in bilingual mode` — bilingual expansion exposes JA + EN question and answer inputs.

## Determinism notes

- `generateId()` uses `Date.now()` + `Math.random()`. No test asserts the exact id
  value; the new-id test only checks the shape via regex `/^faq_\d+_[a-z0-9]+$/`,
  so the run is deterministic without mocking the clock/RNG.
- No network, filesystem, or real-time dependencies. All collaborators are the
  component itself plus a `vi.fn()` `onChange` mock.

## How to run

```bash
corepack pnpm exec vitest run tests/components/reports/ir/faq-manager.test.tsx
```
