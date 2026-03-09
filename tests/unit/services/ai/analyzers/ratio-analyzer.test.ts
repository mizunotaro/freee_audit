import { describe, it, expect } from 'vitest'
import {
  RatioAnalyzer,
  createRatioAnalyzer,
  analyzeRatios,
} from '@/services/ai/analyzers/ratio-analyzer'
import type { BalanceSheet, ProfitLoss } from '@/types'

describe('RatioAnalyzer', () => {
  const createMockBalanceSheet = (overrides: Partial<BalanceSheet> = {}): BalanceSheet => ({
    fiscalYear: 2024,
    month: 12,
    assets: {
      current: [
        { code: '1001', name: '現金預金', amount: 5000000 },
        { code: '1100', name: '売掛金', amount: 3000000 },
        { code: '1200', name: '棚卸資産', amount: 2000000 },
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

  describe('analyze', () => {
    it('should return successful result with valid data', () => {
      const analyzer = new RatioAnalyzer()
      const result = analyzer.analyze({
        bs: createMockBalanceSheet(),
        pl: createMockProfitLoss(),
      })

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.groups).toHaveLength(5)
      expect(result.data?.summary.totalRatios).toBeGreaterThan(0)
    })

    it('should return error for missing balance sheet', () => {
      const analyzer = new RatioAnalyzer()
      const result = analyzer.analyze({
        bs: null as any,
        pl: createMockProfitLoss(),
      })

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('INVALID_INPUT')
    })

    it('should return error for missing profit loss', () => {
      const analyzer = new RatioAnalyzer()
      const result = analyzer.analyze({
        bs: createMockBalanceSheet(),
        pl: null as any,
      })

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('INVALID_INPUT')
    })

    it('should return error for zero or negative total assets', () => {
      const analyzer = new RatioAnalyzer()
      const result = analyzer.analyze({
        bs: createMockBalanceSheet({ totalAssets: 0 }),
        pl: createMockProfitLoss(),
      })

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('INVALID_DATA')
    })

    it('should calculate liquidity ratios', () => {
      const analyzer = new RatioAnalyzer()
      const result = analyzer.analyze({
        bs: createMockBalanceSheet(),
        pl: createMockProfitLoss(),
      })

      expect(result.success).toBe(true)
      const liquidityGroup = result.data?.groups.find((g) => g.category === 'liquidity')
      expect(liquidityGroup).toBeDefined()
      expect(liquidityGroup?.ratios.length).toBeGreaterThan(0)
    })

    it('should calculate safety ratios', () => {
      const analyzer = new RatioAnalyzer()
      const result = analyzer.analyze({
        bs: createMockBalanceSheet(),
        pl: createMockProfitLoss(),
      })

      expect(result.success).toBe(true)
      const safetyGroup = result.data?.groups.find((g) => g.category === 'safety')
      expect(safetyGroup).toBeDefined()
      expect(safetyGroup?.ratios.length).toBeGreaterThan(0)
    })

    it('should calculate profitability ratios', () => {
      const analyzer = new RatioAnalyzer()
      const result = analyzer.analyze({
        bs: createMockBalanceSheet(),
        pl: createMockProfitLoss(),
      })

      expect(result.success).toBe(true)
      const profitabilityGroup = result.data?.groups.find((g) => g.category === 'profitability')
      expect(profitabilityGroup).toBeDefined()
      expect(profitabilityGroup?.ratios.length).toBeGreaterThan(0)
    })

    it('should calculate efficiency ratios', () => {
      const analyzer = new RatioAnalyzer()
      const result = analyzer.analyze({
        bs: createMockBalanceSheet(),
        pl: createMockProfitLoss(),
      })

      expect(result.success).toBe(true)
      const efficiencyGroup = result.data?.groups.find((g) => g.category === 'efficiency')
      expect(efficiencyGroup).toBeDefined()
      expect(efficiencyGroup?.ratios.length).toBeGreaterThan(0)
    })

    it('should calculate growth ratios with previous data', () => {
      const analyzer = new RatioAnalyzer()
      const result = analyzer.analyze({
        bs: createMockBalanceSheet(),
        pl: createMockProfitLoss(),
        prevBS: createMockBalanceSheet({ fiscalYear: 2023, totalAssets: 18000000 }),
        prevPL: createMockProfitLoss({ fiscalYear: 2023, netIncome: 2800000 }),
      })

      expect(result.success).toBe(true)
      const growthGroup = result.data?.groups.find((g) => g.category === 'growth')
      expect(growthGroup).toBeDefined()
      expect(growthGroup?.ratios.length).toBeGreaterThan(0)
    })

    it('should calculate overall score', () => {
      const analyzer = new RatioAnalyzer()
      const result = analyzer.analyze({
        bs: createMockBalanceSheet(),
        pl: createMockProfitLoss(),
      })

      expect(result.success).toBe(true)
      expect(result.data?.summary.overallScore).toBeGreaterThanOrEqual(0)
      expect(result.data?.summary.overallScore).toBeLessThanOrEqual(100)
    })

    it('should count statuses correctly', () => {
      const analyzer = new RatioAnalyzer()
      const result = analyzer.analyze({
        bs: createMockBalanceSheet(),
        pl: createMockProfitLoss(),
      })

      expect(result.success).toBe(true)
      const summary = result.data?.summary
      expect(summary).toBeDefined()
      expect(
        (summary?.excellentCount ?? 0) +
          (summary?.goodCount ?? 0) +
          (summary?.fairCount ?? 0) +
          (summary?.poorCount ?? 0) +
          (summary?.criticalCount ?? 0)
      ).toBe(summary?.totalRatios)
    })

    it('should include calculatedAt timestamp', () => {
      const analyzer = new RatioAnalyzer()
      const result = analyzer.analyze({
        bs: createMockBalanceSheet(),
        pl: createMockProfitLoss(),
      })

      expect(result.success).toBe(true)
      expect(result.data?.calculatedAt).toBeInstanceOf(Date)
    })

    it('should handle edge case with zero current liabilities', () => {
      const analyzer = new RatioAnalyzer()
      const result = analyzer.analyze({
        bs: createMockBalanceSheet({
          liabilities: {
            current: [],
            fixed: [{ code: '4000', name: '長期借入金', amount: 8000000 }],
            total: 8000000,
          },
        }),
        pl: createMockProfitLoss(),
      })

      expect(result.success).toBe(true)
    })

    it('should handle edge case with negative equity', () => {
      const analyzer = new RatioAnalyzer()
      const result = analyzer.analyze({
        bs: createMockBalanceSheet({
          totalEquity: -5000000,
          totalLiabilities: 25000000,
        }),
        pl: createMockProfitLoss(),
      })

      expect(result.success).toBe(true)
    })
  })

  describe('createRatioAnalyzer', () => {
    it('should create analyzer instance', () => {
      const analyzer = createRatioAnalyzer()
      expect(analyzer).toBeInstanceOf(RatioAnalyzer)
    })
  })

  describe('analyzeRatios', () => {
    it('should work as standalone function', () => {
      const result = analyzeRatios({
        bs: createMockBalanceSheet(),
        pl: createMockProfitLoss(),
      })

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
    })
  })
})
