# gap-untested-module-2e5e3e3e331a — Unit tests for `project-card.tsx`

**Target:** `src/components/conversion/project-card.tsx`
**Risk class:** C
**Test file:** `tests/components/conversion/project-card.test.tsx`
**Result:** 26 tests, all passing. `pnpm typecheck` 0 errors, ESLint `--max-warnings=0` clean on the new file.

## Component under test

`ProjectCard` is a pure presentational React component (no state, no effects, no async
collaborators). It renders a `<Card>` for one `ConversionProject` and branches on:

- `project.status === 'converting'` → renders a `Math.round(progress)%` label + a shadcn
  `<Progress>` bar driven by `project.progress`.
- `project.statistics` (optional) → renders a 3-cell grid of `mappedAccounts` /
  `totalJournals` / `adjustingEntryCount`.
- It formats `periodStart` / `periodEnd` via `new Date(d).toLocaleDateString('ja-JP')`,
  delegates the status pill to `<StatusBadge>`, and wraps a `詳細を見る` button in a
  `<Link href="/conversion/projects/{id}">`.

Because the component has **no async collaborators**, the task's "error paths /
timeouts / dependency failures" requirement reduces to *graceful handling of optional
and out-of-range data* — the fault modes a pure renderer actually has. Those are covered
below as fail-safe / boundary cases.

## Coverage rationale (branches targeted)

| Branch / behavior | Tests covering it |
|---|---|
| Name → `CardTitle` | `header > renders the project name…` |
| `{targetStandard}への変換` description | `header > renders the conversion description…` (IFRS, USGAAP) |
| `formatDate(start) - formatDate(end)` | `period formatting > renders the period…` |
| Date formatting with inverted period | `period formatting > renders both dates when inverted` |
| Status → `<StatusBadge>` delegation | `status badge delegation` (all 7 statuses) |
| `status === 'converting'` (true) | `progress section > shows the rounded percentage…` |
| `status === 'converting'` (false) | `progress section > does not render the progress section…` |
| `Math.round(progress)` | `rounds progress=%f to %s` (6 boundary values incl. half-up) |
| `<Progress value>` pass-through | `…forwards value to the indicator transform` |
| `project.statistics` present | `statistics section > renders mappedAccounts…` |
| `project.statistics` absent | `statistics section > omits the statistics grid…` |
| `<Link href>` uses `project.id` | `detail link > links to the project detail page…` |

## Assertions added (every `expect`)

### header
1. `getByText('IFRS移行 2026')` is in the document (project name → title).
2. `getByText('IFRSへの変換')` is in the document (targetStandard=IFRS description).
3. `getByText('USGAAPへの変換')` is in the document (targetStandard=USGAAP description).

### period formatting
4. `getByText('`${fmt(start)} - ${fmt(end)}`')` is in the document (ja-JP formatting, both dates joined).
   - Expected values are computed in-test via the **same** `toLocaleDateString('ja-JP')` call so the
     assertion is deterministic regardless of host locale/timezone. Dates use local noon so the
     calendar day never rolls across zones.
5. Inverted period (`start > end`) still renders both dates in order — fail-safe.

### status badge delegation (it.each over all 7 `ConversionStatus` values)
6–12. For each status, the matching Japanese label is present:
   `下書き / マッピング中 / 検証中 / 変換中 / レビュー中 / 完了 / エラー`.
   Confirms `ProjectCard` forwards `project.status` to `<StatusBadge>`.

### progress section (status === 'converting')
13. `getByText('42%')` present.
14. `getByRole('progressbar')` has `aria-valuemin="0"`.
15. `getByRole('progressbar')` has `aria-valuemax="100"`.
16. The indicator element's `style.transform === 'translateX(-58%)'` (value 42 forwarded to the
    indicator transform). **Note:** per the repo's shadcn `Progress`, `value` is forwarded *only* to
    the indicator transform, not to `aria-valuenow` (which stays indeterminate) — so the transform is
    the deterministic signal, not `aria-valuenow`. `ResizeObserver` is stubbed defensively.
17–22. `Math.round` boundaries via `getByText`: `0→'0%'`, `42.4→'42%'`, `42.5→'43%'` (half-up),
    `50→'50%'`, `99.5→'100%'`, `100→'100%'`.
23. For `status='completed'` + `progress=100`: no `^\d+%$` text and no `progressbar` role (false branch).
24. Out-of-range `progress=150`: card renders without crashing and shows `'150%'` — fail-safe (no
    internal clamp/guard; documented current behavior).

### statistics section
25. With statistics: `getByText('150')`, `('1000')`, `('7')`, `('マッピング')`, `('仕訳')`, `('調整')` all present.
26. With `statistics: undefined`: all three labels absent (`queryByText` → null) — optional-block false branch.
27. With all-zero statistics: `getAllByText('0')` has length 3 (boundary — falsy `0` still renders),
    plus the three labels present.

### detail link
28. `getByRole('link', { name: '詳細を見る' })` has `href="/conversion/projects/proj-42"` (uses `project.id`).
29. The detail link with label `詳細を見る` is present.

(29 distinct `expect` calls across 26 `it` blocks; some blocks carry multiple assertions.)

## Determinism notes

- No real network, clock, or randomness: `ProjectCard` has no timers/effects/fetch, and the tests add
  none beyond stubbing `ResizeObserver` (defensive, matches `conversion-progress.test.tsx` convention).
- Date assertions reuse the component's own `toLocaleDateString('ja-JP')` expression and local-noon
  `Date` objects, so they cannot drift with host TZ/locale.
- The one out-of-range case (`progress=150`) intentionally does **not** assert the indicator transform:
  the underlying snippet yields `translateX(--50%)`, an invalid CSS value that browsers/jsdom discard,
  so the only deterministic, observable contract is "does not crash + shows the raw rounded percentage".

## Verification run

```
vitest run tests/components/conversion/project-card.test.tsx   → 26 passed (26)
eslint tests/components/conversion/project-card.test.tsx --max-warnings=0  → 0 problems
tsc --noEmit                                                     → 0 errors
```
