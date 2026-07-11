import { describe, it, expect } from 'vitest'
import { projectCashflowScenario } from '@/services/analysis/cashflow-scenario'
import type { CashflowScenarioInput } from '@/services/analysis/cashflow-scenario'

/**
 * Golden tests for cash-flow scenario projection. Hand-computed from:
 *   baseMonthlyNet = mean(monthlyNetCashFlows)
 *   monthlyNet_scenario = baseMonthlyNet * adjustment
 *   runwayMonths = (crossingMonth - 1) + |beginningCash| / |monthlyNet|
 *   burnRate = |monthlyNet| when monthlyNet < 0, else 0
 */
describe('projectCashflowScenario', () => {
  describe('burning company', () => {
    const input: CashflowScenarioInput = {
      currentCash: 5000000,
      monthlyNetCashFlows: [-1000000, -1000000, -1000000],
      horizonMonths: 12,
    }

    it('derives base burn rate from the average monthly net outflow', () => {
      const result = projectCashflowScenario(input)
      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.data.baseMonthlyNetCashFlow).toBe(-1000000)
      expect(result.data.baseBurnRate).toBe(1000000)
      expect(result.data.dataPoints).toBe(3)
    })

    it('projects realistic runway at 5.0 months', () => {
      const result = projectCashflowScenario(input)
      expect(result.success).toBe(true)
      if (!result.success) return
      const realistic = result.data.scenarios.find((s) => s.name === 'realistic')!
      expect(realistic.adjustment).toBe(1)
      expect(realistic.monthlyNetCashFlow).toBe(-1000000)
      expect(realistic.burnRate).toBe(1000000)
      expect(realistic.runwayMonths).toBe(5)
      // Month 5 beginning 1000000, net -1000000, ending 0.
      expect(realistic.projection[4]).toEqual(
        expect.objectContaining({
          month: 5,
          beginningCash: 1000000,
          netCashFlow: -1000000,
          endingCash: 0,
        })
      )
      expect(realistic.projection.length).toBe(12)
    })

    it('projects optimistic (0.8x) runway at 6.25 months', () => {
      const result = projectCashflowScenario(input)
      expect(result.success).toBe(true)
      if (!result.success) return
      const optimistic = result.data.scenarios.find((s) => s.name === 'optimistic')!
      expect(optimistic.adjustment).toBe(0.8)
      expect(optimistic.monthlyNetCashFlow).toBe(-800000)
      expect(optimistic.burnRate).toBe(800000)
      // Crosses in month 7: beginning 200000, net -800000 -> 6 + 200000/800000 = 6.25
      expect(optimistic.runwayMonths).toBeCloseTo(6.25, 6)
      expect(optimistic.projection[6]).toEqual(
        expect.objectContaining({ month: 7, beginningCash: 200000, netCashFlow: -800000 })
      )
    })

    it('projects pessimistic (1.2x) runway at ~4.1667 months', () => {
      const result = projectCashflowScenario(input)
      expect(result.success).toBe(true)
      if (!result.success) return
      const pessimistic = result.data.scenarios.find((s) => s.name === 'pessimistic')!
      expect(pessimistic.adjustment).toBe(1.2)
      expect(pessimistic.monthlyNetCashFlow).toBe(-1200000)
      // Crosses in month 5: beginning 200000, net -1200000 -> 4 + 200000/1200000
      expect(pessimistic.runwayMonths).toBeCloseTo(4.1666667, 4)
    })

    it('flags a critical alert for a 5-month realistic runway', () => {
      const result = projectCashflowScenario(input)
      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.data.alert.level).toBe('critical')
    })
  })

  describe('cash-positive company', () => {
    it('reports null runway and zero burn when net cash flow is positive', () => {
      const input: CashflowScenarioInput = {
        currentCash: 1000000,
        monthlyNetCashFlows: [500000, 500000],
        horizonMonths: 12,
      }
      const result = projectCashflowScenario(input)
      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.data.baseMonthlyNetCashFlow).toBe(500000)
      expect(result.data.baseBurnRate).toBe(0)
      for (const s of result.data.scenarios) {
        expect(s.burnRate).toBe(0)
        expect(s.runwayMonths).toBeNull()
      }
      expect(result.data.alert.level).toBe('safe')
    })
  })

  describe('custom adjustments & horizon', () => {
    it('respects explicit adjustments and truncates the projection to the horizon', () => {
      const input: CashflowScenarioInput = {
        currentCash: 3000000,
        monthlyNetCashFlows: [-1000000],
        horizonMonths: 3,
        adjustments: { optimistic: 0.5, realistic: 1, pessimistic: 1.5 },
      }
      const result = projectCashflowScenario(input)
      expect(result.success).toBe(true)
      if (!result.success) return

      const optimistic = result.data.scenarios.find((s) => s.name === 'optimistic')!
      expect(optimistic.adjustment).toBe(0.5)
      expect(optimistic.monthlyNetCashFlow).toBe(-500000)
      // Never crosses 0 within 3 months: 3000000 - 500000*3 = 1500000 > 0.
      expect(optimistic.runwayMonths).toBeNull()
      expect(optimistic.projection.length).toBe(3)

      const pessimistic = result.data.scenarios.find((s) => s.name === 'pessimistic')!
      expect(pessimistic.monthlyNetCashFlow).toBe(-1500000)
      // Crosses month 2: beginning 1500000, net -1500000 -> 1 + 1500000/1500000 = 2.0
      expect(pessimistic.runwayMonths).toBe(2)
    })
  })

  describe('validation (Zod safeParse)', () => {
    it('rejects an empty monthly cash-flow array', () => {
      const result = projectCashflowScenario({ currentCash: 1000, monthlyNetCashFlows: [] })
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error.code).toBe('VALIDATION_ERROR')
    })

    it('rejects a non-positive adjustment multiplier', () => {
      const result = projectCashflowScenario({
        currentCash: 1000,
        monthlyNetCashFlows: [-100],
        adjustments: { optimistic: -1, realistic: 1, pessimistic: 2 },
      })
      expect(result.success).toBe(false)
    })

    it('rejects incoherent adjustment ordering (optimistic > realistic)', () => {
      const result = projectCashflowScenario({
        currentCash: 1000,
        monthlyNetCashFlows: [-100],
        adjustments: { optimistic: 2, realistic: 1, pessimistic: 0.5 },
      })
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error.message).toContain('optimistic <= realistic <= pessimistic')
    })

    it('rejects a non-finite currentCash', () => {
      const result = projectCashflowScenario({
        currentCash: Number.POSITIVE_INFINITY,
        monthlyNetCashFlows: [-100],
      })
      expect(result.success).toBe(false)
    })
  })
})
