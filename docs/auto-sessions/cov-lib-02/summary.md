# COV-LIB-02 — Unit-test coverage: lib/cache + lib/data + lib/storage

**Date:** 2026-07-08
**Branch:** `feature/auto/cov-lib-02`
**Scope:** non-Class-A. No Class-A path touched (read-only reference only).

## What changed

Added 6 new unit-test files (63 tests total) under `tests/unit/lib/`, covering the
modules under `src/lib/cache`, `src/lib/data`, and `src/lib/storage` that previously
had no mirror test.

| Test file | Module under test | Tests |
|-----------|-------------------|-------|
| `cache/conversion-cache.test.ts` | `src/lib/cache/conversion-cache.ts` (`ConversionCache`, `conversionCache`) | 22 |
| `cache/index.test.ts` | `src/lib/cache/index.ts` (re-export contract) | 3 |
| `storage/factory.test.ts` | `src/lib/storage/factory.ts` (`createStorageProvider`) | 7 |
| `storage/types.test.ts` | `src/lib/storage/types.ts` (`DEFAULT_STORAGE_CONFIG`, `STORAGE_ERROR_MESSAGES`) | 7 |
| `storage/index.test.ts` | `src/lib/storage/index.ts` (re-export contract) | 4 |
| `data/sample-therapeutics-data.test.ts` | `src/lib/data/sample-therapeutics-data.ts` | 20 |

`memory-cache.ts`, `base-storage.ts`, and `local-storage.ts` already had tests and
were left untouched.

## Approach

- **Pure logic, no DB/IO at the boundary.** `ConversionCache` is fully synchronous,
  so there were no async-rejection paths to guard; fake timers cover TTL expiry
  (300000 ms mapping cache, 600000 ms target-account / cash-flow caches).
- **`createStorageProvider`** happy path constructs a real `LocalStorageProvider`
  into a gitignored `./tmp/...` dir (cleaned in `afterEach`); the four non-`local`
  providers are asserted to throw with the provider name in the message.
- **`sample-therapeutics-data.ts`** is a pure data module, so the tests assert
  structural/accounting invariants that actually hold:
  - assets = liabilities + equity; totalAssets = totalLiabilitiesAndEquity
  - current-asset and fixed-asset group sums
  - cash-flow reconciliation (netChange = ending − beginning; operating build-up)
  - monthlyBurn: 12 months, `totalBurn = rdSpend + sgaSpend`, Series-A cash jump
  - budget line-item sums → totals; R&D + SGA = total
  - runway scenario ordering (optimistic > base > pessimistic)
  - headcount department sum = total

### Data quirk found (not asserted, left as-is)
`balanceSheet.assets.fixedAssets.tangible.netTangibleAssets` is declared as
`466000000`, but the sum of its own line items (building/lab/office/leasehold,
each net of accumulated depreciation) is `456000000` — a 10M discrepancy. I
intentionally did **not** assert that internal consistency (it would be a failing
test / fake red). I only assert `totalFixedAssets = netTangibleAssets +
totalIntangibleAssets + totalInvestments`, which holds against the declared
`netTangibleAssets`. Flagging here for awareness; no source data was modified
(out of scope — pure test-additive task).

## Constraints honoured

- No `any`, `@ts-ignore`, `@ts-expect-error`, `.skip`, lint-disable, or coverage
  threshold changes. One `as unknown as { config: StorageConfig }` is used only to
  read a protected field for a config-passthrough assertion (no `any`).
- Additive only: zero source files modified.
- Ran only the 6 new test files via vitest (never the full suite — known OOM).

## Verification

```
node scripts/autopm_verify.mjs --changed-only   → exitCode 0
  typecheck: relevantErrors=0  (298 pre-existing total errors are elsewhere, filtered out)
  eslint:    6 files, 0 warnings (--max-warnings=0)
  vitest:    6 files, 63 passed
```

Note: the worktree had no `node_modules`; ran `corepack pnpm install
--frozen-lockfile` and `corepack pnpm db:generate` (clears the phantom TS7006
errors per known issue) before verification. These only touch `node_modules`
(gitignored) — not part of the diff.

## Definition of Done

- [x] `node scripts/autopm_verify.mjs --changed-only` exits 0.
