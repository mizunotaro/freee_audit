import type {
  IRReport,
  IRReportListFilter,
  IRReportListResponse,
  AIGenerationRequest,
  AIGenerationResult,
  IRReportSection,
  FinancialHighlight,
  ShareholderData,
  IREvent,
  FAQItem,
  ReportStatus,
} from '@/types/reports/ir-report'

const STORAGE_KEY_PREFIX = 'ir_report_'

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

function getStorageKey(reportId: string): string {
  return `${STORAGE_KEY_PREFIX}${reportId}`
}

export async function getReport(reportId: string): Promise<IRReport | null> {
  if (typeof window === 'undefined') {
    return null
  }

  const key = getStorageKey(reportId)
  const data = localStorage.getItem(key)

  if (!data) {
    return null
  }

  try {
    return JSON.parse(data) as IRReport
  } catch {
    return null
  }
}

export async function saveReport(report: IRReport): Promise<void> {
  if (typeof window === 'undefined') {
    return
  }

  const updatedReport = {
    ...report,
    metadata: {
      ...report.metadata,
      updatedAt: new Date().toISOString(),
      version: report.metadata.version + 1,
    },
  }

  const key = getStorageKey(report.id)
  localStorage.setItem(key, JSON.stringify(updatedReport))
}

export async function createReport(data: {
  companyId: string
  title: { ja: string; en: string }
  fiscalYear: string
  language?: 'ja' | 'en' | 'bilingual'
  createdBy: string
}): Promise<IRReport> {
  const now = new Date().toISOString()

  const report: IRReport = {
    id: generateId(),
    companyId: data.companyId,
    title: data.title,
    fiscalYear: data.fiscalYear,
    status: 'draft',
    language: data.language || 'ja',
    sections: [],
    financialHighlights: [],
    shareholderComposition: [],
    events: [],
    faqs: [],
    metadata: {
      createdAt: now,
      updatedAt: now,
      createdBy: data.createdBy,
      lastModifiedBy: data.createdBy,
      version: 1,
    },
  }

  await saveReport(report)
  return report
}

export async function deleteReport(reportId: string): Promise<void> {
  if (typeof window === 'undefined') {
    return
  }

  const key = getStorageKey(reportId)
  localStorage.removeItem(key)
}

export async function listReports(filter?: IRReportListFilter): Promise<IRReportListResponse> {
  if (typeof window === 'undefined') {
    return { reports: [], total: 0, page: 1, pageSize: 20 }
  }

  const reports: IRReport[] = []

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(STORAGE_KEY_PREFIX)) {
      const data = localStorage.getItem(key)
      if (data) {
        try {
          const report = JSON.parse(data) as IRReport
          reports.push(report)
        } catch {
          // skip invalid data
        }
      }
    }
  }

  let filtered = reports

  if (filter?.status) {
    filtered = filtered.filter((r) => r.status === filter.status)
  }

  if (filter?.fiscalYear) {
    filtered = filtered.filter((r) => r.fiscalYear === filter.fiscalYear)
  }

  if (filter?.language) {
    filtered = filtered.filter((r) => r.language === filter.language)
  }

  if (filter?.search) {
    const search = filter.search.toLowerCase()
    filtered = filtered.filter(
      (r) => r.title.ja.toLowerCase().includes(search) || r.title.en.toLowerCase().includes(search)
    )
  }

  filtered.sort(
    (a, b) => new Date(b.metadata.updatedAt).getTime() - new Date(a.metadata.updatedAt).getTime()
  )

  return {
    reports: filtered,
    total: filtered.length,
    page: 1,
    pageSize: 20,
  }
}

export async function updateReportStatus(reportId: string, status: ReportStatus): Promise<void> {
  const report = await getReport(reportId)
  if (!report) {
    throw new Error(`Report not found: ${reportId}`)
  }

  report.status = status

  if (status === 'published') {
    report.metadata.publishedAt = new Date().toISOString()
  }

  await saveReport(report)
}

export async function updateSection(
  reportId: string,
  sectionId: string,
  updates: Partial<IRReportSection>
): Promise<void> {
  const report = await getReport(reportId)
  if (!report) {
    throw new Error(`Report not found: ${reportId}`)
  }

  const sectionIndex = report.sections.findIndex((s) => s.id === sectionId)
  if (sectionIndex === -1) {
    throw new Error(`Section not found: ${sectionId}`)
  }

  report.sections[sectionIndex] = {
    ...report.sections[sectionIndex],
    ...updates,
  }

  await saveReport(report)
}

export async function addSection(
  reportId: string,
  section: Omit<IRReportSection, 'id' | 'order'>
): Promise<IRReportSection> {
  const report = await getReport(reportId)
  if (!report) {
    throw new Error(`Report not found: ${reportId}`)
  }

  const newSection: IRReportSection = {
    ...section,
    id: generateId(),
    order: report.sections.length,
  }

  report.sections.push(newSection)
  await saveReport(report)

  return newSection
}

export async function removeSection(reportId: string, sectionId: string): Promise<void> {
  const report = await getReport(reportId)
  if (!report) {
    throw new Error(`Report not found: ${reportId}`)
  }

  report.sections = report.sections.filter((s) => s.id !== sectionId)
  report.sections.forEach((s, i) => {
    s.order = i
  })

  await saveReport(report)
}

export async function updateFinancialHighlights(
  reportId: string,
  highlights: FinancialHighlight[]
): Promise<void> {
  const report = await getReport(reportId)
  if (!report) {
    throw new Error(`Report not found: ${reportId}`)
  }

  report.financialHighlights = highlights
  await saveReport(report)
}

export async function updateShareholderComposition(
  reportId: string,
  composition: ShareholderData[]
): Promise<void> {
  const report = await getReport(reportId)
  if (!report) {
    throw new Error(`Report not found: ${reportId}`)
  }

  report.shareholderComposition = composition
  await saveReport(report)
}

export async function updateEvents(reportId: string, events: IREvent[]): Promise<void> {
  const report = await getReport(reportId)
  if (!report) {
    throw new Error(`Report not found: ${reportId}`)
  }

  report.events = events
  await saveReport(report)
}

export async function updateFAQs(reportId: string, faqs: FAQItem[]): Promise<void> {
  const report = await getReport(reportId)
  if (!report) {
    throw new Error(`Report not found: ${reportId}`)
  }

  report.faqs = faqs
  await saveReport(report)
}

export async function generateSectionContent(
  request: AIGenerationRequest
): Promise<AIGenerationResult> {
  await new Promise((resolve) => setTimeout(resolve, 500))

  const templates: Record<string, { ja: string; en: string }> = {
    company_overview: {
      ja: '## 会社概要\n\n当社は〇〇年に設立され、主に〇〇事業を展開しております...',
      en: '## Company Overview\n\nOur company was established in 〇〇 and primarily operates in the 〇〇 business...',
    },
    message_from_ceo: {
      ja: '## CEOメッセージ\n\n株主の皆様へ\n\n本決算期における当社の業績について...',
      en: '## CEO Message\n\nDear Shareholders,\n\nRegarding our performance for this fiscal period...',
    },
    business_overview: {
      ja: '## 事業概要\n\n当社は以下の事業セグメントで構成されています...',
      en: '## Business Overview\n\nOur company consists of the following business segments...',
    },
    financial_highlights: {
      ja: '## 財務ハイライト\n\n今期の主要な財務指標は以下の通りです...',
      en: '## Financial Highlights\n\nKey financial indicators for this period are as follows...',
    },
    risk_factors: {
      ja: '## リスク要因\n\n投資家の皆様にご理解いただきたい主なリスク要因...',
      en: '## Risk Factors\n\nMain risk factors that investors should be aware of...',
    },
    corporate_governance: {
      ja: '## コーポレートガバナンス\n\n当社は適切な企業統治体制の構築に努めております...',
      en: '## Corporate Governance\n\nWe are committed to establishing appropriate corporate governance...',
    },
    sustainability: {
      ja: '## サステナビリティ\n\n当社は持続可能な社会の実現に向けた取り組みを推進しております...',
      en: '## Sustainability\n\nWe are promoting initiatives toward a sustainable society...',
    },
    outlook: {
      ja: '## 今後の見通し\n\n次期の見通しについて以下の通りご報告いたします...',
      en: '## Outlook\n\nWe report on our outlook for the next period as follows...',
    },
  }

  const template = templates[request.sectionType] || {
    ja: '## セクション内容\n\nAI生成されたコンテンツがここに表示されます。',
    en: '## Section Content\n\nAI-generated content will be displayed here.',
  }

  return {
    success: true,
    content: template,
    tokensUsed: 150,
  }
}

export const irReportService = {
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
}
