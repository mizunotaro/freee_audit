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

import {
  BudgetVsActualChart,
  BudgetVsActualHorizontalChart,
} from '@/components/charts/BudgetVsActualChart'

interface BudgetItem {
  name: string
  budget: number
  actual: number
  variance: number
}

interface FormattedItem extends BudgetItem {
  budgetFormatted: string
  actualFormatted: string
  varianceFormatted: string
  achievementRate: number
}

const reset = () => {
  capture.renderLog = []
  capture.data = null
}

const sampleData: BudgetItem[] = [
  { name: '売上', budget: 100000, actual: 80000, variance: -20000 },
  { name: '経費', budget: 0, actual: 5000, variance: 5000 },
  { name: '利益', budget: 50000, actual: 75000, variance: 25000 },
  { name: '調整', budget: -10000, actual: 3000, variance: 13000 },
]

describe('BudgetVsActualChart', () => {
  beforeEach(reset)

  it('computes achievementRate as (actual/budget)*100 for positive budgets', () => {
    render(<BudgetVsActualChart data={sampleData} />)

    const formatted = capture.data?.data as FormattedItem[]
    expect(formatted[0].achievementRate).toBe(80)
    expect(formatted[2].achievementRate).toBe(150)
  })

  it('guards achievementRate to 0 when budget is not strictly positive', () => {
    render(<BudgetVsActualChart data={sampleData} />)

    const formatted = capture.data?.data as FormattedItem[]
    // budget === 0
    expect(formatted[1].achievementRate).toBe(0)
    // budget < 0
    expect(formatted[3].achievementRate).toBe(0)
  })

  it('attaches formatted currency strings to each row', () => {
    render(<BudgetVsActualChart data={sampleData} />)

    const formatted = capture.data?.data as FormattedItem[]
    expect(formatted[0].budgetFormatted).toBe(formatCurrency(100000))
    expect(formatted[0].actualFormatted).toBe(formatCurrency(80000))
    expect(formatted[0].varianceFormatted).toBe(formatCurrency(-20000))
  })

  it('renders budget, actual and variance bars by default (showVariance true)', () => {
    render(<BudgetVsActualChart data={sampleData} />)

    const bars = capture.renderLog.filter((n) => n === 'Bar').length
    expect(bars).toBe(3)
  })

  it('omits the variance bar when showVariance is false', () => {
    render(<BudgetVsActualChart data={sampleData} showVariance={false} />)

    const bars = capture.renderLog.filter((n) => n === 'Bar').length
    expect(bars).toBe(2)
  })

  it('renders the empty state when data is empty', () => {
    render(<BudgetVsActualChart data={[]} />)

    expect(screen.getByText('データがありません')).toBeInTheDocument()
    expect(capture.data).toBeNull()
  })

  it('renders the loading skeleton when loading is true', () => {
    const { container } = render(<BudgetVsActualChart data={sampleData} loading />)

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    expect(capture.data).toBeNull()
  })

  it('renders the error message when error is provided', () => {
    render(<BudgetVsActualChart data={sampleData} error="読み込みエラー" />)

    expect(screen.getByRole('alert')).toHaveTextContent('読み込みエラー')
    expect(capture.data).toBeNull()
  })

  it('prefers loading over error when both are set', () => {
    render(<BudgetVsActualChart data={sampleData} loading error="boom" />)

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('BudgetVsActualHorizontalChart', () => {
  beforeEach(reset)

  it('applies the same achievementRate and formatting logic', () => {
    render(<BudgetVsActualHorizontalChart data={sampleData} />)

    const formatted = capture.data?.data as FormattedItem[]
    expect(formatted[0].achievementRate).toBe(80)
    expect(formatted[1].achievementRate).toBe(0)
    expect(formatted[0].budgetFormatted).toBe(formatCurrency(100000))
  })

  it('renders the empty state when data is empty', () => {
    render(<BudgetVsActualHorizontalChart data={[]} />)

    expect(screen.getByText('データがありません')).toBeInTheDocument()
    expect(capture.data).toBeNull()
  })

  it('renders the loading skeleton when loading is true', () => {
    const { container } = render(<BudgetVsActualHorizontalChart data={sampleData} loading />)

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    expect(capture.data).toBeNull()
  })

  it('renders the error message when error is provided', () => {
    render(<BudgetVsActualHorizontalChart data={sampleData} error="取得エラー" />)

    expect(screen.getByRole('alert')).toHaveTextContent('取得エラー')
    expect(capture.data).toBeNull()
  })
})

describe('BudgetVsActualChart — accessibility', () => {
  it('exposes the chart as role=img with a text-alternative label', () => {
    render(<BudgetVsActualChart data={sampleData} />)

    expect(screen.getByRole('img', { name: /予算対実績チャート/ })).toBeInTheDocument()
  })
})
