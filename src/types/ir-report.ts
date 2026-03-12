import type { Result } from './result'

export type IRReportType = 'annual' | 'quarterly' | 'earnings_call' | 'sustainability'

export type IRReportStatus = 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'ARCHIVED'

export type IRSectionType =
  | 'overview'
  | 'business_summary'
  | 'financial_summary'
  | 'segment_info'
  | 'risk_factors'
  | 'governance'
  | 'shareholder_info'
  | 'dividend_policy'
  | 'future_outlook'
  | 'custom'

export type IRReportLanguage = 'ja' | 'en' | 'bilingual'

export type IREventType = 'earnings_release' | 'briefing' | 'dividend' | 'agm'

export type IREventStatus = 'scheduled' | 'completed' | 'cancelled'

export interface LocalizedText {
  ja: string
  en?: string
}

export interface IRReportSection {
  id: string
  reportId: string
  sectionType: IRSectionType
  title: string
  titleEn?: string
  content: string
  contentEn?: string
  data?: Record<string, unknown>
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}

export interface IRReport {
  id: string
  companyId: string
  reportType: IRReportType
  fiscalYear: number
  quarter?: number
  title: string
  titleEn?: string
  summary?: string
  summaryEn?: string
  sections: IRReportSection[]
  status: IRReportStatus
  language: IRReportLanguage
  publishedAt?: Date
  publishedBy?: string
  createdAt: Date
  updatedAt: Date
}

export interface IRReportList {
  id: string
  companyId: string
  reportType: IRReportType
  fiscalYear: number
  quarter?: number
  title: string
  status: IRReportStatus
  publishedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface IRReportFilters {
  reportType?: IRReportType
  fiscalYear?: number
  quarter?: number
  status?: IRReportStatus
  language?: IRReportLanguage
  search?: string
}

export interface ShareholderData {
  id: string
  companyId: string
  asOfDate: Date
  shareholderType: string
  shareholderName?: string
  sharesHeld: number
  percentage: number
  createdAt: Date
}

export type ShareholderCategory =
  | 'FINANCIAL_INSTITUTION'
  | 'INDIVIDUAL'
  | 'FOREIGN_INVESTOR'
  | 'OTHER_CORPORATION'
  | 'TREASURY_STOCK'
  | 'OTHER'

export interface ShareholderComposition {
  id: string
  companyId: string
  asOfDate: Date
  shareholderType: string
  shareholderName?: string
  sharesHeld: number
  percentage: number
  createdAt: Date
}

export type CreateShareholderData = Omit<ShareholderComposition, 'id' | 'createdAt'>
export type UpdateShareholderData = Partial<
  Omit<ShareholderComposition, 'id' | 'companyId' | 'createdAt'>
>

export interface ShareholderDataFilters {
  asOfDate?: Date
  shareholderType?: string
}

export interface IREvent {
  id: string
  companyId: string
  eventType: IREventType
  title: string
  titleEn?: string
  description?: string
  descriptionEn?: string
  scheduledDate: Date
  status: IREventStatus
  createdAt: Date
  updatedAt: Date
}

export interface IREventList {
  id: string
  companyId: string
  eventType: IREventType
  title: string
  scheduledDate: Date
  status: IREventStatus
}

export interface IREventFilters {
  eventType?: IREventType
  status?: IREventStatus
  startDate?: Date
  endDate?: Date
}

export interface IRReportCreateInput {
  companyId: string
  reportType: IRReportType
  fiscalYear: number
  quarter?: number
  title: string
  titleEn?: string
  summary?: string
  summaryEn?: string
  language?: IRReportLanguage
}

export interface IRReportUpdateInput {
  title?: string
  titleEn?: string
  summary?: string
  summaryEn?: string
  status?: IRReportStatus
  language?: IRReportLanguage
}

export interface IRReportSectionCreateInput {
  reportId: string
  sectionType: IRSectionType
  title: string
  titleEn?: string
  content: string
  contentEn?: string
  data?: Record<string, unknown>
  sortOrder: number
}

export interface IRReportSectionUpdateInput {
  title?: string
  titleEn?: string
  content?: string
  contentEn?: string
  data?: Record<string, unknown>
  sortOrder?: number
}

export interface ReorderSectionsData {
  sectionIds: string[]
}

export interface ShareholderDataCreateInput {
  companyId: string
  asOfDate: Date
  shareholderType: string
  shareholderName?: string
  sharesHeld: number
  percentage: number
}

export interface ShareholderDataUpdateInput {
  shareholderType?: string
  shareholderName?: string
  sharesHeld?: number
  percentage?: number
}

export interface IREventCreateInput {
  companyId: string
  eventType: IREventType
  title: string
  titleEn?: string
  description?: string
  descriptionEn?: string
  scheduledDate: Date
}

export interface IREventUpdateInput {
  title?: string
  titleEn?: string
  description?: string
  descriptionEn?: string
  scheduledDate?: Date
  status?: IREventStatus
}

export interface FAQ {
  id: string
  companyId: string
  question: string
  answer: string
  category?: string
  sortOrder: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface FAQList {
  id: string
  companyId: string
  question: string
  category?: string
  sortOrder: number
  isActive: boolean
}

export interface CreateFAQData {
  companyId: string
  question: string
  answer: string
  category?: string
  sortOrder?: number
}

export interface UpdateFAQData {
  question?: string
  answer?: string
  category?: string
  isActive?: boolean
}

export interface ReorderFAQsData {
  faqIds: string[]
}

export type IRReportServiceError = {
  code: string
  message: string
  details?: Record<string, unknown>
}

export type IRReportResult = Result<IRReport, IRReportServiceError>
export type IRReportListResult = Result<IRReportList[], IRReportServiceError>
export type IRReportSectionResult = Result<IRReportSection, IRReportServiceError>
export type ShareholderDataResult = Result<ShareholderData, IRReportServiceError>
export type ShareholderDataListResult = Result<ShareholderData[], IRReportServiceError>
export type IREventResult = Result<IREvent, IRReportServiceError>
export type IREventListResult = Result<IREventList[], IRReportServiceError>

export const IR_REPORT_TYPES: readonly IRReportType[] = [
  'annual',
  'quarterly',
  'earnings_call',
  'sustainability',
] as const

export const IR_REPORT_STATUSES: readonly IRReportStatus[] = [
  'DRAFT',
  'REVIEW',
  'PUBLISHED',
  'ARCHIVED',
] as const

export const IR_SECTION_TYPES: readonly IRSectionType[] = [
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
] as const

export const IR_REPORT_LANGUAGES: readonly IRReportLanguage[] = ['ja', 'en', 'bilingual'] as const

export const IR_EVENT_TYPES: readonly IREventType[] = [
  'earnings_release',
  'briefing',
  'dividend',
  'agm',
] as const

export const IR_EVENT_STATUSES: readonly IREventStatus[] = [
  'scheduled',
  'completed',
  'cancelled',
] as const

export function isValidIRReportType(value: string): value is IRReportType {
  return IR_REPORT_TYPES.includes(value as IRReportType)
}

export function isValidIRReportStatus(value: string): value is IRReportStatus {
  return IR_REPORT_STATUSES.includes(value as IRReportStatus)
}

export function isValidIRSectionType(value: string): value is IRSectionType {
  return IR_SECTION_TYPES.includes(value as IRSectionType)
}

export function isValidIRReportLanguage(value: string): value is IRReportLanguage {
  return IR_REPORT_LANGUAGES.includes(value as IRReportLanguage)
}

export function isValidIREventType(value: string): value is IREventType {
  return IR_EVENT_TYPES.includes(value as IREventType)
}

export function isValidIREventStatus(value: string): value is IREventStatus {
  return IR_EVENT_STATUSES.includes(value as IREventStatus)
}

export type CreateIRReportData = IRReportCreateInput
export type UpdateIRReportData = IRReportUpdateInput
export type CreateIREventData = IREventCreateInput
export type UpdateIREventData = IREventUpdateInput
