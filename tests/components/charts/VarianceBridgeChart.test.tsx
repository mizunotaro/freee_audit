import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const capture = vi.hoisted(() => ({
  data: null as { wrapper: string; data: unknown } | null,
  cellFills: [] as (string | undefined)[],
}))

vi.mock('recharts', () => {
  interface MockProps {
    children?: unknown
    data?: unknown
    fill?: string
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
  const CellStub = (props: MockProps): unknown => {
    capture.cellFills.push(props.fill)
    return null
  }
  return {
    ResponsiveContainer: stub('ResponsiveContainer'),
    BarChart: stub('BarChart'),
    Bar: stub('Bar'),
    XAxis: stub('XAxis'),
    YAxis: stub('YAxis'),
    CartesianGrid: stub('CartesianGrid'),
    Tooltip: stub('Tooltip'),
    Cell: CellStub,
  }
})

import { VarianceBridgeChart } from '@/components/charts/VarianceBridgeChart'
import type { VarianceBridge } from '@/types/reports/managerial'

interface BridgeRow {
  name: string
  base: number
  value: number
  signed: number
  kind: 'total' | 'up' | 'down'
}

const reset = () => {
  capture.data = null
  capture.cellFills = []
}

const sampleBridge: VarianceBridge = {
  startLabel: '営業利益（予算）',
  start: 0,
  drivers: [
    { label: '売上高差異', amount: 5000000, category: 'revenue' },
    { label: '売上原価差異', amount: -2000000, category: 'cost_of_sales' },
    { label: '販売管理費差異', amount: -1430000, category: 'sga_expense' },
  ],
  endLabel: '営業利益（実績）',
  end: 1570000,
  reconciliationGap: 0,
}

describe('VarianceBridgeChart', () => {
  beforeEach(reset)

  it('builds waterfall rows with floating base for drivers and totals at zero base', () => {
    render(<VarianceBridgeChart bridge={sampleBridge} />)

    const rows = capture.data?.data as BridgeRow[]
    expect(rows).toHaveLength(5)

    // Start total
    expect(rows[0].name).toBe('営業利益（予算）')
    expect(rows[0].base).toBe(0)
    expect(rows[0].value).toBe(0)
    expect(rows[0].kind).toBe('total')

    // Revenue driver (positive → up)
    expect(rows[1].name).toBe('売上高差異')
    expect(rows[1].base).toBe(0) // cumulative before = start = 0
    expect(rows[1].value).toBe(5000000)
    expect(rows[1].signed).toBe(5000000)
    expect(rows[1].kind).toBe('up')

    // COGS driver (negative → down). base = cumulative + amount = 5000000 - 2000000
    expect(rows[2].name).toBe('売上原価差異')
    expect(rows[2].base).toBe(3000000)
    expect(rows[2].value).toBe(2000000)
    expect(rows[2].signed).toBe(-2000000)
    expect(rows[2].kind).toBe('down')

    // SGA driver (negative → down). base = 3000000 - 1430000
    expect(rows[3].name).toBe('販売管理費差異')
    expect(rows[3].base).toBe(1570000)
    expect(rows[3].value).toBe(1430000)
    expect(rows[3].signed).toBe(-1430000)
    expect(rows[3].kind).toBe('down')

    // End total
    expect(rows[4].name).toBe('営業利益（実績）')
    expect(rows[4].base).toBe(0)
    expect(rows[4].value).toBe(1570000)
    expect(rows[4].kind).toBe('total')
  })

  it('colors totals blue, favorable drivers green and unfavorable drivers red', () => {
    render(<VarianceBridgeChart bridge={sampleBridge} />)

    expect(capture.cellFills).toEqual([
      '#3b82f6', // start total
      '#10b981', // revenue up
      '#ef4444', // cogs down
      '#ef4444', // sga down
      '#3b82f6', // end total
    ])
  })

  it('renders the empty state when bridge is null', () => {
    render(<VarianceBridgeChart bridge={null} />)

    expect(screen.getByText('データがありません')).toBeInTheDocument()
    expect(capture.data).toBeNull()
  })

  it('renders the loading skeleton when loading is true', () => {
    const { container } = render(<VarianceBridgeChart bridge={sampleBridge} loading />)

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    expect(capture.data).toBeNull()
  })

  it('renders the error message when error is provided', () => {
    render(<VarianceBridgeChart bridge={sampleBridge} error="読み込みエラー" />)

    expect(screen.getByRole('alert')).toHaveTextContent('読み込みエラー')
    expect(capture.data).toBeNull()
  })

  it('prefers loading over error when both are set', () => {
    render(<VarianceBridgeChart bridge={sampleBridge} loading error="boom" />)

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
