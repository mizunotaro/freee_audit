import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  generatePeriodicReport,
  formatPeriodicReportForExport,
} from '@/services/report/periodic-report'
import type { PeriodicReportData, PeriodData } from '@/services/report/periodic-report'

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: vi.fn(function (fn: Function) {
      return fn({
        monthlyBalance: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      })
    }),
  },
}))

describe('generatePeriodicReport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return report data with periods and summary', async function () {
    const result = await generatePeriodicReport({
      companyId: 'co-1',
      fiscalYearEndMonth: 3,
      periodType: '3months',
      includePreviousYear: false,
    })

    expect(result.periods).toBeDefined()
    expect(result.summary).toBeDefined()
    expect(Array.isArray(result.periods)).toBe(true)
  })

  it('should include previous year periods when requested', async function () {
    const result = await generatePeriodicReport({
      companyId: 'co-1',
      fiscalYearEndMonth: 3,
      periodType: '3months',
      includePreviousYear: true,
    })

    expect(result.periods.length).toBeGreaterThan(3)
  })
})

describe('formatPeriodicReportForExport', () => {
  it('should format report data as rows', function () {
    const periods: PeriodData[] = [
      {
        label: '2024年1月',
        fiscalYear: 2024,
        startMonth: 1,
        endMonth: 1,
        balanceSheet: {
          totalAssets: 1000000,
          currentAssets: 600000,
          fixedAssets: 400000,
          totalLiabilities: 400000,
          currentLiabilities: 200000,
          fixedLiabilities: 200000,
          equity: 600000,
        },
        profitLoss: {
          revenue: 500000,
          costOfSales: 200000,
          grossProfit: 300000,
          operatingIncome: 150000,
          ordinaryIncome: 140000,
          netIncome: 100000,
        },
        cashFlow: {
          operatingCF: 120000,
          investingCF: -50000,
          financingCF: 0,
          freeCashFlow: 70000,
        },
        kpis: {
          roe: 16.67,
          roa: 10.0,
          grossMargin: 60.0,
          operatingMargin: 30.0,
          currentRatio: 300.0,
          debtToEquity: 0.67,
        },
        endingCash: 300000,
      },
    ]

    const data: PeriodicReportData = {
      periods,
      summary: {
        revenueGrowth: null,
        profitGrowth: null,
        cashChange: 0,
        avgROE: 16.67,
        avgROA: 10.0,
        trendAnalysis: 'データが不足しています',
      },
    }

    const rows = formatPeriodicReportForExport(data)

    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0]).toContain('期間')
    expect(rows[0]).toContain('2024年1月')
  })

  it('should include BS, PL, CF, and KPI sections', function () {
    const data: PeriodicReportData = {
      periods: [],
      summary: {
        revenueGrowth: null,
        profitGrowth: null,
        cashChange: 0,
        avgROE: 0,
        avgROA: 0,
        trendAnalysis: '',
      },
    }

    const rows = formatPeriodicReportForExport(data)
    const allText = rows.flat().join(' ')

    expect(allText).toContain('貸借対照表')
    expect(allText).toContain('損益計算書')
    expect(allText).toContain('キャッシュフロー')
    expect(allText).toContain('経営指標')
  })
})
