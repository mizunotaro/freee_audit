import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generatePeriodicReport } from '@/services/report/periodic-report'
import { clearBalanceCache } from '@/services/report/balance-loader'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    monthlyBalance: { findMany: vi.fn() },
  },
}))

// Pinned "now": 2024-04-15. With fiscalYearEndMonth=3, currentMonth(4) > 3, so the
// 3-month window is [month 2, month 3, month 4] of fiscal year 2024.
const PINNED_NOW = new Date('2024-04-15T12:00:00')

function prow(month: number, category: string, accountCode: string, amount: number) {
  return {
    id: `${accountCode}-${month}`,
    companyId: 'co-1',
    fiscalYear: 2024,
    month,
    accountCode,
    accountName: category,
    category,
    amount,
  }
}

// Period categories use the PLURAL forms (current_assets, sales, ...) — distinct
// from monthly-report's singular forms.
function fullPeriodBalances(
  month: number,
  sales: number,
  cogs: number,
  cash: number,
  equity: number
) {
  return [
    prow(month, 'sales', '4000', sales),
    prow(month, 'cost_of_sales', '5000', cogs),
    prow(month, 'sga_expenses', '6100', 200),
    prow(month, 'non_operating_income', '7000', 50),
    prow(month, 'non_operating_expenses', '7100', 20),
    prow(month, 'current_assets', '1000', cash),
    prow(month, 'fixed_assets', '2000', 3000),
    prow(month, 'current_liabilities', '3000', 1000),
    prow(month, 'fixed_liabilities', '4000', 500),
    prow(month, 'net_assets', '5000', equity),
  ]
}

describe('generatePeriodicReport — real-balance mapping (edge cases)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearBalanceCache()
    vi.useFakeTimers()
    vi.setSystemTime(PINNED_NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('maps recorded balances into exact BS/PL/CF/KPI figures for the first period', async () => {
    const balances = [
      ...fullPeriodBalances(2, 1000, 400, 5000, 6000),
      ...fullPeriodBalances(3, 1100, 440, 5200, 6200),
      ...fullPeriodBalances(4, 1200, 480, 5400, 6400),
    ]
    vi.mocked(prisma.monthlyBalance.findMany).mockResolvedValue(balances as never)

    const result = await generatePeriodicReport({
      companyId: 'co-1',
      fiscalYearEndMonth: 3,
      periodType: '3months',
      includePreviousYear: false,
    })

    expect(result.periods).toHaveLength(3)
    const first = result.periods[0]
    expect(first.endMonth).toBe(2)

    // BS — totals aggregate the plural category buckets
    expect(first.balanceSheet).toEqual({
      totalAssets: 8000,
      currentAssets: 5000,
      fixedAssets: 3000,
      totalLiabilities: 1500,
      currentLiabilities: 1000,
      fixedLiabilities: 500,
      equity: 6000,
    })

    // PL — full indirect chain down to net income (no tax/special -> netIncome = ordinary)
    expect(first.profitLoss).toEqual({
      revenue: 1000,
      costOfSales: 400,
      grossProfit: 600,
      operatingIncome: 400,
      ordinaryIncome: 430,
      netIncome: 430,
    })

    // CF — first period has no previous month recorded → falls back to netIncome only
    expect(first.cashFlow).toEqual({
      operatingCF: 430,
      investingCF: 0,
      financingCF: 0,
      freeCashFlow: 430,
    })
    expect(first.endingCash).toBe(5000)

    // KPIs — rounded to 2 decimals
    expect(first.kpis).toEqual({
      roe: 7.17,
      roa: 5.38,
      grossMargin: 60,
      operatingMargin: 40,
      currentRatio: 500,
      debtToEquity: 0.25,
    })
  })

  it('computes summary growth, cash change and the all-stable trend string', async () => {
    const balances = [
      ...fullPeriodBalances(2, 1000, 400, 5000, 6000),
      ...fullPeriodBalances(3, 1100, 440, 5200, 6200),
      ...fullPeriodBalances(4, 1200, 480, 5400, 6400),
    ]
    vi.mocked(prisma.monthlyBalance.findMany).mockResolvedValue(balances as never)

    const result = await generatePeriodicReport({
      companyId: 'co-1',
      fiscalYearEndMonth: 3,
      periodType: '3months',
      includePreviousYear: false,
    })

    const summary = result.summary
    // first.revenue=1000, last.revenue=1200 → +20%
    expect(summary.revenueGrowth).toBe(20)
    // first.netIncome=430, last.netIncome=550 → +27.91%
    expect(summary.profitGrowth).toBe(27.91)
    // last.cash(5400) - first.cash(5000)
    expect(summary.cashChange).toBe(400)
    expect(Number.isFinite(summary.avgROE)).toBe(true)
    expect(summary.avgROE).toBeGreaterThan(0)
    expect(summary.trendAnalysis).toBe('売上・利益・キャッシュ全てが安定して成長しています')
  })

  it('returns null growth and the cash-caution trend when every denominator is zero', async () => {
    // One zero-amount sales row per month → all BS/PL buckets are 0, exercising every
    // KPI zero-guard (equity, totalAssets, revenue, currentLiabilities all 0).
    const balances = [
      prow(2, 'sales', '4000', 0),
      prow(3, 'sales', '4000', 0),
      prow(4, 'sales', '4000', 0),
    ]
    vi.mocked(prisma.monthlyBalance.findMany).mockResolvedValue(balances as never)

    const result = await generatePeriodicReport({
      companyId: 'co-1',
      fiscalYearEndMonth: 3,
      periodType: '3months',
      includePreviousYear: false,
    })

    const first = result.periods[0]
    expect(first.kpis).toEqual({
      roe: 0,
      roa: 0,
      grossMargin: 0,
      operatingMargin: 0,
      currentRatio: 0,
      debtToEquity: 0,
    })

    const summary = result.summary
    expect(summary.revenueGrowth).toBeNull()
    expect(summary.profitGrowth).toBeNull()
    expect(summary.cashChange).toBe(0)
    // revenue flat (0>=0) and profit non-negative, but cash is 0 (not >0)
    expect(summary.trendAnalysis).toBe(
      '売上・利益は安定していますが、キャッシュフローに注意が必要です'
    )
  })

  it('still serves periods when balances are absent (sample fallback path runs)', async () => {
    vi.mocked(prisma.monthlyBalance.findMany).mockResolvedValue([] as never)

    const result = await generatePeriodicReport({
      companyId: 'co-1',
      fiscalYearEndMonth: 3,
      periodType: '3months',
      includePreviousYear: false,
    })

    // Sample fallback must still produce 3 finite periods and a summary
    expect(result.periods).toHaveLength(3)
    for (const period of result.periods) {
      expect(Number.isFinite(period.balanceSheet.totalAssets)).toBe(true)
      expect(Number.isFinite(period.profitLoss.netIncome)).toBe(true)
    }
    expect(result.summary.trendAnalysis.length).toBeGreaterThan(0)
  })
})
