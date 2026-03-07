import type { AdjustingEntry } from '@/types/conversion'
import { type AdjustmentStrategy, type SourceFinancialData, generateAdjustmentId } from './types'

export class BusinessCombinationAdjustment implements AdjustmentStrategy {
  readonly type = 'business_combination'
  readonly name = '企業結合の調整'
  readonly description = '企業結合に伴う資産・負債の認識調整'

  isApplicable(sourceData: SourceFinancialData, _targetStandard: 'USGAAP' | 'IFRS'): boolean {
    const goodwillAccounts = [
      ...sourceData.balanceSheet.assets.fixed,
      ...sourceData.balanceSheet.assets.current,
    ].filter(
      (a) =>
        a.name.includes('のれん') ||
        a.name.includes('営業権') ||
        a.name.includes('Goodwill') ||
        a.code.startsWith('26')
    )

    const negativeGoodwill = sourceData.balanceSheet.liabilities.current.find(
      (l) => l.name.includes('負ののれん') || l.name.includes('Negative Goodwill')
    )

    return goodwillAccounts.length > 0 || !!negativeGoodwill
  }

  async calculate(
    projectId: string,
    sourceData: SourceFinancialData,
    _targetStandard: 'USGAAP' | 'IFRS'
  ): Promise<AdjustingEntry | null> {
    const combinationAdjustments = this.analyzeBusinessCombination(sourceData)

    if (!combinationAdjustments.needsAdjustment) {
      return null
    }

    const {
      goodwillAdjustment,
      intangibleAssetAdjustment,
      contingentLiabilityAdjustment,
      bargainPurchaseGain,
    } = combinationAdjustments

    if (
      goodwillAdjustment === 0 &&
      intangibleAssetAdjustment === 0 &&
      contingentLiabilityAdjustment === 0
    ) {
      return null
    }

    const lines: Array<{
      accountCode: string
      accountName: string
      debit: number
      credit: number
    }> = []

    if (goodwillAdjustment !== 0) {
      if (goodwillAdjustment > 0) {
        lines.push({
          accountCode: '2600',
          accountName: 'のれん',
          debit: goodwillAdjustment,
          credit: 0,
        })
      } else {
        lines.push({
          accountCode: '2600',
          accountName: 'のれん',
          debit: 0,
          credit: Math.abs(goodwillAdjustment),
        })
      }
    }

    if (intangibleAssetAdjustment !== 0) {
      if (intangibleAssetAdjustment > 0) {
        lines.push({
          accountCode: '2500',
          accountName: '無形固定資産',
          debit: intangibleAssetAdjustment,
          credit: 0,
        })
      } else {
        lines.push({
          accountCode: '2500',
          accountName: '無形固定資産',
          debit: 0,
          credit: Math.abs(intangibleAssetAdjustment),
        })
      }
    }

    if (contingentLiabilityAdjustment !== 0) {
      if (contingentLiabilityAdjustment > 0) {
        lines.push({
          accountCode: '4900',
          accountName: '偶発債務',
          debit: 0,
          credit: contingentLiabilityAdjustment,
        })
      } else {
        lines.push({
          accountCode: '4900',
          accountName: '偶発債務',
          debit: Math.abs(contingentLiabilityAdjustment),
          credit: 0,
        })
      }
    }

    if (bargainPurchaseGain > 0) {
      lines.push({
        accountCode: '9800',
        accountName: '負ののれん収益',
        debit: 0,
        credit: bargainPurchaseGain,
      })
    }

    if (lines.length < 2) {
      return null
    }

    this.balanceEntry(lines)

    const entry: AdjustingEntry = {
      id: generateAdjustmentId(),
      projectId,
      type: 'business_combination',
      description: '企業結合時点での資産・負債の公正価値評価調整',
      descriptionEn:
        'Fair value measurement adjustment for assets and liabilities at acquisition date',
      lines,
      ifrsReference: 'IFRS 3 Business Combinations',
      usgaapReference: 'ASC 805 Business Combinations',
      aiSuggested: false,
      isApproved: false,
    }

    return entry
  }

  getReference(targetStandard: 'USGAAP' | 'IFRS'): string {
    return targetStandard === 'IFRS'
      ? 'IFRS 3 Business Combinations'
      : 'ASC 805 Business Combinations'
  }

  private analyzeBusinessCombination(sourceData: SourceFinancialData): {
    needsAdjustment: boolean
    goodwillAdjustment: number
    intangibleAssetAdjustment: number
    contingentLiabilityAdjustment: number
    bargainPurchaseGain: number
  } {
    const goodwill = sourceData.balanceSheet.assets.fixed.find(
      (a) => a.name.includes('のれん') || a.name.includes('営業権') || a.name.includes('Goodwill')
    )

    const intangibleAssets = sourceData.balanceSheet.assets.fixed.filter(
      (a) =>
        (a.name.includes('無形') || a.name.includes('Intangible')) &&
        !a.name.includes('のれん') &&
        !a.name.includes('営業権')
    )

    const goodwillAmount = goodwill?.amount || 0
    const intangibleAmount = intangibleAssets.reduce((sum, a) => sum + a.amount, 0)

    const goodwillAdjustment = Math.round(goodwillAmount * 0.05)
    const intangibleAssetAdjustment = Math.round(intangibleAmount * 0.1)
    const contingentLiabilityAdjustment = Math.round(goodwillAmount * 0.02)
    const bargainPurchaseGain = goodwillAmount < 0 ? Math.abs(goodwillAmount) : 0

    return {
      needsAdjustment: goodwillAmount !== 0 || intangibleAmount !== 0,
      goodwillAdjustment,
      intangibleAssetAdjustment,
      contingentLiabilityAdjustment,
      bargainPurchaseGain,
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
          accountCode: '9490',
          accountName: '雑益',
          debit: 0,
          credit: difference,
        })
      } else {
        lines.push({
          accountCode: '9390',
          accountName: '雑費',
          debit: Math.abs(difference),
          credit: 0,
        })
      }
    }
  }
}
