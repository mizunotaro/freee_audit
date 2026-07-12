# gap-untested-module-1ca9cd2aa2 — Unit tests for valuation-ai-advisor.tsx

**Target:** `src/components/valuation/valuation-ai-advisor.tsx`
**Risk class:** C
**Test file:** `tests/components/valuation/valuation-ai-advisor.test.tsx`

## Starting point

A test file already existed (gap scan was stale on this point — consistent with the
`gap-tasks-often-already-satisfied` pattern). The pre-existing 6 tests covered only the
`resolveDisplayState`-driven states (loading / error / empty) plus the QA progressbar's
ARIA contract. The **entire `ready` state** — the `QASection`, `AdviceSection`, and
`AdviceItem` render paths — was untested. This session **extends** the existing file rather
than creating a duplicate.

## What was added (21 new test cases → 27 total, all passing)

### ready state with advice (`AdviceSection` / `AdviceItem`)
- **industry + confidence badge** — asserts `high confidence` badge text renders and the
  `Industry: software` description is present.
- **WACC recommendation percentage formatting** — asserts each of the four `AdviceItem`
  labels (`Risk-Free Rate`, `Market Risk Premium`, `Beta`, `Cost of Debt`) plus their
  formatted values via the `(value * 100).toFixed(2) + '%'` contract
  (`2.50%`, `6.00%`, `120.00%`, `3.00%`) and a range string `Range: 1.5% - 3.5%`.
  This characterizes the actual behavior, including the (quirky) display of `beta` as a
  percentage (`120.00%`).
- **beta unlevered + cost-of-debt spread extras** — `Unlevered: 0.95` and `Spread: 1.50%`.
- **optimal capital structure** — `Optimal Capital Structure` heading, `D/E Ratio: 0.25`,
  `Industry Avg: 0.20` (both `toFixed(2)`).
- **last-updated date** — the `Last updated:` label renders and the DOM contains
  `new Date(advice.lastUpdated).toLocaleDateString()` computed identically in the test
  (deterministic: same Node process ⇒ same default locale).
- **Refresh button** — in the ready state `onRefresh` renders a `Refresh` button (vs `Retry`
  in the error state); clicking it calls `onRefresh` exactly once.
- **className passthrough** — a custom `className` reaches the root `Card`
  (`cn('w-full', className)`).
- **warnings** — when `advice.warnings` is non-empty, every warning string renders.
- **advice-only** — with `qaResult === null`, the advice section renders and the QA section
  does not (`WACC Recommendations` present, `Quality Assurance` absent).
- **both sections** — with `advice` and `qaResult` both supplied, both headers render.

### ready state with qaResult (`QASection`)
- **Issues Found badge** — `passed: false` yields the `Issues Found` badge (vs `Passed`).
- **issue messages / suggestions / count** — three issues of each severity render their
  message and suggestion; the header reads `Issues (3)` (true count, not the sliced count).
- **severity → tone mapping** — error/warning/info issues land inside containers carrying
  `text-red-500` / `text-yellow-600` / `text-blue-500` respectively (verified via
  `closest('[class*=…]')`).
- **issue slice cap (5)** — 7 issues ⇒ header `Issues (7)` but only issues 1–5 render;
  issues 6–7 are absent.
- **recommendation slice cap (3)** — 5 recommendations ⇒ only recs 1–3 render; recs 4–5
  absent.
- **score color thresholds (parameterized, 6 cases)** — boundary coverage of the
  `score >= 80 ? green : score >= 60 ? yellow : red` fill rule:
  `100→green`, `80→green`, `79→yellow`, `60→yellow`, `59→red`, `0→red`.

## Coverage rationale

| Requirement | How met |
|---|---|
| Happy-path for each public entry point | The component's sole export is `ValuationAIAdvisor`; every internal sub-component (`QASection`, `AdviceSection`, `AdviceItem`) is exercised through it in the ready state. |
| Edge / boundary | Score thresholds at the exact boundaries (80/79, 60/59, 0, 100); empty inputs (empty-state, advice-only vs both); slice limits (exactly 5/6/7 issues, exactly 3/4/5 recs). |
| Error / dependency-failure paths | Pre-existing error-state tests retained (alert + retry + loading-precedence). |
| Fail-safe / safe degradation | Loading is `aria-busy` status; error is an `alert`; empty state shows guidance; `passed:false` degrades to a destructive `Issues Found` badge; issue/rec lists cap their rendering so a flood of issues cannot blow out the UI. |
| Determinism | No network, no wall-clock (`lastUpdated` is a fixed input string formatted identically in test and component); `onRefresh` is a `vi.fn()` mock; no real collaborators instantiated. |

## Notes / out of scope

- The defensive fallback text `'Failed to load AI advisor'` (`error || '…'`) and the
  `state.success ? … : 'ready'` guard are **unreachable through the public React props API**
  (loading/error/hasData are always well-typed, and `resolveDisplayState` only returns
  `'error'` for a non-empty error string), so no test forces those branches; characterizing
  unreachable defensive code would require hacking internals and is intentionally omitted.
- No new test-framework dependencies. Uses the existing Vitest + @testing-library/react
  + jsdom stack already configured for this directory.

## Verification

```
vitest run tests/components/valuation/valuation-ai-advisor.test.tsx  → 27 passed
vitest run tests/components/valuation/                                → 45 passed (5 files)
eslint <file> --max-warnings=0                                        → exit 0
tsc --noEmit                                                          → exit 0
```
