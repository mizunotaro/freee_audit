import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Budget } from '@prisma/client'
import {
  calculateActualVsBudget,
  analyzeBudgetVariance,
  getMonthlyBudgetTrend,
} from '@/services/budget/actual-vs-budget'
import { getBudgetsByMonth, getBudgetsByFiscalYear } from '@/services/budget/budget-service'
import type { ActualVsBudget, BudgetItem, ProfitLoss } from '@/types'

vi.mock('@/services/budget/budget-service', () => ({
  getBudgetsByMonth: vi.fn(),
  getBudgetsByFiscalYear: vi.fn(),
}))

function makeBudget(overrides: Partial<Budget> = {}): Budget {
  return {
    id: 'budget-1',
    companyId: 'company-1',
    fiscalYear: 2024,
    month: 12,
    departmentId: null,
    accountCode: '400',
    accountName: '売上高',
    amount: 0,
    note: null,
    createdAt: new Date(2024, 0, 1),
    updatedAt: new Date(2024, 0, 1),
    ...overrides,
  }
}

function makePL(overrides: Partial<ProfitLoss> = {}): ProfitLoss {
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
    ...overrides,
  }
}

describe('actual-vs-budget', () => {
  const companyId = 'company-1'
  const fiscalYear = 2024
  const month = 12

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('calculateActualVsBudget', () => {
    it('maps budgets to actual PL lines with exact variance and achievement rate', async () => {
      vi.mocked(getBudgetsByMonth).mockResolvedValue([
        makeBudget({
          id: 'b-rev',
          accountCode: '400',
          accountName: '売上高',
          amount: 1000000,
          departmentId: 'dept-1',
        }),
        makeBudget({
          id: 'b-cogs',
          accountCode: '500',
          accountName: '売上原価',
          amount: 600000,
        }),
      ])

      const pl = makePL({
        revenue: [{ code: '400', name: '売上高', amount: 1200000 }],
        costOfSales: [{ code: '500', name: '売上原価', amount: 500000 }],
        sgaExpenses: [{ code: '610', name: '給与手当', amount: 200000 }],
        operatingIncome: 500000,
      })

      const result = await calculateActualVsBudget(companyId, fiscalYear, month, pl)

      expect(getBudgetsByMonth).toHaveBeenCalledWith(companyId, fiscalYear, month)
      expect(result.fiscalYear).toBe(fiscalYear)
      expect(result.month).toBe(month)
      expect(result.items).toHaveLength(3)

      const revenueItem = result.items.find((i) => i.accountCode === '400') as BudgetItem
      expect(revenueItem.id).toBe('b-rev')
      expect(revenueItem.departmentId).toBe('dept-1')
      expect(revenueItem.budgetAmount).toBe(1000000)
      expect(revenueItem.actualAmount).toBe(1200000)
      expect(revenueItem.variance).toBe(200000)
      expect(revenueItem.achievementRate).toBe(120)

      const cogsItem = result.items.find((i) => i.accountCode === '500') as BudgetItem
      expect(cogsItem.budgetAmount).toBe(600000)
      expect(cogsItem.actualAmount).toBe(500000)
      expect(cogsItem.variance).toBe(-100000)
      expect(cogsItem.achievementRate).toBe(83.3)

      // Account with no matching budget: budget 0, achievement rate 0 (safeDivide)
      const sgaItem = result.items.find((i) => i.accountCode === '610') as BudgetItem
      expect(sgaItem.id).toBe('')
      expect(sgaItem.departmentId).toBeUndefined()
      expect(sgaItem.budgetAmount).toBe(0)
      expect(sgaItem.actualAmount).toBe(200000)
      expect(sgaItem.variance).toBe(200000)
      expect(sgaItem.achievementRate).toBe(0)
    })

    it('aggregates totals (revenue / expenses / operating income) with rates', async () => {
      vi.mocked(getBudgetsByMonth).mockResolvedValue([
        makeBudget({ accountCode: '400', amount: 1000000 }),
        makeBudget({ accountCode: '500', amount: 600000 }),
      ])

      const pl = makePL({
        revenue: [{ code: '400', name: '売上高', amount: 1200000 }],
        costOfSales: [{ code: '500', name: '売上原価', amount: 500000 }],
        sgaExpenses: [{ code: '610', name: '給与手当', amount: 200000 }],
        operatingIncome: 500000,
      })

      const result = await calculateActualVsBudget(companyId, fiscalYear, month, pl)

      expect(result.totals.revenue).toEqual({
        budget: 1000000,
        actual: 1200000,
        variance: 200000,
        rate: 120,
      })
      // 600000 budget vs (500000 cogs + 200000 sga) actual = 700000
      expect(result.totals.expenses).toEqual({
        budget: 600000,
        actual: 700000,
        variance: 100000,
        rate: 116.7,
      })
      // operating income budget = 1000000 - 600000 = 400000; actual from PL = 500000
      expect(result.totals.operatingIncome).toEqual({
        budget: 400000,
        actual: 500000,
        variance: 100000,
        rate: 125,
      })
    })

    it('produces zero-rate totals when there are no budgets', async () => {
      vi.mocked(getBudgetsByMonth).mockResolvedValue([])

      const pl = makePL({
        revenue: [{ code: '400', name: '売上高', amount: 1000000 }],
        costOfSales: [],
        sgaExpenses: [],
        operatingIncome: 1000000,
      })

      const result = await calculateActualVsBudget(companyId, fiscalYear, month, pl)

      expect(result.items).toHaveLength(1)
      expect(result.items[0].budgetAmount).toBe(0)
      expect(result.totals.revenue).toEqual({
        budget: 0,
        actual: 1000000,
        variance: 1000000,
        rate: 0,
      })
      expect(result.totals.expenses).toEqual({ budget: 0, actual: 0, variance: 0, rate: 0 })
      // operatingIncomeBudget = 0 - 0 = 0 → rate safeDivide(1000000, 0) = 0
      expect(result.totals.operatingIncome.rate).toBe(0)
      expect(result.totals.operatingIncome.budget).toBe(0)
    })

    it('handles an empty PL (no line items)', async () => {
      vi.mocked(getBudgetsByMonth).mockResolvedValue([
        makeBudget({ accountCode: '400', amount: 1000000 }),
      ])

      const result = await calculateActualVsBudget(companyId, fiscalYear, month, makePL())

      expect(result.items).toEqual([])
      expect(result.totals.revenue).toEqual({ budget: 0, actual: 0, variance: 0, rate: 0 })
      expect(result.totals.expenses).toEqual({ budget: 0, actual: 0, variance: 0, rate: 0 })
      expect(result.totals.operatingIncome).toEqual({ budget: 0, actual: 0, variance: 0, rate: 0 })
    })

    it('propagates errors from getBudgetsByMonth', async () => {
      vi.mocked(getBudgetsByMonth).mockRejectedValue(new Error('db down'))

      await expect(calculateActualVsBudget(companyId, fiscalYear, month, makePL())).rejects.toThrow(
        'db down'
      )
    })
  })

  describe('analyzeBudgetVariance', () => {
    function makeItem(overrides: Partial<BudgetItem>): BudgetItem {
      return {
        id: 'i',
        companyId: 'company-1',
        fiscalYear: 2024,
        month: 12,
        accountCode: '400',
        accountName: '売上高',
        budgetAmount: 0,
        actualAmount: 0,
        variance: 0,
        achievementRate: 0,
        ...overrides,
      }
    }

    function makeAVB(items: BudgetItem[], totals: ActualVsBudget['totals']): ActualVsBudget {
      return { fiscalYear: 2024, month: 12, items, totals }
    }

    const baseTotals: ActualVsBudget['totals'] = {
      revenue: { budget: 1000000, actual: 1200000, variance: 200000, rate: 120 },
      expenses: { budget: 900000, actual: 805000, variance: -95000, rate: 89.4 },
      operatingIncome: { budget: 100000, actual: 395000, variance: 295000, rate: 395 },
    }

    it('flags only variances at/over the threshold and classifies over/under', () => {
      const avb = makeAVB(
        [
          makeItem({
            accountCode: '400',
            accountName: '売上高',
            budgetAmount: 1000000,
            actualAmount: 1200000,
            variance: 200000,
          }),
          makeItem({
            accountCode: '500',
            accountName: '売上原価',
            budgetAmount: 600000,
            actualAmount: 500000,
            variance: -100000,
          }),
          makeItem({
            accountCode: '610',
            accountName: '給与手当',
            budgetAmount: 300000,
            actualAmount: 305000,
            variance: 5000,
          }),
        ],
        baseTotals
      )

      const result = analyzeBudgetVariance(avb, 10)

      // 610: 5000/300000 = 1.67% < 10 → excluded
      expect(result.significantVariances).toHaveLength(2)
      // sorted by |variancePercent| desc: 400 (20%) before 500 (16.7%)
      expect(result.significantVariances[0]).toEqual({
        accountCode: '400',
        accountName: '売上高',
        budget: 1000000,
        actual: 1200000,
        variance: 200000,
        variancePercent: 20,
        type: 'over',
      })
      expect(result.significantVariances[1]).toEqual({
        accountCode: '500',
        accountName: '売上原価',
        budget: 600000,
        actual: 500000,
        variance: -100000,
        variancePercent: -16.7,
        type: 'under',
      })
    })

    it('rounds variancePercent to one decimal and uses the custom threshold', () => {
      const avb = makeAVB(
        [
          makeItem({
            accountCode: '400',
            accountName: '売上高',
            budgetAmount: 1000000,
            actualAmount: 1180000,
            variance: 180000,
          }),
          makeItem({
            accountCode: '500',
            accountName: '売上原価',
            budgetAmount: 600000,
            actualAmount: 500000,
            variance: -100000,
          }),
        ],
        baseTotals
      )

      // threshold 18: 400 = 18% (>= 18, kept), 500 = 16.7% (< 18, dropped)
      const result = analyzeBudgetVariance(avb, 18)

      expect(result.significantVariances).toHaveLength(1)
      expect(result.significantVariances[0].accountCode).toBe('400')
      expect(result.significantVariances[0].variancePercent).toBe(18)
    })

    it('computes the operating-income-level summary from revenue vs expenses', () => {
      const result = analyzeBudgetVariance(makeAVB([], baseTotals), 10)

      // totalBudget = revenue.budget - expenses.budget = 100000
      // totalActual = revenue.actual - expenses.actual = 395000
      expect(result.summary).toEqual({
        totalBudget: 100000,
        totalActual: 395000,
        totalVariance: 295000,
        variancePercent: 295,
      })
    })

    it('skips items with a zero budget', () => {
      const avb = makeAVB(
        [
          makeItem({
            accountCode: '999',
            accountName: '新規',
            budgetAmount: 0,
            actualAmount: 100000,
            variance: 100000,
          }),
          makeItem({
            accountCode: '400',
            accountName: '売上高',
            budgetAmount: 1000000,
            actualAmount: 1200000,
            variance: 200000,
          }),
        ],
        baseTotals
      )

      const result = analyzeBudgetVariance(avb, 10)

      expect(result.significantVariances).toHaveLength(1)
      expect(result.significantVariances[0].accountCode).toBe('400')
    })

    it('returns no significant variances when none cross the default threshold', () => {
      const avb = makeAVB(
        [
          makeItem({
            accountCode: '400',
            accountName: '売上高',
            budgetAmount: 1000000,
            actualAmount: 1005000,
            variance: 5000,
          }),
        ],
        baseTotals
      )

      const result = analyzeBudgetVariance(avb)

      expect(result.significantVariances).toEqual([])
    })

    it('handles an empty items list with zeroed totals (rate 0 via safeDivide)', () => {
      const zeroTotals: ActualVsBudget['totals'] = {
        revenue: { budget: 0, actual: 0, variance: 0, rate: 0 },
        expenses: { budget: 0, actual: 0, variance: 0, rate: 0 },
        operatingIncome: { budget: 0, actual: 0, variance: 0, rate: 0 },
      }

      const result = analyzeBudgetVariance(makeAVB([], zeroTotals), 10)

      expect(result.significantVariances).toEqual([])
      expect(result.summary.variancePercent).toBe(0)
    })
  })

  describe('getMonthlyBudgetTrend', () => {
    it('sums budgets per month and pairs with actual net income across all 12 months', async () => {
      vi.mocked(getBudgetsByFiscalYear).mockResolvedValue([
        makeBudget({ month: 1, accountCode: '400', amount: 100000 }),
        makeBudget({ month: 1, accountCode: '500', amount: 50000 }),
        makeBudget({ month: 2, accountCode: '400', amount: 200000 }),
      ])

      const monthlyActuals = new Map<number, ProfitLoss>([[1, makePL({ netIncome: 120000 })]])

      const result = await getMonthlyBudgetTrend(companyId, fiscalYear, monthlyActuals)

      expect(getBudgetsByFiscalYear).toHaveBeenCalledWith(companyId, fiscalYear)
      expect(result).toHaveLength(12)

      // month 1: budget 150000 (100000 + 50000), actual 120000
      expect(result[0]).toEqual({
        month: 1,
        budget: 150000,
        actual: 120000,
        variance: -30000,
        rate: 80,
      })
      // month 2: budget 200000, no actual → 0
      expect(result[1]).toEqual({
        month: 2,
        budget: 200000,
        actual: 0,
        variance: -200000,
        rate: 0,
      })
      // months 3..12: no budget, no actual → all zero
      expect(result[2]).toEqual({ month: 3, budget: 0, actual: 0, variance: 0, rate: 0 })
      expect(result[11]).toEqual({ month: 12, budget: 0, actual: 0, variance: 0, rate: 0 })
    })

    it('returns 12 zeroed months when there are no budgets and no actuals', async () => {
      vi.mocked(getBudgetsByFiscalYear).mockResolvedValue([])

      const result = await getMonthlyBudgetTrend(companyId, fiscalYear, new Map())

      expect(result).toHaveLength(12)
      expect(
        result.every((t) => t.budget === 0 && t.actual === 0 && t.variance === 0 && t.rate === 0)
      ).toBe(true)
    })

    it('treats a missing actual month as zero actual while keeping the budget', async () => {
      vi.mocked(getBudgetsByFiscalYear).mockResolvedValue([
        makeBudget({ month: 6, accountCode: '400', amount: 300000 }),
      ])

      const result = await getMonthlyBudgetTrend(companyId, fiscalYear, new Map())

      const june = result.find((t) => t.month === 6)
      expect(june).toEqual({ month: 6, budget: 300000, actual: 0, variance: -300000, rate: 0 })
    })

    it('propagates errors from getBudgetsByFiscalYear', async () => {
      vi.mocked(getBudgetsByFiscalYear).mockRejectedValue(new Error('fiscal query failed'))

      await expect(getMonthlyBudgetTrend(companyId, fiscalYear, new Map())).rejects.toThrow(
        'fiscal query failed'
      )
    })
  })
})
