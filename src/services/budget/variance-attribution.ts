import { z } from 'zod'
import {
  success,
  failure,
  createAppError,
  ERROR_CODES,
  type Result,
  type AppError,
} from '@/types/result'

/**
 * FIN-IMPL-01 — Journal-level budget-variance attribution (予実要因分析).
 *
 * Implements the methodology in docs/proposals/fin-design-01-variance-attribution.md:
 *   - Layer A: per-account static-budget variance decomposed into a computable driver
 *     taxonomy (timing / outlier / run_rate / new_unbudgeted / absence / unreconciled /
 *     immaterial).
 *   - Layer B: per-account journal ranking by deviation from an expected amount (M0
 *     uniform spread), with contributions that reconcile to the account variance.
 *
 * Standard variance-analysis framework: Horngren, Datar & Rajan, *Cost Accounting: A
 * Managerial Emphasis*; Garrison, Noreen & Brewer, *Managerial Accounting* (Level 1
 * static-budget variance; Level 2 flexible/activity; Level 3 price/efficiency; revenue
 * price/volume/mix). Only the Level-1 + journal-deviation layer is computable from
 * persisted data; Levels 2/3 and full PVVM require quantity/unit-price + partner/segment
 * dimensions that the Journal model does not store (proposal §4.3, §7.1–7.2) and are
 * therefore `PENDING HUMAN DETERMINATION`.
 *
 * This module is the PURE attribution core. It performs no I/O and imports no Prisma
 * client; all data (actuals, budgets, journals already resolved to an account + side)
 * is passed in. The async DB loader lives in `variance-attribution-loader.ts`.
 *
 * Reconciliation identity (proposal §6.5), enforced by construction:
 *   `StaticVariance_a = (Σ deviation_j) + ReconciliationGap_a`
 * where `deviation_j = signedAmount_j − expected_j`, `expected_j = Budget_a / |J_a|`
 * (M0, so Σ expected_j = Budget_a when |J_a| > 0), and
 * `ReconciliationGap_a = Actual_a − Σ signedAmount_j`. Every driver `amount` therefore
 * sums (with `unreconciled`) to `variance`.
 */

// ---------------------------------------------------------------------------
// Sign convention (proposal §3, §6.2)
// ---------------------------------------------------------------------------

/**
 * P&L direction of an account. Drives the favorable/unfavorable classification:
 *   - `revenue`: favorable when `actual > budget` (over budget is good).
 *   - `expense`: favorable when `actual < budget` (under budget is good).
 *
 * `PENDING HUMAN DETERMINATION`: the existing services label variances "over/under" by
 * raw sign only, which is ambiguous for expenses (an expense over-run is unfavorable but
 * coded identically to a favorable revenue over-run). This classification corrects that.
 */
export type SignConvention = 'revenue' | 'expense'

/**
 * Classifies an account's category into its P&L sign convention. Revenue accounts are
 * favorable when actual exceeds budget; cost-of-sales and SGA expenses are favorable
 * when actual is below budget.
 *
 * @param category - P&L category (`revenue` | `cost_of_sales` | `sga_expense`).
 * @returns `revenue` for revenue accounts, `expense` otherwise.
 */
export function signConventionForCategory(
  category: 'revenue' | 'cost_of_sales' | 'sga_expense'
): SignConvention {
  return category === 'revenue' ? 'revenue' : 'expense'
}

/**
 * Classifies a variance as favorable / unfavorable / neutral per the standard sign
 * convention (proposal §3, §6.2). A variance is *favorable (F)* when it increases
 * operating income relative to budget; *unfavorable (U)* otherwise.
 *
 * @param actual - Actual amount for the account/period.
 * @param budget - Budgeted amount for the account/period.
 * @param signConvention - P&L direction of the account.
 * @returns `true` (favorable), `false` (unfavorable), or `null` (zero variance).
 */
export function classifyFavorable(
  actual: number,
  budget: number,
  signConvention: SignConvention
): boolean | null {
  const variance = actual - budget
  if (variance === 0) return null
  if (signConvention === 'revenue') return variance > 0
  return variance < 0
}

/**
 * Signs a journal amount to the account's natural P&L direction (proposal §6.4 step 1).
 *
 * Double-entry convention: a *credit* to a revenue account increases revenue; a *debit*
 * to an expense account increases expense. `signedAmount` is therefore positive when the
 * journal increases the account's P&L magnitude and negative when it decreases it (e.g.
 * a sales return debiting revenue, or an expense rebate crediting an expense). With this
 * signing, `Σ signedAmount_j ≈ Actual_a` (the residual is the reconciliation gap, §6.5).
 *
 * @param amount - Raw journal amount (always a positive magnitude on the Journal row).
 * @param side - Which side of the journal resolves to the account being attributed.
 * @param signConvention - P&L direction of the account.
 * @returns The signed amount in the account's natural direction.
 */
export function signJournalAmount(
  amount: number,
  side: 'debit' | 'credit',
  signConvention: SignConvention
): number {
  if (signConvention === 'revenue') return side === 'credit' ? amount : -amount
  return side === 'debit' ? amount : -amount
}

// ---------------------------------------------------------------------------
// Expected-amount model M0 (proposal §6.4 step 2, model M0)
// ---------------------------------------------------------------------------

/**
 * M0 (uniform spread) expected amount per journal: `Budget_a / |J_a|`. This is the only
 * zero-data expected-amount model; M1 (temporal), M2 (prior-year), and M3 (driver-based
 * PVVM) require dimensions the Journal model does not persist and are
 * `PENDING HUMAN DETERMINATION`.
 *
 * @param budget - Budgeted amount for the account.
 * @param journalCount - Number of journals resolved to the account in the period.
 * @returns Expected amount per journal, or `0` when there are no journals.
 */
export function expectedAmountUniform(budget: number, journalCount: number): number {
  if (journalCount <= 0) return 0
  return budget / journalCount
}

// ---------------------------------------------------------------------------
// Outlier detection (z-score, proposal §6.1, §6.4 step 3)
// ---------------------------------------------------------------------------

/**
 * Computes population z-scores for a set of values. Returns `null` per entry when the
 * distribution has fewer than 2 points or zero standard deviation (an outlier cannot be
 * defined on a degenerate distribution).
 *
 * `PENDING HUMAN DETERMINATION`: population (n) vs sample (n−1) standard deviation, and
 * the outlier threshold (default 2.5). Defaults are conservative starting points.
 *
 * @param values - Signed journal amounts for one account.
 * @returns Z-score per value, or `null` where undefined.
 */
export function computeZScores(values: number[]): (number | null)[] {
  const n = values.length
  if (n < 2) return values.map(() => null)
  const mean = values.reduce((sum, v) => sum + v, 0) / n
  const variance = values.reduce((sum, v) => sum + (v - mean) * (v - mean), 0) / n
  const sigma = Math.sqrt(variance)
  if (sigma === 0) return values.map(() => null)
  return values.map((v) => (v - mean) / sigma)
}

// ---------------------------------------------------------------------------
// Materiality (proposal §6.2)
// ---------------------------------------------------------------------------

/**
 * Materiality threshold: `max(absoluteFloor, pctOfRevenue × totalRevenue)`. Variances
 * below this are aggregated into a single `immaterial` bucket and not exploded to
 * journals. `PENDING HUMAN DETERMINATION` on the floor and percentage.
 *
 * @param totalRevenue - Total actual revenue across revenue accounts (materiality base).
 * @param opts - Resolved attribution options.
 * @returns The materiality threshold (currency units).
 */
export function materialityThreshold(
  totalRevenue: number,
  opts: Required<AttributionOptions>
): number {
  return Math.max(opts.materialityAbsoluteFloor, opts.materialityPctOfRevenue * totalRevenue)
}

// ---------------------------------------------------------------------------
// Timing / period-boundary detection (proposal §6.3)
// ---------------------------------------------------------------------------

/**
 * Detects whether a journal's entry date is on the first or last day of the attributed
 * period (cut-off / period-boundary signal, proposal §6.3). Reversing-pair detection is
 * `PENDING HUMAN DETERMINATION` and not implemented; only the boundary heuristic is used.
 *
 * `PENDING HUMAN DETERMINATION`: assumes `fiscalYear`/`month` are calendar-aligned
 * (month = calendar month of `fiscalYear`). Fiscal-year-start handling is out of scope.
 *
 * @param entryDate - ISO date string `yyyy-mm-dd`.
 * @param fiscalYear - Fiscal year (assumed calendar-aligned).
 * @param month - Period month (1-12).
 * @returns `true` if the date is the first or last calendar day of the period.
 */
export function isPeriodBoundary(entryDate: string, fiscalYear: number, month: number): boolean {
  const parts = entryDate.slice(0, 10).split('-')
  if (parts.length !== 3) return false
  const y = Number(parts[0])
  const m = Number(parts[1])
  const d = Number(parts[2])
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return false
  if (y !== fiscalYear || m !== month) return false
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return d === 1 || d === lastDay
}

// ---------------------------------------------------------------------------
// Driver taxonomy (proposal §6.1, §6.3)
// ---------------------------------------------------------------------------

/**
 * Named variance drivers. The full price/volume/mix split is NOT computable on persisted
 * data (no quantity/unit-price or partner dimension); the combined volume×price effect
 * that cannot be split is reported as the `run_rate` residual.
 */
export type VarianceDriver =
  | 'timing'
  | 'outlier'
  | 'run_rate'
  | 'new_unbudgeted'
  | 'absence'
  | 'unreconciled'
  | 'immaterial'

/**
 * Classifies a single journal's driver tag. Precedence: `new_unbudgeted` (account has no
 * budget) > `outlier` (|z| ≥ threshold) > `timing` (period-boundary date) > `run_rate`
 * (residual). `PENDING HUMAN DETERMINATION` on this precedence ordering.
 *
 * @param params - z-score, boundary flag, and whether the account has a zero budget.
 * @param opts - Resolved attribution options.
 * @returns The driver tag for the journal.
 */
export function classifyJournalDriver(
  params: { zScore: number | null; isBoundary: boolean; budgetZero: boolean },
  opts: Required<AttributionOptions>
): VarianceDriver {
  if (params.budgetZero) return 'new_unbudgeted'
  if (params.zScore !== null && Math.abs(params.zScore) >= opts.outlierZThreshold) {
    return 'outlier'
  }
  if (params.isBoundary) return 'timing'
  return 'run_rate'
}

// ---------------------------------------------------------------------------
// Input schemas (Zod) — validated with safeParse (proposal: Result + Zod)
// ---------------------------------------------------------------------------

const JournalEntrySchema = z.object({
  journalId: z.string().min(1),
  freeeJournalId: z.string().nullable().optional(),
  entryDate: z.string().min(1),
  description: z.string(),
  amount: z.number(),
  /** Which side of the double-entry journal resolves to the account being attributed. */
  side: z.enum(['debit', 'credit']),
})

const AccountAttributionInputSchema = z.object({
  accountCode: z.string().min(1),
  accountName: z.string(),
  category: z.enum(['revenue', 'cost_of_sales', 'sga_expense']),
  budget: z.number(),
  actual: z.number(),
  /** Journals already resolved to this account (by the loader's account-key crosswalk). */
  journals: z.array(JournalEntrySchema),
})

const AttributionInputSchema = z.object({
  fiscalYear: z.number().int(),
  month: z.number().int().min(1).max(12),
  actualsSource: z.enum(['monthly_balance', 'sample', 'mock', 'none']),
  accounts: z.array(AccountAttributionInputSchema),
  unmatchedJournalCount: z.number().int().nonnegative().optional(),
  warnings: z.array(z.string()).optional(),
})

/** A journal already resolved to one account + side (input to the pure core). */
export type JournalEntry = z.infer<typeof JournalEntrySchema>

/** A single account's inputs for attribution (input to the pure core). */
export type AccountAttributionInput = z.infer<typeof AccountAttributionInputSchema>

/** Top-level input to `attributeVariance`. */
export type AttributionInput = z.infer<typeof AttributionInputSchema>

/** Source of the actuals fed into attribution (proposal §8 `dataQuality.actualsSource`). */
export type ActualsSource = AttributionInput['actualsSource']

/**
 * Attribution options. All thresholds are `PENDING HUMAN DETERMINATION` (proposal §6.2,
 * §11.5); defaults are conservative starting points for a human reviewer to tune.
 */
export interface AttributionOptions {
  /** Max journals returned per account, ranked by |deviation|. */
  topK?: number
  /** Absolute materiality floor (currency). Variances below `max(floor, pct×revenue)`. */
  materialityAbsoluteFloor?: number
  /** Materiality as a fraction of total revenue. */
  materialityPctOfRevenue?: number
  /** |z| at/above which a journal is tagged `outlier`. */
  outlierZThreshold?: number
  /** Unreconciled share above which journal-attribution confidence degrades to `low`. */
  unreconciledTolerancePct?: number
  /** Expected-amount model. Only `M0` (uniform spread) is implemented. */
  expectedModel?: 'M0'
}

const DEFAULT_OPTIONS: Required<AttributionOptions> = {
  topK: 10,
  materialityAbsoluteFloor: 10000,
  materialityPctOfRevenue: 0.005,
  outlierZThreshold: 2.5,
  unreconciledTolerancePct: 0.1,
  expectedModel: 'M0',
}

function resolveOptions(options?: AttributionOptions): Required<AttributionOptions> {
  return { ...DEFAULT_OPTIONS, ...options }
}

// ---------------------------------------------------------------------------
// Output types (proposal §8 response shape)
// ---------------------------------------------------------------------------

export interface DriverBreakdown {
  driver: VarianceDriver
  /** Signed contribution to the account variance; Σ across drivers (incl. unreconciled) = variance. */
  amount: number
  /** `amount / variance × 100` (signed); `null` when variance is zero. */
  pctOfVariance: number | null
  journalsCount: number
}

export interface JournalAttribution {
  journalId: string
  freeeJournalId: string | null
  entryDate: string
  description: string
  /** Signed to the account's P&L direction (proposal §6.4 step 1). */
  signedAmount: number
  /** Expected amount (M0: `budget / |J_a|`). */
  expected: number
  /** `signedAmount − expected`; Σ + unreconciled = variance. */
  deviation: number
  /** `deviation / variance × 100` (signed); `null` when variance is zero. */
  contributionPct: number | null
  zScore: number | null
  driver: VarianceDriver
  direction: 'favorable' | 'unfavorable' | 'neutral'
}

export interface Reconciliation {
  journalSum: number
  actual: number
  /** `actual − journalSum` (proposal §6.5 reconciliation gap). */
  unreconciled: number
  /** `unreconciled / max(|actual|, |journalSum|) × 100`; `null` when the denominator is zero. */
  unreconciledPct: number | null
}

export interface AccountAttribution {
  accountCode: string
  accountName: string
  category: 'revenue' | 'cost_of_sales' | 'sga_expense'
  signConvention: SignConvention
  budget: number
  actual: number
  /** `actual − budget` (Level 1 static-budget variance, proposal §3). */
  variance: number
  /** `variance / budget × 100`; `null` when budget is zero (proposal §6.2). */
  variancePct: number | null
  favorable: boolean | null
  material: boolean
  /** `actual / budget × 100`; `null` when budget is zero (proposal §6.2). */
  achievementRate: number | null
  reconciliation: Reconciliation
  drivers: DriverBreakdown[]
  journals: JournalAttribution[]
  journalAttributionConfidence: 'high' | 'low'
}

export interface VarianceAttributionDataQuality {
  actualsSource: ActualsSource
  /** `% of actual-bearing accounts that have a budget` (proposal §8). */
  budgetCoveragePct: number
  /** All `false`: Journal stores no partner/segment/quantity (proposal §4.3). */
  dimensionCoverage: { partner: boolean; segment: boolean; quantity: boolean }
  warnings: string[]
  unmatchedJournalCount: number
}

export interface VarianceAttribution {
  fiscalYear: number
  month: number
  dataQuality: VarianceAttributionDataQuality
  accounts: AccountAttribution[]
  summary: {
    /** Operating-income level: `Σ revenue − Σ (cost_of_sales + sga_expense)`, budgets. */
    totalBudget: number
    totalActual: number
    totalVariance: number
    favorable: boolean | null
    /** Signed sum of immaterial-account variances (proposal §8). */
    immaterialBucket: number
  }
}

// ---------------------------------------------------------------------------
// Per-account attribution (Layer A + Layer B)
// ---------------------------------------------------------------------------

function attributeAccount(
  acc: AccountAttributionInput,
  ctx: {
    fiscalYear: number
    month: number
    totalRevenue: number
    opts: Required<AttributionOptions>
  }
): AccountAttribution {
  const { fiscalYear, month, totalRevenue, opts } = ctx
  const signConvention = signConventionForCategory(acc.category)
  const variance = acc.actual - acc.budget
  const favorable = classifyFavorable(acc.actual, acc.budget, signConvention)
  const threshold = materialityThreshold(totalRevenue, opts)
  const material = Math.abs(variance) >= threshold
  const achievementRate = acc.budget !== 0 ? (acc.actual / acc.budget) * 100 : null
  const variancePct = acc.budget !== 0 ? (variance / acc.budget) * 100 : null

  const signedJournals = acc.journals.map((j) => ({
    ...j,
    signedAmount: signJournalAmount(j.amount, j.side, signConvention),
  }))
  const journalSum = signedJournals.reduce((sum, j) => sum + j.signedAmount, 0)
  const unreconciled = acc.actual - journalSum
  const reconDenom = Math.max(Math.abs(acc.actual), Math.abs(journalSum))
  const unreconciledPct = reconDenom !== 0 ? (unreconciled / reconDenom) * 100 : null
  const confidenceDenom = Math.max(Math.abs(acc.actual), Math.abs(acc.budget), 1)
  const unreconciledShare = Math.abs(unreconciled) / confidenceDenom
  const journalAttributionConfidence: 'high' | 'low' =
    unreconciledShare > opts.unreconciledTolerancePct ? 'low' : 'high'

  const reconciliation: Reconciliation = {
    journalSum,
    actual: acc.actual,
    unreconciled,
    unreconciledPct,
  }

  // Immaterial variances are aggregated, not exploded to journals (proposal §6.2).
  if (!material) {
    return {
      accountCode: acc.accountCode,
      accountName: acc.accountName,
      category: acc.category,
      signConvention,
      budget: acc.budget,
      actual: acc.actual,
      variance,
      variancePct,
      favorable,
      material,
      achievementRate,
      reconciliation,
      drivers: [
        {
          driver: 'immaterial',
          amount: variance,
          pctOfVariance: variance === 0 ? null : 100,
          journalsCount: 0,
        },
      ],
      journals: [],
      journalAttributionConfidence: 'high',
    }
  }

  // No journals resolved to this account.
  if (signedJournals.length === 0) {
    // PENDING HUMAN DETERMINATION: boundary between `absence` (budgeted, ≈ no actual)
    // and `unreconciled` (actual present but no journal backing). Default: actual below
    // the materiality floor is treated as absence; otherwise the whole variance is
    // unreconciled (no journals to attribute).
    const isAbsence = Math.abs(acc.actual) < opts.materialityAbsoluteFloor
    const driver: VarianceDriver = isAbsence ? 'absence' : 'unreconciled'
    return {
      accountCode: acc.accountCode,
      accountName: acc.accountName,
      category: acc.category,
      signConvention,
      budget: acc.budget,
      actual: acc.actual,
      variance,
      variancePct,
      favorable,
      material,
      achievementRate,
      reconciliation,
      drivers: [{ driver, amount: variance, pctOfVariance: 100, journalsCount: 0 }],
      journals: [],
      // No journals to attribute → journal-level confidence is low by definition.
      journalAttributionConfidence: 'low',
    }
  }

  // Material + has journals: M0 expected + driver decomposition + ranking.
  const n = signedJournals.length
  const expected = expectedAmountUniform(acc.budget, n)
  const zScores = computeZScores(signedJournals.map((j) => j.signedAmount))
  const budgetZero = acc.budget === 0

  const journalAttributions: JournalAttribution[] = signedJournals.map((j, i) => {
    const z = zScores[i]
    const deviation = j.signedAmount - expected
    const driver = classifyJournalDriver(
      {
        zScore: z,
        isBoundary: isPeriodBoundary(j.entryDate, fiscalYear, month),
        budgetZero,
      },
      opts
    )
    const direction: 'favorable' | 'unfavorable' | 'neutral' =
      deviation === 0
        ? 'neutral'
        : signConvention === 'revenue'
          ? deviation > 0
            ? 'favorable'
            : 'unfavorable'
          : deviation > 0
            ? 'unfavorable'
            : 'favorable'
    return {
      journalId: j.journalId,
      freeeJournalId: j.freeeJournalId ?? null,
      entryDate: j.entryDate,
      description: j.description,
      signedAmount: j.signedAmount,
      expected,
      deviation,
      contributionPct: variance !== 0 ? (deviation / variance) * 100 : null,
      zScore: z,
      driver,
      direction,
    }
  })

  // Driver roll-up: Σ deviation by driver tag. With `unreconciled`, sums to `variance`
  // (proposal §6.4 step 5, §6.5 identity).
  const driverAmounts = new Map<VarianceDriver, number>()
  const driverCounts = new Map<VarianceDriver, number>()
  for (const j of journalAttributions) {
    driverAmounts.set(j.driver, (driverAmounts.get(j.driver) ?? 0) + j.deviation)
    driverCounts.set(j.driver, (driverCounts.get(j.driver) ?? 0) + 1)
  }
  const drivers: DriverBreakdown[] = []
  for (const [driver, amount] of driverAmounts) {
    drivers.push({
      driver,
      amount,
      pctOfVariance: variance !== 0 ? (amount / variance) * 100 : null,
      journalsCount: driverCounts.get(driver) ?? 0,
    })
  }
  drivers.push({
    driver: 'unreconciled',
    amount: unreconciled,
    pctOfVariance: variance !== 0 ? (unreconciled / variance) * 100 : null,
    journalsCount: 0,
  })
  drivers.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))

  const ranked = [...journalAttributions]
    .sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation))
    .slice(0, opts.topK)

  return {
    accountCode: acc.accountCode,
    accountName: acc.accountName,
    category: acc.category,
    signConvention,
    budget: acc.budget,
    actual: acc.actual,
    variance,
    variancePct,
    favorable,
    material,
    achievementRate,
    reconciliation,
    drivers,
    journals: ranked,
    journalAttributionConfidence,
  }
}

function sumOperatingIncome(
  accounts: AccountAttributionInput[],
  pick: (a: AccountAttributionInput) => number
): number {
  let sum = 0
  for (const a of accounts) {
    sum += a.category === 'revenue' ? pick(a) : -pick(a)
  }
  return sum
}

// ---------------------------------------------------------------------------
// Top-level entry point
// ---------------------------------------------------------------------------

/**
 * Attributes per-account budget variance to named drivers and ranked journal entries
 * (proposal §5, §6, §9). Pure: no I/O. Input is validated with Zod `safeParse`; invalid
 * input yields a `failure` Result.
 *
 * @param input - Fiscal year/month, actuals source, and per-account inputs (each with its
 *   journals already resolved to the account + side by the loader).
 * @param options - Attribution thresholds (all `PENDING HUMAN DETERMINATION`).
 * @returns `success(VarianceAttribution)` or `failure(AppError)`.
 */
export function attributeVariance(
  input: AttributionInput,
  options?: AttributionOptions
): Result<VarianceAttribution, AppError> {
  const opts = resolveOptions(options)
  if (opts.expectedModel !== 'M0') {
    return failure(
      createAppError(
        ERROR_CODES.BUSINESS_LOGIC_ERROR,
        `Expected-amount model '${opts.expectedModel}' is not implemented (PENDING HUMAN DETERMINATION). Only M0 (uniform spread) is available.`
      )
    )
  }

  const parsed = AttributionInputSchema.safeParse(input)
  if (!parsed.success) {
    return failure(
      createAppError(
        ERROR_CODES.VALIDATION_ERROR,
        'Variance attribution input validation failed.',
        {
          details: { issues: parsed.error.issues },
        }
      )
    )
  }
  const data = parsed.data

  const totalRevenue = data.accounts
    .filter((a) => a.category === 'revenue')
    .reduce((sum, a) => sum + Math.abs(a.actual), 0)
  const ctx = { fiscalYear: data.fiscalYear, month: data.month, totalRevenue, opts }
  const accounts = data.accounts.map((a) => attributeAccount(a, ctx))

  const totalBudget = sumOperatingIncome(data.accounts, (a) => a.budget)
  const totalActual = sumOperatingIncome(data.accounts, (a) => a.actual)
  const totalVariance = totalActual - totalBudget
  const favorable = totalVariance > 0 ? true : totalVariance < 0 ? false : null
  const immaterialBucket = accounts
    .filter((a) => !a.material)
    .reduce((sum, a) => sum + a.variance, 0)

  const accountsWithActual = data.accounts.filter((a) => a.actual !== 0)
  const budgetCoveragePct =
    accountsWithActual.length > 0
      ? (accountsWithActual.filter((a) => a.budget !== 0).length / accountsWithActual.length) * 100
      : 0

  const warnings = new Set<string>(data.warnings ?? [])
  if (data.accounts.some((a) => a.category === 'revenue' || a.category === 'cost_of_sales')) {
    // Proposal §4.4: the freee-path account→category mapping is broken (revenue branch
    // is dead code; no cost_of_sales branch). The fix is Class-A (freee integration) and
    // out of scope, so revenue/COGS variances are flagged unverified.
    warnings.add('category_mapping_unverified_freee_path')
  }
  if (data.actualsSource === 'sample' || data.actualsSource === 'mock') {
    warnings.add('actuals_are_synthetic')
  }
  if ((data.unmatchedJournalCount ?? 0) > 0) {
    warnings.add('unmatched_journals_not_attributed')
  }
  // Journal stores no partner/segment/quantity (proposal §4.3): full PVVM is not
  // computable; the volume×price effect is reported as the `run_rate` residual.
  warnings.add('pvvm_not_computable_no_dimensions')

  return success({
    fiscalYear: data.fiscalYear,
    month: data.month,
    dataQuality: {
      actualsSource: data.actualsSource,
      budgetCoveragePct,
      dimensionCoverage: { partner: false, segment: false, quantity: false },
      warnings: [...warnings],
      unmatchedJournalCount: data.unmatchedJournalCount ?? 0,
    },
    accounts,
    summary: {
      totalBudget,
      totalActual,
      totalVariance,
      favorable,
      immaterialBucket,
    },
  })
}
