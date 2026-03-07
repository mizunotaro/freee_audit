import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { calculateDetailedActualVsBudget } from '@/services/budget/detailed-actual-vs-budget'
import { getBudgetsByMonth } from '@/services/budget/budget-service'
import type { ProfitLoss } from '@/types'

vi.mock('@/services/budget/budget-service', () => ({
  getBudgetsByMonth: vi.fn(),
}))

describe('DetailedActualVsBudgetService', () => {
  const mockCompanyId = 'company-1'

  const mockPL: ProfitLoss = {
    fiscalYear: 2024,
    month: 12,
    revenue: [{ code: '400', name: '売上高', amount: 10000000 }],
    costOfSales: [{ code: '500', name: '売上原価', amount: 6000000 }],
    grossProfit: 4000000,
    grossProfitMargin: 40,
    sgaExpenses: [
      { code: '610', name: '給与手当', amount: 1500000 },
      { code: '620', name: '広告宣伝費', amount: 500000 },
    ],
    operatingIncome: 2000000,
    operatingMargin: 20,
    nonOperatingIncome: [],
    nonOperatingExpenses: [],
    ordinaryIncome: 2000000,
    extraordinaryIncome: [],
    extraordinaryLoss: [],
    incomeBeforeTax: 2000000,
    incomeTax: 600000,
    netIncome: 1400000,
    depreciation: 300000,
  }

  const mockBudgets = [
    { accountCode: '400', accountName: '売上高', amount: 12000000 },
    { accountCode: '500', accountName: '売上原価', amount: 7000000 },
    { accountCode: '610', accountName: '給与手当', amount: 1400000 },
    { accountCode: '620', accountName: '広告宣伝費', amount: 600000 },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('calculateDetailedActualVsBudget', () => {
    it('should calculate stage level comparison', async () => {
      vi.mocked(getBudgetsByMonth).mockResolvedValue(mockBudgets as any)

      const result = await calculateDetailedActualVsBudget(mockCompanyId, 2024, 12, mockPL)

      expect(result.stageLevel).toBeDefined()
      expect(result.stageLevel.length).toBe(6)
      expect(result.stageLevel[0].stage).toBe('売上高')
      expect(result.stageLevel[0].budget).toBe(12000000)
      expect(result.stageLevel[0].actual).toBe(10000000)
      expect(result.stageLevel[0].variance).toBe(-2000000)
    })

    it('should calculate account level comparison', async () => {
      vi.mocked(getBudgetsByMonth).mockResolvedValue(mockBudgets as any)

      const result = await calculateDetailedActualVsBudget(mockCompanyId, 2024, 12, mockPL)

      expect(result.accountLevel).toBeDefined()
      const revenueAccount = result.accountLevel.find((a) => a.code === '400')
      expect(revenueAccount).toBeDefined()
      expect(revenueAccount?.budget).toBe(12000000)
      expect(revenueAccount?.actual).toBe(10000000)
    })

    it('should return correct status for revenue', async () => {
      vi.mocked(getBudgetsByMonth).mockResolvedValue(mockBudgets as any)

      const result = await calculateDetailedActualVsBudget(mockCompanyId, 2024, 12, mockPL)

      const revenueStage = result.stageLevel[0]
      expect(revenueStage.status).toBe('warning')
    })

    it('should return good status when revenue exceeds budget', async () => {
      const overBudgetPL = {
        ...mockPL,
        revenue: [{ code: '400', name: '売上高', amount: 15000000 }],
        grossProfit: 9000000,
        operatingIncome: 7000000,
        netIncome: 4900000,
      }

      vi.mocked(getBudgetsByMonth).mockResolvedValue(mockBudgets as any)

      const result = await calculateDetailedActualVsBudget(mockCompanyId, 2024, 12, overBudgetPL)

      const revenueStage = result.stageLevel[0]
      expect(revenueStage.status).toBe('good')
    })

    it('should return bad status when revenue is significantly below budget', async () => {
      const underBudgetPL = {
        ...mockPL,
        revenue: [{ code: '400', name: '売上高', amount: 5000000 }],
        grossProfit: -1000000,
        operatingIncome: -3000000,
        netIncome: -2100000,
      }

      vi.mocked(getBudgetsByMonth).mockResolvedValue(mockBudgets as any)

      const result = await calculateDetailedActualVsBudget(mockCompanyId, 2024, 12, underBudgetPL)

      const revenueStage = result.stageLevel[0]
      expect(revenueStage.status).toBe('bad')
    })

    it('should return correct status for expenses', async () => {
      vi.mocked(getBudgetsByMonth).mockResolvedValue(mockBudgets as any)

      const result = await calculateDetailedActualVsBudget(mockCompanyId, 2024, 12, mockPL)

      const costStage = result.stageLevel[1]
      expect(costStage.stage).toBe('売上原価')
      expect(costStage.status).toBe('good')
    })

    it('should return warning status when expense exceeds budget', async () => {
      const overExpensePL = {
        ...mockPL,
        costOfSales: [{ code: '500', name: '売上原価', amount: 7500000 }],
        grossProfit: 2500000,
        operatingIncome: 500000,
        netIncome: 350000,
      }

      vi.mocked(getBudgetsByMonth).mockResolvedValue(mockBudgets as any)

      const result = await calculateDetailedActualVsBudget(mockCompanyId, 2024, 12, overExpensePL)

      const costStage = result.stageLevel[1]
      expect(costStage.status).toBe('warning')
    })

    it('should return bad status when expense significantly exceeds budget', async () => {
      const overExpensePL = {
        ...mockPL,
        costOfSales: [{ code: '500', name: '売上原価', amount: 8500000 }],
        grossProfit: 1500000,
        operatingIncome: -500000,
        netIncome: -350000,
      }

      vi.mocked(getBudgetsByMonth).mockResolvedValue(mockBudgets as any)

      const result = await calculateDetailedActualVsBudget(mockCompanyId, 2024, 12, overExpensePL)

      const costStage = result.stageLevel[1]
      expect(costStage.status).toBe('bad')
    })

    it('should calculate summary correctly', async () => {
      vi.mocked(getBudgetsByMonth).mockResolvedValue(mockBudgets as any)

      const result = await calculateDetailedActualVsBudget(mockCompanyId, 2024, 12, mockPL)

      expect(result.summary).toBeDefined()
      expect(result.summary.totalBudget).toBeDefined()
      expect(result.summary.totalActual).toBeDefined()
      expect(result.summary.totalVariance).toBeDefined()
      expect(result.summary.overallRate).toBeDefined()
    })

    it('should handle empty budgets', async () => {
      vi.mocked(getBudgetsByMonth).mockResolvedValue([])

      const result = await calculateDetailedActualVsBudget(mockCompanyId, 2024, 12, mockPL)

      expect(result).toBeDefined()
      expect(result.stageLevel).toBeDefined()
    })

    it('should handle missing budget for account', async () => {
      vi.mocked(getBudgetsByMonth).mockResolvedValue([
        { accountCode: '400', accountName: '売上高', amount: 12000000 },
      ] as any)

      const result = await calculateDetailedActualVsBudget(mockCompanyId, 2024, 12, mockPL)

      const costAccount = result.accountLevel.find((a) => a.code === '500')
      expect(costAccount?.budget).toBe(0)
    })

    it('should calculate rate correctly', async () => {
      vi.mocked(getBudgetsByMonth).mockResolvedValue(mockBudgets as any)

      const result = await calculateDetailedActualVsBudget(mockCompanyId, 2024, 12, mockPL)

      const revenueStage = result.stageLevel[0]
      expect(revenueStage.rate).toBeCloseTo(83.33, 1)
    })

    it('should handle zero budget for rate calculation', async () => {
      vi.mocked(getBudgetsByMonth).mockResolvedValue([
        { accountCode: '400', accountName: '売上高', amount: 0 },
      ] as any)

      const result = await calculateDetailedActualVsBudget(mockCompanyId, 2024, 12, mockPL)

      const revenueStage = result.stageLevel[0]
      expect(revenueStage.rate).toBeDefined()
    })

    it('should include fiscal year and month in result', async () => {
      vi.mocked(getBudgetsByMonth).mockResolvedValue(mockBudgets as any)

      const result = await calculateDetailedActualVsBudget(mockCompanyId, 2024, 12, mockPL)

      expect(result.fiscalYear).toBe(2024)
      expect(result.month).toBe(12)
    })

    it('should categorize accounts correctly', async () => {
      vi.mocked(getBudgetsByMonth).mockResolvedValue(mockBudgets as any)

      const result = await calculateDetailedActualVsBudget(mockCompanyId, 2024, 12, mockPL)

      const revenueAccounts = result.accountLevel.filter((a) => a.category === 'revenue')
      const costAccounts = result.accountLevel.filter((a) => a.category === 'cost_of_sales')
      const sgaAccounts = result.accountLevel.filter((a) => a.category === 'sga_expense')

      expect(revenueAccounts.length).toBe(1)
      expect(costAccounts.length).toBe(1)
      expect(sgaAccounts.length).toBe(2)
    })
  })

  describe('edge cases', () => {
    it('should handle empty PL data', async () => {
      vi.mocked(getBudgetsByMonth).mockResolvedValue(mockBudgets as any)

      const emptyPL: ProfitLoss = {
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
      }

      const result = await calculateDetailedActualVsBudget(mockCompanyId, 2024, 12, emptyPL)

      expect(result).toBeDefined()
    })

    it('should handle negative actual values', async () => {
      const negativePL = {
        ...mockPL,
        netIncome: -1000000,
        operatingIncome: -500000,
      }

      vi.mocked(getBudgetsByMonth).mockResolvedValue(mockBudgets as any)

      const result = await calculateDetailedActualVsBudget(mockCompanyId, 2024, 12, negativePL)

      expect(result).toBeDefined()
    })

    it('should handle very large amounts', async () => {
      const largeBudgetPL = {
        ...mockPL,
        revenue: [{ code: '400', name: '売上高', amount: 999999999999 }],
        grossProfit: 999999999999,
        operatingIncome: 999999999999,
        netIncome: 699999999999,
      }

      vi.mocked(getBudgetsByMonth).mockResolvedValue([
        { accountCode: '400', accountName: '売上高', amount: 1000000000000 },
      ] as any)

      const result = await calculateDetailedActualVsBudget(mockCompanyId, 2024, 12, largeBudgetPL)

      expect(result).toBeDefined()
    })
  })
})
