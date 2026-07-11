import { describe, it, expect } from 'vitest'
import {
  projectScenario,
  runScenarioEngine,
  deriveRunRateFromCashFlows,
  DEFAULT_SCENARIO_PRESETS,
  SCENARIO_DAYS_PER_MONTH,
  type ScenarioAssumptions,
} from '@/services/cashflow/scenario-engine'
import { computeRunwayMonths } from '@/services/cashflow/runway-calculator'
import type { CashFlowStatement } from '@/types'

const AS_OF = new Date(2024, 0, 15) // local, mid-month; avoids month-length edge cases

const NEUTRAL: ScenarioAssumptions = {
  revenueGrowthMonthly: 0,
  dsoDays: 0,
  monthlyChurnRate: 0,
  costInflationMonthly: 0,
  oneOffs: [],
}

// Hand-computable single-period operating CF used to feed deriveRunRateFromCashFlows.
function makeCF(month: number, netIncome: number, wc: number): CashFlowStatement {
  return {
    fiscalYear: 2024,
    month,
    operatingActivities: {
      netIncome,
      depreciation: 0,
      amortization: 0,
      deferredTaxChange: 0,
      increaseInReceivables: wc,
      decreaseInInventory: 0,
      increaseInPayables: 0,
      otherNonCash: 0,
      netCashFromOperating: netIncome + wc,
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
    netChangeInCash: netIncome + wc,
    beginningCash: 0,
    endingCash: netIncome + wc,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GOLDEN — Base scenario. All levers neutral → pure run-rate burn, exact ints.
// currentCash 1,000,000; inflow 800,000; outflow 1,000,000; net -200,000/mo.
// Hand computation: cash 1.0M→0.8M→0.6M→0.4M→0.2M→0→-0.2M; exhausts at month 5.
// ─────────────────────────────────────────────────────────────────────────────
describe('GOLDEN — base scenario (neutral levers)', () => {
  const result = projectScenario({
    currentCash: 1_000_000,
    baseMonthlyInflow: 800_000,
    baseMonthlyOutflow: 1_000_000,
    horizonMonths: 6,
    asOfDate: AS_OF,
    assumptions: NEUTRAL,
  })

  it('succeeds', () => {
    expect(result.success).toBe(true)
  })

  it('projects the exact ending-cash series', () => {
    if (!result.success) throw new Error('expected success')
    const end = result.data.months.map((m) => m.endingCash)
    expect(end).toEqual([800_000, 600_000, 400_000, 200_000, 0, -200_000])
  })

  it('reports constant gross/net burn and operating CF per month', () => {
    if (!result.success) throw new Error('expected success')
    for (const m of result.data.months) {
      expect(m.grossInflow).toBe(800_000)
      expect(m.grossOutflow).toBe(1_000_000)
      expect(m.grossBurn).toBe(1_000_000)
      expect(m.netBurn).toBe(200_000)
      expect(m.netOperatingCashFlow).toBe(-200_000)
      expect(m.netCash).toBe(-200_000)
      expect(m.billedRevenue).toBe(800_000)
      expect(m.receivables).toBe(0)
      expect(m.dsoCashDrag).toBe(0)
      expect(m.oneOff).toBe(0)
    }
  })

  it('aggregates totals exactly', () => {
    if (!result.success) throw new Error('expected success')
    expect(result.data.totals).toEqual({
      grossInflow: 4_800_000,
      grossOutflow: 6_000_000,
      netOperatingCashFlow: -1_200_000,
      oneOff: 0,
      netCash: -1_200_000,
    })
  })

  it('computes runway = cash / avgNetBurn = 5.0 and flags exhaustion at month 5', () => {
    if (!result.success) throw new Error('expected success')
    const r = result.data.runway
    expect(r.avgNetBurn).toBe(200_000)
    expect(result.data.runRate.avgGrossBurn).toBe(1_000_000)
    expect(r.runwayMonths).toBe(5)
    expect(r.exhaustedWithinHorizon).toBe(true)
    expect(r.zeroCashMonth).toBe(5)
    expect(r.zeroCashDate?.getFullYear()).toBe(2024)
    expect(r.zeroCashDate?.getMonth()).toBe(5) // Jun (0-indexed): Jan + 5 months
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// GOLDEN — Pessimistic via a discrete one-off outflow (exact ints).
// One-off -300,000 in month 3 hits the cash roll-forward but NOT burn/runway,
// which are operating-only. Cash: 1.0M→0.8M→0.6M→0.1M→-0.1M (crosses in m4 at 3.5).
// ─────────────────────────────────────────────────────────────────────────────
describe('GOLDEN — one-off outflow affects cash, not burn', () => {
  const result = projectScenario({
    currentCash: 1_000_000,
    baseMonthlyInflow: 800_000,
    baseMonthlyOutflow: 1_000_000,
    horizonMonths: 6,
    asOfDate: AS_OF,
    assumptions: { ...NEUTRAL, oneOffs: [{ month: 3, amount: -300_000, label: 'tax' }] },
  })

  it('applies the one-off to month 3 net cash only', () => {
    if (!result.success) throw new Error('expected success')
    const m3 = result.data.months[2]
    expect(m3.oneOff).toBe(-300_000)
    expect(m3.netCash).toBe(-500_000) // -200,000 operating + -300,000 one-off
    expect(m3.netBurn).toBe(200_000) // burn is operating-only, unaffected
    expect(m3.grossBurn).toBe(1_000_000)
  })

  it('rolls cash forward through the one-off', () => {
    if (!result.success) throw new Error('expected success')
    const end = result.data.months.map((m) => m.endingCash)
    expect(end).toEqual([800_000, 600_000, 100_000, -100_000, -300_000, -500_000])
  })

  it('totals include the one-off', () => {
    if (!result.success) throw new Error('expected success')
    expect(result.data.totals.oneOff).toBe(-300_000)
    expect(result.data.totals.netCash).toBe(-1_500_000)
  })

  it('still reports operating runway = 5.0 but actual exhaustion at 3.5 months', () => {
    if (!result.success) throw new Error('expected success')
    const r = result.data.runway
    expect(r.avgNetBurn).toBe(200_000) // one-off excluded from burn
    expect(r.runwayMonths).toBe(5) // operating-based runway
    expect(r.exhaustedWithinHorizon).toBe(true)
    expect(r.zeroCashMonth).toBe(3.5) // actual cash crosses mid-month-4
    // Jan 15 + 3.5 months ≈ Apr 30 → April (0-indexed month 3)
    expect(r.zeroCashDate?.getMonth()).toBe(3)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// GOLDEN — Optimistic / cash-positive: inflow > outflow → infinite runway.
// inflow 1,000,000; outflow 800,000; net +200,000/mo → netBurn 0 → runway Infinity.
// ─────────────────────────────────────────────────────────────────────────────
describe('GOLDEN — cash-positive → infinite runway', () => {
  const result = projectScenario({
    currentCash: 1_000_000,
    baseMonthlyInflow: 1_000_000,
    baseMonthlyOutflow: 800_000,
    horizonMonths: 6,
    asOfDate: AS_OF,
    assumptions: NEUTRAL,
  })

  it('is never burning (netBurn 0 every month)', () => {
    if (!result.success) throw new Error('expected success')
    for (const m of result.data.months) {
      expect(m.netBurn).toBe(0)
      expect(m.netOperatingCashFlow).toBe(200_000)
    }
  })

  it('grows cash by +200,000/mo', () => {
    if (!result.success) throw new Error('expected success')
    const end = result.data.months.map((m) => m.endingCash)
    expect(end).toEqual([1_200_000, 1_400_000, 1_600_000, 1_800_000, 2_000_000, 2_200_000])
  })

  it('reports infinite runway and no exhaustion', () => {
    if (!result.success) throw new Error('expected success')
    const r = result.data.runway
    expect(r.avgNetBurn).toBe(0)
    expect(r.runwayMonths).toBe(Infinity)
    expect(r.exhaustedWithinHorizon).toBe(false)
    expect(r.zeroCashMonth).toBeNull()
    expect(r.zeroCashDate).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// GOLDEN — DSO working-capital mechanism.
// Steady-state DSO (no growth) ⇒ ΔAR = 0 ⇒ no drag. Growth ramps AR ⇒ drag.
// ─────────────────────────────────────────────────────────────────────────────
describe('GOLDEN — DSO working-capital drag', () => {
  it('steady-state DSO with no growth produces zero receivables drag', () => {
    const result = projectScenario({
      currentCash: 1_000_000,
      baseMonthlyInflow: 1_000_000,
      baseMonthlyOutflow: 0,
      horizonMonths: 3,
      asOfDate: AS_OF,
      assumptions: { ...NEUTRAL, dsoDays: 30 },
    })
    if (!result.success) throw new Error('expected success')
    // AR(0) default = baseInflow × 30 / DAYS; with g=0 billedRevenue == baseInflow
    // every month so AR is constant ⇒ ΔAR = 0 ⇒ cash collected == billedRevenue.
    for (const m of result.data.months) {
      expect(m.receivablesChange).toBe(0)
      expect(m.dsoCashDrag).toBe(0)
      expect(m.grossInflow).toBe(1_000_000)
      expect(m.billedRevenue).toBe(1_000_000)
    }
  })

  it('growth ramps receivables, creating a cash drag (grossInflow < billedRevenue)', () => {
    const DSO = 30
    const result = projectScenario({
      currentCash: 1_000_000,
      baseMonthlyInflow: 1_000_000,
      baseMonthlyOutflow: 0,
      horizonMonths: 1,
      asOfDate: AS_OF,
      assumptions: { ...NEUTRAL, dsoDays: DSO, revenueGrowthMonthly: 0.1 },
    })
    if (!result.success) throw new Error('expected success')
    const m1 = result.data.months[0]
    // billedRevenue_1 = 1,000,000 × 1.1 = 1,100,000
    expect(m1.billedRevenue).toBeCloseTo(1_100_000, 1)
    // AR(1) = billed × DSO / DAYS ; AR(0) steady-state = 1,000,000 × DSO / DAYS
    const ar1 = (1_100_000 * DSO) / SCENARIO_DAYS_PER_MONTH
    const ar0 = (1_000_000 * DSO) / SCENARIO_DAYS_PER_MONTH
    expect(m1.receivables).toBeCloseTo(ar1, 1)
    expect(m1.receivablesChange).toBeCloseTo(ar1 - ar0, 1)
    expect(m1.receivablesChange).toBeGreaterThan(0)
    expect(m1.dsoCashDrag).toBeLessThan(0)
    // cash collected = billed − ΔAR (identity)
    expect(m1.grossInflow).toBeCloseTo(1_100_000 - (ar1 - ar0), 1)
    expect(m1.grossInflow).toBeLessThan(m1.billedRevenue)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// runScenarioEngine — three scenarios share the start position & ordering.
// ─────────────────────────────────────────────────────────────────────────────
describe('runScenarioEngine — three-scenario projection', () => {
  // NOTE: ordering is asserted on DSO-free scenarios. With non-zero DSO, a
  // shrinking (pessimistic) company RELEASES working capital as receivables
  // unwind, which can momentarily push its cash above the base case — a real
  // economic effect, not a bug. So strict cash ordering only holds when the
  // scenarios differ on growth/churn/inflation alone (DSO = 0 for all).
  const DSO_FREE: {
    base: ScenarioAssumptions
    pessimistic: ScenarioAssumptions
    optimistic: ScenarioAssumptions
  } = {
    base: {
      revenueGrowthMonthly: 0,
      dsoDays: 0,
      monthlyChurnRate: 0,
      costInflationMonthly: 0,
      oneOffs: [],
    },
    pessimistic: {
      revenueGrowthMonthly: -0.05,
      dsoDays: 0,
      monthlyChurnRate: 0.03,
      costInflationMonthly: 0.02,
      oneOffs: [],
    },
    optimistic: {
      revenueGrowthMonthly: 0.05,
      dsoDays: 0,
      monthlyChurnRate: 0,
      costInflationMonthly: 0,
      oneOffs: [],
    },
  }

  const result = runScenarioEngine({
    currentCash: 1_000_000,
    baseMonthlyInflow: 800_000,
    baseMonthlyOutflow: 1_000_000,
    horizonMonths: 12,
    asOfDate: AS_OF,
    scenarios: DSO_FREE,
  })

  it('succeeds and returns all three scenarios', () => {
    expect(result.success).toBe(true)
    if (!result.success) throw new Error('expected success')
    expect(result.data.base.months).toHaveLength(12)
    expect(result.data.pessimistic.months).toHaveLength(12)
    expect(result.data.optimistic.months).toHaveLength(12)
    expect(result.data.currentCash).toBe(1_000_000)
    expect(result.data.horizonMonths).toBe(12)
  })

  it('orders ending cash optimistic ≥ base ≥ pessimistic every month (DSO=0)', () => {
    if (!result.success) throw new Error('expected success')
    for (let i = 0; i < 12; i++) {
      const o = result.data.optimistic.months[i].endingCash
      const b = result.data.base.months[i].endingCash
      const p = result.data.pessimistic.months[i].endingCash
      expect(o).toBeGreaterThanOrEqual(b)
      expect(b).toBeGreaterThanOrEqual(p)
    }
  })

  it('orders runway optimistic ≥ base ≥ pessimistic (DSO=0)', () => {
    if (!result.success) throw new Error('expected success')
    const o = result.data.optimistic.runway.runwayMonths
    const b = result.data.base.runway.runwayMonths
    const p = result.data.pessimistic.runway.runwayMonths
    expect(o).toBeGreaterThanOrEqual(b)
    expect(b).toBeGreaterThanOrEqual(p)
  })

  it('pessimistic exhausts no later than base; base no later than optimistic (DSO=0)', () => {
    if (!result.success) throw new Error('expected success')
    const z = (x: typeof result.data.base.runway) => x.zeroCashMonth ?? Infinity
    expect(z(result.data.pessimistic.runway)).toBeLessThanOrEqual(z(result.data.base.runway))
    expect(z(result.data.base.runway)).toBeLessThanOrEqual(z(result.data.optimistic.runway))
  })

  it('default presets all project over the horizon', () => {
    const r = runScenarioEngine({
      currentCash: 1_000_000,
      baseMonthlyInflow: 800_000,
      baseMonthlyOutflow: 1_000_000,
      horizonMonths: 12,
      asOfDate: AS_OF,
      scenarios: {
        base: DEFAULT_SCENARIO_PRESETS.base,
        pessimistic: DEFAULT_SCENARIO_PRESETS.pessimistic,
        optimistic: DEFAULT_SCENARIO_PRESETS.optimistic,
      },
    })
    if (!r.success) throw new Error('expected success')
    expect(r.data.base.months).toHaveLength(12)
    expect(r.data.pessimistic.months).toHaveLength(12)
    expect(r.data.optimistic.months).toHaveLength(12)
    // pessimistic is at least as bad as optimistic on operating run-rate burn.
    expect(r.data.pessimistic.runRate.avgNetBurn).toBeGreaterThanOrEqual(
      r.data.optimistic.runRate.avgNetBurn
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Property / monotonicity tests.
// ─────────────────────────────────────────────────────────────────────────────
describe('monotonicity & invariants', () => {
  const baseInput = {
    currentCash: 1_000_000,
    baseMonthlyInflow: 800_000,
    baseMonthlyOutflow: 1_000_000,
    horizonMonths: 6,
    asOfDate: AS_OF,
    assumptions: NEUTRAL,
  } as const

  it('higher DSO never improves cash (working-capital drag is monotonic)', () => {
    const low = projectScenario({
      ...baseInput,
      assumptions: { ...NEUTRAL, dsoDays: 0, revenueGrowthMonthly: 0.05 },
    })
    const high = projectScenario({
      ...baseInput,
      assumptions: { ...NEUTRAL, dsoDays: 60, revenueGrowthMonthly: 0.05 },
    })
    if (!low.success || !high.success) throw new Error('expected success')
    for (let i = 0; i < 6; i++) {
      expect(high.data.months[i].endingCash).toBeLessThanOrEqual(low.data.months[i].endingCash)
    }
  })

  it('higher churn never improves cash', () => {
    const none = projectScenario({ ...baseInput, assumptions: { ...NEUTRAL, monthlyChurnRate: 0 } })
    const some = projectScenario({
      ...baseInput,
      assumptions: { ...NEUTRAL, monthlyChurnRate: 0.1 },
    })
    if (!none.success || !some.success) throw new Error('expected success')
    for (let i = 0; i < 6; i++) {
      expect(some.data.months[i].endingCash).toBeLessThanOrEqual(none.data.months[i].endingCash)
    }
  })

  it('cost inflation never improves cash', () => {
    const flat = projectScenario({
      ...baseInput,
      assumptions: { ...NEUTRAL, costInflationMonthly: 0 },
    })
    const up = projectScenario({
      ...baseInput,
      assumptions: { ...NEUTRAL, costInflationMonthly: 0.05 },
    })
    if (!flat.success || !up.success) throw new Error('expected success')
    for (let i = 0; i < 6; i++) {
      expect(up.data.months[i].endingCash).toBeLessThanOrEqual(flat.data.months[i].endingCash)
    }
  })

  it('cash collected equals billed revenue minus ΔAR (identity, every month)', () => {
    const r = projectScenario({
      ...baseInput,
      assumptions: { ...NEUTRAL, dsoDays: 45, revenueGrowthMonthly: 0.05 },
    })
    if (!r.success) throw new Error('expected success')
    for (const m of r.data.months) {
      expect(m.grossInflow).toBeCloseTo(m.billedRevenue + m.dsoCashDrag, 4)
      expect(m.dsoCashDrag).toBeCloseTo(-m.receivablesChange, 4)
    }
  })

  it('net burn + net operating CF reconcile to the non-negative side', () => {
    const r = projectScenario({
      ...baseInput,
      assumptions: { ...NEUTRAL, revenueGrowthMonthly: -0.05, costInflationMonthly: 0.03 },
    })
    if (!r.success) throw new Error('expected success')
    for (const m of r.data.months) {
      // netBurn = max(0, -netOp); so netBurn ≥ 0 and netBurn*netOp ≤ 0.
      expect(m.netBurn).toBeGreaterThanOrEqual(0)
      expect(m.netBurn).toBe(Math.max(0, -m.netOperatingCashFlow))
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Edge cases — zero / negative / missing / boundary.
// ─────────────────────────────────────────────────────────────────────────────
describe('edge cases', () => {
  it('zero current cash with positive burn → runway 0, already exhausted (month 0)', () => {
    const r = projectScenario({
      currentCash: 0,
      baseMonthlyInflow: 0,
      baseMonthlyOutflow: 100_000,
      horizonMonths: 6,
      asOfDate: AS_OF,
      assumptions: NEUTRAL,
    })
    if (!r.success) throw new Error('expected success')
    expect(r.data.runway.runwayMonths).toBe(0)
    expect(r.data.runway.exhaustedWithinHorizon).toBe(true)
    expect(r.data.runway.zeroCashMonth).toBe(0) // already at zero at the start
  })

  it('zero inflow & zero outflow → no burn → infinite runway', () => {
    const r = projectScenario({
      currentCash: 500_000,
      baseMonthlyInflow: 0,
      baseMonthlyOutflow: 0,
      horizonMonths: 6,
      asOfDate: AS_OF,
      assumptions: NEUTRAL,
    })
    if (!r.success) throw new Error('expected success')
    expect(r.data.runway.runwayMonths).toBe(Infinity)
    expect(r.data.runway.exhaustedWithinHorizon).toBe(false)
    for (const m of r.data.months) expect(m.endingCash).toBe(500_000)
  })

  it('negative current cash → already exhausted, runway 0', () => {
    const r = projectScenario({
      currentCash: -100_000,
      baseMonthlyInflow: 0,
      baseMonthlyOutflow: 100_000,
      horizonMonths: 6,
      asOfDate: AS_OF,
      assumptions: NEUTRAL,
    })
    if (!r.success) throw new Error('expected success')
    expect(r.data.runway.runwayMonths).toBeLessThanOrEqual(0)
    expect(r.data.runway.zeroCashMonth).toBe(0) // already past zero at the start
  })

  it('100% churn collapses revenue to ~0 from month 1', () => {
    const r = projectScenario({
      currentCash: 1_000_000,
      baseMonthlyInflow: 800_000,
      baseMonthlyOutflow: 100_000,
      horizonMonths: 3,
      asOfDate: AS_OF,
      assumptions: { ...NEUTRAL, monthlyChurnRate: 1 },
    })
    if (!r.success) throw new Error('expected success')
    expect(r.data.months[0].billedRevenue).toBe(0)
    expect(r.data.months[1].billedRevenue).toBe(0)
  })

  it('horizon = 1 is accepted', () => {
    const r = projectScenario({
      currentCash: 1_000_000,
      baseMonthlyInflow: 800_000,
      baseMonthlyOutflow: 1_000_000,
      horizonMonths: 1,
      asOfDate: AS_OF,
      assumptions: NEUTRAL,
    })
    if (!r.success) throw new Error('expected success')
    expect(r.data.months).toHaveLength(1)
    expect(r.data.months[0].endingCash).toBe(800_000)
  })

  it('explicit openingReceivables overrides the steady-state default', () => {
    const r = projectScenario({
      currentCash: 1_000_000,
      baseMonthlyInflow: 1_000_000,
      baseMonthlyOutflow: 0,
      horizonMonths: 1,
      asOfDate: AS_OF,
      openingReceivables: 500_000,
      assumptions: { ...NEUTRAL, dsoDays: 30, revenueGrowthMonthly: 0.1 },
    })
    if (!r.success) throw new Error('expected success')
    // AR(1) = 1,100,000 × 30 / DAYS ; ΔAR uses the overridden 500,000 opening.
    const ar1 = (1_100_000 * 30) / SCENARIO_DAYS_PER_MONTH
    expect(r.data.months[0].receivablesChange).toBeCloseTo(ar1 - 500_000, 1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Validation — Zod safeParse rejects bad input, returns Result failure.
// ─────────────────────────────────────────────────────────────────────────────
describe('input validation', () => {
  it('rejects empty input with a VALIDATION_ERROR', () => {
    const r = projectScenario({} as never)
    expect(r.success).toBe(false)
    if (r.success) return
    expect(r.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects churn > 1', () => {
    const r = projectScenario({
      currentCash: 1_000_000,
      baseMonthlyInflow: 100_000,
      baseMonthlyOutflow: 100_000,
      horizonMonths: 3,
      asOfDate: AS_OF,
      assumptions: { ...NEUTRAL, monthlyChurnRate: 1.5 },
    })
    expect(r.success).toBe(false)
  })

  it('rejects negative baseMonthlyInflow', () => {
    const r = projectScenario({
      currentCash: 1_000_000,
      baseMonthlyInflow: -1,
      baseMonthlyOutflow: 100_000,
      horizonMonths: 3,
      asOfDate: AS_OF,
      assumptions: NEUTRAL,
    })
    expect(r.success).toBe(false)
  })

  it('rejects horizon > 120', () => {
    const r = projectScenario({
      currentCash: 1_000_000,
      baseMonthlyInflow: 100_000,
      baseMonthlyOutflow: 100_000,
      horizonMonths: 999,
      asOfDate: AS_OF,
      assumptions: NEUTRAL,
    })
    expect(r.success).toBe(false)
  })

  it('runScenarioEngine rejects a missing scenario', () => {
    const r = runScenarioEngine({
      currentCash: 1_000_000,
      baseMonthlyInflow: 100_000,
      baseMonthlyOutflow: 100_000,
      horizonMonths: 3,
      asOfDate: AS_OF,
      scenarios: { base: NEUTRAL, pessimistic: NEUTRAL } as never,
    })
    expect(r.success).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// deriveRunRateFromCashFlows — history → engine base inputs.
// ─────────────────────────────────────────────────────────────────────────────
describe('deriveRunRateFromCashFlows', () => {
  it('fails on empty history', () => {
    const r = deriveRunRateFromCashFlows([])
    expect(r.success).toBe(false)
    if (r.success) return
    expect(r.error.code).toBe('VALIDATION_ERROR')
  })

  it('averages historical inflow/outflow into a run-rate', () => {
    // Two months: netIncome 700k/-? structured so inflow/outflow are clean.
    // Month A: netIncome 700,000 (inflow), wc 0 → inflow 700k, outflow 0, net +700k.
    // Month B: netIncome -300,000 (outflow), wc 0 → inflow 0, outflow 300k, net -300k.
    const cfs = [makeCF(1, 700_000, 0), makeCF(2, -300_000, 0)]
    const r = deriveRunRateFromCashFlows(cfs)
    if (!r.success) throw new Error('expected success')
    expect(r.data.dataPoints).toBe(2)
    // avgInflow = mean(max(0, grossBurn+net)) = mean(700k, 0) = 350,000
    expect(r.data.baseMonthlyInflow).toBe(350_000)
    // avgOutflow = mean grossBurn = mean(0, 300k) = 150,000
    expect(r.data.baseMonthlyOutflow).toBe(150_000)
    // avgNetBurn = mean(max(0,-net)) = mean(0, 300k) = 150,000
    expect(r.data.avgNetBurn).toBe(150_000)
  })

  it('run-rate feeds the engine end-to-end', () => {
    const cfs = [makeCF(1, 700_000, 0), makeCF(2, 700_000, 0)]
    const rate = deriveRunRateFromCashFlows(cfs)
    if (!rate.success) throw new Error('expected success')
    const proj = projectScenario({
      currentCash: 1_000_000,
      baseMonthlyInflow: rate.data.baseMonthlyInflow,
      baseMonthlyOutflow: rate.data.baseMonthlyOutflow + 500_000, // manufacture a burn
      horizonMonths: 3,
      asOfDate: AS_OF,
      assumptions: NEUTRAL,
    })
    if (!proj.success) throw new Error('expected success')
    // inflow 700k, outflow 500k → net +200k/mo → cash-positive → infinite runway
    expect(proj.data.runway.runwayMonths).toBe(Infinity)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// computeRunwayMonths — the cited runway formula directly.
// ─────────────────────────────────────────────────────────────────────────────
describe('computeRunwayMonths', () => {
  it('cash / net burn', () => {
    expect(computeRunwayMonths(1_000_000, 200_000)).toBe(5)
    expect(computeRunwayMonths(500_000, 0)).toBe(Infinity)
    expect(computeRunwayMonths(0, 200_000)).toBe(0)
  })
  it('non-positive or non-finite burn → infinite runway', () => {
    expect(computeRunwayMonths(1_000_000, -50)).toBe(Infinity)
    expect(computeRunwayMonths(1_000_000, NaN)).toBe(Infinity)
    expect(computeRunwayMonths(NaN, 100)).toBe(Infinity)
  })
})
