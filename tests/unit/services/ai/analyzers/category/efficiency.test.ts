import { describe, it, expect, beforeEach } from 'vitest'
import { EfficiencyAnalyzer } from '@/services/ai/analyzers/category/efficiency'
import { DEFAULT_ANALYZER_CONFIG } from '@/services/ai/analyzers/config'
import { DeterministicIdGenerator } from '@/services/ai/analyzers/types'
import { NoOpLogger, MockTimeProvider } from '@/services/ai/analyzers/utils'
import type { BalanceSheet, ProfitLoss } from '@/types'

describe('EfficiencyAnalyzer', () => {
  let analyzer: EfficiencyAnalyzer

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
    analyzer = new EfficiencyAnalyzer(
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
      expect(result.metrics).toHaveLength(1)
      expect(result.alerts).toBeDefined()
    })

    it('should calculate asset turnover', () => {
      const result = analyzer.analyze(createMockBalanceSheet(), createMockProfitLoss())

      const assetTurnover = result.metrics.find((m) => m.name === '総資産回転率')
      expect(assetTurnover).toBeDefined()
      expect(assetTurnover?.value).toBeGreaterThan(0)
      expect(assetTurnover?.unit).toBe('回')
    })

    it('should generate low alert for low asset turnover', () => {
      const bs = createMockBalanceSheet({
        totalAssets: 100000000,
      })
      const pl = createMockProfitLoss({
        revenue: [{ code: 'R001', name: '売上高', amount: 1000000 }],
      })

      const result = analyzer.analyze(bs, pl)

      const lowAlerts = result.alerts.filter((a) => a.severity === 'low')
      expect(lowAlerts.length).toBeGreaterThan(0)
      expect(lowAlerts[0].title).toContain('資産効率')
    })

    it('should not generate alert for healthy asset turnover', () => {
      const result = analyzer.analyze(createMockBalanceSheet(), createMockProfitLoss())

      expect(result.alerts.length).toBe(0)
    })

    it('should handle zero assets', () => {
      const bs = createMockBalanceSheet({
        assets: { current: [], fixed: [], total: 0 },
        totalAssets: 0,
      })

      const result = analyzer.analyze(bs, createMockProfitLoss())

      expect(result.score).toBeGreaterThanOrEqual(0)
    })

    it('should handle previous period data for average calculation', () => {
      const prevBS = createMockBalanceSheet({
        fiscalYear: 2023,
        totalAssets: 15000000,
      })

      const result = analyzer.analyze(createMockBalanceSheet(), createMockProfitLoss(), prevBS)

      const assetTurnover = result.metrics.find((m) => m.name === '総資産回転率')
      expect(assetTurnover).toBeDefined()
    })
  })

  describe('category', () => {
    it('should have efficiency category', () => {
      expect(analyzer.category).toBe('efficiency')
    })
  })
})
