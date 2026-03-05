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
    this.checkTaxRelated(entry, documentData, issues)
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

  private checkTaxRelated(
    entry: JournalEntryData,
    documentData: DocumentAnalysisResult,
    issues: ValidationIssue[]
  ): void {
    const taxKeywords = {
      withholding: ['給与', '賞与', '源泉', '所得税'],
      corporate: ['法人税', '住民税', '事業税'],
      consumption: ['消費税', '預り消費税'],
      depreciation: ['償却資産税', '固定資産税'],
    }

    const isWithholdingRelated = taxKeywords.withholding.some(
      (k) =>
        entry.description.includes(k) ||
        entry.debitAccount.includes(k) ||
        entry.creditAccount.includes(k)
    )

    if (isWithholdingRelated) {
      if (entry.taxAmount === 0) {
        const expectedRate = 0.10275
        const expectedTax = Math.round(entry.amount * expectedRate)
        const diff = Math.abs(entry.taxAmount - expectedTax)

        if (diff > 100) {
          issues.push({
            field: 'taxAmount',
            severity: 'warning',
            message: `源泉徴収税が計上されていません。給与¥${entry.amount.toLocaleString()}の場合、約¥${expectedTax.toLocaleString()}の源泉徴収税が予想されます`,
            messageEn: `Withholding tax is not recorded. For salary of ¥${entry.amount.toLocaleString()}, approximately ¥${expectedTax.toLocaleString()} withholding tax is expected`,
            expectedValue: expectedTax,
            actualValue: entry.taxAmount,
          })
        }
      }
    }

    const isCorporateTaxRelated = taxKeywords.corporate.some(
      (k) =>
        entry.description.includes(k) ||
        entry.debitAccount.includes(k) ||
        entry.creditAccount.includes(k)
    )

    if (isCorporateTaxRelated) {
      const entryMonth = new Date(entry.date).getMonth() + 1
      const isFiscalYearEnd =
        entryMonth === 3 || entryMonth === 12 || entryMonth === 9 || entryMonth === 6

      if (!isFiscalYearEnd && entry.amount > 0) {
        issues.push({
          field: 'date',
          severity: 'info',
          message: `法人税関連の仕訳です。決算期や中間申告時期の計上か確認してください`,
          messageEn: `Corporate tax related entry. Please verify if it is booked at fiscal year end or interim filing period`,
        })
      }
    }

    const isConsumptionTaxRelated = taxKeywords.consumption.some(
      (k) =>
        entry.description.includes(k) ||
        entry.debitAccount.includes(k) ||
        entry.creditAccount.includes(k)
    )

    if (isConsumptionTaxRelated && documentData.amount) {
      const standardRate = 0.1
      const reducedRate = 0.08

      const expectedStandardTax = Math.round(documentData.amount * standardRate)
      const expectedReducedTax = Math.round(documentData.amount * reducedRate)

      const diffStandard = Math.abs(entry.taxAmount - expectedStandardTax)
      const diffReduced = Math.abs(entry.taxAmount - expectedReducedTax)

      if (diffStandard > 1 && diffReduced > 1) {
        issues.push({
          field: 'taxAmount',
          severity: 'warning',
          message: `消費税額が標準税率(10%)または軽減税率(8%)と乖離があります。計算を確認してください`,
          messageEn: `Consumption tax amount deviates from standard rate (10%) or reduced rate (8%). Please verify calculation`,
        })
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
