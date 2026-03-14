import { Result } from '@/types/result'
import type {
  DDAnalyticsContext,
  DDCategory,
  DDFinding,
  DDSeverity,
  ValidationRule,
} from '../types'

export interface ValidatorContext {
  companyId: string
  fiscalYear: number
  analyticsContext: DDAnalyticsContext
}

export interface ValidationResult {
  passed: boolean
  findings: DDFinding[]
  evidence: {
    type: 'JOURNAL' | 'DOCUMENT' | 'CALCULATION' | 'EXTERNAL' | 'AI_ANALYSIS'
    reference: string
    summary: string
  }[]
}

export abstract class BaseValidator {
  abstract readonly category: DDCategory
  abstract readonly supportedRules: string[]

  abstract validate(
    itemCode: string,
    rules: readonly ValidationRule[],
    context: ValidatorContext
  ): Promise<Result<ValidationResult>>

  protected createFinding(
    title: string,
    description: string,
    severity: DDSeverity,
    impact: string,
    recommendation: string,
    relatedStandard?: string
  ): DDFinding {
    return {
      id: `${this.category}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      category: this.category,
      title,
      description,
      severity,
      impact,
      recommendation,
      relatedStandard,
    }
  }

  protected createEvidence(
    type: ValidationResult['evidence'][0]['type'],
    reference: string,
    summary: string
  ): ValidationResult['evidence'][0] {
    return { type, reference, summary }
  }

  protected calculateVariance(actual: number, expected: number): number {
    if (expected === 0) return actual === 0 ? 0 : Infinity
    return Math.abs((actual - expected) / expected)
  }

  protected checkThreshold(value: number, threshold: number, tolerance?: number): boolean {
    const variance = this.calculateVariance(value, threshold)
    return tolerance !== undefined ? variance <= tolerance : value <= threshold
  }

  protected getTrialBalanceForYear(
    context: ValidatorContext,
    fiscalYear: number
  ): DDAnalyticsContext['trialBalances'][0] | undefined {
    return context.analyticsContext.trialBalances.find(
      (tb) => new Date(tb.asOfDate).getFullYear() === fiscalYear
    )
  }

  protected getJournalsForYear(
    context: ValidatorContext,
    fiscalYear: number
  ): DDAnalyticsContext['journals'] {
    return context.analyticsContext.journals.filter(
      (j) => new Date(j.entryDate).getFullYear() === fiscalYear
    )
  }

  protected sumJournalAmounts(
    journals: DDAnalyticsContext['journals'],
    accountFilter: (account: string) => boolean
  ): { debit: number; credit: number } {
    let debit = 0
    let credit = 0

    for (const journal of journals) {
      if (accountFilter(journal.debitAccount)) {
        debit += journal.amount
      }
      if (accountFilter(journal.creditAccount)) {
        credit += journal.amount
      }
    }

    return { debit, credit }
  }

  protected calculateTrend(values: number[]): {
    direction: 'increasing' | 'decreasing' | 'stable'
    percentageChange: number
    average: number
  } {
    if (values.length < 2) {
      return { direction: 'stable', percentageChange: 0, average: values[0] || 0 }
    }

    const average = values.reduce((a, b) => a + b, 0) / values.length
    const firstValue = values[0]
    const lastValue = values[values.length - 1]

    const percentageChange =
      firstValue !== 0 ? ((lastValue - firstValue) / Math.abs(firstValue)) * 100 : 0

    let direction: 'increasing' | 'decreasing' | 'stable' = 'stable'
    if (Math.abs(percentageChange) > 5) {
      direction = percentageChange > 0 ? 'increasing' : 'decreasing'
    }

    return { direction, percentageChange, average }
  }
}
