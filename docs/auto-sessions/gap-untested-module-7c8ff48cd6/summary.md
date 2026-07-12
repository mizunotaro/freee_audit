# gap-untested-module-7c8ff48cd6 — unit tests for `src/lib/data/sample-therapeutics-data.ts`

**Risk class:** C · **Detected:** 2026-07-09 · **Target:** `src/lib/data/sample-therapeutics-data.ts`

## Context

The target module exports a single static sample-data object
(`sampleTherapeuticsData`) plus its `typeof` type (`SampleTherapeuticsData`).
It is pure declarative data — no functions, no I/O, no collaborators — so the
test strategy is **structural completeness + internal numerical consistency +
fail-safe consumability** (JSON-serializable, plain object, type-correct).

A baseline test file already existed at
`tests/unit/lib/data/sample-therapeutics-data.test.ts` (20 tests). This task
**extended** it rather than creating a duplicate (the gap scan was stale).

## Outcome

- **File touched:** `tests/unit/lib/data/sample-therapeutics-data.test.ts`
  (extended in place; no source changes).
- **Tests:** 20 → **61** (+41 new assertions).
- **Gate:** `vitest` 61/61 pass · `eslint --max-warnings=0` clean · `prettier`
  clean · `tsc --noEmit` 0 errors.

## New assertions added (41)

### `company profile`
- All bilingual profile fields present (`name`, `nameEn`, `stage=Series A`,
  `leadCompound=STX-001`, indication contains オンコロジー, phase contains
  Preclinical).
- `fiscalYearStart` is a valid calendar month (1–12).

### `funding history`
- Series A `amount` > seed `amount`.
- `postMoneyValuation` > raised `amount`.
- At least one investor named per round (lead + others + seed investors).

### `balance sheet sub-structure`
- Intangible line items sum to `totalIntangibleAssets`.
- Investment line items sum to `totalInvestments`.
- Current-liability line items sum to `totalCurrentLiabilities`.
- Fixed-liability line items sum to `totalFixedLiabilities`.
- `currentLiabilities + fixedLiabilities = totalLiabilities`.

### `profit & loss sub-structure`
- Revenue streams sum to `totalRevenue`.
- `internal + external = totalRd`.
- SGA groups (personnel + professional + facilities + other) sum to `totalSga`.
- `totalRd + totalSga + depreciation = totalExpenses`.
- `totalRevenue − totalExpenses = operatingLoss`.

### `cash flow sub-structure`
- Investing line items sum to `totalInvesting`.
- Financing line items sum to `totalFinancing`.
- `operating + investing + financing = netChangeInCash`.

### `monthly burn (extended)`
- Month sequence `[4…12,1,2,3]` and starts at `fiscalYearStart`.
- `rdSpend` strictly increasing across all 12 months.
- Final `cashBalance` equals `cashFlow.endingCash` (cross-section link).
- Every burn figure ≥ 0 (boundary/non-negative guard).

### `R&D pipeline`
- Lead program carries code/phase and a dated timeline.
- Every discovery program has a non-empty code and phase.

### `CRO / CDMO partners`
- Both `cro` and `cdmo` arrays are non-empty.
- Every partner has name, services, non-negative contract value, and status.

### `team (extended)`
- Exactly 4 key personnel, each with name/title/background.

### `KPIs (extended)`
- `monthlyBurnRate.peak`/`lowest` reconcile to `max`/`min` of the monthly
  `totalBurn` series.
- `externalRdRatio + internalRdRatio ≈ 1` (2 dp).
- All three liquidity ratios positive.

### `budgets (extended)`
- Every R&D budget row has a category + numeric budget + numeric actual.
- Every SGA budget row likewise.

### `milestones`
- Non-empty timeline.
- All `status` values in `{completed, in_progress, planned}` (enum guard).
- Every milestone carries a date and numeric `impact`.

### `peer companies`
- Non-empty peer set.
- Every peer has positive `marketCap`/`cash`/`burnRate`/`runway`.

### `type & fail-safe consumption` (fail-safe)
- `JSON.parse(JSON.stringify(d))` deep-equals `d` — guarantees the payload is
  serializable (no `Date`, function, `undefined`, or cycle), so it is safe to
  send over the wire or store. This is the module's fail-safe contract.
- Recursive leaf-type walk: every scalar leaf is string/number/boolean or null
  — catches an accidental `Date` or method sneaking into sample data.
- `Object.getPrototypeOf(d) === Object.prototype` — plain object, no class.
- `d` is assignable to the exported `SampleTherapeuticsData` type.

## Coverage rationale / deliberate exclusions

Each numerical assertion was verified against the literal values before being
written, so every test asserts an identity that **actually holds** in the data.
Three illustrative figures were deliberately **not** asserted because the
sample data does not internally reconcile on them (they are stylised, not
derived):

- `fixedAssets.tangible.netTangibleAssets` (466M) ≠ sum of net tangible line
  items (456M). The existing test uses `netTangibleAssets` directly, so
  `totalFixedAssets` still reconciles; only the line-item→net rollup is loose.
- `equity.totalEquity` (1,863M) ≠ sum of equity components (1,620M). The stated
  `totalEquity` is the value that balances `assets = liabilities + equity`
  (already asserted in the baseline); component rollup is illustrative.
- `kpis.monthlyBurnRate.average` (165M) ≠ arithmetic mean of the 12 monthly
  burns (~154M). Only `peak`/`lowest` (which reconcile) are asserted.

These are sample-data artefacts, not regressions; flagging them here rather
than encoding them as failing tests.

## How to run

```bash
corepack pnpm vitest run tests/unit/lib/data/sample-therapeutics-data.test.ts
```
