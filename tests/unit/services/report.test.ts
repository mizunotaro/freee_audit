import { describe, it, expect } from 'vitest'
import {
  calculateOperatingCF,
  calculateInvestingCF,
  calculateFinancingCF,
  calculateCashFlowStatement,
  calculateGrossProfit,
  calculateOperatingIncome,
  calculateYoYGrowth,
} from '@/services/report/cash-flow'
import type { CashFlowInputs } from '@/services/report/cash-flow'

describe('Cash Flow Service', () => {
  const mockInputs: CashFlowInputs = {
    netIncome: 1000000,
    depreciation: 200000,
    amortization: 50000,
    accountsReceivableChange: 100000,
    inventoryChange: 50000,
    accountsPayableChange: 80000,
    otherOperatingAdjustments: 20000,
    fixedAssetPurchases: 300000,
    fixedAssetSales: 100000,
    borrowingProceeds: 500000,
    borrowingRepayments: 200000,
    dividendsPaid: 100000,
    beginningCash: 2000000,
  }

  describe('calculateOperatingCF', () => {
    it('should calculate operating cash flow correctly', () => {
      const result = calculateOperatingCF(mockInputs)

      // Net Income + Depreciation + Amortization - AR Change - Inventory Change + AP Change + Other
      // = 1,000,000 + 200,000 + 50,000 - 100,000 - 50,000 + 80,000 + 20,000
      // = 1,200,000
      expect(result).toBe(1200000)
    })

    it('should handle negative changes correctly', () => {
      const inputsWithNegativeChanges: CashFlowInputs = {
        ...mockInputs,
        accountsReceivableChange: -50000,
        accountsPayableChange: -30000,
      }

      const result = calculateOperatingCF(inputsWithNegativeChanges)

      // Decrease in AR is positive for cash flow
      // Decrease in AP is negative for cash flow
      expect(result).toBeGreaterThan(0)
    })
  })

  describe('calculateInvestingCF', () => {
    it('should calculate investing cash flow correctly', () => {
      const result = calculateInvestingCF(mockInputs)

      // -Fixed Asset Purchases + Fixed Asset Sales
      // = -300,000 + 100,000 = -200,000
      expect(result).toBe(-200000)
    })

    it('should be negative when only purchasing assets', () => {
      const inputsWithOnlyPurchases: CashFlowInputs = {
        ...mockInputs,
        fixedAssetSales: 0,
      }

      const result = calculateInvestingCF(inputsWithOnlyPurchases)

      expect(result).toBe(-300000)
    })
  })

  describe('calculateFinancingCF', () => {
    it('should calculate financing cash flow correctly', () => {
      const result = calculateFinancingCF(mockInputs)

      // Borrowing Proceeds - Repayments - Dividends
      // = 500,000 - 200,000 - 100,000 = 200,000
      expect(result).toBe(200000)
    })
  })

  describe('calculateCashFlowStatement', () => {
    it('should generate complete cash flow statement', () => {
      const result = calculateCashFlowStatement(mockInputs)

      expect(result.operating!.netCashFromOperating).toBe(1200000)
      expect(result.investing!.netCashFromInvesting).toBe(-200000)
      expect(result.financing!.netCashFromFinancing).toBe(200000)
      expect(result.netChangeInCash).toBe(1200000)
      expect(result.beginningCash).toBe(2000000)
      expect(result.endingCash).toBe(3200000)
    })

    it('should include all line items', () => {
      const result = calculateCashFlowStatement(mockInputs)

      expect(result.operating!.items.length).toBeGreaterThan(0)
      expect(result.investing!.items.length).toBeGreaterThan(0)
      expect(result.financing!.items.length).toBeGreaterThan(0)
    })
  })

  describe('calculateGrossProfit', () => {
    it('should calculate gross profit correctly', () => {
      const result = calculateGrossProfit(1000000, 400000)
      expect(result).toBe(600000)
    })

    it('should handle zero revenue', () => {
      const result = calculateGrossProfit(0, 400000)
      expect(result).toBe(-400000)
    })
  })

  describe('calculateOperatingIncome', () => {
    it('should calculate operating income correctly', () => {
      const result = calculateOperatingIncome(600000, 300000)
      expect(result).toBe(300000)
    })
  })

  describe('calculateYoYGrowth', () => {
    it('should calculate positive growth correctly', () => {
      const result = calculateYoYGrowth(1200000, 1000000)
      expect(result).toBe(20)
    })

    it('should calculate negative growth correctly', () => {
      const result = calculateYoYGrowth(800000, 1000000)
      expect(result).toBe(-20)
    })

    it('should handle zero previous value', () => {
      const result = calculateYoYGrowth(1000000, 0)
      expect(result).toBe(100)
    })
  })
})
