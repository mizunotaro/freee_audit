# TESTQ-01 — Assertion-Strength Audit of the Coverage-Gap (cov-*) Test Wave (Anti-Inflation)

> **Status: ANALYSIS ONLY — every conclusion below is `PENDING HUMAN DETERMINATION`.**
> This document contains no approvals, no reviewer names, and no sign-offs. It is a read-only
> analysis produced for a human reviewer to decide and action. Nothing here has been authorized,
> accepted, or merged. **No test files were rewritten in this task** — the only artifacts produced
> are this report and the dep-free scanner `scripts/test-quality-report.mjs`.

---

## 1. Task & constraints (recap)

- **Goal:** audit the assertion strength of the test files added by the coverage-gap wave
  (the `cov-*` PRs: `cov-svc-01..07`, `cov-lib-01..03`, `cov-comp-01..05`, `cov-002`, `cov-003`)
  to detect **inflation** — tests that raise coverage numbers without genuinely asserting behavior.
- **Scope:** test files **ADDED** (git status `A`) by those PRs only. 72 files, 752 test call-sites,
  1 737 `expect(...)` calls. Source under test was **read-only reference** and was not modified.
- **Weak patterns scanned (per `it`/`test`):**
  1. `assertion-free` — runs but calls `expect()` zero times (pure fake-green).
  2. `toBeDefined`/`toBeTruthy`-only — the classic lazy "it exists / it rendered" check that
     validates no content. Treated as **Tier A (high-confidence inflation candidate)**.
  3. `toBeNull`/`toBeUndefined`/`toBeFalsy`-only — usually the *correct* expectation (e.g. a
     deliberate cache-miss return). Treated as **Tier B (low-confidence; human decides)**.
  4. `snapshot-only` — every matcher is `toMatch(Snapshot|…)` (brittle, low-effort).
  5. `disabled` — `.skip` / `.todo` / `xit` (contributes no runtime coverage).
- **Class-A paths** (`prisma/**`, `src/lib/auth*`, `src/lib/crypto.ts`, `src/lib/security/**`,
  `src/lib/audit/**`, `src/services/{audit,conversion,valuation,tax,kpi,debt,deferred-accrual,
  journal-proposal,freee}/**`, the corresponding `src/app/api/**` trees, and the microservices)
  were treated as read-only reference and were **not** proposed for change.
- **Every recommendation is `PENDING HUMAN DETERMINATION`.**

## 2. Executive summary

**Headline: the wave is healthy.** There are **zero** fake-green tests in the coverage-gap wave —
no `assertion-free` tests, no `snapshot-only` tests, no `disabled` tests. 57 of 72 files (79 %)
have **only** content-validating assertions (`toBe` / `toEqual` / `toHaveBeenCalledWith` / …).
The wave-wide average is **2.31 `expect()` calls per test** — far above an inflation threshold.

A small residual of **10 tests across 7 files** use *presence-only* assertions (Tier A) and are the
only realistic inflation candidates. Even these are borderline — several assert presence on a
specific selector/round-trip and *do* catch regressions — so each is a **candidate for the human to
review**, not a defect. A further **28 tests across 13 files** use *nullish-only* assertions (Tier B),
but on inspection these are almost all **correct** (null/undefined is the intended contract for a
cache miss, corrupt input, unknown key, or "renders nothing" case).

| ID | File | Tier-A tests | Top pattern | Suggested strengthening (PENDING) | Severity |
|----|------|--------------|-------------|-----------------------------------|----------|
| TESTQ-01-01 | `components/currency/dual-currency-display.test.tsx` | 3 (L60, L113, L144) | `querySelector('.x').not.toBeNull()` for "applies className" | assert the class is on the *intended* element (`toHaveClass`) + count == 1 | **Medium** |
| TESTQ-01-02 | `unit/services/reports/ir/ir-report-service.test.ts` | 2 (L99, L148) | `getReport(id).not.toBeNull()` for "persists…read it back" | assert round-trip equality `toEqual(saved)` (sibling L82-89 already does) | **Medium** |
| TESTQ-01-03 | `unit/lib/cache/conversion-cache.test.ts` | 1 (L83) | `getMapping(...).not.toBeNull()` for "serves mapping before TTL" | assert served value `toEqual(mapping)`, not just non-null | **Low-Med** |
| TESTQ-01-04 | `components/chat/progress-indicator.test.tsx` | 1 (L45) | `not.toBeNull()` ×2 for "applies the requested size class" | assert the rendered node `toHaveClass(size)` | **Medium** |
| TESTQ-01-05 | `unit/services/benchmark/industry-ratios.test.ts` | 1 (L94) | `toBeDefined()` for "exposes every common metric" | assert the value is a finite number, not merely defined | **Low** |
| TESTQ-01-06 | `unit/services/export/export-types.test.ts` | 1 (L56) | `toBeTruthy()` ×2 for "MIME/EXT cover every format" | assert the actual MIME/ext string per format (e.g. `'application/pdf'`) | **Low** |
| TESTQ-01-07 | `components/import/types.test.ts` | 1 (L30) | `toBeTruthy()` ×2 for "ja+en descriptions for every type" | assert the actual description strings, not merely truthy | **Low** |

**Wave-wide counts (machine-derived, reproducible via the script):**

| Metric | Value |
|--------|-------|
| Files scanned | 72 |
| Test call-sites | 752 (`it.each` parametrizations counted once each) |
| `expect()` calls | 1 737 |
| `assertion-free` tests | **0** |
| `snapshot-only` tests | **0** |
| `disabled` tests | **0** |
| Tier-A presence-only (`toBeDefined/toBeTruthy`/`not.toBeNull`) | **10** (7 files) |
| Tier-B nullish-only (`toBeNull/toBeUndefined/toBeFalsy`) | 28 (13 files) |
| Files fully clean (every active test is strong) | **57 / 72** |

## 3. Methodology

1. **Scope derivation (git, reproducible).** `scripts/test-quality-report.mjs` enumerates the
   `cov-*` merge commits (`git log --all --merges --grep 'cov-'`), diffs each merge against its
   first parent (`git diff --diff-filter=A <merge>^1 <merge>`), and collects the test files
   (`*.test.ts(x)` / `*.spec.ts(x)`) that still exist on disk. This yields exactly the 72 files the
   wave added. (Scope can also be supplied explicitly via argv / `--from-list` for reuse outside
   this repo state.)
2. **Static per-test analysis.** For each file the script (a) strips comments and string/template
   *contents* (length- and newline-preserving) so keywords inside strings never inflate counts;
   (b) locates each `it`/`test`/`xit`/`fit` call and balances parentheses to capture its body,
   including `.each(...)(...)`, `.skip`, `.todo`, `.only`; (c) within each body counts real
   `expect(...)` assertion calls (excluding `expect.assertions`/`expect.hasAssertions`/`expect.objectContaining`
   helpers, which have no `(` immediately after `expect`); (d) for each assertion records the
   chained matcher **with negation** (`expect(x).not.toBeNull()` is recorded as a *presence*
   assertion, not nullish); (e) classifies the test.
3. **Tiering & scoring.** A test is **Tier A** if every matcher asserts presence
   (`toBeDefined` / `toBeTruthy`, or a negated nullish matcher). It is **Tier B** if every matcher is
   a *positive* nullish check. File weakness score = `4·assertionFree + 3·tierA + 2·snapshotOnly +
   1·tierB + 2·disabled`. Files rank by score; the report's findings focus on Tier A.

## 4. Findings — Tier A (presence-only, high-confidence candidates)

> Each item is `PENDING HUMAN DETERMINATION`. "Strengthen" means *add* a content check; none of
> these tests is incorrect — they are weaker than they could be.

### TESTQ-01-01 — `components/currency/dual-currency-display.test.tsx` *(Severity: Medium)*

- **Lines 60, 113, 144** — three tests titled *"applies the custom className"*, each:
  ```ts
  expect(container.querySelector('.custom-class')).not.toBeNull()
  ```
- **Why borderline:** querying `.custom-class` and asserting non-null *does* prove the class rendered
  *somewhere*, so it is a partial regression guard — not pure inflation. **What it misses:** it cannot
  detect the class landing on the *wrong* element (e.g. wrapper instead of the amount span) or the
  same class leaking onto multiple nodes.
- **Suggested strengthening (`PENDING HUMAN DETERMINATION`):** assert the class is on the intended
  node and unique, e.g. `expect(container.querySelectorAll('.custom-class')).toHaveLength(1)` plus
  `expect(container.querySelector('.custom-class')).toHaveClass('custom-class')` (or assert the
  specific element's `getAttribute('class')`).

### TESTQ-01-02 — `unit/services/reports/ir/ir-report-service.test.ts` *(Severity: Medium)*

- **Line 99** *"persists the report so getReport can read it back"* and **line 148** *"persists the
  created report"* both end in `expect(await getReport(id)).not.toBeNull()`.
- **Why borderline:** they prove the round-trip reaches storage. **What they miss:** that the
  *read-back* report equals the *written* report (a serialization/corruption bug would pass).
  Note the sibling test at **lines 82–89** already does the strong version (`toEqual(report)`); these
  two are weaker duplicates.
- **Suggested strengthening (`PENDING HUMAN DETERMINATION`):** `expect(await getReport(id)).toEqual(saved)`
  (mirror lines 82–89) instead of a null check.

### TESTQ-01-03 — `unit/lib/cache/conversion-cache.test.ts` *(Severity: Low-Medium)*

- **Line 83** *"still serves a mapping just before its TTL elapses"* ends in
  `expect(cache.getMapping(...)).not.toBeNull()`.
- **Why borderline:** proves the entry survived. **What it misses:** that the served value is the
  *right* mapping (a stale/wrong mapping would pass). The neighbouring tests (e.g. L44–48) assert
  `toEqual(mapping)`.
- **Suggested strengthening (`PENDING HUMAN DETERMINATION`):** `expect(cache.getMapping(...)).toEqual(mapping)`.
  (The seven Tier-B `toBeNull` cases in this same file — cache miss / TTL-expired → null — are
  **correct** and are not in scope to change; see §5.)

### TESTQ-01-04 — `components/chat/progress-indicator.test.tsx` *(Severity: Medium)*

- **Line 45** *"applies the requested size class"* ends in two `not.toBeNull()` checks.
- **Why borderline:** proves *a* node rendered. **What it misses:** that the node carries the
  requested size class.
- **Suggested strengthening (`PENDING HUMAN DETERMINATION`):** assert the rendered node
  `toHaveClass(<expected size>)` rather than merely existing. (The Tier-B `toBeNull` cases at L21/L54
  — "renders nothing for idle/terminal" — are correct: the component deliberately returns `null`.)

### TESTQ-01-05 — `unit/services/benchmark/industry-ratios.test.ts` *(Severity: Low)*

- **Line 94** *"exposes every common metric for every sector"* ends in `expect(...).toBeDefined()`.
- **Why borderline:** proves the key exists. **What it misses:** that the value is an actual ratio
  (a `NaN`, a placeholder, or a wrong number would pass `toBeDefined`).
- **Suggested strengthening (`PENDING HUMAN DETERMINATION`):** assert `expect(typeof v).toBe('number')`
  and `expect(Number.isFinite(v)).toBe(true)` (and optionally a plausible range). (The Tier-B
  `toBeUndefined` cases at L48/70/74 — unknown sector/metric → undefined — are correct.)

### TESTQ-01-06 — `unit/services/export/export-types.test.ts` *(Severity: Low)*

- **Line 56** *"MIME_TYPES and FILE_EXTENSIONS cover every ExportFormat"* ends in
  `expect(MIME_TYPES[fmt]).toBeTruthy()` and the same for extensions.
- **Why borderline:** proves each format maps to something truthy. **What it misses:** that the MIME
  string is the *correct* one (a wrong-but-truthy MIME like `'application/octet-stream'` would pass).
- **Suggested strengthening (`PENDING HUMAN DETERMINATION`):** assert the known canonical strings,
  e.g. `expect(MIME_TYPES['pdf']).toBe('application/pdf')`, or at minimum that each value matches a
  MIME-shape regex.

### TESTQ-01-07 — `components/import/types.test.ts` *(Severity: Low)*

- **Line 30** *"provides ja + en descriptions for every import type"* ends in two `toBeTruthy()`.
- **Why borderline:** proves each description is truthy. **What it misses:** that it is the intended
  human-readable string (a `true` or a number would pass).
- **Suggested strengthening (`PENDING HUMAN DETERMINATION`):** assert the actual description values
  (or at least `expect(typeof d).toBe('string')` with a minimum length).

## 5. Tier B — nullish-only assertions (low confidence; mostly leave as-is)

28 tests across 13 files use *only* `toBeNull` / `toBeUndefined` / `toBeFalsy` as positive
expectations. **On inspection these are almost all the correct assertion for an explicit
null/undefined contract**, e.g.:

- `conversion-cache.test.ts` — cache miss / TTL-expired → `null` (the cache's documented miss value).
- `ir-report-service.test.ts` L78/L91 — not-stored / corrupt-JSON → `null`; L170 — delete-missing
  → resolves `undefined`.
- `industry-ratios.test.ts` L48/L70/L74 — unknown sector/metric → `undefined`.
- `progress-indicator.test.tsx` L21/L54 — "renders nothing" for idle/terminal → `null` (component
  returns `null`).
- `ir-report-mapper.test.ts` L178/L183/L201 — omit count when shares ≤ 0 / category absent.
- `chat/config.test.ts` L110/L120 — grace-window / non-positive estimate → `undefined`.
- `lib/api/index.test.ts` L109/L117 — invalid/expired session → `null`.
- `ImportResult.test.tsx` L61/L126, `export-types.test.ts` L21, `export-progress.test.tsx` L106,
  `ImportCard.test.tsx` L92, `dock-sidebar.test.tsx`, `company-size-benchmarks.test.ts`,
  `invitation-service-extended.test.ts` — analogous "absent/empty/default → null/undefined" contracts.

**Recommendation (`PENDING HUMAN DETERMINATION`):** treat Tier B as **leave-as-is** unless a
specific contract is itself in doubt. These are not inflation; `toBeNull()` is the strongest
possible assertion for "this function returns null on a miss."

## 6. Files verified CLEAN (57 / 72)

57 of 72 wave files have **only** content-validating assertions (score 0). Representative strong
files (high `expect`-per-test density, value/shape matchers): `lib/utils.test.ts` (64 exp / 54
tests), `ir/ir-report-service.test.ts` (69 exp / 38 tests outside the 2 Tier-A cases), `storage/
types.test.ts`, `payment-checker-extended.test.ts` (uses `toHaveBeenCalledWith` + `objectContaining`),
`charts/*`, `kpi/*`, `import/*`, `export/*`. The full clean list is emitted by the script under the
"CLEAN FILES" header.

## 7. Limitations & false-positive caveats (`PENDING HUMAN DETERMINATION`)

The scanner is a **static heuristic**, not a semantic judge. Known limits the human must weigh:

1. **Presence ≠ inflation.** `not.toBeNull()` on a *specific selector* (TESTQ-01-01/04) is a real
   (if weak) regression guard. The script ranks it Tier A because it validates no content; the human
   decides whether the added content check is worth the maintenance.
2. **`it.each` counted once.** A parametrized `it.each([...])('…', fn)` is analyzed as **one** test
   unit (its body's assertion strength is evaluated once). Runtime case-count is therefore higher
   than the 752 reported; this does not affect per-body strength classification. Five wave files use
   `it.each`.
3. **String/comment stripping is conservative.** Template-literal interpolations are stripped along
   with the literal (assertions inside `${}` would be under-counted); such assertions are essentially
   absent in this wave, so the effect is nil here, but the limit is real.
4. **Custom/async matchers.** Only the standard matcher vocabulary is classified; an assertion using
   a project-local custom matcher (`expect(x).toSatisfyPolicy(...)`) would be treated as "strong"
   (unknown matcher), which is the safe direction.
5. **Scope = files ADDED by the wave.** Files the wave only *modified* (e.g. `cov-002` touched
   `layout/dock-sidebar.test.tsx` / `sidebar.test.tsx`, which were themselves added by `cov-comp-04`
   and so are already in scope) are covered via their adding PR. Pre-existing tests outside the wave
   are intentionally out of scope.

## 8. Suggested action ordering (for the human, not prescriptive)

`PENDING HUMAN DETERMINATION` — if any of this is actioned, by value/risk:

1. TESTQ-01-01 / 01-04 (UI class assertions — duplicated, cheap to strengthen with `toHaveClass`).
2. TESTQ-01-02 (round-trip equality; sibling already shows the pattern).
3. TESTQ-01-03 / 01-05 / 01-06 / 01-07 (value-shape assertions; low risk).
4. Tier B: **no action recommended** unless a specific contract is challenged.

## 9. How to reproduce

```bash
# default: scan the cov-* wave (scope auto-derived from git)
node scripts/test-quality-report.mjs
node scripts/test-quality-report.mjs -n 20        # top-20 weakest files
node scripts/test-quality-report.mjs --json       # machine-readable

# explicit file list (reproducible regardless of git state)
node scripts/test-quality-report.mjs path/a.test.ts path/b.test.tsx
```

Exit codes: `0` report produced (weak tests found is **not** a failure — it is the point);
`1` no test files resolved; `2` infrastructure error (git unavailable).

## 10. Constraints respected

- **Two deliverables only:** `scripts/test-quality-report.mjs` (dep-free) + this file. **No test
  files were rewritten** (the task is explicitly audit-only).
- **Class-A untouched:** no Class-A path was modified; all are read-only reference. The flagged
  files are all in `tests/**` (test code), none in a Class-A service/api tree.
- **Dep-free:** the script uses only Node ≥ 20 builtins (`fs`, `child_process`, `path`). No new
  dependencies, no `any`/`@ts-ignore`/`@ts-expect-error`/`.skip`/lint-disable/coverage-threshold
  change introduced.
- **No approvals / no reviewers / no sign-offs** appear anywhere in this document.
- **Every conclusion is marked `PENDING HUMAN DETERMINATION`.**

---

*End of analysis — all items `PENDING HUMAN DETERMINATION`.*
