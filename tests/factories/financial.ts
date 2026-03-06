import type { BalanceSheet, ProfitLoss, CashFlowStatement } from '@/types'

export function createBalanceSheet(overrides: Partial<BalanceSheet> = {}): BalanceSheet {
  const defaults: BalanceSheet = {
    fiscalYear: 2024,
    month: 12,
    assets: {
      current: [
        { code: '1000', name: '現金', amount: 5000000 },
        { code: '1100', name: '売掛金', amount: 3000000 },
        { code: '1200', name: '棚卸資産', amount: 2000000 },
      ],
      fixed: [
        { code: '2000', name: '建物', amount: 10000000 },
        { code: '2100', name: '減価償却累計額', amount: -2000000 },
      ],
      total: 18000000,
    },
    liabilities: {
      current: [
        { code: '3000', name: '買掛金', amount: 2000000 },
        { code: '3100', name: '短期借入金', amount: 1000000 },
      ],
      fixed: [{ code: '4000', name: '長期借入金', amount: 5000000 }],
      total: 8000000,
    },
    equity: {
      items: [
        { code: '5000', name: '資本金', amount: 5000000 },
        { code: '5100', name: '利益剰余金', amount: 5000000 },
      ],
      total: 10000000,
    },
    totalAssets: 18000000,
    totalLiabilities: 8000000,
    totalEquity: 10000000,
  }

  return { ...defaults, ...overrides }
}

export function createProfitLoss(overrides: Partial<ProfitLoss> = {}): ProfitLoss {
  const defaults: ProfitLoss = {
    fiscalYear: 2024,
    month: 12,
    revenue: [{ code: 'R001', name: '売上高', amount: 20000000 }],
    costOfSales: [{ code: 'C001', name: '売上原価', amount: 12000000 }],
    grossProfit: 8000000,
    grossProfitMargin: 40,
    sgaExpenses: [
      { code: 'E001', name: '給与手当', amount: 3000000 },
      { code: 'E002', name: '広告宣伝費', amount: 500000 },
    ],
    operatingIncome: 4500000,
    operatingMargin: 22.5,
    nonOperatingIncome: [{ code: 'NO01', name: '営業外収益', amount: 200000 }],
    nonOperatingExpenses: [{ code: 'NE01', name: '営業外費用', amount: 300000 }],
    ordinaryIncome: 4400000,
    extraordinaryIncome: [],
    extraordinaryLoss: [],
    incomeBeforeTax: 4400000,
    incomeTax: 500000,
    netIncome: 3900000,
    depreciation: 500000,
  }

  return { ...defaults, ...overrides }
}

export function createCashFlowStatement(
  overrides: Partial<CashFlowStatement> = {}
): CashFlowStatement {
  const defaults: CashFlowStatement = {
    fiscalYear: 2024,
    month: 12,
    operating: {
      items: [],
      netCashFromOperating: 4400000,
    },
    investing: {
      items: [],
      netCashFromInvesting: -1000000,
    },
    financing: {
      items: [],
      netCashFromFinancing: -500000,
    },
    netChangeInCash: 2900000,
    beginningCash: 2100000,
    endingCash: 5000000,
  }

  return { ...defaults, ...overrides }
}

export function createEmptyBalanceSheet(): BalanceSheet {
  return createBalanceSheet({
    assets: { current: [], fixed: [], total: 0 },
    liabilities: { current: [], fixed: [], total: 0 },
    equity: { items: [], total: 0 },
    totalAssets: 0,
    totalLiabilities: 0,
    totalEquity: 0,
  })
}

export function createEmptyProfitLoss(): ProfitLoss {
  return createProfitLoss({
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
  })
}
