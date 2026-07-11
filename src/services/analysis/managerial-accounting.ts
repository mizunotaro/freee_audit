/**
 * Managerial accounting — Cost-Volume-Profit (CVP) analysis.
 *
 * Computes contribution margin, break-even point, target-profit volume,
 * margin of safety, and degree of operating leverage from per-unit economics.
 *
 * Standard references (definitional, not repo citations):
 *   - Garrison, Noreen & Brewer, "Managerial Accounting" — CVP analysis,
 *     contribution-margin ratio, break-even, margin of safety, operating
 *     leverage.
 *   - Horngren, Datar & Rajan, "Cost Accounting: A Managerial Emphasis" —
 *     contribution-margin and operating-income relationships.
 *
 * Formulas (all cited above):
 *   ContributionMarginPerUnit = SellingPrice − VariableCostPerUnit
 *   ContributionMarginRatio   = ContributionMarginPerUnit / SellingPrice
 *   BreakEven (units)         = FixedCosts / ContributionMarginPerUnit
 *   BreakEven (sales ¥)       = FixedCosts / ContributionMarginRatio
 *   TargetProfit (units)      = (FixedCosts + TargetProfit) / ContributionMarginPerUnit
 *   MarginOfSafety            = ActualSales − BreakEvenSales
 *   MarginOfSafetyPct         = MarginOfSafety / ActualSales
 *   OperatingLeverage (DOL)   = ContributionMargin / OperatingIncome
 *
 * IMPORTANT — this is financial output. The PR carrying this file MUST be
 * labelled `human-review-required` and `do-not-auto-merge`.
 */
import { z } from 'zod'
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

export const ManagerialCvpInputSchema = z.object({
  sellingPricePerUnit: z.number().finite().nonnegative(),
  variableCostPerUnit: z.number().finite().nonnegative(),
  totalFixedCosts: z.number().finite().nonnegative(),
  unitsSold: z.number().finite().nonnegative().optional(),
  targetProfit: z.number().finite().optional(),
})
export type ManagerialCvpInput = z.infer<typeof ManagerialCvpInputSchema>

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface ManagerialBreakEven {
  units: number | null
  sales: number | null
}

export interface ManagerialTargetProfit {
  units: number | null
  sales: number | null
}

export interface ManagerialMarginOfSafety {
  amount: number | null
  percent: number | null
}

export interface ManagerialTotals {
  sales: number | null
  totalVariableCosts: number | null
  contributionMargin: number | null
  operatingIncome: number | null
}

export interface ManagerialCvpOutput {
  inputs: {
    sellingPricePerUnit: number
    variableCostPerUnit: number
    totalFixedCosts: number
    unitsSold: number | null
    targetProfit: number | null
  }
  contributionMarginPerUnit: number
  contributionMarginRatio: number | null
  breakEvenPoint: ManagerialBreakEven
  targetProfit: ManagerialTargetProfit | null
  marginOfSafety: ManagerialMarginOfSafety
  operatingLeverage: number | null
  totals: ManagerialTotals
  warnings: string[]
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Run a Cost-Volume-Profit analysis from per-unit economics.
 *
 * @param rawInput - { sellingPricePerUnit, variableCostPerUnit, totalFixedCosts,
 *   unitsSold?, targetProfit? }
 * @returns Result<ManagerialCvpOutput, AppError>. Failure only on Zod
 *   validation failure. Mathematically-undefined results (e.g. break-even when
 *   price <= variable cost) are returned as `null` with an explanatory warning
 *   rather than failing — the conservative choice for a review-required output.
 */
export function analyzeCostVolumeProfit(rawInput: unknown): Result<ManagerialCvpOutput, AppError> {
  const parsed = ManagerialCvpInputSchema.safeParse(rawInput)
  if (!parsed.success) {
    return failure(
      createAppError(ERROR_CODES.VALIDATION_ERROR, 'Managerial CVP input validation failed', {
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

  const warnings: string[] = []
  const cmPerUnit = input.sellingPricePerUnit - input.variableCostPerUnit
  const cmRatio = input.sellingPricePerUnit > 0 ? cmPerUnit / input.sellingPricePerUnit : null

  // Break-even requires a positive contribution margin per unit. When price <=
  // variable cost each unit loses money, so no finite break-even exists.
  const breakEvenUnits = cmPerUnit > 0 ? input.totalFixedCosts / cmPerUnit : null
  const breakEvenSales = cmRatio !== null && cmRatio > 0 ? input.totalFixedCosts / cmRatio : null
  if (cmPerUnit <= 0) {
    warnings.push(
      'contribution margin per unit <= 0 (selling price does not exceed variable cost); break-even is not profitable and reported as null'
    )
  }

  // Target-profit volume, only when requested and break-even is defined.
  let targetProfit: ManagerialTargetProfit | null = null
  if (input.targetProfit !== undefined) {
    const tpUnits = cmPerUnit > 0 ? (input.totalFixedCosts + input.targetProfit) / cmPerUnit : null
    const tpSales =
      cmRatio !== null && cmRatio > 0
        ? (input.totalFixedCosts + input.targetProfit) / cmRatio
        : null
    targetProfit = { units: tpUnits, sales: tpSales }
  }

  // Actual-volume figures (require unitsSold).
  const unitsSold = input.unitsSold ?? null
  let sales: number | null = null
  let totalVariableCosts: number | null = null
  let contributionMargin: number | null = null
  let operatingIncome: number | null = null
  let marginOfSafety: ManagerialMarginOfSafety = { amount: null, percent: null }
  let operatingLeverage: number | null = null

  if (unitsSold !== null) {
    sales = input.sellingPricePerUnit * unitsSold
    totalVariableCosts = input.variableCostPerUnit * unitsSold
    contributionMargin = cmPerUnit * unitsSold
    operatingIncome = contributionMargin - input.totalFixedCosts

    if (breakEvenSales !== null) {
      const mosAmount = sales - breakEvenSales
      marginOfSafety = {
        amount: mosAmount,
        percent: sales !== 0 ? (mosAmount / sales) * 100 : null,
      }
    }

    // DOL = CM / OperatingIncome. Undefined when operating income <= 0 (the
    // company is at or below break-even, where leverage is not meaningful).
    if (operatingIncome > 0) {
      operatingLeverage = contributionMargin / operatingIncome
    } else if (contributionMargin !== 0) {
      warnings.push(
        'operating income <= 0; degree of operating leverage is undefined and reported as null'
      )
    }
  } else {
    warnings.push(
      'unitsSold not provided; margin of safety and operating leverage are not computed'
    )
  }

  return success({
    inputs: {
      sellingPricePerUnit: input.sellingPricePerUnit,
      variableCostPerUnit: input.variableCostPerUnit,
      totalFixedCosts: input.totalFixedCosts,
      unitsSold,
      targetProfit: input.targetProfit ?? null,
    },
    contributionMarginPerUnit: cmPerUnit,
    contributionMarginRatio: cmRatio,
    breakEvenPoint: { units: breakEvenUnits, sales: breakEvenSales },
    targetProfit,
    marginOfSafety,
    operatingLeverage,
    totals: { sales, totalVariableCosts, contributionMargin, operatingIncome },
    warnings,
  })
}
