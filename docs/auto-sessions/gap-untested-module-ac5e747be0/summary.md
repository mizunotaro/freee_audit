# gap-untested-module-ac5e747be0 — ProposalList.tsx unit tests

**Target file:** `src/app/[locale]/(authenticated)/journal-proposal/components/ProposalList.tsx`
**Test file:** `tests/unit/app/[locale]/(authenticated)/journal-proposal/components/ProposalList.test.tsx`
**Risk class:** C (presentational React component, no I/O)
**Result:** 29 tests, all passing. `tsc --noEmit` clean, ESLint `--max-warnings=0` clean.

## Why the placement differs from the generator hint

The task generator suggested `tests/app/[locale]/...`, but the established repo
convention (and the sibling `FallbackInput.test.tsx`) lives under
`tests/unit/app/[locale]/...`. The test follows that convention so it sits next
to the only other component test in the same directory and is matched by
`vitest.config.ts`'s `include` (`tests/**/*.test.tsx`).

## Test approach

`ProposalList` is a presentational client component whose only collaborator is
`next-intl`'s `useTranslations`, plus two Radix `<Select>` controls that don't
behave under jsdom (pointer-capture portals). Two mocks mirror the pattern
already proven by `FallbackInput.test.tsx`:

1. `vi.mock('next-intl', ...)` — returns the translation key verbatim, so
   assertions can target stable strings (`'title'`, `'noResults'`,
   `'pagination.showing'`, etc.) instead of locale data.
2. `vi.mock('@/components/ui/select', ...)` — replaces Radix primitives with
   real native `<select>`s built from each Select's own `<SelectItem>` values.
   `ProposalList` renders **two** selects (status filter + sort), so they are
   tagged apart by inspecting the collected option values: sort values always
   embed a `-` (`date-desc`), status values never do. This keeps the
   `value -> onValueChange` wiring live and drivable, instead of a blind
   pass-through that would hide the filter/sort logic.

All remaining collaborators (`Card`, `Table`, `Button`, `StatusBadge`,
`ConfidenceIndicator`) render plain DOM in jsdom and are exercised for real —
no over-mocking. A `makeProposal()` factory builds a fully-typed
`JournalProposalOutput & { status }`, with `omitVendor` / `omitTotalAmount` /
`emptyProposals` flags to drive the undefined-field edge cases.

## Assertions added (by group)

### Initial render & static structure (6)
- Title copy (`title`) is rendered.
- `className` prop is forwarded onto the Card root.
- The six column headers render in order:
  `['status','Date','Vendor','Amount','Confidence','AI Model']`.
- Status filter defaults to `'all'`.
- Sort defaults to `'date-desc'`.
- Status select exposes all 6 options; sort select exposes all 6 options.

### Empty state / fail-safe (2)
- Empty `proposals` → renders `noResults`, zero rows, no `<table>`, and no
  pagination buttons (the footer block is conditionally hidden).
- Status filter that matches nothing → also degrades to `noResults`.

### Row rendering & formatting (10)
- One row per proposal.
- `formatAmount`: `1234567` → `¥1,234,567` (yen + thousands grouping);
  `0` → `¥0`; `undefined` → `-`.
- `vendorName` `undefined` → `-`.
- `generatedAt` formatted via `toLocaleDateString('ja-JP', …)` (expected value
  computed with the same call, so the assertion is environment-independent).
- `aiModel` rendered in its own cell.
- `proposals[0].confidence` is forwarded to `ConfidenceIndicator`
  (`aria-valuenow = round(conf*100)`).
- Fail-safe: empty `proposals[]` → confidence falls back to `0` (`|| 0`),
  progressbar reports `0`.
- Row `onClick` calls `onSelectProposal` exactly once with the **full proposal
  object** (reference equality).

### Status filter (1)
- Selecting `'approved'` keeps only approved proposals (verifies both inclusion
  and exclusion of the other statuses).

### Sorting (5)
- Date `desc` (default, newest first) and `asc`.
- Amount `desc` and `asc`.
- Amount sort treats an undefined `totalAmount` as `0` (`|| 0`).
- Confidence `desc` and `asc`.

### Pagination (4)
- `pageSize = 10`: 12 items → page 1 shows 10 rows, Previous disabled, Next
  enabled, range reads `pagination.showing 1-10 pagination.of 12`.
- Next → page 2 shows 2 rows, Previous enabled, Next disabled, range reads
  `11-12`.
- Previous → returns to page 1 (10 rows, Previous disabled).
- Exactly `pageSize` (10) items → single page: both Previous and Next
  disabled, range `1-10 … of 10`.

## Coverage rationale

`ProposalList`'s "public surface" is the single exported component plus the
internal logic it drives (`formatDate`, `formatAmount`, status filtering, the
three sort comparators, pagination slicing, and the row-select callback). All of
these are reachable only through rendering/interaction, so every behavior is
asserted via the DOM rather than by exporting internals. The matrix deliberately
covers the required dimensions:

- **Happy paths** — rendering, each sort field/direction, filter, pagination,
  row selection.
- **Edge cases** — empty input, zero-filter-match, undefined `totalAmount` /
  `vendorName`, empty `proposals[]`, exactly-one-page boundary, last-page
  boundary.
- **Fail-safe / degradation** — missing fields collapse to safe displays (`-`,
  `0%`), empty input shows `noResults` and hides interactive controls, and the
  sort comparator guards the undefined amount with `|| 0`.

## Verification commands run

```bash
corepack pnpm install --frozen-lockfile   # worktree had no node_modules
corepack pnpm db:generate                 # avoid phantom TS7006 errors
corepack pnpm exec vitest run <test file> # 29 passed
corepack pnpm exec tsc --noEmit           # 0 errors
corepack pnpm exec eslint --max-warnings=0 <test file>  # exit 0
```

No new dependencies, no production-source changes, no `TODO`/`FIXME`/
`NotImplementedError` added.
