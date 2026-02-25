import { AIProviderInterface, createAIProviderFromEnv } from '@/lib/integrations/ai'
import { DocumentAnalysisResult, EntryValidationResult, ValidationIssue } from '@/types/audit'

export interface JournalEntryData {
  id: string
  date: string
  debitAccount: string
  creditAccount: string
  amount: number
  taxAmount: number
  taxType?: string
  description: string
}

export interface JournalCheckerConfig {
  aiProvider?: AIProviderInterface
  toleranceAmount?: number
  toleranceDays?: number
}

export class JournalChecker {
  private aiProvider: AIProviderInterface | null
  private toleranceAmount: number
  private toleranceDays: number

  constructor(config?: JournalCheckerConfig) {
    this.aiProvider = config?.aiProvider ?? createAIProviderFromEnv()
    this.toleranceAmount = config?.toleranceAmount ?? 1
    this.toleranceDays = config?.toleranceDays ?? 0
  }

  async check(
    entry: JournalEntryData,
    documentData: DocumentAnalysisResult | null
  ): Promise<EntryValidationResult> {
    const issues: ValidationIssue[] = []

    if (!documentData) {
      return {
        isValid: true,
        issues: [
          {
            field: 'document',
            severity: 'info',
            message: '証憑が添付されていないため自動チェックをスキップしました',
            messageEn: 'Skipped automatic check as no document is attached',
          },
        ],
      }
    }

    this.checkDate(entry, documentData, issues)
    this.checkAmount(entry, documentData, issues)
    this.checkTaxAmount(entry, documentData, issues)
    this.checkDescription(entry, documentData, issues)
    await this.checkAccountAppropriateness(entry, documentData, issues)

    if (this.aiProvider?.validateEntry && issues.length === 0) {
      const aiResult = await this.aiProvider.validateEntry({
        journalEntry: {
          date: entry.date,
          debitAccount: entry.debitAccount,
          creditAccount: entry.creditAccount,
          amount: entry.amount,
          taxAmount: entry.taxAmount,
          taxType: entry.taxType,
          description: entry.description,
        },
        documentData,
      })

      return {
        isValid: aiResult.isValid,
        issues: aiResult.issues,
        suggestions: aiResult.suggestions,
      }
    }

    const hasErrors = issues.some((i) => i.severity === 'error')

    return {
      isValid: !hasErrors,
      issues,
    }
  }

  private checkDate(
    entry: JournalEntryData,
    documentData: DocumentAnalysisResult,
    issues: ValidationIssue[]
  ): void {
    if (!documentData.date) return

    const entryDate = new Date(entry.date)
    const documentDate = new Date(documentData.date)

    if (isNaN(entryDate.getTime()) || isNaN(documentDate.getTime())) return

    const diffTime = Math.abs(entryDate.getTime() - documentDate.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays > this.toleranceDays) {
      issues.push({
        field: 'date',
        severity: 'error',
        message: `仕訳日付(${entry.date})と証憑日付(${documentData.date})が一致しません`,
        messageEn: `Journal date (${entry.date}) does not match document date (${documentData.date})`,
        expectedValue: documentData.date,
        actualValue: entry.date,
      })
    }
  }

  private checkAmount(
    entry: JournalEntryData,
    documentData: DocumentAnalysisResult,
    issues: ValidationIssue[]
  ): void {
    if (documentData.amount === null || documentData.amount === undefined) return

    const diff = Math.abs(entry.amount - documentData.amount)

    if (diff > this.toleranceAmount) {
      const severity = diff > 100 ? 'error' : 'warning'
      issues.push({
        field: 'amount',
        severity,
        message: `仕訳金額(¥${entry.amount.toLocaleString()})と証憑金額(¥${documentData.amount.toLocaleString()})が一致しません`,
        messageEn: `Journal amount (¥${entry.amount.toLocaleString()}) does not match document amount (¥${documentData.amount.toLocaleString()})`,
        expectedValue: documentData.amount,
        actualValue: entry.amount,
      })
    }
  }

  private checkTaxAmount(
    entry: JournalEntryData,
    documentData: DocumentAnalysisResult,
    issues: ValidationIssue[]
  ): void {
    if (documentData.taxAmount === null || documentData.taxAmount === undefined) return

    const diff = Math.abs(entry.taxAmount - documentData.taxAmount)

    if (diff > this.toleranceAmount) {
      const severity = diff > 10 ? 'error' : 'warning'
      issues.push({
        field: 'taxAmount',
        severity,
        message: `仕訳税額(¥${entry.taxAmount.toLocaleString()})と証憑税額(¥${documentData.taxAmount.toLocaleString()})が一致しません`,
        messageEn: `Journal tax amount (¥${entry.taxAmount.toLocaleString()}) does not match document tax amount (¥${documentData.taxAmount.toLocaleString()})`,
        expectedValue: documentData.taxAmount,
        actualValue: entry.taxAmount,
      })
    }
  }

  private checkDescription(
    entry: JournalEntryData,
    documentData: DocumentAnalysisResult,
    issues: ValidationIssue[]
  ): void {
    if (!documentData.description || !documentData.vendorName) return

    const hasVendorReference =
      entry.description.includes(documentData.vendorName) ||
      entry.description.includes(documentData.description.substring(0, 10))

    if (!hasVendorReference && documentData.confidence > 0.8) {
      issues.push({
        field: 'description',
        severity: 'info',
        message: `摘要に取引先名「${documentData.vendorName}」の記載を検討してください`,
        messageEn: `Consider including vendor name "${documentData.vendorName}" in the description`,
      })
    }
  }

  private async checkAccountAppropriateness(
    entry: JournalEntryData,
    documentData: DocumentAnalysisResult,
    issues: ValidationIssue[]
  ): Promise<void> {
    const suspiciousPatterns = [
      { pattern: /売上|収入/i, wrongAccounts: ['現金', '普通預金', '売掛金'], side: 'credit' },
      { pattern: /仕入|経費|費用/i, wrongAccounts: ['売上', '収入'], side: 'debit' },
    ]

    for (const { pattern, wrongAccounts, side } of suspiciousPatterns) {
      if (pattern.test(entry.description)) {
        const targetAccount = side === 'credit' ? entry.creditAccount : entry.debitAccount
        if (wrongAccounts.some((a) => targetAccount.includes(a))) {
          issues.push({
            field: side === 'credit' ? 'creditAccount' : 'debitAccount',
            severity: 'warning',
            message: `勘定科目「${targetAccount}」が適切か確認してください`,
            messageEn: `Please verify if account "${targetAccount}" is appropriate`,
          })
        }
      }
    }
  }

  async batchCheck(
    entries: Array<{ entry: JournalEntryData; documentData: DocumentAnalysisResult | null }>
  ): Promise<Array<{ entryId: string; result: EntryValidationResult }>> {
    const results: Array<{ entryId: string; result: EntryValidationResult }> = []

    for (const { entry, documentData } of entries) {
      if (!documentData) {
        results.push({
          entryId: entry.id,
          result: {
            isValid: true,
            issues: [
              {
                field: 'document',
                severity: 'info',
                message: '証憑が添付されていないため自動チェックをスキップしました',
                messageEn: 'Skipped automatic check as no document is attached',
              },
            ],
          },
        })
        continue
      }

      const result = await this.check(entry, documentData)
      results.push({ entryId: entry.id, result })
    }

    return results
  }
}

export function createJournalChecker(config?: JournalCheckerConfig): JournalChecker {
  return new JournalChecker(config)
}
