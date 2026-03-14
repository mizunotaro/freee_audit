'use client'

import * as React from 'react'
import { irReportService } from '@/services/reports/ir'
import type {
  IRReport,
  IRReportListFilter,
  IRReportListResponse,
  IRReportSection,
  FinancialHighlight,
  ShareholderData,
  IREvent,
  FAQItem,
  ReportStatus,
  Language,
} from '@/types/reports/ir-report'

export interface UseIRReportOptions {
  reportId?: string
  autoFetch?: boolean
}

export interface UseIRReportReturn {
  report: IRReport | null
  isLoading: boolean
  error: string | null
  fetchReport: (id: string) => Promise<void>
  saveReport: (report: IRReport) => Promise<void>
  updateStatus: (status: ReportStatus) => Promise<void>
  updateSection: (sectionId: string, updates: Partial<IRReportSection>) => Promise<void>
  addSection: (section: Omit<IRReportSection, 'id' | 'order'>) => Promise<IRReportSection>
  removeSection: (sectionId: string) => Promise<void>
  updateFinancialHighlights: (highlights: FinancialHighlight[]) => Promise<void>
  updateShareholderComposition: (composition: ShareholderData[]) => Promise<void>
  updateEvents: (events: IREvent[]) => Promise<void>
  updateFAQs: (faqs: FAQItem[]) => Promise<void>
  optimisticUpdate: (updates: Partial<IRReport>) => void
  rollback: () => void
  hasUnsavedChanges: boolean
}

export function useIRReport(options: UseIRReportOptions = {}): UseIRReportReturn {
  const { reportId, autoFetch = true } = options

  const [report, setReport] = React.useState<IRReport | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [savedReport, setSavedReport] = React.useState<IRReport | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false)

  const fetchReport = React.useCallback(async (id: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await irReportService.getReport(id)
      if (result) {
        setReport(result)
        setSavedReport(result)
        setHasUnsavedChanges(false)
      } else {
        setError('Report not found')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch report')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const saveReport = React.useCallback(async (reportToSave: IRReport) => {
    setIsLoading(true)
    setError(null)

    try {
      await irReportService.saveReport(reportToSave)
      setReport(reportToSave)
      setSavedReport(reportToSave)
      setHasUnsavedChanges(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save report')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const updateStatus = React.useCallback(
    async (status: ReportStatus) => {
      if (!report) return

      setIsLoading(true)
      setError(null)

      try {
        await irReportService.updateReportStatus(report.id, status)
        const updated = { ...report, status }
        setReport(updated)
        setSavedReport(updated)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update status')
      } finally {
        setIsLoading(false)
      }
    },
    [report]
  )

  const updateSection = React.useCallback(
    async (sectionId: string, updates: Partial<IRReportSection>) => {
      if (!report) return

      try {
        await irReportService.updateSection(report.id, sectionId, updates)
        const updated = {
          ...report,
          sections: report.sections.map((s) => (s.id === sectionId ? { ...s, ...updates } : s)),
        }
        setReport(updated)
        setHasUnsavedChanges(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update section')
      }
    },
    [report]
  )

  const addSection = React.useCallback(
    async (section: Omit<IRReportSection, 'id' | 'order'>) => {
      if (!report) throw new Error('No report loaded')

      const newSection = await irReportService.addSection(report.id, section)
      const updated = {
        ...report,
        sections: [...report.sections, newSection],
      }
      setReport(updated)
      setHasUnsavedChanges(true)

      return newSection
    },
    [report]
  )

  const removeSection = React.useCallback(
    async (sectionId: string) => {
      if (!report) return

      try {
        await irReportService.removeSection(report.id, sectionId)
        const updated = {
          ...report,
          sections: report.sections.filter((s) => s.id !== sectionId),
        }
        setReport(updated)
        setHasUnsavedChanges(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to remove section')
      }
    },
    [report]
  )

  const updateFinancialHighlights = React.useCallback(
    async (highlights: FinancialHighlight[]) => {
      if (!report) return

      try {
        await irReportService.updateFinancialHighlights(report.id, highlights)
        const updated = { ...report, financialHighlights: highlights }
        setReport(updated)
        setHasUnsavedChanges(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update highlights')
      }
    },
    [report]
  )

  const updateShareholderComposition = React.useCallback(
    async (composition: ShareholderData[]) => {
      if (!report) return

      try {
        await irReportService.updateShareholderComposition(report.id, composition)
        const updated = { ...report, shareholderComposition: composition }
        setReport(updated)
        setHasUnsavedChanges(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update composition')
      }
    },
    [report]
  )

  const updateEvents = React.useCallback(
    async (events: IREvent[]) => {
      if (!report) return

      try {
        await irReportService.updateEvents(report.id, events)
        const updated = { ...report, events }
        setReport(updated)
        setHasUnsavedChanges(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update events')
      }
    },
    [report]
  )

  const updateFAQs = React.useCallback(
    async (faqs: FAQItem[]) => {
      if (!report) return

      try {
        await irReportService.updateFAQs(report.id, faqs)
        const updated = { ...report, faqs }
        setReport(updated)
        setHasUnsavedChanges(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update FAQs')
      }
    },
    [report]
  )

  const optimisticUpdate = React.useCallback(
    (updates: Partial<IRReport>) => {
      if (!report) return

      const updated = { ...report, ...updates }
      setReport(updated)
      setHasUnsavedChanges(true)
    },
    [report]
  )

  const rollback = React.useCallback(() => {
    if (savedReport) {
      setReport(savedReport)
      setHasUnsavedChanges(false)
    }
  }, [savedReport])

  React.useEffect(() => {
    if (reportId && autoFetch) {
      fetchReport(reportId)
    }
  }, [reportId, autoFetch, fetchReport])

  return {
    report,
    isLoading,
    error,
    fetchReport,
    saveReport,
    updateStatus,
    updateSection,
    addSection,
    removeSection,
    updateFinancialHighlights,
    updateShareholderComposition,
    updateEvents,
    updateFAQs,
    optimisticUpdate,
    rollback,
    hasUnsavedChanges,
  }
}

export interface UseIRReportListOptions {
  filter?: IRReportListFilter
  autoFetch?: boolean
}

export interface UseIRReportListReturn {
  reports: IRReport[]
  total: number
  isLoading: boolean
  error: string | null
  fetchReports: (filter?: IRReportListFilter) => Promise<void>
  createReport: (data: {
    companyId: string
    title: { ja: string; en: string }
    fiscalYear: string
    language?: Language
    createdBy: string
  }) => Promise<IRReport>
  deleteReport: (reportId: string) => Promise<void>
}

export function useIRReportList(options: UseIRReportListOptions = {}): UseIRReportListReturn {
  const { filter, autoFetch = true } = options

  const [reports, setReports] = React.useState<IRReport[]>([])
  const [total, setTotal] = React.useState(0)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const fetchReports = React.useCallback(
    async (newFilter?: IRReportListFilter) => {
      setIsLoading(true)
      setError(null)

      try {
        const result: IRReportListResponse = await irReportService.listReports(newFilter || filter)
        setReports(result.reports)
        setTotal(result.total)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch reports')
      } finally {
        setIsLoading(false)
      }
    },
    [filter]
  )

  const createReport = React.useCallback(
    async (data: Parameters<UseIRReportListReturn['createReport']>[0]) => {
      setIsLoading(true)
      setError(null)

      try {
        const newReport = await irReportService.createReport(data)
        setReports((prev) => [newReport, ...prev])
        setTotal((prev) => prev + 1)
        return newReport
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create report')
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  const deleteReport = React.useCallback(async (reportId: string) => {
    setIsLoading(true)
    setError(null)

    try {
      await irReportService.deleteReport(reportId)
      setReports((prev) => prev.filter((r) => r.id !== reportId))
      setTotal((prev) => prev - 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete report')
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (autoFetch) {
      fetchReports()
    }
  }, [autoFetch, fetchReports])

  return {
    reports,
    total,
    isLoading,
    error,
    fetchReports,
    createReport,
    deleteReport,
  }
}

export default useIRReport
