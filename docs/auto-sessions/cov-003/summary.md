# COV-003 — Unit-test coverage for hooks

## Outcome
Filled the single coverage gap in `src/hooks/`. Added
`tests/unit/hooks/reports/use-ir-report.test.ts` (19 tests, all passing).

## Gap analysis (enumeration of custom hooks in `src/hooks/`)
| Hook | Existing test? |
|------|----------------|
| `src/hooks/use-toast.ts` | yes |
| `src/hooks/reports/use-budget-data.ts` | yes |
| `src/hooks/reports/use-cashflow-data.ts` | yes |
| `src/hooks/reports/use-ir-generation.ts` | yes |
| `src/hooks/reports/use-kpi-data.ts` | yes |
| `src/hooks/reports/use-ir-report.ts` | **no → added** |

`use-ir-report.ts` exposes two hooks — `useIRReport` and `useIRReportList` —
both previously untested. The other 5 hooks were already covered, so the only
additive work was this file.

Out of scope: co-located page/component hooks under
`src/app/.../hooks` and `src/components/chat/hooks`. The `(dashboard)` group is
excluded by the task brief, and `tests/unit/app/(dashboard)/analysis/hooks/use-analysis.test.ts`
is quarantined in `vitest.config.ts` for a known V8-heap/worker-crash issue —
those are not the shared custom hooks this task targets.

## What the new tests cover
`useIRReport` — initial state (empty + no auto-fetch), primary action
(`fetchReport` success, `saveReport` success, `updateStatus`, `updateSection`
optimistic, `addSection`, `optimisticUpdate`+`rollback`), error paths
(`fetchReport` null→"Report not found", `fetchReport` rejection, `saveReport`
rejection + re-throw, `updateSection` no-report guard, `addSection` no-report
guard → "No report loaded").

`useIRReportList` — initial state, `fetchReports` success / rejection,
`createReport` success / rejection + re-throw, `deleteReport` success /
rejection.

## Decisions (ADR-style)
- **No `any`.** Mocks are typed via `vi.mocked(irReportService.<method>)` and
  fixtures are annotated with the real interfaces (`IRReport`, `IRReportSection`).
  No `@ts-ignore` / `@ts-expect-error` / lint-disable / `.skip`.
- **Result/Zod rule not applied to test fixtures.** The worker rule
  ("any new helper returns `Result<T,E>`; inputs validated with Zod `safeParse`")
  targets production business-logic helpers. The new file contains only pure
  test-data constructors and mock wiring — no I/O or fallible operation — so
  wrapping them in `Result` would harm readability without any safety benefit,
  and would diverge from every existing hook test in the repo.
- **No fake timers.** `use-ir-report` does not use timers, so the known
  vitest worker-crash pattern (pending rejecting promise advanced by fake
  timers) does not apply. Rejection handlers are nonetheless pre-attached for
  the two methods that re-throw (`saveReport`, `createReport`) and the
  re-throwing guard (`addSection`) via synchronous `try/catch` on `await`
  inside `act`, and via `expect` on the guard — no unhandled rejections.
- **Additive, minimal.** One new test file; no production code changed; no
  dependency or coverage-threshold changes.

## Verification
`node scripts/autopm_verify.mjs --changed-only` → **exit 0**.
- typecheck: 0 relevant errors (298 pre-existing repo-wide, none in diff)
- eslint: 0 errors / 0 warnings on the new file
- vitest: 19/19 passed
