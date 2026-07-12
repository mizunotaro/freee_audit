# Gap: unit tests for `src/components/layout/AppLayout.tsx`

**Task ID:** gap-untested-module-dc3b1380fd
**Risk class:** C
**Target:** `src/components/layout/AppLayout.tsx` (single public export: `AppLayout` component)
**Date:** 2026-07-12

## Starting point

The gap analysis (generated 2026-07-09) reported the module as untested, but a
partial test file already existed — added by prior auto-commit
`e67bc75 auto(C): Unit-test coverage: components/settings + components/layout`.
The gap scan is stale (source `AppLayout.tsx` vs. test `app-layout.test.tsx`
stem mismatch — see memory `autopm-verify-stem-gap`).

The pre-existing file had 4 tests (brand+children, conditional title, nav
appears in both bars, exact-match active link). It left several public behaviors
of the component unverified, so the file was extended rather than duplicated.

## What was added

Seven new tests appended to `tests/components/layout/app-layout.test.tsx`
(11 total). The hoisted `pathnameMock` was retyped to `() => string | null` to
match `next/navigation`'s real `usePathname` signature and to legitimise the
null-pathname fail-safe case.

### Assertions added

1. **Brand home link href** — `getByRole('link', { name: /freee監査システム/ })`
   `toHaveAttribute('href', '/')`. The prior test only checked the brand text,
   not that the link targets the root.
2. **Full nav set renders in both bars** — every one of the 13 nav labels
   (`月次レポート` … `設定`) returns exactly 2 matches (`getAllByText(label)`
   `toHaveLength(2)`). Regression guard: catches a removed/mislabelled nav item
   that the prior 3-label spot check would miss.
3. **Header settings gear** — links with `href="/settings"` total 3 (two `設定`
   nav entries + one icon-only gear); `some(link.classList.contains('rounded-full'))`
   confirms the gear is a distinct, separately-styled interactive element.
4. **No-match pathname → no active (fail-safe)** — pathname `/nonexistent` leaves
   zero links carrying `bg-primary-100` (`toHaveLength(0)`). The component
   degrades to "nothing highlighted" rather than erroring.
5. **Exact-match boundary** — pathname `/reports/monthly/2024` does **not**
   activate the `/reports/monthly` entry (the component uses `pathname === item.href`,
   not a prefix/startsWith match). `not.toHaveClass('bg-primary-100')` on both
   `月次レポート` links.
6. **Null pathname (dependency failure / fail-safe)** — `usePathname()` returning
   `null` does not crash: brand text still renders, and zero links are marked
   active. Verifies the component tolerates an unresolvable router context.
7. **Falsy-title boundary** — `title=""` renders no separator segment
   (`queryByText(/\/\s/)` is null), exercising the `title &&` short-circuit.

## Coverage rationale

`AppLayout` is a pure presentational client component. Its only collaborator is
`next/navigation`'s `usePathname()` (mocked via `vi.hoisted`). There is no async
I/O, no network, no clock, and no randomness, so "error paths / timeouts" map
to **input-boundary and dependency-failure** cases rather than I/O failures:

- **Happy path** — brand+children (#existing), title present (#existing), nav
  renders (#existing + new #2 full count), active link (#existing + new #1 href).
- **Edge / boundary** — exact-vs-prefix match (#5), empty-string title (#7),
  full 13-item nav enumeration (#2), three-element `/settings` link set (#3).
- **Fail-safe / dependency failure** — non-matching pathname highlights nothing
  (#4); `usePathname` returning `null` does not crash and highlights nothing (#6).

`navItems` is module-private (not exported), so it is covered behaviourally via
the full-label enumeration (#2) rather than by direct import.

## Quality gate

- `vitest run tests/components/layout/app-layout.test.tsx` → **11/11 passed**
- `eslint --max-warnings=0` on the touched file → **exit 0**
- `tsc --noEmit` (whole repo, after `pnpm db:generate`) → **0 errors**

## Files changed

- `tests/components/layout/app-layout.test.tsx` — +7 tests, mock retyped
- `docs/auto-sessions/gap-untested-module-dc3b1380fd/summary.md` — this file
