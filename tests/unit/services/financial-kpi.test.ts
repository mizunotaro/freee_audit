import { describe, it, expect } from 'vitest'
import { calculateFinancialKPIs } from '@/services/analytics/financial-kpi'
import type { BalanceSheet, ProfitLoss, CashFlowStatement } from '@/types'

describe('calculateFinancialKPIs', () => {
  const mockBalanceSheet: BalanceSheet = {
    fiscalYear: 2024,
    month: 12,
    assets: {
      current: [
        { code: '1000', name: '現金', amount: 5000000 },
        { code: '1100', name: '売掛金', amount: 3000000 },
        { code: '1200', name: '棚卸資産', amount: 2000000 },
      ],
      fixed: [
        { code: '2000', name: '建物', amount: 10000000 },
        { code: '2100', name: '減価償却累計額', amount: -2000000 },
      ],
      total: 18000000,
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
        { code: '5100', name: '利益剰余金', amount: 5000000 },
      ],
      total: 10000000,
    },
    totalAssets: 18000000,
    totalLiabilities: 8000000,
    totalEquity: 10000000,
  }

  const mockProfitLoss: ProfitLoss = {
    fiscalYear: 2024,
    month: 12,
    revenue: [{ code: 'R001', name: '売上高', amount: 20000000 }],
    costOfSales: [{ code: 'C001', name: '売上原価', amount: 12000000 }],
    grossProfit: [{ code: 'GP01', name: '売上総利益', amount: 8000000 }],
    grossProfitMargin: 40,
    operatingExpenses: [{ code: 'E001', name: '販売費及び一般管理費', amount: 4000000 }],
    operatingIncome: [{ code: 'OI01', name: '営業利益', amount: 4000000 }],
    operatingMargin: 20,
    nonOperatingIncome: [{ code: 'NO01', name: '営業外収益', amount: 200000 }],
    nonOperatingExpenses: [{ code: 'NE01', name: '営業外費用', amount: 300000 }],
    ordinaryIncome: [{ code: 'OR01', name: '経常利益', amount: 3900000 }],
    extraordinaryIncome: [],
    extraordinaryLoss: [],
    netIncome: 3900000,
    depreciation: 500000,
  }

  const mockCashFlow: CashFlowStatement = {
    fiscalYear: 2024,
    month: 12,
    operating: {
      items: [],
      netCashFromOperating: 4400000,
    },
    investing: {
      items: [],
      netCashFromInvesting: -1000000,
    },
    financing: {
      items: [],
      netCashFromFinancing: -500000,
    },
    netChange: 2900000,
    beginningCash: 2100000,
    endingCash: 5000000,
  }

  describe('profitability', () => {
    it('should calculate ROE correctly', () => {
      const result = calculateFinancialKPIs(mockBalanceSheet, mockProfitLoss, mockCashFlow)

      // ROE = Net Income / Equity * 100
      // 3,900,000 / 10,000,000 * 100 = 39%
      expect(result.profitability.roe).toBeCloseTo(39, 0)
    })

    it('should calculate ROA correctly', () => {
      const result = calculateFinancialKPIs(mockBalanceSheet, mockProfitLoss, mockCashFlow)

      // ROA = Net Income / Total Assets * 100
      // 3,900,000 / 18,000,000 * 100 = 21.67%
      expect(result.profitability.roa).toBeCloseTo(21.67, 1)
    })

    it('should preserve gross profit margin', () => {
      const result = calculateFinancialKPIs(mockBalanceSheet, mockProfitLoss, mockCashFlow)

      expect(result.profitability.grossProfitMargin).toBe(40)
    })

    it('should preserve operating margin', () => {
      const result = calculateFinancialKPIs(mockBalanceSheet, mockProfitLoss, mockCashFlow)

      expect(result.profitability.operatingMargin).toBe(20)
    })
  })

  describe('efficiency', () => {
    it('should calculate asset turnover correctly', () => {
      const result = calculateFinancialKPIs(mockBalanceSheet, mockProfitLoss, mockCashFlow)

      // Asset Turnover = Revenue / Total Assets
      // 20,000,000 / 18,000,000 = 1.11
      expect(result.efficiency.assetTurnover).toBeCloseTo(1.11, 2)
    })

    it('should calculate inventory turnover correctly', () => {
      const result = calculateFinancialKPIs(mockBalanceSheet, mockProfitLoss, mockCashFlow)

      // Inventory Turnover = Cost of Sales / Inventory
      // 12,000,000 / 2,000,000 = 6
      expect(result.efficiency.inventoryTurnover).toBe(6)
    })
  })

  describe('safety', () => {
    it('should calculate current ratio correctly', () => {
      const result = calculateFinancialKPIs(mockBalanceSheet, mockProfitLoss, mockCashFlow)

      // Current Ratio = Current Assets / Current Liabilities * 100
      // (5,000,000 + 3,000,000 + 2,000,000) / (2,000,000 + 1,000,000) * 100
      // 10,000,000 / 3,000,000 * 100 = 333.33%
      expect(result.safety.currentRatio).toBeCloseTo(333.33, 1)
    })

    it('should calculate debt to equity ratio correctly', () => {
      const result = calculateFinancialKPIs(mockBalanceSheet, mockProfitLoss, mockCashFlow)

      // Debt to Equity = Total Liabilities / Equity
      // 8,000,000 / 10,000,000 = 0.8
      expect(result.safety.debtToEquity).toBe(0.8)
    })
  })

  describe('growth', () => {
    it('should return zero growth when previous PL is not provided', () => {
      const result = calculateFinancialKPIs(mockBalanceSheet, mockProfitLoss, mockCashFlow)

      expect(result.growth.revenueGrowth).toBe(0)
      expect(result.growth.profitGrowth).toBe(0)
    })

    it('should calculate revenue growth correctly with previous PL', () => {
      const previousPL: ProfitLoss = {
        ...mockProfitLoss,
        fiscalYear: 2023,
        revenue: [{ code: 'R001', name: '売上高', amount: 16000000 }],
        netIncome: 3000000,
      }

      const result = calculateFinancialKPIs(
        mockBalanceSheet,
        mockProfitLoss,
        mockCashFlow,
        previousPL
      )

      // Revenue Growth = (Current - Previous) / Previous * 100
      // (20,000,000 - 16,000,000) / 16,000,000 * 100 = 25%
      expect(result.growth.revenueGrowth).toBe(25)
    })
  })

  describe('metadata', () => {
    it('should include fiscal year and month in result', () => {
      const result = calculateFinancialKPIs(mockBalanceSheet, mockProfitLoss, mockCashFlow)

      expect(result.fiscalYear).toBe(2024)
      expect(result.month).toBe(12)
    })
  })
})
