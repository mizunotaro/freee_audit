import { describe, it, expect } from 'vitest'
import {
  attributeVariance,
  classifyFavorable,
  signJournalAmount,
  expectedAmountUniform,
  computeZScores,
  isPeriodBoundary,
  classifyJournalDriver,
  signConventionForCategory,
  materialityThreshold,
  type AttributionInput,
  type AccountAttributionInput,
  type JournalEntry,
  type VarianceAttribution,
} from '@/services/budget/variance-attribution'

/**
 * GOLDEN tests for the variance-attribution pure core. Every expected number below is
 * hand-computed from the methodology in docs/proposals/fin-design-01-variance-attribution.md
 * (§3 standard framework, §6.4 journal attribution, §6.5 reconciliation identity). No
 * fake-green: assertions check real computed values, including the reconciliation identity
 * `Σ driver amounts = variance` and `Σ driver pctOfVariance = 100`.
 */

const FY = 2025
const MO = 6

function expenseJournal(
  id: string,
  amount: number,
  entryDate: string,
  description = ''
): JournalEntry {
  return { journalId: id, freeeJournalId: id, entryDate, description, amount, side: 'debit' }
}

function revenueJournal(
  id: string,
  amount: number,
  entryDate: string,
  side: 'debit' | 'credit',
  description = ''
): JournalEntry {
  return { journalId: id, freeeJournalId: id, entryDate, description, amount, side }
}

/** A revenue account with actual === budget (immaterial) used purely as the materiality base. */
function materialityBaseRevenue(actual: number): AccountAttributionInput {
  return {
    accountCode: '400',
    accountName: '売上高',
    category: 'revenue',
    budget: actual,
    actual,
    journals: [],
  }
}

function run(input: AttributionInput): VarianceAttribution {
  const result = attributeVariance(input)
  if (!result.success) {
    throw new Error(`attributeVariance failed: ${result.error.message}`)
  }
  return result.data
}

// ---------------------------------------------------------------------------
describe('sign convention helpers (§3, §6.2)', () => {
  it('classifies favorable by P&L direction', () => {
    expect(classifyFavorable(110, 100, 'revenue')).toBe(true) // revenue over budget = F
    expect(classifyFavorable(90, 100, 'revenue')).toBe(false) // revenue under = U
    expect(classifyFavorable(100, 100, 'revenue')).toBeNull() // zero variance = neutral

    expect(classifyFavorable(90, 100, 'expense')).toBe(true) // expense under budget = F
    expect(classifyFavorable(110, 100, 'expense')).toBe(false) // expense over = U
    expect(classifyFavorable(100, 100, 'expense')).toBeNull()
  })

  it('maps categories to sign conventions', () => {
    expect(signConventionForCategory('revenue')).toBe('revenue')
    expect(signConventionForCategory('cost_of_sales')).toBe('expense')
    expect(signConventionForCategory('sga_expense')).toBe('expense')
  })

  it('signs journal amounts to the account natural direction', () => {
    // Revenue: credit increases (+), debit decreases (−) e.g. sales return.
    expect(signJournalAmount(100, 'credit', 'revenue')).toBe(100)
    expect(signJournalAmount(100, 'debit', 'revenue')).toBe(-100)
    // Expense: debit increases (+), credit decreases (−) e.g. rebate.
    expect(signJournalAmount(100, 'debit', 'expense')).toBe(100)
    expect(signJournalAmount(100, 'credit', 'expense')).toBe(-100)
  })
})

describe('expected-amount M0 (§6.4 step 2)', () => {
  it('spreads the budget evenly across journals', () => {
    expect(expectedAmountUniform(800000, 25)).toBe(32000)
    expect(expectedAmountUniform(0, 5)).toBe(0)
  })
  it('returns 0 when there are no journals', () => {
    expect(expectedAmountUniform(800000, 0)).toBe(0)
    expect(expectedAmountUniform(800000, -1)).toBe(0)
  })
})

describe('computeZScores (§6.4 step 3)', () => {
  it('computes population z-scores', () => {
    // [1,2,3]: mean 2, sigma sqrt(2/3) ≈ 0.81650
    const z = computeZScores([1, 2, 3])
    expect(z[0]).toBeCloseTo(-1.224745, 4)
    expect(z[1]).toBeCloseTo(0, 6)
    expect(z[2]).toBeCloseTo(1.224745, 4)
  })
  it('returns null for degenerate distributions', () => {
    expect(computeZScores([42])).toEqual([null]) // n < 2
    expect(computeZScores([5, 5, 5])).toEqual([null, null, null]) // sigma 0
    expect(computeZScores([])).toEqual([])
  })
})

describe('isPeriodBoundary (§6.3)', () => {
  it('flags first/last day of the period month', () => {
    expect(isPeriodBoundary('2025-06-01', FY, MO)).toBe(true)
    expect(isPeriodBoundary('2025-06-30', FY, MO)).toBe(true) // June has 30 days
    expect(isPeriodBoundary('2025-06-15', FY, MO)).toBe(false)
    expect(isPeriodBoundary('2025-06-25', FY, MO)).toBe(false)
  })
  it('rejects dates outside the period', () => {
    expect(isPeriodBoundary('2025-07-01', FY, MO)).toBe(false) // wrong month
    expect(isPeriodBoundary('2024-06-30', FY, MO)).toBe(false) // wrong year
  })
  it('handles February leap-year boundary', () => {
    expect(isPeriodBoundary('2024-02-29', 2024, 2)).toBe(true) // 2024 is a leap year
    expect(isPeriodBoundary('2025-02-29', 2025, 2)).toBe(false) // 2025 is not
  })
})

describe('classifyJournalDriver (§6.1)', () => {
  const opts = {
    topK: 10,
    materialityAbsoluteFloor: 10000,
    materialityPctOfRevenue: 0.005,
    outlierZThreshold: 2.5,
    unreconciledTolerancePct: 0.1,
    expectedModel: 'M0' as const,
  }
  it('precedence: new_unbudgeted > outlier > timing > run_rate', () => {
    expect(classifyJournalDriver({ zScore: 5, isBoundary: true, budgetZero: true }, opts)).toBe(
      'new_unbudgeted'
    )
    expect(classifyJournalDriver({ zScore: 3, isBoundary: true, budgetZero: false }, opts)).toBe(
      'outlier'
    )
    expect(classifyJournalDriver({ zScore: 1, isBoundary: true, budgetZero: false }, opts)).toBe(
      'timing'
    )
    expect(classifyJournalDriver({ zScore: 1, isBoundary: false, budgetZero: false }, opts)).toBe(
      'run_rate'
    )
  })
  it('null z-score never triggers outlier', () => {
    expect(
      classifyJournalDriver({ zScore: null, isBoundary: false, budgetZero: false }, opts)
    ).toBe('run_rate')
  })
})

// ---------------------------------------------------------------------------
// GOLDEN scenario 1: summer-bonus outlier (proposal §10 worked example)
// ---------------------------------------------------------------------------

describe('GOLDEN — summer-bonus outlier (§10)', () => {
  it('decomposes variance and ranks the bonus as the top outlier journal', () => {
    // 24 regular payroll journals of ¥35,000 + 1 summer bonus of ¥100,000.
    const regular: JournalEntry[] = Array.from({ length: 24 }, (_, i) =>
      expenseJournal(`j${i}`, 35000, '2025-06-15', 'monthly payroll')
    )
    const bonus = expenseJournal('bonus', 100000, '2025-06-25', '夏賞与')

    const input: AttributionInput = {
      fiscalYear: FY,
      month: MO,
      actualsSource: 'monthly_balance',
      accounts: [
        materialityBaseRevenue(10000000),
        {
          accountCode: '600',
          accountName: '給与手当',
          category: 'sga_expense',
          budget: 800000,
          actual: 940000,
          journals: [...regular, bonus],
        },
      ],
    }

    const out = run(input)
    const acc = out.accounts.find((a) => a.accountCode === '600')!

    // Static-budget variance (Level 1): actual − budget.
    expect(acc.variance).toBe(140000)
    expect(acc.favorable).toBe(false) // expense over budget = unfavorable
    expect(acc.material).toBe(true)
    expect(acc.achievementRate).toBeCloseTo(117.5, 4)
    expect(acc.variancePct).toBeCloseTo(17.5, 4)
    expect(acc.signConvention).toBe('expense')

    // Reconciliation: journals sum exactly to actual (no accrual gap).
    expect(acc.reconciliation.journalSum).toBe(940000)
    expect(acc.reconciliation.unreconciled).toBe(0)
    expect(acc.reconciliation.unreconciledPct).toBe(0)
    expect(acc.journalAttributionConfidence).toBe('high')

    // M0 expected = budget / 25 = 32,000.
    const expected = 32000
    expect(acc.journals[0].expected).toBe(expected)

    // Top journal is the bonus, tagged outlier.
    expect(acc.journals[0].journalId).toBe('bonus')
    expect(acc.journals[0].driver).toBe('outlier')
    expect(acc.journals[0].signedAmount).toBe(100000)
    expect(acc.journals[0].deviation).toBe(100000 - expected) // 68,000
    expect(acc.journals[0].contributionPct).toBeCloseTo((68000 / 140000) * 100, 4) // ≈48.571%
    expect(acc.journals[0].direction).toBe('unfavorable') // extra expense
    // z = (100000 − 37600) / sqrt(162240000) ≈ 4.8990
    expect(acc.journals[0].zScore).toBeCloseTo(4.899, 3)

    // Driver roll-up: outlier 68,000 (1) + run_rate 72,000 (24) + unreconciled 0.
    const byDriver = new Map(acc.drivers.map((d) => [d.driver, d]))
    expect(byDriver.get('outlier')!.amount).toBe(68000)
    expect(byDriver.get('outlier')!.journalsCount).toBe(1)
    expect(byDriver.get('run_rate')!.amount).toBe(72000) // 24 × (35000 − 32000)
    expect(byDriver.get('run_rate')!.journalsCount).toBe(24)
    expect(byDriver.get('unreconciled')!.amount).toBe(0)

    // Reconciliation identity: Σ driver amounts = variance.
    const driverSum = acc.drivers.reduce((s, d) => s + d.amount, 0)
    expect(driverSum).toBeCloseTo(acc.variance, 6)
    // Σ pctOfVariance = 100 (signed).
    const pctSum = acc.drivers.reduce((s, d) => s + (d.pctOfVariance ?? 0), 0)
    expect(pctSum).toBeCloseTo(100, 6)

    // topK cap: 25 journals → at most 10 returned.
    expect(acc.journals.length).toBe(10)
    // Ranking: bonus first (|deviation| 68,000), then regulars (3,000 each).
    expect(acc.journals[0].deviation).toBe(68000)
    expect(acc.journals[1].deviation).toBe(3000)

    // Summary at operating-income level: revenue 0 variance − expense 140,000 over.
    expect(out.summary.totalActual).toBe(10000000 - 940000)
    expect(out.summary.totalBudget).toBe(10000000 - 800000)
    expect(out.summary.totalVariance).toBe(-140000) // op income down → unfavorable
    expect(out.summary.favorable).toBe(false)
    expect(out.summary.immaterialBucket).toBe(0) // revenue variance was 0

    // Data quality: revenue present → category warning; dimensions all false.
    expect(out.dataQuality.actualsSource).toBe('monthly_balance')
    expect(out.dataQuality.budgetCoveragePct).toBe(100)
    expect(out.dataQuality.dimensionCoverage).toEqual({
      partner: false,
      segment: false,
      quantity: false,
    })
    expect(out.dataQuality.warnings).toContain('category_mapping_unverified_freee_path')
    expect(out.dataQuality.warnings).toContain('pvvm_not_computable_no_dimensions')
    expect(out.dataQuality.unmatchedJournalCount).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// GOLDEN scenario 2: reconciliation gap + signed drivers + low confidence
// ---------------------------------------------------------------------------

describe('GOLDEN — reconciliation gap & signed drivers', () => {
  it('carries the unreconciled bucket and degrades confidence when the gap is large', () => {
    // Budget 200,000; actual 250,000; 2 debit journals (120,000 on 06-01 boundary, 80,000 mid-month).
    // journalSum = 200,000 → unreconciled = 50,000 (accrual not in Journal).
    const input: AttributionInput = {
      fiscalYear: FY,
      month: MO,
      actualsSource: 'monthly_balance',
      accounts: [
        materialityBaseRevenue(10000000),
        {
          accountCode: '660',
          accountName: '広告宣伝費',
          category: 'sga_expense',
          budget: 200000,
          actual: 250000,
          journals: [
            expenseJournal('a', 120000, '2025-06-01'), // boundary → timing
            expenseJournal('b', 80000, '2025-06-15'), // mid-month → run_rate
          ],
        },
      ],
    }

    const acc = run(input).accounts.find((a) => a.accountCode === '660')!
    expect(acc.variance).toBe(50000)
    expect(acc.material).toBe(true)
    expect(acc.reconciliation.journalSum).toBe(200000)
    expect(acc.reconciliation.unreconciled).toBe(50000)
    expect(acc.reconciliation.unreconciledPct).toBeCloseTo((50000 / 250000) * 100, 4) // 20%
    expect(acc.journalAttributionConfidence).toBe('low') // 20% > 10% tolerance

    // expected = 200,000 / 2 = 100,000.
    // journal a deviation = +20,000 (timing, boundary), journal b deviation = −20,000 (run_rate).
    const byDriver = new Map(acc.drivers.map((d) => [d.driver, d]))
    expect(byDriver.get('timing')!.amount).toBe(20000)
    expect(byDriver.get('run_rate')!.amount).toBe(-20000)
    expect(byDriver.get('unreconciled')!.amount).toBe(50000)

    // Signed pctOfVariance sums to 100: 40 + (−40) + 100.
    expect(byDriver.get('timing')!.pctOfVariance).toBeCloseTo(40, 4)
    expect(byDriver.get('run_rate')!.pctOfVariance).toBeCloseTo(-40, 4)
    expect(byDriver.get('unreconciled')!.pctOfVariance).toBeCloseTo(100, 4)

    const driverSum = acc.drivers.reduce((s, d) => s + d.amount, 0)
    expect(driverSum).toBeCloseTo(acc.variance, 6)

    // Direction: expense, +deviation = unfavorable, −deviation = favorable.
    const a = acc.journals.find((j) => j.journalId === 'a')!
    const b = acc.journals.find((j) => j.journalId === 'b')!
    expect(a.driver).toBe('timing')
    expect(a.direction).toBe('unfavorable')
    expect(b.driver).toBe('run_rate')
    expect(b.direction).toBe('favorable')
  })
})

// ---------------------------------------------------------------------------
// GOLDEN scenario 3: edge cases (§6.3)
// ---------------------------------------------------------------------------

describe('GOLDEN — edge cases', () => {
  it('new_unbudgeted: budget = 0, actual ≠ 0 (§6.3 missing budget)', () => {
    const acc = run({
      fiscalYear: FY,
      month: MO,
      actualsSource: 'monthly_balance',
      accounts: [
        materialityBaseRevenue(10000000),
        {
          accountCode: '630',
          accountName: '通信費',
          category: 'sga_expense',
          budget: 0,
          actual: 60000,
          journals: [expenseJournal('only', 60000, '2025-06-10')],
        },
      ],
    }).accounts.find((a) => a.accountCode === '630')!

    expect(acc.variance).toBe(60000)
    expect(acc.achievementRate).toBeNull() // budget 0 → undefined rate
    expect(acc.variancePct).toBeNull()
    expect(acc.favorable).toBe(false) // unexpected expense
    const byDriver = new Map(acc.drivers.map((d) => [d.driver, d]))
    expect(byDriver.get('new_unbudgeted')!.amount).toBe(60000)
    expect(byDriver.get('new_unbudgeted')!.journalsCount).toBe(1)
    expect(byDriver.get('unreconciled')!.amount).toBe(0) // journal sums to actual
    expect(acc.journals[0].driver).toBe('new_unbudgeted')
    expect(acc.journals[0].deviation).toBe(60000) // expected 0
    expect(acc.journals[0].contributionPct).toBeCloseTo(100, 6)
  })

  it('absence: budget > 0, actual ≈ 0, no journals (§6.3 budget but no journals)', () => {
    const acc = run({
      fiscalYear: FY,
      month: MO,
      actualsSource: 'monthly_balance',
      accounts: [
        materialityBaseRevenue(10000000),
        {
          accountCode: '650',
          accountName: '地代家賃',
          category: 'sga_expense',
          budget: 200000,
          actual: 0,
          journals: [],
        },
      ],
    }).accounts.find((a) => a.accountCode === '650')!

    expect(acc.variance).toBe(-200000)
    expect(acc.favorable).toBe(true) // under-spent expense = favorable
    expect(acc.material).toBe(true)
    expect(acc.drivers).toHaveLength(1)
    expect(acc.drivers[0].driver).toBe('absence')
    expect(acc.drivers[0].amount).toBe(-200000)
    expect(acc.journals).toEqual([])
    expect(acc.journalAttributionConfidence).toBe('low')
    expect(acc.achievementRate).toBe(0)
  })

  it('unreconciled: budget > 0, actual material, no journals resolved (§6.3 unreconciled)', () => {
    // actual 30,000 is at/above the materiality floor (10,000) → NOT absence → unreconciled.
    const acc = run({
      fiscalYear: FY,
      month: MO,
      actualsSource: 'monthly_balance',
      accounts: [
        materialityBaseRevenue(10000000),
        {
          accountCode: '640',
          accountName: '水道光熱費',
          category: 'sga_expense',
          budget: 100000,
          actual: 30000,
          journals: [],
        },
      ],
    }).accounts.find((a) => a.accountCode === '640')!

    expect(acc.variance).toBe(-70000)
    expect(acc.drivers[0].driver).toBe('unreconciled')
    expect(acc.drivers[0].amount).toBe(-70000)
    expect(acc.favorable).toBe(true) // expense under budget
  })

  it('immaterial: variance below the floor is aggregated, not exploded (§6.2)', () => {
    const acc = run({
      fiscalYear: FY,
      month: MO,
      actualsSource: 'monthly_balance',
      accounts: [
        materialityBaseRevenue(10000000),
        {
          accountCode: '620',
          accountName: '旅費交通費',
          category: 'sga_expense',
          budget: 50000,
          actual: 52000,
          journals: [expenseJournal('t', 52000, '2025-06-10')],
        },
      ],
    }).accounts.find((a) => a.accountCode === '620')!

    expect(acc.material).toBe(false) // |2,000| < 50,000 threshold
    expect(acc.drivers).toHaveLength(1)
    expect(acc.drivers[0].driver).toBe('immaterial')
    expect(acc.drivers[0].amount).toBe(2000)
    expect(acc.journals).toEqual([]) // not exploded to journals
  })

  it('revenue with a sales return: credit (+) and debit (−) sign correctly (§6.4 step 1)', () => {
    // Budget 1,000,000; actual 950,000 = 1,000,000 sale − 50,000 return.
    // The account under test is itself revenue, so it provides the materiality base
    // (totalRevenue 950,000 → threshold 10,000; |variance| 50,000 is material).
    const acc = run({
      fiscalYear: FY,
      month: MO,
      actualsSource: 'monthly_balance',
      accounts: [
        {
          accountCode: '400',
          accountName: '売上高',
          category: 'revenue',
          budget: 1000000,
          actual: 950000,
          journals: [
            revenueJournal('sale', 1000000, '2025-06-15', 'credit'),
            revenueJournal('ret', 50000, '2025-06-30', 'debit'), // boundary → timing
          ],
        },
      ],
    }).accounts.find((a) => a.accountCode === '400')!

    expect(acc.signConvention).toBe('revenue')
    expect(acc.variance).toBe(-50000)
    expect(acc.favorable).toBe(false) // revenue under budget = unfavorable
    expect(acc.reconciliation.journalSum).toBe(950000) // 1,000,000 − 50,000

    // expected = 500,000. sale deviation +500,000 (run_rate); return deviation −550,000 (timing).
    const byDriver = new Map(acc.drivers.map((d) => [d.driver, d]))
    expect(byDriver.get('run_rate')!.amount).toBe(500000)
    expect(byDriver.get('timing')!.amount).toBe(-550000)
    expect(byDriver.get('unreconciled')!.amount).toBe(0)
    const driverSum = acc.drivers.reduce((s, d) => s + d.amount, 0)
    expect(driverSum).toBeCloseTo(acc.variance, 6)

    const sale = acc.journals.find((j) => j.journalId === 'sale')!
    const ret = acc.journals.find((j) => j.journalId === 'ret')!
    expect(sale.signedAmount).toBe(1000000) // credit increases revenue
    expect(ret.signedAmount).toBe(-50000) // debit reduces revenue
    expect(sale.direction).toBe('favorable') // more revenue than expected
    expect(ret.direction).toBe('unfavorable') // return reduces revenue
  })

  it('negative actual (a refund exceeding budgeted expense) is handled', () => {
    // Expense budget 100,000; actual −20,000 (large rebate credit). One credit journal.
    const acc = run({
      fiscalYear: FY,
      month: MO,
      actualsSource: 'monthly_balance',
      accounts: [
        materialityBaseRevenue(10000000),
        {
          accountCode: '670',
          accountName: '雑費',
          category: 'sga_expense',
          budget: 100000,
          actual: -20000,
          journals: [
            {
              journalId: 'rebate',
              freeeJournalId: 'rebate',
              entryDate: '2025-06-20',
              description: 'rebate',
              amount: 120000,
              side: 'credit',
            },
          ],
        },
      ],
    }).accounts.find((a) => a.accountCode === '670')!

    // signedAmount for expense credit = −120,000; journalSum = −120,000 = actual + unreconciled.
    expect(acc.reconciliation.journalSum).toBe(-120000)
    expect(acc.reconciliation.unreconciled).toBe(100000) // actual −20,000 − (−120,000)
    expect(acc.variance).toBe(-120000) // −20,000 − 100,000
    expect(acc.favorable).toBe(true) // expense well under budget
    const driverSum = acc.drivers.reduce((s, d) => s + d.amount, 0)
    expect(driverSum).toBeCloseTo(acc.variance, 6)
  })
})

// ---------------------------------------------------------------------------
// GOLDEN scenario 4: validation & Result contract
// ---------------------------------------------------------------------------

describe('Result contract & validation', () => {
  it('returns failure for invalid month', () => {
    const result = attributeVariance({
      fiscalYear: FY,
      month: 13,
      actualsSource: 'monthly_balance',
      accounts: [],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR')
    }
  })

  it('returns failure for an account with an invalid category', () => {
    const result = attributeVariance({
      fiscalYear: FY,
      month: MO,
      actualsSource: 'monthly_balance',
      accounts: [
        {
          accountCode: '600',
          accountName: 'x',
          category: 'invalid' as unknown as 'sga_expense',
          budget: 0,
          actual: 0,
          journals: [],
        },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('returns failure for an unsupported expected-amount model', () => {
    const result = attributeVariance(
      { fiscalYear: FY, month: MO, actualsSource: 'monthly_balance', accounts: [] },
      { expectedModel: 'M2' as unknown as 'M0' }
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('BUSINESS_LOGIC_ERROR')
    }
  })

  it('returns success with empty accounts', () => {
    const out = run({ fiscalYear: FY, month: MO, actualsSource: 'none', accounts: [] })
    expect(out.accounts).toEqual([])
    expect(out.summary.totalVariance).toBe(0)
    expect(out.summary.favorable).toBeNull()
    expect(out.dataQuality.budgetCoveragePct).toBe(0)
    expect(out.dataQuality.actualsSource).toBe('none')
  })
})

// ---------------------------------------------------------------------------
// GOLDEN property: reconciliation identity across constructed cases
// ---------------------------------------------------------------------------

describe('reconciliation identity (§6.5): Σ drivers = variance, Σ pct = 100', () => {
  const cases: { name: string; account: AccountAttributionInput; revenue: number }[] = [
    {
      name: 'outlier + run_rate, clean reconcile',
      revenue: 10000000,
      account: {
        accountCode: '600',
        accountName: '給与手当',
        category: 'sga_expense',
        budget: 800000,
        actual: 940000,
        journals: [
          ...Array.from({ length: 24 }, (_, i) => expenseJournal(`r${i}`, 35000, '2025-06-15')),
          expenseJournal('b', 100000, '2025-06-25'),
        ],
      },
    },
    {
      name: 'reconciliation gap, low confidence',
      revenue: 10000000,
      account: {
        accountCode: '660',
        accountName: '広告宣伝費',
        category: 'sga_expense',
        budget: 200000,
        actual: 250000,
        journals: [
          expenseJournal('a', 120000, '2025-06-01'),
          expenseJournal('b', 80000, '2025-06-15'),
        ],
      },
    },
    {
      name: 'new unbudgeted',
      revenue: 10000000,
      account: {
        accountCode: '630',
        accountName: '通信費',
        category: 'sga_expense',
        budget: 0,
        actual: 60000,
        journals: [expenseJournal('x', 60000, '2025-06-10')],
      },
    },
    {
      name: 'revenue with returns',
      revenue: 10000000,
      account: {
        accountCode: '400',
        accountName: '売上高',
        category: 'revenue',
        budget: 1000000,
        actual: 950000,
        journals: [
          revenueJournal('s', 1000000, '2025-06-15', 'credit'),
          revenueJournal('r', 50000, '2025-06-30', 'debit'),
        ],
      },
    },
    {
      name: 'cost of sales',
      revenue: 10000000,
      account: {
        accountCode: '500',
        accountName: '売上原価',
        category: 'cost_of_sales',
        budget: 4000000,
        actual: 4600000,
        journals: [
          expenseJournal('c1', 2000000, '2025-06-10'),
          expenseJournal('c2', 2000000, '2025-06-20'),
          expenseJournal('c3', 600000, '2025-06-30'), // boundary → timing
        ],
      },
    },
  ]

  for (const c of cases) {
    it(`${c.name}: drivers reconcile to variance`, () => {
      // When the account under test is itself revenue, it provides the materiality base;
      // otherwise a separate revenue base is added (distinct accountCode, no collision).
      const accounts =
        c.account.category === 'revenue'
          ? [c.account]
          : [materialityBaseRevenue(c.revenue), c.account]
      const out = run({
        fiscalYear: FY,
        month: MO,
        actualsSource: 'monthly_balance',
        accounts,
      })
      const acc = out.accounts.find((a) => a.accountCode === c.account.accountCode)!
      const driverSum = acc.drivers.reduce((s, d) => s + d.amount, 0)
      expect(driverSum).toBeCloseTo(acc.variance, 6)
      if (acc.variance !== 0) {
        const pctSum = acc.drivers.reduce((s, d) => s + (d.pctOfVariance ?? 0), 0)
        expect(pctSum).toBeCloseTo(100, 6)
      }
    })
  }
})

// ---------------------------------------------------------------------------
// GOLDEN: materiality threshold helper
// ---------------------------------------------------------------------------

describe('materialityThreshold (§6.2)', () => {
  const opts = {
    topK: 10,
    materialityAbsoluteFloor: 10000,
    materialityPctOfRevenue: 0.005,
    outlierZThreshold: 2.5,
    unreconciledTolerancePct: 0.1,
    expectedModel: 'M0' as const,
  }
  it('is max(absoluteFloor, pct × revenue)', () => {
    expect(materialityThreshold(1000000, opts)).toBe(10000) // 0.5% of 1M = 5,000 < 10,000
    expect(materialityThreshold(10000000, opts)).toBe(50000) // 0.5% of 10M = 50,000
    expect(materialityThreshold(5000000, opts)).toBe(25000) // 0.5% of 5M = 25,000
  })
})
