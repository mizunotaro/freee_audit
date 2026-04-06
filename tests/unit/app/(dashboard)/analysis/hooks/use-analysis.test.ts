import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useAnalysis } from '@/app/(dashboard)/analysis/hooks/use-analysis'

describe('useAnalysis', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  const mockSuccessResponse = {
    success: true,
    data: {
      overallScore: 75,
      overallStatus: 'good',
      executiveSummary: 'Test summary',
      categoryAnalyses: [],
      allAlerts: [],
      topRecommendations: [],
      keyMetrics: [],
      benchmark: null,
      processingTimeMs: 100,
      analyzedAt: '2024-01-01T00:00:00.000Z',
    },
    metadata: {
      requestId: 'test-req',
      processingTimeMs: 100,
      cached: false,
      version: '1.0.0',
      timestamp: '2024-01-01T00:00:00.000Z',
    },
  }

  it('should start with loading state', () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}))
    const { result } = renderHook(() =>
      useAnalysis({ fiscalYear: 2024, month: 12 })
    )
    expect(result.current.isLoading).toBe(true)
    expect(result.current.error).toBeNull()
    expect(result.current.financialData).toBeNull()
  })

  it('should fetch and set financial data on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockSuccessResponse,
    } as Response)

    const { result } = renderHook(() =>
      useAnalysis({ fiscalYear: 2024, month: 12 })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.financialData).toEqual(mockSuccessResponse)
    expect(result.current.error).toBeNull()
  })

  it('should set error when fetch fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'))

    const { result } = renderHook(() =>
      useAnalysis({ fiscalYear: 2024, month: 12 })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toBe('Network error')
  })

  it('should set error when API returns failure', async () => {
    const failResponse = {
      success: false,
      error: { code: 'ANALYSIS_ERROR', message: 'Analysis failed' },
      metadata: {
        requestId: 'test-req',
        processingTimeMs: 0,
        cached: false,
        version: '1.0.0',
        timestamp: '2024-01-01T00:00:00.000Z',
      },
    }
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => failResponse,
    } as Response)

    const { result } = renderHook(() =>
      useAnalysis({ fiscalYear: 2024, month: 12 })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toBe('Analysis failed')
  })

  it('should ignore AbortError', async () => {
    const abortError = new DOMException('Aborted', 'AbortError')
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(abortError)

    const { result } = renderHook(() =>
      useAnalysis({ fiscalYear: 2024, month: 12 })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toBeNull()
  })

  it('should refetch data when refetch is called', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockSuccessResponse,
          data: { ...mockSuccessResponse.data, overallScore: 90 },
        }),
      } as Response)

    const { result } = renderHook(() =>
      useAnalysis({ fiscalYear: 2024, month: 12 })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      result.current.refetch()
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.financialData?.data?.overallScore).toBe(90)
  })

  it('should use cached data for repeated period requests', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    } as Response)

    const { result, rerender } = renderHook(
      ({ period }) => useAnalysis(period),
      { initialProps: { period: { fiscalYear: 2024, month: 12 } } }
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(fetchSpy).toHaveBeenCalledTimes(1)

    rerender({ period: { fiscalYear: 2024, month: 12 } })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('should fetch new data when period changes', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    } as Response)

    const { result, rerender } = renderHook(
      ({ period }) => useAnalysis(period),
      { initialProps: { period: { fiscalYear: 2024, month: 12 } } }
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    rerender({ period: { fiscalYear: 2023, month: 6 } })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
  })
})
