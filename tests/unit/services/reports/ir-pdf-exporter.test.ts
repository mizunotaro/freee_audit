import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { IRReport, IRReportSection } from '@/types/reports/ir-report'

interface ExportOptions {
  format: 'pdf' | 'pptx'
  language: 'ja' | 'en' | 'dual'
  paperSize?: 'A4' | 'A3' | 'Letter'
  orientation?: 'portrait' | 'landscape'
  includeCharts?: boolean
}

interface ExportResult {
  downloadUrl: string
  filename: string
  expiresAt: Date
  fileSize: number
  mimeType: string
}

type ExportError = {
  code: string
  message: string
  details?: Record<string, unknown>
}

type ExportResultType<T> = { success: true; data: T } | { success: false; error: ExportError }

const MIME_TYPES = {
  pdf: 'application/pdf',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
}

const FILE_EXTENSIONS = {
  pdf: '.pdf',
  pptx: '.pptx',
}

function createExportError(
  code: string,
  message: string,
  details?: Record<string, unknown>
): ExportError {
  return { code, message, details }
}

function generateFilename(report: IRReport, options: ExportOptions): string {
  const date = new Date().toISOString().split('T')[0]
  const lang = options.language === 'dual' ? 'ja-en' : options.language
  const sanitizedTitle = report.title.ja.replace(
    /[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g,
    '_'
  )
  return `ir_report_${sanitizedTitle}_${date}_${lang}${FILE_EXTENSIONS[options.format]}`
}

async function exportToPDF(
  report: IRReport,
  options: ExportOptions
): Promise<ExportResultType<ExportResult>> {
  if (!report) {
    return { success: false, error: createExportError('VALIDATION_ERROR', 'Report is required') }
  }

  if (!report.id || !report.title) {
    return { success: false, error: createExportError('VALIDATION_ERROR', 'Invalid report data') }
  }

  if (report.sections.length === 0) {
    return {
      success: false,
      error: createExportError('VALIDATION_ERROR', 'Report has no sections'),
    }
  }

  try {
    const filename = generateFilename(report, options)
    const content = generatePDFContent(report, options)
    const fileSize = Buffer.byteLength(content, 'utf-8')

    return {
      success: true,
      data: {
        downloadUrl: `/api/export/download/${Buffer.from(filename).toString('base64')}`,
        filename,
        expiresAt: new Date(Date.now() + 3600000),
        fileSize,
        mimeType: MIME_TYPES.pdf,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to export PDF'
    return { success: false, error: createExportError('EXPORT_ERROR', message) }
  }
}

function generatePDFContent(report: IRReport, options: ExportOptions): string {
  const lines: string[] = []

  lines.push(`# ${report.title.ja}`)
  if (options.language === 'en' || options.language === 'dual') {
    lines.push(`## ${report.title.en}`)
  }
  lines.push('')

  for (const section of report.sections) {
    lines.push(`## ${section.title.ja}`)
    if (options.language === 'en' || options.language === 'dual') {
      lines.push(`### ${section.title.en}`)
    }
    lines.push(section.content.ja)
    if (options.language === 'dual') {
      lines.push('')
      lines.push(section.content.en)
    }
    lines.push('')
  }

  if (report.financialHighlights.length > 0 && options.includeCharts) {
    lines.push('## Financial Highlights')
    for (const highlight of report.financialHighlights) {
      lines.push(
        `- ${highlight.fiscalYear}: Revenue ${highlight.revenue}, Operating Profit ${highlight.operatingProfit}`
      )
    }
  }

  return lines.join('\n')
}

vi.mock('@/lib/db', () => ({
  prisma: {},
}))

describe('IRPDFExporter', () => {
  const mockReport: IRReport = {
    id: 'report-123',
    companyId: 'company-456',
    title: { ja: '2024年度 IRレポート', en: 'FY2024 IR Report' },
    fiscalYear: '2024',
    status: 'approved',
    language: 'bilingual',
    sections: [
      {
        id: 'section-1',
        type: 'company_overview',
        title: { ja: '会社概要', en: 'Company Overview' },
        content: { ja: '会社概要の内容', en: 'Company overview content' },
        order: 0,
      },
      {
        id: 'section-2',
        type: 'financial_highlights',
        title: { ja: '財務ハイライト', en: 'Financial Highlights' },
        content: { ja: '財務ハイライトの内容', en: 'Financial highlights content' },
        order: 1,
      },
    ],
    financialHighlights: [
      {
        fiscalYear: '2024',
        revenue: 1000000000,
        operatingProfit: 100000000,
        ordinaryProfit: 95000000,
        netIncome: 60000000,
        eps: 50.5,
        bps: 500.25,
        roe: 10.5,
        roa: 5.2,
      },
    ],
    shareholderComposition: [],
    events: [],
    faqs: [],
    metadata: {
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-06-01T00:00:00.000Z',
      createdBy: 'user-1',
      lastModifiedBy: 'user-2',
      version: 1,
    },
  }

  const defaultOptions: ExportOptions = {
    format: 'pdf',
    language: 'ja',
    paperSize: 'A4',
    orientation: 'portrait',
    includeCharts: true,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('exportToPDF', () => {
    it('should return success with export result', async () => {
      const result = await exportToPDF(mockReport, defaultOptions)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.filename).toContain('ir_report')
        expect(result.data.filename).toContain('.pdf')
        expect(result.data.mimeType).toBe('application/pdf')
        expect(result.data.downloadUrl).toBeDefined()
        expect(result.data.expiresAt).toBeInstanceOf(Date)
        expect(result.data.fileSize).toBeGreaterThan(0)
      }
    })

    it('should return failure when report is null', async () => {
      const result = await exportToPDF(null as any, defaultOptions)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
        expect(result.error.message).toBe('Report is required')
      }
    })

    it('should return failure when report has no id', async () => {
      const invalidReport = { ...mockReport, id: '' }
      const result = await exportToPDF(invalidReport, defaultOptions)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('should return failure when report has no sections', async () => {
      const emptyReport = { ...mockReport, sections: [] }
      const result = await exportToPDF(emptyReport, defaultOptions)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
        expect(result.error.message).toBe('Report has no sections')
      }
    })

    it('should generate filename with Japanese title', async () => {
      const result = await exportToPDF(mockReport, defaultOptions)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.filename).toContain('2024')
      }
    })

    it('should include language in filename', async () => {
      const enOptions = { ...defaultOptions, language: 'en' as const }
      const result = await exportToPDF(mockReport, enOptions)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.filename).toContain('_en')
      }
    })

    it('should handle dual language', async () => {
      const dualOptions = { ...defaultOptions, language: 'dual' as const }
      const result = await exportToPDF(mockReport, dualOptions)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.filename).toContain('ja-en')
      }
    })
  })

  describe('generatePDFContent', () => {
    it('should generate content with Japanese sections', () => {
      const content = generatePDFContent(mockReport, defaultOptions)

      expect(content).toContain(mockReport.title.ja)
      expect(content).toContain('会社概要')
    })

    it('should include English content when language is en', () => {
      const enOptions = { ...defaultOptions, language: 'en' as const }
      const content = generatePDFContent(mockReport, enOptions)

      expect(content).toContain(mockReport.title.en)
      expect(content).toContain('Company Overview')
    })

    it('should include both languages when language is dual', () => {
      const dualOptions = { ...defaultOptions, language: 'dual' as const }
      const content = generatePDFContent(mockReport, dualOptions)

      expect(content).toContain(mockReport.title.ja)
      expect(content).toContain(mockReport.title.en)
    })

    it('should include financial highlights when includeCharts is true', () => {
      const content = generatePDFContent(mockReport, { ...defaultOptions, includeCharts: true })

      expect(content).toContain('Financial Highlights')
      expect(content).toContain('Revenue')
    })

    it('should not include financial highlights when includeCharts is false', () => {
      const content = generatePDFContent(mockReport, { ...defaultOptions, includeCharts: false })

      expect(content).not.toContain('Financial Highlights')
    })
  })

  describe('generateFilename', () => {
    it('should generate valid filename', () => {
      const filename = generateFilename(mockReport, defaultOptions)

      expect(filename).toMatch(/^ir_report_.*\.pdf$/)
      expect(filename).toContain('2024')
    })

    it('should sanitize special characters in title', () => {
      const specialReport = {
        ...mockReport,
        title: { ja: 'テスト/レポート:2024', en: 'Test/Report:2024' },
      }
      const filename = generateFilename(specialReport, defaultOptions)

      expect(filename).not.toContain('/')
      expect(filename).not.toContain(':')
    })

    it('should include correct extension for pdf', () => {
      const filename = generateFilename(mockReport, defaultOptions)

      expect(filename.endsWith('.pdf')).toBe(true)
    })
  })

  describe('Edge cases', () => {
    it('should handle report with many sections', async () => {
      const manySectionsReport = {
        ...mockReport,
        sections: Array.from({ length: 20 }, (_, i) => ({
          id: `section-${i}`,
          type: 'company_overview' as const,
          title: { ja: `セクション${i}`, en: `Section ${i}` },
          content: { ja: `内容${i}`, en: `Content ${i}` },
          order: i,
        })),
      }

      const result = await exportToPDF(manySectionsReport, defaultOptions)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.fileSize).toBeGreaterThan(0)
      }
    })

    it('should handle long content', async () => {
      const longContentReport = {
        ...mockReport,
        sections: [
          {
            id: 'section-1',
            type: 'company_overview' as const,
            title: { ja: '長いセクション', en: 'Long Section' },
            content: { ja: 'あ'.repeat(10000), en: 'a'.repeat(10000) },
            order: 0,
          },
        ],
      }

      const result = await exportToPDF(longContentReport, defaultOptions)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.fileSize).toBeGreaterThan(10000)
      }
    })

    it('should handle special characters in content', async () => {
      const specialContentReport = {
        ...mockReport,
        sections: [
          {
            id: 'section-1',
            type: 'company_overview' as const,
            title: { ja: '特殊文字', en: 'Special Chars' },
            content: {
              ja: '<script>alert("xss")</script> & "quotes" \'apostrophe\'',
              en: '<script>alert("xss")</script> & "quotes" \'apostrophe\'',
            },
            order: 0,
          },
        ],
      }

      const result = await exportToPDF(specialContentReport, defaultOptions)

      expect(result.success).toBe(true)
    })

    it('should handle empty financial highlights', async () => {
      const noHighlightsReport = {
        ...mockReport,
        financialHighlights: [],
      }

      const result = await exportToPDF(noHighlightsReport, {
        ...defaultOptions,
        includeCharts: true,
      })

      expect(result.success).toBe(true)
    })

    it('should handle Unicode characters', async () => {
      const unicodeReport = {
        ...mockReport,
        title: { ja: '🎉 IRレポート 2024 📊', en: '🎉 IR Report 2024 📊' },
      }

      const result = await exportToPDF(unicodeReport, defaultOptions)

      expect(result.success).toBe(true)
    })
  })
})

export { exportToPDF, generatePDFContent, generateFilename }
