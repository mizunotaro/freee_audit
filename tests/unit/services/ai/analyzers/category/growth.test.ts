import { describe, it, expect, beforeEach } from 'vitest'
import { GrowthAnalyzer } from '@/services/ai/analyzers/category/growth'
import { DEFAULT_ANALYZER_CONFIG } from '@/services/ai/analyzers/config'
import { DeterministicIdGenerator } from '@/services/ai/analyzers/types'
import { NoOpLogger, MockTimeProvider } from '@/services/ai/analyzers/utils'
import type { BalanceSheet, ProfitLoss } from '@/types'

describe('GrowthAnalyzer', () => {
  let analyzer: GrowthAnalyzer

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

  beforeEach(() => {
    analyzer = new GrowthAnalyzer(
      DEFAULT_ANALYZER_CONFIG,
      new DeterministicIdGenerator(),
      new NoOpLogger(),
      new MockTimeProvider(new Date('2024-01-01'))
    )
  })

  describe('analyze', () => {
    it('should return analysis result with valid data', () => {
      const result = analyzer.analyze(createMockBalanceSheet(), createMockProfitLoss())

      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.score).toBeLessThanOrEqual(100)
      expect(result.metrics).toHaveLength(3)
      expect(result.alerts).toBeDefined()
    })

    it('should calculate revenue growth rate', () => {
      const prevPL = createMockProfitLoss({
        fiscalYear: 2023,
        revenue: [{ code: 'R001', name: '売上高', amount: 25000000 }],
      })

      const result = analyzer.analyze(
        createMockBalanceSheet(),
        createMockProfitLoss(),
        undefined,
        prevPL
      )

      const revenueGrowth = result.metrics.find((m) => m.name === '売上成長率')
      expect(revenueGrowth).toBeDefined()
      expect(revenueGrowth?.value).toBe(20)
      expect(revenueGrowth?.unit).toBe('%')
    })

    it('should calculate net income growth rate', () => {
      const prevPL = createMockProfitLoss({
        fiscalYear: 2023,
        netIncome: 4000000,
      })

      const result = analyzer.analyze(
        createMockBalanceSheet(),
        createMockProfitLoss(),
        undefined,
        prevPL
      )

      const netIncomeGrowth = result.metrics.find((m) => m.name === '純利益成長率')
      expect(netIncomeGrowth).toBeDefined()
      expect(netIncomeGrowth?.value).toBe(20)
      expect(netIncomeGrowth?.unit).toBe('%')
    })

    it('should calculate equity growth rate', () => {
      const prevBS = createMockBalanceSheet({
        fiscalYear: 2023,
        totalEquity: 10000000,
      })

      const result = analyzer.analyze(
        createMockBalanceSheet(),
        createMockProfitLoss(),
        prevBS,
        undefined
      )

      const equityGrowth = result.metrics.find((m) => m.name === '自己資本成長率')
      expect(equityGrowth).toBeDefined()
      expect(equityGrowth?.value).toBe(20)
      expect(equityGrowth?.unit).toBe('%')
    })

    it('should return fair status when no previous data', () => {
      const result = analyzer.analyze(createMockBalanceSheet(), createMockProfitLoss())

      result.metrics.forEach((m) => {
        expect(m.status).toBe('fair')
      })
    })

    it('should generate high alert for significant revenue decline', () => {
      const prevPL = createMockProfitLoss({
        fiscalYear: 2023,
        revenue: [{ code: 'R001', name: '売上高', amount: 50000000 }],
      })

      const result = analyzer.analyze(
        createMockBalanceSheet(),
        createMockProfitLoss(),
        undefined,
        prevPL
      )

      const highAlerts = result.alerts.filter((a) => a.severity === 'high')
      expect(highAlerts.length).toBeGreaterThan(0)
      expect(highAlerts[0].title).toContain('売上大幅減少')
    })

    it('should not generate alert for positive growth', () => {
      const prevPL = createMockProfitLoss({
        fiscalYear: 2023,
        revenue: [{ code: 'R001', name: '売上高', amount: 25000000 }],
      })

      const result = analyzer.analyze(
        createMockBalanceSheet(),
        createMockProfitLoss(),
        undefined,
        prevPL
      )

      expect(result.alerts.length).toBe(0)
    })

    it('should handle zero previous revenue', () => {
      const prevPL = createMockProfitLoss({
        fiscalYear: 2023,
        revenue: [],
      })

      const result = analyzer.analyze(
        createMockBalanceSheet(),
        createMockProfitLoss(),
        undefined,
        prevPL
      )

      expect(result.score).toBeGreaterThanOrEqual(0)
    })
  })

  describe('category', () => {
    it('should have growth category', () => {
      expect(analyzer.category).toBe('growth')
    })
  })
})
