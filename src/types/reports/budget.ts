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

export interface BudgetVsActual {
  fiscalYear: number
  month: number
  items: BudgetItem[]
  totals: {
    revenue: { budget: number; actual: number; variance: number; rate: number }
    expenses: { budget: number; actual: number; variance: number; rate: number }
    operatingIncome: { budget: number; actual: number; variance: number; rate: number }
  }
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

export interface BudgetReportData {
  budgetVsActual: BudgetVsActual
  detailedBudget: DetailedBudget
  variance: VarianceData
  budgets: BudgetRecord[]
}
