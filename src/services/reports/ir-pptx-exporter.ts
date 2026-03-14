import PptxGenJS from 'pptxgenjs'
import type { IRReport, IRReportSection } from '@/types/ir-report'
import { success, failure, type Result } from '@/types/result'

const EXPORT_TIMEOUT_MS = 60000
const MAX_SLIDES_PER_PRESENTATION = 100
const SLIDE_WIDTH = 10
const _SLIDE_HEIGHT = 7.5

export interface PPTXExportOptions {
  language: 'ja' | 'en'
  includeTitleSlide?: boolean
  companyName?: string
  logoUrl?: string
}

export interface PPTXExportResult {
  buffer: Buffer
  filename: string
  mimeType: string
}

const COLOR_SCHEME = {
  primary: '1A73E8',
  secondary: '34A853',
  accent: 'EA4335',
  text: '333333',
  textLight: '666666',
  background: 'FFFFFF',
  headerBackground: 'F5F5F5',
}

const FONT_CONFIG = {
  title: { fontFace: 'Arial', fontSize: 32, color: COLOR_SCHEME.text },
  subtitle: { fontFace: 'Arial', fontSize: 18, color: COLOR_SCHEME.textLight },
  body: { fontFace: 'Arial', fontSize: 14, color: COLOR_SCHEME.text },
  small: { fontFace: 'Arial', fontSize: 12, color: COLOR_SCHEME.textLight },
}

function sanitizeText(text: string): string {
  let result = text
  for (let i = 0; i < 32; i++) {
    if (i !== 9 && i !== 10 && i !== 13) {
      result = result.replace(new RegExp(String.fromCharCode(i), 'g'), '')
    }
  }
  return result.replace(/\s+/g, ' ').trim()
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 3) + '...'
}

function formatDate(date: Date | string, language: 'ja' | 'en'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return language === 'ja'
    ? d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
    : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function createTitleSlide(
  pptx: PptxGenJS,
  title: string,
  fiscalYear: number,
  companyName: string,
  language: 'ja' | 'en'
): void {
  const slide = pptx.addSlide()

  slide.background = { color: COLOR_SCHEME.background }

  slide.addText(sanitizeText(companyName), {
    x: 0.5,
    y: 2.5,
    w: 9,
    h: 0.5,
    ...FONT_CONFIG.subtitle,
    align: 'center',
  })

  slide.addText(sanitizeText(title), {
    x: 0.5,
    y: 3,
    w: 9,
    h: 1,
    ...FONT_CONFIG.title,
    bold: true,
    align: 'center',
  })

  const yearText =
    language === 'ja'
      ? `${fiscalYear}年度 投資家向け資料`
      : `Fiscal Year ${fiscalYear} Investor Relations`

  slide.addText(yearText, {
    x: 0.5,
    y: 4.2,
    w: 9,
    h: 0.5,
    ...FONT_CONFIG.subtitle,
    align: 'center',
  })

  const dateText =
    language === 'ja'
      ? `作成日: ${formatDate(new Date(), 'ja')}`
      : `Generated: ${formatDate(new Date(), 'en')}`

  slide.addText(dateText, {
    x: 0.5,
    y: 6.5,
    w: 9,
    h: 0.3,
    ...FONT_CONFIG.small,
    align: 'center',
  })
}

function createSectionSlide(
  pptx: PptxGenJS,
  section: IRReportSection,
  language: 'ja' | 'en',
  companyName: string,
  slideIndex: number
): void {
  const slide = pptx.addSlide()

  slide.background = { color: COLOR_SCHEME.background }

  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: SLIDE_WIDTH,
    h: 0.8,
    fill: { color: COLOR_SCHEME.primary },
  })

  slide.addText(sanitizeText(companyName), {
    x: 0.5,
    y: 0.2,
    w: 4,
    h: 0.4,
    fontFace: 'Arial',
    fontSize: 12,
    color: 'FFFFFF',
  })

  slide.addText(`IR Report`, {
    x: 6,
    y: 0.2,
    w: 3.5,
    h: 0.4,
    fontFace: 'Arial',
    fontSize: 12,
    color: 'FFFFFF',
    align: 'right',
  })

  slide.addText(sanitizeText(section.title), {
    x: 0.5,
    y: 1.2,
    w: 9,
    h: 0.6,
    ...FONT_CONFIG.title,
    fontSize: 24,
    bold: true,
  })

  const content = truncateText(sanitizeText(section.content), 2000)

  slide.addText(content, {
    x: 0.5,
    y: 2,
    w: 9,
    h: 4.5,
    ...FONT_CONFIG.body,
    valign: 'top',
    wrap: true,
  })

  slide.addText(`${slideIndex}`, {
    x: 9.2,
    y: 7,
    w: 0.5,
    h: 0.3,
    ...FONT_CONFIG.small,
    align: 'right',
  })
}

function createTOCSlide(
  pptx: PptxGenJS,
  sections: IRReportSection[],
  language: 'ja' | 'en',
  companyName: string
): void {
  const slide = pptx.addSlide()

  slide.background = { color: COLOR_SCHEME.background }

  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: SLIDE_WIDTH,
    h: 0.8,
    fill: { color: COLOR_SCHEME.primary },
  })

  slide.addText(sanitizeText(companyName), {
    x: 0.5,
    y: 0.2,
    w: 4,
    h: 0.4,
    fontFace: 'Arial',
    fontSize: 12,
    color: 'FFFFFF',
  })

  const titleText = language === 'ja' ? '目次' : 'Table of Contents'
  slide.addText(titleText, {
    x: 0.5,
    y: 1.2,
    w: 9,
    h: 0.6,
    ...FONT_CONFIG.title,
    fontSize: 24,
    bold: true,
  })

  const tocItems = sections.map((section, index) => ({
    text: `${index + 1}. ${truncateText(sanitizeText(section.title), 50)}`,
    options: {
      x: 0.5,
      y: 2 + index * 0.4,
      w: 9,
      h: 0.4,
      ...FONT_CONFIG.body,
    },
  }))

  tocItems.forEach((item) => {
    slide.addText(item.text, item.options)
  })
}

function createFinancialHighlightsSlide(
  pptx: PptxGenJS,
  highlights: Array<{ label: string; value: number; unit: string; change?: number }>,
  language: 'ja' | 'en',
  companyName: string
): void {
  const slide = pptx.addSlide()

  slide.background = { color: COLOR_SCHEME.background }

  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: SLIDE_WIDTH,
    h: 0.8,
    fill: { color: COLOR_SCHEME.primary },
  })

  slide.addText(sanitizeText(companyName), {
    x: 0.5,
    y: 0.2,
    w: 4,
    h: 0.4,
    fontFace: 'Arial',
    fontSize: 12,
    color: 'FFFFFF',
  })

  const titleText = language === 'ja' ? '財務ハイライト' : 'Financial Highlights'
  slide.addText(titleText, {
    x: 0.5,
    y: 1.2,
    w: 9,
    h: 0.6,
    ...FONT_CONFIG.title,
    fontSize: 24,
    bold: true,
  })

  const tableData = highlights.map((h) => [
    { text: h.label },
    { text: `${h.value.toLocaleString(language === 'ja' ? 'ja-JP' : 'en-US')}${h.unit}` },
    { text: h.change !== undefined ? `${h.change >= 0 ? '+' : ''}${h.change.toFixed(1)}%` : '-' },
  ])

  if (tableData.length > 0) {
    slide.addTable(
      [
        [
          { text: language === 'ja' ? '項目' : 'Item', options: { bold: true } },
          { text: language === 'ja' ? '値' : 'Value', options: { bold: true } },
          { text: language === 'ja' ? '変化率' : 'Change', options: { bold: true } },
        ],
        ...tableData,
      ],
      {
        x: 0.5,
        y: 2,
        w: 9,
        colW: [3, 4, 2],
        border: { pt: 0.5, color: COLOR_SCHEME.textLight },
        fontFace: 'Arial',
        fontSize: 12,
        color: COLOR_SCHEME.text,
        align: 'left',
        valign: 'middle',
      }
    )
  }
}

function validateReport(report: IRReport): Result<void, Error> {
  if (!report.id || typeof report.id !== 'string') {
    return failure(new Error('Invalid report: missing id'))
  }

  if (!report.title || typeof report.title !== 'string') {
    return failure(new Error('Invalid report: missing title'))
  }

  if (typeof report.fiscalYear !== 'number' || report.fiscalYear < 1900) {
    return failure(new Error('Invalid report: invalid fiscalYear'))
  }

  if (report.sections && !Array.isArray(report.sections)) {
    return failure(new Error('Invalid report: sections must be an array'))
  }

  const sectionCount = report.sections?.length ?? 0
  if (sectionCount > MAX_SLIDES_PER_PRESENTATION) {
    return failure(new Error(`Too many sections: ${sectionCount} > ${MAX_SLIDES_PER_PRESENTATION}`))
  }

  return success(undefined)
}

async function generatePPTXWithTimeout(
  report: IRReport,
  options: PPTXExportOptions
): Promise<Buffer> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error('PPTX generation timeout exceeded'))
    }, EXPORT_TIMEOUT_MS)
  })

  const generationPromise = async () => {
    const pptx = new PptxGenJS()

    pptx.layout = 'LAYOUT_16x9'
    pptx.title = sanitizeText(report.title)
    pptx.author = 'IR Report Generator'
    pptx.company = sanitizeText(options.companyName ?? 'Company')

    const { language, includeTitleSlide = true, companyName = 'Company' } = options
    const sections = report.sections ?? []

    if (includeTitleSlide) {
      createTitleSlide(pptx, report.title, report.fiscalYear, companyName, language)
    }

    if (sections.length > 5) {
      createTOCSlide(pptx, sections, language, companyName)
    }

    sections.forEach((section, index) => {
      createSectionSlide(pptx, section, language, companyName, index + 2)
    })

    const output = await pptx.write({ outputType: 'base64' })
    const base64String = typeof output === 'string' ? output : ''
    return Buffer.from(base64String, 'base64')
  }

  return Promise.race([generationPromise(), timeoutPromise])
}

export async function exportIRReportToPPTX(
  report: IRReport,
  options: PPTXExportOptions = { language: 'ja' }
): Promise<Result<PPTXExportResult, Error>> {
  const validation = validateReport(report)
  if (!validation.success) {
    return validation
  }

  try {
    const buffer = await generatePPTXWithTimeout(report, options)

    const sanitizedTitle = sanitizeText(report.title).replace(
      /[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g,
      '_'
    )
    const filename = `ir_report_${report.fiscalYear}_${sanitizedTitle}.pptx`

    return success({
      buffer,
      filename,
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown PPTX export error'
    return failure(new Error(message))
  }
}

export async function exportIRReportSectionsToPPTX(
  sections: IRReportSection[],
  metadata: {
    title: string
    fiscalYear: number
    companyName: string
  },
  options: PPTXExportOptions = { language: 'ja' }
): Promise<Result<PPTXExportResult, Error>> {
  if (!Array.isArray(sections)) {
    return failure(new Error('Sections must be an array'))
  }

  if (sections.length > MAX_SLIDES_PER_PRESENTATION) {
    return failure(new Error('Too many sections'))
  }

  const report: IRReport = {
    id: 'temp-export',
    companyId: 'temp',
    reportType: 'annual',
    title: metadata.title,
    fiscalYear: metadata.fiscalYear,
    status: 'DRAFT',
    language: 'ja',
    sections,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  return exportIRReportToPPTX(report, {
    ...options,
    companyName: metadata.companyName,
  })
}

export { createTitleSlide, createSectionSlide, createTOCSlide, createFinancialHighlightsSlide }
