# COV-COMP-04 — Unit-test coverage: components/settings + components/layout

## Scope
Added focused unit tests for every exported module under the two target directories
(6 modules total — both dirs export only React client components, no standalone pure
logic, so RTL rendering tests are the appropriate shape):

| Source module | Test file | Tests |
|---|---|---|
| `src/components/layout/AppLayout.tsx` | `tests/components/layout/app-layout.test.tsx` | 4 |
| `src/components/layout/bottom-navigation.tsx` | `tests/components/layout/bottom-navigation.test.tsx` | 3 |
| `src/components/layout/dock-sidebar.tsx` | `tests/components/layout/dock-sidebar.test.tsx` | 5 |
| `src/components/layout/sidebar.tsx` | `tests/components/layout/sidebar.test.tsx` | 3 |
| `src/components/settings/AiSettings.tsx` | `tests/components/settings/ai-settings.test.tsx` | 5 |
| `src/components/settings/FreeeSettings.tsx` | `tests/components/settings/freee-settings.test.tsx` | 5 |

**Total: 25 new tests, 6 files.** Previously none of these modules had a mirror test
under `tests/components`.

## Approach
- Render the **real** components (`@/components/...`) via `@testing-library/react` and
  assert on actual DOM output. No local re-implementations of component logic (avoids
  the "fake green" failure mode — verified by importing the symbol, not by paraphrasing).
- Boundary mocking only:
  - `next/navigation` (`usePathname`) — per-file `vi.hoisted` mock so the active-link
    branch can be exercised (file mock overrides the `/test` default from `tests/setup.ts`).
  - `next-intl` (`useTranslations` → `key => key`) so translated labels surface as their
    message keys.
  - `next/link` → plain `<a href className>` so href/class assertions are deterministic.
  - `fetch` via `vi.stubGlobal` for the two settings components.
  - `@/components/ui/sheet` stubbed to render children inline in the sidebar test (the
    mobile drawer is a Radix Sheet whose content mounts only when opened; Sidebar's own
    logic — role filtering, locale hrefs, initials — lives in those children, so the
    Sheet primitive is stubbed as a container boundary, not the unit under test).
- `window.confirm` is spied (not stubbed globally) for the FreeeSettings disconnect flow.

## Behaviors asserted (happy path + key edges)
- **AppLayout**: brand + children render; `title` renders only when provided; nav entries
  appear in both desktop and mobile bars; exact-match active link styling.
- **BottomNavigation**: one locale-prefixed link per entry (ja + en); prefix-match active.
- **DockSidebar**: locale-prefixed hrefs + avatar initials; **role-based filtering**
  (VIEWER hides `journalProposal`, ACCOUNTANT sees it); active link; hover
  expand/collapse including the 1000 ms leave timer (fake timers, `act`-wrapped advance).
- **Sidebar**: brand locale href; role filtering; initials.
- **AiSettings**: load populates provider/model; provider change resets API key + switches
  model list; save POSTs the config body and clears the key on success; save server-error
  surfaces the message; initial-load rejection is swallowed and the form still renders.
- **FreeeSettings**: connected/disconnected status derived from the companies payload;
  connection-test count message; disconnect success on confirm; **abort on cancel**
  (no POST, stays connected); `本番環境` mock-mode branch.

## Constraints honored
- No `any` / `@ts-ignore` / `@ts-expect-error` / `.skip` / lint-disable / coverage
  lowering. No Class-A paths touched (additive test files only). No new dependencies.
- Ran only the added test files (never the full suite — known OOM).
- Async-rejection path (AiSettings load-reject, FreeeSettings fetch) is fully `await`ed
  inside the components' own try/catch, so no unhandled-rejection/worker-crash risk —
  no manual pre-attached rejection handler was needed.

## Left intentionally uncovered (with rationale)
- **FreeeSettings URL-param redirect handling** (`?connected=true` / `?error=` in
  `window.location.search`, plus `window.history.replaceState`): reliably mutating
  `window.location.search` in jsdom is not safe (redefining the `location` accessor is
  environment-dependent and tends to either throw or no-op). Rather than risk a flaky
  test, this branch is left untested here. The fetch-based flows (the core logic) are
  fully covered.
- The `development` (mock-mode) branch of FreeeSettings is not exercised (would require
  mutating `process.env.NODE_ENV` before module evaluation); only the non-development
  branch (`本番環境`) is asserted.
- Radix dropdown "Sign out" click-through (sets `window.location.href`) in dock/sidebar:
  trivial navigation side-effect behind a Radix open-menu interaction; low value, skipped.

## Expected stderr noise (not a failure)
`ai-settings.test.tsx > "renders the form even when the initial load rejects"` logs
`Failed to load config: Error: network down` — this is the component's own `console.error`
inside its catch block, fired by the intentional rejection the test asserts on. The test
passes; the log is honest signal, not a defect.

## Verification
`node scripts/autopm_verify.mjs --changed-only` → **exitCode 0**
(typecheck 0 errors, eslint `--max-warnings=0` clean, vitest 25/25).
