# E2E-CORE-03 — Journal Audit Flow (mock mode)

## Outcome
A real, non-fake-green Playwright E2E test drives the 記帳診断 (journal audit)
UI end-to-end in mock mode: seed journals → login → run the AI audit → wait for
the analyze POST to settle → assert the result list renders issue statuses and
stat cards. Verified green at runtime; `autopm_verify --changed-only` exits 0.

## Changes

### 1. `src/app/[locale]/(authenticated)/audit/journal/page.tsx` (UI-only fix)
The "AI分析実行" button's `handleAnalyze` POSTed to `/api/audit/journal/analyze`,
a route that **does not exist** (only `route.ts` lives under `/api/audit/journal`,
and it already exports a working `POST` handler). The button therefore 404'd on
every click and silently no-op'd (the catch swallowed the parse failure).

Fixed by pointing the fetch at the real handler: `/api/audit/journal/analyze`
→ `/api/audit/journal`. One-line, UI-only. No Class-A verdict logic touched:
- The POST handler (`src/app/api/audit/journal/route.ts`) is read-only reference.
- It returns `{ entries, stats }` whose shape already matches the page's
  `JournalEntry`/`AuditStats` types, so no other UI change was needed.
- In `AI_MOCK_MODE` the handler's `analyzeJournalEntry` returns deterministic
  issues (amount<0 ⇒ error; description<3 ⇒ warning; no taxType ⇒ warning;
  future entryDate ⇒ error) with no external AI call.

### 2. `tests/e2e/journal-audit.spec.ts` (new)
`beforeAll` seeds 3 real `Journal` rows for `company_1` (the seeded admin's
company) into the same SQLite DB the dev server uses, via a `PrismaClient` with
`applyE2eEnvDefaults()` (mirrors `global-setup.ts`). `entryDate` = day 1 of the
current month so it always lands inside the page's default fiscalYear/month
window and is never flagged as a future date. Deterministic freeeJournalIds +
`upsert` ⇒ idempotent re-runs.

The single test:
1. Logs in as the seeded admin (same selectors/idiom as the e2e-core-01 smoke).
2. Opens `/ja/audit/journal`, waits for the "AI分析実行" button to mount.
3. Clicks it inside `Promise.all` with a `waitForResponse` filter on
   `POST /api/audit/journal` — this is the proof the verdict path actually ran,
   not just the pre-analyze GET render.
4. Asserts the response is `ok()`, `entries.length === 3`, `stats.total === 3`.
5. Asserts the rendered result: 総仕訳数 = 3, 要確認 + 問題なし stat cards visible,
   the error issue message ("金額が負の値です"), a warning message
   ("税区分が設定されていません"), and the エラー status badge.

## Verification
- `corepack pnpm exec playwright test tests/e2e/journal-audit.spec.ts` →
  **1 passed (9.2s)** against a mock-mode `next dev` (global-setup ran
  `prisma db push` + seeded admin first). Genuine green: real DB seed → real UI
  interaction → real (mocked) verdict path → real DOM assertions.
- `node scripts/autopm_verify.mjs --changed-only` → **exit 0**
  (typecheck 0 errors; eslint `--max-warnings=0` clean on both files;
  `tests/unit/.../audit/journal/page.test.tsx` still passes).

## Notes / scope decisions
- The page unit test (`page.test.tsx`) only checks the module imports without
  crashing, so the endpoint-string change does not affect it.
- No Class-A paths modified. The audit page lives under
  `src/app/[locale]/(authenticated)/audit/**` (UI), which is outside the
  Class-A `src/app/api/audit/**` and `src/services/audit/**` sets.
- `playwright.config.ts` was intentionally left unchanged: its `webServer`
  command `pnpm dev` is correct for CI (pnpm is on PATH there). The local
  pnpm-not-on-PATH issue (corepack-only) was worked around for this verification
  by starting the mock-mode dev server manually and letting Playwright reuse it
  (`reuseExistingServer: !CI`); this does not affect CI.
- The pre-existing `tests/e2e/audit.spec.ts` is fake-green (`waitForTimeout`,
  accepts a login redirect as success). It is out of scope for this task and
  left untouched; the new spec is the real coverage.
- Seeded test data lives in `prisma/test.db` (gitignored via `prisma/*.db`).
