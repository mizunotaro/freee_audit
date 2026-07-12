# COV-RATCHET-01 — Raise vitest coverage thresholds to a safe floor

## Outcome

Ratcheted two of the four vitest coverage thresholds up to a safe floor just
below the **measured** coverage. The other two were left unchanged because the
measured value sits immediately above a 5-point boundary, so any higher
multiple of 5 would leave an unsafe (<1 pt) margin.

| Metric     | Old | **New** | Measured (full run) | Margin to new |
|------------|-----|---------|---------------------|---------------|
| Lines      | 60  | **60**  | 66.00% (19807/30007)   | 6.00 pt |
| Functions  | 55  | **65**  | 69.33% (4721/6809)     | 4.33 pt |
| Branches   | 45  | **55**  | 59.37% (12970/21843)   | 4.37 pt |
| Statements | 60  | **60**  | 65.47% (21020/32102)   | 5.47 pt |

Only `vitest.config.ts` is touched (the `thresholds` block).

## How coverage was measured

The full suite OOMs in a single worker only if the pre-leak-01 heap growth is
present. leak-01 (PR#77, merged to master) fixed that, so peak is bounded by
the single heaviest file (~132 MB). CI still shards into 32 **only for
wall-clock parallelism** — not for memory — and the sharded runs deliberately
drop `--coverage` (`.github/workflows/ci.yml:111-125`), so there is no existing
sharded-merge coverage path to reuse.

The correct way to get one true total on a single machine is a non-sharded
`vitest run --coverage`: vitest merges coverage across workers internally and
prints one istanbul summary. That was run with concurrency and heap bounded to
fit the machine (8 core / ~6 GB free RAM):

```
DATABASE_URL=file:./test.db JWT_SECRET=… ENCRYPTION_KEY=… CSRF_SECRET=…
NODE_OPTIONS=--max-old-space-size=4096 \
  pnpm exec vitest run --coverage --reporter=dot --maxWorkers=4
```

Exit code 0 (current 60/55/45/60 thresholds passed). Authoritative istanbul
summary printed at the end:

```
Statements : 65.47% (21020/32102)
Branches   : 59.37% (12970/21843)
Functions  : 69.33% (4721/6809)
Lines      : 66%    (19807/30007)
```

**Cross-check:** summed `coverage/coverage-final.json` hit counts independently
→ statements 65.48%, functions 69.33%, branches 59.38% (match within rounding;
lines can't be recomputed from the JSON with a naive line-group, the text table
is authoritative for lines). 666 source files in scope.

## Threshold-selection rule

`threshold = floor((measured − 2) / 5) × 5` — the largest multiple of 5 that is
at least 2 points below the measured value. This satisfies every stated
constraint simultaneously and is robust across the whole "2–3 pt" buffer range
the task allows (using 2, 2.5, or 3 pt yields identical thresholds here):

- multiple of 5 ✓
- strictly below actual coverage ✓ (never above)
- ≥ 2 pt margin so a normal drift / flaky delta can't trip CI ✓

### Why lines and statements stay at 60

Lines (66.00%) and statements (65.47%) sit just above the 65 boundary.

- A **65** threshold would leave a **1.0 pt** (lines) / **0.47 pt** (statements)
  margin. A single newly-added untested helper module moves global coverage by
  ~0.1–0.5 pt, so 65 would false-fail CI on the next small change — exactly the
  failure mode the task warns against ("a flaky delta doesn't fail CI").
- The safe floor is therefore **60** (6.0 pt / 5.47 pt margin). Rounding down
  to 65 is not safe; the next-lower multiple of 5 is 60.

Functions (69.33%) and branches (59.37%) have ≥4 pt of headroom above their
nearest-lower 5-boundary, so they ratchet up cleanly: **55 → 65** and **45 → 55**.

## CI note (no behavior change today)

CI's unit-test job runs shards with `pnpm test -- --shard=i/32` and **no
`--coverage`**. Vitest only enforces `thresholds` when coverage is enabled, so
today no CI job gates on these numbers. This change therefore:

- cannot break current CI (thresholds are never evaluated there), and
- establishes the floor that **local `pnpm test:coverage`** and any future
  coverage-gating CI job will enforce.

## Verification

- `node scripts/autopm_verify.mjs --changed-only` → **exit 0** (DoD met). The
  gate classifies the root-level `vitest.config.ts` as `other` and runs no
  typecheck/eslint/vitest step on it; confirmed clean working tree
  (`git status` shows only `M vitest.config.ts`; `coverage/`, `test.db`,
  `dev.db` are gitignored).
- Config-parse sanity: `vitest run` on a probe test file loads the edited
  config and passes (5/5) — no syntax/structure regression.
- No re-run of the full suite was needed: the measured values exceed the new
  thresholds by ≥4.33 pt and coverage is deterministic for a fixed code+test
  set, so a re-run can only reproduce the same numbers.

## Risk

None. Every new threshold is strictly below the measured coverage with a
≥4.33 pt margin, and no threshold was raised above actual. No Class-A path was
modified; the only changed file is `vitest.config.ts`.
