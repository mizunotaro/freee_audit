/**
 * Budget-variance driver attribution (予実差異要因分析).
 *
 * Decomposes a period's static-budget variance, per account, into a computable
 * driver taxonomy and — when journals are supplied — ranks the individual
 * journal entries by their contribution to each account's variance.
 *
 * This is the API-level implementation of the Layer A / Layer B methodology in
 * `docs/proposals/fin-design-01-variance-attribution.md`. That proposal marks
 * every judgemental treatment `PENDING HUMAN DETERMINATION`; the defaults
 * chosen here are the most conservative option for each, are surfaced verbatim
 * in the response, and are listed again in the PR body for owner review.
 *
 * Standard references (definitional, not repo citations):
 *   - Horngren, Datar & Rajan, "Cost Accounting: A Managerial Emphasis" —
 *     static-budget (Level 1) variance and the favourable/unfavourable sign
 *     convention.
 *   - Garrison, Noreen & Brewer, "Managerial Accounting" — master-budget
 *     variance and outlier/materiality concepts.
 *
 * Reconciliation identity enforced by this module (see reconcileDrivers):
 *   for every account:  variance == sum(driver amounts)
 *   and at the summary level:
 *     totalVariance == (sum of material-account driver amounts) + immaterialBucket
 *
 * IMPORTANT — this is financial output. The PR carrying this file MUST be
 * labelled `human-review-required` and `do-not-auto-merge`.
 */
import { z } from 'zod'
import { sumValues } from '@/lib/utils'
import {
  type Result,
  type AppError,
  ERROR_CODES,
  createAppError,
  success,
  failure,
} from '@/types/result'

// ---------------------------------------------------------------------------
// Input schemas (Zod). The route layer safeParses the HTTP body with these;
// this module also safeParses defensively so the pure helper is safe to call
// directly from tests and other services.
// ---------------------------------------------------------------------------

export const VARIANCE_PL_CATEGORY_ENUM = z.enum(['revenue', 'cost_of_sales', 'sga_expense'])
export type VariancePlCategory = z.infer<typeof VARIANCE_PL_CATEGORY_ENUM>

export const VarianceBudgetItemSchema = z.object({
  accountCode: z.string().min(1).max(50),
  accountName: z.string().min(1).max(200),
  amount: z.number().finite(),
  category: VARIANCE_PL_CATEGORY_ENUM,
})

export const VarianceActualItemSchema = z.object({
  accountCode: z.string().min(1).max(50),
  accountName: z.string().min(1).max(200),
  amount: z.number().finite(),
  category: VARIANCE_PL_CATEGORY_ENUM,
})

export const VarianceJournalItemSchema = z.object({
  journalId: z.string().min(1).max(100),
  accountCode: z.string().min(1).max(50),
  accountName: z.string().max(200).optional(),
  entryDate: z.string().min(1).max(20),
  amount: z.number().finite().nonnegative(),
  side: z.enum(['debit', 'credit']),
  description: z.string().max(500).optional(),
})

export const VarianceAttributionOptionsSchema = z
  .object({
    // PENDING HUMAN DETERMINATION: materiality floor (¥). An account's variance
    // is material only when |variance| > max(absoluteFloor, pctOfRevenue × totalRevenue).
    // Conservative default 0 lets the percentage gate decide; override per call.
    materialityAbsoluteFloor: z.number().finite().nonnegative().default(0),
    materialityPctOfRevenue: z.number().finite().min(0).max(1).default(0.05),
    topK: z.number().int().min(1).max(50).default(10),
    // PENDING HUMAN DETERMINATION: outlier z-score cutoff. Standard ~2σ.
    outlierZThreshold: z.number().finite().min(1).max(5).default(2),
    expectedModel: z.enum(['M0']).default('M0'),
  })
  .optional()

export const VarianceAttributionInputSchema = z.object({
  fiscalYear: z.number().int().min(1900).max(2100),
  month: z.number().int().min(1).max(12),
  actuals: z.array(VarianceActualItemSchema).min(1),
  budgets: z.array(VarianceBudgetItemSchema).default([]),
  journals: z.array(VarianceJournalItemSchema).optional(),
  options: VarianceAttributionOptionsSchema,
})

export type VarianceBudgetItem = z.infer<typeof VarianceBudgetItemSchema>
export type VarianceActualItem = z.infer<typeof VarianceActualItemSchema>
export type VarianceJournalItem = z.infer<typeof VarianceJournalItemSchema>

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export type VarianceDriverName =
  | 'new_unbudgeted'
  | 'absence'
  | 'outlier'
  | 'run_rate'
  | 'unreconciled'

export interface VarianceDriverRollup {
  driver: VarianceDriverName
  amount: number
  pctOfVariance: number | null
  journalsCount: number
}

export interface VarianceJournalAttribution {
  journalId: string
  entryDate: string
  description: string | null
  signedAmount: number
  expected: number
  deviation: number
  contributionPct: number | null
  zScore: number
  driver: Exclude<VarianceDriverName, 'new_unbudgeted' | 'absence'>
  direction: 'favorable' | 'unfavorable' | 'neutral'
}

export interface VarianceReconciliation {
  journalSum: number | null
  actual: number
  unreconciled: number
  unreconciledPct: number | null
}

export interface VarianceAccountAttribution {
  accountCode: string
  accountName: string
  category: VariancePlCategory
  signDirection: 'revenue' | 'expense'
  budget: number
  actual: number
  variance: number
  variancePct: number | null
  achievementRate: number | null
  favorable: boolean
  material: boolean
  drivers: VarianceDriverRollup[]
  journals: VarianceJournalAttribution[]
  reconciliation: VarianceReconciliation
}

export interface VarianceAttributionOutput {
  fiscalYear: number
  month: number
  dataQuality: {
    journalsProvided: boolean
    budgetCoveragePct: number
    warnings: string[]
  }
  accounts: VarianceAccountAttribution[]
  summary: {
    revenue: { budget: number; actual: number; variance: number }
    expenses: { budget: number; actual: number; variance: number }
    // Operating income = revenue − expenses (the line favourable direction is
    // defined against). favourable := operatingIncome.variance >= 0.
    operatingIncome: { budget: number; actual: number; variance: number }
    // Σ of every account's (actual − budget). Reconciliation subtotal only —
    // NOT operating-income variance (revenue and expense variances enter with
    // the same sign here). Used to verify attributedVariance + immaterialBucket.
    totalVariance: number
    attributedVariance: number
    immaterialBucket: number
    favorable: boolean
  }
}

// ---------------------------------------------------------------------------
// Defaults (mirrors schema defaults; exported so the route can echo them)
// ---------------------------------------------------------------------------

export const DEFAULT_VARIANCE_OPTIONS = {
  materialityAbsoluteFloor: 0,
  materialityPctOfRevenue: 0.05,
  topK: 10,
  outlierZThreshold: 2,
  expectedModel: 'M0' as const,
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Sign convention (Horngren, Level 1): a variance is favourable (F) when it
 * increases operating income relative to budget.
 *   revenue account: actual >= budget  -> F
 *   expense account: actual <= budget  -> F
 */
function isFavorable(category: VariancePlCategory, variance: number): boolean {
  return category === 'revenue' ? variance >= 0 : variance <= 0
}

/**
 * Signs a journal's magnitude to the account's P&L direction (methodology §6.4
 * step 1). Only the side that increases the line contributes positively:
 *   expense account: debit increases, credit decreases
 *   revenue account: credit increases, debit decreases
 */
function signJournal(
  category: VariancePlCategory,
  amount: number,
  side: 'debit' | 'credit'
): number {
  if (category === 'revenue') {
    return side === 'credit' ? amount : -amount
  }
  return side === 'debit' ? amount : -amount
}

/**
 * Income-effect direction of a journal's deviation from expectation:
 *   expense: deviation > 0 (spent more) -> unfavourable
 *   revenue: deviation > 0 (earned more) -> favourable
 */
function deviationDirection(
  category: VariancePlCategory,
  deviation: number
): 'favorable' | 'unfavorable' | 'neutral' {
  if (deviation === 0) return 'neutral'
  if (category === 'revenue') return deviation > 0 ? 'favorable' : 'unfavorable'
  return deviation > 0 ? 'unfavorable' : 'favorable'
}

/**
 * Population standard deviation (divide by N) over a finite set of the period's
 * journal magnitudes. Population (not sample) is used because the set IS the
 * population of journals for this account/period, not a sample of a larger one.
 */
function populationStdDev(values: number[], mean: number): number {
  if (values.length === 0) return 0
  const variance = sumValues(values.map((v) => (v - mean) ** 2)) / values.length
  return Math.sqrt(variance)
}

function pctOfVariance(amount: number, variance: number): number | null {
  if (variance === 0) return null
  return (amount / variance) * 100
}

// ---------------------------------------------------------------------------
// Core attribution
// ---------------------------------------------------------------------------

interface AccountKey {
  accountCode: string
  accountName: string
  category: VariancePlCategory
  budget: number
  actual: number
}

/**
 * Build the union of actual and budget accounts, keyed by accountCode. An
 * account present in budget but not actuals (actual = 0) and vice-versa
 * (budget = 0) is preserved so absence / new-unbudgeted drivers are detectable.
 */
function buildAccountUnion(
  actuals: VarianceActualItem[],
  budgets: VarianceBudgetItem[]
): Map<string, AccountKey> {
  const union = new Map<string, AccountKey>()
  for (const a of actuals) {
    union.set(a.accountCode, {
      accountCode: a.accountCode,
      accountName: a.accountName,
      category: a.category,
      budget: 0,
      actual: a.amount,
    })
  }
  for (const b of budgets) {
    const existing = union.get(b.accountCode)
    if (existing) {
      existing.budget = b.amount
      union.set(b.accountCode, existing)
    } else {
      union.set(b.accountCode, {
        accountCode: b.accountCode,
        accountName: b.accountName,
        category: b.category,
        budget: b.amount,
        actual: 0,
      })
    }
  }
  return union
}

function attributeAccount(
  acct: AccountKey,
  journalsForAccount: VarianceJournalItem[],
  opts: {
    topK: number
    outlierZThreshold: number
    expectedModel: 'M0'
  },
  warnings: string[]
): VarianceAccountAttribution {
  const { category, budget, actual } = acct
  // Static-budget variance (Horngren, Level 1): variance = actual − budget.
  const variance = actual - budget
  const variancePct = budget !== 0 ? (variance / budget) * 100 : null
  const achievementRate = budget !== 0 ? (actual / budget) * 100 : null
  const favorable = isFavorable(category, variance)
  const signDirection: 'revenue' | 'expense' = category === 'revenue' ? 'revenue' : 'expense'

  const base: VarianceAccountAttribution = {
    accountCode: acct.accountCode,
    accountName: acct.accountName,
    category,
    signDirection,
    budget,
    actual,
    variance,
    variancePct,
    achievementRate,
    favorable,
    material: false,
    drivers: [],
    journals: [],
    reconciliation: {
      journalSum: null,
      actual,
      unreconciled: 0,
      unreconciledPct: null,
    },
  }

  // Driver decomposition rules (mutually exclusive at the account level).
  //
  // new_unbudgeted : budget == 0 && actual != 0
  // absence        : budget > 0  && actual == 0
  // decompose      : otherwise -> outlier / run_rate / unreconciled (with
  //                  journals) or a single run_rate residual (without).
  if (budget === 0 && actual !== 0) {
    base.drivers = [
      {
        driver: 'new_unbudgeted',
        amount: variance,
        pctOfVariance: pctOfVariance(variance, variance),
        journalsCount: 0,
      },
    ]
    if (journalsForAccount.length > 0) {
      warnings.push(
        `account ${acct.accountCode} is unbudgeted; ${journalsForAccount.length} supplied journal(s) not attributed at journal level`
      )
    }
    return base
  }

  if (budget > 0 && actual === 0) {
    base.drivers = [
      {
        driver: 'absence',
        amount: variance,
        pctOfVariance: pctOfVariance(variance, variance),
        journalsCount: 0,
      },
    ]
    return base
  }

  // Decompose path (budget > 0 && actual != 0, or the trivial zero/zero case).
  if (journalsForAccount.length === 0) {
    base.drivers = [
      {
        driver: 'run_rate',
        amount: variance,
        pctOfVariance: pctOfVariance(variance, variance),
        journalsCount: 0,
      },
    ]
    return base
  }

  // Journals supplied: sign, expected (M0), deviation, z-score, outlier split.
  const signed = journalsForAccount.map((j) => ({
    journal: j,
    signedAmount: signJournal(category, j.amount, j.side),
  }))

  const journalSum = sumValues(signed.map((s) => s.signedAmount))
  const mean = journalSum / signed.length
  const sigma = populationStdDev(
    signed.map((s) => s.signedAmount),
    mean
  )

  // M0 expected amount: budget spread evenly across the period's journals.
  const expectedPerJournal = budget / signed.length

  const attributed: VarianceJournalAttribution[] = signed.map((s) => {
    const deviation = s.signedAmount - expectedPerJournal
    const zScore = sigma > 0 ? (s.signedAmount - mean) / sigma : 0
    const isOutlier = Math.abs(zScore) >= opts.outlierZThreshold
    return {
      journalId: s.journal.journalId,
      entryDate: s.journal.entryDate,
      description: s.journal.description ?? null,
      signedAmount: s.signedAmount,
      expected: expectedPerJournal,
      deviation,
      contributionPct: pctOfVariance(deviation, variance),
      zScore,
      driver: isOutlier ? 'outlier' : 'run_rate',
      direction: deviationDirection(category, deviation),
    }
  })

  const outlierJournals = attributed.filter((a) => a.driver === 'outlier')
  const runRateJournals = attributed.filter((a) => a.driver === 'run_rate')

  const outlierAmount = sumValues(outlierJournals.map((a) => a.deviation))
  const runRateAmount = sumValues(runRateJournals.map((a) => a.deviation))
  // Reconciliation gap (methodology §6.5): actual − Σ journal signed amounts.
  const unreconciled = actual - journalSum
  const unreconciledPct = journalSum !== 0 ? (unreconciled / journalSum) * 100 : null

  const drivers: VarianceDriverRollup[] = []
  if (outlierJournals.length > 0) {
    drivers.push({
      driver: 'outlier',
      amount: outlierAmount,
      pctOfVariance: pctOfVariance(outlierAmount, variance),
      journalsCount: outlierJournals.length,
    })
  }
  drivers.push({
    driver: 'run_rate',
    amount: runRateAmount,
    pctOfVariance: pctOfVariance(runRateAmount, variance),
    journalsCount: runRateJournals.length,
  })
  drivers.push({
    driver: 'unreconciled',
    amount: unreconciled,
    pctOfVariance: pctOfVariance(unreconciled, variance),
    journalsCount: 0,
  })

  base.drivers = drivers
  base.reconciliation = { journalSum, actual, unreconciled, unreconciledPct }

  // Rank journals by |deviation|, return top-K.
  const ranked = [...attributed].sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation))
  base.journals = ranked.slice(0, opts.topK)

  return base
}

/**
 * Assert the per-account reconciliation identity
 *   variance == Σ driver amounts
 * and collect any violations. Deviations are floating-point; tolerate sub-yen
 * rounding error. A violation is a real bug, so it is surfaced as a warning
 * rather than silently dropped.
 */
function reconcileDrivers(accounts: VarianceAccountAttribution[]): string[] {
  const violations: string[] = []
  for (const a of accounts) {
    const sum = sumValues(a.drivers.map((d) => d.amount))
    if (Math.abs(sum - a.variance) > 0.5) {
      violations.push(
        `reconciliation failed for ${a.accountCode}: drivers sum ${sum} ≠ variance ${a.variance}`
      )
    }
  }
  return violations
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Attribute a period's budget variance to drivers and (optionally) journals.
 *
 * @param rawInput - { fiscalYear, month, actuals[], budgets[], journals?[], options? }
 * @returns Result<VarianceAttributionOutput, AppError>. Failure only on Zod
 *   validation failure (the math is total and never throws).
 */
export function attributeVariance(rawInput: unknown): Result<VarianceAttributionOutput, AppError> {
  const parsed = VarianceAttributionInputSchema.safeParse(rawInput)
  if (!parsed.success) {
    return failure(
      createAppError(ERROR_CODES.VALIDATION_ERROR, 'Variance attribution input validation failed', {
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
  const opts = { ...DEFAULT_VARIANCE_OPTIONS, ...(input.options ?? {}) }

  const warnings: string[] = []
  const union = buildAccountUnion(input.actuals, input.budgets)

  const journalsByAccount = new Map<string, VarianceJournalItem[]>()
  if (input.journals && input.journals.length > 0) {
    for (const j of input.journals) {
      const list = journalsByAccount.get(j.accountCode) ?? []
      list.push(j)
      journalsByAccount.set(j.accountCode, list)
    }
  }
  const journalsProvided = journalsByAccount.size > 0

  // Budget coverage: share of actual accounts that also have a budget row.
  const actualCodes = new Set(input.actuals.map((a) => a.accountCode))
  const budgetedActualCodes = input.budgets
    .filter((b) => actualCodes.has(b.accountCode))
    .map((b) => b.accountCode)
  const budgetCoveragePct =
    actualCodes.size > 0 ? (new Set(budgetedActualCodes).size / actualCodes.size) * 100 : 0

  const totalRevenue = sumValues(
    input.actuals.filter((a) => a.category === 'revenue').map((a) => a.amount)
  )
  const materialityThreshold = Math.max(
    opts.materialityAbsoluteFloor,
    opts.materialityPctOfRevenue * totalRevenue
  )

  const accounts: VarianceAccountAttribution[] = []
  let immaterialBucket = 0

  for (const acct of union.values()) {
    const attributed = attributeAccount(
      acct,
      journalsByAccount.get(acct.accountCode) ?? [],
      opts,
      warnings
    )

    attributed.material = Math.abs(attributed.variance) > materialityThreshold

    if (!attributed.material && attributed.variance !== 0) {
      // Immaterial variances are aggregated, not exploded (methodology §6.2).
      immaterialBucket += attributed.variance
      attributed.drivers = []
      attributed.journals = []
    } else if (!attributed.material && attributed.variance === 0) {
      attributed.drivers = []
      attributed.journals = []
    }

    accounts.push(attributed)
  }

  accounts.sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))

  const reconciliationViolations = reconcileDrivers(accounts.filter((a) => a.drivers.length > 0))
  warnings.push(...reconciliationViolations)

  // Summary subtotals, split by P&L direction so the favourable flag reflects
  // operating-income movement (not the raw sum of mixed-sign line variances).
  const revenueActual = sumValues(
    [...union.values()].filter((a) => a.category === 'revenue').map((a) => a.actual)
  )
  const revenueBudget = sumValues(
    [...union.values()].filter((a) => a.category === 'revenue').map((a) => a.budget)
  )
  const expenseActual = sumValues(
    [...union.values()].filter((a) => a.category !== 'revenue').map((a) => a.actual)
  )
  const expenseBudget = sumValues(
    [...union.values()].filter((a) => a.category !== 'revenue').map((a) => a.budget)
  )
  const revenueVariance = revenueActual - revenueBudget
  const expenseVariance = expenseActual - expenseBudget
  const oiBudget = revenueBudget - expenseBudget
  const oiActual = revenueActual - expenseActual
  const oiVariance = oiActual - oiBudget
  // Reconciliation subtotal: Σ every account variance (revenue + expense).
  const totalVariance = sumValues(accounts.map((a) => a.variance))
  const attributedVariance = sumValues(
    accounts.flatMap((a) => (a.material ? a.drivers.map((d) => d.amount) : []))
  )

  return success({
    fiscalYear: input.fiscalYear,
    month: input.month,
    dataQuality: {
      journalsProvided,
      budgetCoveragePct: Math.round(budgetCoveragePct * 10) / 10,
      warnings,
    },
    accounts,
    summary: {
      revenue: { budget: revenueBudget, actual: revenueActual, variance: revenueVariance },
      expenses: { budget: expenseBudget, actual: expenseActual, variance: expenseVariance },
      operatingIncome: { budget: oiBudget, actual: oiActual, variance: oiVariance },
      totalVariance,
      attributedVariance,
      immaterialBucket,
      favorable: oiVariance >= 0,
    },
  })
}
