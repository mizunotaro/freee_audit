/**
 * Cash-flow scenario projection ("what-if") — runway / burn-rate under
 * optimistic, realistic, and pessimistic net-cash-flow assumptions.
 *
 * This complements the existing `runway-calculator` (reused here for the
 * alert thresholds). The existing `calculateRunway` clamps scenario
 * adjustments to [0.5, 2.0] and rejects adjustments without a stated reason —
 * a product guard, not a formula. For an explicit user-driven what-if this
 * guard is inappropriate, so this module owns the projection math with cited,
 * override-free formulas and reuses only `getRunwayAlert` (presentation).
 *
 * Standard references (definitional):
 *   - "Cash runaway / months of runway" (standard startup-financing metric):
 *       Runway (months) = CurrentCash / BurnRate , when BurnRate > 0
 *       BurnRate         = |average monthly net cash outflow|
 *   - Garrison, Noreen & Brewer, "Managerial Accounting" — cash-budget /
 *     financing-need projection.
 *
 * IMPORTANT — this is financial output. The PR carrying this file MUST be
 * labelled `human-review-required` and `do-not-auto-merge`.
 */
import { z } from 'zod'
import { sumValues } from '@/lib/utils'
import { getRunwayAlert } from '@/services/cashflow/runway-calculator'
import {
  type Result,
  type AppError,
  ERROR_CODES,
  createAppError,
  success,
  failure,
} from '@/types/result'

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

export const CashflowScenarioAdjustmentsSchema = z
  .object({
    // PENDING HUMAN DETERMINATION: scenario semantics. An adjustment is a
    // multiplier applied to the average monthly NET cash flow:
    //   monthlyNet_scenario = baseMonthlyNet × adjustment
    // For a cash-burning company (baseMonthlyNet < 0), adjustment > 1 burns
    // faster (pessimistic) and adjustment < 1 burns slower (optimistic). This
    // is the conservative, unambiguous definition; optimistic <= realistic
    // <= pessimistic is enforced below.
    optimistic: z.number().finite().positive(),
    realistic: z.number().finite().positive().default(1),
    pessimistic: z.number().finite().positive(),
  })
  .optional()

export const CashflowScenarioInputSchema = z.object({
  currentCash: z.number().finite(),
  // Historical/expected monthly NET operating cash flow. Negative = cash burn.
  monthlyNetCashFlows: z.array(z.number().finite()).min(1),
  // Projection length in months. PENDING HUMAN DETERMINATION default 12.
  horizonMonths: z.number().int().min(1).max(60).default(12),
  adjustments: CashflowScenarioAdjustmentsSchema,
})
export type CashflowScenarioInput = z.infer<typeof CashflowScenarioInputSchema>

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface CashflowProjectionMonth {
  month: number
  beginningCash: number
  netCashFlow: number
  endingCash: number
}

export interface CashflowScenarioResult {
  name: 'optimistic' | 'realistic' | 'pessimistic'
  adjustment: number
  monthlyNetCashFlow: number
  burnRate: number
  runwayMonths: number | null
  projection: CashflowProjectionMonth[]
}

export interface CashflowScenarioOutput {
  currentCash: number
  baseMonthlyNetCashFlow: number
  baseBurnRate: number
  dataPoints: number
  scenarios: CashflowScenarioResult[]
  alert: ReturnType<typeof getRunwayAlert>
}

export const DEFAULT_ADJUSTMENTS = {
  optimistic: 0.8,
  realistic: 1,
  pessimistic: 1.2,
} as const

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Project the cash balance month-by-month under a fixed monthly net cash flow
 * and return the projection plus the runway (first month ending cash <= 0).
 *
 * Runway is interpolated to a fractional month for precision:
 *   if endingCash crosses zero between month t-1 and t:
 *     runwayMonths = (t - 1) + |beginningCash_t| / |netCashFlow_t|
 * Cash-flow-positive scenarios (never cross zero within horizon) -> null
 * (runway is effectively infinite / not applicable).
 */
function projectScenario(
  currentCash: number,
  monthlyNet: number,
  horizonMonths: number
): { projection: CashflowProjectionMonth[]; runwayMonths: number | null } {
  const projection: CashflowProjectionMonth[] = []
  let cash = currentCash
  let runwayMonths: number | null = null

  for (let month = 1; month <= horizonMonths; month++) {
    const beginningCash = cash
    const endingCash = cash + monthlyNet
    projection.push({ month, beginningCash, netCashFlow: monthlyNet, endingCash })

    if (runwayMonths === null && endingCash <= 0) {
      // Fractional interpolation across the crossing month.
      runwayMonths =
        monthlyNet === 0 ? month : month - 1 + Math.abs(beginningCash) / Math.abs(monthlyNet)
    }
    cash = endingCash
  }

  return { projection, runwayMonths }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Project cash position under three scenarios and derive runway for each.
 *
 * @param rawInput - { currentCash, monthlyNetCashFlows[], horizonMonths?, adjustments? }
 * @returns Result<CashflowScenarioOutput, AppError>. Failure only on Zod
 *   validation failure (including an incoherent adjustment ordering).
 */
export function projectCashflowScenario(
  rawInput: unknown
): Result<CashflowScenarioOutput, AppError> {
  const parsed = CashflowScenarioInputSchema.safeParse(rawInput)
  if (!parsed.success) {
    return failure(
      createAppError(ERROR_CODES.VALIDATION_ERROR, 'Cash-flow scenario input validation failed', {
        details: {
          errors: parsed.error.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
            code: e.code,
          })),
        },
      })
    )
  }
  const input = parsed.data

  const adjustments = {
    optimistic: input.adjustments?.optimistic ?? DEFAULT_ADJUSTMENTS.optimistic,
    realistic: input.adjustments?.realistic ?? DEFAULT_ADJUSTMENTS.realistic,
    pessimistic: input.adjustments?.pessimistic ?? DEFAULT_ADJUSTMENTS.pessimistic,
  }

  // Conservative ordering guard: optimistic must not burn faster than
  // pessimistic. For a burning company (net < 0) this means
  // optimistic <= realistic <= pessimistic; the same inequality holds for a
  // cash-positive company and is harmless there.
  if (
    adjustments.optimistic > adjustments.realistic ||
    adjustments.realistic > adjustments.pessimistic
  ) {
    return failure(
      createAppError(
        ERROR_CODES.VALIDATION_ERROR,
        'Scenario adjustments must satisfy optimistic <= realistic <= pessimistic',
        { details: { adjustments } }
      )
    )
  }

  const baseMonthlyNet = sumValues(input.monthlyNetCashFlows) / input.monthlyNetCashFlows.length
  // Burn rate is the magnitude of the average monthly outflow (net < 0 only).
  const baseBurnRate = baseMonthlyNet < 0 ? Math.abs(baseMonthlyNet) : 0

  const scenarioSpecs = [
    { name: 'optimistic', adjustment: adjustments.optimistic },
    { name: 'realistic', adjustment: adjustments.realistic },
    { name: 'pessimistic', adjustment: adjustments.pessimistic },
  ] as const

  const scenarios: CashflowScenarioResult[] = scenarioSpecs.map((spec) => {
    const monthlyNet = baseMonthlyNet * spec.adjustment
    const burnRate = monthlyNet < 0 ? Math.abs(monthlyNet) : 0
    const { projection, runwayMonths } = projectScenario(
      input.currentCash,
      monthlyNet,
      input.horizonMonths
    )
    return {
      name: spec.name,
      adjustment: spec.adjustment,
      monthlyNetCashFlow: monthlyNet,
      burnRate,
      runwayMonths,
      projection,
    }
  })

  const realistic = scenarios.find((s) => s.name === 'realistic')!
  const alertRunway = realistic.runwayMonths ?? 999
  const alert = getRunwayAlert(alertRunway)

  return success({
    currentCash: input.currentCash,
    baseMonthlyNetCashFlow: baseMonthlyNet,
    baseBurnRate,
    dataPoints: input.monthlyNetCashFlows.length,
    scenarios,
    alert,
  })
}
