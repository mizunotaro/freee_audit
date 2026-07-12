import { describe, it, expect } from 'vitest'
import {
  computeRunwayMonths,
  getRunwayAlert,
  calculateBurnRateTrend,
} from '@/services/cashflow/runway-calculator'
import type { CashFlowStatement } from '@/types'

describe('computeRunwayMonths', () => {
  it('divides cash by net burn on the happy path', () => {
    expect(computeRunwayMonths(1000, 100)).toBe(10)
    expect(computeRunwayMonths(5000000, 1000000)).toBe(5)
  })

  it('returns 0 when there is no cash left but a positive burn', () => {
    expect(computeRunwayMonths(0, 500)).toBe(0)
  })

  it('returns a negative runway when cash is overdrawn', () => {
    expect(computeRunwayMonths(-300, 100)).toBe(-3)
  })

  it('returns Infinity for a non-finite cash balance (NaN)', () => {
    expect(computeRunwayMonths(Number.NaN, 100)).toBe(Infinity)
  })

  it('returns Infinity for a non-finite cash balance (Infinity)', () => {
    expect(computeRunwayMonths(Number.POSITIVE_INFINITY, 100)).toBe(Infinity)
  })

  it('returns Infinity when the burn rate is zero (not burning)', () => {
    expect(computeRunwayMonths(1000, 0)).toBe(Infinity)
  })

  it('returns Infinity when the burn rate is negative (cash-positive)', () => {
    expect(computeRunwayMonths(1000, -250)).toBe(Infinity)
  })

  it('returns Infinity for a NaN burn rate', () => {
    expect(computeRunwayMonths(1000, Number.NaN)).toBe(Infinity)
  })

  it('returns Infinity for an infinite burn rate', () => {
    expect(computeRunwayMonths(1000, Number.POSITIVE_INFINITY)).toBe(Infinity)
  })

  it('prefers the cash-finiteness guard over the burn guard', () => {
    expect(computeRunwayMonths(Number.NaN, Number.NaN)).toBe(Infinity)
  })
})

describe('getRunwayAlert (sub-threshold boundaries)', () => {
  it('is warning just below the 12-month safe threshold', () => {
    const result = getRunwayAlert(11.9)
    expect(result.level).toBe('warning')
    expect(result.message).toContain('注意')
  })

  it('is critical (危険) just below the 6-month warning threshold', () => {
    const result = getRunwayAlert(5.9)
    expect(result.level).toBe('critical')
    expect(result.message).toContain('危険')
    expect(result.message).not.toContain('ショート')
  })

  it('is critical (ショート) just below the 3-month threshold', () => {
    const result = getRunwayAlert(2.9)
    expect(result.level).toBe('critical')
    expect(result.message).toContain('ショート')
  })

  it('treats an infinite runway as safe', () => {
    const result = getRunwayAlert(Number.POSITIVE_INFINITY)
    expect(result.level).toBe('safe')
  })

  it('treats a fractional runway just over 12 as safe', () => {
    expect(getRunwayAlert(12.01).level).toBe('safe')
  })
})

describe('calculateBurnRateTrend (previous-period edge cases)', () => {
  const cf = (month: number, netCash: number): CashFlowStatement => ({
    fiscalYear: 2024,
    month,
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
    investingActivities: {
      netCashFromInvesting: 0,
      purchaseOfFixedAssets: 0,
      saleOfFixedAssets: 0,
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

  it('is stable with rate 0 when the previous window did not burn', () => {
    const cashFlows = [
      cf(1, 500000),
      cf(2, 400000),
      cf(3, 300000),
      cf(4, -1000000),
      cf(5, -1200000),
      cf(6, -1500000),
    ]
    const result = calculateBurnRateTrend(cashFlows)
    expect(result.trend).toBe('stable')
    expect(result.rate).toBe(0)
  })

  it('detects an increasing trend from a 5-month window (partial previous slice)', () => {
    const cashFlows = [
      cf(1, -100000),
      cf(2, -120000),
      cf(3, -400000),
      cf(4, -500000),
      cf(5, -600000),
    ]
    const result = calculateBurnRateTrend(cashFlows)
    expect(result.trend).toBe('increasing')
    expect(result.rate).toBeGreaterThan(10)
  })

  it('is stable when both windows burn at the same rate', () => {
    const cashFlows = [
      cf(1, -500000),
      cf(2, -500000),
      cf(3, -500000),
      cf(4, -500000),
      cf(5, -500000),
      cf(6, -500000),
    ]
    const result = calculateBurnRateTrend(cashFlows)
    expect(result.trend).toBe('stable')
    expect(result.rate).toBe(0)
  })
})
