import React from 'react'
import { render } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { KPICards } from '@/components/reports/kpi/kpi-cards'
import { KPICard } from '@/components/charts/KPIGauge'
import type { KPIProfitability, KPISafety } from '@/types/reports/kpi'

vi.mock('@/components/charts/KPIGauge', () => ({
  KPICard: vi.fn(() => null),
}))

const profitability = (overrides: Partial<KPIProfitability> = {}): KPIProfitability => ({
  roe: 12,
  roa: 6,
  ros: 8,
  grossProfitMargin: 35,
  operatingMargin: 12,
  ebitdaMargin: 18,
  ...overrides,
})

const safety = (overrides: Partial<KPISafety> = {}): KPISafety => ({
  currentRatio: 160,
  quickRatio: 120,
  debtToEquity: 0.8,
  equityRatio: 35,
  ...overrides,
})

const cardCall = (i: number) => (KPICard as unknown as Mock).mock.calls[i][0]

describe('KPICards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders four cards with the expected titles and target descriptions', () => {
    render(<KPICards profitability={profitability()} safety={safety()} />)

    expect(cardCall(0).title).toBe('ROE（自己資本利益率）')
    expect(cardCall(0).description).toBe('目標: 10%以上')
    expect(cardCall(1).title).toBe('ROA（総資産利益率）')
    expect(cardCall(1).description).toBe('目標: 5%以上')
    expect(cardCall(2).title).toBe('流動比率')
    expect(cardCall(2).description).toBe('目標: 150%以上')
    expect(cardCall(3).title).toBe('自己資本比率')
    expect(cardCall(3).description).toBe('目標: 30%以上')

    expect(KPICard as unknown as Mock).toHaveBeenCalledTimes(4)
  })

  it('formats percentages to the right precision (1 dp for ROE/ROA, 0 dp for ratios)', () => {
    render(
      <KPICards
        profitability={profitability({ roe: 12.34, roa: 6.56 })}
        safety={safety({ currentRatio: 160.7, equityRatio: 35.2 })}
      />
    )

    expect(cardCall(0).value).toBe('12.3')
    expect(cardCall(0).unit).toBe('%')
    expect(cardCall(1).value).toBe('6.6')
    expect(cardCall(2).value).toBe('161') // toFixed(0) rounds 160.7 up
    expect(cardCall(3).value).toBe('35') // toFixed(0) rounds 35.2 down
  })

  it('classifies ROE trend across the three thresholds', () => {
    const props = (roe: number) => (
      <KPICards profitability={profitability({ roe })} safety={safety()} />
    )
    const { rerender } = render(props(12))
    expect(cardCall(0).trend).toBe('up')

    vi.mocked(KPICard).mockClear()
    rerender(props(10))
    expect(cardCall(0).trend).toBe('up') // boundary inclusive

    vi.mocked(KPICard).mockClear()
    rerender(props(5))
    expect(cardCall(0).trend).toBe('neutral')

    vi.mocked(KPICard).mockClear()
    rerender(props(4.9))
    expect(cardCall(0).trend).toBe('down')
  })

  it('classifies ROA trend across the three thresholds', () => {
    const props = (roa: number) => (
      <KPICards profitability={profitability({ roa })} safety={safety()} />
    )
    const { rerender } = render(props(5))
    expect(cardCall(1).trend).toBe('up')

    vi.mocked(KPICard).mockClear()
    rerender(props(2))
    expect(cardCall(1).trend).toBe('neutral')

    vi.mocked(KPICard).mockClear()
    rerender(props(1.9))
    expect(cardCall(1).trend).toBe('down')
  })

  it('classifies current-ratio trend across the three thresholds', () => {
    const props = (currentRatio: number) => (
      <KPICards profitability={profitability()} safety={safety({ currentRatio })} />
    )
    const { rerender } = render(props(150))
    expect(cardCall(2).trend).toBe('up')

    vi.mocked(KPICard).mockClear()
    rerender(props(100))
    expect(cardCall(2).trend).toBe('neutral')

    vi.mocked(KPICard).mockClear()
    rerender(props(99))
    expect(cardCall(2).trend).toBe('down')
  })

  it('classifies equity-ratio trend across the three thresholds', () => {
    const props = (equityRatio: number) => (
      <KPICards profitability={profitability()} safety={safety({ equityRatio })} />
    )
    const { rerender } = render(props(30))
    expect(cardCall(3).trend).toBe('up')

    vi.mocked(KPICard).mockClear()
    rerender(props(20))
    expect(cardCall(3).trend).toBe('neutral')

    vi.mocked(KPICard).mockClear()
    rerender(props(19))
    expect(cardCall(3).trend).toBe('down')
  })

  it('exposes a value/format mismatch edge: displayed value can round past the trend boundary', () => {
    // 149.6 rounds to "150" for display but stays below the 150 trend boundary.
    render(<KPICards profitability={profitability()} safety={safety({ currentRatio: 149.6 })} />)
    expect(cardCall(2).value).toBe('150')
    expect(cardCall(2).trend).toBe('neutral')
  })
})
