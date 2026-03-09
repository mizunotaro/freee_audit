import { describe, it, expect, beforeEach } from 'vitest'
import { FinancialAnalyzer } from '@/services/ai/analyzers/financial-analyzer'
import type { BalanceSheet, ProfitLoss } from '@/types'

describe('FinancialAnalyzer executive summary', () => {
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

  beforeEach(() => {
    analyzer = new FinancialAnalyzer()
  })

  it('should include critical alerts in executive summary', () => {
    const bs = createMockBalanceSheet({
      equity: { items: [], total: -1000000 },
      totalEquity: -1000000,
      totalLiabilities: 19000000,
    })

    const result = analyzer.analyze({ balanceSheet: bs, profitLoss: createMockProfitLoss() })

    expect(result.success).toBe(true)
    expect(result.data?.executiveSummary).toContain('緊急')
  })

  it('should include high alerts in executive summary', () => {
    const pl = createMockProfitLoss({
      netIncome: -5000000,
    })

    const result = analyzer.analyze({ balanceSheet: createMockBalanceSheet(), profitLoss: pl })

    expect(result.success).toBe(true)
    expect(result.data?.executiveSummary).toContain('重要')
  })

  it('should include strong categories in executive summary', () => {
    const result = analyzer.analyze({
      balanceSheet: createMockBalanceSheet(),
      profitLoss: createMockProfitLoss(),
    })

    expect(result.success).toBe(true)
    expect(result.data?.executiveSummary).toBeDefined()
    expect(result.data?.executiveSummary.length).toBeGreaterThan(0)
  })

  it('should handle multiple high alerts', () => {
    const bs = createMockBalanceSheet({
      assets: {
        current: [{ code: '1001', name: '現金', amount: 100000 }],
        fixed: [],
        total: 100000,
      },
      totalAssets: 100000,
    })

    const pl = createMockProfitLoss({
      netIncome: -1000000,
    })

    const result = analyzer.analyze({ balanceSheet: bs, profitLoss: pl })

    expect(result.success).toBe(true)
    expect(result.data?.executiveSummary).toBeDefined()
  })

  it('should handle all strong categories', () => {
    const bs = createMockBalanceSheet({
      totalEquity: 15000000,
      totalLiabilities: 3000000,
    })

    const pl = createMockProfitLoss({
      grossProfit: 15000000,
      grossProfitMargin: 75,
      operatingIncome: 10000000,
      operatingMargin: 50,
      netIncome: 8000000,
    })

    const result = analyzer.analyze({ balanceSheet: bs, profitLoss: pl })

    expect(result.success).toBe(true)
    expect(result.data?.executiveSummary).toContain('強み')
  })
})
