import { describe, it, expect } from 'vitest'
import {
  computeManagerialMetrics,
  buildVarianceBridge,
} from '@/services/budget/managerial-accounting'
import type { StageLevelComparison } from '@/services/budget/detailed-actual-vs-budget'

describe('computeManagerialMetrics', () => {
  it('computes contribution margin, break-even and margin of safety for a healthy case', () => {
    const result = computeManagerialMetrics({
      revenue: 10000000,
      variableCosts: 6000000,
      fixedCosts: 2000000,
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    const m = result.data
    expect(m.contributionMargin).toBe(4000000)
    expect(m.contributionMarginRatio).toBe(40)
    expect(m.breakEvenSales).toBe(5000000)
    expect(m.marginOfSafetySales).toBe(5000000)
    expect(m.marginOfSafetyRatio).toBe(50)
    expect(m.operatingIncome).toBe(2000000)
  })

  it('returns null break-even / margin of safety when contribution margin is non-positive', () => {
    const result = computeManagerialMetrics({
      revenue: 1000000,
      variableCosts: 1200000,
      fixedCosts: 500000,
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    const m = result.data
    expect(m.contributionMargin).toBe(-200000)
    expect(m.contributionMarginRatio).toBe(-20)
    expect(m.breakEvenSales).toBeNull()
    expect(m.marginOfSafetySales).toBeNull()
    expect(m.marginOfSafetyRatio).toBeNull()
    expect(m.operatingIncome).toBe(-700000)
  })

  it('returns null break-even when revenue is zero', () => {
    const result = computeManagerialMetrics({
      revenue: 0,
      variableCosts: 0,
      fixedCosts: 2000000,
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.contributionMarginRatio).toBe(0)
    expect(result.data.breakEvenSales).toBeNull()
    expect(result.data.operatingIncome).toBe(-2000000)
  })

  it('treats fixed costs of zero as break-even at zero sales (100% margin of safety)', () => {
    const result = computeManagerialMetrics({
      revenue: 5000000,
      variableCosts: 3000000,
      fixedCosts: 0,
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.breakEvenSales).toBe(0)
    expect(result.data.marginOfSafetyRatio).toBe(100)
  })

  it('fails on invalid input (negative variable costs)', () => {
    const result = computeManagerialMetrics({
      revenue: 1000,
      variableCosts: -100,
      fixedCosts: 0,
    })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })
})

function buildStages(
  overrides: Partial<Record<string, Partial<StageLevelComparison>>> = {}
): StageLevelComparison[] {
  const base: Record<string, StageLevelComparison> = {
    売上高: {
      stage: '売上高',
      budget: 0,
      actual: 5000000,
      variance: 5000000,
      rate: 0,
      status: 'good',
      favorable: true,
    },
    売上原価: {
      stage: '売上原価',
      budget: 0,
      actual: 2000000,
      variance: 2000000,
      rate: 0,
      status: 'good',
      favorable: true,
    },
    売上総利益: {
      stage: '売上総利益',
      budget: 0,
      actual: 3000000,
      variance: 3000000,
      rate: 0,
      status: 'good',
      favorable: true,
    },
    販売管理費: {
      stage: '販売管理費',
      budget: 0,
      actual: 1430000,
      variance: 1430000,
      rate: 0,
      status: 'good',
      favorable: true,
    },
    営業利益: {
      stage: '営業利益',
      budget: 0,
      actual: 1570000,
      variance: 1570000,
      rate: 0,
      status: 'good',
      favorable: true,
    },
    当期純利益: {
      stage: '当期純利益',
      budget: 0,
      actual: 1099000,
      variance: 1099000,
      rate: 0,
      status: 'good',
      favorable: true,
    },
  }
  for (const [key, val] of Object.entries(overrides)) {
    if (val) base[key] = { ...base[key], ...val }
  }
  return Object.values(base)
}

describe('buildVarianceBridge', () => {
  it('builds a reconciling operating-income bridge with correct sign convention', () => {
    const result = buildVarianceBridge({ stages: buildStages() })

    expect(result.success).toBe(true)
    if (!result.success) return
    const b = result.data

    expect(b.start).toBe(0) // 営業利益 budget
    expect(b.end).toBe(1570000) // 営業利益 actual
    expect(b.drivers).toHaveLength(3)

    const rev = b.drivers.find((d) => d.category === 'revenue')
    const cogs = b.drivers.find((d) => d.category === 'cost_of_sales')
    const sga = b.drivers.find((d) => d.category === 'sga_expense')

    // Revenue variance increases operating income (positive as-is)
    expect(rev?.amount).toBe(5000000)
    // Expense variances are negated (positive expense variance decreases OI)
    expect(cogs?.amount).toBe(-2000000)
    expect(sga?.amount).toBe(-1430000)

    const driversSum = b.drivers.reduce((s, d) => s + d.amount, 0)
    expect(b.start + driversSum).toBe(b.end)
    expect(b.reconciliationGap).toBe(0)
  })

  it('reconciles when budget and actual differ from zero', () => {
    const result = buildVarianceBridge({
      stages: buildStages({
        売上高: { budget: 10000000, actual: 9000000, variance: -1000000 },
        売上原価: { budget: 4000000, actual: 4500000, variance: 500000 },
        販売管理費: { budget: 2000000, actual: 1800000, variance: -200000 },
        営業利益: { budget: 4000000, actual: 2700000, variance: -1300000 },
      }),
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    const b = result.data
    expect(b.start).toBe(4000000)
    expect(b.end).toBe(2700000)
    // rev(-1,000,000) + cogs(-500,000) + sga(+200,000) = -1,300,000
    const driversSum = b.drivers.reduce((s, d) => s + d.amount, 0)
    expect(driversSum).toBe(-1300000)
    expect(b.start + driversSum).toBe(b.end)
    expect(b.reconciliationGap).toBe(0)
  })

  it('fails when a required stage is missing', () => {
    const stages = buildStages().filter((s) => s.stage !== '営業利益')
    const result = buildVarianceBridge({ stages })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(JSON.stringify(result.error.details)).toContain('営業利益')
  })

  it('fails on invalid input (empty stages)', () => {
    const result = buildVarianceBridge({ stages: [] })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })
})
