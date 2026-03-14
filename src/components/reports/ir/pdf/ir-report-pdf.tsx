import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { IRReport, IRReportSection } from '@/types/ir-report'

const JAPANESE_FONT_FAMILY = 'Noto Sans JP'

export const irReportStyles = StyleSheet.create({
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
  highlightLabel: {
    fontSize: 10,
    color: '#666666',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  metricCard: {
    width: '45%',
    marginRight: '5%',
    marginBottom: 15,
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 5,
  },
  chartPlaceholder: {
    height: 150,
    backgroundColor: '#F0F0F0',
    borderRadius: 5,
    marginBottom: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartPlaceholderText: {
    fontSize: 10,
    color: '#888888',
  },
  tocItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tocTitle: {
    fontSize: 11,
    color: '#333333',
  },
  tocPage: {
    fontSize: 11,
    color: '#666666',
  },
})

export interface PDFExportOptions {
  language: 'ja' | 'en'
  includeCoverPage?: boolean
  includeTOC?: boolean
  companyName?: string
}

interface CoverPageProps {
  title: string
  fiscalYear: number
  companyName: string
  language: 'ja' | 'en'
}

export function CoverPage({ title, fiscalYear, companyName, language }: CoverPageProps) {
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
    <Page size="A4" style={irReportStyles.page}>
      <View style={irReportStyles.coverPage}>
        <Text style={irReportStyles.coverTitle}>{title}</Text>
        <Text style={irReportStyles.coverSubtitle}>{companyName}</Text>
        <Text style={irReportStyles.coverSubtitle}>{t.fiscalYear}</Text>
        <Text style={irReportStyles.coverInfo}>{t.investorRelations}</Text>
        <Text style={irReportStyles.coverInfo}>
          {t.generated}: {new Date().toLocaleDateString(language === 'ja' ? 'ja-JP' : 'en-US')}
        </Text>
      </View>
    </Page>
  )
}

interface TOCPageProps {
  sections: IRReportSection[]
  companyName: string
  language: 'ja' | 'en'
}

export function TOCPage({ sections, companyName, language }: TOCPageProps) {
  const texts = {
    ja: {
      title: '目次',
    },
    en: {
      title: 'Table of Contents',
    },
  }

  return (
    <Page size="A4" style={irReportStyles.page}>
      <View style={irReportStyles.header} fixed>
        <Text style={irReportStyles.headerTitle}>{companyName}</Text>
        <Text style={irReportStyles.headerTitle}>IR Report</Text>
      </View>

      <Text style={irReportStyles.sectionTitle}>{texts[language].title}</Text>

      <View>
        {sections.map((section, index) => (
          <View key={section.id} style={irReportStyles.tocItem}>
            <Text style={irReportStyles.tocTitle}>
              {index + 1}. {section.title}
            </Text>
            <Text style={irReportStyles.tocPage}>{index + 2}</Text>
          </View>
        ))}
      </View>

      <View style={irReportStyles.footer} fixed>
        <Text style={irReportStyles.footerText}>{companyName}</Text>
        <Text
          style={irReportStyles.pageNumber}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
        />
      </View>
    </Page>
  )
}

interface SectionPageProps {
  section: IRReportSection
  language: 'ja' | 'en'
  companyName: string
}

export function SectionPage({ section, language: _language, companyName }: SectionPageProps) {
  return (
    <Page size="A4" style={irReportStyles.page} wrap>
      <View style={irReportStyles.header} fixed>
        <Text style={irReportStyles.headerTitle}>{companyName}</Text>
        <Text style={irReportStyles.headerTitle}>IR Report</Text>
      </View>

      <View>
        <Text style={irReportStyles.sectionTitle}>{section.title}</Text>
        <Text style={irReportStyles.sectionContent}>{section.content}</Text>
      </View>

      <View style={irReportStyles.footer} fixed>
        <Text style={irReportStyles.footerText}>{companyName}</Text>
        <Text
          style={irReportStyles.pageNumber}
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

export function IRReportDocument({ report, options }: IRReportDocumentProps) {
  const { language, includeCoverPage = true, includeTOC = false, companyName = 'Company' } = options
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

      {includeTOC && sections.length > 0 && (
        <TOCPage sections={sections} companyName={companyName} language={language} />
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

export interface FinancialHighlightData {
  label: string
  value: number
  unit: string
  change?: number
  changeDirection?: 'up' | 'down' | 'neutral'
}

interface FinancialHighlightsSectionProps {
  highlights: FinancialHighlightData[]
  language: 'ja' | 'en'
  companyName: string
}

export function FinancialHighlightsSection({
  highlights,
  language,
  companyName,
}: FinancialHighlightsSectionProps) {
  const texts = {
    ja: {
      title: '財務ハイライト',
    },
    en: {
      title: 'Financial Highlights',
    },
  }

  return (
    <Page size="A4" style={irReportStyles.page}>
      <View style={irReportStyles.header} fixed>
        <Text style={irReportStyles.headerTitle}>{companyName}</Text>
        <Text style={irReportStyles.headerTitle}>IR Report</Text>
      </View>

      <Text style={irReportStyles.sectionTitle}>{texts[language].title}</Text>

      <View style={irReportStyles.metricsGrid}>
        {highlights.map((highlight, index) => (
          <View key={index} style={irReportStyles.metricCard}>
            <Text style={irReportStyles.highlightLabel}>{highlight.label}</Text>
            <Text style={irReportStyles.highlightValue}>
              {highlight.value.toLocaleString(language === 'ja' ? 'ja-JP' : 'en-US')}
              {highlight.unit}
            </Text>
            {highlight.change !== undefined && (
              <Text
                style={[
                  irReportStyles.highlightLabel,
                  {
                    color:
                      highlight.changeDirection === 'up'
                        ? '#34A853'
                        : highlight.changeDirection === 'down'
                          ? '#EA4335'
                          : '#666666',
                  },
                ]}
              >
                {highlight.change > 0 ? '+' : ''}
                {highlight.change.toFixed(1)}%
              </Text>
            )}
          </View>
        ))}
      </View>

      <View style={irReportStyles.footer} fixed>
        <Text style={irReportStyles.footerText}>{companyName}</Text>
        <Text
          style={irReportStyles.pageNumber}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
        />
      </View>
    </Page>
  )
}

export interface TableRowData {
  [key: string]: string | number
}

interface TableSectionProps {
  title: string
  headers: string[]
  rows: TableRowData[]
  language: 'ja' | 'en'
  companyName: string
}

export function TableSection({
  title,
  headers,
  rows,
  language: _language,
  companyName,
}: TableSectionProps) {
  return (
    <Page size="A4" style={irReportStyles.page} wrap>
      <View style={irReportStyles.header} fixed>
        <Text style={irReportStyles.headerTitle}>{companyName}</Text>
        <Text style={irReportStyles.headerTitle}>IR Report</Text>
      </View>

      <Text style={irReportStyles.sectionTitle}>{title}</Text>

      <View style={irReportStyles.table}>
        <View style={[irReportStyles.tableRow, irReportStyles.tableHeader]}>
          {headers.map((header, index) => (
            <Text key={index} style={irReportStyles.tableCell}>
              {header}
            </Text>
          ))}
        </View>

        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={irReportStyles.tableRow}>
            {headers.map((header, cellIndex) => (
              <Text key={cellIndex} style={irReportStyles.tableCell}>
                {String(row[header])}
              </Text>
            ))}
          </View>
        ))}
      </View>

      <View style={irReportStyles.footer} fixed>
        <Text style={irReportStyles.footerText}>{companyName}</Text>
        <Text
          style={irReportStyles.pageNumber}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
        />
      </View>
    </Page>
  )
}
