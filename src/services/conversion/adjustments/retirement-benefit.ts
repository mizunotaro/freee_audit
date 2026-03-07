import type { AdjustingEntry } from '@/types/conversion'
import { type AdjustmentStrategy, type SourceFinancialData, generateAdjustmentId } from './types'

export class RetirementBenefitAdjustment implements AdjustmentStrategy {
  readonly type = 'retirement_benefit'
  readonly name = '退職給付費用の調整'
  readonly description = '退職給付債務・年金資産の再計算'

  private readonly DEFAULT_DISCOUNT_RATE = 0.02
  private readonly DEFAULT_SALARY_GROWTH_RATE = 0.02

  isApplicable(sourceData: SourceFinancialData, _targetStandard: 'USGAAP' | 'IFRS'): boolean {
    const retirementAccounts = [
      ...sourceData.balanceSheet.liabilities.fixed,
      ...sourceData.balanceSheet.assets.fixed,
    ].filter(
      (a) =>
        a.name.includes('退職') ||
        a.name.includes('年金') ||
        a.name.includes('Pension') ||
        a.name.includes('Retirement') ||
        a.name.includes('Retiree')
    )

    return retirementAccounts.length > 0
  }

  async calculate(
    projectId: string,
    sourceData: SourceFinancialData,
    _targetStandard: 'USGAAP' | 'IFRS'
  ): Promise<AdjustingEntry | null> {
    const retirementAnalysis = this.analyzeRetirementBenefits(sourceData)

    if (!retirementAnalysis.needsAdjustment) {
      return null
    }

    const { dboChange, planAssetAdjustment, pastServiceCost, actuarialGainLoss, netAdjustment } =
      retirementAnalysis

    if (Math.abs(netAdjustment) < 1000) {
      return null
    }

    const lines: Array<{
      accountCode: string
      accountName: string
      debit: number
      credit: number
    }> = []

    if (netAdjustment > 0) {
      lines.push({
        accountCode: '5310',
        accountName: '退職給付債務',
        debit: 0,
        credit: netAdjustment,
      })
    } else {
      lines.push({
        accountCode: '5310',
        accountName: '退職給付債務',
        debit: Math.abs(netAdjustment),
        credit: 0,
      })
    }

    if (planAssetAdjustment !== 0) {
      if (planAssetAdjustment > 0) {
        lines.push({
          accountCode: '1790',
          accountName: '年金資産',
          debit: planAssetAdjustment,
          credit: 0,
        })
      } else {
        lines.push({
          accountCode: '1790',
          accountName: '年金資産',
          debit: 0,
          credit: Math.abs(planAssetAdjustment),
        })
      }
    }

    if (pastServiceCost > 0) {
      lines.push({
        accountCode: '9370',
        accountName: '過去勤務費用',
        debit: pastServiceCost,
        credit: 0,
      })
    }

    if (Math.abs(actuarialGainLoss) > 0) {
      if (actuarialGainLoss > 0) {
        lines.push({
          accountCode: '6950',
          accountName: '退職給付費用',
          debit: actuarialGainLoss,
          credit: 0,
        })
      } else {
        lines.push({
          accountCode: '6950',
          accountName: '退職給付益',
          debit: 0,
          credit: Math.abs(actuarialGainLoss),
        })
      }
    }

    if (lines.length < 2) {
      return null
    }

    this.balanceEntry(lines)

    const entry: AdjustingEntry = {
      id: generateAdjustmentId(),
      projectId,
      type: 'retirement_benefit',
      description: '退職給付債務の再計算と調整',
      descriptionEn: 'Remeasurement and adjustment of retirement benefit obligations',
      lines,
      ifrsReference: 'IAS 19 Employee Benefits',
      usgaapReference: 'ASC 715 Compensation - Retirement Benefits',
      aiSuggested: false,
      isApproved: false,
    }

    return entry
  }

  getReference(targetStandard: 'USGAAP' | 'IFRS'): string {
    return targetStandard === 'IFRS'
      ? 'IAS 19 Employee Benefits'
      : 'ASC 715 Compensation - Retirement Benefits'
  }

  private analyzeRetirementBenefits(sourceData: SourceFinancialData): {
    needsAdjustment: boolean
    dboChange: number
    planAssetAdjustment: number
    pastServiceCost: number
    actuarialGainLoss: number
    netAdjustment: number
  } {
    const retirementLiability = sourceData.balanceSheet.liabilities.fixed.find(
      (l) =>
        l.name.includes('退職給付引当金') ||
        l.name.includes('退職') ||
        l.name.includes('Pension') ||
        l.name.includes('Retirement')
    )

    const planAssets = sourceData.balanceSheet.assets.fixed.find(
      (a) => a.name.includes('年金資産') || a.name.includes('Pension Asset')
    )

    const dboAmount = retirementLiability?.amount || 0
    const planAssetAmount = planAssets?.amount || 0

    const dboChange = Math.round(dboAmount * (this.DEFAULT_DISCOUNT_RATE - 0.015))
    const planAssetAdjustment = Math.round(planAssetAmount * 0.03)
    const pastServiceCost = Math.round(dboAmount * 0.01)
    const actuarialGainLoss = Math.round(dboAmount * -0.005)

    const netAdjustment =
      dboChange +
      pastServiceCost +
      actuarialGainLoss -
      planAssetAdjustment * (planAssetAmount > 0 ? 1 : 0)

    return {
      needsAdjustment: dboAmount > 0,
      dboChange,
      planAssetAdjustment,
      pastServiceCost,
      actuarialGainLoss,
      netAdjustment,
    }
  }

  private balanceEntry(
    lines: Array<{ accountCode: string; accountName: string; debit: number; credit: number }>
  ): void {
    const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0)
    const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0)
    const difference = totalDebit - totalCredit

    if (Math.abs(difference) > 0.01) {
      if (difference > 0) {
        lines.push({
          accountCode: '9390',
          accountName: '雑費',
          debit: 0,
          credit: difference,
        })
      } else {
        lines.push({
          accountCode: '9490',
          accountName: '雑益',
          debit: Math.abs(difference),
          credit: 0,
        })
      }
    }
  }
}
