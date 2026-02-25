import type { JournalEntry, AuditAnalysisResult } from '@/types'
import { prisma } from '@/lib/db'
import { AuditStatusSchema } from '@/types'

export { ReceiptAnalyzer, createReceiptAnalyzer } from './receipt-analyzer'
export { JournalChecker, createJournalChecker } from './journal-checker'
export type { JournalEntryData, JournalCheckerConfig } from './journal-checker'
export type { ReceiptAnalyzerConfig } from './receipt-analyzer'

export interface AuditConfig {
  confidenceThreshold: number
  checkDate: boolean
  checkAmount: boolean
  checkAccount: boolean
  checkTax: boolean
}

const DEFAULT_CONFIG: AuditConfig = {
  confidenceThreshold: 0.7,
  checkDate: true,
  checkAmount: true,
  checkAccount: true,
  checkTax: true,
}

export async function analyzeJournal(
  journal: JournalEntry,
  documentContent: string | null,
  config: AuditConfig = DEFAULT_CONFIG
): Promise<AuditAnalysisResult> {
  const issues: string[] = []
  let confidenceScore = 1.0

  if (!documentContent) {
    return {
      journalId: journal.id,
      status: 'ERROR',
      issues: ['No document attached'],
      confidenceScore: 0,
    }
  }

  if (config.checkAmount) {
    const amountMatch = extractAmountFromDocument(documentContent)
    if (amountMatch !== null && Math.abs(amountMatch - journal.amount) > 1) {
      issues.push(`Amount mismatch: document=${amountMatch}, journal=${journal.amount}`)
      confidenceScore -= 0.3
    }
  }

  if (config.checkDate) {
    const dateMatch = extractDateFromDocument(documentContent)
    if (dateMatch && !isSameDay(dateMatch, journal.entryDate)) {
      issues.push(
        `Date mismatch: document=${dateMatch.toISOString()}, journal=${journal.entryDate.toISOString()}`
      )
      confidenceScore -= 0.2
    }
  }

  if (config.checkTax) {
    const expectedTax = calculateExpectedTax(journal.amount, journal.taxType)
    if (Math.abs(expectedTax - journal.taxAmount) > 1) {
      issues.push(`Tax mismatch: expected=${expectedTax}, actual=${journal.taxAmount}`)
      confidenceScore -= 0.15
    }
  }

  const status = confidenceScore >= config.confidenceThreshold ? 'PASSED' : 'FAILED'

  return {
    journalId: journal.id,
    status,
    issues,
    confidenceScore: Math.max(0, confidenceScore),
  }
}

function extractAmountFromDocument(content: string): number | null {
  const patterns = [/￥([\d,]+)/g, /¥([\d,]+)/g, /([¥$€£][\d,]+)/g, /([\d,]+)\s*(円|USD|EUR)/g]

  for (const pattern of patterns) {
    const matches = content.match(pattern)
    if (matches && matches.length > 0) {
      const amountStr = matches[0].replace(/[¥$€£,円\s]/g, '')
      const amount = parseInt(amountStr, 10)
      if (!isNaN(amount)) return amount
    }
  }

  return null
}

function extractDateFromDocument(content: string): Date | null {
  const patterns = [
    /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/g,
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/g,
    /(\d{4})年(\d{1,2})月(\d{1,2})日/g,
  ]

  for (const pattern of patterns) {
    const match = pattern.exec(content)
    if (match) {
      let year: number, month: number, day: number

      if (pattern.source.startsWith('(\\d{4})')) {
        year = parseInt(match[1], 10)
        month = parseInt(match[2], 10) - 1
        day = parseInt(match[3], 10)
      } else {
        month = parseInt(match[1], 10) - 1
        day = parseInt(match[2], 10)
        year = parseInt(match[3], 10)
      }

      const date = new Date(year, month, day)
      if (!isNaN(date.getTime())) return date
    }
  }

  return null
}

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

function calculateExpectedTax(amount: number, taxType: string | undefined): number {
  const taxRates: Record<string, number> = {
    TAXABLE_10: 0.1,
    TAXABLE_8_REDUCED: 0.08,
    TAXABLE_8: 0.08,
    TAX_EXEMPT: 0,
    NON_TAXABLE: 0,
  }

  const rate = taxType ? taxRates[taxType] || 0 : 0.1
  return Math.round(amount * rate)
}

export async function getAuditStatus(
  companyId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  total: number
  passed: number
  failed: number
  pending: number
  skipped: number
}> {
  const journals = await prisma.journal.findMany({
    where: {
      companyId,
      entryDate: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: { auditStatus: true },
  })

  return {
    total: journals.length,
    passed: journals.filter((j) => j.auditStatus === 'PASSED').length,
    failed: journals.filter((j) => j.auditStatus === 'FAILED').length,
    pending: journals.filter((j) => j.auditStatus === 'PENDING').length,
    skipped: journals.filter((j) => j.auditStatus === 'SKIPPED').length,
  }
}

export { AuditStatusSchema }
