import { describe, it, expect } from 'vitest'
import { GROWTH_RATIOS, calculateGrowthRatios } from '@/services/ai/analyzers/ratios/growth'
import type { BalanceSheet, ProfitLoss } from '@/types'

describe('Growth Ratios', () => {
  const createMockBalanceSheet = (overrides: Partial<BalanceSheet> = {}): BalanceSheet => ({
    fiscalYear: 2024,
    month: 12,
    assets: {
      current: [
        { code: '1001', name: '現金預金', amount: 5000000 },
        { code: '1100', name: '売掛金', amount: 3000000 },
      ],
      fixed: [{ code: '2000', name: '建物', amount: 10000000 }],
      total: 18000000,
    },
    liabilities: {
      current: [{ code: '3000', name: '買掛金', amount: 2000000 }],
      fixed: [{ code: '4000', name: '長期借入金', amount: 4000000 }],
      total: 6000000,
    },
    equity: {
      items: [
        { code: '5000', name: '資本金', amount: 5000000 },
        { code: '5100', name: '利益剰余金', amount: 7000000 },
      ],
      total: 12000000,
    },
    totalAssets: 18000000,
    totalLiabilities: 6000000,
    totalEquity: 12000000,
    ...overrides,
  })

  const createMockProfitLoss = (overrides: Partial<ProfitLoss> = {}): ProfitLoss => ({
    fiscalYear: 2024,
    month: 12,
    revenue: [{ code: 'R001', name: '売上高', amount: 30000000 }],
    costOfSales: [{ code: 'C001', name: '売上原価', amount: 18000000 }],
    grossProfit: 12000000,
    grossProfitMargin: 40,
    sgaExpenses: [{ code: 'E001', name: '販売費及び一般管理費', amount: 6000000 }],
    operatingIncome: 6000000,
    operatingMargin: 20,
    nonOperatingIncome: [],
    nonOperatingExpenses: [],
    ordinaryIncome: 6000000,
    extraordinaryIncome: [],
    extraordinaryLoss: [],
    incomeBeforeTax: 6000000,
    incomeTax: 1200000,
    netIncome: 4800000,
    depreciation: 500000,
    ...overrides,
  })

  describe('GROWTH_RATIOS constant', () => {
    it('should have 5 ratio definitions', () => {
      expect(GROWTH_RATIOS).toHaveLength(5)
    })

    it('should have correct ratio IDs', () => {
      const ids = GROWTH_RATIOS.map((r) => r.id)
      expect(ids).toContain('revenue_growth')
      expect(ids).toContain('operating_income_growth')
      expect(ids).toContain('net_income_growth')
      expect(ids).toContain('total_assets_growth')
      expect(ids).toContain('equity_growth')
    })
  })

  describe('calculateGrowthRatios', () => {
    it('should calculate all growth ratios', () => {
      const result = calculateGrowthRatios(createMockBalanceSheet(), createMockProfitLoss())

      expect(result).toHaveLength(5)
    })

    it('should return fair status when no previous data', () => {
      const result = calculateGrowthRatios(createMockBalanceSheet(), createMockProfitLoss())

      result.forEach((r) => {
        expect(r.status).toBe('fair')
      })
    })

    it('should calculate revenue growth correctly', () => {
      const prevPL = createMockProfitLoss({
        fiscalYear: 2023,
        revenue: [{ code: 'R001', name: '売上高', amount: 25000000 }],
      })

      const result = calculateGrowthRatios(
        createMockBalanceSheet(),
        createMockProfitLoss(),
        undefined,
        prevPL
      )

      const revenueGrowth = result.find((r) => r.definition.id === 'revenue_growth')
      expect(revenueGrowth).toBeDefined()
      expect(revenueGrowth?.value).toBe(20)
    })

    it('should calculate operating income growth correctly', () => {
      const prevPL = createMockProfitLoss({
        fiscalYear: 2023,
        operatingIncome: 5000000,
      })

      const result = calculateGrowthRatios(
        createMockBalanceSheet(),
        createMockProfitLoss(),
        undefined,
        prevPL
      )

      const opGrowth = result.find((r) => r.definition.id === 'operating_income_growth')
      expect(opGrowth).toBeDefined()
      expect(opGrowth?.value).toBe(20)
    })

    it('should calculate net income growth correctly', () => {
      const prevPL = createMockProfitLoss({
        fiscalYear: 2023,
        netIncome: 4000000,
      })

      const result = calculateGrowthRatios(
        createMockBalanceSheet(),
        createMockProfitLoss(),
        undefined,
        prevPL
      )

      const netGrowth = result.find((r) => r.definition.id === 'net_income_growth')
      expect(netGrowth).toBeDefined()
      expect(netGrowth?.value).toBe(20)
    })

    it('should calculate total assets growth correctly', () => {
      const prevBS = createMockBalanceSheet({
        fiscalYear: 2023,
        totalAssets: 15000000,
      })

      const result = calculateGrowthRatios(createMockBalanceSheet(), createMockProfitLoss(), prevBS)

      const assetsGrowth = result.find((r) => r.definition.id === 'total_assets_growth')
      expect(assetsGrowth).toBeDefined()
      expect(assetsGrowth?.value).toBe(20)
    })

    it('should calculate equity growth correctly', () => {
      const prevBS = createMockBalanceSheet({
        fiscalYear: 2023,
        totalEquity: 10000000,
      })

      const result = calculateGrowthRatios(createMockBalanceSheet(), createMockProfitLoss(), prevBS)

      const equityGrowth = result.find((r) => r.definition.id === 'equity_growth')
      expect(equityGrowth).toBeDefined()
      expect(equityGrowth?.value).toBe(20)
    })

    it('should return excellent status for high growth', () => {
      const prevPL = createMockProfitLoss({
        fiscalYear: 2023,
        revenue: [{ code: 'R001', name: '売上高', amount: 25000000 }],
      })

      const result = calculateGrowthRatios(
        createMockBalanceSheet(),
        createMockProfitLoss(),
        undefined,
        prevPL
      )

      const revenueGrowth = result.find((r) => r.definition.id === 'revenue_growth')
      expect(revenueGrowth?.status).toBe('excellent')
    })

    it('should return critical status for significant decline', () => {
      const prevPL = createMockProfitLoss({
        fiscalYear: 2023,
        revenue: [{ code: 'R001', name: '売上高', amount: 50000000 }],
      })

      const result = calculateGrowthRatios(
        createMockBalanceSheet(),
        createMockProfitLoss(),
        undefined,
        prevPL
      )

      const revenueGrowth = result.find((r) => r.definition.id === 'revenue_growth')
      expect(revenueGrowth?.status).toBe('critical')
    })

    it('should handle zero previous revenue', () => {
      const prevPL = createMockProfitLoss({
        fiscalYear: 2023,
        revenue: [],
      })

      const result = calculateGrowthRatios(
        createMockBalanceSheet(),
        createMockProfitLoss(),
        undefined,
        prevPL
      )

      const revenueGrowth = result.find((r) => r.definition.id === 'revenue_growth')
      expect(revenueGrowth?.status).toBe('fair')
    })

    it('should handle negative previous income', () => {
      const prevPL = createMockProfitLoss({
        fiscalYear: 2023,
        netIncome: -1000000,
      })

      const result = calculateGrowthRatios(
        createMockBalanceSheet(),
        createMockProfitLoss(),
        undefined,
        prevPL
      )

      const netGrowth = result.find((r) => r.definition.id === 'net_income_growth')
      expect(netGrowth?.value).toBeDefined()
    })

    it('should format percentage values correctly', () => {
      const prevPL = createMockProfitLoss({
        fiscalYear: 2023,
        revenue: [{ code: 'R001', name: '売上高', amount: 25000000 }],
      })

      const result = calculateGrowthRatios(
        createMockBalanceSheet(),
        createMockProfitLoss(),
        undefined,
        prevPL
      )

      const revenueGrowth = result.find((r) => r.definition.id === 'revenue_growth')
      expect(revenueGrowth?.formattedValue).toContain('%')
    })
  })
})
