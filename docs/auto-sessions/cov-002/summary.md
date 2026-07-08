# COV-002 — Unit-test coverage for shared/common components

## Scope reality
COV-002 is scoped to `src/components/{shared,common}/`, but **neither directory
exists in the repo** — `CLAUDE.md` §3's category list is stale. The genuine
shared/reusable presentational layer is `src/components/layout/`
(`AppLayout.tsx`, `bottom-navigation.tsx`, `dock-sidebar.tsx`, `sidebar.tsx`).
`src/components/ui/` holds the 44 shadcn primitives, which are excluded from
coverage in `vitest.config.ts`. The scope was mapped to `layout/` accordingly
(documented fact, see memory `component-shared-common-does-not-exist`).

## Prior state (already on `master`)
The bulk of this task was completed in the earlier `cov-comp-04` run
(commit `e67bc75`, merged to `master`), which added render + interaction tests
for all four `layout/` components under `tests/components/layout/`. Those tests
are honest (render the **real** components, assert on actual DOM output, use
correct Testing Library queries — `getAllByText`/`getAllByRole` with length
assertions where multiple matches are legitimate) and pass 15/15. This branch
is a re-run off `master` with no COV-002-specific commits before this one.

## What this run added (2 genuine gaps left by the prior run)
Coverage of the four files before this run was strong but asymmetric —
`dock-sidebar` had an active-link test and a hover-collapse test, while
`sidebar` had neither its active-link branch nor the dock's re-expand path
exercised:

| File | Tests before → after | Branch % before → after | Gap closed |
|---|---|---|---|
| `sidebar.tsx` | 3 → 4 | 70 → 80 | active-link styling (`pathname.startsWith(href)` → `bg-primary`) was untested — `dock-sidebar` had this, `sidebar` did not. |
| `dock-sidebar.tsx` | 5 → 6 | 88.2 → 91.2 | re-entering the sidebar while a collapse timer is pending cancels it (`clearTimeout` + `null` clear, lines 90–91) — a real interaction branch untested by the prior hover test. |

Both new tests are additive (one new `it` each), mirror the existing test
style in the same file, use only already-imported helpers, and assert on real
DOM output (class presence/absence, fake-timer-driven collapse).

`AppLayout.tsx` and `bottom-navigation.tsx` were already at **100%** statement /
branch / function / line coverage — untouched.

## Left intentionally uncovered (with rationale)
- **`handleLogout` in `sidebar.tsx` (line 87) and `dock-sidebar.tsx` (line 112)**:
  both assign `window.location.href = /${locale}/login`. Reliably asserting a
  `window.location` navigation in jsdom is environment-dependent and the
  logout handler sits behind a Radix open-menu interaction (Sidebar's Sheet is
  stubbed as a container boundary; DockSidebar's DropdownMenu content mounts
  only when opened). Low value vs. flake risk — matches the stance the prior
  `cov-comp-04` summary took. Not forced.

## Constraints honored
- No `any` / `@ts-ignore` / `@ts-expect-error` / `.skip` / lint-disable /
  coverage-threshold changes. No Class-A paths touched (only 2 test files,
  additive). No new dependencies. No thrown exceptions / Zod needed (pure RTL
  component tests). No fake green — new cases assert real behavior on the real
  component.

## Verification
`node scripts/autopm_verify.mjs --changed-only` → **exitCode 0**
(typecheck 0 errors, eslint `--max-warnings=0` clean on both files, vitest 10/10
on the changed files; full layout suite 17/17).

```
Tests: 15 → 17 across the four layout test files.
Coverage (layout/ only):
  AppLayout.tsx        100 / 100 / 100 / 100   (unchanged)
  bottom-navigation.tsx 100 / 100 / 100 / 100   (unchanged)
  dock-sidebar.tsx      94.3 / 91.2 / 90 / 97.0  (was 88.6 / 88.2 / 90 / 90.9)
  sidebar.tsx           95.2 / 80   / 85.7 / 95  (was 95.2 / 70 / 85.7 / 95)
```
