import { describe, it, expect } from 'vitest'
import {
  FinancialAnalyzer,
  analyzeFinancials,
  createFinancialAnalyzer,
} from '@/services/ai/analyzers/financial-analyzer'
import type { BalanceSheet, ProfitLoss } from '@/types'

describe('FinancialAnalyzer', () => {
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
    it('should return successful analysis with valid data', () => {
      const analyzer = new FinancialAnalyzer()
      const result = analyzer.analyze({
        balanceSheet: createMockBalanceSheet(),
        profitLoss: createMockProfitLoss(),
      })

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.overallScore).toBeGreaterThanOrEqual(0)
      expect(result.data?.overallScore).toBeLessThanOrEqual(100)
      expect(result.data?.categoryAnalyses).toHaveLength(5)
      expect(result.data?.analyzedAt).toBeInstanceOf(Date)
    })

    it('should return error for missing balance sheet', () => {
      const analyzer = new FinancialAnalyzer()
      const result = analyzer.analyze({
        balanceSheet: null as unknown as BalanceSheet,
        profitLoss: createMockProfitLoss(),
      })

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('invalid_statement_set')
    })

    it('should return error for missing profit loss', () => {
      const analyzer = new FinancialAnalyzer()
      const result = analyzer.analyze({
        balanceSheet: createMockBalanceSheet(),
        profitLoss: null as unknown as ProfitLoss,
      })

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('invalid_statement_set')
    })

    it('should detect critical liquidity issues', () => {
      const analyzer = new FinancialAnalyzer()
      const result = analyzer.analyze({
        balanceSheet: createMockBalanceSheet({
          assets: {
            current: [{ code: '1000', name: '現金', amount: 500000 }],
            fixed: [],
            total: 500000,
          },
          liabilities: {
            current: [{ code: '3000', name: '買掛金', amount: 5000000 }],
            fixed: [],
            total: 5000000,
          },
          totalAssets: 500000,
          totalLiabilities: 5000000,
          totalEquity: -4500000,
        }),
        profitLoss: createMockProfitLoss(),
      })

      expect(result.success).toBe(true)
      const criticalAlerts = result.data?.allAlerts.filter((a) => a.severity === 'critical') ?? []
      expect(criticalAlerts.length).toBeGreaterThan(0)
    })

    it('should analyze all categories', () => {
      const analyzer = new FinancialAnalyzer()
      const result = analyzer.analyze({
        balanceSheet: createMockBalanceSheet(),
        profitLoss: createMockProfitLoss(),
      })

      expect(result.success).toBe(true)
      const categories = result.data?.categoryAnalyses.map((c) => c.category) ?? []
      expect(categories).toContain('liquidity')
      expect(categories).toContain('safety')
      expect(categories).toContain('profitability')
      expect(categories).toContain('efficiency')
      expect(categories).toContain('growth')
    })

    it('should calculate correct liquidity metrics', () => {
      const analyzer = new FinancialAnalyzer()
      const result = analyzer.analyze({
        balanceSheet: createMockBalanceSheet(),
        profitLoss: createMockProfitLoss(),
      })

      expect(result.success).toBe(true)
      const liquidityCategory = result.data?.categoryAnalyses.find(
        (c) => c.category === 'liquidity'
      )
      expect(liquidityCategory).toBeDefined()
      expect(liquidityCategory?.alerts).toBeDefined()
      expect(liquidityCategory?.recommendations).toBeDefined()
    })

    it('should generate executive summary', () => {
      const analyzer = new FinancialAnalyzer()
      const result = analyzer.analyze({
        balanceSheet: createMockBalanceSheet(),
        profitLoss: createMockProfitLoss(),
      })

      expect(result.success).toBe(true)
      expect(result.data?.executiveSummary).toBeDefined()
      expect(result.data?.executiveSummary.length).toBeGreaterThan(0)
    })

    it('should include processing time', () => {
      const analyzer = new FinancialAnalyzer()
      const result = analyzer.analyze({
        balanceSheet: createMockBalanceSheet(),
        profitLoss: createMockProfitLoss(),
      })

      expect(result.success).toBe(true)
      expect(result.data?.processingTimeMs).toBeGreaterThanOrEqual(0)
    })
  })

  describe('analyzeFinancials', () => {
    it('should work as standalone function', () => {
      const result = analyzeFinancials({
        balanceSheet: createMockBalanceSheet(),
        profitLoss: createMockProfitLoss(),
      })

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
    })
  })

  describe('createFinancialAnalyzer', () => {
    it('should create analyzer instance', () => {
      const analyzer = createFinancialAnalyzer()
      expect(analyzer).toBeInstanceOf(FinancialAnalyzer)
    })
  })

  describe('with previous period data', () => {
    it('should include trend information', () => {
      const analyzer = new FinancialAnalyzer()
      const result = analyzer.analyze({
        balanceSheet: createMockBalanceSheet(),
        profitLoss: createMockProfitLoss(),
        previousBalanceSheet: createMockBalanceSheet({
          fiscalYear: 2023,
          totalAssets: 18000000,
          totalLiabilities: 9000000,
          totalEquity: 9000000,
        }),
        previousProfitLoss: createMockProfitLoss({
          fiscalYear: 2023,
          revenue: [{ code: 'R001', name: '売上高', amount: 18000000 }],
          netIncome: 2800000,
        }),
      })

      expect(result.success).toBe(true)
      const growthCategory = result.data?.categoryAnalyses.find((c) => c.category === 'growth')
      expect(growthCategory).toBeDefined()
    })
  })

  describe('alerts', () => {
    it('should detect negative equity (insolvency)', () => {
      const analyzer = new FinancialAnalyzer()
      const result = analyzer.analyze({
        balanceSheet: createMockBalanceSheet({
          totalEquity: -5000000,
          totalLiabilities: 25000000,
        }),
        profitLoss: createMockProfitLoss(),
      })

      expect(result.success).toBe(true)
      const criticalAlerts =
        result.data?.allAlerts.filter(
          (a) => a.severity === 'critical' && a.title.includes('債務超過')
        ) ?? []
      expect(criticalAlerts.length).toBeGreaterThan(0)
    })

    it('should detect net loss', () => {
      const analyzer = new FinancialAnalyzer()
      const result = analyzer.analyze({
        balanceSheet: createMockBalanceSheet(),
        profitLoss: createMockProfitLoss({
          netIncome: -1000000,
        }),
      })

      expect(result.success).toBe(true)
      const lossAlerts = result.data?.allAlerts.filter((a) => a.title.includes('赤字')) ?? []
      expect(lossAlerts.length).toBeGreaterThan(0)
    })
  })

  describe('recommendations', () => {
    it('should generate recommendations based on alerts', () => {
      const analyzer = new FinancialAnalyzer()
      const result = analyzer.analyze({
        balanceSheet: createMockBalanceSheet({
          totalEquity: -5000000,
          totalLiabilities: 25000000,
        }),
        profitLoss: createMockProfitLoss({
          netIncome: -1000000,
        }),
      })

      expect(result.success).toBe(true)
      expect(result.data?.topRecommendations.length).toBeGreaterThan(0)
    })

    it('should prioritize high priority recommendations', () => {
      const analyzer = new FinancialAnalyzer()
      const result = analyzer.analyze({
        balanceSheet: createMockBalanceSheet({
          totalEquity: -5000000,
          totalLiabilities: 25000000,
        }),
        profitLoss: createMockProfitLoss({
          netIncome: -1000000,
        }),
      })

      expect(result.success).toBe(true)
      const highPriority =
        result.data?.topRecommendations.filter((r) => r.priority === 'high') ?? []
      expect(highPriority.length).toBeGreaterThan(0)
    })
  })
})
