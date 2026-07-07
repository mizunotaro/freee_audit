# COV-002 — Unit-test coverage for shared/common components

## Outcome: DONE (with a documented scope mapping — read this)

### Scope mapping (important deviation from the literal task text)

The task scope named `src/components/{shared,common}/`. **Those directories do not
exist in this repository** (verified against the current `master` worktree):
`src/components/` contains `budget, charts, chat, conversion, currency, export,
import, journal-proposal, layout, reports, settings, ui, valuation` — there is no
`shared/` and no `common/`. This is a drift between `CLAUDE.md` §3 (which lists
`shared/` and `common/` as component categories) and the actual code.

Rather than force a literal match that is impossible, the scope was mapped to the
**genuine shared/reusable cross-app presentational layer that does exist**:
`src/components/layout/`. These four files are exactly the kind of component the
task targets — app-wide, reused, presentational navigation/layout shells with no
business/service coupling:

| Component | Role |
|-----------|------|
| `AppLayout.tsx` | Top-level page shell: brand, desktop + mobile nav, active-route highlighting |
| `bottom-navigation.tsx` | Mobile bottom tab bar (locale-prefixed links, active prefix match) |
| `sidebar.tsx` | Mobile header + slide-out Sheet nav with role-gated items and user menu |
| `dock-sidebar.tsx` | Desktop collapsible dock nav with hover expand/collapse and role-gated items |

`src/components/ui/` (44 shadcn/ui primitives) was intentionally **not** targeted:
those are third-party-style library components (also explicitly excluded from the
coverage config in `vitest.config.ts`) and would not deliver meaningful,
component-authored coverage within the "up to 8" budget.

If a literal `shared/`/`common/` directory is ever introduced, additional test
files should be added under the matching path.

### What was added (test-only, additive — no source files modified)

Four new test files, **22 tests, all passing**:

| File | Tests | Highlights |
|------|-------|-----------|
| `tests/components/layout/app-layout.test.tsx` | 7 | brand text, children, title toggle, total link count (`getAllByRole('link')` = 28), desktop+mobile duplicate labels (`getAllByText` = 2), exact-match active class |
| `tests/components/layout/bottom-navigation.test.tsx` | 5 | exactly 5 links, locale-prefixed hrefs, per-item labels, `en` locale variant, prefix-match active class |
| `tests/components/layout/dock-sidebar.test.tsx` | 6 | collapsed brand marker, role-gated nav counts (admin 18 vs viewer 17 links), avatar initials, `mouseEnter` expand, `mouseLeave`+fake-timer collapse |
| `tests/components/layout/sidebar.test.tsx` | 4 | closed-state (brand×1, button×1), Sheet open via `fireEvent.click` then assert nav labels + user info, role-gated item present (admin) / absent (viewer) |

Testing-library usage follows the task's requirement: `getAllByRole('link')` /
`getAllByText(...)` with `.toHaveLength(n)` count assertions wherever multiple
legitimate matches exist (the nav lists), and role-gating is verified by asserting
the *count difference* between VIEWER and ACCOUNTANT.

### Conventions followed

- Per-file `vi.mock('next/navigation', …)` (mutable pathname via `vi.hoisted`)
  and `vi.mock('next-intl', …)` → `(key) => key`, mirroring the established
  pattern in `tests/unit/app/[locale]/(authenticated)/**` (these override the
  global `tests/setup.ts` mocks for the file).
- Radix Sheet open driven with `fireEvent.click` + `waitFor`, matching the proven
  pattern in `tests/components/reports/ir/language-toggle.test.tsx`. The
  `DialogContent requires a DialogTitle` lines on stderr are **Radix dev
  accessibility warnings inherent to the component** (it ships without a
  `DialogTitle`), not test failures and not introduced by this change.
- No `any`, `@ts-ignore`, `@ts-expect-error`, `.skip`, lint-disable comments,
  TODO/FIXME, or coverage-threshold changes. No new dependencies. No new helper
  functions (so no `Result<T,E>`/Zod surface was required). No source files were
  modified — purely additive tests.

### Definition of done

```
node scripts/autopm_verify.mjs --changed-only  →  exitCode: 0
```

- typecheck: 298 pre-existing repo errors, **0 relevant to this diff** → ok
- eslint `--max-warnings=0` on the 4 new files → ok (exit 0)
- vitest on the 4 resolved test files → **22 passed** → ok

(Pre-existing whole-repo typecheck errors are unrelated and outside the diff-scoped
gate, per LESSON 5/27/36.)
