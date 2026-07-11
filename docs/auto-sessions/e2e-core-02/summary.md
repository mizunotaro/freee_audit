# E2E-CORE-02 — Monthly close/report flow (mock): reports render + export

## Outcome
Added `tests/e2e/reports-close.spec.ts` — a real, non-fake-green E2E test for the
core close/report flow in mock mode: log in → open the report that renders BS/PL/CF
→ assert the three statements (and a row from each) render → trigger the CSV export
→ assert a real downloadable `text/csv` response whose body carries all three
statements.

Definition of Done: `node scripts/autopm_verify.mjs --changed-only` → **exit 0**
(typecheck 0 errors, eslint clean, vitest correctly skips `*.spec.ts`).

The test was also **executed green** with Playwright against a live `next dev`
server + chromium (verified twice on a clean slate), so this is not lint-only
"fake green" — the `autopm_verify` gate only typechecks/lints `*.spec.ts` (it never
runs them; the CI `e2e-tests` job does), so executing it manually was required.

## Why the periodic report page
`src/app/[locale]/(authenticated)/reports/periodic/page.tsx` is the one report page
that renders **all three statements** in one view — `損益計算書 (PL)`,
`貸借対照表 (BS)`, `キャッシュフロー (CF)` — and has a working export affordance:
the `CSV出力` button calls `window.open('/api/reports/periodic?...&export=csv')`,
which `src/app/api/reports/periodic/route.ts` serves as a real
`Content-Type: text/csv; Content-Disposition: attachment; filename="periodic-report.csv"`
body built by `formatPeriodicReportForExport` (deterministic section markers:
`--- 貸借対照表 ---` / `--- 損益計算書 ---` / `--- キャッシュフロー ---`).

The `/reports/monthly` page renders PL/BS too but has no export button; the periodic
page satisfies "BS/PL/CF render + export" comprehensively in a single deterministic
flow, so it was chosen as the target.

## Determinism
- No `waitForTimeout`/sleeps — Playwright auto-waits on locators and
  `context.waitForEvent('response', ...)`.
- `generatePeriodicReport` falls back to sample periods on an empty DB, so the page
  and CSV always carry the asserted headings/labels/markers. Numeric amounts are
  randomized, so the test **asserts structure/labels only**, never amounts.

## Export assertion (two parts)
1. **UI trigger → file response (headers):** click `CSV出力`, capture the response
   at the **context** level (the page uses `window.open`, so the response lands on a
   popup, not the main page). Assert status 200, `content-type: text/csv`,
   `content-disposition: attachment; filename="periodic-report.csv"`.
2. **File contents (body):** Chromium hands an attachment response to its download
   pipeline, so `response.text()` on the captured popup response fails
   (`Network.getResponseBody: No resource with given identifier found`). The body is
   therefore fetched via `page.request.get(...)` on the same authenticated context
   and asserted to contain the three statement markers + `営業CF`.

Both requests hit the real route handler with the real `session` cookie — not mocked.

## Verification log
- `corepack pnpm exec playwright test tests/e2e/reports-close.spec.ts` →
  **1 passed** (twice, on a freshly restarted server).
- `node scripts/autopm_verify.mjs --changed-only` → **exit 0**.

### Local gotcha (does not affect CI)
The auth login limiter is **5 requests / 15 min / IP**
(`src/lib/security/rate-limit-middleware.ts:113`, in-memory). Stress-running the
spec with `--repeat-each=3` after several dev iterations trips it
("Too many requests, please try again later") and fails at the login step. This is
a local stress artifact only: CI runs the suite once (≤3 attempts with `retries: 2`),
and `smoke.spec.ts` already performs one successful login, so adding this spec's
single login stays well under the limit. To reset locally, restart `next dev`
(clears the in-memory limiter).

## Files changed
- `tests/e2e/reports-close.spec.ts` (new, additive) — the only diff.

## Out of scope / left as-is
- The pre-existing `tests/e2e/reports.spec.ts` is fake-green (it navigates to
  `/reports/balance-sheet|profit-loss|cash-flow`, routes that do not exist, and
  uses `waitForTimeout` + tautological URL asserts). It was **not** modified — this
  task is additive and the new spec is the real coverage for the BS/PL/CF render +
  export flow. Cleaning up the legacy spec is a separate task.
- No Class-A paths touched; no new dependencies; no `any`/`@ts-ignore`/`.skip`/
  lint-disable.
