import { z } from 'zod'
import { addMonths } from '@/lib/utils'
import { success, failure, createAppError, type Result, type AppError } from '@/types/result'
import { ERROR_CODES } from '@/types/result'
import type { CashFlowStatement } from '@/types'
import { computeRunwayMonths } from '@/services/cashflow/runway-calculator'
import { deriveBurnRunRate } from '@/services/cashflow/calculator'

// ─────────────────────────────────────────────────────────────────────────────
// FIN-IMPL-02 — 3-scenario cash-flow + Runway engine (通常 / 悲観 / 強気)
//
// All formulas below are based on standard, cited definitions. Judgemental
// modelling choices are flagged `// PENDING HUMAN DETERMINATION` and default to
// the most conservative option. The full citation/assumption list is mirrored in
// docs/proposals/fin-design-02.md and the PR body (human-review-required).
//
// Standard definitions used:
//  • Net burn   = max(0, −net operating cash flow)            (Investopedia "Burn Rate")
//  • Gross burn = total operating cash outflow (spend)         (Investopedia / Carta "Gross Burn")
//  • Runway     = cash balance ÷ net burn rate (months)        (Investopedia "Cash Runway")
//  • DSO        = (AR ÷ revenue) × days  ⇔  AR = revenue × DSO / days
//                 cash collected = revenue − ΔAR               (CFA Institute, indirect method)
//  • Revenue path: revenue_t = revenue_0 × (1+g)^t × (1−churn)^t
//  • Cost path:    cost_t    = cost_0    × (1+π)^t            (standard period compounding)
// ─────────────────────────────────────────────────────────────────────────────

/** Standard annualization: a 365-day year over 12 months ≈ 30.4167 days/month. */
const DAYS_PER_MONTH = 365 / 12

/**
 * Days-per-month constant exposed for callers/tests that need to reproduce the
 * DSO ⇔ receivables conversion (AR = revenue × DSO / DAYS_PER_MONTH).
 */
export const SCENARIO_DAYS_PER_MONTH = DAYS_PER_MONTH

// ── Zod schemas ──────────────────────────────────────────────────────────────

export const OneOffSchema = z.object({
  /** 1-indexed projection month the one-off lands in (1 = first projected month). */
  month: z.number().int().min(1),
  /** Signed cash amount. Positive = inflow (e.g. fundraising), negative = outflow (e.g. tax, capex). */
  amount: z.number().finite(),
  label: z.string().max(120).optional(),
})

export const ScenarioAssumptionsSchema = z.object({
  /** Period (monthly) revenue growth rate, decimal. Negative = contraction. */
  revenueGrowthMonthly: z.number().finite().min(-0.99).max(50),
  /** Days Sales Outstanding applied to projected revenue to size receivables. */
  dsoDays: z.number().finite().min(0).max(365),
  /** Monthly revenue churn (lost revenue fraction), 0–1. */
  monthlyChurnRate: z.number().finite().min(0).max(1),
  /** Monthly cost inflation rate, decimal. Negative = deliberate cost reduction. */
  costInflationMonthly: z.number().finite().min(-0.99).max(50),
  /** Non-recurring signed cash events keyed by projection month. */
  oneOffs: z.array(OneOffSchema).default([]),
  label: z.string().max(120).optional(),
})

export const ScenarioEngineInputSchema = z.object({
  /** Cash balance at the start of the projection (t=0). */
  currentCash: z.number().finite(),
  /** Baseline monthly operating cash inflow (run-rate) used as revenue base. */
  baseMonthlyInflow: z.number().finite().min(0),
  /** Baseline monthly operating cash outflow (run-rate) used as cost base. */
  baseMonthlyOutflow: z.number().finite().min(0),
  /** Projection length in months. */
  horizonMonths: z.number().int().min(1).max(120),
  /** Opening receivables balance at t=0. See AR(0) note in projectScenarioInternal. */
  openingReceivables: z.number().finite().min(0).optional(),
  /** Reference date for zero-cash date projection. Defaults to now. */
  asOfDate: z.date().optional(),
  assumptions: ScenarioAssumptionsSchema,
})

export const MultiScenarioEngineInputSchema = ScenarioEngineInputSchema.omit({
  assumptions: true,
}).extend({
  scenarios: z.object({
    base: ScenarioAssumptionsSchema,
    pessimistic: ScenarioAssumptionsSchema,
    optimistic: ScenarioAssumptionsSchema,
  }),
})

// ── Types (derived from schemas) ─────────────────────────────────────────────

export type ScenarioAssumptions = z.infer<typeof ScenarioAssumptionsSchema>
export type ScenarioEngineInput = z.infer<typeof ScenarioEngineInputSchema>
export type MultiScenarioEngineInput = z.infer<typeof MultiScenarioEngineInputSchema>

export interface ScenarioMonthProjection {
  /** 1-indexed projection month. */
  month: number
  /** Accrual revenue billed in the month (base × growth × retention). */
  billedRevenue: number
  /** Receivables balance AR(t) = billedRevenue × DSO / DAYS_PER_MONTH. */
  receivables: number
  /** ΔAR(t) = AR(t) − AR(t−1). */
  receivablesChange: number
  /** Cash drag from the receivables change = −ΔAR(t) (≥0 consumes cash). */
  dsoCashDrag: number
  /** Cash collected = billedRevenue − ΔAR(t). */
  grossInflow: number
  /** Operating cash outflow = baseOutflow × (1+inflation)^t. */
  grossOutflow: number
  /** netOperatingCashFlow = grossInflow − grossOutflow. */
  netOperatingCashFlow: number
  /** Signed sum of one-offs scheduled in this month. */
  oneOff: number
  /** netCash = netOperatingCashFlow + oneOff (drives the cash roll-forward). */
  netCash: number
  /** Gross burn = grossOutflow (total operating spend). */
  grossBurn: number
  /** Net burn = max(0, −netOperatingCashFlow). 0 when operations are cash-positive. */
  netBurn: number
  /** Cash balance at month end = previous endingCash + netCash. */
  endingCash: number
}

export interface ScenarioRunway {
  /** Mean monthly net burn across the horizon (forward-looking run-rate). */
  avgNetBurn: number
  /** Runway (months) = currentCash ÷ avgNetBurn. Infinity when not burning. */
  runwayMonths: number
  /** True if ending cash crosses ≤ 0 within the horizon. */
  exhaustedWithinHorizon: boolean
  /** First fractional month (1-indexed) at which cash ≤ 0, or null. */
  zeroCashMonth: number | null
  /** asOfDate advanced by zeroCashMonth, or null when cash never runs out. */
  zeroCashDate: Date | null
}

export interface ScenarioProjection {
  assumptions: ScenarioAssumptions
  months: ScenarioMonthProjection[]
  totals: {
    grossInflow: number
    grossOutflow: number
    netOperatingCashFlow: number
    oneOff: number
    netCash: number
  }
  runRate: {
    avgGrossBurn: number
    avgNetBurn: number
  }
  runway: ScenarioRunway
}

export interface ScenarioEngineResult {
  asOfDate: Date
  currentCash: number
  horizonMonths: number
  base: ScenarioProjection
  pessimistic: ScenarioProjection
  optimistic: ScenarioProjection
}

// ── Default scenario presets ─────────────────────────────────────────────────
// PENDING HUMAN DETERMINATION: the default lever values below are judgemental
// starting points, not calibrated forecasts. The owner should replace them with
// company-specific assumptions before relying on the output. Defaults lean
// conservative (pessimistic is genuinely punitive, optimistic is modest).
export const DEFAULT_SCENARIO_PRESETS = {
  base: {
    revenueGrowthMonthly: 0,
    dsoDays: 45,
    monthlyChurnRate: 0,
    costInflationMonthly: 0,
    oneOffs: [],
  },
  pessimistic: {
    revenueGrowthMonthly: -0.05,
    dsoDays: 60,
    monthlyChurnRate: 0.03,
    costInflationMonthly: 0.02,
    oneOffs: [],
  },
  optimistic: {
    revenueGrowthMonthly: 0.05,
    dsoDays: 30,
    monthlyChurnRate: 0,
    costInflationMonthly: 0,
    oneOffs: [],
  },
} as const satisfies Record<'base' | 'pessimistic' | 'optimistic', ScenarioAssumptions>

// ── Internal pure projector (assumes already-validated inputs) ───────────────

function projectScenarioInternal(
  currentCash: number,
  asOfDate: Date,
  horizonMonths: number,
  baseMonthlyInflow: number,
  baseMonthlyOutflow: number,
  assumptions: ScenarioAssumptions,
  openingReceivables?: number
): ScenarioProjection {
  const {
    revenueGrowthMonthly: g,
    dsoDays,
    monthlyChurnRate: churn,
    costInflationMonthly: inflation,
    oneOffs,
  } = assumptions

  // Index one-offs by month for O(1) lookup.
  const oneOffByMonth = new Map<number, number>()
  for (const o of oneOffs) {
    oneOffByMonth.set(o.month, (oneOffByMonth.get(o.month) ?? 0) + o.amount)
  }

  // PENDING HUMAN DETERMINATION — opening AR(0).
  // Default to steady-state: AR(0) = baseInflow × DSO / DAYS, so the ΔAR line
  // captures only the working-capital drag from the revenue *ramp* rather than a
  // spurious one-time build from zero. Callers may override via openingReceivables.
  // This is the most defensible (non-punitive, non-flattering) default.
  const openingAR = openingReceivables ?? (baseMonthlyInflow * dsoDays) / DAYS_PER_MONTH

  const months: ScenarioMonthProjection[] = []
  let prevAR = openingAR
  let prevCash = currentCash
  let zeroCashMonth: number | null = null

  for (let t = 1; t <= horizonMonths; t++) {
    // Revenue path: revenue_0 × (1+g)^t × (1−churn)^t. (Standard compounding + churn.)
    const revenueScale = Math.pow(1 + g, t) * Math.pow(1 - churn, t)
    const billedRevenue = baseMonthlyInflow * revenueScale

    // DSO ⇔ receivables: AR(t) = revenue × DSO / days. (CFA / indirect method.)
    const receivables = (billedRevenue * dsoDays) / DAYS_PER_MONTH
    const receivablesChange = nz(receivables - prevAR)
    const dsoCashDrag = nz(-receivablesChange) // +ΔAR ties up cash
    const grossInflow = billedRevenue + dsoCashDrag // cash collected = revenue − ΔAR

    // Cost path: cost_0 × (1+π)^t. (Standard period compounding.)
    const grossOutflow = baseMonthlyOutflow * Math.pow(1 + inflation, t)

    const netOperatingCashFlow = grossInflow - grossOutflow
    const oneOff = oneOffByMonth.get(t) ?? 0
    const netCash = netOperatingCashFlow + oneOff

    // Burn: gross = total spend; net = cash consumed by operations.
    const grossBurn = grossOutflow
    const netBurn = Math.max(0, -netOperatingCashFlow)

    const endingCash = prevCash + netCash

    // First crossing of cash ≤ 0 (fractional within the month).
    if (zeroCashMonth === null && endingCash <= 0) {
      if (netCash >= 0) {
        // No burn this month but still ≤ 0 (already exhausted): lands at month end.
        zeroCashMonth = t
      } else {
        const frac = prevCash / (prevCash - endingCash) // ∈ (0,1]
        zeroCashMonth = t - 1 + Math.min(1, Math.max(0, frac))
      }
    }

    months.push({
      month: t,
      billedRevenue,
      receivables,
      receivablesChange,
      dsoCashDrag,
      grossInflow,
      grossOutflow,
      netOperatingCashFlow,
      oneOff,
      netCash,
      grossBurn,
      netBurn,
      endingCash,
    })

    prevAR = receivables
    prevCash = endingCash
  }

  const totals = {
    grossInflow: sumProj(months, (m) => m.grossInflow),
    grossOutflow: sumProj(months, (m) => m.grossOutflow),
    netOperatingCashFlow: sumProj(months, (m) => m.netOperatingCashFlow),
    oneOff: sumProj(months, (m) => m.oneOff),
    netCash: sumProj(months, (m) => m.netCash),
  }

  const avgGrossBurn = sumProj(months, (m) => m.grossBurn) / horizonMonths
  const avgNetBurn = sumProj(months, (m) => m.netBurn) / horizonMonths

  // Runway = cash ÷ net burn (cited). Infinite when not burning.
  const runwayMonths = computeRunwayMonths(currentCash, avgNetBurn)
  const exhaustedWithinHorizon = zeroCashMonth !== null

  const runway: ScenarioRunway = {
    avgNetBurn,
    runwayMonths,
    exhaustedWithinHorizon,
    zeroCashMonth,
    zeroCashDate: zeroCashMonth === null ? null : addFractionalMonths(asOfDate, zeroCashMonth),
  }

  return { assumptions, months, totals, runRate: { avgGrossBurn, avgNetBurn }, runway }
}

function sumProj<T>(arr: T[], pick: (x: T) => number): number {
  let s = 0
  for (const x of arr) s += pick(x) || 0
  return s
}

/** Normalize -0 to +0 so sign-flipped outputs (e.g. dsoCashDrag) don't leak -0. */
function nz(n: number): number {
  return n === 0 ? 0 : n
}

/** Add a (possibly fractional) month count to a date — integer months then residual days. */
function addFractionalMonths(date: Date, months: number): Date {
  const whole = Math.floor(months)
  const fracDays = Math.round((months - whole) * DAYS_PER_MONTH)
  const d = addMonths(date, whole)
  d.setDate(d.getDate() + fracDays)
  return d
}

function validationError(details: unknown): AppError {
  return createAppError(ERROR_CODES.VALIDATION_ERROR, 'シナリオエンジン入力の検証に失敗しました', {
    details: details as Record<string, unknown>,
  })
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Project a single scenario over the horizon.
 * Validates the full input with Zod `safeParse`; returns `Result` (never throws).
 */
export function projectScenario(input: ScenarioEngineInput): Result<ScenarioProjection, AppError> {
  const parsed = ScenarioEngineInputSchema.safeParse(input)
  if (!parsed.success) return failure(validationError(parsed.error.format()))
  const d = parsed.data
  const projection = projectScenarioInternal(
    d.currentCash,
    d.asOfDate ?? new Date(),
    d.horizonMonths,
    d.baseMonthlyInflow,
    d.baseMonthlyOutflow,
    d.assumptions,
    d.openingReceivables
  )
  return success(projection)
}

/**
 * Run all three scenarios (base / pessimistic / optimistic) over a shared
 * starting position and horizon. Validates with Zod `safeParse`; returns `Result`.
 */
export function runScenarioEngine(
  input: MultiScenarioEngineInput
): Result<ScenarioEngineResult, AppError> {
  const parsed = MultiScenarioEngineInputSchema.safeParse(input)
  if (!parsed.success) return failure(validationError(parsed.error.format()))
  const d = parsed.data
  const asOfDate = d.asOfDate ?? new Date()

  const base = projectScenarioInternal(
    d.currentCash,
    asOfDate,
    d.horizonMonths,
    d.baseMonthlyInflow,
    d.baseMonthlyOutflow,
    d.scenarios.base,
    d.openingReceivables
  )
  const pessimistic = projectScenarioInternal(
    d.currentCash,
    asOfDate,
    d.horizonMonths,
    d.baseMonthlyInflow,
    d.baseMonthlyOutflow,
    d.scenarios.pessimistic,
    d.openingReceivables
  )
  const optimistic = projectScenarioInternal(
    d.currentCash,
    asOfDate,
    d.horizonMonths,
    d.baseMonthlyInflow,
    d.baseMonthlyOutflow,
    d.scenarios.optimistic,
    d.openingReceivables
  )

  return success({
    asOfDate,
    currentCash: d.currentCash,
    horizonMonths: d.horizonMonths,
    base,
    pessimistic,
    optimistic,
  })
}

export interface HistoricalRunRate {
  /** Mean monthly operating cash inflow (collection base). */
  baseMonthlyInflow: number
  /** Mean monthly operating cash outflow (cost base = mean gross burn). */
  baseMonthlyOutflow: number
  /** Mean monthly net burn. */
  avgNetBurn: number
  /** Number of historical months observed. */
  dataPoints: number
}

/**
 * Derive the engine's baseline inflow/outflow run-rate from historical
 * cash-flow statements. Returns `Result`; fails when there is no history to
 * average (cannot infer a run-rate from zero data points).
 *
 * Gross-burn proxy caveat inherits from `deriveBurnRunRate` (see PENDING note).
 */
export function deriveRunRateFromCashFlows(
  cashFlows: CashFlowStatement[]
): Result<HistoricalRunRate, AppError> {
  if (!Array.isArray(cashFlows) || cashFlows.length === 0) {
    return failure(
      createAppError(
        ERROR_CODES.VALIDATION_ERROR,
        '過去のキャッシュフロー実績が1件もないため、ランレートを推定できません',
        { details: { dataPoints: 0 } }
      )
    )
  }
  const rate = deriveBurnRunRate(cashFlows)
  return success({
    baseMonthlyInflow: rate.avgInflow,
    baseMonthlyOutflow: rate.avgGrossBurn,
    avgNetBurn: rate.avgNetBurn,
    dataPoints: rate.dataPoints,
  })
}
