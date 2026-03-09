import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  FinancialAnalyzer,
  createFinancialAnalyzer,
  analyzeFinancials,
} from '@/services/ai/analyzers/financial-analyzer'
import { DEFAULT_ANALYZER_CONFIG } from '@/services/ai/analyzers/config'
import { DeterministicIdGenerator } from '@/services/ai/analyzers/types'
import { NoOpLogger, MockTimeProvider, CircuitBreaker } from '@/services/ai/analyzers/utils'
import type { FinancialStatementSet, AnalysisOptions } from '@/services/ai/analyzers/types'
import type { BalanceSheet, ProfitLoss } from '@/types'

describe('FinancialAnalyzer', () => {
  let analyzer: FinancialAnalyzer

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

  const createMockStatementSet = (
    overrides: Partial<FinancialStatementSet> = {}
  ): FinancialStatementSet => ({
    balanceSheet: createMockBalanceSheet(),
    profitLoss: createMockProfitLoss(),
    ...overrides,
  })

  beforeEach(() => {
    analyzer = new FinancialAnalyzer()
  })

  describe('constructor', () => {
    it('should create analyzer with default config', () => {
      const a = new FinancialAnalyzer()
      expect(a).toBeInstanceOf(FinancialAnalyzer)
    })

    it('should create analyzer with custom config', () => {
      const a = new FinancialAnalyzer({ timeout: 60000 })
      expect(a).toBeInstanceOf(FinancialAnalyzer)
    })
  })

  describe('create', () => {
    it('should create analyzer with default options', () => {
      const a = FinancialAnalyzer.create()
      expect(a).toBeInstanceOf(FinancialAnalyzer)
    })

    it('should create analyzer with custom config', () => {
      const a = FinancialAnalyzer.create({ config: { timeout: 60000 } })
      expect(a).toBeInstanceOf(FinancialAnalyzer)
    })

    it('should create deterministic analyzer', () => {
      const a = FinancialAnalyzer.create({ deterministic: true })
      expect(a).toBeInstanceOf(FinancialAnalyzer)
    })

    it('should create deterministic analyzer with fixed timestamp', () => {
      const fixedDate = new Date('2024-01-01')
      const a = FinancialAnalyzer.create({
        deterministic: true,
        fixedTimestamp: fixedDate,
      })
      expect(a).toBeInstanceOf(FinancialAnalyzer)
    })

    it('should create analyzer with custom idGenerator', () => {
      const a = FinancialAnalyzer.create({
        idGenerator: new DeterministicIdGenerator(),
      })
      expect(a).toBeInstanceOf(FinancialAnalyzer)
    })

    it('should create analyzer with custom timeProvider', () => {
      const a = FinancialAnalyzer.create({
        timeProvider: new MockTimeProvider(new Date()),
      })
      expect(a).toBeInstanceOf(FinancialAnalyzer)
    })

    it('should create analyzer with custom logger', () => {
      const a = FinancialAnalyzer.create({
        logger: new NoOpLogger(),
      })
      expect(a).toBeInstanceOf(FinancialAnalyzer)
    })
  })

  describe('getCircuitBreaker', () => {
    it('should return circuit breaker instance', () => {
      const cb = analyzer.getCircuitBreaker()
      expect(cb).toBeInstanceOf(CircuitBreaker)
    })
  })

  describe('getCircuitBreakerState', () => {
    it('should return closed state initially', () => {
      const state = analyzer.getCircuitBreakerState()
      expect(state).toBe('closed')
    })
  })

  describe('analyze', () => {
    it('should return successful analysis result', () => {
      const result = analyzer.analyze(createMockStatementSet())

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.overallScore).toBeGreaterThanOrEqual(0)
      expect(result.data?.overallScore).toBeLessThanOrEqual(100)
    })

    it('should return category analyses', () => {
      const result = analyzer.analyze(createMockStatementSet())

      expect(result.success).toBe(true)
      expect(result.data?.categoryAnalyses).toBeDefined()
      expect(result.data?.categoryAnalyses.length).toBeGreaterThan(0)
    })

    it('should return all alerts', () => {
      const result = analyzer.analyze(createMockStatementSet())

      expect(result.success).toBe(true)
      expect(result.data?.allAlerts).toBeDefined()
    })

    it('should return top recommendations', () => {
      const result = analyzer.analyze(createMockStatementSet())

      expect(result.success).toBe(true)
      expect(result.data?.topRecommendations).toBeDefined()
    })

    it('should return key metrics', () => {
      const result = analyzer.analyze(createMockStatementSet())

      expect(result.success).toBe(true)
      expect(result.data?.keyMetrics).toBeDefined()
    })

    it('should return executive summary', () => {
      const result = analyzer.analyze(createMockStatementSet())

      expect(result.success).toBe(true)
      expect(result.data?.executiveSummary).toBeDefined()
      expect(result.data?.executiveSummary.length).toBeGreaterThan(0)
    })

    it('should return processing time', () => {
      const result = analyzer.analyze(createMockStatementSet())

      expect(result.success).toBe(true)
      expect(result.data?.processingTimeMs).toBeGreaterThanOrEqual(0)
    })

    it('should return analyzed at date', () => {
      const result = analyzer.analyze(createMockStatementSet())

      expect(result.success).toBe(true)
      expect(result.data?.analyzedAt).toBeInstanceOf(Date)
    })

    it('should analyze specific category only', () => {
      const result = analyzer.analyze(createMockStatementSet(), { category: 'liquidity' })

      expect(result.success).toBe(true)
      expect(result.data?.categoryAnalyses).toHaveLength(1)
      expect(result.data?.categoryAnalyses[0].category).toBe('liquidity')
    })

    it('should handle invalid statements', () => {
      const result = analyzer.analyze({
        balanceSheet: {} as BalanceSheet,
        profitLoss: {} as ProfitLoss,
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should include previous period data', () => {
      const result = analyzer.analyze({
        balanceSheet: createMockBalanceSheet(),
        profitLoss: createMockProfitLoss(),
        previousBalanceSheet: createMockBalanceSheet({ fiscalYear: 2023 }),
        previousProfitLoss: createMockProfitLoss({ fiscalYear: 2023 }),
      })

      expect(result.success).toBe(true)
    })

    it('should generate alerts for poor metrics', () => {
      const bs = createMockBalanceSheet({
        assets: {
          current: [{ code: '1001', name: '現金', amount: 500000 }],
          fixed: [],
          total: 500000,
        },
        totalAssets: 500000,
      })

      const result = analyzer.analyze({ balanceSheet: bs, profitLoss: createMockProfitLoss() })

      expect(result.success).toBe(true)
      expect(result.data?.allAlerts.length).toBeGreaterThan(0)
    })
  })

  describe('analyzeAsync', () => {
    it('should return successful analysis result', async () => {
      const result = await analyzer.analyzeAsync(createMockStatementSet())

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
    })

    it('should analyze all categories', async () => {
      const result = await analyzer.analyzeAsync(createMockStatementSet())

      expect(result.success).toBe(true)
      expect(result.data?.categoryAnalyses.length).toBe(5)
    })
  })

  describe('analyzeWithCircuitBreaker', () => {
    it('should return successful result through circuit breaker', async () => {
      const result = await analyzer.analyzeWithCircuitBreaker(createMockStatementSet())

      expect(result.success).toBe(true)
    })
  })
})

describe('createFinancialAnalyzer', () => {
  it('should create analyzer instance', () => {
    const a = createFinancialAnalyzer()
    expect(a).toBeInstanceOf(FinancialAnalyzer)
  })

  it('should create analyzer with config', () => {
    const a = createFinancialAnalyzer({ timeout: 60000 })
    expect(a).toBeInstanceOf(FinancialAnalyzer)
  })
})

describe('analyzeFinancials', () => {
  it('should analyze statements', () => {
    const bs: BalanceSheet = {
      fiscalYear: 2024,
      month: 12,
      assets: {
        current: [{ code: '1001', name: '現金預金', amount: 10000000 }],
        fixed: [],
        total: 10000000,
      },
      liabilities: {
        current: [{ code: '3000', name: '買掛金', amount: 5000000 }],
        fixed: [],
        total: 5000000,
      },
      equity: {
        items: [{ code: '5000', name: '資本金', amount: 5000000 }],
        total: 5000000,
      },
      totalAssets: 10000000,
      totalLiabilities: 5000000,
      totalEquity: 5000000,
    }

    const pl: ProfitLoss = {
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
    }

    const result = analyzeFinancials({ balanceSheet: bs, profitLoss: pl })

    expect(result.success).toBe(true)
    expect(result.data?.overallScore).toBeGreaterThanOrEqual(0)
  })
})

describe('FinancialAnalyzer edge cases', () => {
  it('should handle empty current assets', () => {
    const analyzer = new FinancialAnalyzer()
    const bs: BalanceSheet = {
      fiscalYear: 2024,
      month: 12,
      assets: { current: [], fixed: [], total: 0 },
      liabilities: { current: [], fixed: [], total: 0 },
      equity: { items: [], total: 0 },
      totalAssets: 0,
      totalLiabilities: 0,
      totalEquity: 0,
    }
    const pl: ProfitLoss = {
      fiscalYear: 2024,
      month: 12,
      revenue: [],
      costOfSales: [],
      grossProfit: 0,
      grossProfitMargin: 0,
      sgaExpenses: [],
      operatingIncome: 0,
      operatingMargin: 0,
      nonOperatingIncome: [],
      nonOperatingExpenses: [],
      ordinaryIncome: 0,
      extraordinaryIncome: [],
      extraordinaryLoss: [],
      incomeBeforeTax: 0,
      incomeTax: 0,
      netIncome: 0,
      depreciation: 0,
    }

    const result = analyzer.analyze({ balanceSheet: bs, profitLoss: pl })
    expect(result.success).toBe(true)
  })

  it('should handle comprehensive category', () => {
    const analyzer = new FinancialAnalyzer()
    const result = analyzer.analyze(
      {
        balanceSheet: {
          fiscalYear: 2024,
          month: 12,
          assets: { current: [], fixed: [], total: 0 },
          liabilities: { current: [], fixed: [], total: 0 },
          equity: { items: [], total: 0 },
          totalAssets: 0,
          totalLiabilities: 0,
          totalEquity: 0,
        },
        profitLoss: {
          fiscalYear: 2024,
          month: 12,
          revenue: [],
          costOfSales: [],
          grossProfit: 0,
          grossProfitMargin: 0,
          sgaExpenses: [],
          operatingIncome: 0,
          operatingMargin: 0,
          nonOperatingIncome: [],
          nonOperatingExpenses: [],
          ordinaryIncome: 0,
          extraordinaryIncome: [],
          extraordinaryLoss: [],
          incomeBeforeTax: 0,
          incomeTax: 0,
          netIncome: 0,
          depreciation: 0,
        },
      },
      { category: 'liquidity' }
    )

    expect(result.success).toBe(true)
  })

  it('should handle cache hit', () => {
    const analyzer = new FinancialAnalyzer()
    const statements = {
      balanceSheet: {
        fiscalYear: 2024,
        month: 12,
        assets: { current: [], fixed: [], total: 0 },
        liabilities: { current: [], fixed: [], total: 0 },
        equity: { items: [], total: 0 },
        totalAssets: 0,
        totalLiabilities: 0,
        totalEquity: 0,
      },
      profitLoss: {
        fiscalYear: 2024,
        month: 12,
        revenue: [],
        costOfSales: [],
        grossProfit: 0,
        grossProfitMargin: 0,
        sgaExpenses: [],
        operatingIncome: 0,
        operatingMargin: 0,
        nonOperatingIncome: [],
        nonOperatingExpenses: [],
        ordinaryIncome: 0,
        extraordinaryIncome: [],
        extraordinaryLoss: [],
        incomeBeforeTax: 0,
        incomeTax: 0,
        netIncome: 0,
        depreciation: 0,
      },
    }

    const result1 = analyzer.analyze(statements)
    const result2 = analyzer.analyze(statements)

    expect(result1.success).toBe(true)
    expect(result2.success).toBe(true)
  })
})
