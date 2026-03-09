import type { BalanceSheet, ProfitLoss } from '@/types'
import type { FinancialStatementSet } from '@/services/ai/analyzers/types'

export function createMockBalanceSheet(overrides: Partial<BalanceSheet> = {}): BalanceSheet {
  return {
    fiscalYear: 2024,
    month: 12,
    assets: {
      current: [
        { code: '1001', name: '現金預金', amount: 2000000 },
        { code: '1002', name: '売掛金', amount: 1500000 },
        { code: '1005', name: '棚卸資産', amount: 500000 },
      ],
      fixed: [{ code: '2001', name: '建物', amount: 6000000 }],
      total: 10000000,
    },
    liabilities: {
      current: [
        { code: '3001', name: '買掛金', amount: 1000000 },
        { code: '3002', name: '短期借入金', amount: 500000 },
      ],
      fixed: [{ code: '3003', name: '長期借入金', amount: 3500000 }],
      total: 5000000,
    },
    equity: {
      items: [
        { code: '3101', name: '資本金', amount: 3000000 },
        { code: '3300', name: '利益剰余金', amount: 2000000 },
      ],
      total: 5000000,
    },
    totalAssets: 10000000,
    totalLiabilities: 5000000,
    totalEquity: 5000000,
    ...overrides,
  }
}

export function createMockProfitLoss(overrides: Partial<ProfitLoss> = {}): ProfitLoss {
  return {
    fiscalYear: 2024,
    month: 12,
    revenue: [{ code: '4001', name: '売上高', amount: 50000000 }],
    costOfSales: [{ code: '5001', name: '売上原価', amount: 30000000 }],
    grossProfit: 20000000,
    grossProfitMargin: 40,
    sgaExpenses: [{ code: '6001', name: '販売費及び一般管理費', amount: 15000000 }],
    operatingIncome: 5000000,
    operatingMargin: 10,
    nonOperatingIncome: [],
    nonOperatingExpenses: [],
    ordinaryIncome: 5000000,
    extraordinaryIncome: [],
    extraordinaryLoss: [],
    incomeBeforeTax: 5000000,
    incomeTax: 1000000,
    netIncome: 4000000,
    depreciation: 500000,
    ...overrides,
  }
}

export function createMockStatementSet(
  overrides: {
    balanceSheet?: Partial<BalanceSheet>
    profitLoss?: Partial<ProfitLoss>
    previousBalanceSheet?: Partial<BalanceSheet>
    previousProfitLoss?: Partial<ProfitLoss>
  } = {}
): FinancialStatementSet {
  return {
    balanceSheet: createMockBalanceSheet(overrides.balanceSheet),
    profitLoss: createMockProfitLoss(overrides.profitLoss),
    previousBalanceSheet: overrides.previousBalanceSheet
      ? createMockBalanceSheet(overrides.previousBalanceSheet)
      : undefined,
    previousProfitLoss: overrides.previousProfitLoss
      ? createMockProfitLoss(overrides.previousProfitLoss)
      : undefined,
  }
}

export function createEmptyMockBalanceSheet(): BalanceSheet {
  return {
    fiscalYear: 2024,
    month: 12,
    assets: {
      current: [],
      fixed: [],
      total: 0,
    },
    liabilities: {
      current: [],
      fixed: [],
      total: 0,
    },
    equity: {
      items: [],
      total: 0,
    },
    totalAssets: 0,
    totalLiabilities: 0,
    totalEquity: 0,
  }
}

export function createEmptyMockProfitLoss(): ProfitLoss {
  return {
    fiscalYear: 2024,
    month: 12,
    revenue: [],
    costOfSales: [],
    grossProfit: 0,
    grossProfitMargin: 0,
    sgaExpenses: [],
    operatingIncome: 0,
    operatingMargin: 0,
    nonOperatingIncome: [],
    nonOperatingExpenses: [],
    ordinaryIncome: 0,
    extraordinaryIncome: [],
    extraordinaryLoss: [],
    incomeBeforeTax: 0,
    incomeTax: 0,
    netIncome: 0,
    depreciation: 0,
  }
}
