import { describe, it, expect } from 'vitest'
import { analyzeCostVolumeProfit } from '@/services/analysis/managerial-accounting'
import type { ManagerialCvpInput } from '@/services/analysis/managerial-accounting'

/**
 * Golden tests for Cost-Volume-Profit analysis. Hand-computed from the cited
 * formulas (Garrison; Horngren) in the service module header.
 */
describe('analyzeCostVolumeProfit', () => {
  describe('standard profitable case', () => {
    const input: ManagerialCvpInput = {
      sellingPricePerUnit: 1000,
      variableCostPerUnit: 600,
      totalFixedCosts: 200000,
      unitsSold: 1000,
      targetProfit: 100000,
    }

    it('computes contribution margin per unit and ratio', () => {
      const result = analyzeCostVolumeProfit(input)
      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.data.contributionMarginPerUnit).toBe(400) // 1000 - 600
      expect(result.data.contributionMarginRatio).toBe(0.4) // 400 / 1000
    })

    it('computes the break-even point in units and sales', () => {
      const result = analyzeCostVolumeProfit(input)
      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.data.breakEvenPoint.units).toBe(500) // 200000 / 400
      expect(result.data.breakEvenPoint.sales).toBe(500000) // 200000 / 0.4
    })

    it('computes the target-profit volume', () => {
      const result = analyzeCostVolumeProfit(input)
      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.data.targetProfit).toEqual({ units: 750, sales: 750000 }) // 300000/400, 300000/0.4
    })

    it('computes totals, margin of safety and operating leverage', () => {
      const result = analyzeCostVolumeProfit(input)
      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.data.totals).toEqual({
        sales: 1000000, // 1000 * 1000
        totalVariableCosts: 600000, // 600 * 1000
        contributionMargin: 400000, // 400 * 1000
        operatingIncome: 200000, // 400000 - 200000
      })
      expect(result.data.marginOfSafety).toEqual({ amount: 500000, percent: 50 }) // 1000000-500000, /1000000
      expect(result.data.operatingLeverage).toBe(2) // 400000 / 200000
      expect(result.data.warnings).toEqual([])
    })
  })

  describe('without units sold', () => {
    it('omits margin-of-safety / operating-leverage and warns', () => {
      const result = analyzeCostVolumeProfit({
        sellingPricePerUnit: 100,
        variableCostPerUnit: 60,
        totalFixedCosts: 10000,
      })
      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.data.contributionMarginPerUnit).toBe(40)
      expect(result.data.contributionMarginRatio).toBe(0.4)
      expect(result.data.breakEvenPoint).toEqual({ units: 250, sales: 25000 })
      expect(result.data.targetProfit).toBeNull()
      expect(result.data.marginOfSafety).toEqual({ amount: null, percent: null })
      expect(result.data.operatingLeverage).toBeNull()
      expect(result.data.totals.sales).toBeNull()
      expect(result.data.warnings.some((w) => w.includes('unitsSold not provided'))).toBe(true)
    })
  })

  describe('loss-making per unit (price <= variable cost)', () => {
    it('reports break-even as null with an explanatory warning', () => {
      const result = analyzeCostVolumeProfit({
        sellingPricePerUnit: 100,
        variableCostPerUnit: 120,
        totalFixedCosts: 10000,
        unitsSold: 100,
      })
      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.data.contributionMarginPerUnit).toBe(-20)
      expect(result.data.breakEvenPoint).toEqual({ units: null, sales: null })
      expect(result.data.totals.operatingIncome).toBe(-12000) // -2000 - 10000
      expect(result.data.operatingLeverage).toBeNull()
      expect(
        result.data.warnings.some((w) => w.includes('contribution margin per unit <= 0'))
      ).toBe(true)
      expect(result.data.warnings.some((w) => w.includes('operating income <= 0'))).toBe(true)
    })
  })

  describe('operating at break-even (operating income 0)', () => {
    it('reports DOL as null and zero margin of safety', () => {
      const result = analyzeCostVolumeProfit({
        sellingPricePerUnit: 100,
        variableCostPerUnit: 60,
        totalFixedCosts: 4000,
        unitsSold: 100, // CM 4000 == fixed 4000 -> OI 0
      })
      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.data.totals.operatingIncome).toBe(0)
      expect(result.data.operatingLeverage).toBeNull()
      expect(result.data.breakEvenPoint.units).toBe(100)
      expect(result.data.marginOfSafety).toEqual({ amount: 0, percent: 0 })
      expect(result.data.warnings.some((w) => w.includes('operating income <= 0'))).toBe(true)
    })
  })

  describe('zero fixed costs', () => {
    it('reports a zero break-even point', () => {
      const result = analyzeCostVolumeProfit({
        sellingPricePerUnit: 100,
        variableCostPerUnit: 60,
        totalFixedCosts: 0,
        unitsSold: 100,
      })
      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.data.breakEvenPoint).toEqual({ units: 0, sales: 0 })
      expect(result.data.totals.operatingIncome).toBe(4000)
      expect(result.data.operatingLeverage).toBe(1) // CM 4000 / OI 4000
    })
  })

  describe('validation (Zod safeParse)', () => {
    it('rejects a negative selling price', () => {
      const result = analyzeCostVolumeProfit({
        sellingPricePerUnit: -1,
        variableCostPerUnit: 0,
        totalFixedCosts: 0,
      })
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error.code).toBe('VALIDATION_ERROR')
    })

    it('rejects a missing required field', () => {
      const result = analyzeCostVolumeProfit({
        sellingPricePerUnit: 100,
        variableCostPerUnit: 60,
      })
      expect(result.success).toBe(false)
    })

    it('rejects a non-finite fixed cost', () => {
      const result = analyzeCostVolumeProfit({
        sellingPricePerUnit: 100,
        variableCostPerUnit: 60,
        totalFixedCosts: Number.NaN,
      })
      expect(result.success).toBe(false)
    })
  })
})
