import type { ImportType } from '../types'

export interface ImportAuditIssue {
  id: string
  row: number
  type: ImportAuditIssueType
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  category: ImportAuditCategory
  message: string
  messageJa: string
  field?: string
  value?: unknown
  suggestion?: string
  suggestionJa?: string
  relatedRows?: number[]
  references?: string[]
}

export type ImportAuditIssueType =
  | 'duplicate_entry'
  | 'unusual_amount'
  | 'invalid_date'
  | 'missing_reference'
  | 'balance_mismatch'
  | 'category_inconsistency'
  | 'tax_calculation_error'
  | 'period_mismatch'
  | 'account_not_found'
  | 'sign_error'
  | 'rounding_discrepancy'
  | 'missing_required_field'
  | 'format_error'
  | 'business_rule_violation'
  | 'suspicious_pattern'

export type ImportAuditCategory =
  | 'completeness'
  | 'accuracy'
  | 'validity'
  | 'consistency'
  | 'timeliness'
  | 'compliance'

export interface ImportAuditResult {
  success: boolean
  summary: ImportAuditSummary
  issues: ImportAuditIssue[]
  recommendations: ImportRecommendation[]
  riskScore: number
  confidence: number
  processingTimeMs: number
}

export interface ImportAuditSummary {
  totalRows: number
  validRows: number
  issueRows: number
  criticalIssues: number
  highIssues: number
  mediumIssues: number
  lowIssues: number
  infoIssues: number
}

export interface ImportRecommendation {
  id: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  category: ImportAuditCategory
  title: string
  titleJa: string
  description: string
  descriptionJa: string
  action: string
  actionJa: string
  affectedRows?: number[]
  autoFixAvailable: boolean
}

export interface ImportAuditContext {
  importType: ImportType
  companyId: string
  userId?: string
  fiscalYear?: number
  language: 'ja' | 'en'
  existingData?: {
    accountCodes?: string[]
    journalIds?: string[]
    balanceHistory?: Array<{ accountCode: string; amount: number; month: number }>
  }
}

export interface ImportAuditOptions {
  checkDuplicates: boolean
  checkAmountAnomalies: boolean
  checkDateValidity: boolean
  checkReferences: boolean
  checkBalanceConsistency: boolean
  checkTaxCalculations: boolean
  checkBusinessRules: boolean
  maxIssuesToReport: number
  language: 'ja' | 'en'
}

export const DEFAULT_AUDIT_OPTIONS: ImportAuditOptions = {
  checkDuplicates: true,
  checkAmountAnomalies: true,
  checkDateValidity: true,
  checkReferences: true,
  checkBalanceConsistency: true,
  checkTaxCalculations: true,
  checkBusinessRules: true,
  maxIssuesToReport: 100,
  language: 'ja',
}

export interface IssueDetectorConfig {
  anomalyThreshold: number
  duplicateSimilarityThreshold: number
  amountVarianceThreshold: number
  maxRowsToAnalyze: number
}

export const DEFAULT_DETECTOR_CONFIG: IssueDetectorConfig = {
  anomalyThreshold: 2.5,
  duplicateSimilarityThreshold: 0.9,
  amountVarianceThreshold: 3.0,
  maxRowsToAnalyze: 1000,
}

export interface ImportAdvisorResponse {
  success: boolean
  advice: ImportAdviceItem[]
  summary: string
  summaryJa: string
  persona: 'cpa' | 'tax_accountant' | 'cfo' | 'financial_analyst'
  confidence: number
  processingTimeMs: number
}

export interface ImportAdviceItem {
  id: string
  type: 'warning' | 'suggestion' | 'best_practice' | 'compliance'
  title: string
  titleJa: string
  description: string
  descriptionJa: string
  action?: string
  actionJa?: string
  priority: 'high' | 'medium' | 'low'
  references?: string[]
}

export interface ImportAdvisorContext {
  importType: ImportType
  totalRows: number
  errorCount: number
  warningCount: number
  language: 'ja' | 'en'
  issues?: ImportAuditIssue[]
}
