# gap-untested-module-bc32893cee — unit tests for `mapping-filters.tsx`

**Target:** `src/components/conversion/mapping-filters.tsx`
**New test file:** `tests/components/conversion/mapping-filters.test.tsx`
**Risk class:** C (presentational React component)
**Result:** 31 tests, all passing. `eslint --max-warnings=0` clean. `tsc --noEmit` 0 errors project-wide.

---

## 1. What the module is

`MappingFilters` is a client component that renders a shadcn **Sheet** drawer of filter
controls for the conversion-mapping list:

- a text `Input` (`search`)
- five `Select`s (`sourceCoaId`, `targetCoaId`, `mappingType`, `isApproved`, `isManualReview`)
- a `Slider` (`minConfidence`, max 100 / step 5)
- `適用` (apply) and `クリア` (clear) buttons

Its *logic* (the part worth testing) is:

- `localFilters` state, initialised once from the `filters` prop
- `hasActiveFilters` + the badge count (number of non-empty values in `filters`)
- `updateFilter(key, value)` — edits `localFilters`, coercing `''` / `undefined` → `undefined`
- `handleApply()` — commits `localFilters` via `onFiltersChange`
- `handleClear()` — emits `{}` and resets `localFilters`

`onFiltersChange` is **only** called on apply/clear, never while editing — that deferred-commit
contract is the core behaviour under test.

## 2. Testing strategy (why the UI primitives are mocked)

The component is built on **Radix** primitives (`Sheet` = Radix Dialog, `Select` =
Radix Select, `Slider` = Radix Slider) whose portals and pointer-capture behaviour do not
work under jsdom. Per the repo's established convention
(`tests/unit/.../FallbackInput.test.tsx`, `ProposalList.test.tsx`, `sidebar.test.tsx`),
these are a **UI boundary, not the logic under test**, so they are replaced with native
equivalents that keep the component's own `value → onValueChange` / `onChange` wiring
**live and drivable** (not blind pass-throughs that would hide the filter logic):

- `@/components/ui/select` → a real native `<select>` built from the component's own
  `<SelectItem>` values+labels. The five selects are told apart by their SelectItem
  **label** signature (`mapping-type-select`, `is-approved-select`,
  `is-manual-review-select`, `coa-select`) because `isApproved`/`isManualReview` share
  identical *values* (`''`/`'true'`/`'false'`).
- `@/components/ui/sheet` → inline render (children always present) so the form is
  drivable; title/description wrapped in real elements so they are text-queryable.
- `@/components/ui/slider` → a native `<input type="range">` calling
  `onValueChange([Number(value)])`.

`Button`, `Input`, `Label` are left **real** (jsdom-safe, used unmocked elsewhere).

Determinism: no network, no clock, no unseeded randomness; all interactions are
synchronous `fireEvent`.

## 3. Assertions added (per test)

### Structure & initial render
1. **renders the trigger button, sheet title and description** — trigger button present;
   description text `マッピングの絞り込み条件を設定` present.
2. **renders every filter control and apply/clear** — search input present; 2 COA selects
   (`toHaveLength(2)`); `mapping-type`, `is-approved`, `is-manual-review` selects present;
   slider present; `適用` present; `クリア` present.
3. **initialises every control from the filters prop** — search=`'abc'`, source COA=
   `'src-cash'`, target COA=`'tgt-ar'`, mappingType=`'1toN'`, isApproved=`'false'`,
   isManualReview=`'true'`, slider=`'60'` (verifies `useState(filters)` initialisation).
4. **defaults every select to `すべて` when a value is absent** — mappingType/isApproved/
   isManualReview all value `''`; both COA selects value `''`.
5. **exposes configured slider bounds** — `max=100`, `step=5`.

### Active-filter badge count (`hasActiveFilters`)
6. **no filters → no badge** — count `0`.
7. **single filter → count 1** (`{search:'x'}`).
8. **several filters → count 3** (`search`, `mappingType`, `minConfidence`).
9. **ignores empty-string values** (`{search:'', mappingType:''}`) → `0`.
10. **ignores undefined values** (`{search:undefined, targetCoaId:undefined}`) → `0`.
11. **`minConfidence:0` counts as active** → `1` — documents the real behaviour:
    `hasActiveFilters` uses `v !== undefined && v !== ''`, which the number `0` passes.
12. **five simultaneous filters → count 5** (search, sourceCoaId, isApproved,
    isManualReview, minConfidence).

### Local edits → apply contract (`updateFilter` / `handleApply`)
13. **no `onFiltersChange` while editing** — typing + selecting never fires the callback.
14. **typed search committed on apply** — fires exactly once, payload contains
    `{search:'現金'}`.
15. **mappingType committed on apply** — `{mappingType:'1toN'}`.
16. **isApproved / isManualReview committed independently** — both literals present and
    distinct in the payload.
17. **source / target COA committed on apply** — `sourceCoaId='src-cash'`,
    `targetCoaId='tgt-ar'`.
18. **empty-string selection coerced to undefined** — selecting `すべて` back yields
    `mappingType === undefined` (the `'' / undefined → undefined` rule in `updateFilter`).
19. **all edits batched into one call** — one `onFiltersChange` carrying search+mappingType+
    isApproved+minConfidence together.
20. **apply with no edits echoes the prop filters** — `onFiltersChange({search:'abc',
    mappingType:'1to1'})`.

### Clear (`handleClear`)
21. **emits `{}` exactly once** — `toHaveBeenCalledTimes(1)`, `toHaveBeenCalledWith({})`,
    and `Object.keys(payload).length === 0`.
22. **resets local controls** — after clear, search=`''`, mappingType=`''`, slider=`'0'`.
23. **discards uncommitted edits** — uncommitted search does **not** appear in the payload
    (`toEqual({})`).

### minConfidence slider
24. **mid-range value committed** — `minConfidence: 80` on apply.
25. **max boundary** — slider `100` → `minConfidence: 100`.
26. **min boundary** — slider `0` → `minConfidence: 0`.

### COA option rendering
27. **source COA options** — option values `['', 'src-cash', 'src-bank']` and labels
    `['すべて', '現金', '銀行預金']`.
28. **target COA options** — option values `['', 'tgt-cash', 'tgt-ar']`.
29. **empty COA lists fall back safely** — still 2 selects, each with only the `すべて`
    option (value `''`).

### Fail-safe
30. **renders without throwing for minimal empty props**.
31. **no spurious `onFiltersChange` on plain re-render** of unchanged controls.

## 4. Coverage rationale / gaps closed

The module previously had **no** test entry. These tests cover:

- **Happy paths:** render, initialise-from-prop, and the apply contract for every one of the
  7 filter fields plus clear.
- **Edge cases:** empty filter object, empty-string vs undefined values, empty COA lists,
  slider min/max boundaries, apply-without-edits echo, batched edits.
- **Error / fail-safe paths:** empty/minimal props do not throw; edits never leak a
  premature `onFiltersChange`; clear produces a key-less `{}` (safe downstream).
- **Documented behaviour, not opinion:** `minConfidence: 0` is reported as an active filter
  by the current `hasActiveFilters` implementation — asserted as-is (test 11). This is
  arguably surprising (0 is the slider default) but the test pins actual behaviour so any
  future change is intentional.

### Not asserted (deliberately out of scope)
- The Sheet open/close (`isOpen`) is internal component state with no externally observable
  effect beyond `onFiltersChange`; the mocked Sheet renders inline, so DOM open/close state
  is not meaningful to assert.
- Radix-specific a11y/portal semantics are covered by the primitive library, not here.

## 5. Quality gate

```
vitest run tests/components/conversion/mapping-filters.test.tsx   → 31 passed
eslint  tests/components/conversion/mapping-filters.test.tsx --max-warnings=0  → clean
tsc --noEmit (whole repo, after `pnpm db:generate`)               → 0 errors
```
