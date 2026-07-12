import { describe, it, expect } from 'vitest'
import {
  IR_REPORT_TYPES,
  IR_REPORT_STATUSES,
  IR_SECTION_TYPES,
  IR_REPORT_LANGUAGES,
  IR_EVENT_TYPES,
  IR_EVENT_STATUSES,
  isValidIRReportType,
  isValidIRReportStatus,
  isValidIRSectionType,
  isValidIRReportLanguage,
  isValidIREventType,
  isValidIREventStatus,
} from '@/types/ir-report'
import type {
  IRReportType,
  IRReportStatus,
  IRSectionType,
  IRReportLanguage,
  IREventType,
  IREventStatus,
  ShareholderCategory,
  LocalizedText,
  IRReportSection,
  IRReport,
  IRReportList,
  IRReportFilters,
  ShareholderData,
  ShareholderComposition,
  CreateShareholderData,
  UpdateShareholderData,
  ShareholderDataFilters,
  IREvent,
  IREventList,
  IREventFilters,
  IRReportCreateInput,
  IRReportUpdateInput,
  IRReportSectionCreateInput,
  IRReportSectionUpdateInput,
  ReorderSectionsData,
  ShareholderDataCreateInput,
  ShareholderDataUpdateInput,
  IREventCreateInput,
  IREventUpdateInput,
  FAQ,
  FAQList,
  CreateFAQData,
  UpdateFAQData,
  ReorderFAQsData,
  IRReportServiceError,
  IRReportResult,
  IRReportListResult,
  IRReportSectionResult,
  ShareholderDataResult,
  ShareholderDataListResult,
  IREventResult,
  IREventListResult,
  CreateIRReportData,
  UpdateIRReportData,
  CreateIREventData,
  UpdateIREventData,
} from '@/types/ir-report'
import { success, failure } from '@/types/result'

const CREATED = new Date('2024-01-15T00:00:00.000Z')
const UPDATED = new Date('2024-02-20T00:00:00.000Z')
const PUBLISHED = new Date('2024-03-31T00:00:00.000Z')
const AS_OF = new Date('2024-03-31T00:00:00.000Z')
const SCHEDULED = new Date('2024-06-28T00:00:00.000Z')

describe('ir-report types', () => {
  describe('constant registries', () => {
    it('IR_REPORT_TYPES lists exactly the four report types in source order', () => {
      expect(IR_REPORT_TYPES).toHaveLength(4)
      expect([...IR_REPORT_TYPES]).toEqual([
        'annual',
        'quarterly',
        'earnings_call',
        'sustainability',
      ])
      expectTypeOf(IR_REPORT_TYPES).toMatchTypeOf<readonly IRReportType[]>()
    })

    it('IR_REPORT_STATUSES lists exactly the four statuses', () => {
      expect(IR_REPORT_STATUSES).toHaveLength(4)
      expect([...IR_REPORT_STATUSES]).toEqual(['DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED'])
      expectTypeOf(IR_REPORT_STATUSES).toMatchTypeOf<readonly IRReportStatus[]>()
    })

    it('IR_SECTION_TYPES lists exactly the ten section types', () => {
      expect(IR_SECTION_TYPES).toHaveLength(10)
      expect([...IR_SECTION_TYPES]).toEqual([
        'overview',
        'business_summary',
        'financial_summary',
        'segment_info',
        'risk_factors',
        'governance',
        'shareholder_info',
        'dividend_policy',
        'future_outlook',
        'custom',
      ])
      expectTypeOf(IR_SECTION_TYPES).toMatchTypeOf<readonly IRSectionType[]>()
    })

    it('IR_REPORT_LANGUAGES lists exactly the three languages', () => {
      expect(IR_REPORT_LANGUAGES).toHaveLength(3)
      expect([...IR_REPORT_LANGUAGES]).toEqual(['ja', 'en', 'bilingual'])
      expectTypeOf(IR_REPORT_LANGUAGES).toMatchTypeOf<readonly IRReportLanguage[]>()
    })

    it('IR_EVENT_TYPES lists exactly the four event types', () => {
      expect(IR_EVENT_TYPES).toHaveLength(4)
      expect([...IR_EVENT_TYPES]).toEqual(['earnings_release', 'briefing', 'dividend', 'agm'])
      expectTypeOf(IR_EVENT_TYPES).toMatchTypeOf<readonly IREventType[]>()
    })

    it('IR_EVENT_STATUSES lists exactly the three event statuses', () => {
      expect(IR_EVENT_STATUSES).toHaveLength(3)
      expect([...IR_EVENT_STATUSES]).toEqual(['scheduled', 'completed', 'cancelled'])
      expectTypeOf(IR_EVENT_STATUSES).toMatchTypeOf<readonly IREventStatus[]>()
    })
  })

  describe('isValidIRReportType', () => {
    it('accepts every registered report type', () => {
      for (const value of IR_REPORT_TYPES) {
        expect(isValidIRReportType(value)).toBe(true)
      }
    })

    it('rejects unknown, empty, and case-variant values', () => {
      expect(isValidIRReportType('semi_annual')).toBe(false)
      expect(isValidIRReportType('')).toBe(false)
      expect(isValidIRReportType('ANNUAL')).toBe(false)
      expect(isValidIRReportType('Annual')).toBe(false)
      expect(isValidIRReportType(' annual ')).toBe(false)
    })

    it('does not accept values from sibling registries', () => {
      expect(isValidIRReportType('DRAFT')).toBe(false)
      expect(isValidIRReportType('agm')).toBe(false)
    })

    it('narrows string to IRReportType', () => {
      const value: string = 'annual'
      if (isValidIRReportType(value)) {
        expectTypeOf(value).toEqualTypeOf<IRReportType>()
        expect(value).toBe('annual')
      }
    })
  })

  describe('isValidIRReportStatus', () => {
    it('accepts every registered status', () => {
      for (const value of IR_REPORT_STATUSES) {
        expect(isValidIRReportStatus(value)).toBe(true)
      }
    })

    it('rejects unknown, empty, and case-variant values', () => {
      expect(isValidIRReportStatus('PENDING')).toBe(false)
      expect(isValidIRReportStatus('')).toBe(false)
      expect(isValidIRReportStatus('draft')).toBe(false)
      expect(isValidIRReportStatus('Draft')).toBe(false)
    })

    it('does not accept values from sibling registries', () => {
      expect(isValidIRReportStatus('annual')).toBe(false)
      expect(isValidIRReportStatus('cancelled')).toBe(false)
    })

    it('narrows string to IRReportStatus', () => {
      const value: string = 'PUBLISHED'
      if (isValidIRReportStatus(value)) {
        expectTypeOf(value).toEqualTypeOf<IRReportStatus>()
        expect(value).toBe('PUBLISHED')
      }
    })
  })

  describe('isValidIRSectionType', () => {
    it('accepts every registered section type', () => {
      for (const value of IR_SECTION_TYPES) {
        expect(isValidIRSectionType(value)).toBe(true)
      }
    })

    it('rejects unknown, empty, and case-variant values', () => {
      expect(isValidIRSectionType('executive_summary')).toBe(false)
      expect(isValidIRSectionType('')).toBe(false)
      expect(isValidIRSectionType('Overview')).toBe(false)
      expect(isValidIRSectionType('CUSTOM')).toBe(false)
    })

    it('narrows string to IRSectionType', () => {
      const value: string = 'risk_factors'
      if (isValidIRSectionType(value)) {
        expectTypeOf(value).toEqualTypeOf<IRSectionType>()
      }
    })
  })

  describe('isValidIRReportLanguage', () => {
    it('accepts every registered language', () => {
      for (const value of IR_REPORT_LANGUAGES) {
        expect(isValidIRReportLanguage(value)).toBe(true)
      }
    })

    it('rejects unknown, empty, and case-variant values', () => {
      expect(isValidIRReportLanguage('fr')).toBe(false)
      expect(isValidIRReportLanguage('')).toBe(false)
      expect(isValidIRReportLanguage('JA')).toBe(false)
      expect(isValidIRReportLanguage('English')).toBe(false)
    })

    it('narrows string to IRReportLanguage', () => {
      const value: string = 'bilingual'
      if (isValidIRReportLanguage(value)) {
        expectTypeOf(value).toEqualTypeOf<IRReportLanguage>()
      }
    })
  })

  describe('isValidIREventType', () => {
    it('accepts every registered event type', () => {
      for (const value of IR_EVENT_TYPES) {
        expect(isValidIREventType(value)).toBe(true)
      }
    })

    it('rejects unknown, empty, and case-variant values', () => {
      expect(isValidIREventType('conference')).toBe(false)
      expect(isValidIREventType('')).toBe(false)
      expect(isValidIREventType('AGM')).toBe(false)
      expect(isValidIREventType('Earnings_Release')).toBe(false)
    })

    it('narrows string to IREventType', () => {
      const value: string = 'dividend'
      if (isValidIREventType(value)) {
        expectTypeOf(value).toEqualTypeOf<IREventType>()
      }
    })
  })

  describe('isValidIREventStatus', () => {
    it('accepts every registered event status', () => {
      for (const value of IR_EVENT_STATUSES) {
        expect(isValidIREventStatus(value)).toBe(true)
      }
    })

    it('rejects unknown, empty, and case-variant values', () => {
      expect(isValidIREventStatus('postponed')).toBe(false)
      expect(isValidIREventStatus('')).toBe(false)
      expect(isValidIREventStatus('Completed')).toBe(false)
      expect(isValidIREventStatus('CANCELLED')).toBe(false)
    })

    it('narrows string to IREventStatus', () => {
      const value: string = 'scheduled'
      if (isValidIREventStatus(value)) {
        expectTypeOf(value).toEqualTypeOf<IREventStatus>()
      }
    })
  })

  describe('LocalizedText', () => {
    it('carries the required Japanese text and optional English', () => {
      const text: LocalizedText = { ja: '決算短信', en: 'Earnings Report' }
      expect(text.ja).toBe('決算短信')
      expect(text.en).toBe('Earnings Report')
    })

    it('allows English to be omitted', () => {
      const text: LocalizedText = { ja: '決算短信' }
      expect(text.en).toBeUndefined()
      expectTypeOf<LocalizedText>().toHaveProperty('ja')
    })
  })

  describe('IRReportSection', () => {
    const section: IRReportSection = {
      id: 'sec-1',
      reportId: 'rep-1',
      sectionType: 'financial_summary',
      title: '業績ハイライト',
      titleEn: 'Financial Highlights',
      content: '売上高は前年同期比 12% 増',
      contentEn: 'Revenue grew 12% YoY',
      data: { revenue: 1000, growth: 0.12 },
      sortOrder: 1,
      createdAt: CREATED,
      updatedAt: UPDATED,
    }

    it('exposes the required identity and ordering fields', () => {
      expect(section.id).toBe('sec-1')
      expect(section.reportId).toBe('rep-1')
      expect(section.sectionType).toBe('financial_summary')
      expect(section.sortOrder).toBe(1)
      expect(section.createdAt).toBe(CREATED)
      expect(section.updatedAt).toBe(UPDATED)
    })

    it('holds arbitrary structured data', () => {
      expect(section.data).toEqual({ revenue: 1000, growth: 0.12 })
    })

    it('can be constructed with only required fields', () => {
      const minimal: IRReportSection = {
        id: 'sec-2',
        reportId: 'rep-1',
        sectionType: 'overview',
        title: '概要',
        content: '本レポートの概要',
        sortOrder: 0,
        createdAt: CREATED,
        updatedAt: UPDATED,
      }
      expect(minimal.titleEn).toBeUndefined()
      expect(minimal.data).toBeUndefined()
    })
  })

  describe('IRReport', () => {
    const report: IRReport = {
      id: 'rep-1',
      companyId: 'co-1',
      reportType: 'quarterly',
      fiscalYear: 2024,
      quarter: 1,
      title: '第1四半期決算',
      titleEn: 'Q1 Results',
      summary: '好調なスタート',
      summaryEn: 'Strong start',
      sections: [],
      status: 'PUBLISHED',
      language: 'bilingual',
      publishedAt: PUBLISHED,
      publishedBy: 'user-1',
      createdAt: CREATED,
      updatedAt: UPDATED,
    }

    it('exposes core identifiers and lifecycle', () => {
      expect(report.id).toBe('rep-1')
      expect(report.companyId).toBe('co-1')
      expect(report.reportType).toBe('quarterly')
      expect(report.fiscalYear).toBe(2024)
      expect(report.quarter).toBe(1)
      expect(report.status).toBe('PUBLISHED')
      expect(report.language).toBe('bilingual')
    })

    it('tracks publication metadata', () => {
      expect(report.publishedAt).toBe(PUBLISHED)
      expect(report.publishedBy).toBe('user-1')
    })

    it('can be a draft with no publication or localization fields', () => {
      const draft: IRReport = {
        id: 'rep-2',
        companyId: 'co-1',
        reportType: 'annual',
        fiscalYear: 2024,
        title: '年次報告',
        sections: [],
        status: 'DRAFT',
        language: 'ja',
        createdAt: CREATED,
        updatedAt: UPDATED,
      }
      expect(draft.quarter).toBeUndefined()
      expect(draft.publishedAt).toBeUndefined()
      expect(draft.publishedBy).toBeUndefined()
      expect(draft.titleEn).toBeUndefined()
    })
  })

  describe('IRReportList', () => {
    it('is the list projection of a report without sections/content', () => {
      const item: IRReportList = {
        id: 'rep-1',
        companyId: 'co-1',
        reportType: 'annual',
        fiscalYear: 2024,
        title: '年次報告',
        status: 'PUBLISHED',
        publishedAt: PUBLISHED,
        createdAt: CREATED,
        updatedAt: UPDATED,
      }
      expect(item.status).toBe('PUBLISHED')
      expectTypeOf<IRReportList>().not.toMatchTypeOf<{ sections: unknown }>()
    })

    it('supports quarterly entries with optional publication', () => {
      const item: IRReportList = {
        id: 'rep-3',
        companyId: 'co-1',
        reportType: 'quarterly',
        fiscalYear: 2024,
        quarter: 2,
        title: '第2四半期',
        status: 'DRAFT',
        createdAt: CREATED,
        updatedAt: UPDATED,
      }
      expect(item.quarter).toBe(2)
      expect(item.publishedAt).toBeUndefined()
    })
  })

  describe('IRReportFilters', () => {
    it('can express a full filter set', () => {
      const filters: IRReportFilters = {
        reportType: 'quarterly',
        fiscalYear: 2024,
        quarter: 1,
        status: 'PUBLISHED',
        language: 'ja',
        search: '決算',
      }
      expect(filters.reportType).toBe('quarterly')
      expect(filters.search).toBe('決算')
    })

    it('can be an empty object (match-all)', () => {
      const filters: IRReportFilters = {}
      expect(Object.keys(filters)).toHaveLength(0)
    })
  })

  describe('ShareholderData', () => {
    const holder: ShareholderData = {
      id: 'sh-1',
      companyId: 'co-1',
      asOfDate: AS_OF,
      shareholderType: 'INDIVIDUAL',
      shareholderName: '山田太郎',
      sharesHeld: 1000,
      percentage: 12.5,
      createdAt: CREATED,
    }

    it('exposes holding quantity and ratio', () => {
      expect(holder.sharesHeld).toBe(1000)
      expect(holder.percentage).toBe(12.5)
      expect(holder.asOfDate).toBe(AS_OF)
    })

    it('allows an anonymous holding (no name)', () => {
      const anonymous: ShareholderData = {
        id: 'sh-2',
        companyId: 'co-1',
        asOfDate: AS_OF,
        shareholderType: 'FOREIGN_INVESTOR',
        sharesHeld: 500,
        percentage: 6.25,
        createdAt: CREATED,
      }
      expect(anonymous.shareholderName).toBeUndefined()
    })

    it('supports zero and boundary percentages', () => {
      const treasury: ShareholderData = {
        id: 'sh-3',
        companyId: 'co-1',
        asOfDate: AS_OF,
        shareholderType: 'TREASURY_STOCK',
        sharesHeld: 0,
        percentage: 0,
        createdAt: CREATED,
      }
      expect(treasury.sharesHeld).toBe(0)
      expect(treasury.percentage).toBe(0)
    })
  })

  describe('ShareholderComposition & CreateShareholderData & UpdateShareholderData', () => {
    it('ShareholderComposition mirrors ShareholderData shape', () => {
      const composition: ShareholderComposition = {
        id: 'sh-1',
        companyId: 'co-1',
        asOfDate: AS_OF,
        shareholderType: 'FINANCIAL_INSTITUTION',
        sharesHeld: 2000,
        percentage: 25,
        createdAt: CREATED,
      }
      expect(composition.shareholderType).toBe('FINANCIAL_INSTITUTION')
      expectTypeOf<ShareholderComposition>().toEqualTypeOf<ShareholderData>()
    })

    it('CreateShareholderData omits id and createdAt', () => {
      const create: CreateShareholderData = {
        companyId: 'co-1',
        asOfDate: AS_OF,
        shareholderType: 'INDIVIDUAL',
        sharesHeld: 100,
        percentage: 1.5,
      }
      expect(create.companyId).toBe('co-1')
      expectTypeOf<CreateShareholderData>().toEqualTypeOf<
        Omit<ShareholderComposition, 'id' | 'createdAt'>
      >()
      expectTypeOf<CreateShareholderData>().not.toHaveProperty('id')
      expectTypeOf<CreateShareholderData>().not.toHaveProperty('createdAt')
    })

    it('UpdateShareholderData is a partial that still permits asOfDate', () => {
      const update: UpdateShareholderData = { sharesHeld: 150, percentage: 2.0 }
      const withDate: UpdateShareholderData = { asOfDate: AS_OF }
      expect(update.sharesHeld).toBe(150)
      expect(withDate.asOfDate).toBe(AS_OF)
      expectTypeOf<UpdateShareholderData>().toEqualTypeOf<
        Partial<Omit<ShareholderComposition, 'id' | 'companyId' | 'createdAt'>>
      >()
      expectTypeOf<UpdateShareholderData>().not.toHaveProperty('id')
      expectTypeOf<UpdateShareholderData>().not.toHaveProperty('companyId')
    })
  })

  describe('ShareholderDataFilters', () => {
    it('filters by as-of date and/or type', () => {
      const filters: ShareholderDataFilters = {
        asOfDate: AS_OF,
        shareholderType: 'INDIVIDUAL',
      }
      expect(filters.shareholderType).toBe('INDIVIDUAL')
    })

    it('can be empty', () => {
      const filters: ShareholderDataFilters = {}
      expect(filters.asOfDate).toBeUndefined()
    })
  })

  describe('ShareholderCategory', () => {
    it('covers all six shareholder categories', () => {
      const categories: ShareholderCategory[] = [
        'FINANCIAL_INSTITUTION',
        'INDIVIDUAL',
        'FOREIGN_INVESTOR',
        'OTHER_CORPORATION',
        'TREASURY_STOCK',
        'OTHER',
      ]
      expect(categories).toHaveLength(6)
      expect(new Set(categories).size).toBe(6)
    })
  })

  describe('IREvent', () => {
    const event: IREvent = {
      id: 'ev-1',
      companyId: 'co-1',
      eventType: 'earnings_release',
      title: '2024年Q1 決算説明会',
      titleEn: 'Q1 2024 Earnings Briefing',
      description: '決算発表と経営陣による説明',
      descriptionEn: 'Earnings announcement',
      scheduledDate: SCHEDULED,
      status: 'scheduled',
      createdAt: CREATED,
      updatedAt: UPDATED,
    }

    it('exposes event scheduling metadata', () => {
      expect(event.eventType).toBe('earnings_release')
      expect(event.scheduledDate).toBe(SCHEDULED)
      expect(event.status).toBe('scheduled')
    })

    it('can be constructed with required fields only', () => {
      const minimal: IREvent = {
        id: 'ev-2',
        companyId: 'co-1',
        eventType: 'agm',
        title: '定時株主総会',
        scheduledDate: SCHEDULED,
        status: 'completed',
        createdAt: CREATED,
        updatedAt: UPDATED,
      }
      expect(minimal.description).toBeUndefined()
      expect(minimal.titleEn).toBeUndefined()
    })
  })

  describe('IREventList', () => {
    it('is the list projection of an event', () => {
      const item: IREventList = {
        id: 'ev-1',
        companyId: 'co-1',
        eventType: 'dividend',
        title: '配当支払',
        scheduledDate: SCHEDULED,
        status: 'completed',
      }
      expect(item.eventType).toBe('dividend')
      expectTypeOf<IREventList>().not.toMatchTypeOf<{ description: unknown }>()
    })
  })

  describe('IREventFilters', () => {
    it('filters by event type, status, and date range', () => {
      const filters: IREventFilters = {
        eventType: 'briefing',
        status: 'scheduled',
        startDate: CREATED,
        endDate: SCHEDULED,
      }
      expect(filters.eventType).toBe('briefing')
      expect(filters.endDate).toBe(SCHEDULED)
    })

    it('can be empty', () => {
      const filters: IREventFilters = {}
      expect(filters.status).toBeUndefined()
    })
  })

  describe('IR report input DTOs', () => {
    it('IRReportCreateInput requires identity and core fields', () => {
      const input: IRReportCreateInput = {
        companyId: 'co-1',
        reportType: 'annual',
        fiscalYear: 2024,
        title: '年次報告',
      }
      expect(input.language).toBeUndefined()
      expectTypeOf<IRReportCreateInput>().not.toHaveProperty('id')
    })

    it('IRReportUpdateInput is fully optional', () => {
      const update: IRReportUpdateInput = { status: 'ARCHIVED' }
      expect(update.status).toBe('ARCHIVED')
      const empty: IRReportUpdateInput = {}
      expect(Object.keys(empty)).toHaveLength(0)
    })

    it('IRReportSectionCreateInput requires content and ordering', () => {
      const input: IRReportSectionCreateInput = {
        reportId: 'rep-1',
        sectionType: 'governance',
        title: 'コーポレートガバナンス',
        content: 'ガバナンス体制の概要',
        sortOrder: 3,
      }
      expect(input.sortOrder).toBe(3)
      expectTypeOf<IRReportSectionCreateInput>().not.toHaveProperty('id')
    })

    it('IRReportSectionUpdateInput is fully optional', () => {
      const update: IRReportSectionUpdateInput = { sortOrder: 5 }
      expect(update.sortOrder).toBe(5)
    })

    it('ReorderSectionsData carries an ordered id list', () => {
      const data: ReorderSectionsData = { sectionIds: ['sec-3', 'sec-1', 'sec-2'] }
      expect(data.sectionIds).toEqual(['sec-3', 'sec-1', 'sec-2'])
      expectTypeOf<ReorderSectionsData>().toHaveProperty('sectionIds')
    })

    it('CreateIRReportData / UpdateIRReportData are aliases of the input DTOs', () => {
      expectTypeOf<CreateIRReportData>().toEqualTypeOf<IRReportCreateInput>()
      expectTypeOf<UpdateIRReportData>().toEqualTypeOf<IRReportUpdateInput>()
    })
  })

  describe('Shareholder data input DTOs', () => {
    it('ShareholderDataCreateInput requires the holding payload', () => {
      const input: ShareholderDataCreateInput = {
        companyId: 'co-1',
        asOfDate: AS_OF,
        shareholderType: 'INDIVIDUAL',
        sharesHeld: 100,
        percentage: 1.5,
      }
      expect(input.percentage).toBe(1.5)
      expectTypeOf<ShareholderDataCreateInput>().not.toHaveProperty('id')
    })

    it('ShareholderDataUpdateInput is fully optional and excludes asOfDate', () => {
      const update: ShareholderDataUpdateInput = { sharesHeld: 200 }
      expect(update.sharesHeld).toBe(200)
      expectTypeOf<ShareholderDataUpdateInput>().not.toHaveProperty('id')
      expectTypeOf<ShareholderDataUpdateInput>().not.toHaveProperty('asOfDate')
    })
  })

  describe('IR event input DTOs', () => {
    it('IREventCreateInput requires scheduling identity', () => {
      const input: IREventCreateInput = {
        companyId: 'co-1',
        eventType: 'agm',
        title: '定時株主総会',
        scheduledDate: SCHEDULED,
      }
      expect(input.eventType).toBe('agm')
      expectTypeOf<IREventCreateInput>().not.toHaveProperty('id')
    })

    it('IREventUpdateInput is fully optional', () => {
      const update: IREventUpdateInput = { status: 'cancelled' }
      expect(update.status).toBe('cancelled')
    })

    it('CreateIREventData / UpdateIREventData are aliases of the input DTOs', () => {
      expectTypeOf<CreateIREventData>().toEqualTypeOf<IREventCreateInput>()
      expectTypeOf<UpdateIREventData>().toEqualTypeOf<IREventUpdateInput>()
    })
  })

  describe('FAQ DTOs', () => {
    it('FAQ carries question/answer with ordering and lifecycle', () => {
      const faq: FAQ = {
        id: 'faq-1',
        companyId: 'co-1',
        question: '配当政策は?',
        answer: '安定配当を維持します。',
        category: '配当',
        sortOrder: 1,
        isActive: true,
        createdAt: CREATED,
        updatedAt: UPDATED,
      }
      expect(faq.isActive).toBe(true)
      expect(faq.sortOrder).toBe(1)
    })

    it('FAQ can be inactive and uncategorized', () => {
      const faq: FAQ = {
        id: 'faq-2',
        companyId: 'co-1',
        question: 'IRのお問い合わせ',
        answer: 'ir@example.com',
        sortOrder: 2,
        isActive: false,
        createdAt: CREATED,
        updatedAt: UPDATED,
      }
      expect(faq.category).toBeUndefined()
      expect(faq.isActive).toBe(false)
    })

    it('FAQList is the list projection without answer/dates', () => {
      const item: FAQList = {
        id: 'faq-1',
        companyId: 'co-1',
        question: '配当政策は?',
        sortOrder: 1,
        isActive: true,
      }
      expect(item.isActive).toBe(true)
      expectTypeOf<FAQList>().not.toMatchTypeOf<{ answer: unknown }>()
    })

    it('CreateFAQData requires question/answer and omits identity/timestamps', () => {
      const data: CreateFAQData = {
        companyId: 'co-1',
        question: '決算発表日は?',
        answer: '2024年5月10日',
      }
      expect(data.sortOrder).toBeUndefined()
      expectTypeOf<CreateFAQData>().not.toHaveProperty('id')
      expectTypeOf<CreateFAQData>().not.toHaveProperty('isActive')
    })

    it('UpdateFAQData is a partial that can toggle isActive', () => {
      const data: UpdateFAQData = { isActive: false }
      expect(data.isActive).toBe(false)
      const empty: UpdateFAQData = {}
      expect(Object.keys(empty)).toHaveLength(0)
    })

    it('ReorderFAQsData carries an ordered id list', () => {
      const data: ReorderFAQsData = { faqIds: ['faq-2', 'faq-1'] }
      expect(data.faqIds).toEqual(['faq-2', 'faq-1'])
      expectTypeOf<ReorderFAQsData>().toHaveProperty('faqIds')
    })
  })

  describe('IRReportServiceError', () => {
    it('requires code and message', () => {
      const err: IRReportServiceError = { code: 'NOT_FOUND', message: 'Report not found' }
      expect(err.code).toBe('NOT_FOUND')
      expect(err.message).toBe('Report not found')
      expect(err.details).toBeUndefined()
    })

    it('carries optional structured details', () => {
      const err: IRReportServiceError = {
        code: 'VALIDATION_ERROR',
        message: 'Invalid report type',
        details: { field: 'reportType', allowed: [...IR_REPORT_TYPES] },
      }
      expect(err.details?.field).toBe('reportType')
    })
  })

  describe('Result type aliases', () => {
    const report: IRReport = {
      id: 'rep-1',
      companyId: 'co-1',
      reportType: 'annual',
      fiscalYear: 2024,
      title: '年次報告',
      sections: [],
      status: 'PUBLISHED',
      language: 'ja',
      createdAt: CREATED,
      updatedAt: UPDATED,
    }
    const section: IRReportSection = {
      id: 'sec-1',
      reportId: 'rep-1',
      sectionType: 'overview',
      title: '概要',
      content: '概要内容',
      sortOrder: 0,
      createdAt: CREATED,
      updatedAt: UPDATED,
    }
    const event: IREvent = {
      id: 'ev-1',
      companyId: 'co-1',
      eventType: 'agm',
      title: '定時株主総会',
      scheduledDate: SCHEDULED,
      status: 'scheduled',
      createdAt: CREATED,
      updatedAt: UPDATED,
    }
    const shareholder: ShareholderData = {
      id: 'sh-1',
      companyId: 'co-1',
      asOfDate: AS_OF,
      shareholderType: 'INDIVIDUAL',
      sharesHeld: 10,
      percentage: 1,
      createdAt: CREATED,
    }
    const serviceError: IRReportServiceError = { code: 'NOT_FOUND', message: 'missing' }

    it('IRReportResult discriminates success vs service error', () => {
      const ok: IRReportResult = success(report)
      const err: IRReportResult = failure(serviceError)
      expect(ok.success).toBe(true)
      expect(err.success).toBe(false)
      if (ok.success) expect(ok.data.id).toBe('rep-1')
      if (!err.success) expect(err.error.code).toBe('NOT_FOUND')
    })

    it('IRReportListResult wraps a list payload', () => {
      const ok: IRReportListResult = success([
        {
          id: 'rep-1',
          companyId: 'co-1',
          reportType: 'annual',
          fiscalYear: 2024,
          title: '年次報告',
          status: 'PUBLISHED',
          createdAt: CREATED,
          updatedAt: UPDATED,
        },
      ])
      const err: IRReportListResult = failure(serviceError)
      expect(ok.success).toBe(true)
      expect(err.success).toBe(false)
      if (ok.success) expect(ok.data).toHaveLength(1)
    })

    it('IRReportSectionResult wraps a section', () => {
      const ok: IRReportSectionResult = success(section)
      const err: IRReportSectionResult = failure(serviceError)
      expect(ok.success).toBe(true)
      expect(err.success).toBe(false)
      if (ok.success) expect(ok.data.sectionType).toBe('overview')
    })

    it('ShareholderDataResult wraps a single holding', () => {
      const ok: ShareholderDataResult = success(shareholder)
      const err: ShareholderDataResult = failure(serviceError)
      expect(ok.success).toBe(true)
      expect(err.success).toBe(false)
      if (ok.success) expect(ok.data.percentage).toBe(1)
    })

    it('ShareholderDataListResult wraps a list of holdings', () => {
      const ok: ShareholderDataListResult = success([shareholder])
      const err: ShareholderDataListResult = failure(serviceError)
      expect(ok.success).toBe(true)
      expect(err.success).toBe(false)
      if (ok.success) expect(ok.data).toHaveLength(1)
    })

    it('IREventResult wraps a single event', () => {
      const ok: IREventResult = success(event)
      const err: IREventResult = failure(serviceError)
      expect(ok.success).toBe(true)
      expect(err.success).toBe(false)
      if (ok.success) expect(ok.data.eventType).toBe('agm')
    })

    it('IREventListResult wraps a list of events', () => {
      const ok: IREventListResult = success([
        {
          id: 'ev-1',
          companyId: 'co-1',
          eventType: 'agm',
          title: '定時株主総会',
          scheduledDate: SCHEDULED,
          status: 'scheduled',
        },
      ])
      const err: IREventListResult = failure(serviceError)
      expect(ok.success).toBe(true)
      expect(err.success).toBe(false)
      if (ok.success) expect(ok.data).toHaveLength(1)
    })

    it('all result aliases share the same IRReportServiceError failure channel', () => {
      const failures = [
        failure(serviceError) as IRReportResult,
        failure(serviceError) as IRReportListResult,
        failure(serviceError) as IRReportSectionResult,
        failure(serviceError) as ShareholderDataResult,
        failure(serviceError) as ShareholderDataListResult,
        failure(serviceError) as IREventResult,
        failure(serviceError) as IREventListResult,
      ]
      for (const result of failures) {
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.code).toBe('NOT_FOUND')
          expect(result.error.message).toBe('missing')
        }
      }
    })
  })
})
