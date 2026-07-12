# gap-untested-module-f56cdd513c — Unit tests for `src/types/conversion.ts`

**Task:** Add unit tests for `src/types/conversion.ts` (Risk class C, gap-detected 2026-07-09).
**Deliverable:** `tests/unit/types/conversion.test.ts` (104 tests, all passing).

---

## What the target module is

`src/types/conversion.ts` (1113 lines) is a **pure type-only module** for the accounting-standard
conversion subsystem (JGAAP → IFRS / USGAAP). Every export is an `interface` or a string-literal
union; the only statement that is not a type declaration is `export type { AccountingStandard }`
(re-exported from `./accounting-standard`). There is **no runtime code** — `await import()`
resolves to an empty module object.

Per the established `src/types/*` test convention (`tests/unit/types/{journal,ir-report,result,accounting-standard}.test.ts`),
type-only modules still get unit tests with three layers:
1. **Runtime `expect`** on constructed object literals (guards against fake-green — every interface is exercised).
2. **`expectTypeOf`** for union narrowing, alias equality, and presence/absence of properties.
3. **Boundary / fail-safe cases** (zero values, empty arrays, omitted optionals, minimal construction).

## Coverage rationale — every export exercised

### Module-level (2 tests)
- ESM import resolves to a defined object.
- `Object.keys(mod).toEqual([])` — documents the type-only nature and guards against accidental
  runtime exports being silently added.

### Re-export (1 test)
- `AccountingStandard` re-export equals the canonical `'JGAAP' | 'USGAAP' | 'IFRS'` union.

### String-literal unions — exact membership + dedup (12 unions, ~24 tests)
Each union is materialized as a typed array, asserted for exact length, `Set` uniqueness, and the
literal order from the source. `expectTypeOf` confirms case variants are rejected.

| Union | Members |
|-------|---------|
| `AccountCategory` | 14 |
| `ConversionStatus` | 7 |
| `ApprovalStage` | 5 |
| `ApprovalStatus` | 5 |
| `AuditAction` | 21 |
| `MappingType` | 4 |
| `AdjustmentType` | 9 |
| `DisclosureCategory` | 14 |
| `ReferenceType` | 11 |
| `EntityType` | 4 |
| `RationaleType` | 6 |
| (`AccountingStandard`) | 3 |

### Interfaces — runtime construction + minimal/boundary (~70 tests, all 50 interfaces covered)
Every interface is constructed with a fully-populated literal and its key fields asserted at
runtime. For the most safety-relevant ones (financial statements, results, DTOs) an additional
**minimal-constructible** case asserts every optional can be omitted, plus a **boundary** case
(zeroed numerics, empty arrays, ISO-string-vs-Date variants).

Notable domain-specific assertions (these encode the subsystem's invariants, not just shape):
- **`AccountMapping.confidence`** — asserted `0`-bounded (convention: 0–1).
- **`AdjustingEntry`** — debit/credit lines assert `totalDebit === totalCredit` (balanced entry).
- **`ConvertedBalanceSheet`** — `totalAssets === totalLiabilities + totalEquity` (accounting identity),
  plus the `asOfDate`-only zeroed case. Mixed `sourceAccountCode` (present/absent) coverage.
- **`ConvertedProfitLoss`** — `grossProfit === revenue − costOfSales` (derived subtotal invariant).
- **`ConvertedCashFlow`** — `netChangeInCash === operating + investing + financing` (reconciliation).
- **`ConversionProgress.startedAt`** — asserted to accept **both** `Date` and ISO `string`
  (serialization shape), matching the `Date | string` union.
- **`ConversionRule`** — direct/percentage/formula variants each exercised.
- **`AuditReport.byEntityType` / `byRationaleType`** — asserted as `Record<EntityType, number>` /
  `Record<RationaleType, number>` (every key must be present → full-coverage guarantee).
- **`AuditReportSummary.totalRationales === reviewed + pending`** (consistency invariant).
- **`SignificantImpact.impactAmount`** — negative-boundary case (decrease driver).
- **`CreateConversionProjectRequest.targetStandard`** — narrowed to `'USGAAP' | 'IFRS'` (not the
  full `AccountingStandard`, which would include `'JGAAP'`).
- **`CreateRationaleInput`** — asserted to **not** expose `id`/`createdAt`/`updatedAt`
  (input DTO must not carry audit/generated fields).

### Inline unions (type-level)
`MappingCondition.value` (`string | number`), `MappingCondition.operator`,
`ConversionRule.type`, `ChartOfAccountItem.normalBalance` (`debit|credit`),
`ConversionProgress.startedAt` (`Date|string|undefined`), `AdjustmentRecommendation.priority`,
`RiskAssessment.riskLevel`, `ExportConfig.format/language/currency`, `RationaleAuditEntry.action`,
`ConversionRationale.impactDirection`, `MappingSuggestion['alternatives'][number]` ↔
`MappingSuggestionAlternative` alias — all asserted via `expectTypeOf(...).toEqualTypeOf<...>()`.

## Determinism / fail-safe
- All dates are module-level `new Date('...Z')` constants — no clock/random.
- No external collaborators; pure type module imports nothing at runtime.
- Fail-safe boundary cases assert the structures hold at zero/empty/minimal inputs (the subsystem's
  "safe degraded state" for a draft/empty project).

## Verification (autopm gate)
- `corepack pnpm exec vitest run tests/unit/types/conversion.test.ts` → **104 passed / 104**.
- `corepack pnpm exec eslint tests/unit/types/conversion.test.ts --max-warnings=0` → **0 warnings**.
- `corepack pnpm exec tsc --noEmit` (full repo) → **0 errors**.

## Files changed
- **Added:** `tests/unit/types/conversion.test.ts` (104 tests).
- No production source modified (test-only task). `src/types/conversion.ts` is untouched.
