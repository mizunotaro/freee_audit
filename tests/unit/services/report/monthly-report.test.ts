import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  generateMonthlyReport,
  getMonthlyTrend,
  formatReportForExport,
  getMultiMonthReport,
} from '@/services/report/monthly-report'
import { clearBalanceCache } from '@/services/report/balance-loader'
import { prisma } from '@/lib/db'

const { mockCompany } = vi.hoisted(() => {
  const mockCompany = {
    id: 'company-1',
    name: 'テスト株式会社',
    freeeCompanyId: 'freee-1',
    fiscalYearStart: 4,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  return { mockCompany }
})

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
    budget: {
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
    currentCash: 5000000,
    projectedCash: [],
    burnRate: 500000,
    runwayMonths: 10,
  }),
}))

vi.mock('@/services/cashflow/runway-calculator', () => ({
  calculateRunway: vi.fn().mockReturnValue({
    monthlyBurnRate: 500000,
    runwayMonths: 10,
    zeroCashDate: new Date(),
  }),
}))

vi.mock('@/services/analytics/financial-kpi', () => ({
  calculateFinancialKPIs: vi.fn().mockReturnValue({
    fiscalYear: 2024,
    month: 12,
    profitability: {
      roe: 10,
      roa: 5,
      grossProfitMargin: 40,
      operatingMargin: 20,
      ros: 10,
      ebitdaMargin: 25,
    },
    efficiency: {
      assetTurnover: 0.8,
      inventoryTurnover: 5,
      receivablesTurnover: 10,
      payablesTurnover: 8,
    },
    safety: { currentRatio: 150, quickRatio: 120, debtToEquity: 0.5, equityRatio: 50 },
    growth: { revenueGrowth: 10, profitGrowth: 15 },
    cashFlow: { fcf: 1500000, fcfMargin: 15 },
  }),
}))

vi.mock('@/services/budget/actual-vs-budget', () => ({
  calculateActualVsBudget: vi.fn().mockResolvedValue({
    fiscalYear: 2024,
    month: 12,
    items: [],
    totalVariance: 0,
  }),
}))

describe('monthly-report', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearBalanceCache()
  })

  describe('generateMonthlyReport', () => {
    it('should generate monthly report successfully', async () => {
      const result = await generateMonthlyReport({
        companyId: 'company-1',
        fiscalYear: 2024,
        month: 12,
      })
      expect(result.success).toBe(true)
      if (!result.success) return

      expect(result.data.fiscalYear).toBe(2024)
      expect(result.data.month).toBe(12)
      expect(result.data.companyName).toBe('テスト株式会社')
      expect(result.data.balanceSheet).toBeDefined()
      expect(result.data.profitLoss).toBeDefined()
      expect(result.data.cashFlow).toBeDefined()
    })

    it('should use sample data when no balances found', async () => {
      const result = await generateMonthlyReport({
        companyId: 'company-1',
        fiscalYear: 2024,
        month: 12,
      })
      expect(result.success).toBe(true)
      if (!result.success) return

      expect(result.data.balanceSheet.totalAssets).toBeGreaterThan(0)
      expect(result.data.profitLoss.revenue.length).toBeGreaterThan(0)
    })

    it('should return failure when company is not found', async () => {
      vi.mocked(prisma.company.findFirst).mockResolvedValueOnce(null)

      const result = await generateMonthlyReport({
        companyId: 'missing',
        fiscalYear: 2024,
        month: 12,
      })

      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error.code).toBe('NOT_FOUND')
      expect(result.error.message).toBe('Company not found')
    })
  })

  describe('getMonthlyTrend', () => {
    it('should return monthly trends for fiscal year', async () => {
      const trends = await getMonthlyTrend('company-1', 2024)

      expect(trends.length).toBe(12)
      trends.forEach((trend) => {
        expect(trend).toHaveProperty('month')
        expect(trend).toHaveProperty('revenue')
        expect(trend).toHaveProperty('grossProfit')
        expect(trend).toHaveProperty('operatingIncome')
        expect(trend).toHaveProperty('netIncome')
        expect(trend).toHaveProperty('cash')
      })
    })

    it('should calculate trends for each month', async () => {
      const trends = await getMonthlyTrend('company-1', 2024)

      expect(trends[0].month).toBe('1月')
      expect(trends[11].month).toBe('12月')
    })
  })

  describe('formatReportForExport', () => {
    it('should format report as text', () => {
      const report = {
        fiscalYear: 2024,
        month: 12,
        companyName: 'テスト株式会社',
        balanceSheet: {
          fiscalYear: 2024,
          month: 12,
          assets: {
            current: [{ code: '1000', name: '現金', amount: 5000000 }],
            fixed: [],
            total: 5000000,
          },
          liabilities: {
            current: [],
            fixed: [],
            total: 0,
          },
          equity: {
            items: [{ code: '5000', name: '資本金', amount: 5000000 }],
            total: 5000000,
          },
          totalAssets: 5000000,
          totalLiabilities: 0,
          totalEquity: 5000000,
        },
        profitLoss: {
          fiscalYear: 2024,
          month: 12,
          revenue: [{ code: 'R001', name: '売上高', amount: 10000000 }],
          costOfSales: [],
          grossProfit: 10000000,
          grossProfitMargin: 100,
          sgaExpenses: [],
          operatingIncome: 10000000,
          operatingMargin: 100,
          nonOperatingIncome: [],
          nonOperatingExpenses: [],
          ordinaryIncome: 10000000,
          extraordinaryIncome: [],
          extraordinaryLoss: [],
          incomeBeforeTax: 10000000,
          incomeTax: 3000000,
          netIncome: 7000000,
          depreciation: 0,
        },
        cashFlow: {
          fiscalYear: 2024,
          month: 12,
          operating: { items: [], netCashFromOperating: 2000000 },
          investing: { items: [], netCashFromInvesting: 0 },
          financing: { items: [], netCashFromFinancing: 0 },
          netChangeInCash: 2000000,
          beginningCash: 3000000,
          endingCash: 5000000,
        },
        cashPosition: {
          fiscalYear: 2024,
          months: [],
          annualTotal: {
            operatingNet: 2000000,
            investingNet: -500000,
            financingNet: 0,
            netChange: 1500000,
          },
        },
        kpis: {
          fiscalYear: 2024,
          month: 12,
          profitability: {
            roe: 10,
            roa: 5,
            grossProfitMargin: 40,
            operatingMargin: 20,
            ros: 10,
            ebitdaMargin: 25,
          },
          efficiency: {
            assetTurnover: 0.8,
            inventoryTurnover: 5,
            receivablesTurnover: 10,
            payablesTurnover: 8,
          },
          safety: { currentRatio: 150, quickRatio: 120, debtToEquity: 0.5, equityRatio: 50 },
          growth: { revenueGrowth: 10, profitGrowth: 15 },
          cashFlow: { fcf: 1500000, fcfMargin: 15 },
        },
        budget: {
          fiscalYear: 2024,
          month: 12,
          items: [],
          totals: {
            revenue: { budget: 0, actual: 0, variance: 0, rate: 0 },
            expenses: { budget: 0, actual: 0, variance: 0, rate: 0 },
            operatingIncome: { budget: 0, actual: 0, variance: 0, rate: 0 },
          },
        },
        runway: {
          currentCash: 5000000,
          monthlyBurnRate: 500000,
          runwayMonths: 10,
          zeroCashDate: new Date(),
          scenarios: {
            optimistic: { burnRate: 400000, runwayMonths: 12 },
            realistic: { burnRate: 500000, runwayMonths: 10 },
            pessimistic: { burnRate: 600000, runwayMonths: 8 },
          },
        },
      }

      const formatted = formatReportForExport(report)

      expect(formatted).toContain('月次決算報告書')
      expect(formatted).toContain('テスト株式会社')
      expect(formatted).toContain('貸借対照表')
      expect(formatted).toContain('損益計算書')
      expect(formatted).toContain('経営指標')
    })
  })

  describe('getMultiMonthReport', () => {
    it('should generate multi-month report', async () => {
      const result = await getMultiMonthReport('company-1', 2024, 12, 3)
      expect(result.success).toBe(true)
      if (!result.success) return

      expect(result.data.fiscalYear).toBe(2024)
      expect(result.data.endMonth).toBe(12)
      expect(result.data.monthCount).toBe(3)
      expect(result.data.months).toHaveLength(3)
      expect(result.data.sections.length).toBeGreaterThan(0)
    })

    it('should generate 6-month report', async () => {
      const result = await getMultiMonthReport('company-1', 2024, 12, 6)
      expect(result.success).toBe(true)
      if (!result.success) return

      expect(result.data.monthCount).toBe(6)
      expect(result.data.months).toHaveLength(6)
    })

    it('should generate 12-month report', async () => {
      const result = await getMultiMonthReport('company-1', 2024, 12, 12)
      expect(result.success).toBe(true)
      if (!result.success) return

      expect(result.data.monthCount).toBe(12)
      expect(result.data.months).toHaveLength(12)
    })

    it('should include BS, PL, CF, and KPI sections', async () => {
      const result = await getMultiMonthReport('company-1', 2024, 12, 3)
      expect(result.success).toBe(true)
      if (!result.success) return

      const sectionTypes = result.data.sections.map((s) => s.type)
      expect(sectionTypes).toContain('bs')
      expect(sectionTypes).toContain('pl')
      expect(sectionTypes).toContain('cf')
      expect(sectionTypes).toContain('kpi')
    })
  })

  describe('query efficiency', () => {
    it('should fetch a fiscal year in a single query (no per-month N+1)', async () => {
      const findMany = vi.mocked(prisma.monthlyBalance.findMany)
      findMany.mockClear()

      await getMonthlyTrend('company-1', 2024)

      expect(findMany).toHaveBeenCalledTimes(1)
    })

    it('should serve repeat reads of the same fiscal year from cache', async () => {
      const findMany = vi.mocked(prisma.monthlyBalance.findMany)
      findMany.mockClear()

      await getMonthlyTrend('company-1', 2024)
      await getMonthlyTrend('company-1', 2024)

      expect(findMany).toHaveBeenCalledTimes(1)
    })
  })
})
