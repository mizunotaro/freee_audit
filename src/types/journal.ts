import type { AuditResult } from './audit'

export interface Journal {
  id: string
  companyId: string
  freeeJournalId: string
  entryDate: Date
  description: string
  debitAccount: string
  creditAccount: string
  amount: number
  taxAmount: number
  taxType?: string
  documentId?: string
  auditStatus: 'PENDING' | 'PASSED' | 'FAILED' | 'SKIPPED'
  syncedAt: Date
  createdAt: Date
}

export interface JournalEntry {
  id: string
  entryDate: Date
  description: string
  debitAccount: string
  creditAccount: string
  amount: number
  taxAmount: number
  taxType?: string
}

export interface JournalWithDocument extends Journal {
  document?: Document
  auditResult?: AuditResult
}

export interface Document {
  id: string
  companyId: string
  freeeDocumentId?: string
  journalId?: string
  filePath: string
  fileType: string
  fileName: string
  fileSize: number
  uploadDate: Date
  createdAt: Date
}

export interface CreateJournalInput {
  companyId: string
  freeeJournalId: string
  entryDate: Date
  description: string
  debitAccount: string
  creditAccount: string
  amount: number
  taxAmount: number
  taxType?: string
  documentId?: string
}

export interface JournalQueryParams {
  companyId: string
  startDate?: Date
  endDate?: Date
  auditStatus?: 'PENDING' | 'PASSED' | 'FAILED' | 'SKIPPED'
  page?: number
  limit?: number
}
