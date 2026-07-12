# gap-untested-module-44d367d4fa — Unit tests for `src/types/reports/budget.ts`

**Target:** `src/types/reports/budget.ts` (73 lines, 9 `interface` declarations, **type-only module** — no runtime exports)
**Risk class:** C
**Deliverable:** `tests/unit/types/reports/budget.test.ts` (28 tests, all passing)

---

## Why a type-only module still gets a test

`budget.ts` exports only interfaces. Type-stripping yields an empty module, and
`vitest.config.ts` coverage **excludes** `src/types/**`, so coverage % is never the
metric here. Per repo convention (siblings `tests/unit/types/accounting-standard.test.ts`,
`result.test.ts`) and the `testing-pure-types-modules` guidance, a test is still written
using **three layers** so the suite is not fake-green:

1. **Runtime `expect()`** on a representative object per interface — vitest catches this at runtime.
2. **Typed assignment** `const x: InterfaceName = {…}` — `tsc` catches removed/renamed required fields.
3. **`expectTypeOf`** — asserts union membership, optional-vs-required, exact shape, and nested array element types (only fails under `pnpm typecheck`).

The task spec's "error paths / timeouts" requirement does not apply to a type-only module;
it is substituted with **fail-safe** cases (minimal-constructible objects, truly-optional fields,
empty collections, zeroed totals).

---

## Coverage matrix (9/9 interfaces)

| Interface | Runtime `expect` | Typed assignment | `expectTypeOf` | Union | Optional | Edge / fail-safe |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| `BudgetItem` | ✓ | ✓ | ✓ (exact shape + field types) | — | — | zero, overspend (>1 rate), `Infinity`/`-Infinity`/`NaN`/`MAX_VALUE` |
| `BudgetRecord` | ✓ | ✓ | ✓ (field types + `departmentId`) | — | ✓ `departmentId?` (omitted/set/null) | — |
| `BudgetVsActual` | ✓ | ✓ | ✓ (items array + totals shape) | — | — | empty `items[]` + zeroed totals |
| `StageLevelItem` | ✓ | ✓ | ✓ (`status` union) | ✓ `good\|warning\|bad` | — | — |
| `AccountLevelItem` | ✓ | ✓ | ✓ (field types + `status` union) | ✓ `good\|warning\|bad` | — | — |
| `DetailedBudget` | ✓ | ✓ | ✓ (array element types) | — | — | empty `stageLevel`/`accountLevel` |
| `VarianceItem` | ✓ | ✓ | ✓ (`type` union) | ✓ `over\|under` | — | zero `variancePercent` |
| `VarianceData` | ✓ | ✓ | ✓ (array element type) | — | — | empty `significantVariances` |
| `BudgetReportData` | ✓ | ✓ | ✓ (4 member types) | — | — | minimal fail-safe report |

Plus one smoke test asserting the module resolves as type-only
(`Object.keys(await import(...)).length === 0`).

---

## Every assertion added

### Smoke
- `await import('@/types/reports/budget')` resolves and `toBeDefined()`.
- `Object.keys(mod)` has length 0 → proves the module is purely type exports (type-stripped to empty).

### BudgetItem (5 tests)
- Runtime: all 6 fields read back (`accountCode`, `accountName`, `budgetAmount`, `actualAmount`, `variance`, `achievementRate`).
- `expectTypeOf`: each field `toBeString()` / `toBeNumber()`.
- `expectTypeOf<BudgetItem>().toEqualTypeOf<{...}>()` — exact 6-field shape (no optionals, no extras).
- Boundary: zero object (`''`/`0`); overspend (`actualAmount`>budget, `achievementRate`=1.5); extreme (`Number.MAX_VALUE`, `Infinity`, `-Infinity`, `NaN` confirmed via `Number.isNaN`).

### BudgetRecord (3 tests)
- Runtime: required fields read back.
- `departmentId` optional & nullable: omitted → `undefined`, set → `'dept-A'`, `null` → `toBeNull()`; `expectTypeOf<...['departmentId']>().toEqualTypeOf<string | null | undefined>()`.
- `expectTypeOf`: required field types enforced.

### BudgetVsActual (4 tests)
- Runtime: `fiscalYear`, `month`, `items` length, and each totals sub-object's `budget`/`variance`/`rate`.
- `items` is `Array.isArray` and `toEqualTypeOf<BudgetItem[]>`.
- `totals` exact shape via `toEqualTypeOf` (3 sub-objects, each `{budget,actual,variance,rate}`) **and** runtime `Object.keys(...).sort()` equals `['expenses','operatingIncome','revenue']`.
- Fail-safe: empty `items: []` + zeroed totals construct cleanly.

### StageLevelItem (2 tests)
- Runtime: `stage`, `rate`, `status`.
- `status` union: member array length 3 + `new Set().size` 3 + `toEqualTypeOf<'good'|'warning'|'bad'>`.

### AccountLevelItem (3 tests)
- Runtime: `code`, `category`, `status`.
- `expectTypeOf`: 7 field types enforced.
- `status` union: same 3-member assertion as StageLevelItem.

### DetailedBudget (3 tests)
- Runtime: both array lengths.
- `stageLevel`/`accountLevel` element types match `StageLevelItem[]` / `AccountLevelItem[]`.
- Fail-safe: both arrays empty.

### VarianceItem (3 tests)
- Runtime: `over` and `under` variants.
- `type` union: member array length 2 + `new Set().size` 2 + `toEqualTypeOf<'over'|'under'>`.
- Boundary: `variancePercent: 0`.

### VarianceData (2 tests)
- Wraps `significantVariances` as `VarianceItem[]`.
- Fail-safe: empty array.

### BudgetReportData (3 tests)
- Runtime: aggregate reads back across all 4 members.
- `expectTypeOf`: `budgetVsActual`/`detailedBudget`/`variance`/`budgets` match their interfaces.
- Fail-safe: fully minimal report (zeroed totals, all collections empty).

---

## Union membership guards (compile + runtime)

These are the strongest guards against silent API drift (a member removed/renamed would break both the runtime `toHaveLength`/`Set.size` and the compile-time `toEqualTypeOf`):

- `StageLevelItem['status']` = `'good' | 'warning' | 'bad'` (3)
- `AccountLevelItem['status']` = `'good' | 'warning' | 'bad'` (3)
- `VarianceItem['type']` = `'over' | 'under'` (2)

---

## Verify gates (all green)

| Gate | Command | Result |
|---|---|---|
| Bootstrap | `corepack pnpm install --frozen-lockfile` | OK (30.5s) |
| Prisma client | `corepack pnpm db:generate` | OK (clears ~298 phantom TS7006) |
| Unit tests | `corepack pnpm exec vitest run tests/unit/types/reports/budget.test.ts` | **28/28 passed** |
| Lint | `corepack pnpm exec eslint <file> --max-warnings=0` | exit 0 |
| Typecheck | `corepack pnpm exec tsc --noEmit` (whole repo) | exit 0 |

**Note on placement:** the task prompt's suggested path `tests/types/reports/` does not exist
in this repo. Per CLAUDE.md §3 and the `tests/unit/` mirror convention, the file lives at
`tests/unit/types/reports/budget.test.ts`.
