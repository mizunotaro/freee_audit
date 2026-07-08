import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getReport,
  saveReport,
  createReport,
  deleteReport,
  listReports,
  updateReportStatus,
  updateSection,
  addSection,
  removeSection,
  updateFinancialHighlights,
  updateShareholderComposition,
  updateEvents,
  updateFAQs,
  generateSectionContent,
} from '@/services/reports/ir/ir-report-service'
import type {
  IRReport,
  IRReportSection,
  FinancialHighlight,
  ShareholderData,
  IREvent,
  FAQItem,
} from '@/types/reports/ir-report'

const STORAGE_KEY_PREFIX = 'ir_report_'

function storageKey(reportId: string): string {
  return `${STORAGE_KEY_PREFIX}${reportId}`
}

function createBaseReport(overrides: Partial<IRReport> = {}): IRReport {
  return {
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
    ...overrides,
  }
}

function createSection(overrides: Partial<IRReportSection> = {}): IRReportSection {
  return {
    id: 'sec-1',
    type: 'company_overview',
    title: { ja: '会社概要', en: 'Company Overview' },
    content: { ja: '元の内容', en: 'original content' },
    order: 0,
    ...overrides,
  }
}

function seedReport(report: IRReport): void {
  localStorage.setItem(storageKey(report.id), JSON.stringify(report))
}

describe('ir/ir-report-service (localStorage)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('getReport', () => {
    it('returns null when the report is not stored', async () => {
      expect(await getReport('missing')).toBeNull()
    })

    it('returns the parsed report when it exists', async () => {
      const report = createBaseReport()
      seedReport(report)

      const result = await getReport(report.id)

      expect(result).toEqual(report)
    })

    it('returns null when the stored payload is corrupt JSON', async () => {
      localStorage.setItem(storageKey('report-1'), '{not valid json')

      expect(await getReport('report-1')).toBeNull()
    })
  })

  describe('saveReport', () => {
    it('persists the report so getReport can read it back', async () => {
      await saveReport(createBaseReport())

      expect(await getReport('report-1')).not.toBeNull()
    })

    it('bumps the version and refreshes updatedAt on save', async () => {
      await saveReport(
        createBaseReport({ metadata: { ...createBaseReport().metadata, version: 5 } })
      )

      const stored = await getReport('report-1')
      expect(stored?.metadata.version).toBe(6)
      expect(stored?.metadata.updatedAt).not.toBe('2024-01-01T00:00:00.000Z')
    })
  })

  describe('createReport', () => {
    it('returns a draft report with default Japanese language and empty collections', async () => {
      const report = await createReport({
        companyId: 'company-1',
        title: { ja: '決算報告', en: 'Financial Report' },
        fiscalYear: '2024',
        createdBy: 'user-1',
      })

      expect(report.status).toBe('draft')
      expect(report.language).toBe('ja')
      expect(report.sections).toEqual([])
      expect(report.financialHighlights).toEqual([])
      expect(report.shareholderComposition).toEqual([])
      expect(report.events).toEqual([])
      expect(report.faqs).toEqual([])
      expect(report.metadata.version).toBe(1)
      expect(report.metadata.createdBy).toBe('user-1')
    })

    it('respects an explicit language override', async () => {
      const report = await createReport({
        companyId: 'company-1',
        title: { ja: '決算報告', en: 'Financial Report' },
        fiscalYear: '2024',
        language: 'en',
        createdBy: 'user-1',
      })

      expect(report.language).toBe('en')
    })

    it('persists the created report', async () => {
      const report = await createReport({
        companyId: 'company-1',
        title: { ja: '決算報告', en: 'Financial Report' },
        fiscalYear: '2024',
        createdBy: 'user-1',
      })

      expect(await getReport(report.id)).not.toBeNull()
    })
  })

  describe('deleteReport', () => {
    it('removes the report from storage', async () => {
      seedReport(createBaseReport())
      expect(await getReport('report-1')).not.toBeNull()

      await deleteReport('report-1')

      expect(await getReport('report-1')).toBeNull()
    })

    it('does not throw when deleting a missing report', async () => {
      await expect(deleteReport('missing')).resolves.toBeUndefined()
    })
  })

  describe('listReports', () => {
    function seedList(): IRReport[] {
      const older = createBaseReport({
        id: 'r-old',
        title: { ja: '前年報告', en: 'Previous Report' },
        fiscalYear: '2023',
        status: 'archived',
        language: 'ja',
        metadata: {
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-06-01T00:00:00.000Z',
          createdBy: 'u',
          lastModifiedBy: 'u',
          version: 1,
        },
      })
      const newer = createBaseReport({
        id: 'r-new',
        title: { ja: '今年報告', en: 'Latest Report' },
        fiscalYear: '2024',
        status: 'published',
        language: 'en',
        metadata: {
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-06-01T00:00:00.000Z',
          createdBy: 'u',
          lastModifiedBy: 'u',
          version: 1,
        },
      })
      const mid = createBaseReport({
        id: 'r-mid',
        title: { ja: '中間報告', en: 'Mid Report' },
        fiscalYear: '2024',
        status: 'draft',
        language: 'ja',
        metadata: {
          createdAt: '2024-02-01T00:00:00.000Z',
          updatedAt: '2024-03-01T00:00:00.000Z',
          createdBy: 'u',
          lastModifiedBy: 'u',
          version: 1,
        },
      })
      seedReport(older)
      seedReport(newer)
      seedReport(mid)
      return [older, mid, newer]
    }

    it('returns an empty result when nothing is stored', async () => {
      const result = await listReports()

      expect(result.reports).toEqual([])
      expect(result.total).toBe(0)
      expect(result.page).toBe(1)
      expect(result.pageSize).toBe(20)
    })

    it('returns all reports sorted by updatedAt descending', async () => {
      seedList()
      const sorted = await listReports()

      expect(sorted.reports.map((r) => r.id)).toEqual(['r-new', 'r-mid', 'r-old'])
      expect(sorted.total).toBe(3)
    })

    it('filters by status', async () => {
      seedList()

      const result = await listReports({ status: 'published' })

      expect(result.reports).toHaveLength(1)
      expect(result.reports[0].id).toBe('r-new')
    })

    it('filters by fiscalYear', async () => {
      seedList()

      const result = await listReports({ fiscalYear: '2024' })

      expect(result.reports.map((r) => r.id).sort()).toEqual(['r-mid', 'r-new'])
    })

    it('filters by language', async () => {
      seedList()

      const result = await listReports({ language: 'en' })

      expect(result.reports).toHaveLength(1)
      expect(result.reports[0].id).toBe('r-new')
    })

    it('matches search against the Japanese title', async () => {
      seedList()

      const result = await listReports({ search: '中間' })

      expect(result.reports).toHaveLength(1)
      expect(result.reports[0].id).toBe('r-mid')
    })

    it('matches search against the English title (case-insensitive)', async () => {
      seedList()

      const result = await listReports({ search: 'latest' })

      expect(result.reports).toHaveLength(1)
      expect(result.reports[0].id).toBe('r-new')
    })

    it('skips entries that fail to parse', async () => {
      seedList()
      localStorage.setItem(storageKey('corrupt'), '{bad json')

      const result = await listReports()

      expect(result.total).toBe(3)
    })
  })

  describe('updateReportStatus', () => {
    it('throws when the report does not exist', async () => {
      await expect(updateReportStatus('missing', 'approved')).rejects.toThrow(
        'Report not found: missing'
      )
    })

    it('updates the status and persists the change', async () => {
      seedReport(createBaseReport())

      await updateReportStatus('report-1', 'approved')

      const stored = await getReport('report-1')
      expect(stored?.status).toBe('approved')
    })

    it('sets publishedAt when publishing', async () => {
      seedReport(createBaseReport())

      await updateReportStatus('report-1', 'published')

      const stored = await getReport('report-1')
      expect(stored?.status).toBe('published')
      expect(stored?.metadata.publishedAt).toBeTruthy()
    })
  })

  describe('updateSection', () => {
    it('throws when the report does not exist', async () => {
      await expect(
        updateSection('missing', 'sec-1', { content: { ja: 'x', en: 'x' } })
      ).rejects.toThrow('Report not found: missing')
    })

    it('throws when the section does not exist', async () => {
      seedReport(createBaseReport())

      await expect(
        updateSection('report-1', 'nope', { content: { ja: 'x', en: 'x' } })
      ).rejects.toThrow('Section not found: nope')
    })

    it('merges updates into the existing section', async () => {
      seedReport(createBaseReport({ sections: [createSection()] }))

      await updateSection('report-1', 'sec-1', {
        content: { ja: '新しい内容', en: 'new content' },
      })

      const stored = await getReport('report-1')
      expect(stored?.sections[0].content).toEqual({ ja: '新しい内容', en: 'new content' })
      expect(stored?.sections[0].title).toEqual({ ja: '会社概要', en: 'Company Overview' })
    })
  })

  describe('addSection', () => {
    it('throws when the report does not exist', async () => {
      await expect(
        addSection('missing', {
          type: 'company_overview',
          title: { ja: 't', en: 't' },
          content: { ja: 'c', en: 'c' },
        })
      ).rejects.toThrow('Report not found: missing')
    })

    it('appends a section with a generated id and trailing order', async () => {
      seedReport(createBaseReport({ sections: [createSection({ id: 'sec-1', order: 0 })] }))

      const added = await addSection('report-1', {
        type: 'business_overview',
        title: { ja: '事業概要', en: 'Business Overview' },
        content: { ja: '内容', en: 'content' },
      })

      expect(added.id).toBeTruthy()
      expect(added.order).toBe(1)
      expect(added.type).toBe('business_overview')

      const stored = await getReport('report-1')
      expect(stored?.sections).toHaveLength(2)
      expect(stored?.sections[1].id).toBe(added.id)
    })
  })

  describe('removeSection', () => {
    it('throws when the report does not exist', async () => {
      await expect(removeSection('missing', 'sec-1')).rejects.toThrow('Report not found: missing')
    })

    it('removes the section and reindexes the remaining order', async () => {
      seedReport(
        createBaseReport({
          sections: [
            createSection({ id: 'sec-1', order: 0 }),
            createSection({ id: 'sec-2', order: 1, type: 'business_overview' }),
          ],
        })
      )

      await removeSection('report-1', 'sec-1')

      const stored = await getReport('report-1')
      expect(stored?.sections).toHaveLength(1)
      expect(stored?.sections[0].id).toBe('sec-2')
      expect(stored?.sections[0].order).toBe(0)
    })
  })

  describe('updateFinancialHighlights', () => {
    it('throws when the report does not exist', async () => {
      await expect(updateFinancialHighlights('missing', [])).rejects.toThrow(
        'Report not found: missing'
      )
    })

    it('replaces the financial highlights and persists', async () => {
      seedReport(createBaseReport())

      const highlights: FinancialHighlight[] = [
        {
          fiscalYear: '2024',
          revenue: 1000,
          operatingProfit: 200,
          ordinaryProfit: 250,
          netIncome: 180,
          eps: 10,
          bps: 100,
          roe: 0.1,
          roa: 0.05,
        },
      ]

      await updateFinancialHighlights('report-1', highlights)

      const stored = await getReport('report-1')
      expect(stored?.financialHighlights).toEqual(highlights)
    })
  })

  describe('updateShareholderComposition', () => {
    it('throws when the report does not exist', async () => {
      await expect(updateShareholderComposition('missing', [])).rejects.toThrow(
        'Report not found: missing'
      )
    })

    it('replaces the shareholder composition and persists', async () => {
      seedReport(createBaseReport())

      const composition: ShareholderData[] = [{ category: 'financial', percentage: 30 }]

      await updateShareholderComposition('report-1', composition)

      const stored = await getReport('report-1')
      expect(stored?.shareholderComposition).toEqual(composition)
    })
  })

  describe('updateEvents', () => {
    it('throws when the report does not exist', async () => {
      await expect(updateEvents('missing', [])).rejects.toThrow('Report not found: missing')
    })

    it('replaces the events and persists', async () => {
      seedReport(createBaseReport())

      const events: IREvent[] = [
        { id: 'ev-1', title: '決算説明会', date: '2024-06-01', type: 'earnings' },
      ]

      await updateEvents('report-1', events)

      const stored = await getReport('report-1')
      expect(stored?.events).toEqual(events)
    })
  })

  describe('updateFAQs', () => {
    it('throws when the report does not exist', async () => {
      await expect(updateFAQs('missing', [])).rejects.toThrow('Report not found: missing')
    })

    it('replaces the FAQs and persists', async () => {
      seedReport(createBaseReport())

      const faqs: FAQItem[] = [
        {
          id: 'faq-1',
          question: { ja: '質問', en: 'Question' },
          answer: { ja: '回答', en: 'Answer' },
          order: 0,
        },
      ]

      await updateFAQs('report-1', faqs)

      const stored = await getReport('report-1')
      expect(stored?.faqs).toEqual(faqs)
    })
  })

  describe('generateSectionContent', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('returns the known template for a recognised section type', async () => {
      const promise = generateSectionContent({
        sectionType: 'company_overview',
        context: { companyId: 'company-1', fiscalYear: '2024' },
        language: 'ja',
      })

      await vi.advanceTimersByTimeAsync(500)
      const result = await promise

      expect(result.success).toBe(true)
      expect(result.content?.ja).toContain('会社概要')
      expect(result.content?.en).toContain('Company Overview')
      expect(result.tokensUsed).toBe(150)
    })

    it('falls back to the generic template for an unmapped section type', async () => {
      const promise = generateSectionContent({
        sectionType: 'faq',
        context: { companyId: 'company-1', fiscalYear: '2024' },
        language: 'en',
      })

      await vi.advanceTimersByTimeAsync(500)
      const result = await promise

      expect(result.success).toBe(true)
      expect(result.content?.en).toContain('AI-generated content')
      expect(result.content?.ja).toContain('セクション内容')
    })
  })
})
