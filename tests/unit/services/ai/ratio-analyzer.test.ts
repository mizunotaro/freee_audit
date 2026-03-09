import { describe, it, expect } from 'vitest'
import {
  RatioAnalyzer,
  analyzeRatios,
  createRatioAnalyzer,
} from '@/services/ai/analyzers/ratio-analyzer'
import type { BalanceSheet, ProfitLoss } from '@/types'

describe('RatioAnalyzer', () => {
  const mockBS: BalanceSheet = {
    fiscalYear: 2024,
    month: 12,
    assets: {
      current: [
        { code: '1001', name: '現金預金', amount: 10000000 },
        { code: '1002', name: '有価証券', amount: 5000000 },
        { code: '1003', name: '売掛金', amount: 8000000 },
        { code: '1005', name: '棚卸資産', amount: 3000000 },
      ],
      fixed: [
        { code: '1101', name: '建物', amount: 20000000 },
        { code: '1102', name: '機械装置', amount: 15000000 },
      ],
      total: 61000000,
    },
    liabilities: {
      current: [
        { code: '2001', name: '買掛金', amount: 6000000 },
        { code: '2002', name: '短期借入金', amount: 4000000 },
      ],
      fixed: [{ code: '2101', name: '長期借入金', amount: 10000000 }],
      total: 20000000,
    },
    equity: {
      items: [
        { code: '3001', name: '資本金', amount: 30000000 },
        { code: '3002', name: '利益剰余金', amount: 11000000 },
      ],
      total: 41000000,
    },
    totalAssets: 61000000,
    totalLiabilities: 20000000,
    totalEquity: 41000000,
  }

  const mockPL: ProfitLoss = {
    fiscalYear: 2024,
    month: 12,
    revenue: [{ code: '4001', name: '売上高', amount: 100000000 }],
    costOfSales: [{ code: '5001', name: '売上原価', amount: 60000000 }],
    grossProfit: 40000000,
    grossProfitMargin: 40,
    sgaExpenses: [
      { code: '5101', name: '給与手当', amount: 15000000 },
      { code: '5102', name: '広告宣伝費', amount: 5000000 },
    ],
    operatingIncome: 20000000,
    operatingMargin: 20,
    nonOperatingIncome: [{ code: '6001', name: '受取利息', amount: 200000 }],
    nonOperatingExpenses: [{ code: '6101', name: '支払利息', amount: 500000 }],
    ordinaryIncome: 19700000,
    extraordinaryIncome: [],
    extraordinaryLoss: [],
    incomeBeforeTax: 19700000,
    incomeTax: 5000000,
    netIncome: 14700000,
    depreciation: 2000000,
  }

  const mockPrevBS: BalanceSheet = {
    fiscalYear: 2023,
    month: 12,
    assets: {
      current: [
        { code: '1001', name: '現金預金', amount: 8000000 },
        { code: '1002', name: '有価証券', amount: 4000000 },
        { code: '1003', name: '売掛金', amount: 7000000 },
        { code: '1005', name: '棚卸資産', amount: 2500000 },
      ],
      fixed: [
        { code: '1101', name: '建物', amount: 20000000 },
        { code: '1102', name: '機械装置', amount: 15000000 },
      ],
      total: 56500000,
    },
    liabilities: {
      current: [
        { code: '2001', name: '買掛金', amount: 5500000 },
        { code: '2002', name: '短期借入金', amount: 5000000 },
      ],
      fixed: [{ code: '2101', name: '長期借入金', amount: 12000000 }],
      total: 22500000,
    },
    equity: {
      items: [
        { code: '3001', name: '資本金', amount: 30000000 },
        { code: '3002', name: '利益剰余金', amount: 4000000 },
      ],
      total: 34000000,
    },
    totalAssets: 56500000,
    totalLiabilities: 22500000,
    totalEquity: 34000000,
  }

  const mockPrevPL: ProfitLoss = {
    fiscalYear: 2023,
    month: 12,
    revenue: [{ code: '4001', name: '売上高', amount: 90000000 }],
    costOfSales: [{ code: '5001', name: '売上原価', amount: 55000000 }],
    grossProfit: 35000000,
    grossProfitMargin: 38.9,
    sgaExpenses: [
      { code: '5101', name: '給与手当', amount: 14000000 },
      { code: '5102', name: '広告宣伝費', amount: 4500000 },
    ],
    operatingIncome: 16500000,
    operatingMargin: 18.3,
    nonOperatingIncome: [{ code: '6001', name: '受取利息', amount: 150000 }],
    nonOperatingExpenses: [{ code: '6101', name: '支払利息', amount: 600000 }],
    ordinaryIncome: 16050000,
    extraordinaryIncome: [],
    extraordinaryLoss: [],
    incomeBeforeTax: 16050000,
    incomeTax: 4000000,
    netIncome: 12050000,
    depreciation: 1800000,
  }

  describe('analyze', () => {
    it('should analyze financial ratios successfully', () => {
      const analyzer = new RatioAnalyzer()
      const result = analyzer.analyze({ bs: mockBS, pl: mockPL })

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.groups).toHaveLength(5)
      expect(result.data?.allRatios.length).toBeGreaterThan(20)
    })

    it('should calculate liquidity ratios correctly', () => {
      const analyzer = new RatioAnalyzer()
      const result = analyzer.analyze({ bs: mockBS, pl: mockPL })

      expect(result.success).toBe(true)

      const liquidityGroup = result.data?.groups.find((g) => g.category === 'liquidity')
      expect(liquidityGroup).toBeDefined()
      expect(liquidityGroup?.ratios).toHaveLength(5)

      const currentRatio = liquidityGroup?.ratios.find((r) => r.definition.id === 'current_ratio')
      expect(currentRatio).toBeDefined()
      expect(currentRatio?.value).toBeGreaterThan(0)
      expect(currentRatio?.formattedValue).toMatch(/%$/)
    })

    it('should calculate safety ratios correctly', () => {
      const analyzer = new RatioAnalyzer()
      const result = analyzer.analyze({ bs: mockBS, pl: mockPL })

      expect(result.success).toBe(true)

      const safetyGroup = result.data?.groups.find((g) => g.category === 'safety')
      expect(safetyGroup).toBeDefined()
      expect(safetyGroup?.ratios).toHaveLength(6)

      const equityRatio = safetyGroup?.ratios.find((r) => r.definition.id === 'equity_ratio')
      expect(equityRatio).toBeDefined()
      expect(equityRatio?.value).toBeGreaterThan(0)
    })

    it('should calculate profitability ratios correctly', () => {
      const analyzer = new RatioAnalyzer()
      const result = analyzer.analyze({ bs: mockBS, pl: mockPL })

      expect(result.success).toBe(true)

      const profitabilityGroup = result.data?.groups.find((g) => g.category === 'profitability')
      expect(profitabilityGroup).toBeDefined()
      expect(profitabilityGroup?.ratios).toHaveLength(7)

      const roe = profitabilityGroup?.ratios.find((r) => r.definition.id === 'roe')
      expect(roe).toBeDefined()
      expect(roe?.value).toBeGreaterThan(0)

      const roa = profitabilityGroup?.ratios.find((r) => r.definition.id === 'roa')
      expect(roa).toBeDefined()
      expect(roa?.value).toBeGreaterThan(0)
    })

    it('should calculate efficiency ratios correctly', () => {
      const analyzer = new RatioAnalyzer()
      const result = analyzer.analyze({ bs: mockBS, pl: mockPL })

      expect(result.success).toBe(true)

      const efficiencyGroup = result.data?.groups.find((g) => g.category === 'efficiency')
      expect(efficiencyGroup).toBeDefined()
      expect(efficiencyGroup?.ratios).toHaveLength(6)

      const assetTurnover = efficiencyGroup?.ratios.find(
        (r) => r.definition.id === 'asset_turnover'
      )
      expect(assetTurnover).toBeDefined()
      expect(assetTurnover?.value).toBeGreaterThan(0)
    })

    it('should calculate growth ratios correctly', () => {
      const analyzer = new RatioAnalyzer()
      const result = analyzer.analyze({
        bs: mockBS,
        pl: mockPL,
        prevBS: mockPrevBS,
        prevPL: mockPrevPL,
      })

      expect(result.success).toBe(true)

      const growthGroup = result.data?.groups.find((g) => g.category === 'growth')
      expect(growthGroup).toBeDefined()
      expect(growthGroup?.ratios).toHaveLength(5)

      const revenueGrowth = growthGroup?.ratios.find((r) => r.definition.id === 'revenue_growth')
      expect(revenueGrowth).toBeDefined()
      expect(revenueGrowth?.value).toBeGreaterThan(0)
    })

    it('should include trend analysis when previous data is provided', () => {
      const analyzer = new RatioAnalyzer()
      const result = analyzer.analyze({ bs: mockBS, pl: mockPL, prevBS: mockPrevBS })

      expect(result.success).toBe(true)

      const liquidityGroup = result.data?.groups.find((g) => g.category === 'liquidity')
      const currentRatio = liquidityGroup?.ratios.find((r) => r.definition.id === 'current_ratio')

      expect(currentRatio?.trend).toBeDefined()
      expect(currentRatio?.trend?.previousValue).toBeDefined()
      expect(currentRatio?.trend?.direction).toMatch(/^(improving|stable|declining)$/)
    })

    it('should calculate summary statistics correctly', () => {
      const analyzer = new RatioAnalyzer()
      const result = analyzer.analyze({ bs: mockBS, pl: mockPL })

      expect(result.success).toBe(true)
      expect(result.data?.summary).toBeDefined()
      expect(result.data?.summary.totalRatios).toBeGreaterThan(20)
      expect(result.data?.summary.overallScore).toBeGreaterThanOrEqual(0)
      expect(result.data?.summary.overallScore).toBeLessThanOrEqual(100)
      expect(result.data?.summary.excellentCount).toBeGreaterThanOrEqual(0)
      expect(result.data?.summary.goodCount).toBeGreaterThanOrEqual(0)
      expect(result.data?.summary.fairCount).toBeGreaterThanOrEqual(0)
      expect(result.data?.summary.poorCount).toBeGreaterThanOrEqual(0)
      expect(result.data?.summary.criticalCount).toBeGreaterThanOrEqual(0)
    })

    it('should assign correct status based on thresholds', () => {
      const analyzer = new RatioAnalyzer()
      const result = analyzer.analyze({ bs: mockBS, pl: mockPL })

      expect(result.success).toBe(true)

      for (const ratio of result.data?.allRatios ?? []) {
        expect(ratio.status).toMatch(/^(excellent|good|fair|poor|critical)$/)
      }
    })

    it('should include calculatedAt timestamp', () => {
      const analyzer = new RatioAnalyzer()
      const result = analyzer.analyze({ bs: mockBS, pl: mockPL })

      expect(result.success).toBe(true)
      expect(result.data?.calculatedAt).toBeInstanceOf(Date)
    })

    it('should handle edge case with zero denominators', () => {
      const edgeCaseBS: BalanceSheet = {
        ...mockBS,
        liabilities: {
          current: [],
          fixed: [],
          total: 0,
        },
        totalLiabilities: 0,
      }

      const analyzer = new RatioAnalyzer()
      const result = analyzer.analyze({ bs: edgeCaseBS, pl: mockPL })

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
    })

    it('should handle missing previous data gracefully', () => {
      const analyzer = new RatioAnalyzer()
      const result = analyzer.analyze({ bs: mockBS, pl: mockPL })

      expect(result.success).toBe(true)

      const growthGroup = result.data?.groups.find((g) => g.category === 'growth')
      expect(growthGroup).toBeDefined()

      for (const ratio of growthGroup?.ratios ?? []) {
        expect(ratio.status).toBe('fair')
        expect(ratio.value).toBe(0)
      }
    })

    it('should calculate group average scores correctly', () => {
      const analyzer = new RatioAnalyzer()
      const result = analyzer.analyze({ bs: mockBS, pl: mockPL })

      expect(result.success).toBe(true)

      for (const group of result.data?.groups ?? []) {
        expect(group.averageScore).toBeGreaterThanOrEqual(0)
        expect(group.averageScore).toBeLessThanOrEqual(100)
        expect(group.overallStatus).toMatch(/^(excellent|good|fair|poor|critical)$/)
      }
    })

    // 新しいバリデーションテスト
    describe('input validation', () => {
      it('should return error when bs is null', () => {
        const analyzer = new RatioAnalyzer()
        const result = analyzer.analyze({ bs: null as unknown as BalanceSheet, pl: mockPL })

        expect(result.success).toBe(false)
        expect(result.error?.code).toBe('INVALID_INPUT')
        expect(result.error?.message).toBe('BalanceSheet is required')
      })

      it('should return error when pl is null', () => {
        const analyzer = new RatioAnalyzer()
        const result = analyzer.analyze({ bs: mockBS, pl: null as unknown as ProfitLoss })

        expect(result.success).toBe(false)
        expect(result.error?.code).toBe('INVALID_INPUT')
        expect(result.error?.message).toBe('ProfitLoss is required')
      })

      it('should return error when totalAssets is zero', () => {
        const invalidBS: BalanceSheet = {
          ...mockBS,
          totalAssets: 0,
        }

        const analyzer = new RatioAnalyzer()
        const result = analyzer.analyze({ bs: invalidBS, pl: mockPL })

        expect(result.success).toBe(false)
        expect(result.error?.code).toBe('INVALID_DATA')
        expect(result.error?.message).toBe('totalAssets must be positive')
      })

      it('should return error when totalAssets is negative', () => {
        const invalidBS: BalanceSheet = {
          ...mockBS,
          totalAssets: -1000,
        }

        const analyzer = new RatioAnalyzer()
        const result = analyzer.analyze({ bs: invalidBS, pl: mockPL })

        expect(result.success).toBe(false)
        expect(result.error?.code).toBe('INVALID_DATA')
        expect(result.error?.message).toBe('totalAssets must be positive')
      })

      it('should accept valid options object', () => {
        const analyzer = new RatioAnalyzer()
        const result = analyzer.analyze({
          bs: mockBS,
          pl: mockPL,
          prevBS: mockPrevBS,
          prevPL: mockPrevPL,
        })

        expect(result.success).toBe(true)
      })
    })
  })

  describe('createRatioAnalyzer', () => {
    it('should create a RatioAnalyzer instance', () => {
      const analyzer = createRatioAnalyzer()
      expect(analyzer).toBeInstanceOf(RatioAnalyzer)
    })
  })

  describe('analyzeRatios', () => {
    it('should be a convenience function that creates analyzer and analyzes', () => {
      const result = analyzeRatios({ bs: mockBS, pl: mockPL })

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
    })

    it('should accept options object parameter', () => {
      const result = analyzeRatios({
        bs: mockBS,
        pl: mockPL,
        prevBS: mockPrevBS,
        prevPL: mockPrevPL,
      })

      expect(result.success).toBe(true)
      expect(result.data?.summary.totalRatios).toBeGreaterThan(20)
    })
  })

  describe('Ratio Definitions', () => {
    it('should have all required properties for each ratio', () => {
      const analyzer = new RatioAnalyzer()
      const result = analyzer.analyze({ bs: mockBS, pl: mockPL })

      expect(result.success).toBe(true)

      for (const ratio of result.data?.allRatios ?? []) {
        expect(ratio.definition.id).toBeDefined()
        expect(ratio.definition.name).toBeDefined()
        expect(ratio.definition.nameEn).toBeDefined()
        expect(ratio.definition.category).toBeDefined()
        expect(ratio.definition.formula).toBeDefined()
        expect(ratio.definition.description).toBeDefined()
        expect(ratio.definition.unit).toBeDefined()
        expect(ratio.definition.thresholds).toBeDefined()
        expect(ratio.definition.higherIsBetter).toBeDefined()
      }
    })

    it('should have valid threshold values', () => {
      const analyzer = new RatioAnalyzer()
      const result = analyzer.analyze({ bs: mockBS, pl: mockPL })

      expect(result.success).toBe(true)

      for (const ratio of result.data?.allRatios ?? []) {
        const { thresholds } = ratio.definition
        expect(typeof thresholds.excellent).toBe('number')
        expect(typeof thresholds.good).toBe('number')
        expect(typeof thresholds.fair).toBe('number')
        expect(typeof thresholds.poor).toBe('number')
      }
    })
  })
})
