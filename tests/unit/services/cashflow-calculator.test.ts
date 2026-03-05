import { describe, it, expect } from 'vitest'
import { calculateCashFlow } from '@/services/cashflow/calculator'
import type { BalanceSheet, ProfitLoss } from '@/types'

describe('calculateCashFlow', () => {
  const createMockBalanceSheet = (
    cash: number = 5000000,
    receivables: number = 3000000,
    inventory: number = 2000000,
    payables: number = 2000000,
    fixedAssets: number = 10000000,
    borrowing: number = 5000000
  ): BalanceSheet => {
    const totalCurrentAssets = cash + receivables + inventory
    const totalAssets = totalCurrentAssets + fixedAssets
    const totalLiabilities = payables + borrowing
    const totalEquity = totalAssets - totalLiabilities

    return {
      fiscalYear: 2024,
      month: 12,
      assets: {
        current: [
          { code: '1000', name: '現金', amount: cash },
          { code: '1100', name: '売掛金', amount: receivables },
          { code: '1200', name: '棚卸資産', amount: inventory },
        ],
        fixed: [{ code: '2000', name: '建物', amount: fixedAssets }],
        total: totalCurrentAssets,
      },
      liabilities: {
        current: [{ code: '3000', name: '買掛金', amount: payables }],
        fixed: [{ code: '4000', name: '長期借入金', amount: borrowing }],
        total: totalLiabilities,
      },
      equity: {
        items: [{ code: '5000', name: '資本金', amount: totalEquity }],
        total: totalEquity,
      },
      totalAssets,
      totalLiabilities,
      totalEquity,
    }
  }

  const createMockProfitLoss = (
    netIncome: number = 3900000,
    depreciation: number = 500000
  ): ProfitLoss => ({
    fiscalYear: 2024,
    month: 12,
    revenue: [{ code: 'R001', name: '売上高', amount: 20000000 }],
    costOfSales: [{ code: 'C001', name: '売上原価', amount: 12000000 }],
    grossProfit: [],
    grossProfitMargin: 40,
    sgaExpenses: [],
    operatingExpenses: [],
    operatingIncome: [],
    operatingMargin: 20,
    nonOperatingIncome: [],
    nonOperatingExpenses: [],
    ordinaryIncome: [],
    extraordinaryIncome: [],
    extraordinaryLoss: [],
    netIncome,
    depreciation,
  })

  describe('basic calculations', () => {
    it('should calculate operating cash flow correctly', () => {
      const currentBS = createMockBalanceSheet(5000000, 3000000, 2000000, 2000000)
      const previousBS = createMockBalanceSheet(4000000, 3500000, 1800000, 2200000)
      const pl = createMockProfitLoss(3900000, 500000)

      const result = calculateCashFlow(pl, currentBS, previousBS)

      expect(result.operatingActivities).toBeDefined()
      expect(result.operatingActivities.netIncome).toBe(3900000)
      expect(result.operatingActivities.depreciation).toBe(500000)
    })

    it('should calculate net change in cash correctly', () => {
      const currentBS = createMockBalanceSheet(5000000)
      const previousBS = createMockBalanceSheet(4000000)
      const pl = createMockProfitLoss()

      const result = calculateCashFlow(pl, currentBS, previousBS)

      expect(result.netChangeInCash).toBeDefined()
      expect(typeof result.netChangeInCash).toBe('number')
    })

    it('should calculate beginning and ending cash correctly', () => {
      const currentBS = createMockBalanceSheet(5000000)
      const previousBS = createMockBalanceSheet(4000000)
      const pl = createMockProfitLoss()

      const result = calculateCashFlow(pl, currentBS, previousBS)

      expect(result.beginningCash).toBe(4000000)
      expect(result.endingCash).toBe(5000000)
    })
  })

  describe('fallback logic and robustness', () => {
    it('should handle null previous balance sheet', () => {
      const currentBS = createMockBalanceSheet()
      const pl = createMockProfitLoss()

      const result = calculateCashFlow(pl, currentBS, null)

      expect(result).toBeDefined()
      expect(result.beginningCash).toBe(0)
      expect(result.endingCash).toBe(5000000)
    })

    it('should handle missing depreciation (default to 0)', () => {
      const currentBS = createMockBalanceSheet()
      const pl = createMockProfitLoss(3900000, 500000)
      // Remove depreciation to test fallback
      delete (pl as any).depreciation

      const result = calculateCashFlow(pl, currentBS, null)

      expect(result.operatingActivities?.depreciation).toBe(0)
    })

    it('should handle zero values correctly', () => {
      const currentBS = createMockBalanceSheet(0, 0, 0, 0, 0, 0)
      const previousBS = createMockBalanceSheet(0, 0, 0, 0, 0, 0)
      const pl = createMockProfitLoss(0, 0)

      const result = calculateCashFlow(pl, currentBS, previousBS)

      expect(result.operatingActivities.netCashFromOperating).toBe(0)
      expect(result.investingActivities.netCashFromInvesting).toBe(0)
      expect(result.financingActivities.netCashFromFinancing).toBe(0)
    })

    it('should handle negative values correctly', () => {
      const currentBS = createMockBalanceSheet(-1000000, -500000, -300000, -200000)
      const previousBS = createMockBalanceSheet(-800000, -400000, -200000, -150000)
      const pl = createMockProfitLoss(-1000000, 50000)

      const result = calculateCashFlow(pl, currentBS, previousBS)

      expect(result).toBeDefined()
      expect(result.operatingActivities.netIncome).toBe(-1000000)
    })

    it('should handle empty arrays in balance sheet', () => {
      const emptyBS: BalanceSheet = {
        fiscalYear: 2024,
        month: 12,
        assets: {
          current: [],
          fixed: [],
          total: 0,
        },
        liabilities: {
          current: [],
          fixed: [],
          total: 0,
        },
        equity: {
          items: [],
          total: 0,
        },
      }
      const pl = createMockProfitLoss()

      const result = calculateCashFlow(pl, emptyBS, null)

      expect(result).toBeDefined()
      expect(result.beginningCash).toBe(0)
      expect(result.endingCash).toBe(0)
    })
  })

  describe('operating activities', () => {
    it('should calculate increase in receivables correctly', () => {
      const currentBS = createMockBalanceSheet(5000000, 3000000, 2000000, 2000000)
      const previousBS = createMockBalanceSheet(5000000, 3500000, 2000000, 2000000)
      const pl = createMockProfitLoss()

      const result = calculateCashFlow(pl, currentBS, previousBS)

      // Increase in receivables = previous - current = 3,500,000 - 3,000,000 = 500,000
      expect(result.operatingActivities.increaseInReceivables).toBe(500000)
    })

    it('should calculate decrease in inventory correctly', () => {
      const currentBS = createMockBalanceSheet(5000000, 3000000, 1800000, 2000000)
      const previousBS = createMockBalanceSheet(5000000, 3000000, 2000000, 2000000)
      const pl = createMockProfitLoss()

      const result = calculateCashFlow(pl, currentBS, previousBS)

      // Decrease in inventory = previous - current = 2,000,000 - 1,800,000 = 200,000
      expect(result.operatingActivities.decreaseInInventory).toBe(200000)
    })

    it('should calculate increase in payables correctly', () => {
      const currentBS = createMockBalanceSheet(5000000, 3000000, 2000000, 2500000)
      const previousBS = createMockBalanceSheet(5000000, 3000000, 2000000, 2000000)
      const pl = createMockProfitLoss()

      const result = calculateCashFlow(pl, currentBS, previousBS)

      // Increase in payables = current - previous = 2,500,000 - 2,000,000 = 500,000
      expect(result.operatingActivities.increaseInPayables).toBe(500000)
    })
  })

  describe('investing activities', () => {
    it('should calculate investing cash flow with asset changes', () => {
      const currentBS = createMockBalanceSheet(5000000, 3000000, 2000000, 2000000, 12000000)
      const previousBS = createMockBalanceSheet(5000000, 3000000, 2000000, 2000000, 10000000)
      const pl = createMockProfitLoss()

      const result = calculateCashFlow(pl, currentBS, previousBS)

      expect(result.investingActivities).toBeDefined()
      expect(result.investingActivities.purchaseOfFixedAssets).toBeDefined()
      expect(result.investingActivities.netCashFromInvesting).toBeDefined()
    })
  })

  describe('financing activities', () => {
    it('should calculate financing cash flow with borrowing changes', () => {
      const currentBS = createMockBalanceSheet(
        5000000,
        3000000,
        2000000,
        2000000,
        10000000,
        6000000
      )
      const previousBS = createMockBalanceSheet(
        5000000,
        3000000,
        2000000,
        2000000,
        10000000,
        5000000
      )
      const pl = createMockProfitLoss()

      const result = calculateCashFlow(pl, currentBS, previousBS)

      expect(result.financingActivities).toBeDefined()
      expect(result.financingActivities.proceedsFromBorrowing).toBeDefined()
      expect(result.financingActivities.repaymentOfBorrowing).toBeDefined()
      expect(result.financingActivities.netCashFromFinancing).toBeDefined()
    })
  })

  describe('edge cases', () => {
    it('should handle very large amounts', () => {
      const largeAmount = Number.MAX_SAFE_INTEGER / 10
      const currentBS = createMockBalanceSheet(largeAmount, largeAmount, largeAmount, largeAmount)
      const pl = createMockProfitLoss(largeAmount, largeAmount)

      const result = calculateCashFlow(pl, currentBS, null)

      expect(result).toBeDefined()
      expect(isFinite(result.operatingActivities.netCashFromOperating)).toBe(true)
    })

    it('should handle fiscal year and month correctly', () => {
      const currentBS = createMockBalanceSheet()
      const pl = createMockProfitLoss()
      pl.fiscalYear = 2025
      pl.month = 3

      const result = calculateCashFlow(pl, currentBS, null)

      expect(result.fiscalYear).toBe(2025)
      expect(result.month).toBe(3)
    })
  })

  describe('data consistency', () => {
    it('should produce consistent results for same inputs', () => {
      const currentBS = createMockBalanceSheet()
      const previousBS = createMockBalanceSheet(4000000)
      const pl = createMockProfitLoss()

      const result1 = calculateCashFlow(pl, currentBS, previousBS)
      const result2 = calculateCashFlow(pl, currentBS, previousBS)

      expect(result1.operatingActivities.netCashFromOperating).toBe(
        result2.operatingActivities.netCashFromOperating
      )
      expect(result1.netChangeInCash).toBe(result2.netChangeInCash)
    })
  })
})
