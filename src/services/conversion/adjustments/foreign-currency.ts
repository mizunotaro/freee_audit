import type { AdjustingEntry } from '@/types/conversion'
import { type AdjustmentStrategy, type SourceFinancialData, generateAdjustmentId } from './types'

export class ForeignCurrencyAdjustment implements AdjustmentStrategy {
  readonly type = 'foreign_currency'
  readonly name = '外貨換算の調整'
  readonly description = '外貨建資産・負債の換算差額調整'

  private readonly DEFAULT_EXCHANGE_RATE = 150

  isApplicable(sourceData: SourceFinancialData, _targetStandard: 'USGAAP' | 'IFRS'): boolean {
    const foreignCurrencyAccounts = [
      ...sourceData.balanceSheet.assets.current,
      ...sourceData.balanceSheet.assets.fixed,
      ...sourceData.balanceSheet.liabilities.current,
      ...sourceData.balanceSheet.liabilities.fixed,
    ].filter(
      (a) =>
        a.name.includes('外貨') ||
        a.name.includes('Foreign') ||
        a.name.includes('USD') ||
        a.name.includes('EUR') ||
        a.name.includes('ドル') ||
        a.name.includes('ユーロ')
    )

    if (foreignCurrencyAccounts.length > 0) {
      return true
    }

    for (const journal of sourceData.journals) {
      for (const line of journal.lines) {
        if (
          line.accountName.includes('為替') ||
          line.accountName.includes('換算') ||
          line.accountName.includes('Exchange') ||
          line.accountName.includes('Translation')
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
    const translationAdjustments = this.calculateTranslationAdjustments(sourceData)

    if (translationAdjustments.items.length === 0) {
      return null
    }

    const { assetAdjustment, liabilityAdjustment, equityAdjustment } = translationAdjustments

    if (assetAdjustment === 0 && liabilityAdjustment === 0 && equityAdjustment === 0) {
      return null
    }

    const lines: Array<{
      accountCode: string
      accountName: string
      debit: number
      credit: number
    }> = []

    if (assetAdjustment !== 0) {
      if (assetAdjustment > 0) {
        lines.push({
          accountCode: '1350',
          accountName: '外貨建資産',
          debit: assetAdjustment,
          credit: 0,
        })
      } else {
        lines.push({
          accountCode: '1350',
          accountName: '外貨建資産',
          debit: 0,
          credit: Math.abs(assetAdjustment),
        })
      }
    }

    if (liabilityAdjustment !== 0) {
      if (liabilityAdjustment > 0) {
        lines.push({
          accountCode: '4550',
          accountName: '外貨建負債',
          debit: 0,
          credit: liabilityAdjustment,
        })
      } else {
        lines.push({
          accountCode: '4550',
          accountName: '外貨建負債',
          debit: Math.abs(liabilityAdjustment),
          credit: 0,
        })
      }
    }

    if (equityAdjustment !== 0) {
      if (equityAdjustment > 0) {
        lines.push({
          accountCode: '6750',
          accountName: '為替換算調整勘定',
          debit: 0,
          credit: equityAdjustment,
        })
      } else {
        lines.push({
          accountCode: '6750',
          accountName: '為替換算調整勘定',
          debit: Math.abs(equityAdjustment),
          credit: 0,
        })
      }
    }

    if (lines.length < 2) {
      return null
    }

    const entry: AdjustingEntry = {
      id: generateAdjustmentId(),
      projectId,
      type: 'foreign_currency',
      description: '外貨建資産・負債の期末日レート換算調整',
      descriptionEn: 'Foreign currency translation adjustment at closing rate',
      lines,
      ifrsReference: 'IAS 21 The Effects of Changes in Foreign Exchange Rates',
      usgaapReference: 'ASC 830 Foreign Currency Matters',
      aiSuggested: false,
      isApproved: false,
    }

    return entry
  }

  getReference(targetStandard: 'USGAAP' | 'IFRS'): string {
    return targetStandard === 'IFRS'
      ? 'IAS 21 The Effects of Changes in Foreign Exchange Rates'
      : 'ASC 830 Foreign Currency Matters'
  }

  private calculateTranslationAdjustments(sourceData: SourceFinancialData): {
    items: Array<{ code: string; name: string; adjustment: number }>
    assetAdjustment: number
    liabilityAdjustment: number
    equityAdjustment: number
  } {
    const items: Array<{ code: string; name: string; adjustment: number }> = []
    let assetAdjustment = 0
    let liabilityAdjustment = 0

    const foreignAssets = [
      ...sourceData.balanceSheet.assets.current,
      ...sourceData.balanceSheet.assets.fixed,
    ].filter(
      (a) =>
        a.name.includes('外貨') ||
        a.name.includes('Foreign') ||
        a.name.includes('USD') ||
        a.name.includes('EUR')
    )

    for (const asset of foreignAssets) {
      const impliedFCAmount = asset.amount / this.DEFAULT_EXCHANGE_RATE
      const rateChange = 0.02
      const adjustment = Math.round(impliedFCAmount * this.DEFAULT_EXCHANGE_RATE * rateChange)
      items.push({
        code: asset.code,
        name: asset.name,
        adjustment,
      })
      assetAdjustment += adjustment
    }

    const foreignLiabilities = [
      ...sourceData.balanceSheet.liabilities.current,
      ...sourceData.balanceSheet.liabilities.fixed,
    ].filter(
      (l) =>
        l.name.includes('外貨') ||
        l.name.includes('Foreign') ||
        l.name.includes('USD') ||
        l.name.includes('EUR')
    )

    for (const liability of foreignLiabilities) {
      const impliedFCAmount = liability.amount / this.DEFAULT_EXCHANGE_RATE
      const rateChange = 0.02
      const adjustment = Math.round(impliedFCAmount * this.DEFAULT_EXCHANGE_RATE * rateChange)
      items.push({
        code: liability.code,
        name: liability.name,
        adjustment,
      })
      liabilityAdjustment += adjustment
    }

    const equityAdjustment = assetAdjustment - liabilityAdjustment

    return {
      items,
      assetAdjustment,
      liabilityAdjustment,
      equityAdjustment,
    }
  }
}
