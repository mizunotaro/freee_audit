import { describe, it, expect, vi, beforeEach } from 'vitest'
import { calculateActualVsBudget } from '@/services/budget/actual-vs-budget'
import * as budgetService from '@/services/budget/budget-service'
import type { ProfitLoss } from '@/types'

vi.mock('@/services/budget/budget-service', () => ({
  getBudgetsByMonth: vi.fn(),
}))

describe('calculateActualVsBudget', () => {
  const mockCompanyId = 'company-1'
  const mockFiscalYear = 2024
  const mockMonth = 12

  const mockActualPL: ProfitLoss = {
    fiscalYear: 2024,
    month: 12,
    revenue: [{ code: 'R001', name: '売上高', amount: 11000000 }],
    costOfSales: [{ code: 'C001', name: '売上原価', amount: 6000000 }],
    grossProfit: 5000000,
    grossProfitMargin: 45,
    sgaExpenses: [
      { code: 'E001', name: '給与手当', amount: 2000000 },
      { code: 'E002', name: '広告宣伝費', amount: 500000 },
    ],
    operatingIncome: 2500000,
    operatingMargin: 23,
    nonOperatingIncome: [],
    nonOperatingExpenses: [],
    ordinaryIncome: 2500000,
    extraordinaryIncome: [],
    extraordinaryLoss: [],
    incomeBeforeTax: 2500000,
    incomeTax: 0,
    netIncome: 2500000,
    depreciation: 0,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('basic calculations', () => {
    it('should calculate variance correctly when actual exceeds budget', async () => {
      vi.mocked(budgetService.getBudgetsByMonth).mockResolvedValue([
        {
          id: 'budget-1',
          companyId: mockCompanyId,
          fiscalYear: mockFiscalYear,
          month: mockMonth,
          accountCode: 'R001',
          accountName: '売上高',
          amount: 10000000,
          departmentId: null,
          note: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])

      const result = await calculateActualVsBudget(
        mockCompanyId,
        mockFiscalYear,
        mockMonth,
        mockActualPL
      )

      const revenueItem = result.items.find((i) => i.accountCode === 'R001')
      expect(revenueItem).toBeDefined()
      expect(revenueItem!.variance).toBe(1000000) // 11,000,000 - 10,000,000
      expect(revenueItem!.achievementRate).toBe(110) // 110%
    })

    it('should calculate variance correctly when actual is below budget', async () => {
      vi.mocked(budgetService.getBudgetsByMonth).mockResolvedValue([
        {
          id: 'budget-1',
          companyId: mockCompanyId,
          fiscalYear: mockFiscalYear,
          month: mockMonth,
          accountCode: 'R001',
          accountName: '売上高',
          amount: 12000000,
          departmentId: null,
          note: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])

      const result = await calculateActualVsBudget(
        mockCompanyId,
        mockFiscalYear,
        mockMonth,
        mockActualPL
      )

      const revenueItem = result.items.find((i) => i.accountCode === 'R001')
      expect(revenueItem).toBeDefined()
      expect(revenueItem!.variance).toBe(-1000000) // 11,000,000 - 12,000,000
    })

    it('should handle missing budget (zero budget amount)', async () => {
      vi.mocked(budgetService.getBudgetsByMonth).mockResolvedValue([])

      const result = await calculateActualVsBudget(
        mockCompanyId,
        mockFiscalYear,
        mockMonth,
        mockActualPL
      )

      const revenueItem = result.items.find((i) => i.accountCode === 'R001')
      expect(revenueItem).toBeDefined()
      expect(revenueItem!.budgetAmount).toBe(0)
      expect(revenueItem!.variance).toBe(11000000)
    })
  })

  describe('totals calculation', () => {
    it('should return correct number of items', async () => {
      vi.mocked(budgetService.getBudgetsByMonth).mockResolvedValue([
        {
          id: 'budget-1',
          companyId: mockCompanyId,
          fiscalYear: mockFiscalYear,
          month: mockMonth,
          accountCode: 'R001',
          accountName: '売上高',
          amount: 10000000,
          departmentId: null,
          note: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'budget-2',
          companyId: mockCompanyId,
          fiscalYear: mockFiscalYear,
          month: mockMonth,
          accountCode: 'C001',
          accountName: '売上原価',
          amount: 5000000,
          departmentId: null,
          note: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])

      const result = await calculateActualVsBudget(
        mockCompanyId,
        mockFiscalYear,
        mockMonth,
        mockActualPL
      )

      // Revenue: 1, Cost: 1, SGA: 2 = 4 items
      expect(result.items.length).toBe(4)
    })
  })

  describe('metadata', () => {
    it('should include correct fiscal year and month', async () => {
      vi.mocked(budgetService.getBudgetsByMonth).mockResolvedValue([])

      const result = await calculateActualVsBudget(
        mockCompanyId,
        mockFiscalYear,
        mockMonth,
        mockActualPL
      )

      expect(result.fiscalYear).toBe(mockFiscalYear)
      expect(result.month).toBe(mockMonth)
    })
  })

  describe('department handling', () => {
    it('should preserve department ID from budget', async () => {
      vi.mocked(budgetService.getBudgetsByMonth).mockResolvedValue([
        {
          id: 'budget-1',
          companyId: mockCompanyId,
          fiscalYear: mockFiscalYear,
          month: mockMonth,
          accountCode: 'R001',
          accountName: '売上高',
          amount: 10000000,
          departmentId: 'dept-1',
          note: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])

      const result = await calculateActualVsBudget(
        mockCompanyId,
        mockFiscalYear,
        mockMonth,
        mockActualPL
      )

      const revenueItem = result.items.find((i) => i.accountCode === 'R001')
      expect(revenueItem!.departmentId).toBe('dept-1')
    })
  })
})
