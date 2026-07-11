# LEAK-01 — Vitest memory leak root-caused; both quarantined files un-quarantined

## Outcome
Both quarantined test files are re-enabled and pass; heap is flat. The leak was
**not** one shared cause — each file had its own distinct runaway, and un-quarantining
each surfaced a separate latent bug that the OOM had been masking.

`node scripts/autopm_verify.mjs --changed-only` → **exit 0**
(typecheck 0 errors, eslint 0 warnings, vitest 32/32).

## Files changed (3, +43/−34)
- `src/app/(dashboard)/analysis/hooks/use-analysis.ts` — leak fix + latent AbortError bugs
- `tests/unit/services/conversion/conversion-engine.test.ts` — leak fix + latent test bugs
- `vitest.config.ts` — remove the two `exclude` entries (un-quarantine)

## Root cause 1 — `use-analysis.test.ts` (infinite React render loop)
The hook memoized `fetchData` with `useCallback(..., [period, cacheTtlMs])` and ran it
from `useEffect(..., [fetchData])`. `period` is an **object**; every test (and any
production caller passing an inline literal) supplies a fresh object each render, so
`fetchData` got a new identity every render → the effect re-fired every render →
`setState(...)` with a new object every time → render loop forever. Each iteration
re-allocated the large inline `mockBalanceSheet`/`mockProfitLoss` objects, so the heap
grew without bound until V8 OOM'd (>4 GB; a single test was enough).

**Proof:** importing the module alone was clean (1.6 s); rendering with a *stable*
`period` reference (via `renderHook` `initialProps`) was clean (2.3 s); rendering with
an inline object literal OOM'd (53 s → crash). All three diagnostics (real/fake timers
× resolving/never-resolving fetch) OOM'd identically — the only common factor was the
render.

**Fix (source — hook is not Class-A):** depend on the primitive fields
`[period.fiscalYear, period.month, cacheTtlMs]` (and the same for `refetch`). This is
the correct React idiom and also fixes a genuine production bug (any caller passing a
non-memoized period object would have infinite-looped in prod too).

## Root cause 2 — `conversion-engine.test.ts` (pagination loop never terminates)
`JournalConverter.streamJournals` paginates with `skip`/`take` and only stops when
`prisma.journal.findMany` returns an **empty** page. The tests mocked
`journal.findMany.mockResolvedValue(mockJournals)` — it returned the same 2 rows for
**every** paginated call, so the `while(true)` never broke → `allConversions.push(...)`
forever → OOM. The source pagination is correct (real Prisma returns fewer rows as you
skip past the end); this was a **broken test mock**, not a source bug (and
`src/services/conversion/**` is Class-A read-only anyway).

**Proof:** `dryRun` (no pagination) passed; `execute`/`resume` (both stream journals)
OOM'd; bisecting `execute` to a single test still OOM'd; import-only was clean.

**Fix (test):** make the mock pagination-aware —
`.mockResolvedValueOnce(mockJournals).mockResolvedValue([])` — first page returns rows,
every subsequent page returns `[]` so `streamJournals` terminates.

## Latent bugs the OOM had been masking (fixed, not faked)
Because each file OOM'd before completing, **no test in either file ever actually ran
to completion** — so several pre-existing failures were hidden.

1. **`should ignore AbortError`** — the hook guarded with
   `err instanceof Error && err.name === 'AbortError'`, but `fetch`'s real AbortError is
   a `DOMException`, which is **not** `instanceof Error` in this runtime → guard failed
   → "Unknown error". Fixed the guard to `(err as { name?: unknown }).name === 'AbortError'`
   (environment-independent). The hook also `return`ed on abort without resolving
   `isLoading`; fixed with a **stale-controller guard** (capture the local controller;
   on abort, only set `isLoading=false` if this controller is still current — a lone
   abort resolves loading, a superseded request leaves it to the newer one). Captured
   controller + `controller.signal` accordingly.

2. **`should be abortable`** — asserted `executePromise).rejects.toThrow()`, but
   `execute()`'s contract **always resolves** (returns a `failure` Result; its `catch`
   returns `failure`, never rethrows). The assertion could never pass. Rewrote to
   deterministically exercise the **real** abort path: stream one journal page, issue the
   real `engine.abort()` on the second page request (the controller is registered by
   then, so it lands deterministically — no race), and assert the resolved failure
   Result with message `'Conversion aborted'`. Uses `as never` on the mock impl to
   satisfy vitest's `PrismaPromise` mock typing without `any`.

3. **eslint gate** — the touched test file carried 6 pre-existing warnings (5 unused
   type imports + an unused `balanceCheck`). Removed the dead imports; for
   `balanceCheck`, the test is named "should balance assets = liabilities + equity" but
   only checked `typeof` — asserted the computed balance instead (verified the converter
   produces a balanced BS with the mock data, so this strengthens the test, not fakes it).

## Verification
- `use-analysis.test.ts`: 8/8, 2.75 s (was 53 s → OOM).
- `conversion-engine.test.ts`: 24/24, 2.65 s (was 30 s → OOM).
- Both under real `vitest.config.ts`: 32/32, 3.47 s.
- Representative multi-file run (`tests/unit/services/conversion` + analysis hooks dir,
  27 files / 499 tests incl. both un-quarantined files): **11.3 s, all pass, no OOM** —
  heap flat across files.
- `corepack pnpm typecheck` (whole repo): 0 errors.
- `autopm_verify --changed-only`: exit 0.

## Notes / scope
- No Class-A path touched. `src/services/conversion/**` was read-only reference only.
- No `any` introduced in source. The single `as never` in the test is a non-`any` cast
  to satisfy the Prisma mock typing (the file's existing idiom is `as any`; eslint
  `no-explicit-any` is off repo-wide, but the literal task constraint was honored).
- No `.skip`, `@ts-ignore`, lint-disable, or coverage change.
- Did **not** run the full suite (known OOM) — only the modified files and a bounded
  sibling multi-file run, per constraints.
- Did not run `pnpm build`; the hook change is type-safe and behavior-preserving
  (whole-repo `tsc --noEmit` clean).
