import { describe, it, expect, beforeEach } from 'vitest'
import { ProfitabilityAnalyzer } from '@/services/ai/analyzers/category/profitability'
import { DEFAULT_ANALYZER_CONFIG } from '@/services/ai/analyzers/config'
import { DeterministicIdGenerator } from '@/services/ai/analyzers/types'
import { NoOpLogger, MockTimeProvider } from '@/services/ai/analyzers/utils'
import type { BalanceSheet, ProfitLoss } from '@/types'

describe('ProfitabilityAnalyzer', () => {
  let analyzer: ProfitabilityAnalyzer

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
    analyzer = new ProfitabilityAnalyzer(
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
      expect(result.metrics).toHaveLength(5)
      expect(result.alerts).toBeDefined()
    })

    it('should calculate gross margin', () => {
      const result = analyzer.analyze(createMockBalanceSheet(), createMockProfitLoss())

      const grossMargin = result.metrics.find((m) => m.name === '売上総利益率')
      expect(grossMargin).toBeDefined()
      expect(grossMargin?.value).toBe(40)
      expect(grossMargin?.unit).toBe('%')
    })

    it('should calculate operating margin', () => {
      const result = analyzer.analyze(createMockBalanceSheet(), createMockProfitLoss())

      const operatingMargin = result.metrics.find((m) => m.name === '営業利益率')
      expect(operatingMargin).toBeDefined()
      expect(operatingMargin?.value).toBe(20)
      expect(operatingMargin?.unit).toBe('%')
    })

    it('should calculate net margin', () => {
      const result = analyzer.analyze(createMockBalanceSheet(), createMockProfitLoss())

      const netMargin = result.metrics.find((m) => m.name === '当期純利益率')
      expect(netMargin).toBeDefined()
      expect(netMargin?.value).toBeGreaterThan(0)
      expect(netMargin?.unit).toBe('%')
    })

    it('should calculate ROA', () => {
      const result = analyzer.analyze(createMockBalanceSheet(), createMockProfitLoss())

      const roa = result.metrics.find((m) => m.name === 'ROA（総資産利益率）')
      expect(roa).toBeDefined()
      expect(roa?.value).toBeGreaterThan(0)
      expect(roa?.unit).toBe('%')
    })

    it('should calculate ROE', () => {
      const result = analyzer.analyze(createMockBalanceSheet(), createMockProfitLoss())

      const roe = result.metrics.find((m) => m.name === 'ROE（自己資本利益率）')
      expect(roe).toBeDefined()
      expect(roe?.value).toBeGreaterThan(0)
      expect(roe?.unit).toBe('%')
    })

    it('should generate high alert for net loss', () => {
      const pl = createMockProfitLoss({
        netIncome: -1000000,
      })

      const result = analyzer.analyze(createMockBalanceSheet(), pl)

      const highAlerts = result.alerts.filter((a) => a.severity === 'high')
      expect(highAlerts.length).toBeGreaterThan(0)
      expect(highAlerts[0].title).toContain('赤字')
    })

    it('should generate medium alert for low operating margin', () => {
      const pl = createMockProfitLoss({
        operatingIncome: 100000,
        operatingMargin: 0.5,
      })

      const result = analyzer.analyze(createMockBalanceSheet(), pl)

      const mediumAlerts = result.alerts.filter((a) => a.severity === 'medium')
      expect(mediumAlerts.length).toBeGreaterThan(0)
    })

    it('should handle zero revenue', () => {
      const pl = createMockProfitLoss({
        revenue: [],
        grossProfit: 0,
        operatingIncome: 0,
        netIncome: 0,
      })

      const result = analyzer.analyze(createMockBalanceSheet(), pl)

      expect(result.score).toBeGreaterThanOrEqual(0)
    })

    it('should handle previous period data for trend', () => {
      const prevPL = createMockProfitLoss({
        fiscalYear: 2023,
        grossProfit: 6000000,
        revenue: [{ code: 'R001', name: '売上高', amount: 18000000 }],
      })

      const result = analyzer.analyze(
        createMockBalanceSheet(),
        createMockProfitLoss(),
        undefined,
        prevPL
      )

      const grossMargin = result.metrics.find((m) => m.name === '売上総利益率')
      expect(grossMargin?.trend).toBeDefined()
    })
  })

  describe('category', () => {
    it('should have profitability category', () => {
      expect(analyzer.category).toBe('profitability')
    })
  })
})
