# gap-untested-module-eda2c5ea59 — Unit tests for `ir-calendar-widget.tsx`

**Task:** Add unit tests for `src/components/reports/ir/ir-calendar-widget.tsx` (Risk class C).
**Deliverable:** `tests/components/reports/ir/ir-calendar-widget.test.tsx`
**Result:** 40 tests, all passing. `eslint --max-warnings=0` clean, `tsc --noEmit` clean.

## Target module surface

`IRCalendarWidget` is a single default-exported React component (no exported helpers —
`getDaysInMonth`, `getEventsForDay`, `formatMonth`, `handlePrevMonth`, `handleNextMonth` are
internal closures). Behavior is therefore exercised through rendered output and DOM interaction.

Props: `events: IREvent[]`, `title?` (default `IRイベントカレンダー`), `language?: 'ja'|'en'` (default `ja`),
`onEventClick?: (event) => void`.

## Determinism strategy

The component derives the displayed month and the "today" highlight from `new Date()` at render
(lines 42 and 93). Tests pin the clock via `vi.useFakeTimers()` + `vi.setSystemTime(NOW)` with
`NOW = 2026-03-15` (local noon), restored to real timers in `afterEach`. This is the same pattern
already used by `tests/components/conversion/conversion-progress.test.tsx` and
`FallbackInput.test.tsx`. Expected weekday/month values that depend on locale formatting are
re-computed in-test from the `Date` API so assertions mirror the component's own logic rather than
hard-coded constants.

## Assertions added (by group)

### Rendering & defaults
- Default title `IRイベントカレンダー` shown when `title` omitted.
- Custom `title` prop is rendered and default title absent.
- All 7 Japanese weekday headers (`日月火水木金土`) present by default.
- All 7 English weekday headers (`Sun..Sat`) present for `language="en"`.
- Month label formatted as `2026年3月` (ja).
- Month label formatted via `toLocaleDateString('en-US', {year, month:'long'})` (en) — value
  re-derived in-test.

### Calendar grid
- Day-cell count equals days-in-month for the current month (March = 31).
- First (`1`) and last (`31`) day numbers render.
- Zero leading empty cells when the month starts on Sunday (March 2026).
- Leading empty-cell count equals `getDay()` of the first of month, and day-cell count equals
  days-in-month, for a mid-week-starting month (April 2026) — both values computed from `Date`.
- Exactly one cell carries the `border-primary` today styling and its day number is `15`.
- All non-today cells use `border-transparent` (31 − 1).

### Day events
- An event in the current month renders a dot (located via its `title` attribute).
- Each of the 5 event types maps to its color class (`bg-blue/green/purple/yellow/gray-500`).
- 3 events on one day → exactly 2 dots + `+1` overflow indicator.
- Exactly 2 events on one day → 2 dots, no `+1`.
- 1 event → exactly 1 dot, no overflow.
- The dot's `title` attribute equals the event title.
- An event with a date string carrying a time suffix (`2026-03-08T10:30:00`) still matches its day
  (exercises the `startsWith("YYYY-MM-DD")` matching).
- An event in a different month produces no day dot in the current grid.
- Events on day 1 and day 31 (month boundaries) each render a dot.
- `onEventClick` is called with the event when a day dot is clicked.
- Clicking a day dot does not throw when `onEventClick` is not provided (optional-chaining guard).

### Upcoming events section
- `今後のイベント` heading shown (ja) when events present.
- `Upcoming Events` heading shown for `language="en"`.
- Upcoming section absent when `events` is empty.
- Past event excluded; future event included (`>= today` filter).
- Upcoming list capped at 3 entries (4th omitted).
- Upcoming row renders title, localized date, and ja type badge (`決算発表`).
- Upcoming row renders en type badge (`Dividend`) and en-localized date for `language="en"`.
- `onEventClick` fires when an upcoming row is clicked (click bubbles from the title text).

### Month navigation
- Prev button moves label `2026年3月 → 2026年2月` (old label gone).
- Next button moves label `2026年3月 → 2026年4月`.
- Backward navigation across a year boundary: `2026年1月 → 2025年12月`.
- A next-month event has no dot initially and gains one after clicking next.
- A previous-month event has no dot initially and gains one after clicking prev.

### Fail-safe & edge cases
- Empty `events` array: shell renders, no colored dots, no `.rounded-full` elements, no upcoming
  heading.
- Clicking an upcoming row with no `onEventClick` does not throw.
- All five event types resolve to a concrete color and label (no undefined key) without throwing.
- Month label is stable under a fixed clock.

## Coverage rationale

The component is pure UI with no external collaborators (no network, no DB, no AI), so the
"dependency failure / timeout" error-path requirement maps to the component's own fault modes:
missing optional callback (`onEventClick?.`) and unknown/edge type keys — both covered as fail-safe
cases. Boundary conditions covered: month start day-of-week (0 vs mid-week), first/last day of
month, the `>2` overflow threshold, the `>=3` upcoming slice boundary, and the year-boundary month
navigation. Determinism is guaranteed by the pinned system clock; locale-formatted strings are
asserted against values derived from the same `Date`/`toLocaleDateString` calls the component uses.
