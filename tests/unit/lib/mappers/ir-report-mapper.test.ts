import { describe, it, expect } from 'vitest'

import {
  mapSectionToUI,
  mapEventToUI,
  mapShareholderToUI,
  mapFAQToUI,
  mapReportToUI,
} from '@/lib/mappers/ir-report-mapper'
import type {
  IRReport,
  IRReportSection,
  IREvent,
  ShareholderComposition,
  FAQ,
} from '@/types/ir-report'

const baseSection: IRReportSection = {
  id: 'sec-1',
  reportId: 'rep-1',
  sectionType: 'overview',
  title: '会社概要',
  titleEn: 'Company Overview',
  content: '内容です',
  contentEn: 'Content',
  data: { metric: 42 },
  sortOrder: 3,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-02T00:00:00.000Z'),
}

const baseEvent: IREvent = {
  id: 'evt-1',
  companyId: 'comp-1',
  eventType: 'earnings_release',
  title: '決算説明会',
  scheduledDate: new Date('2024-06-15T09:00:00.000Z'),
  status: 'scheduled',
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-02T00:00:00.000Z'),
}

const baseShareholder: ShareholderComposition = {
  id: 'sh-1',
  companyId: 'comp-1',
  asOfDate: new Date('2024-03-31T00:00:00.000Z'),
  shareholderType: 'FINANCIAL_INSTITUTION',
  sharesHeld: 1234.6,
  percentage: 45.5,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
}

const baseFAQ: FAQ = {
  id: 'faq-1',
  companyId: 'comp-1',
  question: '質問',
  answer: '回答',
  category: 'general',
  sortOrder: 2,
  isActive: true,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-02T00:00:00.000Z'),
}

const baseReport: IRReport = {
  id: 'rep-1',
  companyId: 'comp-1',
  reportType: 'annual',
  fiscalYear: 2024,
  title: '年次報告',
  titleEn: 'Annual Report',
  status: 'REVIEW',
  language: 'ja',
  sections: [],
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-02T00:00:00.000Z'),
}

describe('mapSectionToUI', () => {
  it('should map a known section type to its UI type and carry order and metadata', () => {
    const result = mapSectionToUI(baseSection)
    expect(result).toEqual({
      id: 'sec-1',
      type: 'company_overview',
      title: { ja: '会社概要', en: 'Company Overview' },
      content: { ja: '内容です', en: 'Content' },
      order: 3,
      metadata: { metric: 42 },
    })
  })

  it('should fall back to the Japanese title/content when the English one is absent', () => {
    const result = mapSectionToUI({
      ...baseSection,
      titleEn: undefined,
      contentEn: undefined,
    })
    expect(result.title.en).toBe('会社概要')
    expect(result.content.en).toBe('内容です')
  })

  it('should default to company_overview for an unmapped section type', () => {
    const result = mapSectionToUI({
      ...baseSection,
      sectionType: 'not_a_real_type' as unknown as IRReportSection['sectionType'],
    })
    expect(result.type).toBe('company_overview')
  })

  it('should map each known section type to the expected UI type', () => {
    const cases: Array<[IRReportSection['sectionType'], string]> = [
      ['risk_factors', 'risk_factors'],
      ['governance', 'corporate_governance'],
      ['future_outlook', 'outlook'],
      ['custom', 'faq'],
    ]
    for (const [sectionType, expected] of cases) {
      expect(mapSectionToUI({ ...baseSection, sectionType }).type).toBe(expected)
    }
  })
})

describe('mapEventToUI', () => {
  it('should convert a Date scheduled date to an ISO string and map the type', () => {
    const result = mapEventToUI(baseEvent)
    expect(result).toEqual({
      id: 'evt-1',
      title: '決算説明会',
      date: '2024-06-15T09:00:00.000Z',
      type: 'earnings',
      description: undefined,
    })
  })

  it('should coerce a non-Date scheduled date with String()', () => {
    const result = mapEventToUI({
      ...baseEvent,
      scheduledDate: '2024-06-15' as unknown as Date,
    })
    expect(result.date).toBe('2024-06-15')
  })

  it('should keep a present description', () => {
    const result = mapEventToUI({ ...baseEvent, description: '詳細' })
    expect(result.description).toBe('詳細')
  })

  it('should map each known event type to the expected UI type', () => {
    const cases: Array<[IREvent['eventType'], string]> = [
      ['briefing', 'presentation'],
      ['agm', 'meeting'],
      ['dividend', 'dividend'],
    ]
    for (const [eventType, expected] of cases) {
      expect(mapEventToUI({ ...baseEvent, eventType }).type).toBe(expected)
    }
  })

  it('should default to other for an unmapped event type', () => {
    const result = mapEventToUI({
      ...baseEvent,
      eventType: 'unknown' as unknown as IREvent['eventType'],
    })
    expect(result.type).toBe('other')
  })
})

describe('mapShareholderToUI', () => {
  it('should round the share count and pass the category and percentage through', () => {
    const result = mapShareholderToUI(baseShareholder)
    expect(result).toEqual({
      category: 'FINANCIAL_INSTITUTION',
      percentage: 45.5,
      count: 1235,
    })
  })

  it('should omit the count when shares held is zero', () => {
    const result = mapShareholderToUI({ ...baseShareholder, sharesHeld: 0 })
    expect(result.count).toBeUndefined()
  })

  it('should omit the count when shares held is negative', () => {
    const result = mapShareholderToUI({ ...baseShareholder, sharesHeld: -10 })
    expect(result.count).toBeUndefined()
  })
})

describe('mapFAQToUI', () => {
  it('should mirror the question/answer in both languages and keep order and category', () => {
    const result = mapFAQToUI(baseFAQ)
    expect(result).toEqual({
      id: 'faq-1',
      question: { ja: '質問', en: '質問' },
      answer: { ja: '回答', en: '回答' },
      order: 2,
      category: 'general',
    })
  })

  it('should set category to undefined when absent', () => {
    const result = mapFAQToUI({ ...baseFAQ, category: undefined })
    expect(result.category).toBeUndefined()
  })
})

describe('mapReportToUI', () => {
  it('should compose the full UI report, mapping status, title, fiscal year and collections', () => {
    const result = mapReportToUI(
      baseReport,
      [baseSection],
      [baseEvent],
      [baseShareholder],
      [baseFAQ]
    )

    expect(result.id).toBe('rep-1')
    expect(result.companyId).toBe('comp-1')
    expect(result.title).toEqual({ ja: '年次報告', en: 'Annual Report' })
    expect(result.fiscalYear).toBe('2024')
    expect(result.status).toBe('in_review')
    expect(result.language).toBe('ja')
    expect(result.financialHighlights).toEqual([])

    expect(result.sections).toHaveLength(1)
    expect(result.sections[0].type).toBe('company_overview')
    expect(result.events).toHaveLength(1)
    expect(result.events[0].type).toBe('earnings')
    expect(result.shareholderComposition).toHaveLength(1)
    expect(result.shareholderComposition[0].count).toBe(1235)
    expect(result.faqs).toHaveLength(1)
    expect(result.faqs[0].category).toBe('general')

    expect(result.metadata).toEqual({
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z',
      publishedAt: undefined,
      createdBy: 'system',
      lastModifiedBy: 'system',
      version: 1,
    })
  })

  it('should fall back to the Japanese title when the English title is absent', () => {
    const result = mapReportToUI({ ...baseReport, titleEn: undefined }, [], [], [], [])
    expect(result.title.en).toBe('年次報告')
  })

  it('should use the publishedBy user and publishedAt ISO string when published', () => {
    const result = mapReportToUI(
      {
        ...baseReport,
        publishedBy: 'user-1',
        publishedAt: new Date('2024-02-01T00:00:00.000Z'),
        status: 'PUBLISHED',
      },
      [],
      [],
      [],
      []
    )
    expect(result.status).toBe('published')
    expect(result.metadata.publishedAt).toBe('2024-02-01T00:00:00.000Z')
    expect(result.metadata.createdBy).toBe('user-1')
    expect(result.metadata.lastModifiedBy).toBe('user-1')
  })

  it('should default to draft for an unmapped status', () => {
    const result = mapReportToUI(
      { ...baseReport, status: 'UNKNOWN' as unknown as IRReport['status'] },
      [],
      [],
      [],
      []
    )
    expect(result.status).toBe('draft')
  })

  it('should coerce a non-Date createdAt with String()', () => {
    const result = mapReportToUI(
      { ...baseReport, createdAt: '2024-01-01T00:00:00.000Z' as unknown as Date },
      [],
      [],
      [],
      []
    )
    expect(result.metadata.createdAt).toBe('2024-01-01T00:00:00.000Z')
  })
})
