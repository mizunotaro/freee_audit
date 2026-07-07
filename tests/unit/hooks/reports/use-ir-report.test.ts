import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { IRReport, IRReportSection } from '@/types/reports/ir-report'
import { irReportService } from '@/services/reports/ir'
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
    generateSectionContent: vi.fn(),
  },
}))

const baseSection: IRReportSection = {
  id: 'sec-1',
  type: 'company_overview',
  title: { ja: '会社概要', en: 'Company Overview' },
  content: { ja: '概要', en: 'Overview' },
  order: 0,
}

const baseReport: IRReport = {
  id: 'report-1',
  companyId: 'company-1',
  title: { ja: '決算報告', en: 'Financial Report' },
  fiscalYear: '2024',
  status: 'draft',
  language: 'ja',
  sections: [],
  financialHighlights: [],
  shareholderComposition: [],
  events: [],
  faqs: [],
  metadata: {
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    createdBy: 'user-1',
    lastModifiedBy: 'user-1',
    version: 1,
  },
}

const reportWithSection: IRReport = { ...baseReport, sections: [baseSection] }

const newReport: IRReport = {
  ...baseReport,
  id: 'report-2',
  status: 'draft',
}

const newSection: IRReportSection = {
  id: 'sec-new',
  type: 'risk_factors',
  title: { ja: 'リスク要因', en: 'Risk Factors' },
  content: { ja: 'リスク', en: 'Risk' },
  order: 0,
}

const getReportMock = () => vi.mocked(irReportService.getReport)

describe('useIRReport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('starts empty and skips fetch when autoFetch is false', function () {
    const { result } = renderHook(function () {
      return useIRReport({ autoFetch: false })
    })

    expect(result.current.report).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.hasUnsavedChanges).toBe(false)
    expect(getReportMock()).not.toHaveBeenCalled()
  })

  it('fetches and loads a report on success', async function () {
    getReportMock().mockResolvedValue(baseReport)

    const { result } = renderHook(function () {
      return useIRReport({ autoFetch: false })
    })

    await act(async function () {
      await result.current.fetchReport('report-1')
    })

    expect(getReportMock()).toHaveBeenCalledWith('report-1')
    expect(result.current.report).toEqual(baseReport)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.hasUnsavedChanges).toBe(false)
  })

  it('sets a not-found error when getReport returns null', async function () {
    getReportMock().mockResolvedValue(null)

    const { result } = renderHook(function () {
      return useIRReport({ autoFetch: false })
    })

    await act(async function () {
      await result.current.fetchReport('report-1')
    })

    expect(result.current.report).toBeNull()
    expect(result.current.error).toBe('Report not found')
    expect(result.current.isLoading).toBe(false)
  })

  it('sets an error message when fetch rejects', async function () {
    getReportMock().mockRejectedValue(new Error('Network down'))

    const { result } = renderHook(function () {
      return useIRReport({ autoFetch: false })
    })

    await act(async function () {
      await result.current.fetchReport('report-1')
    })

    expect(result.current.report).toBeNull()
    expect(result.current.error).toBe('Network down')
    expect(result.current.isLoading).toBe(false)
  })

  it('saves the report and clears unsaved changes on success', async function () {
    getReportMock().mockResolvedValue(baseReport)
    vi.mocked(irReportService.saveReport).mockResolvedValue(undefined)

    const { result } = renderHook(function () {
      return useIRReport({ autoFetch: false })
    })

    await act(async function () {
      await result.current.fetchReport('report-1')
    })
    await act(async function () {
      result.current.optimisticUpdate({ status: 'in_review' })
    })
    expect(result.current.hasUnsavedChanges).toBe(true)

    await act(async function () {
      await result.current.saveReport(result.current.report as IRReport)
    })

    expect(vi.mocked(irReportService.saveReport)).toHaveBeenCalled()
    expect(result.current.hasUnsavedChanges).toBe(false)
    expect(result.current.isLoading).toBe(false)
  })

  it('re-throws and surfaces an error when save rejects', async function () {
    getReportMock().mockResolvedValue(baseReport)
    vi.mocked(irReportService.saveReport).mockRejectedValue(new Error('save failed'))

    const { result } = renderHook(function () {
      return useIRReport({ autoFetch: false })
    })

    await act(async function () {
      await result.current.fetchReport('report-1')
    })

    let caught: unknown
    await act(async function () {
      try {
        await result.current.saveReport(result.current.report as IRReport)
      } catch (err) {
        caught = err
      }
    })

    expect(caught).toBeInstanceOf(Error)
    expect(result.current.error).toBe('save failed')
    expect(result.current.isLoading).toBe(false)
  })

  it('updates the report status and persists via service', async function () {
    getReportMock().mockResolvedValue(baseReport)
    vi.mocked(irReportService.updateReportStatus).mockResolvedValue(undefined)

    const { result } = renderHook(function () {
      return useIRReport({ autoFetch: false })
    })

    await act(async function () {
      await result.current.fetchReport('report-1')
    })
    await act(async function () {
      await result.current.updateStatus('published')
    })

    expect(vi.mocked(irReportService.updateReportStatus)).toHaveBeenCalledWith(
      'report-1',
      'published'
    )
    expect(result.current.report?.status).toBe('published')
  })

  it('updates a section optimistically and flags unsaved changes', async function () {
    getReportMock().mockResolvedValue(reportWithSection)
    vi.mocked(irReportService.updateSection).mockResolvedValue(undefined)

    const { result } = renderHook(function () {
      return useIRReport({ autoFetch: false })
    })

    await act(async function () {
      await result.current.fetchReport('report-1')
    })
    await act(async function () {
      await result.current.updateSection('sec-1', {
        title: { ja: '更新', en: 'Updated' },
      })
    })

    expect(vi.mocked(irReportService.updateSection)).toHaveBeenCalledWith('report-1', 'sec-1', {
      title: { ja: '更新', en: 'Updated' },
    })
    expect(result.current.report?.sections[0].title.ja).toBe('更新')
    expect(result.current.hasUnsavedChanges).toBe(true)
  })

  it('no-ops updateSection when no report is loaded', async function () {
    const { result } = renderHook(function () {
      return useIRReport({ autoFetch: false })
    })

    await act(async function () {
      await result.current.updateSection('sec-1', { content: { ja: 'x', en: 'x' } })
    })

    expect(vi.mocked(irReportService.updateSection)).not.toHaveBeenCalled()
    expect(result.current.report).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('adds a section via the service and appends it', async function () {
    getReportMock().mockResolvedValue(baseReport)
    vi.mocked(irReportService.addSection).mockResolvedValue(newSection)

    const { result } = renderHook(function () {
      return useIRReport({ autoFetch: false })
    })

    await act(async function () {
      await result.current.fetchReport('report-1')
    })

    let created: IRReportSection | undefined
    await act(async function () {
      created = await result.current.addSection({
        type: 'risk_factors',
        title: { ja: 'リスク要因', en: 'Risk Factors' },
        content: { ja: 'リスク', en: 'Risk' },
      })
    })

    expect(created).toEqual(newSection)
    expect(result.current.report?.sections).toHaveLength(1)
    expect(result.current.report?.sections[0].id).toBe('sec-new')
    expect(result.current.hasUnsavedChanges).toBe(true)
  })

  it('rejects addSection with a clear error when no report is loaded', async function () {
    const { result } = renderHook(function () {
      return useIRReport({ autoFetch: false })
    })

    let caught: unknown
    await act(async function () {
      try {
        await result.current.addSection({
          type: 'risk_factors',
          title: { ja: '', en: '' },
          content: { ja: '', en: '' },
        })
      } catch (err) {
        caught = err
      }
    })

    expect(caught).toBeInstanceOf(Error)
    expect((caught as Error).message).toBe('No report loaded')
    expect(vi.mocked(irReportService.addSection)).not.toHaveBeenCalled()
  })

  it('rolls back optimistic edits to the last saved report', async function () {
    getReportMock().mockResolvedValue(baseReport)

    const { result } = renderHook(function () {
      return useIRReport({ autoFetch: false })
    })

    await act(async function () {
      await result.current.fetchReport('report-1')
    })
    await act(async function () {
      result.current.optimisticUpdate({ status: 'published' })
    })
    expect(result.current.report?.status).toBe('published')
    expect(result.current.hasUnsavedChanges).toBe(true)

    await act(async function () {
      result.current.rollback()
    })

    expect(result.current.report?.status).toBe('draft')
    expect(result.current.hasUnsavedChanges).toBe(false)
  })
})

describe('useIRReportList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('starts empty and skips fetch when autoFetch is false', function () {
    const { result } = renderHook(function () {
      return useIRReportList({ autoFetch: false })
    })

    expect(result.current.reports).toEqual([])
    expect(result.current.total).toBe(0)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(vi.mocked(irReportService.listReports)).not.toHaveBeenCalled()
  })

  it('fetches the report list on success', async function () {
    vi.mocked(irReportService.listReports).mockResolvedValue({
      reports: [baseReport],
      total: 1,
      page: 1,
      pageSize: 20,
    })

    const { result } = renderHook(function () {
      return useIRReportList({ autoFetch: false })
    })

    await act(async function () {
      await result.current.fetchReports()
    })

    expect(vi.mocked(irReportService.listReports)).toHaveBeenCalled()
    expect(result.current.reports).toHaveLength(1)
    expect(result.current.total).toBe(1)
    expect(result.current.isLoading).toBe(false)
  })

  it('sets an error when fetchReports rejects', async function () {
    vi.mocked(irReportService.listReports).mockRejectedValue(new Error('list failed'))

    const { result } = renderHook(function () {
      return useIRReportList({ autoFetch: false })
    })

    await act(async function () {
      await result.current.fetchReports()
    })

    expect(result.current.error).toBe('list failed')
    expect(result.current.reports).toEqual([])
    expect(result.current.isLoading).toBe(false)
  })

  it('creates a report and prepends it to the list', async function () {
    vi.mocked(irReportService.createReport).mockResolvedValue(newReport)

    const { result } = renderHook(function () {
      return useIRReportList({ autoFetch: false })
    })

    await act(async function () {
      await result.current.createReport({
        companyId: 'company-1',
        title: { ja: '新規', en: 'New' },
        fiscalYear: '2024',
        createdBy: 'user-1',
      })
    })

    expect(vi.mocked(irReportService.createReport)).toHaveBeenCalled()
    expect(result.current.reports[0].id).toBe('report-2')
    expect(result.current.total).toBe(1)
  })

  it('re-throws and surfaces an error when create rejects', async function () {
    vi.mocked(irReportService.createReport).mockRejectedValue(new Error('create failed'))

    const { result } = renderHook(function () {
      return useIRReportList({ autoFetch: false })
    })

    let caught: unknown
    await act(async function () {
      try {
        await result.current.createReport({
          companyId: 'company-1',
          title: { ja: '新規', en: 'New' },
          fiscalYear: '2024',
          createdBy: 'user-1',
        })
      } catch (err) {
        caught = err
      }
    })

    expect(caught).toBeInstanceOf(Error)
    expect(result.current.error).toBe('create failed')
    expect(result.current.isLoading).toBe(false)
  })

  it('deletes a report and removes it from the list', async function () {
    vi.mocked(irReportService.listReports).mockResolvedValue({
      reports: [baseReport],
      total: 1,
      page: 1,
      pageSize: 20,
    })
    vi.mocked(irReportService.deleteReport).mockResolvedValue(undefined)

    const { result } = renderHook(function () {
      return useIRReportList({ autoFetch: false })
    })

    await act(async function () {
      await result.current.fetchReports()
    })
    expect(result.current.reports).toHaveLength(1)

    await act(async function () {
      await result.current.deleteReport('report-1')
    })

    expect(vi.mocked(irReportService.deleteReport)).toHaveBeenCalledWith('report-1')
    expect(result.current.reports).toHaveLength(0)
    expect(result.current.total).toBe(0)
  })

  it('sets an error when delete rejects', async function () {
    vi.mocked(irReportService.deleteReport).mockRejectedValue(new Error('delete failed'))

    const { result } = renderHook(function () {
      return useIRReportList({ autoFetch: false })
    })

    await act(async function () {
      await result.current.deleteReport('report-1')
    })

    expect(result.current.error).toBe('delete failed')
    expect(result.current.isLoading).toBe(false)
  })
})
