import { Result, createAppError } from '@/types/result'
import type { DDCategory, ValidationRule } from '../types'
import { BaseValidator, ValidatorContext, ValidationResult } from './base-validator'

export class AccountsReceivableValidator extends BaseValidator {
  readonly category: DDCategory = 'ACCOUNTS_RECEIVABLE'
  readonly supportedRules = [
    'AGING',
    'RATIO',
    'TREND',
    'COMPLETENESS',
    'REALIZABILITY',
    'COVERAGE_RATIO',
  ]

  async validate(
    _itemCode: string,
    rules: readonly ValidationRule[],
    context: ValidatorContext
  ): Promise<Result<ValidationResult>> {
    const findings: ValidationResult['findings'] = []
    const evidence: ValidationResult['evidence'] = []

    try {
      const journals = this.getJournalsForYear(context, context.fiscalYear)
      const arJournals = journals.filter(
        (j) =>
          j.debitAccount.includes('売掛金') ||
          j.creditAccount.includes('売掛金') ||
          j.debitAccount.includes('未収入金')
      )

      const { debit: totalAR, credit: totalCollections } = this.sumJournalAmounts(
        arJournals,
        (account) => account.includes('売掛金') || account.includes('未収入金')
      )

      evidence.push(
        this.createEvidence(
          'CALCULATION',
          `ar_${context.fiscalYear}`,
          `当期売掛金増加: ${totalAR.toLocaleString()}円, 回収: ${totalCollections.toLocaleString()}円`
        )
      )

      for (const rule of rules) {
        const ruleResult = await this.applyRule(rule, context, arJournals, totalAR)
        findings.push(...ruleResult.findings)
        evidence.push(...ruleResult.evidence)
      }

      const passed = !findings.some((f) => f.severity === 'CRITICAL' || f.severity === 'HIGH')

      return { success: true, data: { passed, findings, evidence } }
    } catch (error) {
      return {
        success: false,
        error: createAppError(
          'VALIDATION_ERROR',
          error instanceof Error ? error.message : 'AR validation failed',
          { cause: error instanceof Error ? error : undefined }
        ),
      }
    }
  }

  private async applyRule(
    rule: ValidationRule,
    context: ValidatorContext,
    arJournals: ValidatorContext['analyticsContext']['journals'],
    totalAR: number
  ): Promise<{ findings: ValidationResult['findings']; evidence: ValidationResult['evidence'] }> {
    const findings: ValidationResult['findings'] = []
    const evidence: ValidationResult['evidence'] = []

    switch (rule.type) {
      case 'AGING': {
        const agedReceivables = this.calculateAging(arJournals, context.fiscalYear)
        const longTermAR = agedReceivables['91-180'] + agedReceivables['180+']
        const longTermRatio = totalAR > 0 ? longTermAR / totalAR : 0

        evidence.push(
          this.createEvidence(
            'CALCULATION',
            `ar_aging_${context.fiscalYear}`,
            `長期滞留債権(91日以上)比率: ${(longTermRatio * 100).toFixed(1)}%`
          )
        )

        if (longTermRatio > 0.1) {
          findings.push(
            this.createFinding(
              '長期滞留債権の比率が高い',
              `売掛金の${(longTermRatio * 100).toFixed(1)}%が91日以上の長期滞留債権です。`,
              'HIGH',
              '貸倒れリスクが高まっています。',
              '顧客ごとの与信評価を見直し、貸倒引当金の積増を検討してください。',
              'ASBJ Statement No.10'
            )
          )
        }
        break
      }

      case 'RATIO': {
        if (rule.field === 'bad_debt_ratio' && rule.threshold) {
          const allowanceJournals = this.getJournalsForYear(context, context.fiscalYear).filter(
            (j) => j.debitAccount.includes('貸倒引当金') || j.debitAccount.includes('貸倒損失')
          )
          const { debit: badDebtExpense } = this.sumJournalAmounts(allowanceJournals, () => true)
          const badDebtRatio = totalAR > 0 ? badDebtExpense / totalAR : 0

          evidence.push(
            this.createEvidence(
              'CALCULATION',
              `bad_debt_ratio_${context.fiscalYear}`,
              `貸倒比率: ${(badDebtRatio * 100).toFixed(2)}% (閾値: ${(rule.threshold * 100).toFixed(1)}%)`
            )
          )

          if (badDebtRatio > rule.threshold) {
            findings.push(
              this.createFinding(
                '貸倒比率が閾値を超過',
                `貸倒比率${(badDebtRatio * 100).toFixed(2)}%が閾値${(rule.threshold * 100).toFixed(1)}%を超過しています。`,
                'MEDIUM',
                '回収管理または与信審査の強化が必要です。',
                '与信基準の見直しと回収プロセスの改善を検討してください。',
                'ASBJ Statement No.10'
              )
            )
          }
        }
        break
      }

      case 'TREND': {
        if (rule.lookback && rule.field === 'dso') {
          const dsoValues: number[] = []
          for (let i = 0; i < rule.lookback; i++) {
            const year = context.fiscalYear - i
            const journals = this.getJournalsForYear(context, year)
            const { debit: ar } = this.sumJournalAmounts(journals, (a) => a.includes('売掛金'))
            const { credit: sales } = this.sumJournalAmounts(journals, (a) => a.includes('売上'))
            const dailySales = sales / 365
            dsoValues.push(dailySales > 0 ? ar / dailySales : 0)
          }

          const trend = this.calculateTrend(dsoValues)

          evidence.push(
            this.createEvidence(
              'CALCULATION',
              `dso_trend_${context.fiscalYear}`,
              `DSO動向: ${trend.direction} (平均: ${trend.average.toFixed(1)}日)`
            )
          )

          if (trend.direction === 'increasing' && trend.percentageChange > 15) {
            findings.push(
              this.createFinding(
                'DSOが悪化傾向',
                `過去${rule.lookback}年間でDSOが${trend.percentageChange.toFixed(1)}%悪化しています。`,
                'MEDIUM',
                '回収効率の低下により運転資本が増加しています。',
                '回収プロセスの見直しと入金督促の強化を検討してください。',
                'ASBJ Statement No.10'
              )
            )
          }
        }
        break
      }

      case 'COVERAGE_RATIO': {
        if (rule.min !== undefined || rule.max !== undefined) {
          const allowanceJournals = this.getJournalsForYear(context, context.fiscalYear).filter(
            (j) => j.creditAccount.includes('貸倒引当金')
          )
          const { credit: allowance } = this.sumJournalAmounts(allowanceJournals, () => true)
          const coverageRatio = totalAR > 0 ? allowance / totalAR : 0

          evidence.push(
            this.createEvidence(
              'CALCULATION',
              `ar_coverage_${context.fiscalYear}`,
              `貸倒引当金カバレッジ: ${(coverageRatio * 100).toFixed(2)}%`
            )
          )

          if (rule.min !== undefined && coverageRatio < rule.min) {
            findings.push(
              this.createFinding(
                '貸倒引当金が不足',
                `貸倒引当金比率${(coverageRatio * 100).toFixed(2)}%が最低基準${(rule.min * 100).toFixed(1)}%を下回っています。`,
                'HIGH',
                '貸倒損失の過少計上リスクがあります。',
                '過去の貸倒実績に基づき引当金の積増を検討してください。',
                'ASBJ Statement No.10'
              )
            )
          }
        }
        break
      }
    }

    return { findings, evidence }
  }

  private calculateAging(
    journals: ValidatorContext['analyticsContext']['journals'],
    fiscalYear: number
  ): Record<string, number> {
    const yearEnd = new Date(fiscalYear, 11, 31)
    const buckets: Record<string, number> = {
      '0-30': 0,
      '31-60': 0,
      '61-90': 0,
      '91-180': 0,
      '180+': 0,
    }

    for (const journal of journals) {
      if (journal.debitAccount.includes('売掛金')) {
        const entryDate = new Date(journal.entryDate)
        const daysDiff = Math.floor(
          (yearEnd.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24)
        )

        if (daysDiff <= 30) buckets['0-30'] += journal.amount
        else if (daysDiff <= 60) buckets['31-60'] += journal.amount
        else if (daysDiff <= 90) buckets['61-90'] += journal.amount
        else if (daysDiff <= 180) buckets['91-180'] += journal.amount
        else buckets['180+'] += journal.amount
      }
    }

    return buckets
  }
}
