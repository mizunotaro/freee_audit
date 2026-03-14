import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useIRReport, useIRReportList } from '@/hooks/reports/use-ir-report'

vi.mock('@/services/reports/ir', () => ({
  irReportService: {
    getReport: vi.fn(),
    saveReport: vi.fn(),
    createReport: vi.fn(),
    deleteReport: vi.fn(),
    listReports: vi.fn(),
    updateReportStatus: vi.fn(),
    updateSection: vi.fn(),
    addSection: vi.fn(),
    removeSection: vi.fn(),
    updateFinancialHighlights: vi.fn(),
    updateShareholderComposition: vi.fn(),
    updateEvents: vi.fn(),
    updateFAQs: vi.fn(),
  },
}))

import { irReportService } from '@/services/reports/ir'

const mockReport = {
  id: 'test-report-1',
  companyId: 'company-1',
  title: { ja: 'テストレポート', en: 'Test Report' },
  fiscalYear: '2024',
  status: 'draft' as const,
  language: 'ja' as const,
  sections: [],
  financialHighlights: [],
  shareholderComposition: [],
  events: [],
  faqs: [],
  metadata: {
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    createdBy: 'user-1',
    lastModifiedBy: 'user-1',
    version: 1,
  },
}

describe('useIRReport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches report on mount when reportId is provided', async () => {
    vi.mocked(irReportService.getReport).mockResolvedValue(mockReport)

    const { result } = renderHook(() => useIRReport({ reportId: 'test-report-1' }))

    await waitFor(() => {
      expect(result.current.report).toEqual(mockReport)
    })
  })

  it('returns null when report is not found', async () => {
    vi.mocked(irReportService.getReport).mockResolvedValue(null)

    const { result } = renderHook(() => useIRReport({ reportId: 'non-existent' }))

    await waitFor(() => {
      expect(result.current.report).toBeNull()
      expect(result.current.error).toBe('Report not found')
    })
  })

  it('saves report correctly', async () => {
    vi.mocked(irReportService.saveReport).mockResolvedValue()

    const { result } = renderHook(() => useIRReport())

    await act(async () => {
      await result.current.saveReport(mockReport)
    })

    expect(irReportService.saveReport).toHaveBeenCalledWith(mockReport)
  })

  it('optimistic updates work correctly', async () => {
    vi.mocked(irReportService.getReport).mockResolvedValue(mockReport)

    const { result } = renderHook(() => useIRReport({ reportId: 'test-report-1', autoFetch: true }))

    await waitFor(() => {
      expect(result.current.report).toEqual(mockReport)
    })

    act(() => {
      result.current.optimisticUpdate({ status: 'approved' })
    })

    expect(result.current.report?.status).toBe('approved')
    expect(result.current.hasUnsavedChanges).toBe(true)
  })
})

describe('useIRReportList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches reports on mount', async () => {
    vi.mocked(irReportService.listReports).mockResolvedValue({
      reports: [mockReport],
      total: 1,
      page: 1,
      pageSize: 20,
    })

    const { result } = renderHook(() => useIRReportList())

    await waitFor(() => {
      expect(result.current.reports).toHaveLength(1)
      expect(result.current.total).toBe(1)
    })
  })

  it('creates a new report', async () => {
    vi.mocked(irReportService.createReport).mockResolvedValue(mockReport)
    vi.mocked(irReportService.listReports).mockResolvedValue({
      reports: [],
      total: 0,
      page: 1,
      pageSize: 20,
    })

    const { result } = renderHook(() => useIRReportList({ autoFetch: false }))

    await act(async () => {
      await result.current.createReport({
        companyId: 'company-1',
        title: { ja: 'テスト', en: 'Test' },
        fiscalYear: '2024',
        createdBy: 'user-1',
      })
    })

    expect(irReportService.createReport).toHaveBeenCalled()
  })
})
