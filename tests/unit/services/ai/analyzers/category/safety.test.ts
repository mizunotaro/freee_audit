import { describe, it, expect, beforeEach } from 'vitest'
import { SafetyAnalyzer } from '@/services/ai/analyzers/category/safety'
import { DEFAULT_ANALYZER_CONFIG } from '@/services/ai/analyzers/config'
import { DeterministicIdGenerator } from '@/services/ai/analyzers/types'
import { NoOpLogger, MockTimeProvider } from '@/services/ai/analyzers/utils'
import type { BalanceSheet, ProfitLoss } from '@/types'

describe('SafetyAnalyzer', () => {
  let analyzer: SafetyAnalyzer

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
    analyzer = new SafetyAnalyzer(
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

    it('should calculate equity ratio', () => {
      const result = analyzer.analyze(createMockBalanceSheet(), createMockProfitLoss())

      const equityRatio = result.metrics.find((m) => m.name === '自己資本比率')
      expect(equityRatio).toBeDefined()
      expect(equityRatio?.value).toBeGreaterThan(0)
      expect(equityRatio?.unit).toBe('%')
    })

    it('should calculate debt to equity ratio', () => {
      const result = analyzer.analyze(createMockBalanceSheet(), createMockProfitLoss())

      const debtToEquity = result.metrics.find((m) => m.name === '負債比率（D/Eレシオ）')
      expect(debtToEquity).toBeDefined()
      expect(debtToEquity?.value).toBeGreaterThanOrEqual(0)
      expect(debtToEquity?.unit).toBe('倍')
    })

    it('should calculate debt ratio', () => {
      const result = analyzer.analyze(createMockBalanceSheet(), createMockProfitLoss())

      const debtRatio = result.metrics.find((m) => m.name === '負債比率')
      expect(debtRatio).toBeDefined()
      expect(debtRatio?.value).toBeGreaterThanOrEqual(0)
      expect(debtRatio?.unit).toBe('%')
    })

    it('should generate critical alert for negative equity (insolvency)', () => {
      const bs = createMockBalanceSheet({
        equity: {
          items: [{ code: '5000', name: '資本金', amount: 5000000 }],
          total: -1000000,
        },
        totalEquity: -1000000,
        totalLiabilities: 19000000,
      })

      const result = analyzer.analyze(bs, createMockProfitLoss())

      const criticalAlerts = result.alerts.filter((a) => a.severity === 'critical')
      expect(criticalAlerts.length).toBeGreaterThan(0)
      expect(criticalAlerts[0].title).toContain('債務超過')
    })

    it('should generate critical alert for very low equity ratio', () => {
      const bs = createMockBalanceSheet({
        equity: {
          items: [{ code: '5000', name: '資本金', amount: 1000000 }],
          total: 1000000,
        },
        totalEquity: 1000000,
        totalAssets: 20000000,
        totalLiabilities: 19000000,
      })

      const result = analyzer.analyze(bs, createMockProfitLoss())

      const criticalAlerts = result.alerts.filter((a) => a.severity === 'critical')
      expect(criticalAlerts.length).toBeGreaterThan(0)
      expect(criticalAlerts[0].title).toContain('自己資本比率')
    })

    it('should generate medium alert for low equity ratio', () => {
      const bs = createMockBalanceSheet({
        equity: {
          items: [{ code: '5000', name: '資本金', amount: 3000000 }],
          total: 3000000,
        },
        totalEquity: 3000000,
        totalAssets: 20000000,
        totalLiabilities: 17000000,
      })

      const result = analyzer.analyze(bs, createMockProfitLoss())

      const mediumAlerts = result.alerts.filter((a) => a.severity === 'medium')
      expect(mediumAlerts.length).toBeGreaterThan(0)
    })

    it('should handle zero assets', () => {
      const bs = createMockBalanceSheet({
        assets: { current: [], fixed: [], total: 0 },
        totalAssets: 0,
      })

      const result = analyzer.analyze(bs, createMockProfitLoss())

      expect(result.score).toBeGreaterThanOrEqual(0)
    })

    it('should handle previous period data for trend', () => {
      const prevBS = createMockBalanceSheet({
        fiscalYear: 2023,
        equity: { items: [], total: 10000000 },
        totalEquity: 10000000,
        totalAssets: 16000000,
      })

      const result = analyzer.analyze(createMockBalanceSheet(), createMockProfitLoss(), prevBS)

      const equityRatio = result.metrics.find((m) => m.name === '自己資本比率')
      expect(equityRatio?.trend).toBeDefined()
    })
  })

  describe('category', () => {
    it('should have safety category', () => {
      expect(analyzer.category).toBe('safety')
    })
  })
})
