export interface AuditResult {
  id: string
  journalId: string
  documentId?: string
  status: 'PASSED' | 'FAILED' | 'ERROR'
  issues: ValidationIssue[]
  confidenceScore?: number
  rawAiResponse?: string
  analyzedAt: Date
  createdAt: Date
}

export interface ValidationIssue {
  field: string
  severity: 'error' | 'warning' | 'info'
  message: string
  messageEn: string
  expectedValue?: unknown
  actualValue?: unknown
}

export interface DocumentAnalysisResult {
  date: string | null
  amount: number
  taxAmount: number
  taxRate?: number
  description: string
  vendorName: string
  confidence: number
  rawText?: string
}

export interface EntryValidationRequest {
  journalEntry: {
    date: string
    debitAccount: string
    creditAccount: string
    amount: number
    taxAmount: number
    taxType?: string
    description: string
  }
  documentData: DocumentAnalysisResult
}

export interface EntryValidationResult {
  isValid: boolean
  issues: ValidationIssue[]
  suggestions?: string[]
}

export interface AuditSummary {
  date: string
  totalCount: number
  passedCount: number
  failedCount: number
  errorCount: number
  skippedCount: number
  issues: Array<{
    journalId: string
    description: string
    issues: ValidationIssue[]
  }>
}

export type AuditStatus = 'PENDING' | 'PASSED' | 'FAILED' | 'SKIPPED'
export type AuditResultStatus = 'PASSED' | 'FAILED' | 'ERROR'

export interface AuditAnalysisResult {
  journalId: string
  status: AuditResultStatus
  issues: string[]
  confidenceScore?: number
  analyzedAt?: Date
}

export const AuditStatusSchema = {
  PENDING: 'PENDING',
  PASSED: 'PASSED',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED',
} as const
