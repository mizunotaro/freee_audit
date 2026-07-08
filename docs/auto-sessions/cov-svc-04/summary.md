# COV-SVC-04 — Unit-test coverage: fixed-assets + inventory + account-items

## Scope
Three modules only (each dir contained a single source file):
- `src/services/fixed-assets/depreciation.ts`
- `src/services/inventory/inventory-adjustment.ts`
- `src/services/account-items/account-items-service.ts`

All three already had a mirror test file. Work was therefore **gap-filling + strengthening weak assertions**, not creating new files.

## Coverage gap analysis (exported functions)

| Export | Status before | Action |
|---|---|---|
| `depreciation.importFixedAssetsFromFreee` | **No test at all** | Added 4 tests (success-but-unavailable, API error, exception, non-Error throw) |
| `depreciation.getTotalDepreciationByCategory` | Weak (`keys.length > 0` only) | Added 3 tests asserting real category bucketing + summed amounts + skip-fully-depreciated |
| `depreciation.calculateDepreciation` (declining_balance / fixed_percentage) | Weak (`> 0` only) | Added exact-value tests (30754 / 29333) + 9-row `it.each` over the fixed-percentage rate table |
| `account-items.syncAccountItemsFromFreee` balance mapping | Only `debit` branch covered | Added credit + debit branch tests |
| `inventory.detectInventoryAlerts` | threshold always passed explicitly; `details` shape unasserted | Added default-threshold test (asserts `30.0%` message + `details` incl. `varianceRate: 0.3`) + missing-journal `details.adjustment` shape test |

All other exports were already adequately covered; left untouched.

## Test delta
- `depreciation.test.ts`: 24 → 42 (+18)
- `inventory-adjustment.test.ts`: 29 → 31 (+2)
- `account-items-service.test.ts`: 20 → 22 (+2)
- **Total: 95 tests, 3 files, all passing.**

## Constraints honoured
- Diff is **additive only** (261 insertions, 0 deletions), all under `tests/unit/services/`. **No `src/` or Class-A path touched.**
- No new `any`, `@ts-ignore`, `@ts-expect-error`, `.skip`, lint-disable, or dependency. Mock-resolve casts use `as never` (idiomatic vitest, lint-clean) instead of the `as any` used elsewhere in these files.
- Exact assertion values were hand-computed and cross-checked with `node` (depreciation amounts, floating-point `varianceRate === 0.3`, `toFixed` output, category sums) before being committed — no fake-green.
- Ran only the 3 affected files (`vitest run <files>`); never the full suite.

## Notes for reviewers
- One initially-incorrect assertion (`details.adjustment` to equal the raw prisma row) was corrected: `detectInventoryAlerts` stores the **sanitized** `InventoryAdjustmentResult` (no `companyId`/timestamps), so the assertion now uses `toMatchObject` on the mapped shape. This documents real behavior.
- `importFixedAssetsFromFreee` always returns `imported: 0` today (freee fixed-assets API not yet wired); the tests pin that current contract so a future implementation change will fail loudly.

## Definition of done
`node scripts/autopm_verify.mjs --changed-only` → **exit 0**
(typecheck 0 errors, eslint clean, 95/95 vitest).

## Env steps taken (worktree bootstrap)
`corepack pnpm install --frozen-lockfile` → `corepack pnpm db:generate` (node_modules absent; Prisma client needed to avoid phantom TS errors).
