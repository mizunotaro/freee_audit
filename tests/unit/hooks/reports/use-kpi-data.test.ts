import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useKPIData } from '@/hooks/reports/use-kpi-data'

vi.mock('@/lib/api/fetch-with-timeout', () => ({
  fetchWithTimeout: vi.fn(),
  FetchTimeoutError: class extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'FetchTimeoutError'
    }
  },
}))

describe('useKPIData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch KPI data and return it', async function () {
    const { fetchWithTimeout } = await import('@/lib/api/fetch-with-timeout')

    const mockKPIData = {
      kpis: [
        { name: 'ROE', value: 15.5 },
        { name: 'ROA', value: 8.2 },
      ],
    }

    vi.mocked(fetchWithTimeout).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockKPIData),
    } as any)

    const { result } = renderHook(function () {
      return useKPIData(2024, 3)
    })

    await waitFor(function () {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.data).toEqual(mockKPIData)
    expect(result.current.error).toBeNull()
  })

  it('should set error on fetch failure', async function () {
    const { fetchWithTimeout, FetchTimeoutError } = await import('@/lib/api/fetch-with-timeout')

    vi.mocked(fetchWithTimeout).mockRejectedValue(new FetchTimeoutError('/api/kpi', 30000))

    const { result } = renderHook(function () {
      return useKPIData(2024, 3)
    })

    await waitFor(function () {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).not.toBeNull()
    expect(result.current.error!.message).toContain('タイムアウト')
  })

  it('should set error on generic failure', async function () {
    const { fetchWithTimeout } = await import('@/lib/api/fetch-with-timeout')

    vi.mocked(fetchWithTimeout).mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(function () {
      return useKPIData(2024, 3)
    })

    await waitFor(function () {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).not.toBeNull()
    expect(result.current.error!.message).toBe('Network error')
  })

  it('should start with loading true', async function () {
    const { fetchWithTimeout } = await import('@/lib/api/fetch-with-timeout')
    vi.mocked(fetchWithTimeout).mockReturnValue(new Promise(function () {}))

    const { result } = renderHook(function () {
      return useKPIData(2024, 3)
    })

    expect(result.current.loading).toBe(true)
    expect(result.current.data).toBeNull()
  })

  it('should provide a refetch function', async function () {
    const { fetchWithTimeout } = await import('@/lib/api/fetch-with-timeout')

    vi.mocked(fetchWithTimeout).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ kpis: [] }),
    } as any)

    const { result } = renderHook(function () {
      return useKPIData(2024, 3)
    })

    await waitFor(function () {
      expect(result.current.loading).toBe(false)
    })

    expect(typeof result.current.refetch).toBe('function')
  })
})
