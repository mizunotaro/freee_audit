# gap-untested-module-8b2946bce2 — unit tests for `src/components/conversion/project-wizard.tsx`

**Risk class:** C · **Target:** `src/components/conversion/project-wizard.tsx` (a 5-step
React wizard for creating an accounting-standard conversion project) · **Detected:** 2026-07-09

## Deliverable

- **New test file:** `tests/components/conversion/project-wizard.test.tsx` — 47 tests, all passing.
- **No production code changed.** The component is exercised purely through its public surface
  (props + rendered DOM + the `fetch`/`router` collaborators).

## Approach / coverage rationale

The wizard is a `'use client'` component whose only collaborators are `next/navigation`'s
`useRouter` (for the post-create redirect) and `fetch` (for `POST /api/conversion/projects`).
Its logic is: per-step validation gates (`canProceed`), forward/back navigation with boundary
handling, form-state accumulation, COA filtering by selected standard, option switches, a
confirm summary, and an async submit with success / API-error / network-error / loading paths.

There are no exported functions beyond the component itself, so coverage is achieved by driving
the rendered component. Two Radix-based shadcn primitives (`Select`, `Switch`) do not behave in
jsdom (portals / pointer capture), so — following the established repo idiom
(`mapping-filters.test.tsx`, `ProposalActions.test.tsx`) — they are replaced with native
equivalents (`<select>`, `<input type=checkbox role=switch>`) that keep the component's own
`value→onValueChange` / `checked→onCheckedChange` wiring live and drivable. `Card`, `Button`,
`Input`, `Label`, `Textarea`, `ConversionStepper` are plain DOM and need no mock. `useRouter`
is mocked with a hoisted `pushMock` so the redirect target is assertable; `fetch` is
`vi.stubGlobal`'d per test. No real network/clock/random is used; all timing is synchronous
state plus explicit `act` flushes for the async submit.

## Assertion inventory (by group)

**Initial render & structure (4)**
- Stepper renders all five step labels (`基本情報`/`期間設定`/`ターゲット設定`/`オプション`/`確認`).
- Starts on "ステップ 1 / 5".
- Step-0 renders the name + description inputs.
- `companyId` prop is reserved (not rendered into the DOM).

**Step 0 — name gate (4)**
- Next disabled when name empty; disabled when whitespace-only (`canProceed` uses `trim()`).
- Next enabled once a non-empty name is entered.
- Entered name survives a forward-then-back navigation (state persistence).

**Step 1 — period gate (5)**
- Next disabled while both dates empty; disabled with only start set.
- Next disabled + ordering-error paragraph shown when `periodStart >= periodEnd`.
- Error paragraph hidden and Next enabled once `start < end`.
- Boundary: `start` immediately before `end` is accepted.

**Step 2 — standard + COA gate (7)**
- COA select `disabled` and shows "先に会計基準を選択" until a standard is chosen.
- Next disabled while standard unselected; still disabled after standard-only (COA missing).
- COA options filtered by the selected standard (IFRS hides US-GAAP charts).
- Next enabled once both standard and COA chosen.
- Changing the standard resets the COA selection (component resets `targetCoaId`).
- Empty-COA hint hidden when the standard has matching charts.
- Placeholder swaps to "選択してください" after a standard is selected.

**Step 2 — COA list edge cases (2, isolated describe to avoid double-render)**
- "選択した基準の勘定科目表がありません…" hint shown for a standard with zero matching charts.
- Empty `chartOfAccounts` list renders gracefully (COA select holds only the placeholder option).

**Step 3 — option switches (3)**
- All four switches render and default to enabled (true).
- A toggled switch is reflected in the confirm summary (`有効`/`無効`).
- Toggling all four off yields four `無効` rows; Next stays enabled (options step is always valid).

**Navigation boundaries (4)**
- Back disabled on step 0.
- No "次へ" button on the confirm step; "作成" present instead (last-step boundary).
- Back from confirm → options → forward again works.
- Card title / step counter update as the user advances.

**Confirm summary (3)**
- Mirrors entered name, standard, period, description.
- Dash fallback (`-`) when no description entered.
- No error box rendered when there is no error.

**Submit / create (8)**
- POSTs the assembled `CreateConversionProjectRequest` body (name, targetStandard, targetCoaId,
  periodStart/End, settings with all four flags) to `/api/conversion/projects`, then
  `router.push('/conversion/projects/<id>')`.
- `description` omitted from the body when blank (component sends `undefined`).
- Redirect target matches the API-returned `data.data.id`.
- Spinner shown + create/back buttons disabled while in-flight; loading cleared after resolution.
- Non-ok response surfaces the API `error` message and does **not** redirect; button re-enabled.
- Non-ok response with no `error` field falls back to "Failed to create project".
- Network rejection (`fetch` rejects) → safe error from `err.message`, no redirect, button re-enabled.
- Non-`Error` rejection → generic "Unknown error" fallback; no redirect.
- Single create click → exactly one `fetch` call.

**Fail-safe (5)**
- Renders without throwing for an empty `chartOfAccounts`.
- Renders without throwing when `companyId` is empty.
- No `fetch` call on mount.
- `router.push` never called before a successful submit.
- After the loading state flushes, the button is disabled and a further click does not fire a
  second submit (no duplicate POST).

## Quality gate

- `pnpm exec vitest run tests/components/conversion/project-wizard.test.tsx` → **47 passed**.
- `pnpm exec eslint --max-warnings=0 <test file>` → **0 errors / 0 warnings**.
- `pnpm exec tsc --noEmit` → **exit 0**.

## Notes / non-findings

- `companyId` is accepted as a prop but unused (`_companyId`); asserted it is not rendered. No
  behavioural defect to flag.
- The submit handler reads `res.json()` exactly once per code path (success vs failure), so a
  single-shot mock `json` is sufficient.
- No new test dependencies were added; only `vitest`, `@testing-library/react`, and React were used.
