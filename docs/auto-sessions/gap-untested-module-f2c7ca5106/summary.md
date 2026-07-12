# gap-untested-module-f2c7ca5106 — Unit tests for `kpi-page-header.tsx`

**Task:** Add unit tests for `src/components/reports/kpi/kpi-page-header.tsx`
**Risk class:** C
**Detected:** 2026-07-09T02:09:31Z

## Target module

`src/components/reports/kpi/kpi-page-header.tsx` is a pure presentational React
component (`'use client'`) with a single named export, `KPIPageHeader()`. It takes
**no props** and renders a static header chrome:

- A `<header>` (banner landmark) wrapping a max-width container.
- An `<h1>` title: `経営指標ダッシュボード`.
- A `<nav>` (navigation landmark) with four `next/link` entries:
  | Label | href | Styling |
  |-------|------|---------|
  | 月次レポート | `/reports/monthly` | inactive (`text-gray-500 hover:text-gray-700`) |
  | 資金繰り表 | `/reports/cashflow` | inactive |
  | 予実管理 | `/reports/budget` | inactive |
  | 経営指標 | `/reports/kpi` | **active/current** (`text-primary-600 font-medium`) |

Because the module is a prop-less view component with no logic branches, the
notions of "happy path / edge / error path / fail-safe" map to: structural
correctness, link-target correctness, active-state correctness, render
determinism, and the public-API contract. There are no inputs to invalidate
and no external collaborators beyond `next/link`, which is mocked.

## Test file

`tests/components/reports/kpi/kpi-page-header.test.tsx` (new).

Framework: Vitest + @testing-library/react + @testing-library/jest-dom, matching
the sibling `kpi-cards` / `kpi-filters` / `kpi-table` tests and the repo-wide
`next/link` mock pattern from `tests/components/layout/sidebar.test.tsx` (the
mock renders `next/link` as a plain `<a href>` so `href`/role queries are
deterministic under jsdom). No new test dependencies were introduced.

## Assertions added (12 tests, all passing)

| # | Test | Assertion(s) | Coverage rationale |
|---|------|--------------|--------------------|
| 1 | renders without throwing and exposes a header (banner) landmark | `container.firstChild` non-null; `getByRole('banner')` present | Happy-path: component mounts; `<header>` maps to the ARIA `banner` landmark |
| 2 | renders the dashboard title as a level-1 heading | `getByRole('heading', { level: 1, name: '経営指標ダッシュボード' })` | Title text + document outline (`h1`) |
| 3 | renders a navigation landmark | `getByRole('navigation')` present | `<nav>` maps to the ARIA `navigation` landmark |
| 4 | renders exactly four navigation links | `getAllByRole('link')` length === 4 | Boundary: link count is exactly the four declared targets (no more, no fewer) |
| 5–8 | table-driven per link (`it.each`) | for each of the four links: `getByRole('link', { name: label })` exists and `toHaveAttribute('href', href)` | Happy-path correctness: each label resolves to a single link with the exact declared href (`/reports/monthly`, `/reports/cashflow`, `/reports/budget`, `/reports/kpi`) |
| 9 | renders the nav links in the documented order | link `textContent` array === `['月次レポート','資金繰り表','予実管理','経営指標']` | Order is part of the component contract (source order = DOM order) |
| 10 | marks only the current (KPI) link as active and the rest as inactive | active link has classes `text-primary-600 font-medium` and NOT `text-gray-500`; each of the other three has `text-gray-500 hover:text-gray-700` and NOT `text-primary-600` | The only behavioral signal in the component — the "current page" highlight is applied to `経営指標` only; guards against a regression that flips or duplicates the active class |
| 11 | renders an identical, prop-free structure on every render (deterministic, fail-safe default chrome) | two independent renders produce byte-identical `container.innerHTML`; title text and all four links still present after a fresh mount | **Determinism + fail-safe:** with no props/inputs the component always degrades to the same safe default chrome — the title and all four navigation targets are unconditionally reachable. No clock/random/network involved |
| 12 | exports `KPIPageHeader` as a named React function component that returns a single element | `typeof` === `'function'`; `.name` === `'KPIPageHeader'`; `React.isValidElement(KPIPageHeader())` is true | Public-API surface: the named export exists, is callable, and returns a single valid React element (not `undefined`/array) |

### Notes on requirement mapping

- **Happy path:** tests 1–9 cover the normal render and each public entry point
  (the `KPIPageHeader` function and the structure it produces).
- **Edge / boundary:** test 4 (exactly 4 links), test 9 (exact order), test 10
  (exactly one active link — boundary on the active-class assignment).
- **Error paths / dependency failures:** the module has no runtime inputs and no
  error branches; its only external collaborator is `next/link`, which is mocked
  (test 12 verifies the function is always callable and returns a valid element).
- **Fail-safe behavior:** test 11 — no props ⇒ stable default chrome, title and
  all navigation targets always reachable.

## Quality gate (run in worktree)

- `corepack pnpm install --frozen-lockfile` — clean install (worktree started bare).
- `corepack pnpm db:generate` — Prisma client generated (avoids phantom TS errors).
- `corepack pnpm exec vitest run tests/components/reports/kpi/kpi-page-header.test.tsx` — **12/12 pass**.
- `corepack pnpm exec vitest run tests/components/reports/kpi/` — **38/38 pass** (5 files; no sibling regressions).
- `corepack pnpm exec eslint <test file> --max-warnings=0` — **0 warnings**.
- `corepack pnpm exec prettier --check <test file>` — **clean** (after `--write`).
- `corepack pnpm exec tsc --noEmit` — **0 errors** (whole repo).

## Files changed

- **added** `tests/components/reports/kpi/kpi-page-header.test.tsx`
- **added** `docs/auto-sessions/gap-untested-module-f2c7ca5106/summary.md` (this file)

No production source was modified.
