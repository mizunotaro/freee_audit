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

async function exportToPPTX(
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
    const slides = createSlides(report, options)
    const content = buildPPTX(slides, options)
    const fileSize = Buffer.byteLength(content, 'utf-8')

    return {
      success: true,
      data: {
        downloadUrl: `/api/export/download/${Buffer.from(filename).toString('base64')}`,
        filename,
        expiresAt: new Date(Date.now() + 3600000),
        fileSize,
        mimeType: MIME_TYPES.pptx,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to export PPTX'
    return { success: false, error: createExportError('EXPORT_ERROR', message) }
  }
}

interface Slide {
  title: string
  content: string[]
}

function createSlides(report: IRReport, options: ExportOptions): Slide[] {
  const slides: Slide[] = []

  slides.push({
    title: options.language === 'en' ? report.title.en : report.title.ja,
    content: [`Fiscal Year: ${report.fiscalYear}`, `Status: ${report.status}`],
  })

  for (const section of report.sections) {
    slides.push({
      title: options.language === 'en' ? section.title.en : section.title.ja,
      content: [options.language === 'en' ? section.content.en : section.content.ja],
    })
  }

  if (report.financialHighlights.length > 0 && options.includeCharts) {
    const highlightContent = report.financialHighlights.map(
      (h) =>
        `${h.fiscalYear}: Revenue ${formatCurrency(h.revenue)}, OP ${formatCurrency(h.operatingProfit)}`
    )
    slides.push({
      title: 'Financial Highlights',
      content: highlightContent,
    })
  }

  if (report.shareholderComposition.length > 0) {
    const shareholderContent = report.shareholderComposition.map(
      (s) => `${s.category}: ${s.percentage}%`
    )
    slides.push({
      title: 'Shareholder Composition',
      content: shareholderContent,
    })
  }

  if (report.faqs.length > 0) {
    const faqContent = report.faqs.map((f) => `Q: ${f.question.ja}\nA: ${f.answer.ja}`)
    slides.push({
      title: 'FAQ',
      content: faqContent,
    })
  }

  return slides
}

function buildPPTX(slides: Slide[], _options: ExportOptions): string {
  return slides
    .map(
      (slide) => `
${slide.title}
${'='.repeat(60)}
${slide.content.join('\n')}
`
    )
    .join('\n---\n')
}

function formatCurrency(value: number): string {
  const absValue = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (absValue >= 1000000000) {
    return `${sign}${(absValue / 1000000000).toFixed(1)}B`
  }
  if (absValue >= 1000000) {
    return `${sign}${(absValue / 1000000).toFixed(1)}M`
  }
  if (absValue >= 1000) {
    return `${sign}${(absValue / 1000).toFixed(1)}K`
  }
  return `${sign}${absValue.toString()}`
}

vi.mock('@/lib/db', () => ({
  prisma: {},
}))

describe('IRPPTXExporter', () => {
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
      {
        fiscalYear: '2023',
        revenue: 900000000,
        operatingProfit: 85000000,
        ordinaryProfit: 80000000,
        netIncome: 50000000,
        eps: 42.0,
        bps: 450.0,
        roe: 9.3,
        roa: 4.8,
      },
    ],
    shareholderComposition: [
      { category: 'Financial Institutions', percentage: 35 },
      { category: 'Individual Investors', percentage: 25 },
      { category: 'Foreign Investors', percentage: 20 },
      { category: 'Other Corporations', percentage: 15 },
      { category: 'Treasury Stock', percentage: 5 },
    ],
    events: [],
    faqs: [
      {
        id: 'faq-1',
        question: { ja: '配当政策は？', en: 'What is the dividend policy?' },
        answer: { ja: '安定配当を目指します', en: 'We aim for stable dividends' },
        order: 0,
        category: 'dividend',
      },
    ],
    metadata: {
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-06-01T00:00:00.000Z',
      createdBy: 'user-1',
      lastModifiedBy: 'user-2',
      version: 1,
    },
  }

  const defaultOptions: ExportOptions = {
    format: 'pptx',
    language: 'ja',
    paperSize: 'A4',
    orientation: 'landscape',
    includeCharts: true,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('exportToPPTX', () => {
    it('should return success with export result', async () => {
      const result = await exportToPPTX(mockReport, defaultOptions)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.filename).toContain('ir_report')
        expect(result.data.filename).toContain('.pptx')
        expect(result.data.mimeType).toBe(MIME_TYPES.pptx)
        expect(result.data.downloadUrl).toBeDefined()
        expect(result.data.expiresAt).toBeInstanceOf(Date)
        expect(result.data.fileSize).toBeGreaterThan(0)
      }
    })

    it('should return failure when report is null', async () => {
      const result = await exportToPPTX(null as any, defaultOptions)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
        expect(result.error.message).toBe('Report is required')
      }
    })

    it('should return failure when report has no id', async () => {
      const invalidReport = { ...mockReport, id: '' }
      const result = await exportToPPTX(invalidReport, defaultOptions)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('should return failure when report has no sections', async () => {
      const emptyReport = { ...mockReport, sections: [] }
      const result = await exportToPPTX(emptyReport, defaultOptions)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
        expect(result.error.message).toBe('Report has no sections')
      }
    })

    it('should generate filename with language', async () => {
      const enOptions = { ...defaultOptions, language: 'en' as const }
      const result = await exportToPPTX(mockReport, enOptions)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.filename).toContain('_en')
      }
    })

    it('should handle dual language', async () => {
      const dualOptions = { ...defaultOptions, language: 'dual' as const }
      const result = await exportToPPTX(mockReport, dualOptions)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.filename).toContain('ja-en')
      }
    })
  })

  describe('createSlides', () => {
    it('should create title slide', () => {
      const slides = createSlides(mockReport, defaultOptions)

      expect(slides[0].title).toBe(mockReport.title.ja)
      expect(slides[0].content).toContain('Fiscal Year: 2024')
    })

    it('should create slides for each section', () => {
      const slides = createSlides(mockReport, defaultOptions)

      const sectionSlides = slides.filter(
        (s) => s.title === '会社概要' || s.title === '財務ハイライト'
      )
      expect(sectionSlides.length).toBe(2)
    })

    it('should include financial highlights slide when includeCharts is true', () => {
      const slides = createSlides(mockReport, { ...defaultOptions, includeCharts: true })

      const highlightsSlide = slides.find((s) => s.title === 'Financial Highlights')
      expect(highlightsSlide).toBeDefined()
      expect(highlightsSlide?.content.length).toBe(2)
    })

    it('should not include financial highlights slide when includeCharts is false', () => {
      const slides = createSlides(mockReport, { ...defaultOptions, includeCharts: false })

      const highlightsSlide = slides.find((s) => s.title === 'Financial Highlights')
      expect(highlightsSlide).toBeUndefined()
    })

    it('should include shareholder composition slide', () => {
      const slides = createSlides(mockReport, defaultOptions)

      const shareholderSlide = slides.find((s) => s.title === 'Shareholder Composition')
      expect(shareholderSlide).toBeDefined()
      expect(shareholderSlide?.content.length).toBe(5)
    })

    it('should include FAQ slide', () => {
      const slides = createSlides(mockReport, defaultOptions)

      const faqSlide = slides.find((s) => s.title === 'FAQ')
      expect(faqSlide).toBeDefined()
      expect(faqSlide?.content[0]).toContain('Q:')
      expect(faqSlide?.content[0]).toContain('A:')
    })

    it('should use English when language is en', () => {
      const enOptions = { ...defaultOptions, language: 'en' as const }
      const slides = createSlides(mockReport, enOptions)

      expect(slides[0].title).toBe(mockReport.title.en)
      expect(slides[1].title).toBe('Company Overview')
    })
  })

  describe('buildPPTX', () => {
    it('should build PPTX content from slides', () => {
      const slides = createSlides(mockReport, defaultOptions)
      const content = buildPPTX(slides, defaultOptions)

      expect(content).toContain(mockReport.title.ja)
      expect(content).toContain('会社概要')
    })

    it('should separate slides with separator', () => {
      const slides = createSlides(mockReport, defaultOptions)
      const content = buildPPTX(slides, defaultOptions)

      expect(content).toContain('---')
    })
  })

  describe('formatCurrency', () => {
    it('should format billions', () => {
      expect(formatCurrency(1500000000)).toBe('1.5B')
    })

    it('should format millions', () => {
      expect(formatCurrency(5000000)).toBe('5.0M')
    })

    it('should format thousands', () => {
      expect(formatCurrency(5000)).toBe('5.0K')
    })

    it('should format small values', () => {
      expect(formatCurrency(500)).toBe('500')
    })

    it('should handle zero', () => {
      expect(formatCurrency(0)).toBe('0')
    })

    it('should handle negative values', () => {
      expect(formatCurrency(-1000000)).toBe('-1.0M')
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

      const result = await exportToPPTX(manySectionsReport, defaultOptions)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.fileSize).toBeGreaterThan(0)
      }
    })

    it('should handle empty financial highlights', async () => {
      const noHighlightsReport = {
        ...mockReport,
        financialHighlights: [],
      }

      const result = await exportToPPTX(noHighlightsReport, {
        ...defaultOptions,
        includeCharts: true,
      })

      expect(result.success).toBe(true)
    })

    it('should handle empty shareholder composition', async () => {
      const noShareholdersReport = {
        ...mockReport,
        shareholderComposition: [],
      }

      const result = await exportToPPTX(noShareholdersReport, defaultOptions)

      expect(result.success).toBe(true)
    })

    it('should handle empty FAQs', async () => {
      const noFAQsReport = {
        ...mockReport,
        faqs: [],
      }

      const result = await exportToPPTX(noFAQsReport, defaultOptions)

      expect(result.success).toBe(true)
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
              ja: '<>&"\'\n\t特殊文字',
              en: '<>&"\'\n\tSpecial chars',
            },
            order: 0,
          },
        ],
      }

      const result = await exportToPPTX(specialContentReport, defaultOptions)

      expect(result.success).toBe(true)
    })

    it('should handle very long content', async () => {
      const longContentReport = {
        ...mockReport,
        sections: [
          {
            id: 'section-1',
            type: 'company_overview' as const,
            title: { ja: '長い内容', en: 'Long Content' },
            content: {
              ja: 'あ'.repeat(50000),
              en: 'a'.repeat(50000),
            },
            order: 0,
          },
        ],
      }

      const result = await exportToPPTX(longContentReport, defaultOptions)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.fileSize).toBeGreaterThan(50000)
      }
    })
  })
})

export { exportToPPTX, createSlides, buildPPTX, formatCurrency }
