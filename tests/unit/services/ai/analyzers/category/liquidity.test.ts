import { describe, it, expect, beforeEach } from 'vitest'
import { LiquidityAnalyzer } from '@/services/ai/analyzers/category/liquidity'
import { DEFAULT_ANALYZER_CONFIG } from '@/services/ai/analyzers/config'
import { DeterministicIdGenerator } from '@/services/ai/analyzers/types'
import { NoOpLogger, MockTimeProvider } from '@/services/ai/analyzers/utils'
import type { BalanceSheet, ProfitLoss } from '@/types'

describe('LiquidityAnalyzer', () => {
  let analyzer: LiquidityAnalyzer

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

  beforeEach(() => {
    analyzer = new LiquidityAnalyzer(
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

    it('should calculate current ratio', () => {
      const result = analyzer.analyze(createMockBalanceSheet(), createMockProfitLoss())

      const currentRatio = result.metrics.find((m) => m.name === '流動比率')
      expect(currentRatio).toBeDefined()
      expect(currentRatio?.value).toBeCloseTo(333.33, 1)
      expect(currentRatio?.unit).toBe('%')
    })

    it('should calculate quick ratio', () => {
      const result = analyzer.analyze(createMockBalanceSheet(), createMockProfitLoss())

      const quickRatio = result.metrics.find((m) => m.name === '当座比率')
      expect(quickRatio).toBeDefined()
      expect(quickRatio?.value).toBeGreaterThan(0)
    })

    it('should calculate cash ratio', () => {
      const result = analyzer.analyze(createMockBalanceSheet(), createMockProfitLoss())

      const cashRatio = result.metrics.find((m) => m.name === 'キャッシュ比率')
      expect(cashRatio).toBeDefined()
      expect(cashRatio?.value).toBeGreaterThan(0)
    })

    it('should generate critical alert for very low current ratio', () => {
      const bs = createMockBalanceSheet({
        assets: {
          current: [{ code: '1001', name: '現金', amount: 500000 }],
          fixed: [],
          total: 500000,
        },
        totalAssets: 500000,
      })

      const result = analyzer.analyze(bs, createMockProfitLoss())

      const criticalAlerts = result.alerts.filter((a) => a.severity === 'critical')
      expect(criticalAlerts.length).toBeGreaterThan(0)
      expect(criticalAlerts[0].title).toContain('流動比率')
    })

    it('should generate medium alert for low current ratio', () => {
      const bs = createMockBalanceSheet({
        assets: {
          current: [{ code: '1001', name: '現金', amount: 2500000 }],
          fixed: [],
          total: 2500000,
        },
        totalAssets: 2500000,
      })

      const result = analyzer.analyze(bs, createMockProfitLoss())

      const alerts = result.alerts.filter((a) => a.severity === 'medium')
      expect(alerts.length).toBeGreaterThan(0)
    })

    it('should not generate alert for healthy current ratio', () => {
      const result = analyzer.analyze(createMockBalanceSheet(), createMockProfitLoss())
      expect(result.alerts.length).toBe(0)
    })

    it('should handle zero current liabilities', () => {
      const bs = createMockBalanceSheet({
        liabilities: {
          current: [],
          fixed: [{ code: '4000', name: '長期借入金', amount: 8000000 }],
          total: 8000000,
        },
      })

      const result = analyzer.analyze(bs, createMockProfitLoss())

      expect(result.score).toBeGreaterThanOrEqual(0)
    })

    it('should handle previous period data for trend', () => {
      const prevBS = createMockBalanceSheet({
        fiscalYear: 2023,
        assets: {
          current: [{ code: '1001', name: '現金', amount: 4000000 }],
          fixed: [],
          total: 4000000,
        },
        totalAssets: 4000000,
      })

      const result = analyzer.analyze(createMockBalanceSheet(), createMockProfitLoss(), prevBS)

      const currentRatio = result.metrics.find((m) => m.name === '流動比率')
      expect(currentRatio?.trend).toBeDefined()
    })
  })
})
