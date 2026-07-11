# DQ-01 — Journal data-quality validators

**Status:** implemented · **DoD:** `node scripts/autopm_verify.mjs --changed-only` exits 0
(typecheck 0 errors repo-wide · eslint 0 warnings · 41 vitest cases green).

## What was added

New read-only validator module + golden tests. Pure functions over `Journal[]`
(journals treated as immutable inputs — a no-mutation test asserts this):

- `src/services/validation/journal-quality-validator.ts`
- `tests/unit/services/validation/journal-quality-validator.test.ts`

No existing file was modified. No Class-A path touched. No new dependency.
Imports are limited to `zod`, `@/types` (Journal) and `@/types/result`.

### Four validators + one aggregator (all return `Result<T, AppError>`)

1. **`findDuplicateJournals(journals, options?)`** — buckets by
   `(UTC day, debitAccount, creditAccount[ , taxAmount, description])` then
   clusters amounts within `amountTolerance`. Options: `includeTaxAmount`,
   `includeDescription`, `amountTolerance` (default 0 = cent-exact),
   `minGroupSize` (default 2). Reports `groups`, `totalGroups`,
   `entriesInvolved`, `redundantEntries` (Σ count−1).

2. **`findDateGaps(journals, options?)`** — the supplied set *is* the period
   (`periodStart`/`periodEnd` derived from min/max entry date; caller slices by
   period beforehand). Flags consecutive entry days farther apart than
   `maxGapDays` (default 7). Reports each gap with `from`/`to`/`gapDays`.

3. **`findUnbalancedEntries(journals, options?)`** — flags structural defects
   that prevent a valid posting: `non_finite_amount`, `non_positive_amount`,
   `non_finite_tax`, `negative_tax`, `self_offsetting` (debit ≡ credit).

4. **`computeMissingCounterpartyStats(journals, options?)`** — the Journal
   schema has **no** counterparty field, so this is a heuristic: for entries on
   counterparty-bearing accounts (default: 売掛金/買掛金/未収入金/未払金/…) it
   flags blank / too-short / placeholder-token descriptions. Reports
   `totalMissing`, `missingRatio`, and per-account samples.

5. **`analyzeJournalQuality(journals, options?)`** — runs all four and merges
   into a `JournalQualityReport` (`hasIssues`, `totalFlaggedEntries`).

All inputs are validated with Zod `safeParse`; malformed input yields a typed
`failure(AppError)` with code `VALIDATION_ERROR` and the offending issue paths.

## Design decisions worth recording

- **Quality flags only — no financial verdicts.** `severity` is `'info' | 'warning'`
  only; there is no `'error'`/pass-fail verdict. This honours the constraint that
  the scanner reports data quality, never an audit judgement.

- **"Unbalanced" in a single-line schema.** The `Journal` model stores one
  `debitAccount`, one `creditAccount` and a single `amount` applied to both legs,
  so numeric debit≠credit imbalance is **impossible to detect by construction**
  (Dr `amount` ≡ Cr `amount`). Rather than fabricate a financial verdict, the
  validator flags the structural defects that *do* indicate a defective posting
  (non-positive/non-finite value, self-offset, negative tax). This is the
  honest, defensible reading of the requirement given the schema.

- **Non-finite values are flagged, not rejected.** Zod 3.23's `z.number()`
  rejects `NaN` but accepts `Infinity`. To keep the scanner *flagging* rather
  than hard-aborting on one bad row, the numeric schema is
  `z.number().or(z.nan())`, so both `NaN` and `Infinity` pass the gate and are
  reported as `non_finite_amount`/`non_finite_tax` findings. `Invalid Date`
  values are still a hard `z.date()` rejection (returned as `VALIDATION_ERROR`)
  — that behaviour is pinned by a test.

- **Duplicate bucket key** uses a `0x01` control-character separator to avoid account-name
  collisions; day granularity is UTC (`toISOString().slice(0,10)`).

- **No comments** in the source, matching `calculation-validator.ts` and
  CLAUDE.md §13. Rationale lives here.

## Verification run

```
node scripts/autopm_verify.mjs --changed-only   # exit 0
  typecheck: total errors=0, relevant to diff=0
  eslint:    ok (2 files, 0 warnings)
  vitest:    41 passed (1 file)
```
