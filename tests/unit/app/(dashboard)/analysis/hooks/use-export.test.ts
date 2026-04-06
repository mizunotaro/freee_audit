import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useExport } from '@/app/(dashboard)/analysis/hooks/use-export'

describe('useExport', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'URL', 'get').mockReturnValue({
      createObjectURL: vi.fn().mockReturnValue('blob:mock-url'),
      revokeObjectURL: vi.fn(),
    } as unknown as typeof URL)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should start with no export error and not exporting', () => {
    const { result } = renderHook(() => useExport())
    expect(result.current.isExporting).toBe(false)
    expect(result.current.exportError).toBeNull()
  })

  it('should export JSON format successfully', async () => {
    const mockJsonData = { test: 'data' }
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockJsonData,
    } as Response)

    const { result } = renderHook(() => useExport())

    let exportResult: Awaited<ReturnType<typeof result.current.exportAnalysis>>
    await act(async () => {
      exportResult = await result.current.exportAnalysis(
        { financialData: 'test' },
        { format: 'json' }
      )
    })

    expect(exportResult!.success).toBe(true)
    expect(exportResult!.blob).toBeInstanceOf(Blob)
    expect(exportResult!.filename).toContain('.json')
    expect(result.current.exportError).toBeNull()
  })

  it('should export PDF format (as html) successfully', async () => {
    const mockBlob = new Blob(['pdf-content'], { type: 'application/pdf' })
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      blob: async () => mockBlob,
    } as Response)

    const { result } = renderHook(() => useExport())

    let exportResult: Awaited<ReturnType<typeof result.current.exportAnalysis>>
    await act(async () => {
      exportResult = await result.current.exportAnalysis(
        { financialData: 'test' },
        { format: 'pdf' }
      )
    })

    expect(exportResult!.success).toBe(true)
    expect(exportResult!.filename).toContain('.pdf')
  })

  it('should export Excel format successfully', async () => {
    const mockBlob = new Blob(['excel-content'], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      blob: async () => mockBlob,
    } as Response)

    const { result } = renderHook(() => useExport())

    let exportResult: Awaited<ReturnType<typeof result.current.exportAnalysis>>
    await act(async () => {
      exportResult = await result.current.exportAnalysis(
        { financialData: 'test' },
        { format: 'excel' }
      )
    })

    expect(exportResult!.success).toBe(true)
    expect(exportResult!.filename).toContain('.xlsx')
  })

  it('should handle export failure from server', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: 'Server error' } }),
    } as Response)

    const { result } = renderHook(() => useExport())

    let exportResult: Awaited<ReturnType<typeof result.current.exportAnalysis>>
    await act(async () => {
      exportResult = await result.current.exportAnalysis(
        {},
        { format: 'pdf' }
      )
    })

    expect(exportResult!.success).toBe(false)
    expect(exportResult!.error).toBe('Server error')
    expect(result.current.exportError).toBe('Server error')
  })

  it('should handle network errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network failure'))

    const { result } = renderHook(() => useExport())

    let exportResult: Awaited<ReturnType<typeof result.current.exportAnalysis>>
    await act(async () => {
      exportResult = await result.current.exportAnalysis(
        {},
        { format: 'pdf' }
      )
    })

    expect(exportResult!.success).toBe(false)
    expect(result.current.exportError).toBe('Network failure')
  })

  it('should reset exporting state after completion', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as Response)

    const { result } = renderHook(() => useExport())

    await act(async () => {
      await result.current.exportAnalysis({}, { format: 'json' })
    })

    expect(result.current.isExporting).toBe(false)
  })

  it('should send format=html when format is pdf', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      blob: async () => new Blob(['test']),
    } as Response)

    const { result } = renderHook(() => useExport())

    await act(async () => {
      await result.current.exportAnalysis({}, { format: 'pdf' })
    })

    const callBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
    expect(callBody.format).toBe('html')
  })

  it('should send includeCharts and language options', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      blob: async () => new Blob(['test']),
    } as Response)

    const { result } = renderHook(() => useExport())

    await act(async () => {
      await result.current.exportAnalysis(
        {},
        { format: 'pdf', includeCharts: true, language: 'en' }
      )
    })

    const callBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
    expect(callBody.options.includeCharts).toBe(true)
    expect(callBody.options.language).toBe('en')
  })

  it('should download blob via downloadBlob', () => {
    const mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url')
    const mockRevokeObjectURL = vi.fn()
    globalThis.URL.createObjectURL = mockCreateObjectURL
    globalThis.URL.revokeObjectURL = mockRevokeObjectURL

    const { result } = renderHook(() => useExport())

    const blob = new Blob(['test'], { type: 'text/plain' })
    result.current.downloadBlob(blob, 'test.txt')

    expect(mockCreateObjectURL).toHaveBeenCalledWith(blob)
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })
})
