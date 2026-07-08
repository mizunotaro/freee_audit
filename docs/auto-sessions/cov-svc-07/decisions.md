# COV-SVC-07 — Decisions (ADR)

## ADR-001: DD TREND validators — inverted direction labels (observed, not fixed)

**Status:** Accepted (documented; source change deferred)
**Date:** 2026-07-08

### Context

While strengthening the AR / Revenue / Inventory TREND tests (which previously
asserted only `result.success === true` and therefore proved nothing about the
finding logic), tracing `src/services/dd/validators/*.ts` + `base-validator.ts`
`calculateTrend` revealed:

- Each TREND loop collects values newest-year-first:
  `for (i=0; i<lookback; i++) year = fiscalYear - i; push(value[year])`
  → array = `[current, current-1, ..., oldest]`.
- `calculateTrend` treats `array[0]` as the start and `array[last]` as the end, so
  `percentageChange = (oldest - current) / current`.

Net effect: a finding labelled "deteriorating / 売上減少 / 増加傾向" fires when the
metric was moving in the **opposite** direction over calendar time. The three
"detects … trend" tests were green precisely because their (intuitively-correct)
data never tripped the inverted condition.

### Options considered

1. Fix the source: iterate oldest-year-first (ascending) so labels match semantics.
2. Leave source; write tests that assert the actual (current) behavior with a
   documenting comment.

### Decision

**Option 2.** The task scope is *test coverage*; `src/services/dd/validators/**` is
not Class-A but changing validator business logic is a behavior change for real DD
runs and risks the engine/validator test matrix. The three TREND tests now
genuinely trigger and assert the finding (real coverage of the finding branch), each
carrying a comment stating values are collected newest-year-first.

### Consequences

- The finding-producing branches are now covered (previously dead-green).
- The semantic inversion remains in source and is flagged here for a follow-up
  source PR. A correct fix is one line per validator (ascending loop) once confirmed
  against intended DD semantics.

---

## ADR-002: `MA_FINANCIAL_DD_CHECKLIST` immutability assertion was a no-op

**Status:** Accepted
**Date:** 2026-07-08

### Context

`tests/unit/services/dd/checklists/ma-financial-dd.test.ts` had:

```ts
expect(Object.isFrozen(MA_FINANCIAL_DD_CHECKLIST) || Array.isArray(...)).toBe(true)
```

`Array.isArray(...)` is always `true` for an array, so the `||` short-circuits and
the assertion passes regardless of frozen state — a literal fake-green test. The
source declares only a TS `readonly` modifier, so the array is **not** frozen at
runtime.

### Options considered

1. Add `Object.freeze(...)` to the source data modules and assert `isFrozen === true`.
2. Replace the no-op with a real, currently-true assertion; do not change source.

### Decision

**Option 2.** Adding `Object.freeze` is a runtime behavior change beyond the test
mandate, and `DDChecklistService.getChecklistDefinitions` already returns spread
copies (`[...X]`), so there is no live mutation path to guard. Replaced the
defective assertion with a real one: every item exposes a non-empty `titleEn`
(verified present on 16/16 MA items and 25/25 IPO items; `descriptionEn` is
**not** uniformly present, so it was not asserted).

### Consequences

- One fake-green test removed and replaced with real structural coverage.
- Runtime immutability remains type-level only; documented here.
