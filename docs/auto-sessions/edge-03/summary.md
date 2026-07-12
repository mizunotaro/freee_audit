# EDGE-03 — Edge/error-branch depth tests

**Scope:** benchmark / external-info / inventory / peer-companies (non-Class-A services)
**Approach:** Additive `-edge.test.ts` files only — no production source modified, no Class-A
path touched. All assertions are exact-value / real-behavior (no fake green, no `.skip`,
no `any`, no lint-disables, no threshold lowering).

## Files added (4 test files, 37 tests)

### `tests/unit/services/benchmark/benchmark-service-edge.test.ts` (19 tests)
Exact-value coverage of `BenchmarkService` pure branches that the existing loose tests only
range-checked (`>=0`/`<=100`):
- `calculatePercentile` — all 6 branches with exact values on manufacturing `current_ratio`
  (`{min:80,q1:100,median:150,q3:200,max:280}`): `<=min→0`, `>=max→100`, `(min,q1]→12.5/25`,
  `(q1,median]→37.5/50`, `(median,q3]→62.5/75`, `(q3,max)→87.5`.
- `createComparison` — `deviation = value−median`; `zScore = (v−median)/((q3−q1)/1.35)`
  (`toBeCloseTo`); **`zScore===0` via the degenerate `q3===q1` branch** (service
  `inventory_turnover`, all-zero range).
- `status` — the inclusive 5% median band `[median*0.95, median*1.05]` = `[142.5,157.5]`:
  `142→below`, `143/150/157→at`, `158→above`.
- `overallPercentile` empty-input `→50`; averaged-and-rounded (`round(87.5)=88`).
- strengths/weaknesses exact wording + the `slice(0,5)` cap (7 ≥75th-pct metrics → 5 strengths).
- metrics-option gap (requested metric absent from ratios → no comparison); default-sector
  parity with explicit `'other'`.

### `tests/unit/services/external-info/external-info-service-edge.test.ts` (8 tests)
- Whitespace-only query → `invalid_query` (existing test only covered `''`).
- Explicit source list with no enabled source → `no_sources`.
- Non-matching query → `no_results` (mock source yields zero items).
- Cache hit: second identical query served from cache, source `fetch` called exactly once
  (verified via `vi.spyOn` on the resolved source).
- `mergeResults` dedup + sort: a `BaseInfoSource` subclass returns two same-`source:title`
  items (keeps higher relevance) plus a third → asserts collapse + relevance-desc ordering.
- Empty-result source → `no_results`; `removeSource` then fetch → `no_sources`; disabled
  source (`isEnabled()===false`) → `no_sources`.

### `tests/unit/services/peer-companies/peer-selector-ai-edge.test.ts` (4 tests)
- AI throw → rule-based fallback (suggestWithAI `catch` → `suggestWithRules`).
- Malformed JSON inside braces → `parseAIResponse` `catch` → `[]`.
- `createSeededRandom` throw → top-level `suggestPeers` `catch` → `suggestion_failed`.
- Deterministic score formula `1 − index*0.1` (descending, `scores[0]===1`).

### `tests/unit/services/inventory/inventory-adjustment-edge.test.ts` (6 tests)
- `detectInventoryAlerts` variance strict-threshold boundary: rate **equal** to threshold
  → no `LARGE_VARIANCE` (strict `>`); rate `0.201` → `error`-severity alert; custom
  threshold `0.5` boundary honored.
- `analyzeInventoryTrend` stable-branch variants: mixed last-3 `[+,−,0]` → stable;
  exactly 2 points → stable (insufficient for trend); all-zero last-3 → stable.

## Verification
`node scripts/autopm_verify.mjs --changed-only` → **exit 0**
(typecheck 0 errors, eslint 0 warnings, vitest 37/37 passed).

## Notes / honest gaps left
- `METRIC_NAMES[metricId] ?? metricId` fallback in `createComparison` is effectively dead —
  every benchmark range key is one of the 11 known metric ids, so no input reaches the
  fallback. Not tested (would be fake green).
- `suggestWithRules` score floor `Math.max(0.3, 1 − index*0.1)` is unreachable through the
  public path (peer arrays cap at length 5 ⇒ index ∈ [0,4] ⇒ score ≥ 0.6). Not tested.
