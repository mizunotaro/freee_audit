import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { formatCurrency } from '@/lib/utils'
import type { MonthlyTrend } from '@/types'

const capture = vi.hoisted(() => ({
  renderLog: [] as string[],
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
      capture.renderLog.push(name)
      if (props.data !== undefined) {
        capture.data = { wrapper: name, data: props.data }
      }
      return props.children ?? null
    }
  return {
    ResponsiveContainer: stub('ResponsiveContainer'),
    BarChart: stub('BarChart'),
    ComposedChart: stub('ComposedChart'),
    LineChart: stub('LineChart'),
    PieChart: stub('PieChart'),
    Bar: stub('Bar'),
    Line: stub('Line'),
    XAxis: stub('XAxis'),
    YAxis: stub('YAxis'),
    CartesianGrid: stub('CartesianGrid'),
    Tooltip: stub('Tooltip'),
    Legend: stub('Legend'),
    ReferenceLine: stub('ReferenceLine'),
    Cell: stub('Cell'),
    Pie: stub('Pie'),
  }
})

import { MonthlyTrendChart } from '@/components/charts/MonthlyTrendChart'

interface FormattedTrend extends MonthlyTrend {
  revenueFormatted: string
  grossProfitFormatted: string
  operatingIncomeFormatted: string
  netIncomeFormatted: string
}

const reset = () => {
  capture.renderLog = []
  capture.data = null
}

const sampleTrend: MonthlyTrend[] = [
  {
    month: '2024-01',
    revenue: 1000000,
    grossProfit: 600000,
    operatingIncome: 300000,
    netIncome: 200000,
    cash: 500000,
  },
  {
    month: '2024-02',
    revenue: 1200000,
    grossProfit: 700000,
    operatingIncome: 350000,
    netIncome: 210000,
    cash: 710000,
  },
]

describe('MonthlyTrendChart', () => {
  beforeEach(reset)

  it('attaches formatted currency strings for each metric on each row', () => {
    render(<MonthlyTrendChart data={sampleTrend} />)

    const formatted = capture.data?.data as FormattedTrend[]
    expect(formatted[0].revenueFormatted).toBe(formatCurrency(1000000))
    expect(formatted[0].grossProfitFormatted).toBe(formatCurrency(600000))
    expect(formatted[0].operatingIncomeFormatted).toBe(formatCurrency(300000))
    expect(formatted[0].netIncomeFormatted).toBe(formatCurrency(200000))
  })

  it('renders a line per metric (revenue, grossProfit, operatingIncome, netIncome)', () => {
    render(<MonthlyTrendChart data={sampleTrend} />)

    expect(capture.renderLog.filter((n) => n === 'Line').length).toBe(4)
  })

  it('preserves the original fields on the formatted rows', () => {
    render(<MonthlyTrendChart data={sampleTrend} />)

    const formatted = capture.data?.data as FormattedTrend[]
    expect(formatted[0].month).toBe('2024-01')
    expect(formatted[0].revenue).toBe(1000000)
    expect(formatted[0].cash).toBe(500000)
  })

  it('renders without crashing for empty data', () => {
    render(<MonthlyTrendChart data={[]} />)

    expect(capture.data?.data).toEqual([])
  })
})
