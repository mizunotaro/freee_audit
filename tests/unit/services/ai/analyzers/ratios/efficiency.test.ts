import { describe, it, expect } from 'vitest'
import {
  EFFICIENCY_RATIOS,
  calculateEfficiencyRatios,
} from '@/services/ai/analyzers/ratios/efficiency'
import type { BalanceSheet, ProfitLoss } from '@/types'

describe('Efficiency Ratios', () => {
  const createMockBalanceSheet = (overrides: Partial<BalanceSheet> = {}): BalanceSheet => ({
    fiscalYear: 2024,
    month: 12,
    assets: {
      current: [
        { code: '1001', name: '現金預金', amount: 5000000 },
        { code: '1003', name: '売掛金', amount: 3000000 },
        { code: '1005', name: '棚卸資産', amount: 2000000 },
      ],
      fixed: [{ code: '2000', name: '建物', amount: 10000000 }],
      total: 20000000,
    },
    liabilities: {
      current: [
        { code: '2001', name: '買掛金', amount: 2000000 },
        { code: '3000', name: '未払金', amount: 1000000 },
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
    revenue: [{ code: 'R001', name: '売上高', amount: 40000000 }],
    costOfSales: [{ code: 'C001', name: '売上原価', amount: 24000000 }],
    grossProfit: 16000000,
    grossProfitMargin: 40,
    sgaExpenses: [{ code: 'E001', name: '販売費及び一般管理費', amount: 8000000 }],
    operatingIncome: 8000000,
    operatingMargin: 20,
    nonOperatingIncome: [],
    nonOperatingExpenses: [],
    ordinaryIncome: 8000000,
    extraordinaryIncome: [],
    extraordinaryLoss: [],
    incomeBeforeTax: 8000000,
    incomeTax: 1600000,
    netIncome: 6400000,
    depreciation: 500000,
    ...overrides,
  })

  describe('EFFICIENCY_RATIOS constant', () => {
    it('should have 6 ratio definitions', () => {
      expect(EFFICIENCY_RATIOS).toHaveLength(6)
    })

    it('should have correct ratio IDs', () => {
      const ids = EFFICIENCY_RATIOS.map((r) => r.id)
      expect(ids).toContain('asset_turnover')
      expect(ids).toContain('inventory_turnover')
      expect(ids).toContain('receivables_turnover')
      expect(ids).toContain('payables_turnover')
      expect(ids).toContain('days_inventory')
      expect(ids).toContain('days_sales_outstanding')
    })
  })

  describe('calculateEfficiencyRatios', () => {
    it('should calculate all efficiency ratios', () => {
      const result = calculateEfficiencyRatios(createMockBalanceSheet(), createMockProfitLoss())

      expect(result).toHaveLength(6)
    })

    it('should calculate asset turnover correctly', () => {
      const result = calculateEfficiencyRatios(createMockBalanceSheet(), createMockProfitLoss())

      const assetTurnover = result.find((r) => r.definition.id === 'asset_turnover')
      expect(assetTurnover).toBeDefined()
      expect(assetTurnover?.value).toBe(2)
    })

    it('should calculate inventory turnover correctly', () => {
      const result = calculateEfficiencyRatios(createMockBalanceSheet(), createMockProfitLoss())

      const invTurnover = result.find((r) => r.definition.id === 'inventory_turnover')
      expect(invTurnover).toBeDefined()
      expect(invTurnover?.value).toBe(12)
    })

    it('should calculate receivables turnover correctly', () => {
      const result = calculateEfficiencyRatios(createMockBalanceSheet(), createMockProfitLoss())

      const recTurnover = result.find((r) => r.definition.id === 'receivables_turnover')
      expect(recTurnover).toBeDefined()
      expect(recTurnover?.value).toBeCloseTo(13.33, 1)
    })

    it('should calculate payables turnover correctly', () => {
      const result = calculateEfficiencyRatios(createMockBalanceSheet(), createMockProfitLoss())

      const payTurnover = result.find((r) => r.definition.id === 'payables_turnover')
      expect(payTurnover).toBeDefined()
      expect(payTurnover?.value).toBe(8)
    })

    it('should calculate days inventory correctly', () => {
      const result = calculateEfficiencyRatios(createMockBalanceSheet(), createMockProfitLoss())

      const daysInv = result.find((r) => r.definition.id === 'days_inventory')
      expect(daysInv).toBeDefined()
      expect(daysInv?.value).toBeCloseTo(30.42, 0)
    })

    it('should calculate days sales outstanding correctly', () => {
      const result = calculateEfficiencyRatios(createMockBalanceSheet(), createMockProfitLoss())

      const dso = result.find((r) => r.definition.id === 'days_sales_outstanding')
      expect(dso).toBeDefined()
      expect(dso?.value).toBeGreaterThan(0)
    })

    it('should handle zero inventory', () => {
      const bs = createMockBalanceSheet({
        assets: {
          current: [
            { code: '1001', name: '現金預金', amount: 5000000 },
            { code: '1003', name: '売掛金', amount: 3000000 },
          ],
          fixed: [{ code: '2000', name: '建物', amount: 10000000 }],
          total: 18000000,
        },
      })

      const result = calculateEfficiencyRatios(bs, createMockProfitLoss())

      const invTurnover = result.find((r) => r.definition.id === 'inventory_turnover')
      expect(invTurnover?.value).toBe(0)
    })

    it('should handle zero receivables', () => {
      const bs = createMockBalanceSheet({
        assets: {
          current: [
            { code: '1001', name: '現金預金', amount: 8000000 },
            { code: '1005', name: '棚卸資産', amount: 2000000 },
          ],
          fixed: [{ code: '2000', name: '建物', amount: 10000000 }],
          total: 20000000,
        },
      })

      const result = calculateEfficiencyRatios(bs, createMockProfitLoss())

      const dso = result.find((r) => r.definition.id === 'days_sales_outstanding')
      expect(dso?.value).toBe(0)
    })

    it('should use average assets when previous data exists', () => {
      const prevBS = createMockBalanceSheet({
        fiscalYear: 2023,
        totalAssets: 18000000,
      })

      const result = calculateEfficiencyRatios(
        createMockBalanceSheet(),
        createMockProfitLoss(),
        prevBS
      )

      const assetTurnover = result.find((r) => r.definition.id === 'asset_turnover')
      expect(assetTurnover).toBeDefined()
    })

    it('should return excellent status for high asset turnover', () => {
      const result = calculateEfficiencyRatios(createMockBalanceSheet(), createMockProfitLoss())

      const assetTurnover = result.find((r) => r.definition.id === 'asset_turnover')
      expect(assetTurnover?.status).toBe('excellent')
    })

    it('should handle lower is better for days metrics', () => {
      const result = calculateEfficiencyRatios(createMockBalanceSheet(), createMockProfitLoss())

      const daysInv = result.find((r) => r.definition.id === 'days_inventory')
      expect(daysInv?.status).toBeOneOf(['excellent', 'good'])
    })

    it('should format values correctly', () => {
      const result = calculateEfficiencyRatios(createMockBalanceSheet(), createMockProfitLoss())

      const assetTurnover = result.find((r) => r.definition.id === 'asset_turnover')
      expect(assetTurnover?.formattedValue).toContain('回')

      const daysInv = result.find((r) => r.definition.id === 'days_inventory')
      expect(daysInv?.formattedValue).toContain('日')
    })
  })
})
