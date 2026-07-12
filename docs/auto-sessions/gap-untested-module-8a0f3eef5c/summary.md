# gap-untested-module-8a0f3eef5c — Unit tests for `src/types/journal.ts`

**Risk class:** C
**Target:** `src/types/journal.ts` (pure type-only module — 6 interfaces, no runtime exports)
**Test file:** `tests/unit/types/journal.test.ts`
**Result:** 31/31 tests pass · `tsc --noEmit` 0 errors · `eslint --max-warnings=0` 0 warnings

---

## Why a test exists for a type-only module

`src/types/journal.ts` exports only `interface` declarations, so type-stripping
yields an empty module and vitest coverage excludes `src/types/**` (see
`vitest.config.ts`). Per repo convention (siblings `tests/unit/types/result.test.ts`,
`accounting-standard.test.ts`), type modules still get a test deliverable. Coverage
% is never the metric — green runtime tests + clean `tsc` are.

## Approach — three layers (avoids fake-green)

1. **Runtime `expect()`** on a representative constructed object per interface —
   vitest catches renamed/removed fields and verifies runtime values.
2. **Typed assignment** `const x: InterfaceName = { ... }` — `tsc` catches a
   removed/renamed *required* field (the assignment stops typechecking).
3. **`expectTypeOf`** (global via `vitest.config.ts` `globals: true`) for union
   membership, optional-vs-required, and `Record`-shape — these only fail under
   `pnpm typecheck`, not at runtime, so they must be paired with layer 1.

For unions, the fully-typed member array is built and its exact length +
`new Set().size` asserted (catches removal/rename at both runtime and compile time).

## Interfaces covered (all 6)

| Interface | Layer-1 runtime | Layer-2 assignment | Layer-3 expectTypeOf |
|-----------|:--:|:--:|:--:|
| `Journal` | ✅ | ✅ | ✅ |
| `JournalEntry` | ✅ | ✅ | ✅ |
| `JournalWithDocument` | ✅ | ✅ | ✅ |
| `Document` | ✅ | ✅ | ✅ |
| `CreateJournalInput` | ✅ | ✅ | ✅ |
| `JournalQueryParams` | ✅ | ✅ | ✅ |

## Assertions added (31 tests)

### module resolution (1)
- `await import('@/types/journal')` resolves to a defined object (ESM smoke test).

### auditStatus union (2)
- Exactly the 4 literals `['PENDING','PASSED','FAILED','SKIPPED']`, no dupes (`Set.size === 4`).
- `Journal['auditStatus']` typed as the 4-literal union; `JournalQueryParams['auditStatus']` as the union `| undefined`.

### Journal (6)
- Fully-populated runtime construction — every field read back.
- Exact key set (`Object.keys().sort()`) for a fully-populated object (14 keys).
- Minimal-constructible: `taxType`/`documentId` omitted → runtime `undefined`; `amount`/`taxAmount` 0, empty `description`.
- Boundary numerics: `amount = Number.MAX_SAFE_INTEGER`, `taxAmount = -1`.
- Every required field typed non-optional (`toEqualTypeOf<T>()`, not `T | undefined`).
- `taxType`/`documentId` typed optional (`string | undefined` + `toMatchTypeOf<{ taxType?: string }>`).

### JournalEntry (4)
- Fully-populated runtime construction.
- Minimal-constructible without `taxType` → 7 keys.
- `taxType` optional, all other fields required.
- Structural subset assertion + negative assertion it does **not** carry `auditStatus`.

### Document (5)
- Fully-populated runtime construction.
- Exact key set (10 keys).
- Minimal-constructible: `freeeDocumentId`/`journalId` omitted → `undefined`; `fileSize` 0.
- `freeeDocumentId`/`journalId` typed optional.
- All required fields typed non-optional.

### JournalWithDocument (4)
- `expectTypeOf().toMatchTypeOf<Journal>()` (extends Journal) + has `document`/`auditResult` properties.
- Runtime construction with nested `Document` and full `AuditResult` (issues array, status union); status asserted against the 3-member `AuditResult['status']` union.
- `document`/`auditResult` typed optional (`Document | undefined`, `AuditResult | undefined`).
- Constructible from a bare `Journal` (extensions optional → `undefined`).

### CreateJournalInput (5)
- Fully-populated runtime construction.
- Exact key set (10 keys).
- Minimal-constructible (8 keys, optionals omitted).
- `taxType`/`documentId` typed optional.
- **Negative** type assertions: does NOT carry `id`, `auditStatus`, `syncedAt`, `createdAt` (the persistence/lifecycle fields present on `Journal` but not on the input).

### JournalQueryParams (4)
- Minimal-constructible with only `companyId` → exactly 1 key; all filters `undefined`.
- Fully-populated filter set (date range, status, pagination) runtime round-trip.
- `companyId` required; every filter (`startDate`/`endDate`/`auditStatus`/`page`/`limit`) typed optional with correct union/`Date`/`number` shapes.
- Boundary pagination values: `page`/`limit` = 1 and `Number.MAX_SAFE_INTEGER`.

## Fail-safe / edge-case rationale

The task spec's "error paths / timeouts" clause does not apply to a type-only
module (no functions to throw or time out). Substituted fail-safe assertions per
the type-module convention:

- **Minimal-constructible** objects for every interface with optional fields —
  proves optionals are truly optional (no required field was silently added).
- **Boundary numerics** (`0`, `-1`, `Number.MAX_SAFE_INTEGER`) — fields typed
  `number` must hold all numeric values, not a constrained subset.
- **Negative type assertions** (`CreateJournalInput` lacks `id`/`auditStatus`/
  `syncedAt`/`createdAt`) — guards against an input type accidentally inheriting
  lifecycle fields it must not accept from callers.
- **Union completeness** (4 audit statuses, 3 audit-result statuses) — guards
  against a union member being dropped, which would silently narrow valid state.

## Gates run

```
corepack pnpm exec vitest run tests/unit/types/journal.test.ts   → 31 passed
corepack pnpm exec tsc --noEmit                                   → 0 errors
corepack pnpm exec eslint tests/unit/types/journal.test.ts --max-warnings=0  → clean
```

No new dependencies added. No production source changed (test-only deliverable).
