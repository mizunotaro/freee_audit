export * from './journal'
export * from './audit'

export interface User {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'ACCOUNTANT' | 'VIEWER' | 'INVESTOR'
  companyId?: string
}

export interface Company {
  id: string
  freeeCompanyId?: string
  name: string
  fiscalYearStart: number
}

export interface ApiResponse<T> {
  data?: T
  error?: {
    code: string
    message: string
    details?: Array<{ field: string; message: string }>
  }
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface BalanceSheetItem {
  code: string
  name: string
  amount: number
  previousAmount?: number
  children?: BalanceSheetItem[]
}

export interface BalanceSheet {
  fiscalYear: number
  month: number
  assets: {
    current: BalanceSheetItem[]
    fixed: BalanceSheetItem[]
    total: number
  }
  liabilities: {
    current: BalanceSheetItem[]
    fixed: BalanceSheetItem[]
    total: number
  }
  equity: {
    items: BalanceSheetItem[]
    total: number
  }
  totalAssets: number
  totalLiabilities: number
  totalEquity: number
}

export interface ProfitLossItem {
  code: string
  name: string
  amount: number
  previousAmount?: number
  percentage?: number
  category?: string
}

export interface ProfitLoss {
  fiscalYear: number
  month: number
  revenue: ProfitLossItem[]
  costOfSales: ProfitLossItem[]
  grossProfit: number
  grossProfitMargin: number
  sgaExpenses: ProfitLossItem[]
  operatingIncome: number
  operatingMargin: number
  nonOperatingIncome: ProfitLossItem[]
  nonOperatingExpenses: ProfitLossItem[]
  ordinaryIncome: number
  extraordinaryIncome: ProfitLossItem[]
  extraordinaryLoss: ProfitLossItem[]
  incomeBeforeTax: number
  incomeTax: number
  netIncome: number
  depreciation: number
}

export interface CashFlowStatement {
  fiscalYear?: number
  month?: number
  operating?: {
    items: Array<{ name: string; amount: number }>
    netCashFromOperating: number
  }
  investing?: {
    items: Array<{ name: string; amount: number }>
    netCashFromInvesting: number
  }
  financing?: {
    items: Array<{ name: string; amount: number }>
    netCashFromFinancing: number
  }
  operatingActivities?: {
    netIncome: number
    depreciation: number
    increaseInReceivables: number
    decreaseInInventory: number
    increaseInPayables: number
    otherNonCash: number
    netCashFromOperating: number
  }
  investingActivities?: {
    purchaseOfFixedAssets: number
    saleOfFixedAssets: number
    netCashFromInvesting: number
  }
  financingActivities?: {
    proceedsFromBorrowing: number
    repaymentOfBorrowing: number
    dividendPaid: number
    netCashFromFinancing: number
  }
  netChangeInCash: number
  beginningCash: number
  endingCash: number
  periodStart?: Date
  periodEnd?: Date
}

export interface CashPositionMonthly {
  month: number
  beginningCash: number
  operatingInflow: number
  operatingOutflow: number
  operatingNet: number
  investingNet: number
  financingNet: number
  netChange: number
  endingCash: number
}

export interface CashPosition {
  fiscalYear: number
  months: CashPositionMonthly[]
  annualTotal: {
    operatingNet: number
    investingNet: number
    financingNet: number
    netChange: number
  }
}

export interface RunwayCalculation {
  monthlyBurnRate: number
  runwayMonths: number
  zeroCashDate: Date
  currentCash: number
  scenarios: {
    optimistic: { burnRate: number; runwayMonths: number }
    realistic: { burnRate: number; runwayMonths: number }
    pessimistic: { burnRate: number; runwayMonths: number }
  }
}

export interface FinancialKPIs {
  fiscalYear: number
  month: number
  profitability: {
    roe: number
    roa: number
    ros: number
    grossProfitMargin: number
    operatingMargin: number
    ebitdaMargin: number
  }
  efficiency: {
    assetTurnover: number
    inventoryTurnover: number
    receivablesTurnover: number
    payablesTurnover: number
  }
  safety: {
    currentRatio: number
    quickRatio: number
    debtToEquity: number
    equityRatio: number
  }
  growth: {
    revenueGrowth: number
    profitGrowth: number
  }
  cashFlow: {
    fcf: number
    fcfMargin: number
  }
}

export interface BudgetItem {
  id: string
  companyId: string
  fiscalYear: number
  month: number
  departmentId?: string
  accountCode: string
  accountName: string
  budgetAmount: number
  actualAmount: number
  variance: number
  achievementRate: number
}

export interface ActualVsBudget {
  fiscalYear: number
  month: number
  items: BudgetItem[]
  totals: {
    revenue: { budget: number; actual: number; variance: number; rate: number }
    expenses: { budget: number; actual: number; variance: number; rate: number }
    operatingIncome: { budget: number; actual: number; variance: number; rate: number }
  }
}

export interface MonthlyReport {
  fiscalYear: number
  month: number
  companyName: string
  balanceSheet: BalanceSheet
  profitLoss: ProfitLoss
  cashFlow: CashFlowStatement
  cashPosition: CashPosition
  kpis: FinancialKPIs
  budget: ActualVsBudget
  runway: RunwayCalculation
}

export interface MonthlyTrend {
  month: string
  revenue: number
  grossProfit: number
  operatingIncome: number
  netIncome: number
  cash: number
}

export interface ExchangeRate {
  id: string
  rateDate: Date
  fromCurrency: string
  toCurrency: string
  rate: number
  source: string
  createdAt: Date
}

export type ExchangeRateSource = 'BOJ' | 'ECB' | 'IMF'

export interface CurrencyConversion {
  originalAmount: number
  originalCurrency: string
  fromCurrency: string
  toCurrency: string
  convertedCurrency: string
  amount: number
  rate: number
  convertedAmount: number
  rateDate: Date
  source: ExchangeRateSource
}

export interface KPIResult {
  name: string
  value: number
  unit: string
  format: 'percentage' | 'currency' | 'number' | 'months' | 'ratio'
  description?: string
}
