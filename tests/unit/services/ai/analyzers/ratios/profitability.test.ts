import { describe, it, expect } from 'vitest'
import {
  PROFITABILITY_RATIOS,
  calculateProfitabilityRatios,
} from '@/services/ai/analyzers/ratios/profitability'
import type { BalanceSheet, ProfitLoss } from '@/types'

describe('Profitability Ratios', () => {
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
      current: [
        { code: '3000', name: '買掛金', amount: 2000000 },
        { code: '3001', name: '短期借入金', amount: 1000000 },
      ],
      fixed: [
        { code: '4000', name: '長期借入金', amount: 3000000 },
        { code: '4001', name: '社債', amount: 1000000 },
      ],
      total: 7000000,
    },
    equity: {
      items: [
        { code: '5000', name: '資本金', amount: 5000000 },
        { code: '5100', name: '利益剰余金', amount: 6000000 },
      ],
      total: 11000000,
    },
    totalAssets: 18000000,
    totalLiabilities: 7000000,
    totalEquity: 11000000,
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
    nonOperatingExpenses: [{ code: 'N001', name: '支払利息', amount: 200000 }],
    ordinaryIncome: 3800000,
    extraordinaryIncome: [],
    extraordinaryLoss: [],
    incomeBeforeTax: 3800000,
    incomeTax: 760000,
    netIncome: 3040000,
    depreciation: 500000,
    ...overrides,
  })

  describe('PROFITABILITY_RATIOS constant', () => {
    it('should have 7 ratio definitions', () => {
      expect(PROFITABILITY_RATIOS).toHaveLength(7)
    })

    it('should have correct ratio IDs', () => {
      const ids = PROFITABILITY_RATIOS.map((r) => r.id)
      expect(ids).toContain('gross_margin')
      expect(ids).toContain('operating_margin')
      expect(ids).toContain('ordinary_margin')
      expect(ids).toContain('net_margin')
      expect(ids).toContain('roa')
      expect(ids).toContain('roe')
      expect(ids).toContain('roi')
    })
  })

  describe('calculateProfitabilityRatios', () => {
    it('should calculate all profitability ratios', () => {
      const result = calculateProfitabilityRatios(createMockBalanceSheet(), createMockProfitLoss())

      expect(result).toHaveLength(7)
    })

    it('should calculate gross margin correctly', () => {
      const result = calculateProfitabilityRatios(createMockBalanceSheet(), createMockProfitLoss())

      const grossMargin = result.find((r) => r.definition.id === 'gross_margin')
      expect(grossMargin).toBeDefined()
      expect(grossMargin?.value).toBe(40)
    })

    it('should calculate operating margin correctly', () => {
      const result = calculateProfitabilityRatios(createMockBalanceSheet(), createMockProfitLoss())

      const opMargin = result.find((r) => r.definition.id === 'operating_margin')
      expect(opMargin).toBeDefined()
      expect(opMargin?.value).toBe(20)
    })

    it('should calculate ordinary margin correctly', () => {
      const result = calculateProfitabilityRatios(createMockBalanceSheet(), createMockProfitLoss())

      const ordMargin = result.find((r) => r.definition.id === 'ordinary_margin')
      expect(ordMargin).toBeDefined()
      expect(ordMargin?.value).toBe(19)
    })

    it('should calculate net margin correctly', () => {
      const result = calculateProfitabilityRatios(createMockBalanceSheet(), createMockProfitLoss())

      const netMargin = result.find((r) => r.definition.id === 'net_margin')
      expect(netMargin).toBeDefined()
      expect(netMargin?.value).toBeCloseTo(15.2, 1)
    })

    it('should calculate ROA correctly', () => {
      const result = calculateProfitabilityRatios(createMockBalanceSheet(), createMockProfitLoss())

      const roa = result.find((r) => r.definition.id === 'roa')
      expect(roa).toBeDefined()
      expect(roa?.value).toBeGreaterThan(0)
    })

    it('should calculate ROE correctly', () => {
      const result = calculateProfitabilityRatios(createMockBalanceSheet(), createMockProfitLoss())

      const roe = result.find((r) => r.definition.id === 'roe')
      expect(roe).toBeDefined()
      expect(roe?.value).toBeGreaterThan(0)
    })

    it('should calculate ROI correctly', () => {
      const result = calculateProfitabilityRatios(createMockBalanceSheet(), createMockProfitLoss())

      const roi = result.find((r) => r.definition.id === 'roi')
      expect(roi).toBeDefined()
      expect(roi?.value).toBeGreaterThan(0)
    })

    it('should include trend when previous data is provided', () => {
      const prevPL = createMockProfitLoss({
        fiscalYear: 2023,
        netIncome: 2000000,
        revenue: [{ code: 'R001', name: '売上高', amount: 18000000 }],
      })

      const result = calculateProfitabilityRatios(
        createMockBalanceSheet(),
        createMockProfitLoss(),
        undefined,
        prevPL
      )

      const netMargin = result.find((r) => r.definition.id === 'net_margin')
      expect(netMargin?.trend).toBeDefined()
    })

    it('should handle zero revenue', () => {
      const pl = createMockProfitLoss({
        revenue: [],
        grossProfit: 0,
        operatingIncome: 0,
        netIncome: 0,
        ordinaryIncome: 0,
      })

      const result = calculateProfitabilityRatios(createMockBalanceSheet(), pl)

      expect(result).toHaveLength(7)
    })

    it('should return excellent status for high margins', () => {
      const result = calculateProfitabilityRatios(createMockBalanceSheet(), createMockProfitLoss())

      const grossMargin = result.find((r) => r.definition.id === 'gross_margin')
      expect(grossMargin?.status).toBe('excellent')
    })

    it('should use average assets for ROA when previous data exists', () => {
      const prevBS = createMockBalanceSheet({
        fiscalYear: 2023,
        totalAssets: 16000000,
      })

      const result = calculateProfitabilityRatios(
        createMockBalanceSheet(),
        createMockProfitLoss(),
        prevBS
      )

      const roa = result.find((r) => r.definition.id === 'roa')
      expect(roa).toBeDefined()
    })

    it('should handle interest bearing debt filtering', () => {
      const bs = createMockBalanceSheet({
        liabilities: {
          current: [
            { code: '3000', name: '買掛金', amount: 1000000 },
            { code: '3001', name: '短期借入金', amount: 2000000 },
            { code: '3002', name: 'リース債務', amount: 500000 },
          ],
          fixed: [
            { code: '4000', name: '長期借入金', amount: 3000000 },
            { code: '4001', name: '社債', amount: 1000000 },
          ],
          total: 7500000,
        },
      })

      const result = calculateProfitabilityRatios(bs, createMockProfitLoss())

      const roi = result.find((r) => r.definition.id === 'roi')
      expect(roi).toBeDefined()
    })
  })
})
