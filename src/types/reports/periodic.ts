export interface PeriodBalanceSheet {
  totalAssets: number
  currentAssets: number
  fixedAssets: number
  totalLiabilities: number
  currentLiabilities: number
  fixedLiabilities: number
  equity: number
}

export interface PeriodProfitLoss {
  revenue: number
  costOfSales: number
  grossProfit: number
  operatingIncome: number
  ordinaryIncome: number
  netIncome: number
}

export interface PeriodCashFlow {
  operatingCF: number
  investingCF: number
  financingCF: number
  freeCashFlow: number
}

export interface PeriodKPIs {
  roe: number
  roa: number
  grossMargin: number
  operatingMargin: number
  currentRatio: number
  debtToEquity: number
}

export interface PeriodData {
  label: string
  fiscalYear: number
  startMonth: number
  endMonth: number
  balanceSheet: PeriodBalanceSheet
  profitLoss: PeriodProfitLoss
  cashFlow: PeriodCashFlow
  kpis: PeriodKPIs
  endingCash: number
}

export interface PeriodicSummary {
  revenueGrowth: number | null
  profitGrowth: number | null
  cashChange: number
  avgROE: number
  avgROA: number
  trendAnalysis: string
}

export interface PeriodicReportData {
  periods: PeriodData[]
  summary: PeriodicSummary
}
