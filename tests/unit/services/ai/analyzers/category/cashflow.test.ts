import { describe, it, expect, beforeEach } from 'vitest'
import { CashflowAnalyzer } from '@/services/ai/analyzers/category/cashflow'
import { DEFAULT_ANALYZER_CONFIG } from '@/services/ai/analyzers/config'
import { DeterministicIdGenerator } from '@/services/ai/analyzers/types'
import { NoOpLogger, MockTimeProvider } from '@/services/ai/analyzers/utils'
import type { BalanceSheet, ProfitLoss } from '@/types'

describe('CashflowAnalyzer', () => {
  let analyzer: CashflowAnalyzer

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
    analyzer = new CashflowAnalyzer(
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
      expect(result.metrics).toHaveLength(2)
      expect(result.alerts).toBeDefined()
    })

    it('should calculate operating cash flow', () => {
      const result = analyzer.analyze(createMockBalanceSheet(), createMockProfitLoss())

      const operatingCF = result.metrics.find((m) => m.name === '営業CF')
      expect(operatingCF).toBeDefined()
      expect(operatingCF?.value).toBe(5300000)
      expect(operatingCF?.unit).toBe('円')
    })

    it('should calculate operating CF margin', () => {
      const result = analyzer.analyze(createMockBalanceSheet(), createMockProfitLoss())

      const ocfMargin = result.metrics.find((m) => m.name === '営業CFマージン')
      expect(ocfMargin).toBeDefined()
      expect(ocfMargin?.value).toBeGreaterThan(0)
      expect(ocfMargin?.unit).toBe('%')
    })

    it('should generate high alert for negative operating cash flow', () => {
      const pl = createMockProfitLoss({
        netIncome: -1000000,
        depreciation: 500000,
      })

      const result = analyzer.analyze(createMockBalanceSheet(), pl)

      const highAlerts = result.alerts.filter((a) => a.severity === 'high')
      expect(highAlerts.length).toBeGreaterThan(0)
      expect(highAlerts[0].title).toContain('マイナス')
    })

    it('should not generate alert for positive operating cash flow', () => {
      const result = analyzer.analyze(createMockBalanceSheet(), createMockProfitLoss())

      expect(result.alerts.length).toBe(0)
    })

    it('should handle zero net income with depreciation', () => {
      const pl = createMockProfitLoss({
        netIncome: 0,
        depreciation: 500000,
      })

      const result = analyzer.analyze(createMockBalanceSheet(), pl)

      const operatingCF = result.metrics.find((m) => m.name === '営業CF')
      expect(operatingCF?.value).toBe(500000)
    })

    it('should handle missing depreciation', () => {
      const pl = createMockProfitLoss({
        netIncome: 1000000,
        depreciation: undefined as unknown as number,
      })

      const result = analyzer.analyze(createMockBalanceSheet(), pl)

      expect(result.score).toBeGreaterThanOrEqual(0)
    })

    it('should return good status for positive operating cash flow', () => {
      const result = analyzer.analyze(createMockBalanceSheet(), createMockProfitLoss())

      const operatingCF = result.metrics.find((m) => m.name === '営業CF')
      expect(operatingCF?.status).toBe('good')
    })

    it('should return fair status for zero operating cash flow', () => {
      const pl = createMockProfitLoss({
        netIncome: 0,
        depreciation: 0,
      })

      const result = analyzer.analyze(createMockBalanceSheet(), pl)

      const operatingCF = result.metrics.find((m) => m.name === '営業CF')
      expect(operatingCF?.status).toBe('fair')
    })

    it('should return poor status for negative operating cash flow', () => {
      const pl = createMockProfitLoss({
        netIncome: -1000000,
        depreciation: 0,
      })

      const result = analyzer.analyze(createMockBalanceSheet(), pl)

      const operatingCF = result.metrics.find((m) => m.name === '営業CF')
      expect(operatingCF?.status).toBe('poor')
    })
  })

  describe('category', () => {
    it('should have cashflow category', () => {
      expect(analyzer.category).toBe('cashflow')
    })
  })
})
