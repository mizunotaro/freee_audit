# gap-untested-module-6bba3561cd — unit tests for `disclosure-editor.tsx`

**Target:** `src/components/conversion/disclosure-editor.tsx`
**New test file:** `tests/components/conversion/disclosure-editor.test.tsx`
**Risk class:** C (previously untested module, no `tests/` entry)
**Result:** 42 tests, all passing. `tsc --noEmit` 0 errors, `eslint --max-warnings=0` clean, `prettier --check` clean.

---

## What is under test

`disclosure-editor.tsx` exports two React components and keeps one module-private helper:

| Export / symbol | Kind | Covered |
|---|---|---|
| `DisclosureEditor` | component | yes |
| `DisclosureList` | component | yes |
| `markdownToHtml` | module-private function | yes (exercised transitively via the preview tab, the only caller) |

`projectId` is accepted but unused (`_projectId`); it is passed through the prop factory in every test to confirm the prop shape is accepted without effect.

---

## Coverage rationale

The component is a stateful form/viewer (edit toggle, dual-language content, async
save/enhance/export/review callbacks with loading spinners, conditional badges and
sections). Tests are grouped by surface area and follow the gap-analysis brief:
happy-path, edge (empty/absent data), error (callback rejection) and fail-safe
(handlers must reset their busy-state on rejection).

### Test environment decisions (non-obvious)

- **`ResizeObserver` stub.** The component mounts Radix `<ScrollArea/>`, which calls
  `ResizeObserver` at mount; `tests/setup.ts` only polyfills `IntersectionObserver`.
  A per-file `vi.stubGlobal('ResizeObserver', …)` is added in `beforeAll` (matches the
  recipe in memory `component-test-env-gotchas`).
- **Radix `Tabs` activation.** The installed `@radix-ui/react-tabs` switches tabs from an
  `onMouseDown` handler (`button === 0 && !ctrlKey`), so a plain `fireEvent.click()` does
  **not** switch tabs. A small `activateTab()` helper drives `mouseDown` + `click`.
- **Leaky async handlers.** `handleEnhance` / `handleSave` / `handleExport` wrap their
  awaited callback in `try/finally` with **no catch**, so a rejecting callback surfaces as
  an *unhandled* rejection that crashes the vitest worker (exit 1). `handleReview` has no
  guard at all. Each rejection-path test attaches a scoped `process.on('unhandledRejection')`
  swallower and detaches it in `finally` (the established pattern from
  `tests/components/export/export-button.test.tsx`).
- **Typed callback mocks** use the inferred `vi.fn<(args) => R>()` form so they stay
  assignable to the typed callback props (a bare `ReturnType<typeof vi.fn>` widens to
  `Mock<Procedure>` and fails the typecheck gate — memory `component-test-env-gotchas`).

---

## Assertions added (per test)

### `DisclosureEditor — rendering`
1. **renders the disclosure title in the header** — `getByText('減価償却の開示')` present.
2. **AI強化済 badge shown when `isAiEnhanced`** — `getByText('AI強化済')` present.
3. **AI強化済 badge hidden when not enhanced** — `queryByText('AI強化済')` null.
4. **レビュー済 badge shown when `reviewedAt` set** — `getByText('レビュー済')` present.
5. **レビュー済 badge hidden when `reviewedAt` absent** — `queryByText('レビュー済')` null.

### `DisclosureEditor — content tabs`
6. **japanese content rendered in default tab** — `getByText('日本語の内容です')`.
7. **ja empty placeholder when `content === ''`** — `getByText('内容がありません')`.
8. **english content mounts only after selecting English tab** — absent before
   `activateTab('English')`, present after (confirms Radix unmounts inactive content).
9. **en placeholder when `contentEn` undefined** — `getByText('No English content available')`.

### `DisclosureEditor — preview tab (markdownToHtml)`
10. **markdown → html conversion** — preview `innerHTML` contains `<h1>H1</h1>`,
    `<h2>H2</h2>`, `<h3>H3</h3>`, `<strong>b</strong>`, `<em>i</em>`, `<li>ul</li>`,
    `<li>ol</li>`, `<br>` (covers all 8 transforms: h3/h2/h1, bold, italic, ul, ol, newline).
11. **non-markdown text left untouched** — plain text preserved, no `<h1>` injected.

### `DisclosureEditor — standard references & rationale`
12. **standard references section rendered when present** — header `参照会計基準` +
    badge `IFRS 1 … 初次適用`.
13. **standard references section hidden when empty** — `queryByText('参照会計基準')` null.
14. **related rationale section rendered when ids present** — header `関連する変換根拠` +
    `3件の変換根拠が紐付けられています`.
15. **related rationale section hidden when empty** — `queryByText('関連する変換根拠')` null.

### `DisclosureEditor — timestamps`
16. **生成日時 label always rendered** — `getByText(/生成日時/)`.
17. **レビュー日時 label rendered when `reviewedAt` set** — `getByText(/レビュー日時/)`.
18. **レビュー日時 label omitted when `reviewedAt` absent** — `queryByText(/レビュー日時/)` null.

### `DisclosureEditor — AI強化`
19. **`onEnhance` called on click** — `onEnhance` invoked once.
20. **AI強化 disabled while editing** — `disabled={enhancing || editing}` → disabled after 編集.

### `DisclosureEditor — review button`
21. **review button shown when `onReview` provided and not reviewed** — present.
22. **review button hidden when already reviewed** (`reviewedAt` set) — null.
23. **review button hidden when `onReview` not provided** — null.
24. **`onReview` called on click** — `onReview` invoked once.

### `DisclosureEditor — editing flow`
25. **edit mode shows textarea + save/cancel, hides 編集** — `textbox` + 保存 + キャンセル present, 編集 gone; textarea seeded with current content.
26. **save merges edited ja content** — `onSave` called once with
    `objectContaining({ id, content: '編集後の内容', contentEn: 'orig en' })`.
27. **save merges edited en content (after switching to English tab in edit mode)** —
    `onSave` called with `objectContaining({ contentEn: 'edited en' })`.
28. **view mode restored after successful save** — 編集 back, 保存 gone.
29. **cancel resets content and exits editing** — textbox gone, 編集 back, original content
    shown, `onSave` not called.

### `DisclosureEditor — export`
30. **`onExport('word')` on Word click** — called with `'word'`.
31. **`onExport('pdf')` on PDF click** — called with `'pdf'`.
32. **both export buttons disabled while exporting, re-enabled after** — Word + PDF disabled
    mid-flight (deferred `onExport`), both enabled after resolution (covers the
    `exporting !== null` mutual-disable + `try/finally` reset).

### `DisclosureEditor — fail-safe (handlers reset state on rejection)`
33. **`onEnhance` rejection re-enables AI強化** — `enhancing` reset in `finally`, button enabled; rejection swallowed.
34. **`onSave` rejection re-enables save and stays in edit mode** — `saving` reset, `setEditing(false)` never reached so 保存 stays visible; rejection swallowed.
35. **`onExport` rejection re-enables export buttons** — `exporting` reset to `null`; rejection swallowed.
36. **`onReview` rejection does not crash the worker** — `handleReview` has no guard, rejection propagates unhandled and is caught by the scoped swallower (`swallow` called).

### `DisclosureList`
37. **empty state** — `getByText('開示文書がありません')`.
38. **one button per disclosure with title** — both titles present, `getAllByRole('button')` length 2.
39. **`onSelect` receives the clicked disclosure** — called once with
    `objectContaining({ id: 'd1', title: '開示A' })`.
40. **selected item highlighted, others default** — selected button `toHaveClass('border-primary')`, unselected `not.toHaveClass('border-primary')`.
41. **per-item AI + reviewed badges** — `getByText('AI')` and `getByText('済')`.
42. **truncated content preview** — `getByText(/これは開示Aの内容です。\.\.\./)`.

---

## Verification commands run

```bash
corepack pnpm install --frozen-lockfile          # worktree started with no node_modules
corepack pnpm db:generate                         # avoids phantom TS7006 errors
corepack pnpm exec vitest run tests/components/conversion/disclosure-editor.test.tsx   # 42 passed
corepack pnpm exec tsc --noEmit                   # 0 errors
corepack pnpm exec eslint tests/components/conversion/disclosure-editor.test.tsx --max-warnings=0   # clean
corepack pnpm exec prettier --check tests/components/conversion/disclosure-editor.test.tsx          # clean
```
