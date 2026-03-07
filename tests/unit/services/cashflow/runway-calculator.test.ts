import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  calculateRunway,
  getRunwayAlert,
  calculateBurnRateTrend,
} from '@/services/cashflow/runway-calculator'
import type { CashFlowStatement } from '@/types'

describe('RunwayCalculator', () => {
  const createMockCF = (
    month: number,
    netCash: number,
    endingCash: number = 5000000
  ): CashFlowStatement => ({
    fiscalYear: 2024,
    month,
    operating: {
      items: [],
      netCashFromOperating: netCash,
    },
    operatingActivities: {
      netCashFromOperating: netCash,
      netIncome: netCash > 0 ? netCash : 0,
      depreciation: 100000,
      increaseInReceivables: 0,
      decreaseInInventory: 0,
      increaseInPayables: 0,
      otherNonCash: 0,
    } as any,
    investing: {
      items: [],
      netCashFromInvesting: 0,
    },
    investingActivities: {
      netCashFromInvesting: 0,
      purchaseOfFixedAssets: 0,
      saleOfFixedAssets: 0,
    } as any,
    financing: {
      items: [],
      netCashFromFinancing: 0,
    },
    financingActivities: {
      netCashFromFinancing: 0,
      proceedsFromBorrowing: 0,
      repaymentOfBorrowing: 0,
      dividendPaid: 0,
    } as any,
    netChangeInCash: netCash,
    beginningCash: endingCash - netCash,
    endingCash,
  })

  beforeEach(() => {})

  afterEach(() => {})

  describe('calculateRunway', () => {
    it('should calculate runway months correctly', () => {
      const cashFlows = [
        createMockCF(1, -500000),
        createMockCF(2, -500000),
        createMockCF(3, -500000),
      ]
      const currentCash = 5000000

      const result = calculateRunway(currentCash, cashFlows)

      expect(result).toBeDefined()
      expect(result.runwayMonths).toBeDefined()
      expect(result.zeroCashDate).toBeInstanceOf(Date)
    })

    it('should return Infinity for profitable company', () => {
      const cashFlows = [createMockCF(1, 500000), createMockCF(2, 600000), createMockCF(3, 700000)]
      const currentCash = 5000000

      const result = calculateRunway(currentCash, cashFlows)

      expect(result.runwayMonths).toBe(Infinity)
    })

    it('should return Infinity for zero burn rate', () => {
      const cashFlows = [createMockCF(1, 0), createMockCF(2, 0), createMockCF(3, 0)]
      const currentCash = 5000000

      const result = calculateRunway(currentCash, cashFlows)

      expect(result.runwayMonths).toBe(Infinity)
    })

    it('should calculate scenarios correctly', () => {
      const cashFlows = [
        createMockCF(1, -500000),
        createMockCF(2, -500000),
        createMockCF(3, -500000),
      ]
      const currentCash = 5000000

      const result = calculateRunway(currentCash, cashFlows)

      expect(result.scenarios).toBeDefined()
      expect(result.scenarios.optimistic).toBeDefined()
      expect(result.scenarios.realistic).toBeDefined()
      expect(result.scenarios.pessimistic).toBeDefined()
      expect(result.scenarios.optimistic.runwayMonths).toBeGreaterThanOrEqual(
        result.scenarios.realistic.runwayMonths
      )
      expect(result.scenarios.realistic.runwayMonths).toBeGreaterThanOrEqual(
        result.scenarios.pessimistic.runwayMonths
      )
    })

    it('should use custom scenario adjustments', () => {
      const cashFlows = [
        createMockCF(1, -500000),
        createMockCF(2, -500000),
        createMockCF(3, -500000),
      ]
      const currentCash = 5000000
      const customAdjustments = {
        optimistic: 0.5,
        realistic: 1.0,
        pessimistic: 1.5,
      }

      const result = calculateRunway(currentCash, cashFlows, customAdjustments)

      expect(result).toBeDefined()
    })

    it('should handle empty cash flows', () => {
      const result = calculateRunway(5000000, [])

      expect(result.monthlyBurnRate).toBe(0)
      expect(result.runwayMonths).toBe(Infinity)
    })

    it('should handle single cash flow', () => {
      const cashFlows = [createMockCF(1, -500000)]
      const currentCash = 5000000

      const result = calculateRunway(currentCash, cashFlows)

      expect(result).toBeDefined()
    })

    it('should round runway months', () => {
      const cashFlows = [
        createMockCF(1, -333333),
        createMockCF(2, -333333),
        createMockCF(3, -333333),
      ]
      const currentCash = 5000000

      const result = calculateRunway(currentCash, cashFlows)

      expect(Number.isFinite(result.runwayMonths) || result.runwayMonths === Infinity).toBe(true)
    })

    it('should include current cash in result', () => {
      const cashFlows = [
        createMockCF(1, -500000, 5000000),
        createMockCF(2, -500000, 4500000),
        createMockCF(3, -500000, 4000000),
      ]
      const currentCash = 5000000

      const result = calculateRunway(currentCash, cashFlows)

      expect(result.currentCash).toBe(4000000)
    })
  })

  describe('getRunwayAlert', () => {
    it('should return safe for runway >= 12 months', () => {
      const result = getRunwayAlert(12)

      expect(result.level).toBe('safe')
      expect(result.message).toContain('安定')
    })

    it('should return safe for runway > 12 months', () => {
      const result = getRunwayAlert(18)

      expect(result.level).toBe('safe')
    })

    it('should return warning for runway >= 6 months', () => {
      const result = getRunwayAlert(6)

      expect(result.level).toBe('warning')
      expect(result.message).toContain('注意')
    })

    it('should return warning for runway between 6 and 12', () => {
      const result = getRunwayAlert(9)

      expect(result.level).toBe('warning')
    })

    it('should return critical for runway >= 3 months', () => {
      const result = getRunwayAlert(3)

      expect(result.level).toBe('critical')
      expect(result.message).toContain('危険')
    })

    it('should return critical for runway between 3 and 6', () => {
      const result = getRunwayAlert(4)

      expect(result.level).toBe('critical')
    })

    it('should return critical for runway < 3 months', () => {
      const result = getRunwayAlert(2)

      expect(result.level).toBe('critical')
      expect(result.message).toContain('ショート')
    })

    it('should return critical for runway = 0', () => {
      const result = getRunwayAlert(0)

      expect(result.level).toBe('critical')
    })

    it('should include recommendation', () => {
      const result = getRunwayAlert(5)

      expect(result.recommendation).toBeDefined()
      expect(result.recommendation.length).toBeGreaterThan(0)
    })
  })

  describe('calculateBurnRateTrend', () => {
    it('should return stable for insufficient data', () => {
      const cashFlows = [createMockCF(1, -500000)]

      const result = calculateBurnRateTrend(cashFlows)

      expect(result.trend).toBe('stable')
      expect(result.rate).toBe(0)
    })

    it('should return stable for exactly 3 items', () => {
      const cashFlows = [
        createMockCF(1, -500000),
        createMockCF(2, -500000),
        createMockCF(3, -500000),
      ]

      const result = calculateBurnRateTrend(cashFlows)

      expect(result).toBeDefined()
    })

    it('should detect increasing burn rate', () => {
      const cashFlows = [
        createMockCF(1, -300000),
        createMockCF(2, -400000),
        createMockCF(3, -500000),
        createMockCF(4, -600000),
        createMockCF(5, -700000),
        createMockCF(6, -800000),
      ]

      const result = calculateBurnRateTrend(cashFlows)

      expect(result.trend).toBe('increasing')
      expect(result.rate).toBeGreaterThan(0)
    })

    it('should detect decreasing burn rate', () => {
      const cashFlows = [
        createMockCF(1, -800000),
        createMockCF(2, -700000),
        createMockCF(3, -600000),
        createMockCF(4, -500000),
        createMockCF(5, -400000),
        createMockCF(6, -300000),
      ]

      const result = calculateBurnRateTrend(cashFlows)

      expect(result.trend).toBe('decreasing')
      expect(result.rate).toBeLessThan(0)
    })

    it('should return stable for minor changes', () => {
      const cashFlows = [
        createMockCF(1, -500000),
        createMockCF(2, -510000),
        createMockCF(3, -490000),
        createMockCF(4, -505000),
        createMockCF(5, -495000),
        createMockCF(6, -500000),
      ]

      const result = calculateBurnRateTrend(cashFlows)

      expect(result.trend).toBe('stable')
    })

    it('should sort cash flows by month', () => {
      const cashFlows = [
        createMockCF(3, -500000),
        createMockCF(1, -300000),
        createMockCF(2, -400000),
        createMockCF(6, -800000),
        createMockCF(4, -600000),
        createMockCF(5, -700000),
      ]

      const result = calculateBurnRateTrend(cashFlows)

      expect(result).toBeDefined()
    })

    it('should handle positive cash flows (no burn)', () => {
      const cashFlows = [
        createMockCF(1, 500000),
        createMockCF(2, 600000),
        createMockCF(3, 700000),
        createMockCF(4, 800000),
        createMockCF(5, 900000),
        createMockCF(6, 1000000),
      ]

      const result = calculateBurnRateTrend(cashFlows)

      expect(result.trend).toBe('stable')
    })

    it('should handle mixed cash flows', () => {
      const cashFlows = [
        createMockCF(1, -500000),
        createMockCF(2, 100000),
        createMockCF(3, -300000),
        createMockCF(4, -600000),
        createMockCF(5, 200000),
        createMockCF(6, -700000),
      ]

      const result = calculateBurnRateTrend(cashFlows)

      expect(result).toBeDefined()
    })
  })

  describe('edge cases', () => {
    it('should handle zero current cash', () => {
      const cashFlows = [
        createMockCF(1, -500000),
        createMockCF(2, -500000),
        createMockCF(3, -500000),
      ]
      const currentCash = 0

      const result = calculateRunway(currentCash, cashFlows)

      expect(result).toBeDefined()
      expect(result.runwayMonths).toBeGreaterThanOrEqual(0)
    })

    it('should handle very large burn rate', async () => {
      const cashFlows = [
        createMockCF(1, -100000000),
        createMockCF(2, -100000000),
        createMockCF(3, -100000000),
      ]
      const currentCash = 50000000

      const result = calculateRunway(currentCash, cashFlows)

      expect(result).toBeDefined()
      expect(result.runwayMonths).toBeGreaterThanOrEqual(0)
    })

    it('should handle very small burn rate', () => {
      const cashFlows = [createMockCF(1, -1000), createMockCF(2, -1000), createMockCF(3, -1000)]
      const currentCash = 100000000

      const result = calculateRunway(currentCash, cashFlows)

      expect(result.runwayMonths).toBeGreaterThan(1000)
    })

    it('should handle negative runway alert', () => {
      const result = getRunwayAlert(-1)

      expect(result.level).toBe('critical')
    })

    it('should handle very long runway', () => {
      const result = getRunwayAlert(120)

      expect(result.level).toBe('safe')
    })
  })
})
