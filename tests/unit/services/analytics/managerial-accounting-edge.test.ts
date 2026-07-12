import { describe, it, expect } from 'vitest'
import {
  classifyCostBehavior,
  calculateContributionMargin,
  analyzeCVP,
} from '@/services/analytics/managerial-accounting'
import { ERROR_CODES } from '@/types/result'

/**
 * EDGE-01 — error / edge-case deepening for the analytics managerial-accounting
 * pure core (FIN-IMPL-03).
 *
 * Covers branches left uncovered by the golden suite (managerial-accounting.test.ts):
 *   - safeRatio overflow → null (a finite numerator/denominator that divides to ±Infinity),
 *   - classifyCostBehavior validation failure on an invalid `overrides` value,
 *   - calculateContributionMargin validation failure on non-finite input,
 *   - analyzeCVP with an undefined break-even (CM/unit ≤ 0) AND a supplied volume →
 *     margin-of-safety fields are null rather than computed.
 */

function unwrap<T>(r: { success: true; data: T } | { success: false; error: unknown }): T {
  if (!r.success) throw new Error(`expected success, got error: ${JSON.stringify(r.error)}`)
  return r.data
}

describe('safeRatio — overflow to null (boundary)', () => {
  it('returns a null contribution-margin ratio when CM overflows to Infinity', () => {
    // revenue 1e308, variableCosts −1e308 are both finite (≤ Number.MAX_VALUE),
    // but revenue − variableCosts = 2e308 overflows to Infinity. safeRatio then
    // sees a non-finite quotient and returns null (distinguishing "undefined"
    // from a real 0%).
    const out = unwrap(
      calculateContributionMargin({ revenue: 1e308, variableCosts: -1e308, fixedCosts: 0 })
    )
    expect(out.contributionMargin).toBe(Infinity)
    expect(out.contributionMarginRatio).toBeNull()
  })
})

describe('classifyCostBehavior — invalid overrides', () => {
  it('returns VALIDATION_ERROR when an override value is not variable|fixed', () => {
    const r = classifyCostBehavior(
      [{ accountCode: '5110', accountName: '売上原価', amount: 1000 }],
      { overrides: { '5110': 'semi-variable' as unknown as 'variable' | 'fixed' } }
    )
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.code).toBe(ERROR_CODES.VALIDATION_ERROR)
  })

  it('returns VALIDATION_ERROR when overrides is not a record', () => {
    const r = classifyCostBehavior(
      [{ accountCode: '5110', accountName: '売上原価', amount: 1000 }],
      { overrides: 'not-a-record' as unknown as Record<string, 'variable' | 'fixed'> }
    )
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.code).toBe(ERROR_CODES.VALIDATION_ERROR)
  })
})

describe('calculateContributionMargin — invalid input', () => {
  it('returns VALIDATION_ERROR on a non-finite revenue', () => {
    const r = calculateContributionMargin({ revenue: NaN, variableCosts: 0, fixedCosts: 0 })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.code).toBe(ERROR_CODES.VALIDATION_ERROR)
  })

  it('returns VALIDATION_ERROR on a missing field', () => {
    const r = calculateContributionMargin({ revenue: 1000 } as unknown as {
      revenue: number
      variableCosts: number
      fixedCosts: number
    })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.code).toBe(ERROR_CODES.VALIDATION_ERROR)
  })
})

describe('analyzeCVP — undefined break-even with a supplied volume', () => {
  it('nulls margin-of-safety when CM/unit is negative but a volume is given', () => {
    // price 1,000/unit, varCost 1,500/unit → CM/unit −500 (≤ 0, no finite break-even).
    // volume 100 supplied → actualSales / operatingIncome still computed, but MoS
    // is undefined (no break-even to measure safety against) → null.
    const out = unwrap(
      analyzeCVP({
        sellingPricePerUnit: 1000,
        variableCostPerUnit: 1500,
        fixedCosts: 4000,
        volume: 100,
      })
    )
    expect(out.defined).toBe(false)
    expect(out.breakEvenVolume).toBeNull()
    expect(out.breakEvenSales).toBeNull()
    expect(out.actualSales).toBe(100000) // 100 × 1,000
    expect(out.operatingIncome).toBe(-54000) // −500 × 100 − 4,000
    expect(out.marginOfSafetyAmount).toBeNull()
    expect(out.marginOfSafetyRatio).toBeNull()
    // DOL is still computable (operating income ≠ 0): totalCM / OI = −50,000 / −54,000.
    expect(out.degreeOfOperatingLeverage).toBeCloseTo((-500 * 100) / -54000, 6)
  })
})
