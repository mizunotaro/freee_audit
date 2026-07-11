/**
 * Managerial (management) accounting analysis module.
 *
 * Pure, side-effect-free computations for the contribution-margin / CVP
 * (Cost-Volume-Profit) family of management-accounting techniques:
 *   - cost-behavior split (fixed / variable),
 *   - contribution margin & contribution margin ratio,
 *   - break-even point (sales amount and unit volume),
 *   - CVP summary (margin of safety, degree of operating leverage, target profit),
 *   - segment profitability (segment margin).
 *
 * This module does NOT read the database, journals, or any Class-A data path. Every
 * function is a pure transformation over structured inputs supplied by the caller,
 * mirroring the pattern in {@link `@/services/analytics/financial-kpi`}.
 *
 * All exported helpers return a `Result<T, AppError>` and validate their inputs with
 * `z.safeParse`. Computed numbers are returned unrounded (rounding is a presentation
 * concern); ratio fields are expressed as fractions in the range [0, 1] unless noted.
 *
 * ---
 * Standard references cited inline (definitional, not repo code):
 *   - Horngren, Datar & Rajan, "Cost Accounting: A Managerial Emphasis" (16e), Ch. 3.
 *   - Garrison, Noreen & Brewer, "Managerial Accounting" (17e), Ch. 5 "Cost-Volume-Profit
 *     Relationships" and Ch. 6 "Variable Costing and Segment Reporting".
 *
 * This is financial output. Where the correct treatment is judgemental the code carries a
 * `// PENDING HUMAN DETERMINATION` marker and defaults to the most conservative option.
 */
import { z } from 'zod'
import {
  type AppError,
  type Result,
  ERROR_CODES,
  createAppError,
  failure,
  success,
} from '@/types/result'

/**
 * Cost-behavior classification of a single cost line.
 * - `variable`: total varies in proportion to activity/volume (変動費).
 * - `fixed`:   total is independent of activity/volume within the relevant range (固定費).
 */
export type CostBehavior = 'variable' | 'fixed'

/** A generic account/expense line used as input to cost-behavior classification. */
export interface AccountLine {
  accountCode: string
  accountName: string
  amount: number
}

/** An {@link AccountLine} annotated with its classified cost behavior. */
export interface ClassifiedCostItem extends AccountLine {
  behavior: CostBehavior
}

/**
 * Aggregated CVP inputs expressed in currency (no per-unit data required). This is the
 * form derivable from a P&L (contribution-format) and the basis for sales-amount CVP.
 */
export interface CVPAggregate {
  /** Sales revenue (売上高), ≥ 0 expected but negative (net returns) is tolerated. */
  revenue: number
  /** Total variable costs (変動費). */
  variableCosts: number
  /** Total fixed costs (固定費). */
  fixedCosts: number
}

/** Per-unit CVP inputs, the basis for unit-volume CVP (break-even units, target profit). */
export interface CVPUnitInput {
  /** Selling price per unit (販売単価). */
  sellingPricePerUnit: number
  /** Variable cost per unit (単位変動費). */
  variableCostPerUnit: number
  /** Total fixed costs for the period (固定費). */
  fixedCosts: number
  /** Optional actual/budgeted sales volume (販売量), enabling margin-of-safety & DOL. */
  volume?: number
  /** Optional target net operating income for target-profit volume (目標利益). */
  targetProfit?: number
}

/**
 * A reportable business segment for segment-profitability analysis. Common (non-traceable)
 * fixed costs are NOT allocated to segments; they are handled at the company level.
 */
export interface SegmentInput {
  segmentId: string
  segmentName: string
  revenue: number
  variableCosts: number
  /** Fixed costs traceable to this segment (当該セグメント直接固定費). */
  traceableFixedCosts: number
}

// ---------------------------------------------------------------------------
// Zod input schemas
// ---------------------------------------------------------------------------

const finiteNumber = z.number().finite({ message: 'must be a finite number' })

const accountLineSchema = z.object({
  accountCode: z.string().min(1),
  accountName: z.string(),
  amount: finiteNumber,
})

const classifyOptionsSchema = z
  .object({
    overrides: z.record(z.enum(['variable', 'fixed'])).optional(),
  })
  .optional()

const cvpAggregateSchema = z.object({
  revenue: finiteNumber,
  variableCosts: finiteNumber,
  fixedCosts: finiteNumber,
})

const cvpUnitSchema = z.object({
  sellingPricePerUnit: finiteNumber,
  variableCostPerUnit: finiteNumber,
  fixedCosts: finiteNumber,
  volume: finiteNumber.min(0).optional(),
  targetProfit: finiteNumber.optional(),
})

const segmentSchema = z.object({
  segmentId: z.string().min(1),
  segmentName: z.string(),
  revenue: finiteNumber,
  variableCosts: finiteNumber,
  traceableFixedCosts: finiteNumber,
})

const segmentProfitabilitySchema = z.object({
  segments: z.array(segmentSchema).min(1),
  commonFixedCosts: finiteNumber.optional(),
})

// Minimal projection of ProfitLoss — only the arrays this module consumes. Zod objects
// are non-strict by default, so the full ProfitLoss object passes through safely.
const profitLossProjectionSchema = z.object({
  revenue: z.array(z.object({ amount: finiteNumber })).default([]),
  costOfSales: z.array(z.object({ amount: finiteNumber })).default([]),
  sgaExpenses: z.array(z.object({ amount: finiteNumber })).default([]),
})

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

/** Result of the contribution-margin computation. */
export interface ContributionMarginResult {
  revenue: number
  variableCosts: number
  /** Contribution margin (限界利益) = revenue − variableCosts. */
  contributionMargin: number
  /**
   * Contribution-margin ratio (限界利益率) as a fraction = contributionMargin / revenue.
   * `null` when revenue is 0 (undefined ratio), otherwise in [-∞, 1].
   */
  contributionMarginRatio: number | null
}

/** Result of a sales-amount break-even computation. */
export interface BreakEvenResult {
  /**
   * Break-even sales (損益分岐点売上高) = fixedCosts / contributionMarginRatio.
   * `null` when there is no finite break-even (contribution-margin ratio ≤ 0: each
   * additional unit of sales reduces profit).
   */
  breakEvenSales: number | null
  /** True when a finite break-even sales amount exists. */
  defined: boolean
  /** Present (and defined === false) when break-even is mathematically undefined. */
  reason?: string
  contributionMargin: number
  contributionMarginRatio: number | null
}

/** Result of a unit-volume break-even / CVP computation. */
export interface CVPAnalysis {
  contributionMarginPerUnit: number
  /** Contribution-margin ratio (fraction); null when selling price is 0. */
  contributionMarginRatio: number | null
  /** Break-even volume in units; null when no finite break-even (CM/unit ≤ 0). */
  breakEvenVolume: number | null
  /** Break-even sales amount (breakEvenVolume × sellingPricePerUnit); null when undefined. */
  breakEvenSales: number | null
  /** True when a finite break-even exists. */
  defined: boolean
  reason?: string
  /** Sales volume needed to reach {@link CVPUnitInput.targetProfit}; null when undefined or omitted. */
  targetProfitVolume: number | null
  /** Actual/budgeted sales amount; present only when {@link CVPUnitInput.volume} was given. */
  actualSales?: number
  /** Margin of safety amount (安全余裕額) = actualSales − breakEvenSales; present only with volume. */
  marginOfSafetyAmount?: number | null
  /** Margin of safety ratio (安全余裕率, fraction); present only with volume. */
  marginOfSafetyRatio?: number | null
  /** Net operating income (営業利益) at the given volume; present only with volume. */
  operatingIncome?: number
  /**
   * Degree of operating leverage (営業レバレッジ, DOL) = contributionMargin / operatingIncome.
   * `null` at break-even (operatingIncome === 0) where DOL is undefined.
   */
  degreeOfOperatingLeverage?: number | null
}

/** Per-segment profitability breakdown. */
export interface SegmentAnalysis {
  segmentId: string
  segmentName: string
  revenue: number
  variableCosts: number
  /** Segment contribution margin (セグメント限界利益) = revenue − variableCosts. */
  contributionMargin: number
  /** Contribution-margin ratio (fraction); null when segment revenue is 0. */
  contributionMarginRatio: number | null
  traceableFixedCosts: number
  /**
   * Segment margin (セグメント利益) = contributionMargin − traceableFixedCosts. This is the
   * standard "segment margin" used to judge long-run segment profitability.
   */
  segmentMargin: number
  /** Segment-margin ratio (fraction); null when segment revenue is 0. */
  segmentMarginRatio: number | null
}

/** Company-level segment-profitability rollup. */
export interface SegmentProfitabilityResult {
  segments: SegmentAnalysis[]
  totals: {
    revenue: number
    variableCosts: number
    contributionMargin: number
    traceableFixedCosts: number
    segmentMargin: number
  }
  commonFixedCosts: number
  /**
   * Company net operating income = total segment margin − common fixed costs
   * (共通固定費はセグメント間で配賦せず会社レベルで控除).
   */
  companyNetOperatingIncome: number
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Ratio helper that returns `null` when the denominator is 0 or non-finite (i.e. the ratio
 * is undefined), rather than 0 — distinguishing "0%" from "undefined".
 */
function safeRatio(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(denominator) || denominator === 0) return null
  const r = numerator / denominator
  return Number.isFinite(r) ? r : null
}

function toAppError(message: string, details?: Record<string, unknown>): AppError {
  return createAppError(ERROR_CODES.VALIDATION_ERROR, message, details ? { details } : undefined)
}

function fromZodError(error: z.ZodError): AppError {
  return toAppError('Invalid managerial-accounting input', {
    issues: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
  })
}

// ---------------------------------------------------------------------------
// 1. Cost-behavior split (fixed / variable)
// ---------------------------------------------------------------------------

/**
 * Default account-code-prefix → cost-behavior map, following the freee/JGAAP account-code
 * layout also used elsewhere in this repo (4xx revenue, 5xx cost of sales, 6xx/7xx SGA).
 *
 * PENDING HUMAN DETERMINATION: cost behavior is a per-business management judgement. This
 * default applies the standard introductory simplification (the "contribution approach" of
 * Garrison Noreen Brewer, Managerial Accounting, Ch. 5): cost of sales is treated as
 * variable and selling & administrative period costs as fixed. Review and override before
 * relying on it.
 */
const DEFAULT_COST_BEHAVIOR_PREFIXES: Array<{ prefixes: string[]; behavior: CostBehavior }> = [
  { prefixes: ['5'], behavior: 'variable' }, // 売上原価 / cost of sales
  { prefixes: ['6', '7'], behavior: 'fixed' }, // 販売費および一般管理費 / SGA
]

function defaultBehaviorForCode(accountCode: string): CostBehavior {
  for (const rule of DEFAULT_COST_BEHAVIOR_PREFIXES) {
    if (rule.prefixes.some((p) => accountCode.startsWith(p))) return rule.behavior
  }
  // Conservative default for unrecognized codes: fixed. A cost misclassified as fixed
  // understates contribution margin (a safer error than overstating it).
  return 'fixed'
}

/**
 * Classifies a list of account/expense lines into variable vs. fixed cost behavior.
 *
 * PENDING HUMAN DETERMINATION: see {@link DEFAULT_COST_BEHAVIOR_PREFIXES}. Supply
 * `overrides` keyed by account code to correct the default split per business judgement.
 *
 * @param lines - Account/expense lines to classify.
 * @param options.overrides - Per-account-code override (`{ '5110': 'fixed' }`).
 * @returns `success` with one {@link ClassifiedCostItem} per input line, or
 *   `failure(VALIDATION_ERROR)` if the input fails schema validation.
 */
export function classifyCostBehavior(
  lines: AccountLine[],
  options?: { overrides?: Record<string, CostBehavior> }
): Result<ClassifiedCostItem[], AppError> {
  const linesParse = z.array(accountLineSchema).safeParse(lines)
  if (!linesParse.success) return failure(fromZodError(linesParse.error))
  const optsParse = classifyOptionsSchema.safeParse(options)
  if (!optsParse.success) return failure(fromZodError(optsParse.error))

  const overrides = optsParse.data?.overrides ?? {}
  const classified: ClassifiedCostItem[] = linesParse.data.map((line) => {
    const behavior = overrides[line.accountCode] ?? defaultBehaviorForCode(line.accountCode)
    return { ...line, behavior }
  })
  return success(classified)
}

/**
 * Builds aggregated CVP inputs (revenue / variable / fixed) from a P&L statement using the
 * conservative cost-behavior default: cost of sales → variable, SGA → fixed.
 *
 * PENDING HUMAN DETERMINATION: the default split is a simplification (see
 * {@link classifyCostBehavior}). Non-operating items (営業外収益/費用, 特別損益) and income tax
 * are intentionally excluded — CVP models operating profit only. Override the split upstream
 * via {@link classifyCostBehavior} + a manual aggregate if a different split is required.
 *
 * @param pl - P&L statement (only revenue / costOfSales / sgaExpenses are read).
 * @returns `success` with the aggregate, or `failure(VALIDATION_ERROR)` on schema failure.
 */
export function buildCVPAggregateFromProfitLoss(pl: unknown): Result<CVPAggregate, AppError> {
  const parsed = profitLossProjectionSchema.safeParse(pl)
  if (!parsed.success) return failure(fromZodError(parsed.error))

  const revenue = parsed.data.revenue.reduce((s, r) => s + r.amount, 0)
  const variableCosts = parsed.data.costOfSales.reduce((s, c) => s + c.amount, 0)
  const fixedCosts = parsed.data.sgaExpenses.reduce((s, e) => s + e.amount, 0)
  return success({ revenue, variableCosts, fixedCosts })
}

// ---------------------------------------------------------------------------
// 2. Contribution margin
// ---------------------------------------------------------------------------

/**
 * Computes the contribution margin and contribution-margin ratio.
 *
 * Definition: Contribution Margin (限界利益) = Sales Revenue − Variable Costs.
 *   Source: Horngren, Datar & Rajan, "Cost Accounting: A Managerial Emphasis" (16e), Ch. 3;
 *           Garrison, Noreen & Brewer, "Managerial Accounting" (17e), Ch. 5.
 *
 * @param input - Aggregate CVP inputs (revenue, variableCosts, fixedCosts).
 *   `fixedCosts` is accepted for symmetry but does not affect the contribution margin.
 * @returns `success` with the margin and ratio, or `failure(VALIDATION_ERROR)`.
 */
export function calculateContributionMargin(
  input: CVPAggregate
): Result<ContributionMarginResult, AppError> {
  const parsed = cvpAggregateSchema.safeParse(input)
  if (!parsed.success) return failure(fromZodError(parsed.error))

  const { revenue, variableCosts } = parsed.data
  const contributionMargin = revenue - variableCosts
  const contributionMarginRatio = safeRatio(contributionMargin, revenue)
  return success({
    revenue,
    variableCosts,
    contributionMargin,
    contributionMarginRatio,
  })
}

// ---------------------------------------------------------------------------
// 3. Break-even (sales amount) + CVP (unit volume)
// ---------------------------------------------------------------------------

/**
 * Computes the break-even point in sales amount from aggregate inputs.
 *
 * Definition: Break-even Sales (損益分岐点売上高) = Fixed Costs ÷ Contribution-Margin Ratio.
 *   Source: Garrison, Noreen & Brewer, "Managerial Accounting" (17e), Ch. 5.
 *
 * The break-even is undefined (`defined: false`, `breakEvenSales: null`) when the
 * contribution-margin ratio is ≤ 0 — i.e. variable costs meet or exceed revenue, so each
 * unit of sales does not contribute to covering fixed costs and no finite break-even exists.
 *
 * @param input - Aggregate CVP inputs.
 * @returns `success` with the break-even result, or `failure(VALIDATION_ERROR)`.
 */
export function calculateBreakEvenPoint(input: CVPAggregate): Result<BreakEvenResult, AppError> {
  const parsed = cvpAggregateSchema.safeParse(input)
  if (!parsed.success) return failure(fromZodError(parsed.error))

  const { revenue, variableCosts, fixedCosts } = parsed.data
  const contributionMargin = revenue - variableCosts
  const contributionMarginRatio = safeRatio(contributionMargin, revenue)

  if (contributionMarginRatio === null || contributionMarginRatio <= 0) {
    return success({
      breakEvenSales: null,
      defined: false,
      reason:
        contributionMarginRatio === null
          ? 'contribution-margin ratio undefined (revenue is 0)'
          : 'contribution-margin ratio ≤ 0; no finite break-even (each sale reduces profit)',
      contributionMargin,
      contributionMarginRatio,
    })
  }

  return success({
    breakEvenSales: fixedCosts / contributionMarginRatio,
    defined: true,
    contributionMargin,
    contributionMarginRatio,
  })
}

/**
 * Comprehensive CVP analysis from per-unit inputs: break-even (units & sales), target-profit
 * volume, and — when `volume` is supplied — margin of safety and degree of operating leverage.
 *
 * Definitions (Garrison, Noreen & Brewer, "Managerial Accounting" (17e), Ch. 5):
 *   - Contribution margin per unit = selling price − variable cost per unit.
 *   - Break-even volume = fixed costs ÷ contribution margin per unit.
 *   - Target-profit volume = (fixed costs + target profit) ÷ contribution margin per unit.
 *   - Margin of safety = actual(−budgeted) sales − break-even sales (amount and ratio).
 *   - Degree of operating leverage (DOL) = contribution margin ÷ net operating income.
 *
 * @param input - Per-unit CVP inputs.
 * @returns `success` with the analysis, or `failure(VALIDATION_ERROR)`.
 */
export function analyzeCVP(input: CVPUnitInput): Result<CVPAnalysis, AppError> {
  const parsed = cvpUnitSchema.safeParse(input)
  if (!parsed.success) return failure(fromZodError(parsed.error))

  const { sellingPricePerUnit, variableCostPerUnit, fixedCosts, volume, targetProfit } = parsed.data
  const cmPerUnit = sellingPricePerUnit - variableCostPerUnit
  const cmRatio = safeRatio(cmPerUnit, sellingPricePerUnit)

  const defined = cmPerUnit > 0
  const breakEvenVolume = defined ? fixedCosts / cmPerUnit : null
  const breakEvenSales = defined ? breakEvenVolume! * sellingPricePerUnit : null
  const reason = defined ? undefined : 'contribution margin per unit ≤ 0; no finite break-even'

  const targetProfitVolume =
    targetProfit !== undefined && defined ? (fixedCosts + targetProfit) / cmPerUnit : null

  const result: CVPAnalysis = {
    contributionMarginPerUnit: cmPerUnit,
    contributionMarginRatio: cmRatio,
    breakEvenVolume,
    breakEvenSales,
    defined,
    reason,
    targetProfitVolume,
  }

  if (volume !== undefined) {
    const actualSales = volume * sellingPricePerUnit
    const operatingIncome = cmPerUnit * volume - fixedCosts
    result.actualSales = actualSales
    result.operatingIncome = operatingIncome
    if (defined) {
      result.marginOfSafetyAmount = actualSales - breakEvenSales!
      result.marginOfSafetyRatio = safeRatio(actualSales - breakEvenSales!, actualSales)
    } else {
      result.marginOfSafetyAmount = null
      result.marginOfSafetyRatio = null
    }
    // DOL = total contribution margin / net operating income. Undefined at break-even
    // (operating income = 0).
    const totalContributionMargin = cmPerUnit * volume
    result.degreeOfOperatingLeverage =
      operatingIncome !== 0 ? safeRatio(totalContributionMargin, operatingIncome) : null
  }

  return success(result)
}

// ---------------------------------------------------------------------------
// 4. Segment profitability
// ---------------------------------------------------------------------------

/**
 * Computes segment profitability for a set of business segments and a company-level rollup.
 *
 * Definitions (Horngren, Datar & Rajan, "Cost Accounting" (16e), Ch. 3 "Cost-Volume-Profit
 * Analysis"; Garrison, Noreen & Brewer, "Managerial Accounting" (17e), Ch. 6 "Segment
 * Reporting"):
 *   - Segment contribution margin = segment revenue − segment variable costs.
 *   - Segment margin = segment contribution margin − traceable (direct) fixed costs.
 *   - Company net operating income = Σ segment margins − common (non-traceable) fixed costs.
 *
 * Common fixed costs are NOT allocated to segments (allocation would distort segment
 * margins and is itself judgemental — PENDING HUMAN DETERMINATION if an allocation basis is
 * ever required).
 *
 * @param input - Non-empty list of segments and optional company common fixed costs.
 * @returns `success` with per-segment analyses and the rollup, or `failure(VALIDATION_ERROR)`.
 */
export function analyzeSegmentProfitability(input: {
  segments: SegmentInput[]
  commonFixedCosts?: number
}): Result<SegmentProfitabilityResult, AppError> {
  const parsed = segmentProfitabilitySchema.safeParse(input)
  if (!parsed.success) return failure(fromZodError(parsed.error))

  const commonFixedCosts = parsed.data.commonFixedCosts ?? 0

  const segments: SegmentAnalysis[] = parsed.data.segments.map((seg) => {
    const contributionMargin = seg.revenue - seg.variableCosts
    const contributionMarginRatio = safeRatio(contributionMargin, seg.revenue)
    const segmentMargin = contributionMargin - seg.traceableFixedCosts
    const segmentMarginRatio = safeRatio(segmentMargin, seg.revenue)
    return {
      segmentId: seg.segmentId,
      segmentName: seg.segmentName,
      revenue: seg.revenue,
      variableCosts: seg.variableCosts,
      contributionMargin,
      contributionMarginRatio,
      traceableFixedCosts: seg.traceableFixedCosts,
      segmentMargin,
      segmentMarginRatio,
    }
  })

  const totals = segments.reduce(
    (acc, s) => {
      acc.revenue += s.revenue
      acc.variableCosts += s.variableCosts
      acc.contributionMargin += s.contributionMargin
      acc.traceableFixedCosts += s.traceableFixedCosts
      acc.segmentMargin += s.segmentMargin
      return acc
    },
    {
      revenue: 0,
      variableCosts: 0,
      contributionMargin: 0,
      traceableFixedCosts: 0,
      segmentMargin: 0,
    }
  )

  const companyNetOperatingIncome = totals.segmentMargin - commonFixedCosts

  return success({
    segments,
    totals,
    commonFixedCosts,
    companyNetOperatingIncome,
  })
}
