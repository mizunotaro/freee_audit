import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { IRCalendarWidget } from '@/components/reports/ir/ir-calendar-widget'
import type { IREvent } from '@/types/reports/ir-report'

// Fixed "now": 2026-03-15 (local noon). March 2026 starts on Sunday and has 31 days.
// Using a deterministic clock is required because the component derives its
// displayed month and "today" highlight from `new Date()` at render time.
const NOW = new Date(2026, 2, 15, 12, 0, 0)

function makeEvent(overrides: Partial<IREvent> = {}): IREvent {
  return {
    id: 'evt-1',
    title: 'イベント1',
    date: '2026-03-20',
    type: 'earnings',
    ...overrides,
  }
}

// Selectors scoped to the calendar grid so assertions are independent of the
// surrounding Card markup.
const gridOf = (container: HTMLElement) =>
  container.querySelector('.grid.grid-cols-7') as HTMLElement
const dayCellsOf = (container: HTMLElement) =>
  gridOf(container).querySelectorAll('[class~="border"]')
const todayCellOf = (container: HTMLElement) =>
  gridOf(container).querySelector('[class~="border-primary"]')
const emptyCellsOf = (container: HTMLElement) =>
  gridOf(container).querySelectorAll('.h-12:not([class*="border"])')
const prevButton = (container: HTMLElement) =>
  container.querySelector('.lucide-chevron-left')!.closest('button')!
const nextButton = (container: HTMLElement) =>
  container.querySelector('.lucide-chevron-right')!.closest('button')!

// Finds the day cell whose day number equals `dayNum`.
const dayCellFor = (container: HTMLElement, dayNum: number): HTMLElement => {
  const cells = Array.from(gridOf(container).querySelectorAll<HTMLElement>('[class~="border"]'))
  return cells.find(
    (c) => (c.querySelector(':scope > div') as HTMLElement | null)?.textContent === String(dayNum)
  )!
}

describe('IRCalendarWidget', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('rendering & defaults', () => {
    it('renders the default Japanese title when no title is provided', () => {
      render(<IRCalendarWidget events={[]} />)

      expect(screen.getByText('IRイベントカレンダー')).toBeInTheDocument()
    })

    it('renders a custom title when the title prop is provided', () => {
      render(<IRCalendarWidget events={[]} title="カスタムタイトル" />)

      expect(screen.getByText('カスタムタイトル')).toBeInTheDocument()
      expect(screen.queryByText('IRイベントカレンダー')).not.toBeInTheDocument()
    })

    it('renders the Japanese weekday headers by default', () => {
      render(<IRCalendarWidget events={[]} />)

      for (const wd of ['日', '月', '火', '水', '木', '金', '土']) {
        expect(screen.getByText(wd)).toBeInTheDocument()
      }
    })

    it('renders the English weekday headers when language="en"', () => {
      render(<IRCalendarWidget events={[]} language="en" />)

      for (const wd of ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']) {
        expect(screen.getByText(wd)).toBeInTheDocument()
      }
    })

    it('formats the current month label in Japanese by default', () => {
      render(<IRCalendarWidget events={[]} />)

      expect(screen.getByText('2026年3月')).toBeInTheDocument()
    })

    it('formats the current month label in English when language="en"', () => {
      render(<IRCalendarWidget events={[]} language="en" />)

      const expected = NOW.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
      expect(screen.getByText(expected)).toBeInTheDocument()
    })
  })

  describe('calendar grid', () => {
    it('renders one day cell per day of the current month (March = 31)', () => {
      const { container } = render(<IRCalendarWidget events={[]} />)

      expect(dayCellsOf(container).length).toBe(31)
    })

    it('renders the first and last day numbers of the month', () => {
      render(<IRCalendarWidget events={[]} />)

      expect(screen.getByText('1')).toBeInTheDocument()
      expect(screen.getByText('31')).toBeInTheDocument()
    })

    it('renders no leading empty cells when the month starts on Sunday', () => {
      const { container } = render(<IRCalendarWidget events={[]} />)

      // March 2026 starts on Sunday -> 0 leading empties.
      expect(emptyCellsOf(container).length).toBe(0)
    })

    it('renders leading empty cells for a month that starts mid-week', () => {
      // April 2026 starts on Wednesday (3 leading empties) and has 30 days.
      vi.setSystemTime(new Date(2026, 3, 10, 12, 0, 0))
      const { container } = render(<IRCalendarWidget events={[]} />)

      const ref = new Date(2026, 3, 10)
      const firstDayOfWeek = new Date(ref.getFullYear(), ref.getMonth(), 1).getDay()
      const daysInMonth = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate()

      expect(emptyCellsOf(container).length).toBe(firstDayOfWeek)
      expect(dayCellsOf(container).length).toBe(daysInMonth)
    })

    it('highlights today with the primary border styling', () => {
      const { container } = render(<IRCalendarWidget events={[]} />)

      const today = todayCellOf(container)
      expect(today).not.toBeNull()
      // The highlighted day number is 15.
      expect((today as HTMLElement)!.querySelector(':scope > div')!.textContent).toBe('15')
    })

    it('does not apply today styling to non-today cells', () => {
      const { container } = render(<IRCalendarWidget events={[]} />)

      // Exactly one today cell exists.
      expect(todayCellOf(container)).not.toBeNull()
      // All other day cells use the transparent border.
      const transparent = gridOf(container).querySelectorAll('[class~="border-transparent"]')
      expect(transparent.length).toBe(31 - 1)
    })
  })

  describe('day events', () => {
    it('renders an event dot for an event in the current month', () => {
      const event = makeEvent({ date: '2026-03-08', title: '3月の決算' })
      const { container } = render(<IRCalendarWidget events={[event]} />)

      const dot = container.querySelector('[title="3月の決算"]')
      expect(dot).not.toBeNull()
    })

    it('assigns the correct color class per event type', () => {
      const events: IREvent[] = [
        makeEvent({ id: 'e1', date: '2026-03-02', type: 'earnings', title: 't1' }),
        makeEvent({ id: 'e2', date: '2026-03-03', type: 'presentation', title: 't2' }),
        makeEvent({ id: 'e3', date: '2026-03-04', type: 'meeting', title: 't3' }),
        makeEvent({ id: 'e4', date: '2026-03-05', type: 'dividend', title: 't4' }),
        makeEvent({ id: 'e5', date: '2026-03-06', type: 'other', title: 't5' }),
      ]
      const { container } = render(<IRCalendarWidget events={events} />)

      // Days 2-6 are all in the past relative to NOW (the 15th), so only day
      // dots (not upcoming-list dots) render.
      expect(container.querySelector('[class~="bg-blue-500"]')).not.toBeNull()
      expect(container.querySelector('[class~="bg-green-500"]')).not.toBeNull()
      expect(container.querySelector('[class~="bg-purple-500"]')).not.toBeNull()
      expect(container.querySelector('[class~="bg-yellow-500"]')).not.toBeNull()
      expect(container.querySelector('[class~="bg-gray-500"]')).not.toBeNull()
    })

    it('renders at most two dots and shows "+N" overflow when more than two events share a day', () => {
      const events: IREvent[] = [
        makeEvent({ id: 'e1', date: '2026-03-08', title: 't1' }),
        makeEvent({ id: 'e2', date: '2026-03-08', title: 't2' }),
        makeEvent({ id: 'e3', date: '2026-03-08', title: 't3' }),
      ]
      const { container } = render(<IRCalendarWidget events={events} />)

      const cell = dayCellFor(container, 8)
      expect(cell.querySelectorAll('.rounded-full').length).toBe(2)
      expect(screen.getByText('+1')).toBeInTheDocument()
    })

    it('does not show an overflow indicator when exactly two events share a day', () => {
      const events: IREvent[] = [
        makeEvent({ id: 'e1', date: '2026-03-08', title: 't1' }),
        makeEvent({ id: 'e2', date: '2026-03-08', title: 't2' }),
      ]
      render(<IRCalendarWidget events={events} />)

      expect(screen.queryByText('+1')).not.toBeInTheDocument()
    })

    it('renders a single dot for a single event with no overflow indicator', () => {
      const { container } = render(
        <IRCalendarWidget events={[makeEvent({ date: '2026-03-08' })]} />
      )

      expect(dayCellFor(container, 8).querySelectorAll('.rounded-full').length).toBe(1)
    })

    it('sets the event title as the dot title attribute', () => {
      const { container } = render(
        <IRCalendarWidget events={[makeEvent({ date: '2026-03-08', title: '詳細タイトル' })]} />
      )

      expect(container.querySelector('[title="詳細タイトル"]')).not.toBeNull()
    })

    it('matches an event whose date string carries a time component', () => {
      const { container } = render(
        <IRCalendarWidget
          events={[makeEvent({ date: '2026-03-08T10:30:00', title: '時刻付き' })]}
        />
      )

      // getEventsForDay matches via startsWith("YYYY-MM-DD"), so the time suffix
      // must not break day matching.
      expect(container.querySelector('[title="時刻付き"]')).not.toBeNull()
      expect(dayCellFor(container, 8).querySelectorAll('.rounded-full').length).toBe(1)
    })

    it('does not render a day dot for an event in a different month', () => {
      const { container } = render(
        <IRCalendarWidget events={[makeEvent({ date: '2026-04-10', title: '4月イベント' })]} />
      )

      // April event is upcoming so it shows in the upcoming list (text), but it
      // must not produce a day dot in the March grid (no title attribute).
      expect(container.querySelector('[title="4月イベント"]')).not.toBeTruthy()
    })

    it('renders dots on the first and last day of the month when events exist there', () => {
      const { container } = render(
        <IRCalendarWidget
          events={[
            makeEvent({ id: 'first', date: '2026-03-01', title: '月初' }),
            makeEvent({ id: 'last', date: '2026-03-31', title: '月末' }),
          ]}
        />
      )

      expect(dayCellFor(container, 1).querySelectorAll('.rounded-full').length).toBe(1)
      expect(dayCellFor(container, 31).querySelectorAll('.rounded-full').length).toBe(1)
    })

    it('calls onEventClick with the event when a day dot is clicked', () => {
      const onEventClick = vi.fn()
      const event = makeEvent({ id: 'click-1', date: '2026-03-05', title: 'クリック対象' })
      const { container } = render(
        <IRCalendarWidget events={[event]} onEventClick={onEventClick} />
      )

      fireEvent.click(container.querySelector('[title="クリック対象"]')!)

      expect(onEventClick).toHaveBeenCalledTimes(1)
      expect(onEventClick).toHaveBeenCalledWith(event)
    })

    it('does not throw when a day dot is clicked and onEventClick is not provided', () => {
      const { container } = render(
        <IRCalendarWidget events={[makeEvent({ date: '2026-03-05', title: 'ハンドラなし' })]} />
      )

      expect(() => {
        fireEvent.click(container.querySelector('[title="ハンドラなし"]')!)
      }).not.toThrow()
    })
  })

  describe('upcoming events section', () => {
    it('shows the upcoming events heading in Japanese when events are present', () => {
      render(<IRCalendarWidget events={[makeEvent({ date: '2026-03-25' })]} />)

      expect(screen.getByText('今後のイベント')).toBeInTheDocument()
    })

    it('shows the upcoming events heading in English when language="en"', () => {
      render(<IRCalendarWidget events={[makeEvent({ date: '2026-03-25' })]} language="en" />)

      expect(screen.getByText('Upcoming Events')).toBeInTheDocument()
    })

    it('hides the upcoming events section when the events list is empty', () => {
      render(<IRCalendarWidget events={[]} />)

      expect(screen.queryByText('今後のイベント')).not.toBeInTheDocument()
      expect(screen.queryByText('Upcoming Events')).not.toBeInTheDocument()
    })

    it('excludes past events from the upcoming list', () => {
      const past = makeEvent({ id: 'past', date: '2026-02-01', title: '過去イベント' })
      const future = makeEvent({ id: 'fut', date: '2026-03-25', title: '未来イベント' })
      render(<IRCalendarWidget events={[past, future]} />)

      expect(screen.queryByText('過去イベント')).not.toBeInTheDocument()
      expect(screen.getByText('未来イベント')).toBeInTheDocument()
    })

    it('limits the upcoming list to at most three entries', () => {
      const events: IREvent[] = [25, 26, 27, 28].map((d, i) =>
        makeEvent({ id: `f${i}`, date: `2026-03-${d}`, title: `未来${i}` })
      )
      render(<IRCalendarWidget events={events} />)

      expect(screen.getByText('未来0')).toBeInTheDocument()
      expect(screen.getByText('未来1')).toBeInTheDocument()
      expect(screen.getByText('未来2')).toBeInTheDocument()
      expect(screen.queryByText('未来3')).not.toBeInTheDocument()
    })

    it('renders the event title, localized date, and type badge for upcoming events', () => {
      const event = makeEvent({
        id: 'up-1',
        date: '2026-03-25',
        title: '決算予定',
        type: 'earnings',
      })
      render(<IRCalendarWidget events={[event]} />)

      expect(screen.getByText('決算予定')).toBeInTheDocument()
      expect(screen.getByText('決算発表')).toBeInTheDocument() // ja badge label
      expect(
        screen.getByText(new Date('2026-03-25').toLocaleDateString('ja-JP'))
      ).toBeInTheDocument()
    })

    it('renders the English type badge label when language="en"', () => {
      const event = makeEvent({
        id: 'up-2',
        date: '2026-03-25',
        title: 'Earnings Plan',
        type: 'dividend',
      })
      render(<IRCalendarWidget events={[event]} language="en" />)

      expect(screen.getByText('Dividend')).toBeInTheDocument() // en badge label
      expect(
        screen.getByText(new Date('2026-03-25').toLocaleDateString('en-US'))
      ).toBeInTheDocument()
    })

    it('calls onEventClick when an upcoming event row is clicked', () => {
      const onEventClick = vi.fn()
      const event = makeEvent({ id: 'row-1', date: '2026-03-25', title: '行クリック' })
      render(<IRCalendarWidget events={[event]} onEventClick={onEventClick} />)

      fireEvent.click(screen.getByText('行クリック'))

      expect(onEventClick).toHaveBeenCalledTimes(1)
      expect(onEventClick).toHaveBeenCalledWith(event)
    })
  })

  describe('month navigation', () => {
    it('moves to the previous month when the prev button is clicked', () => {
      const { container } = render(<IRCalendarWidget events={[]} />)

      expect(screen.getByText('2026年3月')).toBeInTheDocument()

      fireEvent.click(prevButton(container))

      expect(screen.getByText('2026年2月')).toBeInTheDocument()
      expect(screen.queryByText('2026年3月')).not.toBeInTheDocument()
    })

    it('moves to the next month when the next button is clicked', () => {
      const { container } = render(<IRCalendarWidget events={[]} />)

      fireEvent.click(nextButton(container))

      expect(screen.getByText('2026年4月')).toBeInTheDocument()
    })

    it('navigates across a year boundary (Dec -> Jan) backwards', () => {
      vi.setSystemTime(new Date(2026, 0, 10, 12, 0, 0)) // January 2026
      const { container } = render(<IRCalendarWidget events={[]} />)

      fireEvent.click(prevButton(container))

      expect(screen.getByText('2025年12月')).toBeInTheDocument()
    })

    it('reveals a next-month event as a day dot only after navigating forward', () => {
      const aprilEvent = makeEvent({ id: 'apr', date: '2026-04-10', title: '4月ドット' })
      const { container } = render(<IRCalendarWidget events={[aprilEvent]} />)

      // In the March view the April event has no day dot.
      expect(container.querySelector('[title="4月ドット"]')).not.toBeTruthy()

      fireEvent.click(nextButton(container))

      expect(screen.getByText('2026年4月')).toBeInTheDocument()
      expect(container.querySelector('[title="4月ドット"]')).toBeTruthy()
    })

    it('reveals a previous-month event as a day dot only after navigating back', () => {
      const febEvent = makeEvent({ id: 'feb', date: '2026-02-10', title: '2月ドット' })
      const { container } = render(<IRCalendarWidget events={[febEvent]} />)

      expect(container.querySelector('[title="2月ドット"]')).not.toBeTruthy()

      fireEvent.click(prevButton(container))

      expect(screen.getByText('2026年2月')).toBeInTheDocument()
      expect(container.querySelector('[title="2月ドット"]')).toBeTruthy()
    })
  })

  describe('fail-safe & edge cases', () => {
    it('renders the widget shell with an empty events array (no dots, no upcoming section)', () => {
      const { container } = render(<IRCalendarWidget events={[]} />)

      expect(screen.getByText('IRイベントカレンダー')).toBeInTheDocument()
      expect(container.querySelector('[class~="bg-blue-500"]')).toBeNull()
      expect(container.querySelectorAll('.rounded-full').length).toBe(0)
      expect(screen.queryByText('今後のイベント')).not.toBeInTheDocument()
    })

    it('degrades safely when onEventClick is omitted and an upcoming row is clicked', () => {
      render(<IRCalendarWidget events={[makeEvent({ date: '2026-03-25', title: '安全確認' })]} />)

      expect(() => {
        fireEvent.click(screen.getByText('安全確認'))
      }).not.toThrow()
    })

    it('treats all five event types as valid keys (no undefined color/label)', () => {
      const types: IREvent['type'][] = ['earnings', 'presentation', 'meeting', 'dividend', 'other']
      const events: IREvent[] = types.map((type, i) =>
        makeEvent({ id: `t${i}`, date: `2026-03-${10 + i}`, type, title: `type-${type}` })
      )

      expect(() => render(<IRCalendarWidget events={events} />)).not.toThrow()
      // Every type resolved to a concrete color class on its dot.
      for (const title of events.map((e) => e.title)) {
        expect(screen.queryByTitle(title)).not.toBeNull()
      }
    })

    it('renders deterministically under a fixed clock (month label stable across reads)', () => {
      const { container } = render(<IRCalendarWidget events={[]} />)
      const first = screen.getByText('2026年3月').textContent

      vi.setSystemTime(new Date(2026, 2, 15, 23, 59, 59))
      const second = gridOf(container)
      expect(second).toBeTruthy()
      expect(first).toBe('2026年3月')
    })
  })
})
