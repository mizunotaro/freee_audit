export interface CashFlowChartData {
  month: string
  operating: number
  investing: number
  financing: number
  netCash: number
  cumulative: number
}

export interface CashFlowMonthData {
  month: number
  beginningCash: number
  operatingNet: number
  investingNet: number
  financingNet: number
  netChange: number
  endingCash: number
}

export interface CashFlowPosition {
  fiscalYear: number
  months: CashFlowMonthData[]
  annualTotal: {
    operatingNet: number
    investingNet: number
    financingNet: number
    netChange: number
  }
}

export interface RunwayScenario {
  burnRate: number
  runwayMonths: number
}

export interface RunwayData {
  monthlyBurnRate: number
  runwayMonths: number
  scenarios: {
    optimistic: RunwayScenario
    realistic: RunwayScenario
    pessimistic: RunwayScenario
  }
}

export interface RunwayAlert {
  level: 'safe' | 'warning' | 'critical'
  message: string
  recommendation: string
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

export interface CashOutForecast {
  date: string
  amount: number
  category: string
  description: string
  partnerName: string | null
  urgency: 'high' | 'medium' | 'low'
}

export interface MonthlyCashOutSummary {
  month: string
  totalAmount: number
  itemCount: number
  categories: {
    payable: number
    loan: number
    other: number
  }
}

export interface CashFlowReportData {
  cashFlows: CashFlowStatementItem[]
  cashPosition: CashFlowPosition | null
  runway: RunwayData | null
  alert: RunwayAlert | null
}
