import type { ActualVsBudget, BudgetItem, ProfitLoss } from '@/types'
import { safeDivide } from '@/lib/utils'
import { getBudgetsByMonth } from './budget-service'

export async function calculateActualVsBudget(
  companyId: string,
  fiscalYear: number,
  month: number,
  actualPL: ProfitLoss
): Promise<ActualVsBudget> {
  const budgets = await getBudgetsByMonth(companyId, fiscalYear, month)
  const budgetMap = new Map(budgets.map((b) => [b.accountCode, b]))

  const items: BudgetItem[] = []
  let totalRevenueBudget = 0
  let totalRevenueActual = 0
  let totalExpensesBudget = 0
  let totalExpensesActual = 0

  for (const revenue of actualPL.revenue) {
    const budget = budgetMap.get(revenue.code)
    const budgetAmount = budget?.amount || 0
    const actualAmount = revenue.amount
    const variance = actualAmount - budgetAmount
    const achievementRate = safeDivide(actualAmount, budgetAmount) * 100

    totalRevenueBudget += budgetAmount
    totalRevenueActual += actualAmount

    items.push({
      id: budget?.id || '',
      companyId,
      fiscalYear,
      month,
      departmentId: budget?.departmentId || undefined,
      accountCode: revenue.code,
      accountName: revenue.name,
      budgetAmount,
      actualAmount,
      variance,
      achievementRate: Math.round(achievementRate * 10) / 10,
    })
  }

  for (const cost of actualPL.costOfSales) {
    const budget = budgetMap.get(cost.code)
    const budgetAmount = budget?.amount || 0
    const actualAmount = cost.amount
    const variance = actualAmount - budgetAmount
    const achievementRate = safeDivide(actualAmount, budgetAmount) * 100

    totalExpensesBudget += budgetAmount
    totalExpensesActual += actualAmount

    items.push({
      id: budget?.id || '',
      companyId,
      fiscalYear,
      month,
      departmentId: budget?.departmentId || undefined,
      accountCode: cost.code,
      accountName: cost.name,
      budgetAmount,
      actualAmount,
      variance,
      achievementRate: Math.round(achievementRate * 10) / 10,
    })
  }

  for (const expense of actualPL.sgaExpenses) {
    const budget = budgetMap.get(expense.code)
    const budgetAmount = budget?.amount || 0
    const actualAmount = expense.amount
    const variance = actualAmount - budgetAmount
    const achievementRate = safeDivide(actualAmount, budgetAmount) * 100

    totalExpensesBudget += budgetAmount
    totalExpensesActual += actualAmount

    items.push({
      id: budget?.id || '',
      companyId,
      fiscalYear,
      month,
      departmentId: budget?.departmentId || undefined,
      accountCode: expense.code,
      accountName: expense.name,
      budgetAmount,
      actualAmount,
      variance,
      achievementRate: Math.round(achievementRate * 10) / 10,
    })
  }

  const operatingIncomeBudget = totalRevenueBudget - totalExpensesBudget
  const operatingIncomeActual = actualPL.operatingIncome
  const operatingIncomeVariance = operatingIncomeActual - operatingIncomeBudget
  const operatingIncomeRate = safeDivide(operatingIncomeActual, operatingIncomeBudget) * 100

  return {
    fiscalYear,
    month,
    items,
    totals: {
      revenue: {
        budget: totalRevenueBudget,
        actual: totalRevenueActual,
        variance: totalRevenueActual - totalRevenueBudget,
        rate: Math.round(safeDivide(totalRevenueActual, totalRevenueBudget) * 100 * 10) / 10,
      },
      expenses: {
        budget: totalExpensesBudget,
        actual: totalExpensesActual,
        variance: totalExpensesActual - totalExpensesBudget,
        rate: Math.round(safeDivide(totalExpensesActual, totalExpensesBudget) * 100 * 10) / 10,
      },
      operatingIncome: {
        budget: operatingIncomeBudget,
        actual: operatingIncomeActual,
        variance: operatingIncomeVariance,
        rate: Math.round(operatingIncomeRate * 10) / 10,
      },
    },
  }
}

export interface BudgetVarianceAnalysis {
  significantVariances: {
    accountCode: string
    accountName: string
    budget: number
    actual: number
    variance: number
    variancePercent: number
    type: 'over' | 'under'
  }[]
  summary: {
    totalBudget: number
    totalActual: number
    totalVariance: number
    variancePercent: number
  }
}

export function analyzeBudgetVariance(
  budgetVsActual: ActualVsBudget,
  thresholdPercent: number = 10
): BudgetVarianceAnalysis {
  const significantVariances: BudgetVarianceAnalysis['significantVariances'] = []

  for (const item of budgetVsActual.items) {
    if (item.budgetAmount === 0) continue

    const variancePercent = (item.variance / item.budgetAmount) * 100

    if (Math.abs(variancePercent) >= thresholdPercent) {
      significantVariances.push({
        accountCode: item.accountCode,
        accountName: item.accountName,
        budget: item.budgetAmount,
        actual: item.actualAmount,
        variance: item.variance,
        variancePercent: Math.round(variancePercent * 10) / 10,
        type: item.variance > 0 ? 'over' : 'under',
      })
    }
  }

  significantVariances.sort((a, b) => Math.abs(b.variancePercent) - Math.abs(a.variancePercent))

  const totals = budgetVsActual.totals
  const totalBudget = totals.revenue.budget - totals.expenses.budget
  const totalActual = totals.revenue.actual - totals.expenses.actual
  const totalVariance = totalActual - totalBudget

  return {
    significantVariances,
    summary: {
      totalBudget,
      totalActual,
      totalVariance,
      variancePercent: Math.round(safeDivide(totalVariance, totalBudget) * 100 * 10) / 10,
    },
  }
}

export interface MonthlyBudgetTrend {
  month: number
  budget: number
  actual: number
  variance: number
  rate: number
}

export async function getMonthlyBudgetTrend(
  companyId: string,
  fiscalYear: number,
  monthlyActuals: Map<number, ProfitLoss>
): Promise<MonthlyBudgetTrend[]> {
  const trends: MonthlyBudgetTrend[] = []

  for (let month = 1; month <= 12; month++) {
    const budgets = await getBudgetsByMonth(companyId, fiscalYear, month)
    const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0)

    const actual = monthlyActuals.get(month)
    const totalActual = actual ? actual.netIncome : 0
    const variance = totalActual - totalBudget
    const rate = safeDivide(totalActual, totalBudget) * 100

    trends.push({
      month,
      budget: totalBudget,
      actual: totalActual,
      variance,
      rate: Math.round(rate * 10) / 10,
    })
  }

  return trends
}
