# gap-untested-module-f4a5fa1f5b — unit tests for `mapping-statistics-card.tsx`

**Risk class:** C
**Target:** `src/components/conversion/mapping-statistics-card.tsx`
**Test file:** `tests/components/conversion/mapping-statistics-card.test.tsx` (new)
**Result:** 14 tests, all passing. `eslint --max-warnings=0` clean, `tsc --noEmit` clean.

---

## What the module does

`MappingStatisticsCard` is a pure presentational React component. It renders four
`Card`s from a `statistics` prop:

| Card | Title | Rendered value |
|------|-------|----------------|
| 1 | 総マッピング数 | `statistics.total` |
| 2 | 承認済み | `statistics.approved` + `<Progress value={approvalRate}/>` + `{approvalRate}%` |
| 3 | 要確認 | `statistics.needsReview` + caption "手動レビューが必要" |
| 4 | 平均信頼度 | `Math.round((averageConfidence ?? 0) * 100)%` + caption "AI推論の信頼度" |

Derived value: `approvalRate = statistics.total > 0 ? Math.round((approved / total) * 100) : 0`.

`statistics.pending` and `statistics.byType` are declared on the prop type but are
**not read** by the component (documented below).

## Coverage rationale

The component has a single public entry point — the `MappingStatisticsCard`
function — whose observable behavior is its rendered DOM. Tests therefore drive
that entry point with `@testing-library/react` and assert on rendered text and
the radix progressbar, grouped by the two computed quantities (approval rate,
average confidence) plus structure and fail-safe behavior. No external
collaborators exist to mock.

A local `makeStatistics()` factory reproduces the (unexported) `MappingStatistics`
shape so call sites stay type-checked against the real prop without importing a
private type. A `cardFor(title)` helper climbs `CardTitle → CardHeader → Card`
to scope value lookups without depending on Tailwind class names.

## Assertions added (per test)

### Structure
- **renders the four statistic cards with their titles and static captions**
  - 4 card titles present: 総マッピング数 / 承認済み / 要確認 / 平均信頼度
  - 2 static captions present: 手動レビューが必要 / AI推論の信頼度
- **renders the raw counts and derived percentages for typical input**
  - total card shows `100`; approved card shows `60` and `60%`; needs-review shows `15`; confidence card shows `85%`
- **accepts the full statistics shape (incl. unused pending / byType) without crashing**
  - root renders non-null; `pending` (`25`) is **not** displayed → documents that `pending`/`byType` are accepted but unused

### Approval rate
- **rounds the approval percentage to a whole number** — `1/3 → 33%` (rounds down), `2/3 → 67%` (rounds up)
- **reports 100% when every mapping is approved** — `approved === total → 100%`
- **renders a progressbar for the approval rate with bounded min/max** — `aria-valuemin="0"`, `aria-valuemax="100"` (see Finding below re: `aria-valuenow`)
- **does not clamp approval rates above 100% (documents current behaviour)** — `approved > total → 150%`, no clamping
- **degrades the approval rate to 0 when total is 0 (no division by zero)** — `total=0 → 0%`, progressbar still present
- **keeps the approval rate at 0 when total is 0 even if approved is non-zero** — fail-safe: `total=0, approved=5 → 0%` (short-circuit before division; no `NaN`/`Infinity`)

### Average confidence
- **scales averageConfidence (0..1) to a whole percent** — `0.856 → 86%` (rounds up), `0.854 → 85%` (rounds down)
- **reports 100% at full confidence** — `averageConfidence = 1 → 100%`
- **reports 0% at zero confidence** — `averageConfidence = 0 → 0%`
- **degrades to 0% when averageConfidence is omitted** — `averageConfidence ?? 0` guard; missing value renders `0%`, never `NaN%`

### Empty / fail-safe state
- **renders zeros everywhere with no confidence and no division by zero** — all-zero input with no `averageConfidence`; every card shows `0`/`0%`, progressbar present

## Finding (observed, not fixed — out of scope)

The shared `Progress` wrapper at `src/components/ui/progress.tsx` **does not forward
the `value` prop to Radix's `ProgressPrimitive.Root`**: `value` is destructured and
used only for the indicator's `translateX` transform, then `{...props}` (which no
longer contains `value`) is spread onto `Root`. As a result Radix always sees
`value = null` and omits both `aria-valuenow` and `aria-valuetext`, so the
progressbar's current value is invisible to screen readers regardless of the
approval rate (verified against `@radix-ui/react-progress@1.1.8` source and
confirmed empirically: `aria-valuenow` is `null` for rates 40, 0, and 150 alike).

The card itself is correct — it passes `value={approvalRate}` to `Progress`. The
defect lives in the `ui/**` primitive, which is coverage-excluded and outside this
task's scope, so it is left unchanged. The visible `{approvalRate}%` text (asserted
above) is what actually conveys the rate to users today. A future fix would be a
one-line change in `progress.tsx` (`value` forwarded to `Root`); the tests here
intentionally avoid asserting on `aria-valuenow` so they remain stable if/when that
fix lands.

## Quality gate

| Check | Result |
|-------|--------|
| `vitest run tests/components/conversion/mapping-statistics-card.test.tsx` | 14/14 pass |
| `vitest run tests/components/conversion` (suite) | 34/34 pass |
| `eslint <file> --max-warnings=0` | exit 0 |
| `tsc --noEmit` (whole repo) | exit 0 |
