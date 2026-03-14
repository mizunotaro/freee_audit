export interface KPIProfitability {
  roe: number
  roa: number
  ros: number
  grossProfitMargin: number
  operatingMargin: number
  ebitdaMargin: number
}

export interface KPIEfficiency {
  assetTurnover: number
  inventoryTurnover: number
  receivablesTurnover: number
  payablesTurnover: number
}

export interface KPISafety {
  currentRatio: number
  quickRatio: number
  debtToEquity: number
  equityRatio: number
}

export interface KPIGrowth {
  revenueGrowth: number
  profitGrowth: number
}

export interface KPICashFlow {
  fcf: number
  fcfMargin: number
}

export interface KPIStartup {
  burnRate: number
  runwayMonths: number
  cac: number | null
  ltv: number | null
  ltvCacRatio: number | null
  mrr: number
  arr: number
  churnRate: number | null
}

export interface KPIVC {
  revenueMultiple: number | null
  growthRate: number
  grossMargin: number
  nrr: number | null
  magicNumber: number | null
  ruleOf40: number
}

export interface KPIBank {
  dscr: number
  interestCoverageRatio: number
  fixedChargeCoverageRatio: number
  debtToEquityRatio: number
  debtServiceRatio: number
}

export interface KPIs {
  profitability: KPIProfitability
  efficiency: KPIEfficiency
  safety: KPISafety
  growth: KPIGrowth
  cashFlow: KPICashFlow
  startup?: KPIStartup
  vc?: KPIVC
  bank?: KPIBank
}

export interface KPIBenchmark {
  kpi: string
  value: number
  benchmark: number
  status: 'good' | 'warning' | 'bad'
  description: string
}

export interface KPIAdvice {
  category: string
  kpiName: string
  currentValue: number
  targetValue: number | string
  status: 'good' | 'warning' | 'critical'
  advice: string
  actionItems: string[]
}

export interface KPIYearly {
  month: number
  roe: number
  roa: number
  grossProfitMargin: number
  operatingMargin: number
  currentRatio: number
  equityRatio: number
}

export interface KPIData {
  kpis: KPIs
  benchmarks: KPIBenchmark[]
  advice?: KPIAdvice[]
  yearlyKPIs: KPIYearly[]
}

export interface BudgetItem {
  accountCode: string
  accountName: string
  budgetAmount: number
  actualAmount: number
  variance: number
  achievementRate: number
}

export interface BudgetRecord {
  id: string
  fiscalYear: number
  month: number
  accountCode: string
  accountName: string
  amount: number
  departmentId?: string | null
}

export interface BudgetTotals {
  revenue: { budget: number; actual: number; variance: number; rate: number }
  expenses: { budget: number; actual: number; variance: number; rate: number }
  operatingIncome: { budget: number; actual: number; variance: number; rate: number }
}

export interface BudgetVsActual {
  fiscalYear: number
  month: number
  items: BudgetItem[]
  totals: BudgetTotals
}

export interface StageLevelItem {
  stage: string
  budget: number
  actual: number
  variance: number
  rate: number
  status: 'good' | 'warning' | 'bad'
}

export interface AccountLevelItem {
  code: string
  name: string
  category: string
  budget: number
  actual: number
  variance: number
  rate: number
  status: 'good' | 'warning' | 'bad'
}

export interface DetailedBudget {
  stageLevel: StageLevelItem[]
  accountLevel: AccountLevelItem[]
}

export interface VarianceItem {
  accountName: string
  budget: number
  actual: number
  variancePercent: number
  type: 'over' | 'under'
}

export interface VarianceData {
  significantVariances: VarianceItem[]
}

export interface CashFlowData {
  month: string
  operating: number
  investing: number
  financing: number
  netCash: number
  cumulative: number
}

export interface CashFlowStatementItem {
  month: number
  operatingActivities: {
    netCashFromOperating: number
  }
  investingActivities: {
    netCashFromInvesting: number
  }
  financingActivities: {
    netCashFromFinancing: number
  }
}

export interface CashPositionMonth {
  month: number
  beginningCash: number
  operatingNet: number
  investingNet: number
  financingNet: number
  netChange: number
  endingCash: number
}

export interface CashPosition {
  fiscalYear: number
  months: CashPositionMonth[]
  annualTotal: {
    operatingNet: number
    investingNet: number
    financingNet: number
    netChange: number
  }
}

export interface RunwayScenarios {
  optimistic: { burnRate: number; runwayMonths: number }
  realistic: { burnRate: number; runwayMonths: number }
  pessimistic: { burnRate: number; runwayMonths: number }
}

export interface RunwayData {
  monthlyBurnRate: number
  runwayMonths: number
  scenarios: RunwayScenarios
}

export interface RunwayAlert {
  level: 'safe' | 'warning' | 'critical'
  message: string
  recommendation: string
}

export interface CashOutForecast {
  date: string
  amount: number
  category: string
  description: string
  partnerName: string | null
  urgency: 'high' | 'medium' | 'low'
}

export interface MonthlyCashOutCategories {
  payable: number
  loan: number
  other: number
}

export interface MonthlyCashOutSummary {
  month: string
  totalAmount: number
  itemCount: number
  categories: MonthlyCashOutCategories
}

export interface TrendData {
  category: string
  score: number
  status: string
  summary: string
}

export interface BusinessReportData {
  fiscalYear: number
  companyName: string
  businessOverview: string
  businessEnvironment: string
  managementPolicy: string
  issuesAndRisks: string
  financialHighlights: string
  researchAndDevelopment: string
  corporateGovernance: string
}

export interface KPIReportData {
  kpis: {
    profitability: KPIProfitability
    efficiency: KPIEfficiency
    safety: KPISafety
    growth: KPIGrowth
    cashFlow: KPICashFlow
    startup?: KPIStartup
    vc?: KPIVC
    bank?: KPIBank
  }
  benchmarks: KPIBenchmark[]
  advice?: KPIAdvice[]
  yearlyKPIs: KPITrend[]
}

export interface KPITrend {
  month: string
  roe: number
  roa: number
  grossProfitMargin: number
  operatingMargin: number
  currentRatio: number
  equityRatio: number
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

export interface CashFlowChartData {
  month: string
  operating: number
  investing: number
  financing: number
  netCash: number
  cumulative: number
}

export interface CashFlowPosition {
  fiscalYear: number
  months: CashPositionMonth[]
  annualTotal: {
    operatingNet: number
    investingNet: number
    financingNet: number
    netChange: number
  }
}

export interface CashFlowReportData {
  cashFlows: CashFlowStatementItem[]
  cashPosition: CashFlowPosition | null
  runway: RunwayData | null
  alert: RunwayAlert | null
}
