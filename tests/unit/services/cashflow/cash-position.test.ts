import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  generateCashPosition,
  generateDetailedCashPosition,
} from '@/services/cashflow/cash-position'
import type { CashFlowStatement } from '@/types'

describe('CashPositionService', () => {
  const mockCF: CashFlowStatement = {
    fiscalYear: 2024,
    month: 1,
    operating: {
      items: [],
      netCashFromOperating: 1000000,
    },
    investing: {
      items: [],
      netCashFromInvesting: -500000,
    },
    financing: {
      items: [],
      netCashFromFinancing: 0,
    },
    netChangeInCash: 500000,
    beginningCash: 5000000,
    endingCash: 5500000,
  }

  const createMockCF = (
    month: number,
    operating: number,
    investing: number,
    financing: number
  ): CashFlowStatement => ({
    fiscalYear: 2024,
    month,
    operating: {
      items: [],
      netCashFromOperating: operating,
    },
    operatingActivities: {
      netCashFromOperating: operating,
      netIncome: operating > 0 ? operating : 0,
      depreciation: 100000,
      increaseInReceivables: 0,
      decreaseInInventory: 0,
      increaseInPayables: 0,
      otherNonCash: 0,
    } as any,
    investing: {
      items: [],
      netCashFromInvesting: investing,
    },
    investingActivities: {
      netCashFromInvesting: investing,
      purchaseOfFixedAssets: investing < 0 ? Math.abs(investing) : 0,
      saleOfFixedAssets: investing > 0 ? investing : 0,
    } as any,
    financing: {
      items: [],
      netCashFromFinancing: financing,
    },
    financingActivities: {
      netCashFromFinancing: financing,
      proceedsFromBorrowing: financing > 0 ? financing : 0,
      repaymentOfBorrowing: financing < 0 ? Math.abs(financing) : 0,
      dividendPaid: 0,
    } as any,
    netChangeInCash: operating + investing + financing,
    beginningCash: 0,
    endingCash: operating + investing + financing,
  })

  beforeEach(() => {})

  afterEach(() => {})

  describe('generateCashPosition', () => {
    it('should calculate cash position correctly', () => {
      const cashFlows = [createMockCF(1, 1000000, -500000, 0)]
      const beginningCash = 5000000

      const result = generateCashPosition(cashFlows, beginningCash)

      expect(result.fiscalYear).toBe(2024)
      expect(result.months).toHaveLength(1)
      expect(result.months[0].beginningCash).toBe(5000000)
      expect(result.months[0].operatingNet).toBe(1000000)
      expect(result.months[0].investingNet).toBe(-500000)
      expect(result.months[0].financingNet).toBe(0)
      expect(result.months[0].netChange).toBe(500000)
      expect(result.months[0].endingCash).toBe(5500000)
    })

    it('should handle multiple months', () => {
      const cashFlows = [
        createMockCF(1, 1000000, -500000, 0),
        createMockCF(2, 1200000, -300000, 0),
        createMockCF(3, 1500000, -200000, 0),
      ]
      const beginningCash = 5000000

      const result = generateCashPosition(cashFlows, beginningCash)

      expect(result.months).toHaveLength(3)
      expect(result.months[0].endingCash).toBe(5500000)
      expect(result.months[1].beginningCash).toBe(5500000)
      expect(result.months[1].endingCash).toBe(6400000)
      expect(result.months[2].beginningCash).toBe(6400000)
    })

    it('should calculate annual totals', () => {
      const cashFlows = [createMockCF(1, 1000000, -500000, 0), createMockCF(2, 1200000, -300000, 0)]
      const beginningCash = 5000000

      const result = generateCashPosition(cashFlows, beginningCash)

      expect(result.annualTotal.operatingNet).toBe(2200000)
      expect(result.annualTotal.investingNet).toBe(-800000)
      expect(result.annualTotal.financingNet).toBe(0)
      expect(result.annualTotal.netChange).toBe(1400000)
    })

    it('should sort cash flows by month', () => {
      const cashFlows = [
        createMockCF(3, 1500000, -200000, 0),
        createMockCF(1, 1000000, -500000, 0),
        createMockCF(2, 1200000, -300000, 0),
      ]
      const beginningCash = 5000000

      const result = generateCashPosition(cashFlows, beginningCash)

      expect(result.months[0].month).toBe(1)
      expect(result.months[1].month).toBe(2)
      expect(result.months[2].month).toBe(3)
    })

    it('should handle empty cash flows', () => {
      const result = generateCashPosition([], 5000000)

      expect(result.months).toHaveLength(0)
      expect(result.fiscalYear).toBe(0)
    })

    it('should handle negative operating cash flow', () => {
      const cashFlows = [createMockCF(1, -500000, -200000, 1000000)]
      const beginningCash = 3000000

      const result = generateCashPosition(cashFlows, beginningCash)

      expect(result.months[0].operatingNet).toBe(-500000)
      expect(result.months[0].netChange).toBe(300000)
      expect(result.months[0].endingCash).toBe(3300000)
    })

    it('should calculate operating inflow and outflow', () => {
      const cashFlows = [createMockCF(1, 1000000, -500000, 0)]
      const beginningCash = 5000000

      const result = generateCashPosition(cashFlows, beginningCash)

      expect(result.months[0].operatingInflow).toBeDefined()
      expect(result.months[0].operatingOutflow).toBeDefined()
    })
  })

  describe('generateDetailedCashPosition', () => {
    it('should generate detailed cash position', () => {
      const cashFlows = [createMockCF(1, 1000000, -500000, 0), createMockCF(2, 1200000, -300000, 0)]
      const beginningCash = 5000000

      const result = generateDetailedCashPosition(cashFlows, beginningCash)

      expect(result.length).toBeGreaterThan(0)
    })

    it('should include operating category', () => {
      const cashFlows = [createMockCF(1, 1000000, -500000, 0)]
      const beginningCash = 5000000

      const result = generateDetailedCashPosition(cashFlows, beginningCash)

      const operatingCategory = result.find((d) => d.category === '営業収支')
      expect(operatingCategory).toBeDefined()
      expect(operatingCategory?.items.length).toBeGreaterThan(0)
    })

    it('should include investing category', () => {
      const cashFlows = [createMockCF(1, 1000000, -500000, 0)]
      const beginningCash = 5000000

      const result = generateDetailedCashPosition(cashFlows, beginningCash)

      const investingCategory = result.find((d) => d.category === '投資収支')
      expect(investingCategory).toBeDefined()
      expect(investingCategory?.items.length).toBeGreaterThan(0)
    })

    it('should include financing category', () => {
      const cashFlows = [createMockCF(1, 1000000, -500000, 0)]
      const beginningCash = 5000000

      const result = generateDetailedCashPosition(cashFlows, beginningCash)

      const financingCategory = result.find((d) => d.category === '財務収支')
      expect(financingCategory).toBeDefined()
      expect(financingCategory?.items.length).toBeGreaterThan(0)
    })

    it('should calculate category totals', () => {
      const cashFlows = [createMockCF(1, 1000000, -500000, 0)]
      const beginningCash = 5000000

      const result = generateDetailedCashPosition(cashFlows, beginningCash)

      result.forEach((category) => {
        expect(category.categoryTotal).toBeDefined()
        expect(category.categoryTotal.length).toBe(12)
        expect(category.categoryAnnual).toBeDefined()
      })
    })

    it('should calculate item annual totals', () => {
      const cashFlows = [createMockCF(1, 1000000, -500000, 0)]
      const beginningCash = 5000000

      const result = generateDetailedCashPosition(cashFlows, beginningCash)

      result.forEach((category) => {
        category.items.forEach((item) => {
          expect(item.annual).toBeDefined()
          expect(item.months.length).toBe(12)
        })
      })
    })

    it('should handle empty cash flows', () => {
      const result = generateDetailedCashPosition([], 5000000)

      expect(result).toBeDefined()
      expect(result.length).toBeGreaterThan(0)
    })
  })

  describe('edge cases', () => {
    it('should handle zero beginning cash', () => {
      const cashFlows = [createMockCF(1, 1000000, -500000, 0)]
      const beginningCash = 0

      const result = generateCashPosition(cashFlows, beginningCash)

      expect(result.months[0].beginningCash).toBe(0)
      expect(result.months[0].endingCash).toBe(500000)
    })

    it('should handle all negative cash flows', () => {
      const cashFlows = [createMockCF(1, -1000000, -500000, -200000)]
      const beginningCash = 3000000

      const result = generateCashPosition(cashFlows, beginningCash)

      expect(result.months[0].netChange).toBe(-1700000)
      expect(result.months[0].endingCash).toBe(1300000)
    })

    it('should handle very large amounts', () => {
      const cashFlows = [createMockCF(1, 999999999999, -999999999999, 0)]
      const beginningCash = 999999999999

      const result = generateCashPosition(cashFlows, beginningCash)

      expect(result).toBeDefined()
    })

    it('should handle cash flow without operating activities', () => {
      const cfWithoutOp: CashFlowStatement = {
        fiscalYear: 2024,
        month: 1,
        operating: undefined as any,
        investing: {
          items: [],
          netCashFromInvesting: -500000,
        },
        financing: {
          items: [],
          netCashFromFinancing: 0,
        },
        netChangeInCash: -500000,
        beginningCash: 5000000,
        endingCash: 4500000,
      }

      const result = generateCashPosition([cfWithoutOp], 5000000)

      expect(result.months[0].operatingNet).toBe(0)
    })

    it('should handle cash flow with alternative property names', () => {
      const cfWithAltProps: CashFlowStatement = {
        fiscalYear: 2024,
        month: 1,
        operatingActivities: {
          netCashFromOperating: 1000000,
        } as any,
        investingActivities: {
          netCashFromInvesting: -500000,
        } as any,
        financingActivities: {
          netCashFromFinancing: 0,
        } as any,
      } as any

      const result = generateCashPosition([cfWithAltProps], 5000000)

      expect(result.months[0].operatingNet).toBe(1000000)
    })

    it('should handle 12 months of data', () => {
      const cashFlows = Array.from({ length: 12 }, (_, i) =>
        createMockCF(i + 1, 1000000, -500000, 0)
      )
      const beginningCash = 5000000

      const result = generateCashPosition(cashFlows, beginningCash)

      expect(result.months).toHaveLength(12)
    })
  })
})
