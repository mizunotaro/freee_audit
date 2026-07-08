# COV-LIB-01 — Unit-test coverage for `src/lib/utils.ts` + `src/lib/mappers`

## Outcome
Added two focused unit-test files (no production code touched) covering the only
in-scope modules that lacked a mirror test under `tests/unit/lib`:

| Source module | Test file | Tests |
|---|---|---|
| `src/lib/utils.ts` (18 exports) | `tests/unit/lib/utils.test.ts` | 54 |
| `src/lib/mappers/ir-report-mapper.ts` (5 exports) | `tests/unit/lib/mappers/ir-report-mapper.test.ts` | 19 |

`node scripts/autopm_verify.mjs --changed-only` → **exit 0**
(typecheck 0 errors whole-repo, eslint 0 warnings, vitest **73/73 green** on the 2
resolved files).

## Scope note: only 2 modules were untested
The task scope is fixed to `src/lib/utils`, `src/lib/utils.ts`, and `src/lib/mappers`.
Enumerating exported functions lacking a mirror test under `tests/unit/lib`:

- **`src/lib/utils/`** (the directory) — already fully covered by
  `tests/unit/lib/utils/{html-sanitize,safe-formula-evaluator,secure-logger,timeout}.test.ts`.
  All 4 modules have mirror tests; nothing to add.
- **`src/lib/utils.ts`** (the root file) — **untested** → covered here.
- **`src/lib/mappers/ir-report-mapper.ts`** — **untested** → covered here.

So the honest "up to ~10 modules" yield for *this* scope is 2 modules. No modules were
invented outside the stated paths.

## Approach
- **Pure logic, no mocking needed.** `utils.ts` depends only on `clsx`/`tailwind-merge`;
  the mapper imports only local type interfaces (`@/types/ir-report`,
  `@/types/reports/ir-report`) — **no Prisma client, DB, or IO**. So tests are direct
  call-and-assert, no factories/stubs/IO-boundary mocks required.
- **Happy path + key edge/error per export.** Examples: `formatChange` over
  undefined/previous-0/up/down/equal; `parseCsv` quoted-comma, value trimming, and the
  trailing-newline → trailing-empty-row behavior; `getFiscalYear` across the April
  boundary incl. the boundary month and a custom start month; `addMonths` year wrap and
  the Jan-31→Mar overflow plus immutability; `safeDivide`/`calculateGrowthRate` zero &
  negative-previous branches; `getMonthName` out-of-range → `''`.
- **Mapper defensive branches exercised without `any`.** The closed-union fields
  (`sectionType`, `eventType`, `status`) and the `Date | string` timestamp fields are
  typed as `Date` / a fixed union, so the defensive `?? default` and
  `instanceof Date ? toISOString() : String()` branches are unreachable through the
  public types. They are covered via `as unknown as <Type>` assertions (double
  assertion, **not** `any`) on a string literal — e.g.
  `'UNKNOWN' as unknown as IRReport['status']` → asserts the `?? 'draft'` default.
- **Result type**: not applicable — neither module returns `Result<T,E>` and the task
  rule says *new helpers* should; these are tests of existing pure functions, no new
  helpers added.

## Constraints honored
- No Class-A path touched (read-only reference to types only). No `any`,
  `@ts-ignore`, `@ts-expect-error`, `.skip`, lint-disable, or threshold change.
- Additive only (2 new files); no production/dependency changes.
- Ran **only** the 2 new files via vitest, never the full suite (known OOM).

## Environment setup performed (not a code change)
This worktree (`worktrees/cov-lib-01`) shipped with an **empty `node_modules`**. Before
the gate could run: `corepack pnpm install --frozen-lockfile` (≈30 s, store hardlinks,
no new deps) then `corepack pnpm db:generate` (so Prisma model types resolve and the
whole-repo typecheck is 0 errors). This matches the existing project memory note
`verify-gate-needs-prisma-generate`; no new memory written.

## Files changed
- `tests/unit/lib/utils.test.ts` (new, 54 tests)
- `tests/unit/lib/mappers/ir-report-mapper.test.ts` (new, 19 tests)
