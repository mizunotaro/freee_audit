# gap-untested-module-976018c539 — Unit tests for `src/i18n/request.ts`

**Task:** Add unit tests for the next-intl request config module.
**Target file:** `src/i18n/request.ts` (15 lines, previously untested).
**New test file:** `tests/i18n/request.test.ts` (20 tests, all passing).

## What the module does

`src/i18n/request.ts` exports the next-intl request config: a callback that
resolves the active `requestLocale`, falls back to `routing.defaultLocale`
(`'ja'`) when the locale is missing or unsupported, and dynamically loads the
matching `messages/<locale>.json` bundle.

```ts
export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale
  if (!locale || !routing.locales.includes(locale as 'ja' | 'en')) {
    locale = routing.defaultLocale
  }
  return { locale, messages: (await import(`../../messages/${locale}.json`)).default }
})
```

## Test strategy / isolation

- `next-intl/server` is mocked so `getRequestConfig` returns the config callback
  it receives (captured via `vi.hoisted`). The module's default export therefore
  IS the callback, which the tests invoke directly with a synthetic
  `{ requestLocale }` context. The mock call count also verifies single
  registration.
- `@/i18n/routing` is mocked with the production values
  (`locales: ['ja','en']`, `defaultLocale: 'ja'`) to isolate the branching logic
  from next-intl's navigation runtime.
- The dynamic `import('messages/<locale>.json')` is left unmocked so the test
  exercises the real file resolution against the actual `messages/ja.json` and
  `messages/en.json` bundles (deterministic local data, no network/clock/random).
- No new test-framework dependencies were added.

## Assertions added (per test)

### Module registration
1. `getRequestConfig` called exactly once at import (single registration).
2. The default export is a function (the config initializer).

### Happy path — supported locales pass through
3. `requestLocale='ja'` → `result.locale === 'ja'`.
4. …and loads the Japanese bundle (`common.save === '保存'`).
5. `requestLocale='en'` → `result.locale === 'en'`.
6. …and loads the English bundle (`common.save === 'Save'`).
7. Bundles differ per locale (`保存 !== Save`), proving correct file mapping.
8. A thenable `requestLocale` is awaited (matches next-intl contract) → `'en'`.

### Return shape
9. Result has exactly the keys `['locale', 'messages']`.
10. `messages` is of type `'object'`.
11. `messages` is not `null`.

### Fail-safe — unsupported/missing locale degrades to default `'ja'`
12–20. Locale falls back to `'ja'` for each of: `undefined`, `null`, `''`,
   `'fr'`, `'de'`, `'JA'` (case-sensitivity), `'ja-JP'`, `'en-US'`, `'1'`.
21. After fallback the module still returns a valid bundle
   (`common.save === '保存'`) — the safe state, no crash/empty render.
22. The fallback bundle equals the default-locale bundle exactly
   (`toEqual` deep equality with the direct `'ja'` load).

### Error path
23. A rejected `requestLocale` promise propagates (`rejects.toThrow`,
   documenting that the module has no internal catch — characterization of
   current behavior).

## Coverage rationale

The module's entire logic is the locale-resolution branch and the dynamic
message import. The matrix above drives:

- the truthy/falsy sides of `!locale` (valid string vs `undefined`/`null`/`''`),
- both sides of `routing.locales.includes(...)` (valid `'ja'`/`'en'` vs
  unsupported strings, case/regional variants),
- the success and failure of the dynamic import path (valid locale loads the
  right file; the rejected-input case exercises the `await requestLocale` throw).

Result: **100% lines / 100% branches (4/4) / 100% functions (2/2)** on
`src/i18n/request.ts`.

## Quality gate (run in this worktree)

| Check | Result |
|-------|--------|
| `vitest run tests/i18n/request.test.ts` | 20 passed |
| `eslint tests/i18n/request.test.ts --max-warnings=0` | 0 problems |
| `tsc --noEmit` (whole repo, after `pnpm db:generate`) | 0 errors |
| v8 coverage on `src/i18n/request.ts` | 100% lines/branches/functions |

## Notes

- `src/i18n/request.ts` was not modified; this task only adds tests.
- Worktree required `pnpm install --frozen-lockfile` and `pnpm db:generate`
  before typecheck/lint (next-intl and the Prisma client were absent on
  worktree creation).
