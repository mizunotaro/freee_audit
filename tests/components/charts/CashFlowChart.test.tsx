import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { formatCurrency } from '@/lib/utils'

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

import { CashFlowChart, CashFlowWaterfallChart } from '@/components/charts/CashFlowChart'

const reset = () => {
  capture.renderLog = []
  capture.data = null
}

interface CashFlowRow {
  month: string
  operating: number
  investing: number
  financing: number
  netCash: number
  cumulative: number
}

interface FormattedCashFlowRow extends CashFlowRow {
  operatingFormatted: string
  investingFormatted: string
  financingFormatted: string
  netCashFormatted: string
  cumulativeFormatted: string
}

const sampleCashFlow: CashFlowRow[] = [
  {
    month: '1月',
    operating: 100000,
    investing: -30000,
    financing: 50000,
    netCash: 120000,
    cumulative: 120000,
  },
  {
    month: '2月',
    operating: 80000,
    investing: -20000,
    financing: 0,
    netCash: 60000,
    cumulative: 180000,
  },
]

describe('CashFlowChart', () => {
  beforeEach(reset)

  it('attaches formatted currency strings to each row', () => {
    render(<CashFlowChart data={sampleCashFlow} />)

    const formatted = capture.data?.data as FormattedCashFlowRow[]
    expect(formatted[0].operatingFormatted).toBe(formatCurrency(100000))
    expect(formatted[0].investingFormatted).toBe(formatCurrency(-30000))
    expect(formatted[0].cumulativeFormatted).toBe(formatCurrency(120000))
  })

  it('renders both y-axes and the cumulative line by default (showCumulative true)', () => {
    render(<CashFlowChart data={sampleCashFlow} />)

    expect(capture.renderLog.filter((n) => n === 'YAxis').length).toBe(2)
    expect(capture.renderLog.filter((n) => n === 'Line').length).toBe(1)
    expect(capture.renderLog.filter((n) => n === 'Bar').length).toBe(3)
  })

  it('omits the right y-axis and cumulative line when showCumulative is false', () => {
    render(<CashFlowChart data={sampleCashFlow} showCumulative={false} />)

    expect(capture.renderLog.filter((n) => n === 'YAxis').length).toBe(1)
    expect(capture.renderLog.filter((n) => n === 'Line').length).toBe(0)
    expect(capture.renderLog.filter((n) => n === 'Bar').length).toBe(3)
  })

  it('renders the empty state when data is empty', () => {
    render(<CashFlowChart data={[]} />)

    expect(screen.getByText('データがありません')).toBeInTheDocument()
    expect(capture.data).toBeNull()
  })

  it('renders the loading skeleton when loading is true', () => {
    const { container } = render(<CashFlowChart data={sampleCashFlow} loading />)

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    expect(capture.data).toBeNull()
  })

  it('renders the error message when error is provided', () => {
    render(<CashFlowChart data={sampleCashFlow} error="通信エラー" />)

    expect(screen.getByRole('alert')).toHaveTextContent('通信エラー')
    expect(capture.data).toBeNull()
  })

  it('prefers loading over error when both are set', () => {
    render(<CashFlowChart data={sampleCashFlow} loading error="boom" />)

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

interface WaterfallItem {
  name: string
  value: number
  type: 'positive' | 'negative' | 'total'
}

interface ProcessedWaterfallItem extends WaterfallItem {
  start: number
  end: number
  color: string
}

const waterfallData: WaterfallItem[] = [
  { name: '営業CF', value: 100, type: 'positive' },
  { name: '投資CF', value: -30, type: 'negative' },
  { name: '残高', value: 70, type: 'total' },
]

describe('CashFlowWaterfallChart', () => {
  beforeEach(reset)

  it('accumulates running start/end values across the series', () => {
    render(<CashFlowWaterfallChart data={waterfallData} />)

    const processed = capture.data?.data as ProcessedWaterfallItem[]
    expect(processed[0].start).toBe(0)
    expect(processed[0].end).toBe(100)
    expect(processed[1].start).toBe(100)
    expect(processed[1].end).toBe(70)
    expect(processed[2].start).toBe(70)
    expect(processed[2].end).toBe(140)
  })

  it('colors total items gray regardless of value sign', () => {
    render(<CashFlowWaterfallChart data={waterfallData} />)

    const processed = capture.data?.data as ProcessedWaterfallItem[]
    expect(processed[2].color).toBe('#374151')
  })

  it('colors non-total items green for non-negative values and red for negative values', () => {
    render(<CashFlowWaterfallChart data={waterfallData} />)

    const processed = capture.data?.data as ProcessedWaterfallItem[]
    expect(processed[0].color).toBe('#10b981')
    expect(processed[1].color).toBe('#ef4444')
  })

  it('renders the empty state when data is empty', () => {
    render(<CashFlowWaterfallChart data={[]} />)

    expect(screen.getByText('データがありません')).toBeInTheDocument()
    expect(capture.data).toBeNull()
  })

  it('renders the loading skeleton when loading is true', () => {
    const { container } = render(<CashFlowWaterfallChart data={waterfallData} loading />)

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    expect(capture.data).toBeNull()
  })

  it('renders the error message when error is provided', () => {
    render(<CashFlowWaterfallChart data={waterfallData} error="取得失敗" />)

    expect(screen.getByRole('alert')).toHaveTextContent('取得失敗')
    expect(capture.data).toBeNull()
  })
})
