import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ValuationCharts } from '@/components/valuation/valuation-charts'
import type { DCFResult, MonteCarloResult, WACCResult } from '@/services/valuation'

// recharts is mocked with capture stubs so the data each chart receives is
// deterministic and observable without a real ResponsiveContainer/ResizeObserver.
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
    BarChart: stub('BarChart'),
    Bar: stub('Bar'),
    LineChart: stub('LineChart'),
    Line: stub('Line'),
    AreaChart: stub('AreaChart'),
    Area: stub('Area'),
    PieChart: stub('PieChart'),
    Pie: stub('Pie'),
    Cell: stub('Cell'),
    XAxis: stub('XAxis'),
    YAxis: stub('YAxis'),
    CartesianGrid: stub('CartesianGrid'),
    Tooltip: stub('Tooltip'),
    Legend: stub('Legend'),
  }
})

const dcfResult: DCFResult = {
  enterpriseValue: 1000,
  terminalValue: 800,
  terminalPV: 600,
  currency: 'JPY',
  unit: 'million',
  steps: [],
  metadata: {
    method: 'dcf',
    calculatedAt: '2024-01-01T00:00:00.000Z',
    version: '1.0.0',
    presentValues: [100, 90, 80],
    terminalValue: 800,
    terminalPV: 600,
  },
}

// 25 histogram bins so the component's `.slice(0, 20)` cap is exercised.
const monteCarloResult: MonteCarloResult = {
  statistics: {
    mean: 50000,
    median: 50000,
    stdDev: 15000,
    variance: 225000000,
    skewness: 0.1,
    kurtosis: 2.9,
    percentiles: {
      p1: 1000,
      p5: 5000,
      p10: 10000,
      p25: 25000,
      p50: 50000,
      p75: 75000,
      p90: 90000,
      p95: 95000,
      p99: 99000,
    },
    min: 1000,
    max: 99000,
  },
  distribution: [],
  histogram: Array.from({ length: 25 }, (_, i) => ({
    binStart: i * 1000,
    binEnd: (i + 1) * 1000,
    count: i + 1,
    frequency: (i + 1) / 10,
  })),
  steps: [],
  executionTimeMs: 100,
  iterations: 1000,
  source: 'typescript',
}

const waccResult: WACCResult = {
  wacc: 0.1,
  mode: 'detailed',
  steps: [],
  components: {
    costOfEquity: 0.12,
    costOfDebt: 0.04,
    afterTaxCostOfDebt: 0.032,
    weightedCostOfEquity: 0.08,
    weightedCostOfDebt: 0.02,
  },
}

beforeEach(() => {
  capture.data = null
})

describe('ValuationCharts', () => {
  it('renders an accessible loading skeleton when isLoading is true', () => {
    const { container } = render(<ValuationCharts isLoading dcfResult={dcfResult} />)

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
    expect(container.querySelector('.animate-pulse')).not.toBeNull()
    expect(screen.queryByText('Run calculations to see charts')).not.toBeInTheDocument()
  })

  it('prefers loading over error when both are set', () => {
    render(<ValuationCharts isLoading error="boom" dcfResult={dcfResult} />)

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('renders the error message inside an alert', () => {
    render(<ValuationCharts error="Chart data unavailable" dcfResult={dcfResult} />)

    expect(screen.getByRole('alert')).toHaveTextContent('Chart data unavailable')
  })

  it('renders an accessible empty state when there is no data', () => {
    render(<ValuationCharts />)

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Run calculations to see charts')
    expect(status).not.toHaveAttribute('aria-busy')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('renders the visualization card (not a status/alert) when data is present', () => {
    render(<ValuationCharts dcfResult={dcfResult} />)

    expect(screen.getByText('Visualization')).toBeInTheDocument()
    expect(screen.queryByText('Run calculations to see charts')).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('does not render charts while loading, even when all results are present', () => {
    render(
      <ValuationCharts
        isLoading
        monteCarloResult={monteCarloResult}
        dcfResult={dcfResult}
        waccResult={waccResult}
      />
    )

    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    expect(capture.data).toBeNull()
  })

  it('only renders tabs for the data that is present', () => {
    render(
      <ValuationCharts
        monteCarloResult={monteCarloResult}
        dcfResult={dcfResult}
        waccResult={waccResult}
      />
    )

    expect(screen.getByRole('tab', { name: 'Distribution' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Percentiles' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'DCF Flows' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'WACC' })).toBeInTheDocument()
  })

  it('charts the histogram on the default Distribution tab, capping at 20 bins', async () => {
    render(<ValuationCharts monteCarloResult={monteCarloResult} />)

    await waitFor(() => expect(capture.data?.wrapper).toBe('BarChart'))
    const data = capture.data!.data as Array<{
      name: string
      value: number
      frequency: number
      binStart: number
      binEnd: number
    }>

    expect(data).toHaveLength(20)
    expect(data[0]).toMatchObject({ name: '0K', value: 1, binStart: 0, binEnd: 1000 })
    expect(data[19].name).toBe('19K')
    expect(typeof data[0].frequency).toBe('number')
  })

  it('scales percentile values to thousands on the Percentiles tab', async () => {
    const user = userEvent.setup()
    render(<ValuationCharts monteCarloResult={monteCarloResult} dcfResult={dcfResult} />)

    await user.click(screen.getByRole('tab', { name: 'Percentiles' }))
    await waitFor(() => expect(capture.data?.wrapper).toBe('LineChart'))
    const data = capture.data!.data as Array<{ name: string; value: number }>

    expect(data.map((d) => d.name)).toEqual(['P5', 'P25', 'P50', 'P75', 'P95'])
    expect(data[2].value).toBeCloseTo(50, 5) // p50 50000 / 1000
    expect(data[0].value).toBeCloseTo(5, 5) // p5 5000 / 1000
  })

  it('charts discounted cash-flow present values on the DCF Flows tab', async () => {
    const user = userEvent.setup()
    render(<ValuationCharts monteCarloResult={monteCarloResult} dcfResult={dcfResult} />)

    await user.click(screen.getByRole('tab', { name: 'DCF Flows' }))
    await waitFor(() => expect(capture.data?.wrapper).toBe('AreaChart'))
    const data = capture.data!.data as Array<{ year: string; presentValue: number }>

    expect(data).toHaveLength(3)
    expect(data.map((d) => d.year)).toEqual(['Year 1', 'Year 2', 'Year 3'])
    expect(data[0].presentValue).toBeCloseTo(0.1, 5) // 100 / 1000
    expect(data[2].presentValue).toBeCloseTo(0.08, 5) // 80 / 1000
  })

  it('charts WACC capital weights and formats the cost breakdown on the WACC tab', async () => {
    const user = userEvent.setup()
    render(
      <ValuationCharts
        monteCarloResult={monteCarloResult}
        dcfResult={dcfResult}
        waccResult={waccResult}
      />
    )

    await user.click(screen.getByRole('tab', { name: 'WACC' }))
    await waitFor(() => expect(capture.data?.wrapper).toBe('Pie'))
    const data = capture.data!.data as Array<{ name: string; value: number }>

    // equity weight = (1 - weightedCostOfDebt / wacc) * 100 = 80; debt weight = 20
    expect(data[0].name).toBe('Equity Weight')
    expect(data[0].value).toBeCloseTo(80, 5)
    expect(data[1].name).toBe('Debt Weight')
    expect(data[1].value).toBeCloseTo(20, 5)

    // formatted percentage breakdown
    expect(screen.getByText('12.00%')).toBeInTheDocument() // costOfEquity
    expect(screen.getByText('4.00%')).toBeInTheDocument() // costOfDebt
    expect(screen.getByText('3.20%')).toBeInTheDocument() // afterTaxCostOfDebt
    expect(screen.getByText('10.00%')).toBeInTheDocument() // total WACC
  })

  it('omits the WACC tab when waccResult has no components (fail-safe)', () => {
    render(<ValuationCharts waccResult={{ ...waccResult, components: undefined }} />)

    expect(screen.queryByRole('tab', { name: 'WACC' })).not.toBeInTheDocument()
  })

  it('degrades to empty distribution data when the histogram is absent (fail-safe)', async () => {
    const noHistogram = { ...monteCarloResult, histogram: undefined } as unknown as MonteCarloResult
    render(<ValuationCharts monteCarloResult={noHistogram} />)

    await waitFor(() => expect(capture.data?.wrapper).toBe('BarChart'))
    expect(capture.data!.data).toEqual([])
  })

  it('degrades to empty percentile data when statistics are absent (fail-safe)', async () => {
    const noStats = { ...monteCarloResult, statistics: undefined } as unknown as MonteCarloResult
    const user = userEvent.setup()
    render(<ValuationCharts monteCarloResult={noStats} />)

    await user.click(screen.getByRole('tab', { name: 'Percentiles' }))
    await waitFor(() => expect(capture.data?.wrapper).toBe('LineChart'))
    expect(capture.data!.data).toEqual([])
  })

  it('degrades to empty DCF flow data when presentValues are absent (fail-safe)', async () => {
    const noPV = {
      ...dcfResult,
      metadata: { ...dcfResult.metadata, presentValues: undefined },
    } as unknown as DCFResult
    const user = userEvent.setup()
    render(<ValuationCharts monteCarloResult={monteCarloResult} dcfResult={noPV} />)

    await user.click(screen.getByRole('tab', { name: 'DCF Flows' }))
    await waitFor(() => expect(capture.data?.wrapper).toBe('AreaChart'))
    expect(capture.data!.data).toEqual([])
  })

  it('forwards className to the card in the ready state', () => {
    const { container } = render(<ValuationCharts dcfResult={dcfResult} className="my-4 w-2/3" />)

    expect(container.firstElementChild).toHaveClass('my-4')
    expect(container.firstElementChild).toHaveClass('w-2/3')
  })
})
