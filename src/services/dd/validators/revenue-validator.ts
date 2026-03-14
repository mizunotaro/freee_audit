import { Result, createAppError } from '@/types/result'
import type { DDCategory, ValidationRule } from '../types'
import { BaseValidator, ValidatorContext, ValidationResult } from './base-validator'

export class RevenueRecognitionValidator extends BaseValidator {
  readonly category: DDCategory = 'REVENUE_RECOGNITION'
  readonly supportedRules = [
    'COMPLETENESS',
    'CONSISTENCY',
    'CUTOFF',
    'POLICY_CHANGE',
    'COMPARABILITY',
    'TREND',
  ]

  async validate(
    itemCode: string,
    rules: readonly ValidationRule[],
    context: ValidatorContext
  ): Promise<Result<ValidationResult>> {
    const findings: ValidationResult['findings'] = []
    const evidence: ValidationResult['evidence'] = []

    try {
      const journals = this.getJournalsForYear(context, context.fiscalYear)
      const revenueJournals = journals.filter(
        (j) =>
          j.debitAccount.includes('売掛金') ||
          j.debitAccount.includes('現金') ||
          j.debitAccount.includes('未収入金') ||
          j.creditAccount.includes('売上') ||
          j.creditAccount.includes('役務収入')
      )

      const { debit: totalRevenue } = this.sumJournalAmounts(
        revenueJournals,
        (account) =>
          account.includes('売掛金') || account.includes('現金') || account.includes('未収入金')
      )

      evidence.push(
        this.createEvidence(
          'CALCULATION',
          `revenue_${context.fiscalYear}`,
          `当期売上高: ${totalRevenue.toLocaleString()}円`
        )
      )

      for (const rule of rules) {
        const ruleResult = await this.applyRule(rule, context, revenueJournals, totalRevenue)
        findings.push(...ruleResult.findings)
        evidence.push(...ruleResult.evidence)
      }

      const passed = !findings.some((f) => f.severity === 'CRITICAL' || f.severity === 'HIGH')

      return {
        success: true,
        data: { passed, findings, evidence },
      }
    } catch (error) {
      return {
        success: false,
        error: createAppError(
          'VALIDATION_ERROR',
          error instanceof Error ? error.message : 'Revenue recognition validation failed',
          { cause: error instanceof Error ? error : undefined }
        ),
      }
    }
  }

  private async applyRule(
    rule: ValidationRule,
    context: ValidatorContext,
    revenueJournals: ValidatorContext['analyticsContext']['journals'],
    _totalRevenue: number
  ): Promise<{ findings: ValidationResult['findings']; evidence: ValidationResult['evidence'] }> {
    const findings: ValidationResult['findings'] = []
    const evidence: ValidationResult['evidence'] = []

    switch (rule.type) {
      case 'TREND':
        if (rule.lookback) {
          const yearlyRevenues: number[] = []
          for (let i = 0; i < rule.lookback; i++) {
            const year = context.fiscalYear - i
            const journals = this.getJournalsForYear(context, year)
            const { debit } = this.sumJournalAmounts(journals, (account) =>
              account.includes('売掛金')
            )
            yearlyRevenues.push(debit)
          }

          const trend = this.calculateTrend(yearlyRevenues)

          evidence.push(
            this.createEvidence(
              'CALCULATION',
              `revenue_trend_${context.fiscalYear}`,
              `過去${rule.lookback}年間の売上動向: ${trend.direction} (${trend.percentageChange.toFixed(1)}%)`
            )
          )

          if (trend.direction === 'decreasing' && Math.abs(trend.percentageChange) > 20) {
            findings.push(
              this.createFinding(
                '売上減少傾向',
                `過去${rule.lookback}年間で売上が${Math.abs(trend.percentageChange).toFixed(1)}%減少しています。`,
                'HIGH',
                '収益認識の適正性に影響する可能性があります。',
                '売上減少の原因を分析し、将来の収益予測に反映してください。',
                'ASBJ Statement No.29'
              )
            )
          }
        }
        break

      case 'CUTOFF': {
        const nextYearStart = new Date(context.fiscalYear + 1, 0, 1)
        const nextYearEnd = new Date(context.fiscalYear + 1, 0, 31)

        const postYearEndJournals = this.getJournalsForYear(context, context.fiscalYear + 1).filter(
          (j) => {
            const date = new Date(j.entryDate)
            return date >= nextYearStart && date <= nextYearEnd
          }
        )

        const earlyNextYearRevenue = postYearEndJournals.filter(
          (j) =>
            j.creditAccount.includes('売上') &&
            j.description.includes('前受') === false &&
            j.description.includes('未収') === false
        )

        if (earlyNextYearRevenue.length > 0) {
          evidence.push(
            this.createEvidence(
              'JOURNAL',
              `cutoff_analysis_${context.fiscalYear}`,
              `翌期初の売上計上件数: ${earlyNextYearRevenue.length}件`
            )
          )

          if (earlyNextYearRevenue.length > 10) {
            findings.push(
              this.createFinding(
                'カットオフ分析が必要',
                '翌期初に多数の売上計上が見られます。期末近くの売上についてカットオフの適正性を確認してください。',
                'MEDIUM',
                '期間帰属の誤りにより財務諸表が歪む可能性があります。',
                '期末前後の取引について詳細なカットオフテストを実施してください。',
                'ASBJ Statement No.29'
              )
            )
          }
        }
        break
      }

      case 'POLICY_CHANGE':
        evidence.push(
          this.createEvidence('DOCUMENT', 'revenue_policy', '収益認識ポリシーの確認が必要')
        )
        break

      case 'COMPLETENESS': {
        const allRevenueAccounts = new Set<string>()
        revenueJournals.forEach((j) => {
          if (j.creditAccount.includes('売上') || j.creditAccount.includes('収入')) {
            allRevenueAccounts.add(j.creditAccount)
          }
        })

        evidence.push(
          this.createEvidence(
            'CALCULATION',
            `revenue_accounts_${context.fiscalYear}`,
            `収益勘定科目数: ${allRevenueAccounts.size}`
          )
        )
        break
      }
    }

    return { findings, evidence }
  }
}
