import { describe, it, expect } from 'vitest'
import { SAFETY_RATIOS, calculateSafetyRatios } from '@/services/ai/analyzers/ratios/safety'
import type { BalanceSheet, ProfitLoss } from '@/types'

describe('Safety Ratios', () => {
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

  describe('SAFETY_RATIOS constant', () => {
    it('should have 6 ratio definitions', () => {
      expect(SAFETY_RATIOS).toHaveLength(6)
    })

    it('should have correct ratio IDs', () => {
      const ids = SAFETY_RATIOS.map((r) => r.id)
      expect(ids).toContain('equity_ratio')
      expect(ids).toContain('debt_to_equity')
      expect(ids).toContain('debt_ratio')
      expect(ids).toContain('fixed_ratio')
      expect(ids).toContain('fixed_long_term_ratio')
      expect(ids).toContain('interest_coverage')
    })
  })

  describe('calculateSafetyRatios', () => {
    it('should calculate all safety ratios', () => {
      const result = calculateSafetyRatios(createMockBalanceSheet(), createMockProfitLoss())

      expect(result).toHaveLength(6)
    })

    it('should calculate equity ratio correctly', () => {
      const result = calculateSafetyRatios(createMockBalanceSheet(), createMockProfitLoss())

      const equityRatio = result.find((r) => r.definition.id === 'equity_ratio')
      expect(equityRatio).toBeDefined()
      expect(equityRatio?.value).toBeCloseTo(66.67, 1)
    })

    it('should calculate debt to equity ratio correctly', () => {
      const result = calculateSafetyRatios(createMockBalanceSheet(), createMockProfitLoss())

      const deRatio = result.find((r) => r.definition.id === 'debt_to_equity')
      expect(deRatio).toBeDefined()
      expect(deRatio?.value).toBeCloseTo(0.5, 1)
    })

    it('should calculate debt ratio correctly', () => {
      const result = calculateSafetyRatios(createMockBalanceSheet(), createMockProfitLoss())

      const debtRatio = result.find((r) => r.definition.id === 'debt_ratio')
      expect(debtRatio).toBeDefined()
      expect(debtRatio?.value).toBeCloseTo(33.33, 1)
    })

    it('should calculate fixed ratio correctly', () => {
      const result = calculateSafetyRatios(createMockBalanceSheet(), createMockProfitLoss())

      const fixedRatio = result.find((r) => r.definition.id === 'fixed_ratio')
      expect(fixedRatio).toBeDefined()
      expect(fixedRatio?.value).toBeGreaterThan(0)
    })

    it('should calculate fixed long term ratio correctly', () => {
      const result = calculateSafetyRatios(createMockBalanceSheet(), createMockProfitLoss())

      const fltRatio = result.find((r) => r.definition.id === 'fixed_long_term_ratio')
      expect(fltRatio).toBeDefined()
      expect(fltRatio?.value).toBeGreaterThan(0)
    })

    it('should calculate interest coverage ratio correctly', () => {
      const result = calculateSafetyRatios(createMockBalanceSheet(), createMockProfitLoss())

      const icRatio = result.find((r) => r.definition.id === 'interest_coverage')
      expect(icRatio).toBeDefined()
      expect(icRatio?.value).toBe(20)
    })

    it('should include trend when previous data is provided', () => {
      const prevBS = createMockBalanceSheet({
        fiscalYear: 2023,
        totalEquity: 10000000,
        totalAssets: 16000000,
      })

      const result = calculateSafetyRatios(createMockBalanceSheet(), createMockProfitLoss(), prevBS)

      const equityRatio = result.find((r) => r.definition.id === 'equity_ratio')
      expect(equityRatio?.trend).toBeDefined()
    })

    it('should handle zero interest expense', () => {
      const pl = createMockProfitLoss({
        nonOperatingExpenses: [],
      })

      const result = calculateSafetyRatios(createMockBalanceSheet(), pl)

      const icRatio = result.find((r) => r.definition.id === 'interest_coverage')
      expect(icRatio?.value).toBe(0)
    })

    it('should return excellent status for high equity ratio', () => {
      const result = calculateSafetyRatios(createMockBalanceSheet(), createMockProfitLoss())

      const equityRatio = result.find((r) => r.definition.id === 'equity_ratio')
      expect(equityRatio?.status).toBe('excellent')
    })

    it('should handle lower is better for debt ratios', () => {
      const bs = createMockBalanceSheet({
        totalLiabilities: 1000000,
        totalEquity: 17000000,
      })

      const result = calculateSafetyRatios(bs, createMockProfitLoss())

      const deRatio = result.find((r) => r.definition.id === 'debt_to_equity')
      expect(deRatio?.status).toBe('excellent')
    })

    it('should handle negative equity', () => {
      const bs = createMockBalanceSheet({
        equity: { items: [], total: -1000000 },
        totalEquity: -1000000,
        totalLiabilities: 19000000,
      })

      const result = calculateSafetyRatios(bs, createMockProfitLoss())

      expect(result).toHaveLength(6)
    })
  })
})
