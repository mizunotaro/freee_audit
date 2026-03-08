import type { OCRStructuredData, OCRResult } from '@/types/ocr'

export type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E }

export interface ChartOfAccountItem {
  id: string
  code: string
  name: string
  nameEn: string
  category: string
  subcategory?: string
  normalBalance: 'debit' | 'credit'
}

export interface JournalProposalInput {
  receiptId: string
  companyId: string
  userId: string
  ocrResult: OCRResult<OCRStructuredData>
  additionalContext?: string
  chartOfAccounts?: ChartOfAccountItem[]
}

export interface JournalProposalOutput {
  entries: JournalEntryProposal[]
  rationale: string
  confidence: number
  warnings: string[]
  aiProvider: string
  aiModel: string
}

export interface JournalEntryProposal {
  entryDate: Date
  description: string
  debitAccount: string
  debitAccountName: string
  creditAccount: string
  creditAccountName: string
  amount: number
  taxAmount: number
  taxType?: string
}

export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'modified'

export interface StoreMetadata {
  receiptId: string
  companyId: string
  userId: string
  userContext?: string
}

export interface ProposalFilters {
  status?: ProposalStatus
  fromDate?: Date
  toDate?: Date
  limit?: number
  offset?: number
}

export type { OCRResult, OCRError, OCREngineType, OCRStructuredData } from '@/types/ocr'

export interface AIProposalResponse {
  entries: Array<{
    entryDate: string
    description: string
    debitAccount: string
    debitAccountName: string
    creditAccount: string
    creditAccountName: string
    amount: number
    taxAmount: number
    taxType?: string
  }>
  rationale: string
  confidence: number
  warnings: string[]
}
