import { prisma } from '@/lib/db'
import { MappingRuleEngine } from './mapping-rule-engine'
import type {
  AccountMapping,
  ConversionRule,
  ConversionSettings,
  JournalConversion,
  ConvertedJournalLine,
} from '@/types/conversion'

export interface UnmappedAccount {
  accountCode: string
  accountName: string
  occurrenceCount: number
  totalAmount: number
  sampleDescriptions: string[]
}

export interface BatchResult {
  processedCount: number
  successCount: number
  failedCount: number
  errors: Array<{ journalId: string; message: string }>
}

export interface JournalConverterConfig {
  batchSize?: number
  maxRetries?: number
  retryDelayMs?: number
}

interface JournalRecord {
  id: string
  companyId: string
  freeeJournalId: string
  entryDate: Date
  description: string
  debitAccount: string
  creditAccount: string
  amount: number
  taxAmount: number
  taxType: string | null
}

interface MappingWithTargets extends AccountMapping {
  conversionRule?: ConversionRule
  targetAccountId: string
  targetAccountCode: string
  targetAccountName: string
}

export class JournalConverter {
  private ruleEngine: MappingRuleEngine
  private config: Required<JournalConverterConfig>

  constructor(config?: JournalConverterConfig) {
    this.ruleEngine = new MappingRuleEngine()
    this.config = {
      batchSize: config?.batchSize ?? 1000,
      maxRetries: config?.maxRetries ?? 3,
      retryDelayMs: config?.retryDelayMs ?? 1000,
    }
  }

  async convert(
    companyId: string,
    periodStart: Date,
    periodEnd: Date,
    mappings: Map<string, AccountMapping>,
    settings: ConversionSettings
  ): Promise<JournalConversion[]> {
    const journals = await this.fetchJournals(companyId, periodStart, periodEnd)
    const results: JournalConversion[] = []

    for await (const batchResult of this.convertBatch(journals, mappings, this.config.batchSize)) {
      results.push(...batchResult.conversions)
    }

    return results
  }

  async convertSingle(
    journal: JournalRecord,
    mappings: Map<string, AccountMapping>
  ): Promise<JournalConversion> {
    const lines: ConvertedJournalLine[] = []
    let totalConfidence = 0
    let requiresReview = false
    const reviewNotes: string[] = []

    const debitLines = await this.convertAccountLine(
      journal.debitAccount,
      journal.amount,
      0,
      journal,
      mappings
    )
    lines.push(...debitLines.lines)
    totalConfidence += debitLines.confidence
    if (debitLines.requiresReview) {
      requiresReview = true
      reviewNotes.push(...debitLines.reviewNotes)
    }

    const creditLines = await this.convertAccountLine(
      journal.creditAccount,
      0,
      journal.amount,
      journal,
      mappings
    )
    lines.push(...creditLines.lines)
    totalConfidence += creditLines.confidence
    if (creditLines.requiresReview) {
      requiresReview = true
      reviewNotes.push(...creditLines.reviewNotes)
    }

    const averageConfidence = lines.length > 0 ? totalConfidence / lines.length : 0

    return {
      sourceJournalId: journal.id,
      sourceDate: journal.entryDate,
      sourceDescription: journal.description,
      lines,
      mappingConfidence: averageConfidence,
      requiresReview,
      reviewNotes: reviewNotes.length > 0 ? reviewNotes.join('; ') : undefined,
    }
  }

  async *convertBatch(
    journals: JournalRecord[],
    mappings: Map<string, AccountMapping>,
    batchSize: number
  ): AsyncGenerator<BatchResult & { conversions: JournalConversion[] }> {
    const totalBatches = Math.ceil(journals.length / batchSize)

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const start = batchIndex * batchSize
      const end = Math.min(start + batchSize, journals.length)
      const batch = journals.slice(start, end)

      const conversions: JournalConversion[] = []
      const errors: Array<{ journalId: string; message: string }> = []

      for (const journal of batch) {
        try {
          const conversion = await this.convertSingleWithRetry(journal, mappings)
          conversions.push(conversion)
        } catch (error) {
          errors.push({
            journalId: journal.id,
            message: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      }

      yield {
        processedCount: batch.length,
        successCount: conversions.length,
        failedCount: errors.length,
        errors,
        conversions,
      }
    }
  }

  async findUnmappedAccounts(
    companyId: string,
    mappings: Map<string, AccountMapping>
  ): Promise<UnmappedAccount[]> {
    const accountUsage = await this.analyzeAccountUsage(companyId)

    const unmapped: Map<string, UnmappedAccount> = new Map()

    for (const usage of accountUsage) {
      if (!mappings.has(usage.accountCode)) {
        const existing = unmapped.get(usage.accountCode)
        if (existing) {
          existing.occurrenceCount += usage.occurrenceCount
          existing.totalAmount += usage.totalAmount
          if (existing.sampleDescriptions.length < 5 && usage.sampleDescription) {
            existing.sampleDescriptions.push(usage.sampleDescription)
          }
        } else {
          unmapped.set(usage.accountCode, {
            accountCode: usage.accountCode,
            accountName: usage.accountName,
            occurrenceCount: usage.occurrenceCount,
            totalAmount: usage.totalAmount,
            sampleDescriptions: usage.sampleDescription ? [usage.sampleDescription] : [],
          })
        }
      }
    }

    return Array.from(unmapped.values()).sort((a, b) => b.totalAmount - a.totalAmount)
  }

  private async fetchJournals(
    companyId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<JournalRecord[]> {
    return prisma.journal.findMany({
      where: {
        companyId,
        entryDate: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
      orderBy: {
        entryDate: 'asc',
      },
    })
  }

  private async convertSingleWithRetry(
    journal: JournalRecord,
    mappings: Map<string, AccountMapping>
  ): Promise<JournalConversion> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        return await this.convertSingle(journal, mappings)
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')
        if (attempt < this.config.maxRetries - 1) {
          await this.sleep(this.config.retryDelayMs * Math.pow(2, attempt))
        }
      }
    }

    throw lastError
  }

  private async convertAccountLine(
    accountCode: string,
    debitAmount: number,
    creditAmount: number,
    journal: JournalRecord,
    mappings: Map<string, AccountMapping>
  ): Promise<{
    lines: ConvertedJournalLine[]
    confidence: number
    requiresReview: boolean
    reviewNotes: string[]
  }> {
    const mapping = mappings.get(accountCode)

    if (!mapping) {
      return {
        lines: [
          {
            sourceAccountCode: accountCode,
            sourceAccountName: accountCode,
            targetAccountCode: accountCode,
            targetAccountName: `UNMAPPED: ${accountCode}`,
            debitAmount,
            creditAmount,
            mappingId: '',
          },
        ],
        confidence: 0,
        requiresReview: true,
        reviewNotes: [`Unmapped account: ${accountCode}`],
      }
    }

    const lines: ConvertedJournalLine[] = []
    let totalConfidence = 0
    const reviewNotes: string[] = []

    switch (mapping.mappingType) {
      case '1to1':
        lines.push(this.createDirectLine(mapping, debitAmount, creditAmount))
        totalConfidence = mapping.confidence
        break

      case '1toN': {
        const splitLines = this.createSplitLines(mapping, debitAmount, creditAmount, journal)
        lines.push(...splitLines.lines)
        totalConfidence = mapping.confidence
        if (splitLines.warnings.length > 0) {
          reviewNotes.push(...splitLines.warnings)
        }
        break
      }

      case 'Nto1':
        lines.push(this.createDirectLine(mapping, debitAmount, creditAmount))
        totalConfidence = mapping.confidence
        break

      case 'complex': {
        const complexResult = await this.createComplexLines(
          mapping,
          debitAmount,
          creditAmount,
          journal
        )
        lines.push(...complexResult.lines)
        totalConfidence = mapping.confidence
        if (complexResult.warnings.length > 0) {
          reviewNotes.push(...complexResult.warnings)
        }
        break
      }

      default:
        return {
          lines: [
            {
              sourceAccountCode: accountCode,
              sourceAccountName: mapping.sourceAccountName,
              targetAccountCode: accountCode,
              targetAccountName: `UNKNOWN TYPE: ${mapping.mappingType}`,
              debitAmount,
              creditAmount,
              mappingId: mapping.id,
            },
          ],
          confidence: 0,
          requiresReview: true,
          reviewNotes: [`Unknown mapping type: ${mapping.mappingType}`],
        }
    }

    return {
      lines,
      confidence: totalConfidence,
      requiresReview: mapping.isManualReview || reviewNotes.length > 0,
      reviewNotes,
    }
  }

  private createDirectLine(
    mapping: AccountMapping,
    debitAmount: number,
    creditAmount: number
  ): ConvertedJournalLine {
    return {
      sourceAccountCode: mapping.sourceAccountCode,
      sourceAccountName: mapping.sourceAccountName,
      targetAccountCode: mapping.targetAccountCode,
      targetAccountName: mapping.targetAccountName,
      debitAmount,
      creditAmount,
      mappingId: mapping.id,
    }
  }

  private createSplitLines(
    mapping: AccountMapping,
    debitAmount: number,
    creditAmount: number,
    journal: JournalRecord
  ): { lines: ConvertedJournalLine[]; warnings: string[] } {
    const lines: ConvertedJournalLine[] = []
    const warnings: string[] = []

    if (!mapping.conversionRule || mapping.conversionRule.type !== 'percentage') {
      const rule = mapping.conversionRule
      if (rule?.conditions && rule.conditions.length > 0) {
        const amount = debitAmount > 0 ? debitAmount : creditAmount
        const targetAccountId = this.ruleEngine.evaluateConditions(rule.conditions, {
          entryDate: journal.entryDate,
          description: journal.description,
          amount,
        })

        if (targetAccountId) {
          lines.push({
            sourceAccountCode: mapping.sourceAccountCode,
            sourceAccountName: mapping.sourceAccountName,
            targetAccountCode: mapping.targetAccountCode,
            targetAccountName: mapping.targetAccountName,
            debitAmount,
            creditAmount,
            mappingId: mapping.id,
          })
          return { lines, warnings }
        }
      }

      lines.push(this.createDirectLine(mapping, debitAmount, creditAmount))
      warnings.push('1toN mapping without percentage rule, using direct mapping')
      return { lines, warnings }
    }

    const percentage = mapping.conversionRule.percentage ?? 100
    const calculatedDebit = Math.round(debitAmount * (percentage / 100))
    const calculatedCredit = Math.round(creditAmount * (percentage / 100))

    lines.push({
      sourceAccountCode: mapping.sourceAccountCode,
      sourceAccountName: mapping.sourceAccountName,
      targetAccountCode: mapping.targetAccountCode,
      targetAccountName: mapping.targetAccountName,
      debitAmount: calculatedDebit,
      creditAmount: calculatedCredit,
      mappingId: mapping.id,
    })

    return { lines, warnings }
  }

  private async createComplexLines(
    mapping: AccountMapping,
    debitAmount: number,
    creditAmount: number,
    journal: JournalRecord
  ): Promise<{ lines: ConvertedJournalLine[]; warnings: string[] }> {
    const lines: ConvertedJournalLine[] = []
    const warnings: string[] = []

    if (!mapping.conversionRule) {
      lines.push(this.createDirectLine(mapping, debitAmount, creditAmount))
      warnings.push('Complex mapping without conversion rule, using direct mapping')
      return { lines, warnings }
    }

    const rule = mapping.conversionRule

    if (rule.conditions && rule.conditions.length > 0) {
      const amount = debitAmount > 0 ? debitAmount : creditAmount
      const matchedTargetId = this.ruleEngine.evaluateConditions(rule.conditions, {
        entryDate: journal.entryDate,
        description: journal.description,
        amount,
      })

      if (matchedTargetId) {
        let calculatedDebit = debitAmount
        let calculatedCredit = creditAmount

        if (rule.type === 'percentage' && rule.percentage !== undefined) {
          calculatedDebit = Math.round(debitAmount * (rule.percentage / 100))
          calculatedCredit = Math.round(creditAmount * (rule.percentage / 100))
        } else if (rule.type === 'formula' && rule.formula) {
          try {
            const contextAmount = amount
            const calculated = this.ruleEngine.calculateAmount(rule, amount, {
              amount: contextAmount,
              date: journal.entryDate,
            })
            calculatedDebit = debitAmount > 0 ? calculated : 0
            calculatedCredit = creditAmount > 0 ? calculated : 0
          } catch (error) {
            warnings.push(
              `Formula evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            )
          }
        }

        lines.push({
          sourceAccountCode: mapping.sourceAccountCode,
          sourceAccountName: mapping.sourceAccountName,
          targetAccountCode: mapping.targetAccountCode,
          targetAccountName: mapping.targetAccountName,
          debitAmount: calculatedDebit,
          creditAmount: calculatedCredit,
          mappingId: mapping.id,
        })

        return { lines, warnings }
      }
    }

    if (rule.type === 'percentage' && rule.percentage !== undefined) {
      const calculatedDebit = Math.round(debitAmount * (rule.percentage / 100))
      const calculatedCredit = Math.round(creditAmount * (rule.percentage / 100))

      lines.push({
        sourceAccountCode: mapping.sourceAccountCode,
        sourceAccountName: mapping.sourceAccountName,
        targetAccountCode: mapping.targetAccountCode,
        targetAccountName: mapping.targetAccountName,
        debitAmount: calculatedDebit,
        creditAmount: calculatedCredit,
        mappingId: mapping.id,
      })
    } else {
      lines.push(this.createDirectLine(mapping, debitAmount, creditAmount))
      warnings.push('No matching condition in complex mapping, using direct mapping')
    }

    return { lines, warnings }
  }

  private async analyzeAccountUsage(companyId: string): Promise<
    Array<{
      accountCode: string
      accountName: string
      occurrenceCount: number
      totalAmount: number
      sampleDescription: string | null
    }>
  > {
    const debitUsage = await prisma.journal.groupBy({
      by: ['debitAccount'],
      where: { companyId },
      _count: { debitAccount: true },
      _sum: { amount: true },
      _min: { description: true },
    })

    const creditUsage = await prisma.journal.groupBy({
      by: ['creditAccount'],
      where: { companyId },
      _count: { creditAccount: true },
      _sum: { amount: true },
      _min: { description: true },
    })

    const accountMap = new Map<
      string,
      {
        accountCode: string
        accountName: string
        occurrenceCount: number
        totalAmount: number
        sampleDescription: string | null
      }
    >()

    for (const item of debitUsage) {
      const existing = accountMap.get(item.debitAccount)
      if (existing) {
        existing.occurrenceCount += item._count.debitAccount
        existing.totalAmount += item._sum.amount ?? 0
      } else {
        accountMap.set(item.debitAccount, {
          accountCode: item.debitAccount,
          accountName: item.debitAccount,
          occurrenceCount: item._count.debitAccount,
          totalAmount: item._sum.amount ?? 0,
          sampleDescription: item._min.description,
        })
      }
    }

    for (const item of creditUsage) {
      const existing = accountMap.get(item.creditAccount)
      if (existing) {
        existing.occurrenceCount += item._count.creditAccount
        existing.totalAmount += item._sum.amount ?? 0
      } else {
        accountMap.set(item.creditAccount, {
          accountCode: item.creditAccount,
          accountName: item.creditAccount,
          occurrenceCount: item._count.creditAccount,
          totalAmount: item._sum.amount ?? 0,
          sampleDescription: item._min.description,
        })
      }
    }

    return Array.from(accountMap.values())
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

export const journalConverter = new JournalConverter()
