import type { AdjustingEntry } from '@/types/conversion'
import { type AdjustmentStrategy, type SourceFinancialData, generateAdjustmentId } from './types'

export class FinancialInstrumentAdjustment implements AdjustmentStrategy {
  readonly type = 'financial_instrument'
  readonly name = '金融商品の調整'
  readonly description = '金融商品の公正価値評価・分類調整'

  isApplicable(sourceData: SourceFinancialData, _targetStandard: 'USGAAP' | 'IFRS'): boolean {
    const financialAssets = [
      ...sourceData.balanceSheet.assets.current,
      ...sourceData.balanceSheet.assets.fixed,
    ].filter(
      (a) =>
        a.name.includes('投資有価証券') ||
        a.name.includes('その他有価証券') ||
        a.name.includes('保有目的') ||
        a.name.includes('デリバティブ') ||
        a.name.includes('Investment Securities') ||
        a.name.includes('Derivative') ||
        a.code.startsWith('16')
    )

    const financialLiabilities = [
      ...sourceData.balanceSheet.liabilities.current,
      ...sourceData.balanceSheet.liabilities.fixed,
    ].filter(
      (l) =>
        l.name.includes('社債') ||
        l.name.includes('借入金') ||
        l.name.includes('デリバティブ') ||
        l.name.includes('Bonds') ||
        l.name.includes('Derivative')
    )

    return financialAssets.length > 0 || financialLiabilities.length > 0
  }

  async calculate(
    projectId: string,
    sourceData: SourceFinancialData,
    _targetStandard: 'USGAAP' | 'IFRS'
  ): Promise<AdjustingEntry | null> {
    const fairValueAdjustments = this.calculateFairValueAdjustments(sourceData)

    if (fairValueAdjustments.length === 0) {
      return null
    }

    const totalAssetAdjustment = fairValueAdjustments
      .filter((a) => a.category === 'asset')
      .reduce((sum, a) => sum + a.adjustment, 0)

    const totalLiabilityAdjustment = fairValueAdjustments
      .filter((a) => a.category === 'liability')
      .reduce((sum, a) => sum + a.adjustment, 0)

    if (totalAssetAdjustment === 0 && totalLiabilityAdjustment === 0) {
      return null
    }

    const lines: Array<{
      accountCode: string
      accountName: string
      debit: number
      credit: number
    }> = []

    if (totalAssetAdjustment !== 0) {
      lines.push({
        accountCode: '1690',
        accountName: 'その他有価証券評価差額金',
        debit: totalAssetAdjustment > 0 ? totalAssetAdjustment : 0,
        credit: totalAssetAdjustment < 0 ? Math.abs(totalAssetAdjustment) : 0,
      })

      if (totalAssetAdjustment > 0) {
        lines.push({
          accountCode: '6900',
          accountName: 'その他有価証券評価益',
          debit: 0,
          credit: totalAssetAdjustment,
        })
      } else {
        lines.push({
          accountCode: '6900',
          accountName: 'その他有価証券評価損',
          debit: Math.abs(totalAssetAdjustment),
          credit: 0,
        })
      }
    }

    if (totalLiabilityAdjustment !== 0) {
      lines.push({
        accountCode: '2550',
        accountName: 'デリバティブ負債',
        debit: totalLiabilityAdjustment < 0 ? Math.abs(totalLiabilityAdjustment) : 0,
        credit: totalLiabilityAdjustment > 0 ? totalLiabilityAdjustment : 0,
      })

      if (totalLiabilityAdjustment > 0) {
        lines.push({
          accountCode: '9650',
          accountName: '金融商品評価損',
          debit: totalLiabilityAdjustment,
          credit: 0,
        })
      } else {
        lines.push({
          accountCode: '9550',
          accountName: '金融商品評価益',
          debit: 0,
          credit: Math.abs(totalLiabilityAdjustment),
        })
      }
    }

    if (lines.length < 2) {
      return null
    }

    const entry: AdjustingEntry = {
      id: generateAdjustmentId(),
      projectId,
      type: 'financial_instrument',
      description: '金融商品の公正価値評価調整',
      descriptionEn: 'Fair value measurement adjustment for financial instruments',
      lines,
      ifrsReference: 'IFRS 9 Financial Instruments',
      usgaapReference: 'ASC 320/825 Financial Instruments',
      aiSuggested: false,
      isApproved: false,
    }

    return entry
  }

  getReference(targetStandard: 'USGAAP' | 'IFRS'): string {
    return targetStandard === 'IFRS'
      ? 'IFRS 9 Financial Instruments'
      : 'ASC 320/825 Financial Instruments'
  }

  private calculateFairValueAdjustments(sourceData: SourceFinancialData): Array<{
    category: 'asset' | 'liability'
    adjustment: number
    source: string
  }> {
    const adjustments: Array<{
      category: 'asset' | 'liability'
      adjustment: number
      source: string
    }> = []

    const investmentSecurities = sourceData.balanceSheet.assets.fixed.filter(
      (a) => a.name.includes('投資有価証券') || a.name.includes('その他有価証券')
    )

    for (const security of investmentSecurities) {
      const impliedFairValueChange = Math.round(security.amount * 0.02)
      adjustments.push({
        category: 'asset',
        adjustment: impliedFairValueChange,
        source: security.name,
      })
    }

    const derivatives = [
      ...sourceData.balanceSheet.assets.current,
      ...sourceData.balanceSheet.liabilities.current,
    ].filter((a) => a.name.includes('デリバティブ') || a.name.includes('Derivative'))

    for (const derivative of derivatives) {
      const category = sourceData.balanceSheet.assets.current.includes(derivative as any)
        ? 'asset'
        : 'liability'
      const fairValueChange = Math.round(derivative.amount * 0.01)
      adjustments.push({
        category,
        adjustment: category === 'asset' ? fairValueChange : -fairValueChange,
        source: derivative.name,
      })
    }

    return adjustments
  }
}
