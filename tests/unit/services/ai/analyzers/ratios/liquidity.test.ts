import { describe, it, expect } from 'vitest'
import {
  LIQUIDITY_RATIOS,
  calculateLiquidityRatios,
} from '@/services/ai/analyzers/ratios/liquidity'
import type { BalanceSheet, ProfitLoss } from '@/types'

describe('Liquidity Ratios', () => {
  const createMockBalanceSheet = (overrides: Partial<BalanceSheet> = {}): BalanceSheet => ({
    fiscalYear: 2024,
    month: 12,
    assets: {
      current: [
        { code: '1001', name: '現金預金', amount: 5000000 },
        { code: '1100', name: '売掛金', amount: 3000000 },
        { code: '1005', name: '棚卸資産', amount: 2000000 },
      ],
      fixed: [{ code: '2000', name: '建物', amount: 10000000 }],
      total: 20000000,
    },
    liabilities: {
      current: [
        { code: '3000', name: '買掛金', amount: 2000000 },
        { code: '3100', name: '短期借入金', amount: 1000000 },
      ],
      fixed: [{ code: '4000', name: '長期借入金', amount: 5000000 }],
      total: 8000000,
    },
    equity: {
      items: [
        { code: '5000', name: '資本金', amount: 5000000 },
        { code: '5100', name: '利益剰余金', amount: 7000000 },
      ],
      total: 12000000,
    },
    totalAssets: 20000000,
    totalLiabilities: 8000000,
    totalEquity: 12000000,
    ...overrides,
  })

  const createMockProfitLoss = (overrides: Partial<ProfitLoss> = {}): ProfitLoss => ({
    fiscalYear: 2024,
    month: 12,
    revenue: [{ code: 'R001', name: '売上高', amount: 20000000 }],
    costOfSales: [{ code: 'C001', name: '売上原価', amount: 12000000 }],
    grossProfit: 8000000,
    grossProfitMargin: 40,
    sgaExpenses: [{ code: 'E001', name: '販売費及び一般管理費', amount: 4000000 }],
    operatingIncome: 4000000,
    operatingMargin: 20,
    nonOperatingIncome: [],
    nonOperatingExpenses: [],
    ordinaryIncome: 4000000,
    extraordinaryIncome: [],
    extraordinaryLoss: [],
    incomeBeforeTax: 4000000,
    incomeTax: 800000,
    netIncome: 3200000,
    depreciation: 500000,
    ...overrides,
  })

  describe('LIQUIDITY_RATIOS constant', () => {
    it('should have 5 ratio definitions', () => {
      expect(LIQUIDITY_RATIOS).toHaveLength(5)
    })

    it('should have correct ratio IDs', () => {
      const ids = LIQUIDITY_RATIOS.map((r) => r.id)
      expect(ids).toContain('current_ratio')
      expect(ids).toContain('quick_ratio')
      expect(ids).toContain('cash_ratio')
      expect(ids).toContain('working_capital')
      expect(ids).toContain('working_capital_ratio')
    })
  })

  describe('calculateLiquidityRatios', () => {
    it('should calculate all liquidity ratios', () => {
      const result = calculateLiquidityRatios(createMockBalanceSheet(), createMockProfitLoss())

      expect(result).toHaveLength(5)
    })

    it('should calculate current ratio correctly', () => {
      const result = calculateLiquidityRatios(createMockBalanceSheet(), createMockProfitLoss())

      const currentRatio = result.find((r) => r.definition.id === 'current_ratio')
      expect(currentRatio).toBeDefined()
      expect(currentRatio?.value).toBeCloseTo(333.33, 1)
      expect(currentRatio?.formattedValue).toContain('%')
    })

    it('should calculate quick ratio correctly', () => {
      const result = calculateLiquidityRatios(createMockBalanceSheet(), createMockProfitLoss())

      const quickRatio = result.find((r) => r.definition.id === 'quick_ratio')
      expect(quickRatio).toBeDefined()
      expect(quickRatio?.value).toBeGreaterThan(0)
    })

    it('should calculate cash ratio correctly', () => {
      const result = calculateLiquidityRatios(createMockBalanceSheet(), createMockProfitLoss())

      const cashRatio = result.find((r) => r.definition.id === 'cash_ratio')
      expect(cashRatio).toBeDefined()
      expect(cashRatio?.value).toBeGreaterThan(0)
    })

    it('should calculate working capital correctly', () => {
      const result = calculateLiquidityRatios(createMockBalanceSheet(), createMockProfitLoss())

      const workingCapital = result.find((r) => r.definition.id === 'working_capital')
      expect(workingCapital).toBeDefined()
      expect(workingCapital?.value).toBe(7000000)
    })

    it('should calculate working capital ratio correctly', () => {
      const result = calculateLiquidityRatios(createMockBalanceSheet(), createMockProfitLoss())

      const wcRatio = result.find((r) => r.definition.id === 'working_capital_ratio')
      expect(wcRatio).toBeDefined()
      expect(wcRatio?.value).toBeGreaterThan(0)
    })

    it('should include trend when previous data is provided', () => {
      const prevBS = createMockBalanceSheet({
        fiscalYear: 2023,
        assets: {
          current: [{ code: '1001', name: '現金', amount: 4000000 }],
          fixed: [],
          total: 4000000,
        },
        totalAssets: 4000000,
      })

      const result = calculateLiquidityRatios(
        createMockBalanceSheet(),
        createMockProfitLoss(),
        prevBS
      )

      const currentRatio = result.find((r) => r.definition.id === 'current_ratio')
      expect(currentRatio?.trend).toBeDefined()
      expect(currentRatio?.trend?.direction).toBeOneOf(['improving', 'stable', 'declining'])
    })

    it('should not include trend when no previous data', () => {
      const result = calculateLiquidityRatios(createMockBalanceSheet(), createMockProfitLoss())

      const currentRatio = result.find((r) => r.definition.id === 'current_ratio')
      expect(currentRatio?.trend).toBeUndefined()
    })

    it('should handle zero current liabilities', () => {
      const bs = createMockBalanceSheet({
        liabilities: {
          current: [],
          fixed: [{ code: '4000', name: '長期借入金', amount: 8000000 }],
          total: 8000000,
        },
      })

      const result = calculateLiquidityRatios(bs, createMockProfitLoss())

      expect(result).toHaveLength(5)
      result.forEach((r) => {
        expect(r.value).toBeDefined()
        expect(r.status).toBeDefined()
      })
    })

    it('should return excellent status for high ratio', () => {
      const result = calculateLiquidityRatios(createMockBalanceSheet(), createMockProfitLoss())

      const currentRatio = result.find((r) => r.definition.id === 'current_ratio')
      expect(currentRatio?.status).toBe('excellent')
    })

    it('should return critical status for very low ratio', () => {
      const bs = createMockBalanceSheet({
        assets: {
          current: [{ code: '1001', name: '現金', amount: 200000 }],
          fixed: [],
          total: 200000,
        },
        totalAssets: 200000,
      })

      const result = calculateLiquidityRatios(bs, createMockProfitLoss())

      const currentRatio = result.find((r) => r.definition.id === 'current_ratio')
      expect(currentRatio?.status).toBe('critical')
    })

    it('should handle securities in cash calculation', () => {
      const bs = createMockBalanceSheet({
        assets: {
          current: [
            { code: '1001', name: '現金預金', amount: 3000000 },
            { code: '1003', name: '有価証券', amount: 2000000 },
          ],
          fixed: [],
          total: 5000000,
        },
        totalAssets: 5000000,
      })

      const result = calculateLiquidityRatios(bs, createMockProfitLoss())

      const cashRatio = result.find((r) => r.definition.id === 'cash_ratio')
      expect(cashRatio?.value).toBeGreaterThan(0)
    })
  })
})
