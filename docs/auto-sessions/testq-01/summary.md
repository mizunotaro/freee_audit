# testq-01 — session summary

**Task:** Assertion-strength (anti-inflation) audit of the coverage-gap test wave.

**Deliverables (2, audit-only — no tests rewritten):**
- `scripts/test-quality-report.mjs` — dep-free (Node ≥ 20 builtins only) scanner.
- `docs/proposals/testq-01.md` — ranked report, all items `PENDING HUMAN DETERMINATION`.

**What "gap-* wave" means here:** the coverage-gap PRs — `cov-svc-01..07`, `cov-lib-01..03`,
`cov-comp-01..05`, `cov-002`, `cov-003`. Scope = test files those PRs **added** (git status `A`),
auto-derived by the script via `git log --all --merges --grep 'cov-'` + first-parent diff.

**Wave totals:** 72 files · 752 test call-sites · 1 737 `expect()` calls (avg 2.31/test).
- `assertion-free` = **0**, `snapshot-only` = **0**, `disabled` = **0** → no fake-green.
- **Tier A** (presence-only: `toBeDefined`/`toBeTruthy`/`not.toBeNull`) = **10 tests / 7 files** — the
  only realistic inflation candidates, all borderline.
- **Tier B** (nullish-only: `toBeNull`/`toBeUndefined`/`toBeFalsy`) = 28 tests / 13 files — almost all
  **correct** null/undefined contracts (cache miss, corrupt input, "renders nothing"); leave-as-is.
- 57 / 72 files fully clean.

**Top Tier-A candidates (PENDING HUMAN DETERMINATION):**
1. `components/currency/dual-currency-display.test.tsx` (L60/113/144) — className via `not.toBeNull`.
2. `unit/services/reports/ir/ir-report-service.test.ts` (L99/148) — round-trip persistence via `not.toBeNull`.
3. `unit/lib/cache/conversion-cache.test.ts` (L83) — TTL serve via `not.toBeNull`.
4. `components/chat/progress-indicator.test.tsx` (L45) — size class via `not.toBeNull`.
5. `unit/services/benchmark/industry-ratios.test.ts` (L94), `export/export-types.test.ts` (L56),
   `import/types.test.ts` (L30) — `toBeDefined`/`toBeTruthy` coverage-completeness checks.

**Key implementation notes:**
- Matcher extraction is **negation-aware**: `expect(x).not.toBeNull()` is classified as a *presence*
  assertion (Tier A), not nullish — this was the single most important correctness fix (without it the
  IR round-trip tests were misclassified).
- `it.each(...)(...)` is handled but counted as one test unit (body analyzed once).
- Strings/comments stripped length-preserving so keywords inside them don't inflate counts.

**Decision:** audit-only as instructed; all strengthening is proposed for the human, none applied.

**Reproduce:** `node scripts/test-quality-report.mjs` (or `--json`, `-n N`).
