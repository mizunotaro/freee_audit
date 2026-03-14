import type { AdjustmentType, AdjustingEntry, AdjustmentRecommendation } from '@/types/conversion'
import {
  type Result,
  type AppError,
  success,
  failure,
  createAppError,
  ERROR_CODES,
} from '@/types/result'
import {
  type AdjustmentStrategy,
  type SourceFinancialData,
  type ImpactEstimate,
  validateAdjustingEntry,
} from './adjustments/types'
import { LeaseClassificationAdjustment } from './adjustments/lease-classification'
import { DeferredTaxAdjustment } from './adjustments/deferred-tax'
import { RevenueRecognitionAdjustment } from './adjustments/revenue-recognition'
import { FinancialInstrumentAdjustment } from './adjustments/financial-instrument'
import { RetirementBenefitAdjustment } from './adjustments/retirement-benefit'
import { ForeignCurrencyAdjustment } from './adjustments/foreign-currency'
import { BusinessCombinationAdjustment } from './adjustments/business-combination'
import { GoodwillImpairmentAdjustment } from './adjustments/goodwill-impairment'

export class AdjustmentCalculator {
  private calculators: Map<AdjustmentType, AdjustmentStrategy>

  constructor() {
    this.calculators = new Map<AdjustmentType, AdjustmentStrategy>([
      ['revenue_recognition', new RevenueRecognitionAdjustment()],
      ['lease_classification', new LeaseClassificationAdjustment()],
      ['financial_instrument', new FinancialInstrumentAdjustment()],
      ['deferred_tax', new DeferredTaxAdjustment()],
      ['retirement_benefit', new RetirementBenefitAdjustment()],
      ['foreign_currency', new ForeignCurrencyAdjustment()],
      ['business_combination', new BusinessCombinationAdjustment()],
      ['goodwill_impairment', new GoodwillImpairmentAdjustment()],
    ])
  }

  async calculateAll(
    projectId: string,
    sourceData: SourceFinancialData,
    targetStandard: 'USGAAP' | 'IFRS'
  ): Promise<AdjustingEntry[]> {
    const entries: AdjustingEntry[] = []
    const errors: Array<{ type: AdjustmentType; error: Error }> = []

    for (const [type, calculator] of this.calculators) {
      try {
        const isApplicable = calculator.isApplicable(sourceData, targetStandard)
        if (!isApplicable) {
          continue
        }

        const entry = await calculator.calculate(projectId, sourceData, targetStandard)
        if (entry) {
          const validation = validateAdjustingEntry(entry)
          if (validation.isValid) {
            entries.push(entry)
          } else {
            console.warn(`Adjustment ${type} failed validation: ${validation.error}`)
          }
        }
      } catch (error) {
        errors.push({
          type,
          error: error instanceof Error ? error : new Error(String(error)),
        })
      }
    }

    if (errors.length > 0) {
      console.warn(
        `${errors.length} adjustment calculation(s) failed:`,
        errors.map((e) => ({ type: e.type, message: e.error.message }))
      )
    }

    return entries
  }

  async calculate(
    projectId: string,
    type: AdjustmentType,
    sourceData: SourceFinancialData,
    targetStandard: 'USGAAP' | 'IFRS'
  ): Promise<Result<AdjustingEntry | null, AppError>> {
    const calculator = this.calculators.get(type)
    if (!calculator) {
      return failure(
        createAppError(ERROR_CODES.VALIDATION_ERROR, `Unknown adjustment type: ${type}`)
      )
    }

    const isApplicable = calculator.isApplicable(sourceData, targetStandard)
    if (!isApplicable) {
      return success(null)
    }

    const entry = await calculator.calculate(projectId, sourceData, targetStandard)
    if (!entry) {
      return success(null)
    }

    const validation = validateAdjustingEntry(entry)
    if (!validation.isValid) {
      return failure(
        createAppError(ERROR_CODES.VALIDATION_ERROR, `Invalid adjusting entry: ${validation.error}`)
      )
    }

    return success(entry)
  }

  async generateRecommendations(
    projectId: string,
    sourceData: SourceFinancialData,
    targetStandard: 'USGAAP' | 'IFRS'
  ): Promise<AdjustmentRecommendation[]> {
    const recommendations: AdjustmentRecommendation[] = []

    for (const [type, calculator] of this.calculators) {
      const isApplicable = calculator.isApplicable(sourceData, targetStandard)
      if (!isApplicable) {
        continue
      }

      const entry = await calculator.calculate(projectId, sourceData, targetStandard)
      if (!entry) {
        continue
      }

      const impact = this.estimateImpact(entry)

      recommendations.push({
        type,
        priority: this.determinePriority(type, impact),
        title: calculator.name,
        description: calculator.description,
        estimatedImpact: {
          assetChange: impact.assetChange,
          liabilityChange: impact.liabilityChange,
          equityChange: impact.equityChange,
          netIncomeChange: impact.netIncomeChange,
        },
        reasoning: this.generateReasoning(type, targetStandard),
        references: [calculator.getReference(targetStandard)],
      })
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 }
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    })
  }

  estimateImpact(entry: AdjustingEntry): ImpactEstimate {
    let assetChange = 0
    let liabilityChange = 0
    let equityChange = 0
    let netIncomeChange = 0
    const affectedAccounts: string[] = []

    for (const line of entry.lines) {
      affectedAccounts.push(line.accountName)

      const codeNum = parseInt(line.accountCode, 10)
      if (isNaN(codeNum)) continue

      if (codeNum >= 1000 && codeNum < 3000) {
        assetChange += line.debit - line.credit
      } else if (codeNum >= 4000 && codeNum < 6000) {
        liabilityChange += line.credit - line.debit
      } else if (codeNum >= 6000 && codeNum < 7000) {
        equityChange += line.credit - line.debit
      } else if (codeNum >= 7000 && codeNum < 10000) {
        netIncomeChange += line.credit - line.debit
      }
    }

    return {
      assetChange,
      liabilityChange,
      equityChange,
      netIncomeChange,
      affectedAccounts,
    }
  }

  getAvailableTypes(): Array<{ type: AdjustmentType; name: string; description: string }> {
    return Array.from(this.calculators.entries()).map(([type, calculator]) => ({
      type,
      name: calculator.name,
      description: calculator.description,
    }))
  }

  getApplicableTypes(
    sourceData: SourceFinancialData,
    targetStandard: 'USGAAP' | 'IFRS'
  ): AdjustmentType[] {
    const applicable: AdjustmentType[] = []

    for (const [type, calculator] of this.calculators) {
      if (calculator.isApplicable(sourceData, targetStandard)) {
        applicable.push(type)
      }
    }

    return applicable
  }

  private determinePriority(
    type: AdjustmentType,
    impact: ImpactEstimate
  ): 'high' | 'medium' | 'low' {
    const highImpactTypes: AdjustmentType[] = [
      'lease_classification',
      'business_combination',
      'goodwill_impairment',
    ]

    const mediumImpactTypes: AdjustmentType[] = [
      'deferred_tax',
      'retirement_benefit',
      'revenue_recognition',
    ]

    const totalChange =
      Math.abs(impact.assetChange) +
      Math.abs(impact.liabilityChange) +
      Math.abs(impact.equityChange) +
      Math.abs(impact.netIncomeChange)

    if (highImpactTypes.includes(type) || totalChange > 10000000) {
      return 'high'
    }

    if (mediumImpactTypes.includes(type) || totalChange > 1000000) {
      return 'medium'
    }

    return 'low'
  }

  private generateReasoning(type: AdjustmentType, _targetStandard: 'USGAAP' | 'IFRS'): string {
    const reasoningMap: Record<AdjustmentType, string> = {
      revenue_recognition:
        'JGAAPとIFRS 15/ASC 606の間で収益認識のタイミングと基準に差異があります。',
      lease_classification:
        'JGAAPではオペレーティングリースを賃貸借処理しますが、IFRS 16/ASC 842では使用権資産とリース負債として認識する必要があります。',
      financial_instrument:
        '金融商品の分類と公正価値測定において、IFRS 9/ASC 320-825とJGAAP金融商品会計基準の間で差異があります。',
      deferred_tax:
        '繰延税金資産の回収可能性判定において、IAS 12/ASC 740とJGAAP税効果会計基準の間で判定基準に差異があります。',
      retirement_benefit:
        '退職給付債務の計算において、過去勤務費用の処理や数理計算上の差異の扱いにIFRS/USGAAPとJGAAPで差異があります。',
      foreign_currency:
        '外貨換算において、決算日レートと取得時レートの適用ルールにIAS 21/ASC 830とJGAAP外貨換算基準の間で差異があります。',
      business_combination:
        '企業結合時ののれん認識と資産・負債の公正価値評価において、IFRS 3/ASC 805とJGAAP企業結合基準の間で差異があります。',
      goodwill_impairment:
        'のれんの減損テストにおいて、CGUの区分や回収可能価額の算定方法にIAS 36/ASC 350とJGAAP減損会計基準の間で差異があります。',
      other: 'その他の調整項目です。',
    }

    return reasoningMap[type] || reasoningMap.other
  }
}

export const adjustmentCalculator = new AdjustmentCalculator()

export type {
  AdjustmentStrategy,
  SourceFinancialData,
  ImpactEstimate,
  BalanceSheet,
  ProfitLoss,
  Journal,
  FixedAsset,
  Debt,
  Lease,
} from './adjustments/types'

export { LeaseClassificationAdjustment } from './adjustments/lease-classification'
export { DeferredTaxAdjustment } from './adjustments/deferred-tax'
export { RevenueRecognitionAdjustment } from './adjustments/revenue-recognition'
export { FinancialInstrumentAdjustment } from './adjustments/financial-instrument'
export { RetirementBenefitAdjustment } from './adjustments/retirement-benefit'
export { ForeignCurrencyAdjustment } from './adjustments/foreign-currency'
export { BusinessCombinationAdjustment } from './adjustments/business-combination'
export { GoodwillImpairmentAdjustment } from './adjustments/goodwill-impairment'
