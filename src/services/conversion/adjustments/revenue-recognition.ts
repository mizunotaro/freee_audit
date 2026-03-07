import type { AdjustingEntry } from '@/types/conversion'
import { type AdjustmentStrategy, type SourceFinancialData, generateAdjustmentId } from './types'

export class RevenueRecognitionAdjustment implements AdjustmentStrategy {
  readonly type = 'revenue_recognition'
  readonly name = '収益認識の調整'
  readonly description = '収益認識基準の差異調整（JGAAP → IFRS 15 / ASC 606）'

  isApplicable(sourceData: SourceFinancialData, _targetStandard: 'USGAAP' | 'IFRS'): boolean {
    const revenueAccounts = sourceData.profitLoss.revenue.filter(
      (r) =>
        r.name.includes('前受') ||
        r.name.includes('未収') ||
        r.name.includes('契約') ||
        r.name.includes('サブスクリプション') ||
        r.name.includes('Advances') ||
        r.name.includes('Deferred') ||
        r.name.includes('Subscription')
    )

    if (revenueAccounts.length > 0) {
      return true
    }

    for (const journal of sourceData.journals) {
      for (const line of journal.lines) {
        if (
          (line.accountName.includes('前受収益') ||
            line.accountName.includes('契約収益') ||
            line.accountName.includes('Deferred Revenue')) &&
          line.credit > 0
        ) {
          return true
        }
      }
    }

    return false
  }

  async calculate(
    projectId: string,
    sourceData: SourceFinancialData,
    _targetStandard: 'USGAAP' | 'IFRS'
  ): Promise<AdjustingEntry | null> {
    const adjustments = await this.analyzeRevenueRecognition(sourceData)

    if (adjustments.length === 0) {
      return null
    }

    const totalDeferredRevenue = adjustments
      .filter((a) => a.type === 'deferred_recognition')
      .reduce((sum, a) => sum + a.amount, 0)

    const totalAccruedRevenue = adjustments
      .filter((a) => a.type === 'accrued_recognition')
      .reduce((sum, a) => sum + a.amount, 0)

    if (totalDeferredRevenue === 0 && totalAccruedRevenue === 0) {
      return null
    }

    const lines: Array<{
      accountCode: string
      accountName: string
      debit: number
      credit: number
    }> = []

    if (totalDeferredRevenue > 0) {
      lines.push({
        accountCode: '4200',
        accountName: '前受収益',
        debit: 0,
        credit: totalDeferredRevenue,
      })
      lines.push({
        accountCode: '7000',
        accountName: '売上高',
        debit: totalDeferredRevenue,
        credit: 0,
      })
    }

    if (totalAccruedRevenue > 0) {
      lines.push({
        accountCode: '1300',
        accountName: '未収収益',
        debit: totalAccruedRevenue,
        credit: 0,
      })
      lines.push({
        accountCode: '7000',
        accountName: '売上高',
        debit: 0,
        credit: totalAccruedRevenue,
      })
    }

    if (lines.length < 2) {
      return null
    }

    const entry: AdjustingEntry = {
      id: generateAdjustmentId(),
      projectId,
      type: 'revenue_recognition',
      description: '収益認識タイミングの調整（5基準の適用）',
      descriptionEn: 'Revenue recognition timing adjustment (5-step model application)',
      lines,
      ifrsReference: 'IFRS 15 Revenue from Contracts with Customers',
      usgaapReference: 'ASC 606 Revenue from Contracts with Customers',
      aiSuggested: false,
      isApproved: false,
    }

    return entry
  }

  getReference(targetStandard: 'USGAAP' | 'IFRS'): string {
    return targetStandard === 'IFRS'
      ? 'IFRS 15 Revenue from Contracts with Customers'
      : 'ASC 606 Revenue from Contracts with Customers'
  }

  private async analyzeRevenueRecognition(
    sourceData: SourceFinancialData
  ): Promise<Array<{ type: 'deferred_recognition' | 'accrued_recognition'; amount: number }>> {
    const adjustments: Array<{
      type: 'deferred_recognition' | 'accrued_recognition'
      amount: number
    }> = []

    const prepaidRevenue = sourceData.balanceSheet.liabilities.current.find(
      (l) => l.name.includes('前受') || l.name.includes('Advances')
    )
    if (prepaidRevenue && prepaidRevenue.amount > 0) {
      const adjustmentAmount = Math.round(prepaidRevenue.amount * 0.1)
      adjustments.push({
        type: 'accrued_recognition',
        amount: adjustmentAmount,
      })
    }

    const accruedRevenue = sourceData.balanceSheet.assets.current.find(
      (a) => a.name.includes('未収') || a.name.includes('Accrued')
    )
    if (accruedRevenue && accruedRevenue.amount > 0) {
      const adjustmentAmount = Math.round(accruedRevenue.amount * 0.05)
      adjustments.push({
        type: 'deferred_recognition',
        amount: adjustmentAmount,
      })
    }

    return adjustments
  }
}
