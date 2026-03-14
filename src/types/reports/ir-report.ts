export type ReportStatus = 'draft' | 'in_review' | 'approved' | 'published' | 'archived'

export type Language = 'ja' | 'en' | 'bilingual'

export type ReportSectionType =
  | 'company_overview'
  | 'message_from_ceo'
  | 'business_overview'
  | 'financial_highlights'
  | 'financial_statements'
  | 'risk_factors'
  | 'corporate_governance'
  | 'shareholder_information'
  | 'sustainability'
  | 'outlook'
  | 'faq'

export interface IRReportSection {
  id: string
  type: ReportSectionType
  title: {
    ja: string
    en: string
  }
  content: {
    ja: string
    en: string
  }
  order: number
  metadata?: Record<string, unknown>
}

export interface FinancialHighlight {
  fiscalYear: string
  revenue: number
  operatingProfit: number
  ordinaryProfit: number
  netIncome: number
  eps: number
  bps: number
  roe: number
  roa: number
}

export interface ShareholderData {
  category: string
  percentage: number
  count?: number
}

export interface IREvent {
  id: string
  title: string
  date: string
  type: 'earnings' | 'presentation' | 'meeting' | 'dividend' | 'other'
  description?: string
}

export interface FAQItem {
  id: string
  question: {
    ja: string
    en: string
  }
  answer: {
    ja: string
    en: string
  }
  order: number
  category?: string
}

export interface IRReport {
  id: string
  companyId: string
  title: {
    ja: string
    en: string
  }
  fiscalYear: string
  status: ReportStatus
  language: Language
  sections: IRReportSection[]
  financialHighlights: FinancialHighlight[]
  shareholderComposition: ShareholderData[]
  events: IREvent[]
  faqs: FAQItem[]
  metadata: {
    createdAt: string
    updatedAt: string
    publishedAt?: string
    createdBy: string
    lastModifiedBy: string
    version: number
  }
}

export interface IRReportListFilter {
  status?: ReportStatus
  fiscalYear?: string
  language?: Language
  search?: string
}

export interface IRReportListResponse {
  reports: IRReport[]
  total: number
  page: number
  pageSize: number
}

export interface AIGenerationRequest {
  sectionType: ReportSectionType
  context: {
    companyId: string
    fiscalYear: string
    financialData?: Record<string, unknown>
    previousContent?: string
  }
  language: Language
}

export interface AIGenerationResult {
  success: boolean
  content?: {
    ja: string
    en: string
  }
  error?: string
  tokensUsed?: number
}
