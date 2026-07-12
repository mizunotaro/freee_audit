# gap-untested-module-c15f736777 — Unit tests for `src/i18n/routing.ts`

**Risk class:** C · **Target:** `src/i18n/routing.ts` · **Test file:** `tests/i18n/routing.test.ts`

## What the module does

`src/i18n/routing.ts` is the i18n wiring layer. It builds the next-intl routing
config via `defineRouting` and derives the app's navigation primitives via
`createNavigation(routing)`:

```ts
export const routing = defineRouting({
  locales: ['ja', 'en'],
  defaultLocale: 'ja',
  localePrefix: 'always',
})

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing)
```

The rest of the app (middleware locale routing, `[locale]` segment, locale-aware
links/redirects) depends on these exact contract values and on every navigation
member being present.

## Coverage rationale

The module is a thin config/wiring layer, so the test focuses on three real
contract surfaces rather than re-testing next-intl internals:

1. **Routing config values** — the literal values the app depends on. If
   `defaultLocale`, `localePrefix`, or the locale set drifts, locale routing
   silently breaks. Pinning them is the fail-safe.
2. **Navigation export shape** — all five members (`Link`, `redirect`,
   `usePathname`, `useRouter`, `getPathname`) are present and are the right
   kind (React component vs. function), and distinct.
3. **Behavioral wiring via `getPathname`** — proves the exports are actually
   bound to *our* `routing` config (not just that something was re-exported).
   Because `localePrefix: 'always'`, `getPathname` must prefix the locale; the
   exact returned strings (`/ja/dashboard`, `/en/dashboard`, …) only emerge
   when the real config drives the real next-intl formatter. This is the guard
   against a future refactor that decouples the exports from the config.

The behavioral assertions were verified against the real `next-intl@3.26.5`
runtime (the test run produced the expected localized strings), so they are not
stub-based fake-green.

## Assertions added

`routing config`
- `routing.locales` deep-equals `['ja', 'en']` (canonical order).
- `routing.locales` is an array of length 2.
- `routing.defaultLocale` is `'ja'`.
- `routing.localePrefix` is `'always'`.
- `routing.locales[0]` equals `routing.defaultLocale` (default ↔ first entry).
- `routing.locales` contains both `'ja'` and `'en'`.

`navigation exports`
- `Link` is defined, is an object, and carries the React `$$typeof` marker.
- `redirect`, `usePathname`, `useRouter`, `getPathname` are each `typeof function`.
- The five members are mutually distinct (`Set` size === 5).

`getPathname (behavioral wiring)`
- `getPathname({ locale: 'ja', href: '/dashboard' })` → `'/ja/dashboard'`.
- `getPathname({ locale: 'en', href: '/dashboard' })` → `'/en/dashboard'`.
- `getPathname({ locale: 'ja', href: '/reports/monthly' })` → `'/ja/reports/monthly'` (nested segments preserved).
- `getPathname({ locale: 'en', href: '/login' })` → `'/en/login'` (route used by middleware).
- Locale prefix applied exactly once (`/en` occurs once in the result).
- Root path is localized: `getPathname({ locale: 'ja', href: '/' })` matches `/^\/ja\/?$/` and starts with `/ja`.

**Total: 18 assertions across 3 groups.**

## Test selection notes (edge / fail-safe)

- **Edge cases:** nested multi-segment path, root path (`/`), the `/login`
  route the public-path middleware allow-lists.
- **Fail-safe:** the config-value assertions are the fail-safe — they freeze
  the contract the wider system relies on; any drift fails the build.
- **Error/dependency paths:** `getPathname` is a pure function of the routing
  config (no React context / Next hooks invoked), so no external collaborator
  is instantiated and no network/clock/random is involved — deterministic.
  `redirect`/`usePathname`/`useRouter` are left as type assertions because
  invoking them requires a Next.js routing/React context (out of scope for a
  unit test of this wiring module); `tests/setup.ts` already stubs
  `next/navigation`.

## Verification

```
corepack pnpm exec vitest run tests/i18n/routing.test.ts   # 18/18 passed
corepack pnpm exec eslint tests/i18n/routing.test.ts --max-warnings=0   # clean
corepack pnpm exec tsc --noEmit   # exit 0, 0 errors
```

No production source was changed. No new dependencies added.
