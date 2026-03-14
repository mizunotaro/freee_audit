import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer'
import type { IRReport, IRReportSection } from '@/types/ir-report'
import { success, failure, type Result } from '@/types/result'

const EXPORT_TIMEOUT_MS = 60000
const MAX_SECTIONS_PER_BATCH = 10

const JAPANESE_FONT_FAMILY = 'Noto Sans JP'

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    padding: 40,
    fontFamily: JAPANESE_FONT_FAMILY,
  },
  coverPage: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  coverTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  coverSubtitle: {
    fontSize: 18,
    color: '#666666',
    marginBottom: 10,
  },
  coverInfo: {
    fontSize: 14,
    color: '#888888',
    marginTop: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 10,
    color: '#666666',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingTop: 10,
  },
  footerText: {
    fontSize: 9,
    color: '#888888',
  },
  pageNumber: {
    fontSize: 9,
    color: '#888888',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#1A1A1A',
  },
  sectionContent: {
    fontSize: 11,
    lineHeight: 1.6,
    color: '#333333',
  },
  table: {
    width: '100%',
    marginTop: 10,
    marginBottom: 10,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingVertical: 8,
  },
  tableHeader: {
    backgroundColor: '#F5F5F5',
    fontWeight: 'bold',
  },
  tableCell: {
    flex: 1,
    fontSize: 10,
    paddingHorizontal: 5,
  },
  highlightBox: {
    backgroundColor: '#F8F9FA',
    padding: 15,
    borderRadius: 5,
    marginBottom: 15,
  },
  highlightTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  highlightValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A73E8',
  },
})

export interface PDFExportOptions {
  language: 'ja' | 'en'
  includeCoverPage?: boolean
  includeTOC?: boolean
  companyName?: string
}

export interface PDFExportResult {
  buffer: Buffer
  filename: string
  mimeType: string
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

function _formatNumber(value: number, locale: string): string {
  return locale === 'ja' ? value.toLocaleString('ja-JP') : value.toLocaleString('en-US')
}

function formatDate(date: Date | string, locale: string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return locale === 'ja'
    ? d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
    : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

interface CoverPageProps {
  title: string
  fiscalYear: number
  companyName: string
  language: 'ja' | 'en'
}

function CoverPage({ title, fiscalYear, companyName, language }: CoverPageProps) {
  const texts = {
    ja: {
      fiscalYear: `${fiscalYear}年度`,
      investorRelations: '投資家向け資料',
      generated: '作成日',
    },
    en: {
      fiscalYear: `Fiscal Year ${fiscalYear}`,
      investorRelations: 'Investor Relations',
      generated: 'Generated',
    },
  }

  const t = texts[language]

  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.coverPage}>
        <Text style={styles.coverTitle}>{sanitizeText(title)}</Text>
        <Text style={styles.coverSubtitle}>{sanitizeText(companyName)}</Text>
        <Text style={styles.coverSubtitle}>{t.fiscalYear}</Text>
        <Text style={styles.coverInfo}>{t.investorRelations}</Text>
        <Text style={styles.coverInfo}>
          {t.generated}: {formatDate(new Date(), language)}
        </Text>
      </View>
    </Page>
  )
}

interface SectionPageProps {
  section: IRReportSection
  language: 'ja' | 'en'
  companyName: string
}

function SectionPage({ section, language: _language, companyName }: SectionPageProps) {
  return (
    <Page size="A4" style={styles.page} wrap>
      <View style={styles.header} fixed>
        <Text style={styles.headerTitle}>{sanitizeText(companyName)}</Text>
        <Text style={styles.headerTitle}>IR Report</Text>
      </View>

      <View>
        <Text style={styles.sectionTitle}>{sanitizeText(section.title)}</Text>
        <Text style={styles.sectionContent}>{sanitizeText(section.content)}</Text>
      </View>

      <View style={styles.footer} fixed>
        <Text style={styles.footerText}>{sanitizeText(companyName)}</Text>
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
        />
      </View>
    </Page>
  )
}

interface IRReportDocumentProps {
  report: IRReport
  options: PDFExportOptions
}

function IRReportDocument({ report, options }: IRReportDocumentProps) {
  const { language, includeCoverPage = true, companyName = 'Company' } = options
  const sections = report.sections ?? []

  return (
    <Document>
      {includeCoverPage && (
        <CoverPage
          title={report.title}
          fiscalYear={report.fiscalYear}
          companyName={companyName}
          language={language}
        />
      )}

      {sections.map((section) => (
        <SectionPage
          key={section.id}
          section={section}
          language={language}
          companyName={companyName}
        />
      ))}
    </Document>
  )
}

async function generatePDFWithTimeout(
  report: IRReport,
  options: PDFExportOptions
): Promise<Buffer> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error('PDF generation timeout exceeded'))
    }, EXPORT_TIMEOUT_MS)
  })

  const generationPromise = async () => {
    const blob = await pdf(<IRReportDocument report={report} options={options} />).toBlob()
    const arrayBuffer = await blob.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  return Promise.race([generationPromise(), timeoutPromise])
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

  return success(undefined)
}

export async function exportIRReportToPDF(
  report: IRReport,
  options: PDFExportOptions = { language: 'ja' }
): Promise<Result<PDFExportResult, Error>> {
  const validation = validateReport(report)
  if (!validation.success) {
    return validation
  }

  try {
    const buffer = await generatePDFWithTimeout(report, options)

    const sanitizedTitle = sanitizeText(report.title).replace(
      /[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g,
      '_'
    )
    const filename = `ir_report_${report.fiscalYear}_${sanitizedTitle}.pdf`

    return success({
      buffer,
      filename,
      mimeType: 'application/pdf',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown PDF export error'
    return failure(new Error(message))
  }
}

export async function exportIRReportSectionsToPDF(
  sections: IRReportSection[],
  metadata: {
    title: string
    fiscalYear: number
    companyName: string
  },
  options: PDFExportOptions = { language: 'ja' }
): Promise<Result<PDFExportResult, Error>> {
  if (!Array.isArray(sections)) {
    return failure(new Error('Sections must be an array'))
  }

  if (sections.length > MAX_SECTIONS_PER_BATCH * 10) {
    return failure(new Error('Too many sections, consider splitting the report'))
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

  return exportIRReportToPDF(report, {
    ...options,
    companyName: metadata.companyName,
  })
}
