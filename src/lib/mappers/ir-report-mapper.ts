import type {
  IRReport as PrismaIRReport,
  IRReportSection as PrismaIRReportSection,
  IREvent as PrismaIREvent,
  ShareholderComposition as PrismaShareholderComposition,
  FAQ as PrismaFAQ,
} from '@/types/ir-report'

import type {
  IRReport as UIIRReport,
  IRReportSection as UIIRReportSection,
  IREvent as UIIREvent,
  ShareholderData as UIShareholderData,
  FAQItem as UIFAQItem,
  ReportStatus,
  ReportSectionType,
} from '@/types/reports/ir-report'

const SECTION_TYPE_MAP: Record<string, ReportSectionType> = {
  overview: 'company_overview',
  business_summary: 'business_overview',
  financial_summary: 'financial_highlights',
  segment_info: 'financial_statements',
  risk_factors: 'risk_factors',
  governance: 'corporate_governance',
  shareholder_info: 'shareholder_information',
  dividend_policy: 'outlook',
  future_outlook: 'outlook',
  sustainability: 'sustainability',
  custom: 'faq',
}

const STATUS_MAP: Record<string, ReportStatus> = {
  DRAFT: 'draft',
  REVIEW: 'in_review',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
}

const EVENT_TYPE_MAP: Record<
  string,
  'earnings' | 'presentation' | 'meeting' | 'dividend' | 'other'
> = {
  earnings_release: 'earnings',
  briefing: 'presentation',
  dividend: 'dividend',
  agm: 'meeting',
}

export function mapSectionToUI(section: PrismaIRReportSection): UIIRReportSection {
  return {
    id: section.id,
    type: SECTION_TYPE_MAP[section.sectionType] ?? 'company_overview',
    title: {
      ja: section.title,
      en: section.titleEn ?? section.title,
    },
    content: {
      ja: section.content,
      en: section.contentEn ?? section.content,
    },
    order: section.sortOrder,
    metadata: section.data,
  }
}

export function mapEventToUI(event: PrismaIREvent): UIIREvent {
  return {
    id: event.id,
    title: event.title,
    date:
      event.scheduledDate instanceof Date
        ? event.scheduledDate.toISOString()
        : String(event.scheduledDate),
    type: EVENT_TYPE_MAP[event.eventType] ?? 'other',
    description: event.description ?? undefined,
  }
}

export function mapShareholderToUI(data: PrismaShareholderComposition): UIShareholderData {
  return {
    category: data.shareholderType,
    percentage: data.percentage,
    count: data.sharesHeld > 0 ? Math.round(data.sharesHeld) : undefined,
  }
}

export function mapFAQToUI(faq: PrismaFAQ): UIFAQItem {
  return {
    id: faq.id,
    question: {
      ja: faq.question,
      en: faq.question,
    },
    answer: {
      ja: faq.answer,
      en: faq.answer,
    },
    order: faq.sortOrder,
    category: faq.category ?? undefined,
  }
}

export function mapReportToUI(
  report: PrismaIRReport,
  sections: PrismaIRReportSection[],
  events: PrismaIREvent[],
  shareholders: PrismaShareholderComposition[],
  faqs: PrismaFAQ[]
): UIIRReport {
  return {
    id: report.id,
    companyId: report.companyId,
    title: {
      ja: report.title,
      en: report.titleEn ?? report.title,
    },
    fiscalYear: String(report.fiscalYear),
    status: STATUS_MAP[report.status] ?? 'draft',
    language: report.language,
    sections: sections.map(mapSectionToUI),
    financialHighlights: [],
    shareholderComposition: shareholders.map(mapShareholderToUI),
    events: events.map(mapEventToUI),
    faqs: faqs.map(mapFAQToUI),
    metadata: {
      createdAt:
        report.createdAt instanceof Date
          ? report.createdAt.toISOString()
          : String(report.createdAt),
      updatedAt:
        report.updatedAt instanceof Date
          ? report.updatedAt.toISOString()
          : String(report.updatedAt),
      publishedAt: report.publishedAt
        ? report.publishedAt instanceof Date
          ? report.publishedAt.toISOString()
          : String(report.publishedAt)
        : undefined,
      createdBy: report.publishedBy ?? 'system',
      lastModifiedBy: report.publishedBy ?? 'system',
      version: 1,
    },
  }
}
