# gap-untested-module-bdc375b5d1 — Unit tests for `src/app/layout.tsx`

**Task:** Add unit tests for the Next.js root layout (`src/app/layout.tsx`), which had no
`tests/` entry. **Risk class:** C. **Result:** 20 tests, all passing.

## Target module

`src/app/layout.tsx` exports two public members:

| Export | Kind | Lines |
|---|---|---|
| `metadata` | `Metadata` const (title + description) | 7–10 |
| `RootLayout` (default) | Server component returning `<html lang="ja"><body className=…>{children}</body></html>` | 12–20 |

Its only external collaborator is `next/font/google` (`Inter`), used to produce the
`inter.variable` font class.

## Test file

`tests/app/layout.test.tsx` (mirrors the source path, as required).

## Approach & coverage rationale

### Why `react-dom/server` + `DOMParser` instead of Testing Library

The component's root element is `<html>`. Under RTL/jsdom, rendering `<html>` into the
container `<div>` triggers jsdom's document-structure unwrapping: `container.innerHTML`
for `<html lang="ja"><body><span>x</span></body></html>` serializes as just `<span>x</span>`,
so `container.querySelector('html'/'body')` returns `null` (only `getByText` survives).
`lang="ja"` and the `<body>` className — the most important contracts — are therefore
unobservable via RTL.

`renderToStaticMarkup` is also the **faithful render path** for a Next.js server-component
root layout. Parsing its output with `new DOMParser().parseFromString(markup, 'text/html')`
produces a real `Document` in which `<html>`/`<body>` survive intact, enabling assertions on
attributes and className. No real network/clock/random is involved; `next/font/google` is
mocked so no font fetch occurs (determinism).

### `next/font/google` is a module singleton

`const inter = Inter({...})` runs **once at module import**. Two consequences, both handled:

- The mock call count is asserted against `1` exactly once; there is no `beforeEach(mockClear)`
  (which would erase the import-time call and break the count assertion).
- `Inter`'s return cannot be swapped per-test (the value is already captured). Dynamic
  `inter.variable` wiring is instead proven by asserting the `<body>` className contains the
  mock's sentinel `'__mock_inter_variable__'` — a value the mock produces, not a hardcoded
  string — so the layout is shown to read `inter.variable` at render time.

### Requirement mapping

| Requirement | How covered |
|---|---|
| Happy-path for each entry point | `metadata` (3) + `<html>` lang/`<body>` className (SSR) + single/nested/sibling children |
| Edge cases (empty/boundary inputs) | `children = null`, empty fragment, numeric child, multiple siblings |
| Error paths | N/A — module is pure presentational JSX with no try/catch, branching, or I/O; documented here rather than fabricated |
| Fail-safe behavior | With `null`/empty/numeric children the `<html lang="ja">`→`<body>` skeleton plus all static classes (`min-h-screen bg-background font-sans antialiased`) remain intact |

## Assertions added (20 tests)

**metadata export**
1. `metadata.title === 'freee_audit - 会計監査システム'`
2. `metadata.description === '会計freee仕訳監査・レポートシステム'`
3. `metadata` deep-equals `{ title, description }` (no stray keys)

**next/font/google wiring**
4. `Inter` called exactly once at module load
5. `Inter` called with `{ subsets: ['latin'], variable: '--font-inter' }`
6. Two `renderToStaticMarkup` passes do not re-invoke `Inter` (singleton)

**`<html>` element**
7. `html[lang] === 'ja'`
8. exactly one `<html>` element

**`<body>` element**
9. body className contains `__mock_inter_variable__` (dynamic font wiring)
10–13. body className contains each of `min-h-screen`, `bg-background`, `font-sans`, `antialiased` (`it.each`)
14. body className equals `__mock_inter_variable__ min-h-screen bg-background font-sans antialiased`

**children rendering (SSR path)**
15. a single `<main>` child lands inside `<body>`
16. arbitrarily nested children render
17. three sibling `<span>` children render in document order, count = 3

**edge cases & fail-safe**
18. `children = null` → `<html>`/`<body>` skeleton present
19. empty fragment → `<html>`/`<body>` skeleton present
20. numeric child `42` serializes as body text `'42'`
21. `null` children: `lang` still `'ja'` and all four static classes still present

(Note: 18 unique `it` blocks; `it.each` expands to 4 cases = 20 total test cases reported by vitest.)

## Verification

```
pnpm exec vitest run tests/app/layout.test.tsx   → 20 passed
pnpm exec tsc --noEmit                            → no errors in test file
pnpm exec eslint tests/app/layout.test.tsx        → exit 0 (0 warnings)
```

`src/app/**/layout.tsx` is excluded from the v8 coverage thresholds in `vitest.config.ts`,
so these tests do not affect coverage gates; they exercise real behavior regardless.

## Notes / explicit non-coverage

- `suppressHydrationWarning` on `<html>` is a React-only runtime prop that is **not emitted
  to the DOM** by `renderToStaticMarkup` (nor by React's client renderer), so it cannot be
  asserted via the serialized output without spying on React internals. Left unasserted by
  design — fabricating a DOM assertion for it would be a false test.
- No error-path tests: the module contains no conditional/error branches to drive.
