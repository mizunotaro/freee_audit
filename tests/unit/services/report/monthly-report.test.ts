import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  generateMonthlyReport,
  getMonthlyTrend,
  formatReportForExport,
  getMultiMonthReport,
} from '@/services/report/monthly-report'

const mockCompany = {
  id: 'company-1',
  name: 'テスト株式会社',
  freeeCompanyId: 'freee-1',
  fiscalYearStart: 4,
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
  })

  describe('generateMonthlyReport', () => {
    it('should generate monthly report successfully', async () => {
      const result = await generateMonthlyReport({
        companyId: 'company-1',
        fiscalYear: 2024,
        month: 12,
      })

      expect(result.fiscalYear).toBe(2024)
      expect(result.month).toBe(12)
      expect(result.companyName).toBe('テスト株式会社')
      expect(result.balanceSheet).toBeDefined()
      expect(result.profitLoss).toBeDefined()
      expect(result.cashFlow).toBeDefined()
    })

    it('should use sample data when no balances found', async () => {
      const result = await generateMonthlyReport({
        companyId: 'company-1',
        fiscalYear: 2024,
        month: 12,
      })

      expect(result.balanceSheet.totalAssets).toBeGreaterThan(0)
      expect(result.profitLoss.revenue.length).toBeGreaterThan(0)
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

      expect(result.fiscalYear).toBe(2024)
      expect(result.endMonth).toBe(12)
      expect(result.monthCount).toBe(3)
      expect(result.months).toHaveLength(3)
      expect(result.sections.length).toBeGreaterThan(0)
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

    it('should include BS, PL, CF, and KPI sections', async () => {
      const result = await getMultiMonthReport('company-1', 2024, 12, 3)

      const sectionTypes = result.sections.map((s) => s.type)
      expect(sectionTypes).toContain('bs')
      expect(sectionTypes).toContain('pl')
      expect(sectionTypes).toContain('cf')
      expect(sectionTypes).toContain('kpi')
    })
  })
})
