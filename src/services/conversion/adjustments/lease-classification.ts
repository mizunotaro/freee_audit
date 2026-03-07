import type { AdjustingEntry } from '@/types/conversion'
import {
  type AdjustmentStrategy,
  type SourceFinancialData,
  generateAdjustmentId,
  calculatePresentValue,
} from './types'

export class LeaseClassificationAdjustment implements AdjustmentStrategy {
  readonly type = 'lease_classification'
  readonly name = 'リース取引の分類調整'
  readonly description = 'オペレーティングリースの使用権資産・リース負債認識'

  private readonly DEFAULT_DISCOUNT_RATE = 0.05

  isApplicable(sourceData: SourceFinancialData, _targetStandard: 'USGAAP' | 'IFRS'): boolean {
    const leaseAccounts = [
      ...sourceData.balanceSheet.assets.fixed,
      ...sourceData.balanceSheet.liabilities.fixed,
    ].filter(
      (a) => a.name.includes('リース') || a.name.includes('賃借') || a.name.includes('Lease')
    )

    if (leaseAccounts.length > 0) {
      return true
    }

    if (sourceData.leases && sourceData.leases.length > 0) {
      return sourceData.leases.some((l) => l.leaseType === 'operating')
    }

    for (const journal of sourceData.journals) {
      for (const line of journal.lines) {
        if (
          (line.accountName.includes('リース') || line.accountName.includes('賃借料')) &&
          line.debit > 0
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
    const operatingLeases = await this.identifyOperatingLeases(sourceData)

    if (operatingLeases.length === 0) {
      return null
    }

    const { rouAsset, leaseLiability } = this.calculateROUAndLiability(operatingLeases)

    if (rouAsset === 0 && leaseLiability === 0) {
      return null
    }

    const entry: AdjustingEntry = {
      id: generateAdjustmentId(),
      projectId,
      type: 'lease_classification',
      description: 'オペレーティングリースの使用権資産・リース負債への計上',
      descriptionEn:
        'Recognition of right-of-use assets and lease liabilities for operating leases',
      lines: [
        {
          accountCode: '2200',
          accountName: '使用権資産',
          debit: rouAsset,
          credit: 0,
        },
        {
          accountCode: '3100',
          accountName: 'リース負債',
          debit: 0,
          credit: leaseLiability,
        },
      ],
      ifrsReference: 'IFRS 16 Leases',
      usgaapReference: 'ASC 842 Leases',
      aiSuggested: false,
      isApproved: false,
    }

    return entry
  }

  getReference(targetStandard: 'USGAAP' | 'IFRS'): string {
    return targetStandard === 'IFRS' ? 'IFRS 16 Leases' : 'ASC 842 Leases'
  }

  private async identifyOperatingLeases(sourceData: SourceFinancialData): Promise<
    Array<{
      id: string
      name: string
      payment: number
      term: number
      rate: number
    }>
  > {
    const leases: Array<{
      id: string
      name: string
      payment: number
      term: number
      rate: number
    }> = []

    if (sourceData.leases) {
      for (const lease of sourceData.leases) {
        if (lease.leaseType === 'operating') {
          leases.push({
            id: lease.id,
            name: lease.name,
            payment: lease.leasePayment,
            term: lease.leaseTerm,
            rate: lease.discountRate ?? this.DEFAULT_DISCOUNT_RATE,
          })
        }
      }
    }

    const leasePayments = new Map<string, number>()
    for (const journal of sourceData.journals) {
      for (const line of journal.lines) {
        if (
          (line.accountName.includes('リース') || line.accountName.includes('賃借料')) &&
          line.debit > 0
        ) {
          const current = leasePayments.get(line.accountName) || 0
          leasePayments.set(line.accountName, current + line.debit)
        }
      }
    }

    for (const [name, annualPayment] of leasePayments) {
      if (!leases.some((l) => l.name === name)) {
        leases.push({
          id: `implied_${name}`,
          name,
          payment: annualPayment / 12,
          term: 5,
          rate: this.DEFAULT_DISCOUNT_RATE,
        })
      }
    }

    return leases
  }

  private calculateROUAndLiability(
    leases: Array<{ payment: number; term: number; rate: number }>
  ): { rouAsset: number; leaseLiability: number } {
    let totalRouAsset = 0
    let totalLeaseLiability = 0

    for (const lease of leases) {
      const pv = calculatePresentValue(lease.payment, lease.rate, lease.term)
      totalRouAsset += pv
      totalLeaseLiability += pv
    }

    return {
      rouAsset: Math.round(totalRouAsset),
      leaseLiability: Math.round(totalLeaseLiability),
    }
  }
}
