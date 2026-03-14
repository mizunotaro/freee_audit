export interface KPIValue {
  name: string
  value: number
  unit: string
  format: 'percentage' | 'currency' | 'number' | 'months' | 'ratio'
  description?: string
}

export interface KPICategory {
  name: string
  kpis: KPIValue[]
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
  benchmarks: {
    kpi: string
    value: number
    benchmark: number
    status: 'good' | 'warning' | 'bad'
    description: string
  }[]
  advice?: {
    category: string
    kpiName: string
    currentValue: number
    targetValue: number | string
    status: 'good' | 'warning' | 'critical'
    advice: string
    actionItems: string[]
  }[]
  yearlyKPIs: KPITrend[]
}
