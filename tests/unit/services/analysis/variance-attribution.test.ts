import { describe, it, expect } from 'vitest'
import { attributeVariance } from '@/services/analysis/variance-attribution'

/**
 * Golden tests for budget-variance driver attribution. Every expected number
 * below is hand-computed from the cited formulas in the service module:
 *   variance = actual − budget
 *   favorable: revenue variance >= 0, expense variance <= 0
 *   M0 expected = budget / |J|; deviation = signedAmount − expected
 *   identity: outlier + run_rate + unreconciled = variance
 */
describe('attributeVariance', () => {
  describe('account-level without journals', () => {
    it('classifies a single expense over-run as run_rate (no journals to split)', () => {
      const input = {
        fiscalYear: 2025,
        month: 6,
        actuals: [
          { accountCode: '510', accountName: '給与手当', amount: 950000, category: 'sga_expense' },
        ],
        budgets: [
          { accountCode: '510', accountName: '給与手当', amount: 800000, category: 'sga_expense' },
        ],
        options: { materialityAbsoluteFloor: 0, materialityPctOfRevenue: 0 },
      }

      const result = attributeVariance(input)
      expect(result.success).toBe(true)
      if (!result.success) return

      const acct = result.data.accounts[0]
      expect(acct.budget).toBe(800000)
      expect(acct.actual).toBe(950000)
      expect(acct.variance).toBe(150000)
      expect(acct.variancePct).toBeCloseTo(18.75, 2)
      expect(acct.achievementRate).toBeCloseTo(118.75, 2)
      expect(acct.favorable).toBe(false) // expense over-run is unfavourable
      expect(acct.signDirection).toBe('expense')
      expect(acct.material).toBe(true)
      expect(acct.drivers).toEqual([
        expect.objectContaining({ driver: 'run_rate', amount: 150000, journalsCount: 0 }),
      ])
      expect(acct.drivers[0].pctOfVariance).toBe(100)
      expect(acct.reconciliation.journalSum).toBeNull()

      expect(result.data.summary).toEqual(
        expect.objectContaining({
          revenue: { budget: 0, actual: 0, variance: 0 },
          expenses: { budget: 800000, actual: 950000, variance: 150000 },
          operatingIncome: { budget: -800000, actual: -950000, variance: -150000 },
          totalVariance: 150000,
          attributedVariance: 150000,
          immaterialBucket: 0,
          favorable: false, // operating income fell -> unfavourable
        })
      )
    })

    it('applies the sign convention across revenue, new_unbudgeted and absence drivers', () => {
      const input = {
        fiscalYear: 2025,
        month: 6,
        actuals: [
          { accountCode: '410', accountName: '売上高', amount: 1000000, category: 'revenue' },
          { accountCode: '411', accountName: '雑収入', amount: 50000, category: 'revenue' },
        ],
        budgets: [
          { accountCode: '410', accountName: '売上高', amount: 900000, category: 'revenue' },
          {
            accountCode: '599',
            accountName: '未発生経費',
            amount: 200000,
            category: 'sga_expense',
          },
        ],
        options: { materialityAbsoluteFloor: 0, materialityPctOfRevenue: 0 },
      }

      const result = attributeVariance(input)
      expect(result.success).toBe(true)
      if (!result.success) return

      const byCode = new Map(result.data.accounts.map((a) => [a.accountCode, a]))

      // Revenue over-run -> favourable, run_rate (budgeted, no journals).
      const r410 = byCode.get('410')!
      expect(r410.variance).toBe(100000)
      expect(r410.favorable).toBe(true)
      expect(r410.drivers).toEqual([
        expect.objectContaining({ driver: 'run_rate', amount: 100000 }),
      ])

      // Revenue with no budget -> new_unbudgeted, favourable.
      const r411 = byCode.get('411')!
      expect(r411.budget).toBe(0)
      expect(r411.variance).toBe(50000)
      expect(r411.favorable).toBe(true)
      expect(r411.drivers).toEqual([
        expect.objectContaining({ driver: 'new_unbudgeted', amount: 50000 }),
      ])

      // Budgeted expense with no actual -> absence, favourable (underspend).
      const e599 = byCode.get('599')!
      expect(e599.actual).toBe(0)
      expect(e599.variance).toBe(-200000)
      expect(e599.favorable).toBe(true)
      expect(e599.achievementRate).toBe(0)
      expect(e599.drivers).toEqual([
        expect.objectContaining({ driver: 'absence', amount: -200000 }),
      ])

      // Summary reconciliation: attributed (all material here) == total variance.
      expect(result.data.summary.totalVariance).toBe(-50000)
      expect(result.data.summary.attributedVariance).toBe(-50000)
      expect(result.data.summary.immaterialBucket).toBe(0)
      // Operating income improved (budget 700000 -> actual 1050000).
      expect(result.data.summary.favorable).toBe(true)
    })
  })

  describe('journal-level attribution (M0)', () => {
    it('splits variance into outlier + run_rate + unreconciled and ranks journals', () => {
      // budget 800000, actual 950000 (expense). Four debit journals:
      //   [100000, 100000, 100000, 700000]  -> journalSum 1000000, unreconciled -50000
      //   mean 250000, population sigma sqrt(6.75e10) = 259807.6211
      //   z(700000) = 1.732 >= 1.5 -> outlier ; z(100000) = -0.577 -> run_rate
      //   expected = 800000/4 = 200000
      //   deviations: 700000->+500000 (outlier), 100000->-100000 x3 (run_rate, -300000)
      //   identity: 500000 - 300000 - 50000 = 150000 = variance
      const input = {
        fiscalYear: 2025,
        month: 6,
        actuals: [
          { accountCode: '510', accountName: '給与手当', amount: 950000, category: 'sga_expense' },
        ],
        budgets: [
          { accountCode: '510', accountName: '給与手当', amount: 800000, category: 'sga_expense' },
        ],
        journals: [
          {
            journalId: 'j1',
            accountCode: '510',
            entryDate: '2025-06-10',
            amount: 100000,
            side: 'debit',
          },
          {
            journalId: 'j2',
            accountCode: '510',
            entryDate: '2025-06-15',
            amount: 100000,
            side: 'debit',
          },
          {
            journalId: 'j3',
            accountCode: '510',
            entryDate: '2025-06-20',
            amount: 100000,
            side: 'debit',
          },
          {
            journalId: 'j4',
            accountCode: '510',
            entryDate: '2025-06-25',
            amount: 700000,
            side: 'debit',
            description: '夏賞与',
          },
        ],
        options: {
          materialityAbsoluteFloor: 0,
          materialityPctOfRevenue: 0,
          outlierZThreshold: 1.5,
        },
      }

      const result = attributeVariance(input)
      expect(result.success).toBe(true)
      if (!result.success) return

      const acct = result.data.accounts[0]
      expect(acct.variance).toBe(150000)

      const byDriver = new Map(acct.drivers.map((d) => [d.driver, d]))
      expect(byDriver.get('outlier')).toEqual(
        expect.objectContaining({ amount: 500000, journalsCount: 1 })
      )
      expect(byDriver.get('run_rate')).toEqual(
        expect.objectContaining({ amount: -300000, journalsCount: 3 })
      )
      expect(byDriver.get('unreconciled')).toEqual(
        expect.objectContaining({ amount: -50000, journalsCount: 0 })
      )

      // Reconciliation identity.
      const driverSum = acct.drivers.reduce((s, d) => s + d.amount, 0)
      expect(driverSum).toBeCloseTo(acct.variance, 6)
      expect(acct.reconciliation.journalSum).toBe(1000000)
      expect(acct.reconciliation.unreconciled).toBe(-50000)
      expect(acct.reconciliation.unreconciledPct).toBe(-5)

      // Top journal by |deviation| is the 700000 summer-bonus outlier.
      const top = acct.journals[0]
      expect(top.journalId).toBe('j4')
      expect(top.signedAmount).toBe(700000)
      expect(top.expected).toBe(200000)
      expect(top.deviation).toBe(500000)
      expect(top.driver).toBe('outlier')
      expect(top.direction).toBe('unfavorable') // expense spent more than expected
      expect(top.zScore).toBeCloseTo(1.7320508, 4)
      expect(top.contributionPct).toBeCloseTo(333.3333, 3)
      expect(acct.journals.length).toBe(4)
    })

    it('returns zScore 0 and no outlier driver when all journal amounts are equal', () => {
      // Three equal debit journals -> sigma 0 -> no outliers, all run_rate.
      const input = {
        fiscalYear: 2025,
        month: 6,
        actuals: [
          { accountCode: '510', accountName: '給与手当', amount: 950000, category: 'sga_expense' },
        ],
        budgets: [
          { accountCode: '510', accountName: '給与手当', amount: 800000, category: 'sga_expense' },
        ],
        journals: [
          {
            journalId: 'j1',
            accountCode: '510',
            entryDate: '2025-06-10',
            amount: 300000,
            side: 'debit',
          },
          {
            journalId: 'j2',
            accountCode: '510',
            entryDate: '2025-06-15',
            amount: 300000,
            side: 'debit',
          },
          {
            journalId: 'j3',
            accountCode: '510',
            entryDate: '2025-06-20',
            amount: 300000,
            side: 'debit',
          },
        ],
        options: { materialityAbsoluteFloor: 0, materialityPctOfRevenue: 0, outlierZThreshold: 2 },
      }

      const result = attributeVariance(input)
      expect(result.success).toBe(true)
      if (!result.success) return

      const acct = result.data.accounts[0]
      expect(acct.drivers.map((d) => d.driver)).toEqual(['run_rate', 'unreconciled'])
      expect(acct.journals.every((j) => j.zScore === 0)).toBe(true)
      // run_rate = Σ deviation = 900000 − 3*(800000/3) = 100000 (float error expected).
      const runRate = acct.drivers.find((d) => d.driver === 'run_rate')!
      expect(runRate.amount).toBeCloseTo(100000, 0)
      expect(acct.reconciliation.unreconciled).toBe(50000)
    })

    it('signs credit-side journals against the account direction (revenue credit = positive)', () => {
      // Revenue account, budget 900000, actual 1000000. Two credit journals (sales).
      // signedAmount each = +amount (credit increases revenue). journalSum 1000000.
      // expected = 900000/2 = 450000. deviations: +50000 each. unreconciled = 0.
      const input = {
        fiscalYear: 2025,
        month: 6,
        actuals: [
          { accountCode: '410', accountName: '売上高', amount: 1000000, category: 'revenue' },
        ],
        budgets: [
          { accountCode: '410', accountName: '売上高', amount: 900000, category: 'revenue' },
        ],
        journals: [
          {
            journalId: 's1',
            accountCode: '410',
            entryDate: '2025-06-05',
            amount: 500000,
            side: 'credit',
          },
          {
            journalId: 's2',
            accountCode: '410',
            entryDate: '2025-06-20',
            amount: 500000,
            side: 'credit',
          },
        ],
        options: { materialityAbsoluteFloor: 0, materialityPctOfRevenue: 0 },
      }

      const result = attributeVariance(input)
      expect(result.success).toBe(true)
      if (!result.success) return

      const acct = result.data.accounts[0]
      expect(acct.signDirection).toBe('revenue')
      expect(acct.favorable).toBe(true)
      expect(acct.journals[0].signedAmount).toBe(500000)
      expect(acct.journals[0].deviation).toBe(50000)
      expect(acct.journals[0].direction).toBe('favorable') // revenue earned more than expected
      expect(acct.reconciliation.unreconciled).toBe(0)
      expect(acct.reconciliation.unreconciledPct).toBe(0)
    })
  })

  describe('materiality & immaterial bucket', () => {
    it('aggregates immaterial variances and keeps the summary reconciliation', () => {
      // threshold = max(10000, 0.05*1000000) = 50000.
      // 410 variance 100000 -> material ; 510 variance -500 -> immaterial.
      const input = {
        fiscalYear: 2025,
        month: 6,
        actuals: [
          { accountCode: '410', accountName: '売上', amount: 1000000, category: 'revenue' },
          { accountCode: '510', accountName: '小経費', amount: 1000, category: 'sga_expense' },
        ],
        budgets: [
          { accountCode: '410', accountName: '売上', amount: 900000, category: 'revenue' },
          { accountCode: '510', accountName: '小経費', amount: 1500, category: 'sga_expense' },
        ],
        options: { materialityAbsoluteFloor: 10000, materialityPctOfRevenue: 0.05 },
      }

      const result = attributeVariance(input)
      expect(result.success).toBe(true)
      if (!result.success) return

      const byCode = new Map(result.data.accounts.map((a) => [a.accountCode, a]))
      expect(byCode.get('410')!.material).toBe(true)
      expect(byCode.get('410')!.drivers.length).toBe(1)
      expect(byCode.get('510')!.material).toBe(false)
      expect(byCode.get('510')!.drivers).toEqual([])
      expect(byCode.get('510')!.journals).toEqual([])

      // attributedVariance (100000) + immaterialBucket (-500) == totalVariance (99500).
      expect(result.data.summary.totalVariance).toBe(99500)
      expect(result.data.summary.attributedVariance).toBe(100000)
      expect(result.data.summary.immaterialBucket).toBe(-500)
      expect(result.data.summary.attributedVariance + result.data.summary.immaterialBucket).toBe(
        result.data.summary.totalVariance
      )
    })
  })

  describe('data quality', () => {
    it('reports budget coverage and journalsProvided flags', () => {
      const input = {
        fiscalYear: 2025,
        month: 6,
        actuals: [
          { accountCode: '410', accountName: '売上', amount: 1000, category: 'revenue' },
          { accountCode: '510', accountName: '経費', amount: 1000, category: 'sga_expense' },
        ],
        budgets: [{ accountCode: '410', accountName: '売上', amount: 900, category: 'revenue' }],
        journals: [
          {
            journalId: 'j1',
            accountCode: '410',
            entryDate: '2025-06-01',
            amount: 1000,
            side: 'credit',
          },
        ],
        options: { materialityAbsoluteFloor: 0, materialityPctOfRevenue: 0 },
      }

      const result = attributeVariance(input)
      expect(result.success).toBe(true)
      if (!result.success) return

      // 1 of 2 actual accounts has a budget -> 50%.
      expect(result.data.dataQuality.budgetCoveragePct).toBe(50)
      expect(result.data.dataQuality.journalsProvided).toBe(true)
    })
  })

  describe('reconciliation property (mixed scenario)', () => {
    it('sums every account driver set to its variance and reconciles the summary', () => {
      const input = {
        fiscalYear: 2025,
        month: 6,
        actuals: [
          { accountCode: '410', accountName: '売上', amount: 1200000, category: 'revenue' },
          { accountCode: '510', accountName: '給与', amount: 700000, category: 'sga_expense' },
          { accountCode: '520', accountName: '地代', amount: 0, category: 'sga_expense' },
        ],
        budgets: [
          { accountCode: '410', accountName: '売上', amount: 1000000, category: 'revenue' },
          { accountCode: '510', accountName: '給与', amount: 800000, category: 'sga_expense' },
          { accountCode: '520', accountName: '地代', amount: 300000, category: 'sga_expense' },
        ],
        journals: [
          {
            journalId: 'a',
            accountCode: '410',
            entryDate: '2025-06-01',
            amount: 1200000,
            side: 'credit',
          },
          {
            journalId: 'b',
            accountCode: '510',
            entryDate: '2025-06-01',
            amount: 700000,
            side: 'debit',
          },
        ],
        options: { materialityAbsoluteFloor: 0, materialityPctOfRevenue: 0, outlierZThreshold: 2 },
      }

      const result = attributeVariance(input)
      expect(result.success).toBe(true)
      if (!result.success) return

      for (const acct of result.data.accounts) {
        if (acct.drivers.length > 0) {
          const sum = acct.drivers.reduce((s, d) => s + d.amount, 0)
          expect(sum).toBeCloseTo(acct.variance, 6)
        }
      }
      // No reconciliation-violation warnings.
      expect(result.data.dataQuality.warnings).toEqual([])
      expect(result.data.summary.attributedVariance + result.data.summary.immaterialBucket).toBe(
        result.data.summary.totalVariance
      )
    })
  })

  describe('validation (Zod safeParse)', () => {
    it('rejects empty actuals', () => {
      const result = attributeVariance({ fiscalYear: 2025, month: 6, actuals: [], budgets: [] })
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error.code).toBe('VALIDATION_ERROR')
    })

    it('rejects an invalid P&L category', () => {
      const result = attributeVariance({
        fiscalYear: 2025,
        month: 6,
        actuals: [{ accountCode: '410', accountName: '売上', amount: 1, category: 'foo' }],
        budgets: [],
      })
      expect(result.success).toBe(false)
    })

    it('rejects a non-finite amount', () => {
      const result = attributeVariance({
        fiscalYear: 2025,
        month: 6,
        actuals: [
          { accountCode: '410', accountName: '売上', amount: Number.NaN, category: 'revenue' },
        ],
        budgets: [],
      })
      expect(result.success).toBe(false)
    })

    it('rejects an out-of-range month', () => {
      const result = attributeVariance({
        fiscalYear: 2025,
        month: 13,
        actuals: [{ accountCode: '410', accountName: '売上', amount: 1, category: 'revenue' }],
        budgets: [],
      })
      expect(result.success).toBe(false)
    })
  })
})
