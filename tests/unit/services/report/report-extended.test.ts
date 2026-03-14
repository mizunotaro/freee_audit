import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  generateMonthlyReport,
  getMonthlyTrend,
  formatReportForExport,
  getMultiMonthReport,
} from '@/services/report/monthly-report'
import {
  generatePeriodicReport,
  formatPeriodicReportForExport,
} from '@/services/report/periodic-report'
import type { MonthlyReport } from '@/types'

const mockCompany = {
  id: 'company-1',
  name: 'Test Company',
  createdAt: new Date(),
  updatedAt: new Date(),
}

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: vi.fn((callback) =>
      callback({
        company: {
          findFirst: vi.fn().mockResolvedValue(mockCompany),
        },
        monthlyBalance: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      })
    ),
    company: {
      findFirst: vi.fn().mockResolvedValue(mockCompany),
    },
    monthlyBalance: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}))

vi.mock('@/services/cashflow/calculator', () => ({
  calculateCashFlow: vi.fn().mockReturnValue({
    fiscalYear: 2024,
    month: 12,
    operating: { items: [], netCashFromOperating: 2000000 },
    investing: { items: [], netCashFromInvesting: -500000 },
    financing: { items: [], netCashFromFinancing: 0 },
    netChangeInCash: 1500000,
    beginningCash: 3500000,
    endingCash: 5000000,
  }),
}))

vi.mock('@/services/cashflow/cash-position', () => ({
  generateCashPosition: vi.fn().mockReturnValue({
    currentCash: 2000000,
    projectedCash: [],
  }),
}))

vi.mock('@/services/cashflow/runway-calculator', () => ({
  calculateRunway: vi.fn().mockReturnValue({
    monthlyBurnRate: 500000,
    runwayMonths: 4,
    currentCash: 2000000,
    zeroCashDate: new Date(),
  }),
}))

vi.mock('@/services/analytics/financial-kpi', () => ({
  calculateFinancialKPIs: vi.fn().mockReturnValue({
    fiscalYear: 2024,
    month: 12,
    profitability: {
      roe: 15.5,
      roa: 8.2,
      ros: 12.3,
      grossProfitMargin: 60,
      operatingMargin: 25,
      ebitdaMargin: 20,
    },
    efficiency: {
      assetTurnover: 1.5,
      inventoryTurnover: 4.2,
      receivablesTurnover: 6.0,
      payablesTurnover: 5.0,
    },
    safety: {
      currentRatio: 180,
      quickRatio: 150,
      debtToEquity: 0.5,
      equityRatio: 45,
    },
    growth: {
      revenueGrowth: 10,
      profitGrowth: 15,
    },
    cashFlow: {
      fcf: 2500000,
      fcfMargin: 50,
    },
  }),
}))

vi.mock('@/services/budget/actual-vs-budget', () => ({
  calculateActualVsBudget: vi.fn().mockResolvedValue({
    fiscalYear: 2024,
    month: 12,
    variance: 100000,
    variancePercent: 5,
    items: [],
    totalVariance: 0,
    totals: {
      revenue: { budget: 0, actual: 0, variance: 0, rate: 0 },
      expenses: { budget: 0, actual: 0, variance: 0, rate: 0 },
      operatingIncome: { budget: 0, actual: 0, variance: 0, rate: 0 },
    },
  }),
}))

describe('Monthly Report Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generateMonthlyReport', () => {
    it('should generate monthly report with all sections', async () => {
      const result = await generateMonthlyReport({
        companyId: 'company-1',
        fiscalYear: 2024,
        month: 3,
      })

      expect(result.fiscalYear).toBe(2024)
      expect(result.month).toBe(3)
      expect(result.companyName).toBe('Test Company')
      expect(result.balanceSheet).toBeDefined()
      expect(result.profitLoss).toBeDefined()
      expect(result.cashFlow).toBeDefined()
      expect(result.cashPosition).toBeDefined()
      expect(result.kpis).toBeDefined()
      expect(result.budget).toBeDefined()
      expect(result.runway).toBeDefined()
    })

    it('should use sample data when no balances found', async () => {
      const result = await generateMonthlyReport({
        companyId: 'company-1',
        fiscalYear: 2024,
        month: 6,
      })

      expect(result.balanceSheet.totalAssets).toBeGreaterThan(0)
      expect(result.profitLoss.revenue.length).toBeGreaterThan(0)
    })

    it('should handle month boundaries correctly', async () => {
      const resultJan = await generateMonthlyReport({
        companyId: 'company-1',
        fiscalYear: 2024,
        month: 1,
      })

      expect(resultJan.month).toBe(1)
    })
  })

  describe('getMonthlyTrend', () => {
    it('should return trends for all 12 months', async () => {
      const trends = await getMonthlyTrend('company-1', 2024)

      expect(trends).toHaveLength(12)
      expect(trends[0].month).toBe('1月')
      expect(trends[11].month).toBe('12月')
    })

    it('should calculate trends correctly', async () => {
      const trends = await getMonthlyTrend('company-1', 2024)

      trends.forEach((trend) => {
        expect(trend).toHaveProperty('month')
        expect(trend).toHaveProperty('revenue')
        expect(trend).toHaveProperty('grossProfit')
        expect(trend).toHaveProperty('operatingIncome')
        expect(trend).toHaveProperty('netIncome')
        expect(trend).toHaveProperty('cash')
      })
    })
  })

  describe('formatReportForExport', () => {
    it('should format report as text', () => {
      const report: MonthlyReport = {
        fiscalYear: 2024,
        month: 3,
        companyName: 'Test Company',
        balanceSheet: {
          fiscalYear: 2024,
          month: 3,
          assets: {
            current: [{ code: '100', name: '現金', amount: 1000000 }],
            fixed: [],
            total: 1000000,
          },
          liabilities: {
            current: [],
            fixed: [],
            total: 0,
          },
          equity: {
            items: [],
            total: 1000000,
          },
          totalAssets: 1000000,
          totalLiabilities: 0,
          totalEquity: 1000000,
        },
        profitLoss: {
          fiscalYear: 2024,
          month: 3,
          revenue: [{ code: '400', name: '売上', amount: 5000000 }],
          costOfSales: [],
          grossProfit: 5000000,
          grossProfitMargin: 100,
          sgaExpenses: [],
          operatingIncome: 5000000,
          operatingMargin: 100,
          nonOperatingIncome: [],
          nonOperatingExpenses: [],
          ordinaryIncome: 5000000,
          extraordinaryIncome: [],
          extraordinaryLoss: [],
          incomeBeforeTax: 5000000,
          incomeTax: 1500000,
          netIncome: 3500000,
          depreciation: 0,
        },
        cashFlow: {
          fiscalYear: 2024,
          month: 3,
          operating: { items: [], netCashFromOperating: 3000000 },
          investing: { items: [], netCashFromInvesting: -500000 },
          financing: { items: [], netCashFromFinancing: 0 },
          netChangeInCash: 2500000,
          beginningCash: 1000000,
          endingCash: 3500000,
        },
        cashPosition: {
          fiscalYear: 2024,
          months: [],
          annualTotal: {
            operatingNet: 3000000,
            investingNet: -500000,
            financingNet: 0,
            netChange: 2500000,
          },
        },
        kpis: {
          fiscalYear: 2024,
          month: 3,
          profitability: {
            roe: 15.5,
            roa: 8.2,
            ros: 12.3,
            grossProfitMargin: 60,
            operatingMargin: 25,
            ebitdaMargin: 20,
          },
          efficiency: {
            assetTurnover: 1.5,
            inventoryTurnover: 4.2,
            receivablesTurnover: 6.0,
            payablesTurnover: 5.0,
          },
          safety: {
            currentRatio: 180,
            quickRatio: 150,
            debtToEquity: 0.5,
            equityRatio: 45,
          },
          growth: {
            revenueGrowth: 10,
            profitGrowth: 15,
          },
          cashFlow: {
            fcf: 2500000,
            fcfMargin: 50,
          },
        },
        budget: {
          fiscalYear: 2024,
          month: 3,
          items: [],
          totals: {
            revenue: { budget: 5000000, actual: 5100000, variance: 100000, rate: 102 },
            expenses: { budget: 3000000, actual: 2900000, variance: -100000, rate: 97 },
            operatingIncome: { budget: 2000000, actual: 2200000, variance: 200000, rate: 110 },
          },
        },
        runway: {
          monthlyBurnRate: 500000,
          runwayMonths: 2,
          zeroCashDate: new Date('2024-05-01'),
          currentCash: 1000000,
          scenarios: {
            optimistic: { burnRate: 400000, runwayMonths: 2.5 },
            realistic: { burnRate: 500000, runwayMonths: 2 },
            pessimistic: { burnRate: 600000, runwayMonths: 1.67 },
          },
        },
      }

      const formatted = formatReportForExport(report)

      expect(formatted).toContain('月次決算報告書')
      expect(formatted).toContain('Test Company')
      expect(formatted).toContain('2024年3月度')
      expect(formatted).toContain('【貸借対照表】')
      expect(formatted).toContain('【損益計算書】')
      expect(formatted).toContain('【経営指標】')
      expect(formatted).toContain('ROE: 15.5%')
      expect(formatted).toContain('【Runway】')
    })
  })

  describe('getMultiMonthReport', () => {
    it('should generate multi-month report', async () => {
      const result = await getMultiMonthReport('company-1', 2024, 6, 3)

      expect(result.fiscalYear).toBe(2024)
      expect(result.endMonth).toBe(6)
      expect(result.monthCount).toBe(3)
      expect(result.months).toHaveLength(3)
      expect(result.sections).toHaveLength(4)
    })

    it('should generate 6-month report', async () => {
      const result = await getMultiMonthReport('company-1', 2024, 12, 6)

      expect(result.monthCount).toBe(6)
      expect(result.months).toHaveLength(6)
    })

    it('should generate 12-month report', async () => {
      const result = await getMultiMonthReport('company-1', 2024, 12, 12)

      expect(result.monthCount).toBe(12)
      expect(result.months).toHaveLength(12)
    })

    it('should include all required sections', async () => {
      const result = await getMultiMonthReport('company-1', 2024, 6, 3)

      const sectionTypes = result.sections.map((s) => s.type)
      expect(sectionTypes).toContain('bs')
      expect(sectionTypes).toContain('pl')
      expect(sectionTypes).toContain('cf')
      expect(sectionTypes).toContain('kpi')
    })
  })
})

describe('Periodic Report Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generatePeriodicReport', () => {
    it('should generate 3-month periodic report', async () => {
      const result = await generatePeriodicReport({
        companyId: 'company-1',
        fiscalYearEndMonth: 12,
        periodType: '3months',
        includePreviousYear: false,
      })

      expect(result.periods.length).toBeGreaterThan(0)
      expect(result.summary).toBeDefined()
    })

    it('should generate 6-month periodic report', async () => {
      const result = await generatePeriodicReport({
        companyId: 'company-1',
        fiscalYearEndMonth: 12,
        periodType: '6months',
        includePreviousYear: false,
      })

      expect(result.periods.length).toBeGreaterThan(0)
    })

    it('should generate 12-month periodic report', async () => {
      const result = await generatePeriodicReport({
        companyId: 'company-1',
        fiscalYearEndMonth: 12,
        periodType: '12months',
        includePreviousYear: false,
      })

      expect(result.periods.length).toBeGreaterThan(0)
    })

    it('should include previous year data when requested', async () => {
      const result = await generatePeriodicReport({
        companyId: 'company-1',
        fiscalYearEndMonth: 12,
        periodType: '3months',
        includePreviousYear: true,
      })

      expect(result.periods.length).toBeGreaterThan(3)
    })

    it('should calculate summary metrics', async () => {
      const result = await generatePeriodicReport({
        companyId: 'company-1',
        fiscalYearEndMonth: 12,
        periodType: '3months',
        includePreviousYear: false,
      })

      expect(result.summary).toHaveProperty('revenueGrowth')
      expect(result.summary).toHaveProperty('profitGrowth')
      expect(result.summary).toHaveProperty('cashChange')
      expect(result.summary).toHaveProperty('avgROE')
      expect(result.summary).toHaveProperty('avgROA')
      expect(result.summary).toHaveProperty('trendAnalysis')
    })

    it('should include all required period data', async () => {
      const result = await generatePeriodicReport({
        companyId: 'company-1',
        fiscalYearEndMonth: 12,
        periodType: '3months',
        includePreviousYear: false,
      })

      result.periods.forEach((period) => {
        expect(period).toHaveProperty('label')
        expect(period).toHaveProperty('fiscalYear')
        expect(period).toHaveProperty('balanceSheet')
        expect(period).toHaveProperty('profitLoss')
        expect(period).toHaveProperty('cashFlow')
        expect(period).toHaveProperty('kpis')
        expect(period).toHaveProperty('endingCash')
      })
    })
  })

  describe('formatPeriodicReportForExport', () => {
    it('should format periodic report as CSV', () => {
      const data = {
        periods: [
          {
            label: '2024年1月',
            fiscalYear: 2024,
            startMonth: 1,
            endMonth: 1,
            balanceSheet: {
              totalAssets: 10000000,
              currentAssets: 5000000,
              fixedAssets: 5000000,
              totalLiabilities: 4000000,
              currentLiabilities: 2000000,
              fixedLiabilities: 2000000,
              equity: 6000000,
            },
            profitLoss: {
              revenue: 2000000,
              costOfSales: 800000,
              grossProfit: 1200000,
              operatingIncome: 500000,
              ordinaryIncome: 480000,
              netIncome: 300000,
            },
            cashFlow: {
              operatingCF: 400000,
              investingCF: -100000,
              financingCF: 0,
              freeCashFlow: 300000,
            },
            kpis: {
              roe: 5.0,
              roa: 3.0,
              grossMargin: 60,
              operatingMargin: 25,
              currentRatio: 250,
              debtToEquity: 0.67,
            },
            endingCash: 2000000,
          },
        ],
        summary: {
          revenueGrowth: 10,
          profitGrowth: 15,
          cashChange: 300000,
          avgROE: 5.0,
          avgROA: 3.0,
          trendAnalysis: '良好',
        },
      }

      const rows = formatPeriodicReportForExport(data as any)

      expect(rows.length).toBeGreaterThan(0)
      expect(rows[0]).toContain('期間')
      expect(rows[0]).toContain('2024年1月')
    })

    it('should include all required sections', () => {
      const data = {
        periods: [
          {
            label: '2024年1月',
            fiscalYear: 2024,
            startMonth: 1,
            endMonth: 1,
            balanceSheet: {
              totalAssets: 10000000,
              currentAssets: 5000000,
              fixedAssets: 5000000,
              totalLiabilities: 4000000,
              currentLiabilities: 2000000,
              fixedLiabilities: 2000000,
              equity: 6000000,
            },
            profitLoss: {
              revenue: 2000000,
              costOfSales: 800000,
              grossProfit: 1200000,
              operatingIncome: 500000,
              ordinaryIncome: 480000,
              netIncome: 300000,
            },
            cashFlow: {
              operatingCF: 400000,
              investingCF: -100000,
              financingCF: 0,
              freeCashFlow: 300000,
            },
            kpis: {
              roe: 5.0,
              roa: 3.0,
              grossMargin: 60,
              operatingMargin: 25,
              currentRatio: 250,
              debtToEquity: 0.67,
            },
            endingCash: 2000000,
          },
        ],
        summary: {
          revenueGrowth: 10,
          profitGrowth: 15,
          cashChange: 300000,
          avgROE: 5.0,
          avgROA: 3.0,
          trendAnalysis: '良好',
        },
      }

      const rows = formatPeriodicReportForExport(data as any)
      const flatRows = rows.flat()

      expect(flatRows.some((r) => r.includes('貸借対照表'))).toBe(true)
      expect(flatRows.some((r) => r.includes('損益計算書'))).toBe(true)
      expect(flatRows.some((r) => r.includes('キャッシュフロー'))).toBe(true)
      expect(flatRows.some((r) => r.includes('経営指標'))).toBe(true)
    })
  })
})
