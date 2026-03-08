import type { AdjustingEntry } from '@/types/conversion'
import { type AdjustmentStrategy, type SourceFinancialData, generateAdjustmentId } from './types'

export class DeferredTaxAdjustment implements AdjustmentStrategy {
  readonly type = 'deferred_tax'
  readonly name = '繰延税金会計の調整'
  readonly description = '繰延税金資産・負債の再計算'

  private readonly DEFAULT_TAX_RATE = 0.3

  isApplicable(sourceData: SourceFinancialData, _targetStandard: 'USGAAP' | 'IFRS'): boolean {
    const deferredTaxAccounts = [
      ...sourceData.balanceSheet.assets.current,
      ...sourceData.balanceSheet.assets.fixed,
      ...sourceData.balanceSheet.liabilities.current,
      ...sourceData.balanceSheet.liabilities.fixed,
    ].filter(
      (a) =>
        a.name.includes('繰延税金') ||
        a.name.includes('Deferred Tax') ||
        a.code.startsWith('165') ||
        a.code.startsWith('465')
    )

    return deferredTaxAccounts.length > 0
  }

  async calculate(
    projectId: string,
    sourceData: SourceFinancialData,
    _targetStandard: 'USGAAP' | 'IFRS'
  ): Promise<AdjustingEntry | null> {
    const temporaryDifferences = this.identifyTemporaryDifferences(sourceData)

    if (temporaryDifferences.length === 0) {
      return null
    }

    const { dtaChange, dtlChange } = this.calculateDeferredTaxChanges(temporaryDifferences)

    if (dtaChange === 0 && dtlChange === 0) {
      return null
    }

    const lines: Array<{
      accountCode: string
      accountName: string
      debit: number
      credit: number
    }> = []

    if (dtaChange > 0) {
      lines.push({
        accountCode: '1650',
        accountName: '繰延税金資産',
        debit: dtaChange,
        credit: 0,
      })
    } else if (dtaChange < 0) {
      lines.push({
        accountCode: '1650',
        accountName: '繰延税金資産',
        debit: 0,
        credit: Math.abs(dtaChange),
      })
    }

    if (dtlChange > 0) {
      lines.push({
        accountCode: '4650',
        accountName: '繰延税金負債',
        debit: 0,
        credit: dtlChange,
      })
    } else if (dtlChange < 0) {
      lines.push({
        accountCode: '4650',
        accountName: '繰延税金負債',
        debit: Math.abs(dtlChange),
        credit: 0,
      })
    }

    const netTaxExpense = dtaChange > 0 ? -dtaChange : dtlChange > 0 ? dtlChange : 0
    if (netTaxExpense !== 0) {
      lines.push({
        accountCode: '9430',
        accountName: '法人税等調整額',
        debit: netTaxExpense > 0 ? netTaxExpense : 0,
        credit: netTaxExpense < 0 ? Math.abs(netTaxExpense) : 0,
      })
    }

    if (lines.length < 2) {
      return null
    }

    const entry: AdjustingEntry = {
      id: generateAdjustmentId(),
      projectId,
      type: 'deferred_tax',
      description: '繰延税金資産・負債の調整',
      descriptionEn: 'Adjustment for deferred tax assets and liabilities',
      lines,
      ifrsReference: 'IAS 12 Income Taxes',
      usgaapReference: 'ASC 740 Income Taxes',
      aiSuggested: false,
      isApproved: false,
    }

    return entry
  }

  getReference(targetStandard: 'USGAAP' | 'IFRS'): string {
    return targetStandard === 'IFRS' ? 'IAS 12 Income Taxes' : 'ASC 740 Income Taxes'
  }

  private identifyTemporaryDifferences(sourceData: SourceFinancialData): Array<{
    type: 'taxable' | 'deductible'
    amount: number
    source: string
  }> {
    const differences: Array<{
      type: 'taxable' | 'deductible'
      amount: number
      source: string
    }> = []

    for (const asset of sourceData.fixedAssets) {
      if (asset.acquisitionCost !== asset.netBookValue * 2) {
        const bookValue = asset.netBookValue
        const impliedTaxBase = asset.acquisitionCost - asset.accumulatedDepreciation
        const diff = bookValue - impliedTaxBase
        if (Math.abs(diff) > 1000) {
          differences.push({
            type: diff > 0 ? 'taxable' : 'deductible',
            amount: Math.abs(diff),
            source: asset.name,
          })
        }
      }
    }

    for (const liability of sourceData.balanceSheet.liabilities.fixed) {
      if (
        liability.name.includes('退職') ||
        liability.name.includes('年金') ||
        liability.name.includes('Pension')
      ) {
        differences.push({
          type: 'deductible',
          amount: liability.amount,
          source: liability.name,
        })
      }
    }

    return differences
  }

  private calculateDeferredTaxChanges(
    differences: Array<{ type: 'taxable' | 'deductible'; amount: number; source: string }>
  ): { dtaChange: number; dtlChange: number; affectedAccounts: string[] } {
    let dtaChange = 0
    let dtlChange = 0
    const affectedAccounts: string[] = []

    for (const diff of differences) {
      const taxEffect = Math.round(diff.amount * this.DEFAULT_TAX_RATE)
      affectedAccounts.push(diff.source)

      if (diff.type === 'taxable') {
        dtlChange += taxEffect
      } else {
        dtaChange += taxEffect
      }
    }

    return { dtaChange, dtlChange, affectedAccounts }
  }
}
