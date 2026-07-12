# E2E-FLOW-05 — Journal list/detail + data-quality flags view (dq-01)

**Status:** implemented · **DoD:** `node scripts/autopm_verify.mjs --changed-only` exits 0
(typecheck 0 errors repo-wide · eslint 0 warnings on 3 files · vitest skipped: no related
unit tests). The Playwright E2E spec was also run locally and passes (2/2 green) against the
real route + page + dq-01 validator.

## Context: dq-01 shipped no surface

dq-01 added only a read-only validator (`src/services/validation/journal-quality-validator.ts`,
`analyzeJournalQuality` + 4 sub-validators) and golden tests — **no API route, no UI, no
component**. `src/components/audit/` does not exist; the existing `audit/journal`,
`audit/journals`, and `audit/results` pages render a *separate* AI-analysis surface
(`issues: {field, issue, severity:'error'|'warning'|'info'}`), not dq-01's flag shapes
(`kind: 'duplicate'|'date_gap'|'unbalanced'|'missing_counterparty'`, `severity:'info'|'warning'`,
no `'error'`, no verdict).

So "the data-quality flags surface (from dq-01)" had to be built. The verdict logic
(audit pass/fail, `PASSED`/`FAILED`) is Class-A and untouched; the dq-01 validator only
emits `info`/`warning` quality flags with no verdict, so the new surface is genuinely
read-only.

## What was added (3 files, additive, no Class-A path touched)

1. **`src/app/api/journal-quality/route.ts`** — new GET route. `withAuth(handler,
   { requireCompany: true })` + `validateCompanyId` + `prisma` (mirrors
   `/api/audit/journals`). Fetches up to 500 company journals, maps prisma rows to the
   validator's `Journal[]` input (non-null fields map directly; `taxType`/`documentId`
   `?? undefined`, `auditStatus` cast to the union), runs `analyzeJournalQuality`, and
   projects the aggregate `JournalQualityReport` into **per-journal flags**:
   - **duplicate** — journal `id` appears in `report.duplicates.groups[].journalIds`
     → reason `重複する仕訳が検出されました`.
   - **unbalanced** — journal `id` appears in `report.unbalanced.entries[]` → one flag
     per `UnbalancedReason`, mapped via `UNBALANCED_REASON_LABELS`
     (`non_positive_amount`→`金額が0以下です`, `self_offsetting`→`借方・貸方が同一科目です`, …).
   - Returns `{ data: [...journals with flags...], summary: {total, flagged,
     duplicateGroups, unbalancedEntries, hasIssues} }`.

   The route lives at a **top-level** `/api/journal-quality` segment — deliberately NOT
   under `src/app/api/audit/**` or `src/app/api/journals/**` (both Class-A).

2. **`src/app/[locale]/(authenticated)/audit/journal-quality/page.tsx`** — new read-only
   client page (bare, matching `audit/journals/page.tsx` rather than the AppLayout+Radix
   `audit/journal/page.tsx`, so a native `<select>` filter avoids the Radix Select
   accessible-name E2E gotcha). Renders: `<h1>データ品質フラグ`, a summary row, a native
   `<select>` filter (`すべて`/`フラグあり`/`重複`/`不整合`/`フラグなし`, client-side over
   loaded data), a plain `<table>` whose rows show short flag badges (`重複`/`不整合`), and
   a conditional `<section>` detail panel opened by a per-row `詳細` button
   (`aria-label="<description> の詳細"` for uniqueness) that shows the full reason text.

3. **`tests/e2e/journal-quality-flow.spec.ts`** — FLOW-05 Playwright spec. Pattern B auth
   (one `beforeAll` login, cookie reuse in `beforeEach` — respects the 5-logins/15-min
   limiter). Seeds 4 journals via `prisma.journal.upsert` (idempotent): a duplicate pair
   (`仕入`/`買掛金`, 55500, same date), a `non_positive_amount` journal (`広告宣伝費`/`現金預金`,
   -777), and a clean journal. Accounts/amounts/dates are distinctive so they never collide
   with `journal-audit.spec`'s current-month rows; assertions anchor on these journals by
   `freeeJournalId`/description, never on totals that depend on other specs' DB state.
   Two tests:
   - **list renders with dq-01 flags** — asserts the `/api/journal-quality` response carries
     the correct per-journal flags (duplicate on the pair, unbalanced+reason on the negative
     row, none on the clean row), the heading renders, and the `重複`/`不整合` badges appear
     in the rows.
   - **filter applies + flagged entry shows its reason** — `フラグあり` removes the clean row
     from the DOM (count 0) while a flagged row stays; `すべて` restores it; clicking `詳細`
     on the unbalanced journal surfaces the reason `金額が0以下です` in the detail panel.

## Design decisions worth recording

- **Only duplicate + unbalanced are surfaced per-journal.** `missing_counterparty` is
  sample-capped (`maxSamples: 3` per account — not all flagged ids are returned, so it is
  unreliable as a per-row flag) and `date_gap` is period-level (not per-journal). Surfacing
  them per-row would have been dishonest; the summary still reports `duplicateGroups` and
  `unbalancedEntries` counts.
- **Read-only, no verdict.** The dq-01 `severity` is `info`/`warning` only (no `error`, no
  pass/fail) — this honours both the dq-01 design and the "verdict logic is Class-A/mocked"
  constraint. The new code adds no verdict logic of any kind.
- **Client-side filter** (not a server re-fetch) — the flags are computed over the full set
  (duplicates need the whole set), so filtering is a display concern. The E2E asserts the
  filter via DOM row counts (`toHaveCount`), which is deterministic.
- **`vitest` step is intentionally skipped by the gate** — no `*.test.ts(x)` resolves for
  the new route/page (the gate skips cleanly when none resolve; it does NOT fall back to a
  full-suite run). The route/page are covered by the real E2E spec instead, which is the
  appropriate level for a read-only HTTP+UI surface.

## Verification run

```
corepack pnpm install --frozen-lockfile   # fresh worktree had no node_modules
corepack pnpm db:generate                  # install does NOT generate the prisma client
DATABASE_URL=file:./test.db corepack pnpm exec prisma db push --skip-generate
# dev server started with FREEE_MOCK_MODE=true AI_MOCK_MODE=true (reused by Playwright)
corepack pnpm exec playwright test tests/e2e/journal-quality-flow.spec.ts --reporter=line
  → 2 passed (33.8s)

node scripts/autopm_verify.mjs --changed-only
  typecheck: total errors=0, relevant to diff=0
  eslint:    ok (3 files, 0 warnings)
  vitest:    skipped (no related tests resolved)
  exitCode: 0
```

No existing file modified. No Class-A path touched. No new dependency. No `any`,
`@ts-ignore`, `.skip`, or lint-disable.
