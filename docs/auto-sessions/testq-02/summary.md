# TESTQ-02 — Strengthen weakest tests flagged by testq-01.md

## Outcome

All **7 Tier-A** (presence-only) test cases flagged in `docs/proposals/testq-01.md`
were strengthened with real behavioral assertions. `weak-truthy(A) = 0` across the 7
files after the change (confirmed by `scripts/test-quality-report.mjs`). The gate
`node scripts/autopm_verify.mjs --changed-only` exits **0**.

No Class-A path was modified — every change is in `tests/**`. Source under test was
read-only reference only.

## Changes (per testq-01 finding)

| Finding | File | Before | After |
|---------|------|--------|-------|
| TESTQ-01-01 | `tests/components/currency/dual-currency-display.test.tsx` (3 tests) | `querySelector('.x').not.toBeNull()` | `querySelectorAll('.x').toHaveLength(1)` + assert that node's `textContent` contains the formatted amount/rate — proves the class is on the **intended** element and unique |
| TESTQ-01-02 | `tests/unit/services/reports/ir/ir-report-service.test.ts` (2 tests) | `getReport(id).not.toBeNull()` | `toMatchObject({...core fields...})` round-trip content check + version-bump assertion (saveReport/createReport mutate metadata, so `toEqual` is impossible; sibling L82-89 uses direct seed) |
| TESTQ-01-03 | `tests/unit/lib/cache/conversion-cache.test.ts` (1 test) | `getMapping(...).not.toBeNull()` | `toEqual(mapping)` — serves the **right** mapping pre-TTL, not just any |
| TESTQ-01-04 | `tests/components/chat/progress-indicator.test.tsx` (1 test) | two `not.toBeNull()` for size selectors | `toHaveClass('bg-destructive' / 'bg-green-500')` — size class landed on the **status indicator**, not a stray node |
| TESTQ-01-05 | `tests/unit/services/benchmark/industry-ratios.test.ts` (1 test) | `ratios[id].toBeDefined()` | well-formed numeric `BenchmarkRange`: `typeof min/max === 'number'`, `Number.isFinite`, `min <= max`. (testq-01's literal "finite number" suggestion was wrong — the value is a range object, not a scalar; adapted to the actual shape) |
| TESTQ-01-06 | `tests/unit/services/export/export-types.test.ts` (1 test) | `MIME/EXT[fmt].toBeTruthy()` | MIME is a `string` containing `/`; extension is a `string` starting with `.` — MIME/extension **shape**, not just truthy. Exact canonical strings already pinned by sibling tests L31-50 |
| TESTQ-01-07 | `tests/components/import/types.test.ts` (1 test) | `descriptions[type].{ja,en}.toBeTruthy()` | `typeof === 'string'` + `length > 0` — catches `true`/number/empty placeholder without coupling to user-facing copy |

## Why each weakening was addressed (not the literal PENDING suggestion where wrong)

testq-01 marked every recommendation `PENDING HUMAN DETERMINATION`. Two literal
suggestions did not match the actual code and were adapted (correctly) rather than
applied verbatim:

- **TESTQ-01-05**: audit suggested `expect(typeof v).toBe('number')`. The actual value
  is a `BenchmarkRange` object (`{min,q1,median,q3,max}`), so a scalar check would fail.
  Strengthened to assert a well-formed numeric range instead.
- **TESTQ-01-02**: audit suggested `toEqual(saved)`. `saveReport`/`createReport` bump
  `metadata.version` and refresh `updatedAt` on write, so exact equality cannot hold.
  Used `toMatchObject` over the non-mutated content fields + an explicit version-bump
  assertion.

## Tier-B left as-is (intentional)

The remaining `weak-nullish` flags in these files (cache-miss→null, unknown-sector→
undefined, corrupt-JSON→null, renders-nothing→null, delete-missing→undefined, no-rate
→undefined) are the **correct** assertions for explicit null/undefined contracts and
were deliberately not changed, per testq-01 §5.

## Verification

- `node scripts/test-quality-report.mjs <7 files>` → `weak-truthy(A)=0` (was 7).
- `pnpm exec vitest run <7 files>` → **123/123 passed** (strengthened assertions hold
  against real behavior).
- `node scripts/autopm_verify.mjs --changed-only` → **exit 0** (typecheck 0 errors,
  eslint --max-warnings=0 clean, vitest 123/123).

Diff: 7 files, +61/−17, all under `tests/**`. No new deps, no `any`/`@ts-ignore`/
`.skip`/lint-disable, no coverage-threshold change.
