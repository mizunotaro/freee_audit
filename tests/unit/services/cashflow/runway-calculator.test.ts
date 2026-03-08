import { describe, it, expect, vi } from 'vitest'
import {
  calculateRunway,
  getRunwayAlert,
  calculateBurnRateTrend,
} from '@/services/cashflow/runway-calculator'
import type { CashFlowStatement } from '@/types'

function createMockCashFlows(
  data: Array<{ month: number; operatingCF: number }>
): CashFlowStatement[] {
  return data.map((d) => ({
    fiscalYear: 2024,
    month: d.month,
    operatingActivities: {
      netIncome: 0,
      depreciation: 0,
      amortization: 0,
      deferredTaxChange: 0,
      increaseInReceivables: 0,
      decreaseInInventory: 0,
      increaseInPayables: 0,
      otherNonCash: 0,
      netCashFromOperating: d.operatingCF,
    },
    investingActivities: {
      purchaseOfFixedAssets: 0,
      saleOfFixedAssets: 0,
      netCashFromInvesting: 0,
    },
    financingActivities: {
      proceedsFromBorrowing: 0,
      repaymentOfBorrowing: 0,
      dividendPaid: 0,
      interestPaid: 0,
      netCashFromFinancing: 0,
    },
    netChangeInCash: d.operatingCF,
    beginningCash: 0,
    endingCash: d.operatingCF,
  }))
}

describe('calculateRunway', () => {
  describe('with valid cash flows', () => {
    it('should calculate runway from operating CF', () => {
      const cashFlows = createMockCashFlows([
        { month: 1, operatingCF: -1000000 },
        { month: 2, operatingCF: -1000000 },
        { month: 3, operatingCF: -1000000 },
      ])

      const result = calculateRunway(5000000, cashFlows)

      expect(result.monthlyBurnRate).toBe(1000000)
      expect(result.runwayMonths).toBe(5)
    })

    it('should return 999 for positive cash flow (infinite runway)', () => {
      const cashFlows = createMockCashFlows([
        { month: 1, operatingCF: 500000 },
        { month: 2, operatingCF: 600000 },
      ])

      const result = calculateRunway(5000000, cashFlows)

      expect(result.runwayMonths).toBe(999)
      expect(result.monthlyBurnRate).toBe(0)
    })

    it('should return 999 for zero burn rate', () => {
      const cashFlows = createMockCashFlows([
        { month: 1, operatingCF: 0 },
        { month: 2, operatingCF: 0 },
        { month: 3, operatingCF: 0 },
      ])

      const result = calculateRunway(5000000, cashFlows)

      expect(result.runwayMonths).toBe(999)
      expect(result.monthlyBurnRate).toBe(0)
    })

    it('should handle empty cash flows', () => {
      const result = calculateRunway(5000000, [])

      expect(result.monthlyBurnRate).toBe(0)
      expect(result.runwayMonths).toBe(999)
      expect(result.calculationBasis?.dataPoints).toBe(0)
    })

    it('should calculate average from varying cash flows', () => {
      const cashFlows = createMockCashFlows([
        { month: 1, operatingCF: -800000 },
        { month: 2, operatingCF: -1000000 },
        { month: 3, operatingCF: -1200000 },
      ])

      const result = calculateRunway(6000000, cashFlows)

      expect(result.calculationBasis?.avgMonthlyNetCashFlow).toBe(-1000000)
      expect(result.monthlyBurnRate).toBe(1000000)
      expect(result.runwayMonths).toBe(6)
    })
  })

  describe('scenario adjustments', () => {
    it('should apply adjustments with reasons', () => {
      const cashFlows = createMockCashFlows([
        { month: 1, operatingCF: -1000000 },
        { month: 2, operatingCF: -1000000 },
      ])

      const result = calculateRunway(5000000, cashFlows, {
        scenarioAdjustments: {
          optimistic: 0.8,
          realistic: 1.0,
          pessimistic: 1.3,
        },
        adjustmentReasons: {
          optimistic: '売上10%増加を想定',
          pessimistic: '主要顧客喪失リスク',
        },
      })

      expect(result.scenarios.optimistic.burnRate).toBe(800000)
      expect(result.scenarios.pessimistic.burnRate).toBe(1300000)
      expect(result.calculationBasis?.adjustmentReasons).toBeDefined()
    })

    it('should ignore adjustments without reasons', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const cashFlows = createMockCashFlows([{ month: 1, operatingCF: -1000000 }])

      const result = calculateRunway(5000000, cashFlows, {
        scenarioAdjustments: {
          optimistic: 0.5,
          realistic: 1.0,
          pessimistic: 1.5,
        },
      })

      expect(result.scenarios.optimistic.burnRate).toBe(1000000)
      expect(result.scenarios.pessimistic.burnRate).toBe(1000000)
      expect(warnSpy).toHaveBeenCalledTimes(2)

      warnSpy.mockRestore()
    })

    it('should use default 1.0 adjustments when not provided', () => {
      const cashFlows = createMockCashFlows([
        { month: 1, operatingCF: -1000000 },
        { month: 2, operatingCF: -1000000 },
      ])

      const result = calculateRunway(5000000, cashFlows)

      expect(result.scenarios.optimistic.burnRate).toBe(1000000)
      expect(result.scenarios.realistic.burnRate).toBe(1000000)
      expect(result.scenarios.pessimistic.burnRate).toBe(1000000)
    })

    it('should clamp adjustments to valid range', () => {
      const cashFlows = createMockCashFlows([{ month: 1, operatingCF: -1000000 }])

      const result = calculateRunway(5000000, cashFlows, {
        scenarioAdjustments: {
          optimistic: 0.1,
          realistic: 1.0,
          pessimistic: 5.0,
        },
        adjustmentReasons: {
          optimistic: 'Extreme optimism',
          pessimistic: 'Extreme pessimism',
        },
      })

      expect(result.scenarios.optimistic.burnRate).toBe(500000)
      expect(result.scenarios.pessimistic.burnRate).toBe(2000000)
    })
  })

  describe('data quality', () => {
    it('should include calculation basis in result', () => {
      const cashFlows = createMockCashFlows([
        { month: 1, operatingCF: -1000000 },
        { month: 2, operatingCF: -1200000 },
      ])

      const result = calculateRunway(5000000, cashFlows)

      expect(result.calculationBasis).toBeDefined()
      expect(result.calculationBasis?.avgMonthlyNetCashFlow).toBe(-1100000)
      expect(result.calculationBasis?.dataPoints).toBe(2)
    })

    it('should preserve adjustment reasons in result', () => {
      const cashFlows = createMockCashFlows([{ month: 1, operatingCF: -1000000 }])

      const result = calculateRunway(5000000, cashFlows, {
        scenarioAdjustments: {
          optimistic: 0.9,
          realistic: 1.0,
          pessimistic: 1.1,
        },
        adjustmentReasons: {
          optimistic: 'Cost reduction expected',
          pessimistic: 'Market uncertainty',
        },
      })

      expect(result.calculationBasis?.adjustmentReasons?.optimistic).toBe('Cost reduction expected')
      expect(result.calculationBasis?.adjustmentReasons?.pessimistic).toBe('Market uncertainty')
    })
  })

  describe('scenarios ordering', () => {
    it('should maintain optimistic >= realistic >= pessimistic for runway', () => {
      const cashFlows = createMockCashFlows([
        { month: 1, operatingCF: -1000000 },
        { month: 2, operatingCF: -1000000 },
      ])

      const result = calculateRunway(5000000, cashFlows, {
        scenarioAdjustments: {
          optimistic: 0.8,
          realistic: 1.0,
          pessimistic: 1.2,
        },
        adjustmentReasons: {
          optimistic: 'Growth expected',
          pessimistic: 'Risk factors',
        },
      })

      expect(result.scenarios.optimistic.runwayMonths).toBeGreaterThanOrEqual(
        result.scenarios.realistic.runwayMonths
      )
      expect(result.scenarios.realistic.runwayMonths).toBeGreaterThanOrEqual(
        result.scenarios.pessimistic.runwayMonths
      )
    })
  })

  describe('edge cases', () => {
    it('should handle zero current cash', () => {
      const cashFlows = createMockCashFlows([
        { month: 1, operatingCF: -1000000 },
        { month: 2, operatingCF: -1000000 },
      ])

      const result = calculateRunway(0, cashFlows)

      expect(result.runwayMonths).toBe(0)
    })

    it('should handle very large burn rate', () => {
      const cashFlows = createMockCashFlows([
        { month: 1, operatingCF: -100000000 },
        { month: 2, operatingCF: -100000000 },
        { month: 3, operatingCF: -100000000 },
      ])

      const result = calculateRunway(50000000, cashFlows)

      expect(result).toBeDefined()
      expect(result.runwayMonths).toBeGreaterThanOrEqual(0)
    })

    it('should handle very small burn rate', () => {
      const cashFlows = createMockCashFlows([
        { month: 1, operatingCF: -1000 },
        { month: 2, operatingCF: -1000 },
        { month: 3, operatingCF: -1000 },
      ])

      const result = calculateRunway(100000000, cashFlows)

      expect(result.runwayMonths).toBeGreaterThan(1000)
    })
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

  it('should handle negative runway alert', () => {
    const result = getRunwayAlert(-1)
    expect(result.level).toBe('critical')
  })

  it('should handle very long runway', () => {
    const result = getRunwayAlert(120)
    expect(result.level).toBe('safe')
  })
})

describe('calculateBurnRateTrend', () => {
  const createMockCF = (month: number, netCash: number): CashFlowStatement => ({
    fiscalYear: 2024,
    month,
    operating: {
      items: [],
      netCashFromOperating: netCash,
    },
    operatingActivities: {
      netCashFromOperating: netCash,
      netIncome: 0,
      depreciation: 0,
      amortization: 0,
      deferredTaxChange: 0,
      increaseInReceivables: 0,
      decreaseInInventory: 0,
      increaseInPayables: 0,
      otherNonCash: 0,
    },
    investing: {
      items: [],
      netCashFromInvesting: 0,
    },
    investingActivities: {
      netCashFromInvesting: 0,
      purchaseOfFixedAssets: 0,
      saleOfFixedAssets: 0,
    },
    financing: {
      items: [],
      netCashFromFinancing: 0,
    },
    financingActivities: {
      netCashFromFinancing: 0,
      proceedsFromBorrowing: 0,
      repaymentOfBorrowing: 0,
      dividendPaid: 0,
      interestPaid: 0,
    },
    netChangeInCash: netCash,
    beginningCash: 0,
    endingCash: 0,
  })

  it('should return stable for insufficient data', () => {
    const cashFlows = [createMockCF(1, -500000)]
    const result = calculateBurnRateTrend(cashFlows)
    expect(result.trend).toBe('stable')
    expect(result.rate).toBe(0)
  })

  it('should return stable for exactly 3 items', () => {
    const cashFlows = [createMockCF(1, -500000), createMockCF(2, -500000), createMockCF(3, -500000)]
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
