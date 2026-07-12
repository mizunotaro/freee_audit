# gap-untested-module-d5f557d129 — Unit tests for `status-badge.tsx`

**Target:** `src/components/conversion/status-badge.tsx`
**Test file:** `tests/components/conversion/status-badge.test.tsx` (new)
**Result:** 24 tests, all passing. ESLint `--max-warnings=0` clean. `tsc` reports **0** errors for the new file.

---

## What the module does

`StatusBadge` is a pure presentational component. It maps each `ConversionStatus`
(`draft | mapping | validating | converting | reviewing | completed | error`) to a
Japanese label + a `Badge` variant + (optionally) a status-specific color class, and
applies one of three size paddings (`sm | md | lg`, default `md`). The public surface
is a single named export, `StatusBadge`.

## Coverage rationale

The module's logic is a closed map over a finite union plus three size branches and a
`cn()` (tailwind-merge) class merge. Coverage therefore means:

1. **Completeness** — exercise every member of the `ConversionStatus` union (no status
   left unrendered).
2. **Each size branch** — `sm`/`md`/`lg`, plus the default-`md` branch when `size` is omitted.
3. **Class merging** — the `className` prop is appended and the base badge classes survive.
4. **The one non-trivial behavior** — tailwind-merge: a status-specific `bg-*-100` color
   **replaces** (not layers with) the `secondary` variant's `bg-secondary` base.

## Assertions added (24)

### `StatusBadge — label & variant for every ConversionStatus` (8)
- One per status (7): the correct Japanese label is present and the expected class is
  present —
  - `draft` → `下書き`, `text-foreground` (outline variant survives)
  - `mapping` → `マッピング中`, `bg-blue-100`
  - `validating` → `検証中`, `bg-yellow-100`
  - `converting` → `変換中`, `bg-primary` (default variant survives)
  - `reviewing` → `レビュー中`, `bg-purple-100`
  - `completed` → `完了`, `bg-green-100`
  - `error` → `エラー`, `bg-destructive` (destructive variant survives)
- 4 cases: the colored statuses (`mapping`/`validating`/`reviewing`/`completed`) assert
  the status color is present **and** `bg-secondary` is **absent** — proving the override
  wins rather than double-painting the background.
- 1 case: exactly one badge / one label per render (no duplication).

### `StatusBadge — size variants` (7)
- `sm` → `text-xs`; `md` → `text-sm`; `lg` → `text-base`.
- `sm` → `px-1.5 py-0`; `md` → `px-2 py-0.5`; `lg` → `px-3 py-1`.
- Default `md` when `size` is omitted (`text-sm` + `px-2`).

### `StatusBadge — className merging` (3)
- Custom `className` is appended.
- Custom `className` coexists with base classes (`bg-primary`, `rounded-full`).
- Empty-string `className` does not break rendering.

### `StatusBadge — structure` (2)
- Badge carries `rounded-full`.
- Label text appears exactly once.

## Fail-safe note (honest)

The task brief asked for a fail-safe assertion ("fault modes degrade to a safe state").
This component has **no runtime fail-safe path**: `status` is a closed TS union, and
`STATUS_CONFIG[status]` dereferences `config.variant`/`config.label` immediately, so an
out-of-union value would throw rather than degrade. Because the type system makes such
input unreachable from well-typed callers, fabricating a "degrades to safe state" test
would be fake green. Instead the fail-safe coverage is delivered as **completeness** —
every member of the union renders without throwing — which is the real guarantee the
component provides. This is documented here rather than asserted falsely.

## Determinism

No network, clock, or randomness. Pure render + className string assertions under jsdom.

## Verification

```
pnpm exec vitest run tests/components/conversion/status-badge.test.tsx
# Test Files  1 passed (1)
#      Tests  24 passed (24)

pnpm exec eslint tests/components/conversion/status-badge.test.tsx --max-warnings=0   # exit 0
pnpm exec tsc --noEmit                                                                 # 0 errors for status-badge.*
```

Pre-existing phantom `TS7006` errors elsewhere in the repo (unrelated test files) are
unchanged by this task.
