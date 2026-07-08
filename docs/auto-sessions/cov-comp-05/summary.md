# COV-COMP-05 — Unit-test coverage: components/chat + components/ui

**Outcome:** additive tests only — 7 new test files, 67 assertions. No source changes,
no Class-A path touched, no new dependencies. `node scripts/autopm_verify.mjs --changed-only`
exits **0** (typecheck 0 errors · eslint 0 warnings · vitest 67/67).

## Scope selected

The brief asked for `components/chat` + `components/ui (untested primitives)`. I enumerated
exports and kept only modules with genuine, assertion-worthy logic — not Radix/CVA pass-through
wrappers (a "renders without crashing" smoke test on those would be fake-green and is already
covered by Radix's own suites).

| File | What is exercised |
|------|-------------------|
| `tests/components/chat/config.test.ts` | `calculateProgress` (per-stage base/ceiling, per-stage clamp, linear interp, 95% cap, terminal/idle → 0/100), `estimateRemaining` (3s grace window, avg−elapsed, ≤0 → undefined), `DEFAULT_CHAT_CONFIG`, `PROGRESS_STAGES` weight sums. |
| `tests/components/chat/types.test.ts` | `DEFAULT/MIN/MAX_WIDGET_SIZE` values + the `MIN ≤ DEFAULT ≤ MAX` clamping invariant the hooks rely on, `WIDGET_POSITION_OFFSET`. |
| `tests/components/chat/use-drag-resize.test.tsx` | `useDrag` delta arithmetic, `grab`/`grabbing` cursor states, boundary clamping (min/max envelope from `getBoundingClientRect`), listener teardown on mouseup. `useResize` delta growth + min/max clamp (defaults **and** custom overrides). |
| `tests/components/chat/use-floating-chat.test.tsx` | State transitions (open/close/minimize/toggle), `localStorage` hydration + persistence + corrupt-JSON fallback, `setSize` clamp to MIN/MAX, `setPosition`, `clearMessages`, `markAsRead`, `sendMessage` happy / `success:false` / network-error / `AbortError` paths, blank-content guard, request body shape. |
| `tests/components/chat/progress-indicator.test.tsx` | `AnimatedStatusIcon` stage→glyph mapping (idle→null, error→`!`, complete→`✓`, processing→spinner) + size classes. `ProgressIndicator` null-on-terminal, label/message/percent/elapsed rendering, message-falls-back-to-description. |
| `tests/components/ui/language-switcher.test.tsx` | Toggle open/close, locale list driven by `locales`, current-locale highlight, `onLocaleChange` + auto-close on selection, backdrop dismiss without firing change. |
| `tests/components/ui/button.test.tsx` | `buttonVariants` variant→class + size→class contract (all 6 variants / 4 sizes), default resolution, combined, custom className; `Button` DOM-prop forwarding + disabled-no-click; `asChild` Slot passthrough. |

## Notable engineering decisions

- **Real timers, not fake.** `useFloatingChat.sendMessage` schedules a 120 s `AbortController`
  timeout and a 500 ms progress interval; both are cleared in `finally`/on unmount. Driving it
  with **real** timers + a fast-resolving `fetch` mock avoids the vitest worker-crash pattern
  (unhandled rejection while fake timers are advanced). The `AbortError` branch is covered
  deterministically by rejecting `fetch` with `{ name: 'AbortError' }` rather than waiting on a
  timer.
- **Scoped rejection swallow.** As a belt-and-braces guard for the async/timer-heavy chat hook
  test, a self-removing `process.on('unhandledRejection')` handler is attached per test and torn
  down in `afterEach` (per the documented repo pattern).
- **Synthetic mouse events.** The drag/resize hooks read `preventDefault`/`stopPropagation`/
  `clientX`/`clientY`; a tiny builder produces minimal `React.MouseEvent`-shaped objects. Real
  `MouseEvent`s are dispatched on `document` for the move/up phases, wrapped in `act`.
- **`src/components/ui/**` is excluded from the coverage gate** (vitest.config.ts). These tests
  still add real behavior coverage for the two UI modules that have logic; the remaining ui
  primitives are thin Radix/cmdk/sonner/CVA wrappers with nothing to assert beyond rendering.

## Verification

```
node scripts/autopm_verify.mjs --changed-only   # exit 0
  typecheck: total=0, relevant=0
  eslint:    7 files, 0 warnings
  vitest:    7 files, 67 tests, all pass
```

Only the 7 added test files were executed (never the full suite — known OOM risk).
