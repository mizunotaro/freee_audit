import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const capture = vi.hoisted(() => ({
  data: null as { wrapper: string; data: unknown } | null,
}))

vi.mock('recharts', () => {
  interface MockProps {
    children?: unknown
    data?: unknown
    [key: string]: unknown
  }
  const stub =
    (name: string) =>
    (props: MockProps): unknown => {
      if (props.data !== undefined) {
        capture.data = { wrapper: name, data: props.data }
      }
      return props.children ?? null
    }
  return {
    ResponsiveContainer: stub('ResponsiveContainer'),
    ComposedChart: stub('ComposedChart'),
    Area: stub('Area'),
    Line: stub('Line'),
    XAxis: stub('XAxis'),
    YAxis: stub('YAxis'),
    CartesianGrid: stub('CartesianGrid'),
    Tooltip: stub('Tooltip'),
    Legend: stub('Legend'),
    ReferenceLine: stub('ReferenceLine'),
  }
})

import { RunwayScenarioChart } from '@/components/charts/RunwayScenarioChart'
import type { RunwayData } from '@/types/reports'

interface ScenarioPoint {
  month: string
  band: [number, number]
  realistic: number
  optimistic: number
  pessimistic: number
}

const reset = () => {
  capture.data = null
}

const sampleRunway: RunwayData = {
  monthlyBurnRate: 1000000,
  runwayMonths: 12,
  scenarios: {
    optimistic: { burnRate: 500000, runwayMonths: 24 },
    realistic: { burnRate: 1000000, runwayMonths: 12 },
    pessimistic: { burnRate: 2000000, runwayMonths: 6 },
  },
}

const CURRENT_CASH = 12000000

describe('RunwayScenarioChart', () => {
  beforeEach(reset)

  it('projects monthly cash depletion for each scenario from current cash', () => {
    render(<RunwayScenarioChart runway={sampleRunway} currentCash={CURRENT_CASH} />)

    const points = capture.data?.data as ScenarioPoint[]
    // horizon = max(24, 12, 6) = 24 → 25 points (month 0..24)
    expect(points).toHaveLength(25)

    // Month 0: all scenarios start at current cash
    expect(points[0].band).toEqual([CURRENT_CASH, CURRENT_CASH])
    expect(points[0].realistic).toBe(CURRENT_CASH)

    // Month 6: optimistic=9M, realistic=6M, pessimistic=0 (clamped)
    expect(points[6].optimistic).toBe(9000000)
    expect(points[6].realistic).toBe(6000000)
    expect(points[6].pessimistic).toBe(0)
    expect(points[6].band).toEqual([0, 9000000])

    // Month 12: realistic hits 0
    expect(points[12].realistic).toBe(0)
    expect(points[12].optimistic).toBe(6000000)

    // Month 24: optimistic hits 0
    expect(points[24].optimistic).toBe(0)
    expect(points[24].band).toEqual([0, 0])
  })

  it('caps the horizon at 36 months to avoid unbounded arrays', () => {
    const longRunway: RunwayData = {
      monthlyBurnRate: 1000,
      runwayMonths: 100,
      scenarios: {
        optimistic: { burnRate: 1000, runwayMonths: 100 },
        realistic: { burnRate: 1000, runwayMonths: 100 },
        pessimistic: { burnRate: 1000, runwayMonths: 100 },
      },
    }

    render(<RunwayScenarioChart runway={longRunway} currentCash={100000} />)

    const points = capture.data?.data as ScenarioPoint[]
    expect(points).toHaveLength(37) // 0..36
  })

  it('renders the empty state when runway is null', () => {
    render(<RunwayScenarioChart runway={null} currentCash={CURRENT_CASH} />)

    expect(screen.getByText('データがありません')).toBeInTheDocument()
    expect(capture.data).toBeNull()
  })

  it('renders the loading skeleton when loading is true', () => {
    const { container } = render(
      <RunwayScenarioChart runway={sampleRunway} currentCash={CURRENT_CASH} loading />
    )

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    expect(capture.data).toBeNull()
  })

  it('renders the error message when error is provided', () => {
    render(
      <RunwayScenarioChart runway={sampleRunway} currentCash={CURRENT_CASH} error="取得エラー" />
    )

    expect(screen.getByRole('alert')).toHaveTextContent('取得エラー')
    expect(capture.data).toBeNull()
  })

  it('prefers loading over error when both are set', () => {
    render(
      <RunwayScenarioChart runway={sampleRunway} currentCash={CURRENT_CASH} loading error="boom" />
    )

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
