import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

vi.mock('@/services/reports/ir', () => ({
  irReportService: {
    generateSectionContent: vi.fn(),
  },
}))

describe('useIRGeneration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should initialize with idle state', async function () {
    const { useIRGeneration } = await import('@/hooks/reports/use-ir-generation')

    const { result } = renderHook(function () {
      return useIRGeneration({ reportId: 'report-1' })
    })

    expect(result.current.state.isGenerating).toBe(false)
    expect(result.current.state.sectionType).toBeNull()
    expect(result.current.state.progress).toBe(0)
    expect(result.current.state.error).toBeNull()
    expect(result.current.lastResult).toBeNull()
  })

  it('should generate a section and update state', async function () {
    const { irReportService } = await import('@/services/reports/ir')
    const { useIRGeneration } = await import('@/hooks/reports/use-ir-generation')

    const mockResult = {
      success: true,
      content: { ja: 'テスト内容', en: 'Test content' },
    }
    vi.mocked(irReportService.generateSectionContent).mockResolvedValue(mockResult)

    const onGenerated = vi.fn()
    const { result } = renderHook(function () {
      return useIRGeneration({ reportId: 'report-1', onGenerated })
    })

    let generatePromise: Promise<any>
    await act(async function () {
      generatePromise = result.current.generate('company_overview', 'ja')
    })

    await act(async function () {
      vi.advanceTimersByTime(1000)
    })

    await act(async function () {
      const res = await generatePromise
      expect(res.success).toBe(true)
    })

    expect(irReportService.generateSectionContent).toHaveBeenCalled()
    expect(onGenerated).toHaveBeenCalledWith('company_overview', {
      ja: 'テスト内容',
      en: 'Test content',
    })
  })

  it('should handle generation errors', async function () {
    const { irReportService } = await import('@/services/reports/ir')
    const { useIRGeneration } = await import('@/hooks/reports/use-ir-generation')

    vi.mocked(irReportService.generateSectionContent).mockResolvedValue({
      success: false,
      error: 'Generation failed',
    })

    const onError = vi.fn()
    const { result } = renderHook(function () {
      return useIRGeneration({ reportId: 'report-1', onError })
    })

    await act(async function () {
      const res = await result.current.generate('company_overview', 'ja')
      expect(res.success).toBe(false)
    })

    expect(onError).toHaveBeenCalledWith('Generation failed')
  })

  it('should cancel generation', async function () {
    const { irReportService } = await import('@/services/reports/ir')
    const { useIRGeneration } = await import('@/hooks/reports/use-ir-generation')

    vi.mocked(irReportService.generateSectionContent).mockImplementation(function () {
      return new Promise(function (resolve) {
        setTimeout(function () {
          resolve({ success: true, content: { ja: 'test', en: 'test' } })
        }, 5000)
      })
    })

    const { result } = renderHook(function () {
      return useIRGeneration({ reportId: 'report-1' })
    })

    await act(async function () {
      result.current.generate('company_overview', 'ja')
    })

    await act(async function () {
      result.current.cancel()
    })

    expect(result.current.state.isGenerating).toBe(false)
  })

  it('should retry last request', async function () {
    const { irReportService } = await import('@/services/reports/ir')
    const { useIRGeneration } = await import('@/hooks/reports/use-ir-generation')

    vi.mocked(irReportService.generateSectionContent).mockResolvedValue({
      success: true,
      content: { ja: 'test', en: 'test' },
    })

    const { result } = renderHook(function () {
      return useIRGeneration({ reportId: 'report-1' })
    })

    await act(async function () {
      await result.current.generate('risk_factors', 'ja')
    })

    await act(async function () {
      vi.advanceTimersByTime(1000)
    })

    expect(irReportService.generateSectionContent).toHaveBeenCalledTimes(1)

    await act(async function () {
      await result.current.retry()
    })

    await act(async function () {
      vi.advanceTimersByTime(1000)
    })

    expect(irReportService.generateSectionContent).toHaveBeenCalledTimes(2)
  })

  it('should return error when retrying without previous request', async function () {
    const { useIRGeneration } = await import('@/hooks/reports/use-ir-generation')

    const { result } = renderHook(function () {
      return useIRGeneration({ reportId: 'report-1' })
    })

    await act(async function () {
      await result.current.retry()
    })
  })
})
