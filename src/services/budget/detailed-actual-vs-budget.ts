import type { ProfitLoss } from '@/types'
import { safeDivide } from '@/lib/utils'
import { getBudgetsByMonth } from './budget-service'

export interface StageLevelComparison {
  stage: string
  budget: number
  actual: number
  variance: number
  rate: number
  status: 'good' | 'warning' | 'bad'
}

export interface AccountLevelComparison {
  code: string
  name: string
  category: string
  budget: number
  actual: number
  variance: number
  rate: number
  status: 'good' | 'warning' | 'bad'
}

export interface DetailedActualVsBudget {
  fiscalYear: number
  month: number
  stageLevel: StageLevelComparison[]
  accountLevel: AccountLevelComparison[]
  summary: {
    totalBudget: number
    totalActual: number
    totalVariance: number
    overallRate: number
  }
}

export async function calculateDetailedActualVsBudget(
  companyId: string,
  fiscalYear: number,
  month: number,
  actualPL: ProfitLoss
): Promise<DetailedActualVsBudget> {
  const budgets = await getBudgetsByMonth(companyId, fiscalYear, month)
  const budgetMap = new Map(budgets.map((b) => [b.accountCode, b]))

  const totalRevenueBudget = sumBudgetByCategory(budgets, 'revenue')
  const totalRevenueActual = actualPL.revenue.reduce((s, r) => s + r.amount, 0)

  const totalCostBudget = sumBudgetByCategory(budgets, 'cost_of_sales')
  const totalCostActual = actualPL.costOfSales.reduce((s, c) => s + c.amount, 0)

  const totalSgaBudget = sumBudgetByCategory(budgets, 'sga_expense')
  const totalSgaActual = actualPL.sgaExpenses.reduce((s, e) => s + e.amount, 0)

  const grossProfitBudget = totalRevenueBudget - totalCostBudget
  const grossProfitActual = actualPL.grossProfit

  const operatingIncomeBudget = grossProfitBudget - totalSgaBudget
  const operatingIncomeActual = actualPL.operatingIncome

  const stageLevel: StageLevelComparison[] = [
    {
      stage: '売上高',
      budget: totalRevenueBudget,
      actual: totalRevenueActual,
      variance: totalRevenueActual - totalRevenueBudget,
      rate: safeDivide(totalRevenueActual, totalRevenueBudget) * 100,
      status: getRevenueStatus(totalRevenueActual, totalRevenueBudget),
    },
    {
      stage: '売上原価',
      budget: totalCostBudget,
      actual: totalCostActual,
      variance: totalCostActual - totalCostBudget,
      rate: safeDivide(totalCostActual, totalCostBudget) * 100,
      status: getExpenseStatus(totalCostActual, totalCostBudget),
    },
    {
      stage: '売上総利益',
      budget: grossProfitBudget,
      actual: grossProfitActual,
      variance: grossProfitActual - grossProfitBudget,
      rate: safeDivide(grossProfitActual, grossProfitBudget) * 100,
      status: getRevenueStatus(grossProfitActual, grossProfitBudget),
    },
    {
      stage: '販売管理費',
      budget: totalSgaBudget,
      actual: totalSgaActual,
      variance: totalSgaActual - totalSgaBudget,
      rate: safeDivide(totalSgaActual, totalSgaBudget) * 100,
      status: getExpenseStatus(totalSgaActual, totalSgaBudget),
    },
    {
      stage: '営業利益',
      budget: operatingIncomeBudget,
      actual: operatingIncomeActual,
      variance: operatingIncomeActual - operatingIncomeBudget,
      rate: safeDivide(operatingIncomeActual, operatingIncomeBudget) * 100,
      status: getRevenueStatus(operatingIncomeActual, operatingIncomeBudget),
    },
    {
      stage: '当期純利益',
      budget: operatingIncomeBudget * 0.7,
      actual: actualPL.netIncome,
      variance: actualPL.netIncome - operatingIncomeBudget * 0.7,
      rate: safeDivide(actualPL.netIncome, operatingIncomeBudget * 0.7) * 100,
      status: getRevenueStatus(actualPL.netIncome, operatingIncomeBudget * 0.7),
    },
  ]

  const accountLevel: AccountLevelComparison[] = []

  for (const item of actualPL.revenue) {
    const budget = budgetMap.get(item.code)?.amount || 0
    accountLevel.push({
      code: item.code,
      name: item.name,
      category: 'revenue',
      budget,
      actual: item.amount,
      variance: item.amount - budget,
      rate: safeDivide(item.amount, budget) * 100,
      status: getRevenueStatus(item.amount, budget),
    })
  }

  for (const item of actualPL.costOfSales) {
    const budget = budgetMap.get(item.code)?.amount || 0
    accountLevel.push({
      code: item.code,
      name: item.name,
      category: 'cost_of_sales',
      budget,
      actual: item.amount,
      variance: item.amount - budget,
      rate: safeDivide(item.amount, budget) * 100,
      status: getExpenseStatus(item.amount, budget),
    })
  }

  for (const item of actualPL.sgaExpenses) {
    const budget = budgetMap.get(item.code)?.amount || 0
    accountLevel.push({
      code: item.code,
      name: item.name,
      category: 'sga_expense',
      budget,
      actual: item.amount,
      variance: item.amount - budget,
      rate: safeDivide(item.amount, budget) * 100,
      status: getExpenseStatus(item.amount, budget),
    })
  }

  const summary = {
    totalBudget: totalRevenueBudget - totalCostBudget - totalSgaBudget,
    totalActual: operatingIncomeActual,
    totalVariance: operatingIncomeActual - operatingIncomeBudget,
    overallRate: safeDivide(operatingIncomeActual, operatingIncomeBudget) * 100,
  }

  return {
    fiscalYear,
    month,
    stageLevel,
    accountLevel,
    summary,
  }
}

function sumBudgetByCategory(
  budgets: { accountCode: string; accountName: string; amount: number }[],
  category: string
): number {
  const categoryPrefixes: Record<string, string[]> = {
    revenue: ['4'],
    cost_of_sales: ['5'],
    sga_expense: ['6', '7'],
  }

  const prefixes = categoryPrefixes[category] || []
  return budgets
    .filter((b) => prefixes.some((p) => b.accountCode.startsWith(p)))
    .reduce((sum, b) => sum + b.amount, 0)
}

function getRevenueStatus(actual: number, budget: number): 'good' | 'warning' | 'bad' {
  if (budget === 0) return actual >= 0 ? 'good' : 'bad'
  const rate = (actual / budget) * 100
  if (rate >= 100) return 'good'
  if (rate >= 80) return 'warning'
  return 'bad'
}

function getExpenseStatus(actual: number, budget: number): 'good' | 'warning' | 'bad' {
  if (budget === 0) return actual === 0 ? 'good' : 'warning'
  const rate = (actual / budget) * 100
  if (rate <= 100) return 'good'
  if (rate <= 110) return 'warning'
  return 'bad'
}
