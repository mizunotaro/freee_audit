# gap-untested-module-9bb7b0ce41 — unit tests for account-code-selector

**Target:** `src/components/conversion/account-code-selector.tsx`
**Risk class:** C · **Result:** 1 new test file, 20 tests, all passing.

## What was added

New file: `tests/components/conversion/account-code-selector.test.tsx` → mirrors the
source path under `tests/components/conversion/`. Follows the existing conversion
test conventions (`mapping-list.test.tsx`, `list-state.test.tsx`): vitest +
`@testing-library/react`, a `makeItem` factory, shared `onChange` spy reset in
`beforeEach`.

## Mocking rationale (determinism)

`AccountCodeSelector` composes three third-party interactive primitives whose
real behavior is **non-deterministic in jsdom**, so they are mocked as transparent
passthroughs (the task permits mocking external collaborators; no new deps added):

- `@/components/ui/popover` — Radix `Popover` renders into a `Portal` and uses
  presence/pointer animations. Mocked so content renders inline and is always
  queryable without driving pointer events.
- `@/components/ui/command` (cmdk) — maintains its own internal item-count /
  empty-state; because this component renders plain `div`s (not `CommandItem`s),
  cmdk would always report zero items. Mocking removes that interference. The
  `CommandInput` mock preserves the critical data flow (`value`/`onValueChange`
  → controlled `<input>`), so the search filtering logic is genuinely exercised.
- `@/components/ui/scroll-area` — Radix ScrollArea uses a resize observer; mocked
  to a plain `<div>` (purely presentational, no behavior under test).

`Button` and `Badge` are kept **real** (trivial, deterministic) so the trigger
element and category badge are validated against the actual implementations.

## Coverage — every assertion and its rationale

### Trigger / display
| Assertion | Branch covered |
|---|---|
| combobox text = `勘定科目を選択` with no value | default `placeholder` prop |
| combobox text = custom placeholder | `placeholder` override |
| trigger shows code `1110` + name `現金` when `value` matches | `selectedItem = items.find(...)` happy path |
| trigger shows placeholder when `value` not in items | **fail-safe**: `selectedItem` undefined → degrades to placeholder |
| combobox `toBeDisabled()` when `disabled` | `disabled` prop wired to Button |

### Search filtering (`filteredItems` useMemo)
| Assertion | Branch covered |
|---|---|
| all items shown when search empty | empty-`search` branch (no filter) |
| typing `112` keeps only code-1120 item | filter by `code` |
| typing `当座` keeps only matching item | filter by `name` |
| typing `cash` keeps only the `Cash` (nameEn) item | filter by `nameEn`, **case-insensitive** |
| typing `zzzzz` → zero `.w-16` rows | **edge**: no-match → empty result set |

### Category filter
| Assertion | Branch covered |
|---|---|
| only `current_asset`/`revenue` items kept when `categoryFilter` set | `categoryFilter` branch |

### Hierarchy (`buildHierarchy`)
| Assertion | Branch covered |
|---|---|
| code order = `1000,1110,1120,1190,2000` | roots **and** children both sorted numerically (`localeCompare` numeric) |
| orphan (parentId `ghost`) still rendered as root, ordered `1000,1500` | **fail-safe**: parent missing → treated as root, never dropped |
| grandchild absent while level-1 parent collapsed | `useState(level === 0)` default-collapsed |
| clicking the expand button reveals the grandchild | `setExpanded` toggle via the expand `<button>` |

### Selection (`onSelect` → `onChange`)
| Assertion | Branch covered |
|---|---|
| clicking a leaf calls `onChange` once with `(id, item)` (objectContaining id/code/name/nameEn) | leaf happy path; full item object passed |
| clicking a parent row does **not** call `onChange` | `!hasChildren && onSelect` guard on parent rows |

### Display options
| Assertion | Branch covered |
|---|---|
| badge label `流動資産` present by default; absent when `showCategoryBadge={false}` | `showCategoryBadge` default + override |
| English name `Cash` absent by default; present when `showEnglishName` | `showEnglishName` default + override |

### Edge cases
| Assertion | Branch covered |
|---|---|
| empty `items[]` → combobox shows placeholder and zero `.w-16` rows | **empty input**; no crash, safe state |

## Public surface covered

`AccountCodeSelector` is the only exported symbol. Its internal collaborators
(`HierarchicalItem`, `buildHierarchy`) are not exported, so they are exercised
through the public component as above — every branch of `filteredItems`,
`buildHierarchy` (root/child sort, orphan fallback), and `HierarchicalItem`
(leaf select, parent guard, expand toggle, badge/english toggles) is hit.

## Verification

```
corepack pnpm exec vitest run tests/components/conversion/account-code-selector.test.tsx
→ Test Files  1 passed (1)   Tests  20 passed (20)

corepack pnpm exec eslint <file> --max-warnings=0  → exit 0
corepack pnpm exec tsc --noEmit                     → 0 errors in the new file
```

Pre-existing tsc errors in `tests/unit/services/budget/managerial-accounting.test.ts`
(missing `favorable` on `StageLevelComparison`) are unrelated to this task — this
session touched only the new test file (verified via `git status`).
