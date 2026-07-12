# gap-untested-module-3e25901d9c — Unit tests for `ir-report-editor.tsx`

**Target:** `src/components/reports/ir/ir-report-editor.tsx`
**Test file:** `tests/components/reports/ir/ir-report-editor.test.tsx`
**Result:** 25 tests, all passing. `eslint --max-warnings=0`, `tsc --noEmit`, and the vitest run are all green.

## Approach

`IRReportEditor` is a stateful container that orchestrates three leaf collaborators
(`LanguageToggle`, `IRSectionEditor`, `IRPreview`) plus its own handlers
(`handleLanguageToggle`, `handleSectionUpdate`, `scheduleAutoSave`, `handleSave`,
`handlePublish`) and the `STATUS_CONFIG` / `DEFAULT_SECTIONS` module constants.

The three leaf components are unit-tested in their own files, so they are stubbed
with thin pass-through mocks. This isolates the editor's own wiring and lets the
collaborator callbacks (`onUpdate`, `onChange`) be driven deterministically — which
is essential for the autosave/timer and error/fail-safe cases. The editor itself,
the Radix `Tabs`/`ScrollArea`, and all `@/components/ui` chrome render for real.

Environment notes:
- Radix `ScrollArea` instantiates a `ResizeObserver` at mount and `tests/setup.ts`
  only polyfills `IntersectionObserver`, so `ResizeObserver` is stubbed per-file in
  `beforeAll` (same pattern as `disclosure-editor.test.tsx`).
- Interactions use `@testing-library/user-event`; the icon-only back button is
  located via its `lucide-arrow-left` svg (no accessible name).
- Autosave tests use `vi.useFakeTimers()` + `fireEvent` in an isolated `describe`
  (real timers elsewhere) so the 3000 ms debounce is deterministic.

## Assertions added (25 tests)

### Rendering (3)
1. Renders the report title (`<h1>` = `report.title.ja`), fiscal year, and the
   `draft` status badge label `下書き`.
2. Renders an `ArrowLeft` back button when `onBack` is supplied (and fires it once
   on click); omits the svg entirely when `onBack` is absent.
3. Exposes the three Radix tabs by role/name: `日本語`, `English`, `プレビュー`.

### STATUS_CONFIG coverage (5 — one per status)
4-8. For each `ReportStatus` (`draft`/`in_review`/`approved`/`published`/`archived`)
   the correct Japanese badge label is rendered — full branch coverage of
   `STATUS_CONFIG`.

### Sections (3)
9. Empty `report.sections` falls back to `DEFAULT_SECTIONS` → exactly 10 section
   editors render, with ids `section_0`…`section_9` assigned.
10. Provided sections render verbatim (1 editor for 1 section) and no default
    `section_0` editor leaks in.
11. Each editor receives `language="ja"` (active tab), `reportId`, and the
    `readOnly` flag.

### Language toggle (2)
12. `LanguageToggle` receives `value=report.language` and selecting a language
    forwards through `handleLanguageToggle` → `onLanguageChange('en')`.
13. `readOnly` disables the toggle.

### Save (3 — happy / loading / fail-safe)
14. Clicking `保存` calls `onSave` once with the current report and surfaces the
    `最終保存:` timestamp on success.
15. While `onSave` is pending the button reads `保存中...` and is disabled; it
    restores to `保存` (enabled) after the promise resolves (deferred-controlled).
16. When `onSave` rejects, `handleSave` logs `console.error('Save failed:', ...)`,
    does not rethrow, and re-enables the button (fail-safe degradation).

### Publish (3 — visibility / happy / fail-safe)
17. The `公開` button appears only for `status === 'approved'` and `!readOnly`.
    (Uses fresh mounts because the editor snapshots `report` into `useState` on
    mount, so a prop re-render does not change status-derived output.)
18. Clicking `公開` calls `onPublish` once with the current report.
19. When `onPublish` rejects, `handlePublish` logs
    `console.error('Publish failed:', ...)` and swallows the error (fail-safe).

### Section update (1)
20. An `onUpdate` from a section editor flips `hasUnsavedChanges`, surfacing the
    `未保存` indicator.

### Preview (2)
21. The header `プレビュー` button sets `activeTab='preview'` and mounts `IRPreview`
    with the current report.
22. When `report.language === 'bilingual'`, the preview receives `language="ja"`
    (the `report.language === 'bilingual' ? 'ja' : report.language` ternary).

### Read-only mode (1)
23. `readOnly` hides the `保存` / header `プレビュー` / `公開` actions while the
    section editors still render (read-only editing surface preserved).

### Autosave (2 — fail-safe + debounce; fake timers)
24. **Fail-safe cleanup:** after an edit schedules the 3000 ms timer, unmounting
    clears it — `onSave` is never called even after advancing the clock well past
    the window (the `useEffect` cleanup clears `saveTimeoutRef.current`).
25. **Debounce:** two successive edits schedule a single debounced autosave; `onSave`
    is not called at 2999 ms but fires exactly once at 3000 ms with the current
    report.

## Notable behaviors surfaced

- **State snapshot of `report`:** `const [report] = useState(initialReport)` means
  the editor does not react to a parent re-rendering with a changed `report` prop.
  Status-derived UI (e.g. the publish button) must therefore be tested with fresh
  mounts, not `rerender`. (Prop-driven UI such as the back button does react to
  `rerender`.)
- **Autosave closure:** `scheduleAutoSave` captures the `handleSave` of the render
  in which the edit occurred; that closure reads a possibly-stale
  `hasUnsavedChanges`. The debounce test uses two successive edits so the captured
  closure observes `hasUnsavedChanges === true` — this is robust whether or not the
  closure is later refactored.
