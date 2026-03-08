import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CalculationValidator } from '@/services/validation/calculation-validator'
import type { BalanceSheet, ProfitLoss, CashFlowStatement, FinancialKPIs } from '@/types'

vi.mock('@/lib/ai/personas', () => ({
  getPersona: vi.fn(() => ({
    type: 'cpa',
    config: {
      name: '公認会計士',
      nameEn: 'CPA',
    },
  })),
}))

vi.mock('@/lib/integrations/ai', () => ({
  createAIProviderFromEnv: vi.fn(() => ({
    validateEntry: vi.fn().mockResolvedValue({
      isValid: true,
      issues: [],
      suggestions: [],
    }),
  })),
}))

describe('CalculationValidator', () => {
  const validator = new CalculationValidator()

  const mockBS: BalanceSheet = {
    fiscalYear: 2024,
    month: 12,
    assets: {
      current: [{ code: '1000', name: '現金', amount: 5000000 }],
      fixed: [],
      total: 5000000,
    },
    liabilities: { current: [], fixed: [], total: 0 },
    equity: { items: [], total: 5000000 },
    totalAssets: 5000000,
    totalLiabilities: 0,
    totalEquity: 5000000,
  }

  const mockPL: ProfitLoss = {
    fiscalYear: 2024,
    month: 12,
    revenue: [{ code: 'R001', name: '売上高', amount: 10000000 }],
    costOfSales: [],
    grossProfit: 10000000,
    grossProfitMargin: 100,
    sgaExpenses: [],
    operatingIncome: 5000000,
    operatingMargin: 50,
    nonOperatingIncome: [],
    nonOperatingExpenses: [],
    ordinaryIncome: 5000000,
    extraordinaryIncome: [],
    extraordinaryLoss: [],
    incomeBeforeTax: 5000000,
    incomeTax: 1000000,
    netIncome: 4000000,
    depreciation: 500000,
  }

  const mockCF: CashFlowStatement = {
    fiscalYear: 2024,
    month: 12,
    operatingActivities: {
      netIncome: 4000000,
      depreciation: 500000,
      amortization: 0,
      deferredTaxChange: 0,
      increaseInReceivables: 0,
      decreaseInInventory: 0,
      increaseInPayables: 0,
      otherNonCash: 0,
      netCashFromOperating: 4500000,
    },
    investingActivities: {
      purchaseOfFixedAssets: 0,
      saleOfFixedAssets: 0,
      netCashFromInvesting: 0,
    },
    financingActivities: {
      proceedsFromBorrowing: 0,
      repaymentOfBorrowing: 0,
      dividendPaid: 0,
      interestPaid: 0,
      netCashFromFinancing: 0,
    },
    netChangeInCash: 4500000,
    beginningCash: 500000,
    endingCash: 5000000,
  }

  const mockKPIs: FinancialKPIs = {
    fiscalYear: 2024,
    month: 12,
    profitability: {
      roe: 80,
      roa: 80,
      ros: 50,
      grossProfitMargin: 100,
      operatingMargin: 50,
      ebitdaMargin: 60,
    },
    efficiency: {
      assetTurnover: 2,
      inventoryTurnover: 0,
      receivablesTurnover: 0,
      payablesTurnover: 0,
    },
    safety: { currentRatio: 999, quickRatio: 999, debtToEquity: 0, equityRatio: 100 },
    growth: { revenueGrowth: 0, profitGrowth: 0 },
    cashFlow: { fcf: 4500000, fcfMargin: 45 },
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('validateCashFlow', () => {
    it('should pass validation for consistent cash flow', async () => {
      const result = await validator.validateCashFlow({
        standard: 'JGAAP',
        balanceSheet: mockBS,
        profitLoss: mockPL,
        cashFlow: mockCF,
        kpis: mockKPIs,
        calculationFormulas: [],
      })

      expect(result.isValid).toBe(true)
      expect(result.confidence).toBeGreaterThan(0.5)
    })

    it('should detect inconsistent operating cash flow', async () => {
      const inconsistentCF = {
        ...mockCF,
        operatingActivities: {
          ...mockCF.operatingActivities!,
          netCashFromOperating: 9999999,
        },
      }

      const result = await validator.validateCashFlow({
        standard: 'JGAAP',
        balanceSheet: mockBS,
        profitLoss: mockPL,
        cashFlow: inconsistentCF,
        kpis: mockKPIs,
        calculationFormulas: [],
      })

      expect(result.isValid).toBe(false)
      expect(result.issues.some((i) => i.category === 'formula')).toBe(true)
    })

    it('should detect cash reconciliation error', async () => {
      const badCF = {
        ...mockCF,
        netChangeInCash: 100,
        endingCash: 999999,
      }

      const result = await validator.validateCashFlow({
        standard: 'JGAAP',
        balanceSheet: mockBS,
        profitLoss: mockPL,
        cashFlow: badCF,
        kpis: mockKPIs,
        calculationFormulas: [],
      })

      expect(result.issues.some((i) => i.itemName.includes('現金'))).toBe(true)
    })

    it('should return correct standard compliance info', async () => {
      const result = await validator.validateCashFlow({
        standard: 'JGAAP',
        balanceSheet: mockBS,
        profitLoss: mockPL,
        cashFlow: mockCF,
        kpis: mockKPIs,
        calculationFormulas: [],
      })

      expect(result.standardCompliance.standard).toBe('JGAAP')
      expect(result.standardCompliance.deviations).toBeDefined()
    })

    it('should include validatedAt timestamp', async () => {
      const result = await validator.validateCashFlow({
        standard: 'JGAAP',
        balanceSheet: mockBS,
        profitLoss: mockPL,
        cashFlow: mockCF,
        kpis: mockKPIs,
        calculationFormulas: [],
      })

      expect(result.validatedAt).toBeInstanceOf(Date)
    })

    it('should handle missing operating activities gracefully', async () => {
      const cfWithoutOpActivities = {
        ...mockCF,
        operatingActivities: undefined,
      }

      const result = await validator.validateCashFlow({
        standard: 'JGAAP',
        balanceSheet: mockBS,
        profitLoss: mockPL,
        cashFlow: cfWithoutOpActivities,
        kpis: mockKPIs,
        calculationFormulas: [],
      })

      expect(result).toBeDefined()
      expect(result.isValid).toBe(true)
    })

    it('should calculate confidence correctly with multiple issues', async () => {
      const badCF = {
        ...mockCF,
        operatingActivities: {
          ...mockCF.operatingActivities!,
          netCashFromOperating: 9999999,
        },
        netChangeInCash: 100,
        endingCash: 999999,
      }

      const result = await validator.validateCashFlow({
        standard: 'JGAAP',
        balanceSheet: mockBS,
        profitLoss: mockPL,
        cashFlow: badCF,
        kpis: mockKPIs,
        calculationFormulas: [],
      })

      expect(result.confidence).toBeLessThan(1)
      expect(result.confidence).toBeGreaterThanOrEqual(0)
    })
  })

  describe('validateCashFlowConsistency', () => {
    it('should detect small discrepancy in operating CF', async () => {
      const cfWithSmallError = {
        ...mockCF,
        operatingActivities: {
          ...mockCF.operatingActivities!,
          netCashFromOperating: 4500001,
        },
      }

      const result = await validator.validateCashFlow({
        standard: 'JGAAP',
        balanceSheet: mockBS,
        profitLoss: mockPL,
        cashFlow: cfWithSmallError,
        kpis: mockKPIs,
        calculationFormulas: [],
      })

      expect(result.isValid).toBe(true)
    })

    it('should handle zero values correctly', async () => {
      const zeroCF: CashFlowStatement = {
        fiscalYear: 2024,
        month: 12,
        operatingActivities: {
          netIncome: 0,
          depreciation: 0,
          amortization: 0,
          deferredTaxChange: 0,
          increaseInReceivables: 0,
          decreaseInInventory: 0,
          increaseInPayables: 0,
          otherNonCash: 0,
          netCashFromOperating: 0,
        },
        investingActivities: {
          purchaseOfFixedAssets: 0,
          saleOfFixedAssets: 0,
          netCashFromInvesting: 0,
        },
        financingActivities: {
          proceedsFromBorrowing: 0,
          repaymentOfBorrowing: 0,
          dividendPaid: 0,
          interestPaid: 0,
          netCashFromFinancing: 0,
        },
        netChangeInCash: 0,
        beginningCash: 0,
        endingCash: 0,
      }

      const result = await validator.validateCashFlow({
        standard: 'JGAAP',
        balanceSheet: mockBS,
        profitLoss: mockPL,
        cashFlow: zeroCF,
        kpis: mockKPIs,
        calculationFormulas: [],
      })

      expect(result.isValid).toBe(true)
    })
  })

  describe('standard compliance', () => {
    it('should check IFRS interest classification', async () => {
      const result = await validator.validateCashFlow({
        standard: 'IFRS',
        balanceSheet: mockBS,
        profitLoss: mockPL,
        cashFlow: mockCF,
        kpis: mockKPIs,
        calculationFormulas: [],
      })

      expect(result.standardCompliance.standard).toBe('IFRS')
    })

    it('should check USGAAP compliance', async () => {
      const result = await validator.validateCashFlow({
        standard: 'USGAAP',
        balanceSheet: mockBS,
        profitLoss: mockPL,
        cashFlow: mockCF,
        kpis: mockKPIs,
        calculationFormulas: [],
      })

      expect(result.standardCompliance.standard).toBe('USGAAP')
    })
  })

  describe('calculationFormulas', () => {
    it('should include formulas in validation', async () => {
      const formulas = [
        {
          name: 'FCF',
          formula: 'Operating CF - CapEx',
          inputs: { operatingCF: 4500000, capex: 0 },
          output: 4500000,
          description: 'Free Cash Flow calculation',
        },
      ]

      const result = await validator.validateCashFlow({
        standard: 'JGAAP',
        balanceSheet: mockBS,
        profitLoss: mockPL,
        cashFlow: mockCF,
        kpis: mockKPIs,
        calculationFormulas: formulas,
      })

      expect(result).toBeDefined()
    })
  })
})
