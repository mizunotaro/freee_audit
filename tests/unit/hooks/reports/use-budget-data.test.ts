import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useBudgetData, deleteBudget } from '@/hooks/reports/use-budget-data'

vi.mock('@/lib/api/fetch-with-timeout', () => ({
  fetchWithTimeout: vi.fn(),
  FetchTimeoutError: class extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'FetchTimeoutError'
    }
  },
}))

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}))

function mockResponse(data: any) {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue(data),
  }
}

describe('useBudgetData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should start with loading true and fetch data', async function () {
    const { fetchWithTimeout } = await import('@/lib/api/fetch-with-timeout')
    const mockedFetch = vi.mocked(fetchWithTimeout)

    mockedFetch.mockResolvedValue(
      mockResponse({
        budgetVsActual: { categories: [] },
        variance: { items: [] },
      }) as any
    )
    mockedFetch.mockResolvedValue(
      mockResponse({
        budgets: [],
        budgetVsActual: { categories: [] },
        variance: { items: [] },
      }) as any
    )
    mockedFetch.mockResolvedValue(
      mockResponse({
        budgetVsActual: { categories: [] },
        variance: { items: [] },
        budgets: [],
        detailed: true,
      }) as any
    )

    const { result } = renderHook(function () {
      return useBudgetData(2024, 3)
    })

    await waitFor(function () {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.budgets).toEqual([])
  })

  it('should provide a refetch function', async function () {
    const { fetchWithTimeout } = await import('@/lib/api/fetch-with-timeout')
    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse({}) as any)

    const { result } = renderHook(function () {
      return useBudgetData(2024, 3)
    })

    await waitFor(function () {
      expect(result.current.loading).toBe(false)
    })

    expect(typeof result.current.refetch).toBe('function')
  })
})

describe('deleteBudget', () => {
  it('should return true on successful delete', async function () {
    const { fetchWithTimeout } = await import('@/lib/api/fetch-with-timeout')
    vi.mocked(fetchWithTimeout).mockResolvedValue({ ok: true } as any)

    const result = await deleteBudget('budget-1')

    expect(result).toBe(true)
  })

  it('should return false on failed delete', async function () {
    const { fetchWithTimeout } = await import('@/lib/api/fetch-with-timeout')
    vi.mocked(fetchWithTimeout).mockResolvedValue({ ok: false } as any)

    const result = await deleteBudget('budget-1')

    expect(result).toBe(false)
  })

  it('should return false on error', async function () {
    const { fetchWithTimeout } = await import('@/lib/api/fetch-with-timeout')
    vi.mocked(fetchWithTimeout).mockRejectedValue(new Error('Network error'))

    const result = await deleteBudget('budget-1')

    expect(result).toBe(false)
  })
})
