import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useCashflowData, buildChartData } from '@/hooks/reports/use-cashflow-data'
import type { CashFlowStatementItem } from '@/types/reports/cashflow'

vi.mock('@/lib/api/fetch-with-timeout', () => ({
  fetchWithTimeout: vi.fn(),
  FetchTimeoutError: class extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'FetchTimeoutError'
    }
  },
}))

function mockResponse(data: any) {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue(data),
  }
}

describe('useCashflowData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch and return cashflow data', async function () {
    const { fetchWithTimeout } = await import('@/lib/api/fetch-with-timeout')

    vi.mocked(fetchWithTimeout).mockImplementation(function (url: string) {
      if (url.includes('/cashflow')) {
        return Promise.resolve(
          mockResponse({
            cashFlows: [],
            cashPosition: { totalCash: 10000 },
            runway: { months: 12 },
            alert: null,
          }) as any
        )
      }
      return Promise.resolve(
        mockResponse({
          forecasts: [],
          monthlySummary: [],
        }) as any
      )
    })

    const { result } = renderHook(function () {
      return useCashflowData(2024)
    })

    await waitFor(function () {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.cashPosition).toEqual({ totalCash: 10000 })
    expect(result.current.runway).toEqual({ months: 12 })
  })

  it('should provide a refetch function', async function () {
    const { fetchWithTimeout } = await import('@/lib/api/fetch-with-timeout')
    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse({}) as any)

    const { result } = renderHook(function () {
      return useCashflowData(2024)
    })

    await waitFor(function () {
      expect(result.current.loading).toBe(false)
    })

    expect(typeof result.current.refetch).toBe('function')
  })
})

describe('buildChartData', () => {
  it('should build chart data from cashflow items', function () {
    const items: CashFlowStatementItem[] = [
      {
        month: 1,
        operatingActivities: { netCashFromOperating: 1000 },
        investingActivities: { netCashFromInvesting: -500 },
        financingActivities: { netCashFromFinancing: 0 },
      },
      {
        month: 2,
        operatingActivities: { netCashFromOperating: 1200 },
        investingActivities: { netCashFromInvesting: -300 },
        financingActivities: { netCashFromFinancing: 100 },
      },
    ] as any

    const chartData = buildChartData(items)

    expect(chartData).toHaveLength(2)
    expect(chartData[0].month).toBe('1月')
    expect(chartData[0].operating).toBe(1000)
    expect(chartData[0].investing).toBe(-500)
    expect(chartData[0].financing).toBe(0)
    expect(chartData[0].netCash).toBe(500)
    expect(chartData[0].cumulative).toBe(500)
    expect(chartData[1].cumulative).toBe(1500)
  })

  it('should return empty array for empty input', function () {
    const chartData = buildChartData([])

    expect(chartData).toEqual([])
  })
})
