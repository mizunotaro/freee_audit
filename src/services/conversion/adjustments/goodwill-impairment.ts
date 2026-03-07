import type { AdjustingEntry } from '@/types/conversion'
import { type AdjustmentStrategy, type SourceFinancialData, generateAdjustmentId } from './types'

export class GoodwillImpairmentAdjustment implements AdjustmentStrategy {
  readonly type = 'goodwill_impairment'
  readonly name = 'のれん減損の調整'
  readonly description = 'のれんの減損テストと調整'

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

    return goodwillAccounts.length > 0
  }

  async calculate(
    projectId: string,
    sourceData: SourceFinancialData,
    _targetStandard: 'USGAAP' | 'IFRS'
  ): Promise<AdjustingEntry | null> {
    const impairmentAnalysis = await this.performImpairmentTest(sourceData)

    if (!impairmentAnalysis.needsImpairment) {
      return null
    }

    const { impairmentLoss, goodwillWrittenDown, cgu } = impairmentAnalysis

    if (impairmentLoss === 0) {
      return null
    }

    const lines: Array<{
      accountCode: string
      accountName: string
      debit: number
      credit: number
    }> = []

    lines.push({
      accountCode: '9280',
      accountName: '減損損失',
      debit: impairmentLoss,
      credit: 0,
    })

    lines.push({
      accountCode: '2600',
      accountName: 'のれん',
      debit: 0,
      credit: goodwillWrittenDown,
    })

    const entry: AdjustingEntry = {
      id: generateAdjustmentId(),
      projectId,
      type: 'goodwill_impairment',
      description: `のれん減損テストに基づく減損損失の計上（CGU: ${cgu}）`,
      descriptionEn: `Recognition of impairment loss based on goodwill impairment test (CGU: ${cgu})`,
      lines,
      ifrsReference: 'IAS 36 Impairment of Assets',
      usgaapReference: 'ASC 350 Intangibles - Goodwill and Other',
      aiSuggested: false,
      isApproved: false,
    }

    return entry
  }

  getReference(targetStandard: 'USGAAP' | 'IFRS'): string {
    return targetStandard === 'IFRS'
      ? 'IAS 36 Impairment of Assets'
      : 'ASC 350 Intangibles - Goodwill and Other'
  }

  private async performImpairmentTest(sourceData: SourceFinancialData): Promise<{
    needsImpairment: boolean
    impairmentLoss: number
    goodwillWrittenDown: number
    cgu: string
  }> {
    const goodwill = sourceData.balanceSheet.assets.fixed.find(
      (a) => a.name.includes('のれん') || a.name.includes('営業権') || a.name.includes('Goodwill')
    )

    if (!goodwill) {
      return {
        needsImpairment: false,
        impairmentLoss: 0,
        goodwillWrittenDown: 0,
        cgu: '',
      }
    }

    const operatingIncome = sourceData.profitLoss.operatingIncome
    const totalAssets = sourceData.balanceSheet.totalAssets

    const impliedRoI = operatingIncome / totalAssets
    const impairmentThreshold = 0.05

    if (impliedRoI < impairmentThreshold) {
      const impairmentRatio = Math.min(1, (impairmentThreshold - impliedRoI) / impairmentThreshold)
      const impairmentLoss = Math.round(goodwill.amount * impairmentRatio)

      return {
        needsImpairment: true,
        impairmentLoss,
        goodwillWrittenDown: impairmentLoss,
        cgu: '本社',
      }
    }

    return {
      needsImpairment: false,
      impairmentLoss: 0,
      goodwillWrittenDown: 0,
      cgu: '',
    }
  }
}
