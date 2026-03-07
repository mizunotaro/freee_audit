import type { AdjustmentType, AdjustingEntry } from '@/types/conversion'

export interface BalanceSheetAsset {
  code: string
  name: string
  amount: number
  category?: string
}

export interface BalanceSheetLiability {
  code: string
  name: string
  amount: number
  category?: string
}

export interface BalanceSheetEquity {
  code: string
  name: string
  amount: number
}

export interface BalanceSheet {
  assets: {
    current: BalanceSheetAsset[]
    fixed: BalanceSheetAsset[]
  }
  liabilities: {
    current: BalanceSheetLiability[]
    fixed: BalanceSheetLiability[]
  }
  equity: BalanceSheetEquity[]
  totalAssets: number
  totalLiabilities: number
  totalEquity: number
}

export interface ProfitLossItem {
  code: string
  name: string
  amount: number
}

export interface ProfitLoss {
  revenue: ProfitLossItem[]
  costOfSales: ProfitLossItem[]
  sgaExpenses: ProfitLossItem[]
  nonOperatingIncome: ProfitLossItem[]
  nonOperatingExpenses: ProfitLossItem[]
  grossProfit: number
  operatingIncome: number
  netIncome: number
}

export interface JournalLine {
  accountCode: string
  accountName: string
  debit: number
  credit: number
}

export interface Journal {
  id: string
  entryDate: Date
  description: string
  lines: JournalLine[]
}

export interface FixedAsset {
  id: string
  code: string
  name: string
  acquisitionCost: number
  accumulatedDepreciation: number
  netBookValue: number
  usefulLife: number
  acquisitionDate: Date
  depreciationMethod: string
}

export interface Debt {
  id: string
  code: string
  name: string
  principal: number
  interestRate: number
  maturityDate: Date
  startDate: Date
  paymentType: 'monthly' | 'quarterly' | 'annual' | 'bullet'
}

export interface Lease {
  id: string
  code: string
  name: string
  leaseType: 'operating' | 'finance'
  leaseTerm: number
  leasePayment: number
  paymentFrequency: 'monthly' | 'quarterly' | 'annual'
  startDate: Date
  endDate: Date
  discountRate?: number
  residualValue?: number
}

export interface SourceFinancialData {
  balanceSheet: BalanceSheet
  profitLoss: ProfitLoss
  journals: Journal[]
  fixedAssets: FixedAsset[]
  debts: Debt[]
  leases?: Lease[]
}

export interface ImpactEstimate {
  assetChange: number
  liabilityChange: number
  equityChange: number
  netIncomeChange: number
  affectedAccounts: string[]
}

export interface AdjustmentStrategy {
  readonly type: AdjustmentType
  readonly name: string
  readonly description: string

  isApplicable(sourceData: SourceFinancialData, targetStandard: 'USGAAP' | 'IFRS'): boolean

  calculate(
    projectId: string,
    sourceData: SourceFinancialData,
    targetStandard: 'USGAAP' | 'IFRS'
  ): Promise<AdjustingEntry | null>

  getReference(targetStandard: 'USGAAP' | 'IFRS'): string
}

export function generateAdjustmentId(): string {
  return `adj_${crypto.randomUUID()}`
}

export function validateAdjustingEntry(entry: AdjustingEntry): {
  isValid: boolean
  error?: string
} {
  const totalDebit = entry.lines.reduce((sum, line) => sum + line.debit, 0)
  const totalCredit = entry.lines.reduce((sum, line) => sum + line.credit, 0)

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return {
      isValid: false,
      error: `Debit (${totalDebit}) and Credit (${totalCredit}) do not balance`,
    }
  }

  if (entry.lines.length === 0) {
    return {
      isValid: false,
      error: 'Adjusting entry must have at least one line',
    }
  }

  return { isValid: true }
}

export function calculatePresentValue(
  payment: number,
  rate: number,
  periods: number,
  frequency: number = 12
): number {
  const periodicRate = rate / frequency
  const totalPeriods = periods * frequency

  if (periodicRate === 0) {
    return payment * totalPeriods
  }

  const presentValue = (payment * (1 - Math.pow(1 + periodicRate, -totalPeriods))) / periodicRate
  return Math.round(presentValue)
}
