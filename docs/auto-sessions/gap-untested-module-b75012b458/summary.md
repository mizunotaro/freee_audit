# gap-untested-module-b75012b458 — Unit tests for `src/jobs/scheduler.ts`

**Target:** `src/jobs/scheduler.ts`
**Test file:** `tests/unit/jobs/scheduler.ts` → `tests/unit/jobs/scheduler.test.ts`
**Risk class:** C
**Result:** 16/16 tests pass (was 2/2 — extended, not duplicated)

## Starting point

A test file already existed (`gap tasks often already satisfied`): it covered only the
`PERF-03-06` concerns — the weekly/monthly audit stagger off the daily 02:00 minute and the
inter-job re-entrancy guard. It did **not** exercise the other three public exports, the
cron-callback success/error paths, or the env-driven job-disable path. The existing two
assertion sets were preserved verbatim and folded into a broader `src/jobs/scheduler`
describe.

## Public surface covered

All four exports of `src/jobs/scheduler.ts` are now exercised:

| Export | Before | After |
|---|---|---|
| `startScheduler()` | partial (stagger + re-entrancy) | + schedule/timezone registration, success path, error/fail-safe path, env-disabled path |
| `stopScheduler()` | — | covered |
| `getJobStatus()` | — | covered (pre- and post-scheduling) |
| `runJobManually(name)` | — | covered (not-found, happy, Error, non-Error, date windows) |

`node-cron` is mocked so no real timers are scheduled (deterministic). `runAuditJob`,
`syncJournals`, `fetchExchangeRates` are mocked so no real collaborators run.

## Assertions added

### `startScheduler`
- **Schedules every enabled job (5)** with the correct cron expressions and asserts every
  captured `cron.schedule` call received `{ timezone: 'Asia/Tokyo' }` as its options arg.
- **PERF-03-06 stagger** (preserved): daily `0 2 * * *`, weekly `15 2 * * 1`, monthly
  `30 2 1 * *`; asserts the old colliding expressions `0 2 * * 1` / `0 2 1 * *` are absent.
- **Re-entrancy guard** (preserved): a second tick while the handler is pending is skipped
  → handler called once, `console.warn('...already running')`.
- **Success path**: handler resolves → `console.log('...completed in')`; the slot is freed so
  the next tick runs again (handler called twice). Covers the `finally { runningJobs.delete }`.
- **Error path / fail-safe**: handler rejects → wrapper swallows (does not throw),
  `console.error('...failed after', <Error>)`; the slot is still freed so the next tick is not
  permanently blocked (handler called twice). Proves a single failure cannot stall the job.
- **Disabled-job path**: with `WEEKLY_AUDIT_ENABLED=false` / `MONTHLY_AUDIT_ENABLED=false` the
  weekly/monthly jobs are not scheduled (`Skipping disabled job: ...` logged) while the other
  three are. Uses a fresh module via `vi.resetModules()` because the flags are captured at
  module-eval time.

### `stopScheduler`
- Calls `task.stop()` exactly once on every scheduled job; asserts `Stopped job: journal-sync`
  and `All jobs stopped` are logged.
- **No-op safety**: on a freshly-imported module with nothing scheduled, `stopScheduler()`
  does not throw (the `if (job.task)` guard skips absent tasks).

### `getJobStatus`
- **Pre-scheduling** (fresh module): 5 entries, every `running === false`, and the five
  expected job names.
- **Post-scheduling**: every `running === true`; exact metadata for `journal-sync`
  (`0 1 * * *`, `Asia/Tokyo`) plus schedule strings for exchange-rate-fetch / weekly / monthly.

### `runJobManually`
- **Unknown job** → `{ success: false, error: 'Job not found: does-not-exist' }`.
- **Happy path** (`journal-sync`) → `{ success: true }`, `syncJournals` called once,
  `Manually running job: journal-sync` logged.
- **weekly-audit date window**: `notifyOnComplete === true`, ISO-date format, and exactly
  **7 calendar days** between `startDate` and `endDate` (relative check via
  `differenceInCalendarDays` — no absolute-clock dependency).
- **monthly-audit date window**: `notifyOnComplete === true`, `startDate` is the first of a
  month (`^\d{4}-\d{2}-01$`), `endDate` shares its `YYYY-MM` prefix and is greater — i.e. a
  full last-calendar-month window.
- **Error throw (Error)**: handler rejects with `new Error('audit failed')` →
  `{ success: false, error: 'audit failed' }` and `Manual job audit-job failed` is logged.
- **Non-Error throw**: handler rejects with a bare string → `{ success: false, error: '<string>' }`,
  exercising the `error instanceof Error ? … : String(error)` branch.

## Coverage rationale

- **Happy paths**: one per export (`startScheduler` registration, `stopScheduler` stops all,
  `getJobStatus` metadata, `runJobManually` known job + weekly/monthly windows).
- **Edge cases**: empty/unscheduled state (`getJobStatus` pre-schedule, `stopScheduler`
  no-op), unknown job name, env-disabled flags, date-window boundaries (first/last of month,
  7-day span).
- **Error paths**: handler rejection inside the cron callback (logged + swallowed) and inside
  `runJobManually` (both `Error` and non-Error throwables).
- **Fail-safe behavior**: the scheduler's central safety property — a job failure or completion
  must clear the `runningJobs` guard so the job is not permanently stuck — is asserted for both
  the success and rejection branches of the wrapped callback.

## Determinism

- No real timers (`node-cron` mocked), no real collaborators (handlers mocked), no network.
- The only `new Date()` usage is inside the weekly/monthly handlers; assertions on those use
  **relative** calendar checks (7-day diff, same-month prefix), not absolute timestamps.

## Verification

```
corepack pnpm exec vitest run tests/unit/jobs/scheduler.test.ts   # 16/16 pass
corepack pnpm exec vitest run tests/unit/jobs/                    # 38/38 pass (3 files)
corepack pnpm exec eslint tests/unit/jobs/scheduler.test.ts --max-warnings=0   # clean
corepack pnpm typecheck                                           # tsc --noEmit, 0 errors
```
