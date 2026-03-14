import { Result, createAppError } from '@/types/result'
import type { DDCategory, ValidationRule } from '../types'
import { BaseValidator, ValidatorContext, ValidationResult } from './base-validator'

export class InventoryValidator extends BaseValidator {
  readonly category: DDCategory = 'INVENTORY'
  readonly supportedRules = [
    'METHOD_CONSISTENCY',
    'SLOW_MOVING',
    'RATIO',
    'OBSOLESCENCE',
    'COMPLETENESS',
    'TREND',
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
      const inventoryJournals = journals.filter(
        (j) =>
          j.debitAccount.includes('棚卸資産') ||
          j.debitAccount.includes('商品') ||
          j.debitAccount.includes('製品') ||
          j.debitAccount.includes('原材料') ||
          j.debitAccount.includes('仕掛品') ||
          j.creditAccount.includes('棚卸資産') ||
          j.creditAccount.includes('商品') ||
          j.creditAccount.includes('製品')
      )

      const { debit: inventoryIncrease, credit: inventoryDecrease } = this.sumJournalAmounts(
        inventoryJournals,
        (account) =>
          account.includes('棚卸資産') ||
          account.includes('商品') ||
          account.includes('製品') ||
          account.includes('原材料') ||
          account.includes('仕掛品')
      )

      const netInventory = inventoryIncrease - inventoryDecrease

      evidence.push(
        this.createEvidence(
          'CALCULATION',
          `inventory_${context.fiscalYear}`,
          `棚卸資産純増: ${netInventory.toLocaleString()}円`
        )
      )

      for (const rule of rules) {
        const ruleResult = await this.applyRule(rule, context, inventoryJournals, netInventory)
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
          error instanceof Error ? error.message : 'Inventory validation failed',
          { cause: error instanceof Error ? error : undefined }
        ),
      }
    }
  }

  private async applyRule(
    rule: ValidationRule,
    context: ValidatorContext,
    inventoryJournals: ValidatorContext['analyticsContext']['journals'],
    netInventory: number
  ): Promise<{ findings: ValidationResult['findings']; evidence: ValidationResult['evidence'] }> {
    const findings: ValidationResult['findings'] = []
    const evidence: ValidationResult['evidence'] = []

    switch (rule.type) {
      case 'SLOW_MOVING':
        if (rule.threshold) {
          const slowMovingValue = this.calculateSlowMovingInventory(
            inventoryJournals,
            context.fiscalYear,
            rule.threshold
          )
          const slowMovingRatio = netInventory > 0 ? slowMovingValue / netInventory : 0

          evidence.push(
            this.createEvidence(
              'CALCULATION',
              `slow_moving_inventory_${context.fiscalYear}`,
              `滞留棚卸資産(${rule.threshold}日以上)比率: ${(slowMovingRatio * 100).toFixed(1)}%`
            )
          )

          if (slowMovingRatio > 0.15) {
            findings.push(
              this.createFinding(
                '滞留棚卸資産の比率が高い',
                `棚卸資産の${(slowMovingRatio * 100).toFixed(1)}%が${rule.threshold}日以上滞留しています。`,
                'HIGH',
                '評価損の計上が必要な可能性があります。',
                '棚卸資産の年齢分析を実施し、評価損の必要性を検討してください。',
                'ASBJ Statement No.9'
              )
            )
          }
        }
        break

      case 'RATIO':
        if (rule.field === 'inventory_turnover' && rule.min !== undefined) {
          const turnoverRatio = this.calculateInventoryTurnover(context, context.fiscalYear)

          evidence.push(
            this.createEvidence(
              'CALCULATION',
              `inventory_turnover_${context.fiscalYear}`,
              `棚卸資産回転率: ${turnoverRatio.toFixed(2)}回 (最低: ${rule.min}回)`
            )
          )

          if (turnoverRatio < rule.min) {
            findings.push(
              this.createFinding(
                '棚卸資産回転率が低い',
                `棚卸資産回転率${turnoverRatio.toFixed(2)}回が最低基準${rule.min}回を下回っています。`,
                'MEDIUM',
                '過剰在庫により運転資本が増加しています。',
                '発注管理の見直しと在庫最適化を検討してください。',
                'ASBJ Statement No.9'
              )
            )
          }
        }
        break

      case 'TREND':
        if (rule.lookback) {
          const inventoryValues: number[] = []
          for (let i = 0; i < rule.lookback; i++) {
            const year = context.fiscalYear - i
            const journals = this.getJournalsForYear(context, year)
            const { debit, credit } = this.sumJournalAmounts(
              journals,
              (a) => a.includes('棚卸資産') || a.includes('商品') || a.includes('製品')
            )
            inventoryValues.push(debit - credit)
          }

          const trend = this.calculateTrend(inventoryValues)

          evidence.push(
            this.createEvidence(
              'CALCULATION',
              `inventory_trend_${context.fiscalYear}`,
              `棚卸資産動向: ${trend.direction} (${trend.percentageChange.toFixed(1)}%)`
            )
          )

          if (trend.direction === 'increasing' && trend.percentageChange > 30) {
            findings.push(
              this.createFinding(
                '棚卸資産が増加傾向',
                `過去${rule.lookback}年間で棚卸資産が${trend.percentageChange.toFixed(1)}%増加しています。`,
                'MEDIUM',
                '売上不振または過剰発注の可能性があります。',
                '売上予測と発注計画の整合性を確認してください。',
                'ASBJ Statement No.9'
              )
            )
          }
        }
        break

      case 'OBSOLESCENCE': {
        const writeDownJournals = this.getJournalsForYear(context, context.fiscalYear).filter(
          (j) =>
            j.debitAccount.includes('棚卸資産評価損') ||
            j.description.includes('陳腐化') ||
            j.description.includes('評価損')
        )

        const { debit: writeDownAmount } = this.sumJournalAmounts(writeDownJournals, () => true)
        const writeDownRatio = netInventory > 0 ? writeDownAmount / netInventory : 0

        evidence.push(
          this.createEvidence(
            'CALCULATION',
            `inventory_write_down_${context.fiscalYear}`,
            `棚卸資産評価損比率: ${(writeDownRatio * 100).toFixed(2)}%`
          )
        )

        if (writeDownRatio > 0.1) {
          findings.push(
            this.createFinding(
              '棚卸資産評価損が高い',
              `棚卸資産評価損比率が${(writeDownRatio * 100).toFixed(2)}%と高水準です。`,
              'MEDIUM',
              '製品ライフサイクルの短縮または需要予測の誤差が示唆されます。',
              '需要予測手法の見直しを検討してください。',
              'ASBJ Statement No.9'
            )
          )
        }
        break
      }

      case 'METHOD_CONSISTENCY':
        evidence.push(
          this.createEvidence(
            'DOCUMENT',
            'inventory_valuation_method',
            '棚卸資産評価方法の確認が必要'
          )
        )
        break
    }

    return { findings, evidence }
  }

  private calculateSlowMovingInventory(
    journals: ValidatorContext['analyticsContext']['journals'],
    fiscalYear: number,
    thresholdDays: number
  ): number {
    const yearEnd = new Date(fiscalYear, 11, 31)
    let slowMovingValue = 0

    for (const journal of journals) {
      if (journal.debitAccount.includes('棚卸資産') || journal.debitAccount.includes('商品')) {
        const entryDate = new Date(journal.entryDate)
        const daysDiff = Math.floor(
          (yearEnd.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24)
        )

        if (daysDiff >= thresholdDays) {
          slowMovingValue += journal.amount
        }
      }
    }

    return slowMovingValue
  }

  private calculateInventoryTurnover(context: ValidatorContext, fiscalYear: number): number {
    const journals = this.getJournalsForYear(context, fiscalYear)

    const { credit: costOfSales } = this.sumJournalAmounts(
      journals,
      (a) => a.includes('売上原価') || a.includes('仕入')
    )

    const { debit, credit } = this.sumJournalAmounts(
      journals,
      (a) => a.includes('棚卸資産') || a.includes('商品') || a.includes('製品')
    )
    const averageInventory = (debit + credit) / 2

    return averageInventory > 0 ? costOfSales / averageInventory : 0
  }
}
