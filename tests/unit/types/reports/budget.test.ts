import { describe, it, expect, expectTypeOf } from 'vitest'
import type {
  BudgetItem,
  BudgetRecord,
  BudgetVsActual,
  StageLevelItem,
  AccountLevelItem,
  DetailedBudget,
  VarianceItem,
  VarianceData,
  BudgetReportData,
} from '@/types/reports/budget'

describe('src/types/reports/budget', () => {
  it('resolves as a type-only module (no runtime exports)', async () => {
    const mod = await import('@/types/reports/budget')
    expect(mod).toBeDefined()
    expect(Object.keys(mod)).toHaveLength(0)
  })

  describe('BudgetItem', () => {
    const sample: BudgetItem = {
      accountCode: '4000',
      accountName: 'Sales Revenue',
      budgetAmount: 100000,
      actualAmount: 95000,
      variance: -5000,
      achievementRate: 0.95,
    }

    it('constructs with all required fields', () => {
      expect(sample.accountCode).toBe('4000')
      expect(sample.accountName).toBe('Sales Revenue')
      expect(sample.budgetAmount).toBe(100000)
      expect(sample.actualAmount).toBe(95000)
      expect(sample.variance).toBe(-5000)
      expect(sample.achievementRate).toBe(0.95)
    })

    it('field types are number/string', () => {
      expectTypeOf<BudgetItem['accountCode']>().toBeString()
      expectTypeOf<BudgetItem['accountName']>().toBeString()
      expectTypeOf<BudgetItem['budgetAmount']>().toBeNumber()
      expectTypeOf<BudgetItem['actualAmount']>().toBeNumber()
      expectTypeOf<BudgetItem['variance']>().toBeNumber()
      expectTypeOf<BudgetItem['achievementRate']>().toBeNumber()
    })

    it('every field is required (no optionals)', () => {
      expectTypeOf<BudgetItem>().toEqualTypeOf<{
        accountCode: string
        accountName: string
        budgetAmount: number
        actualAmount: number
        variance: number
        achievementRate: number
      }>()
    })

    it('accepts boundary numeric values (zero, overspend, extreme)', () => {
      const zero: BudgetItem = {
        accountCode: '',
        accountName: '',
        budgetAmount: 0,
        actualAmount: 0,
        variance: 0,
        achievementRate: 0,
      }
      expect(zero.budgetAmount).toBe(0)

      const overspend: BudgetItem = {
        ...sample,
        actualAmount: 150000,
        variance: 50000,
        achievementRate: 1.5,
      }
      expect(overspend.achievementRate).toBeGreaterThan(1)

      const extreme: BudgetItem = {
        accountCode: '9999',
        accountName: 'Extreme',
        budgetAmount: Number.MAX_VALUE,
        actualAmount: Infinity,
        variance: -Infinity,
        achievementRate: NaN,
      }
      expect(extreme.budgetAmount).toBe(Number.MAX_VALUE)
      expect(Number.isNaN(extreme.achievementRate)).toBe(true)
    })
  })

  describe('BudgetRecord', () => {
    const base: BudgetRecord = {
      id: 'rec-1',
      fiscalYear: 2026,
      month: 7,
      accountCode: '4000',
      accountName: 'Sales Revenue',
      amount: 100000,
    }

    it('constructs with required fields', () => {
      expect(base.id).toBe('rec-1')
      expect(base.fiscalYear).toBe(2026)
      expect(base.month).toBe(7)
      expect(base.amount).toBe(100000)
    })

    it('departmentId is optional and string|null (omitted / set / null)', () => {
      const withId: BudgetRecord = { ...base, departmentId: 'dept-A' }
      const withNull: BudgetRecord = { ...base, departmentId: null }
      const omitted: BudgetRecord = { ...base }
      expect(withId.departmentId).toBe('dept-A')
      expect(withNull.departmentId).toBeNull()
      expect(omitted.departmentId).toBeUndefined()
      expectTypeOf<BudgetRecord['departmentId']>().toEqualTypeOf<string | null | undefined>()
    })

    it('required-field types are enforced', () => {
      expectTypeOf<BudgetRecord['id']>().toBeString()
      expectTypeOf<BudgetRecord['fiscalYear']>().toBeNumber()
      expectTypeOf<BudgetRecord['month']>().toBeNumber()
      expectTypeOf<BudgetRecord['accountCode']>().toBeString()
      expectTypeOf<BudgetRecord['accountName']>().toBeString()
      expectTypeOf<BudgetRecord['amount']>().toBeNumber()
    })
  })

  describe('BudgetVsActual', () => {
    const sample: BudgetVsActual = {
      fiscalYear: 2026,
      month: 7,
      items: [
        {
          accountCode: '4000',
          accountName: 'Sales Revenue',
          budgetAmount: 100000,
          actualAmount: 95000,
          variance: -5000,
          achievementRate: 0.95,
        },
      ],
      totals: {
        revenue: { budget: 100000, actual: 95000, variance: -5000, rate: 0.95 },
        expenses: { budget: 60000, actual: 70000, variance: 10000, rate: 1.1667 },
        operatingIncome: { budget: 40000, actual: 25000, variance: -15000, rate: 0.625 },
      },
    }

    it('constructs a complete budget-vs-actual object', () => {
      expect(sample.fiscalYear).toBe(2026)
      expect(sample.month).toBe(7)
      expect(sample.items).toHaveLength(1)
      expect(sample.totals.revenue.budget).toBe(100000)
      expect(sample.totals.expenses.variance).toBe(10000)
      expect(sample.totals.operatingIncome.rate).toBe(0.625)
    })

    it('items is an array of BudgetItem', () => {
      expect(Array.isArray(sample.items)).toBe(true)
      expectTypeOf<BudgetVsActual['items']>().toEqualTypeOf<BudgetItem[]>()
    })

    it('totals has exactly revenue/expenses/operatingIncome sub-objects', () => {
      expectTypeOf<BudgetVsActual['totals']>().toEqualTypeOf<{
        revenue: { budget: number; actual: number; variance: number; rate: number }
        expenses: { budget: number; actual: number; variance: number; rate: number }
        operatingIncome: { budget: number; actual: number; variance: number; rate: number }
      }>()
      expect(Object.keys(sample.totals).sort()).toEqual(['expenses', 'operatingIncome', 'revenue'])
    })

    it('accepts an empty items array with zeroed totals (fail-safe: no line items)', () => {
      const empty: BudgetVsActual = {
        fiscalYear: 2026,
        month: 7,
        items: [],
        totals: {
          revenue: { budget: 0, actual: 0, variance: 0, rate: 0 },
          expenses: { budget: 0, actual: 0, variance: 0, rate: 0 },
          operatingIncome: { budget: 0, actual: 0, variance: 0, rate: 0 },
        },
      }
      expect(empty.items).toHaveLength(0)
      expect(empty.totals.operatingIncome.actual).toBe(0)
    })
  })

  describe('StageLevelItem', () => {
    const sample: StageLevelItem = {
      stage: 'Planning',
      budget: 50000,
      actual: 45000,
      variance: -5000,
      rate: 0.9,
      status: 'good',
    }

    it('constructs with all fields', () => {
      expect(sample.stage).toBe('Planning')
      expect(sample.rate).toBe(0.9)
      expect(sample.status).toBe('good')
    })

    it('status is exactly the good|warning|bad union (3 members, no dupes)', () => {
      const statuses: StageLevelItem['status'][] = ['good', 'warning', 'bad']
      expect(statuses).toHaveLength(3)
      expect(new Set(statuses).size).toBe(3)
      expectTypeOf<StageLevelItem['status']>().toEqualTypeOf<'good' | 'warning' | 'bad'>()
    })
  })

  describe('AccountLevelItem', () => {
    const sample: AccountLevelItem = {
      code: '4000',
      name: 'Sales Revenue',
      category: 'Revenue',
      budget: 100000,
      actual: 95000,
      variance: -5000,
      rate: 0.95,
      status: 'warning',
    }

    it('constructs with all fields', () => {
      expect(sample.code).toBe('4000')
      expect(sample.category).toBe('Revenue')
      expect(sample.status).toBe('warning')
    })

    it('field types are enforced', () => {
      expectTypeOf<AccountLevelItem['code']>().toBeString()
      expectTypeOf<AccountLevelItem['name']>().toBeString()
      expectTypeOf<AccountLevelItem['category']>().toBeString()
      expectTypeOf<AccountLevelItem['budget']>().toBeNumber()
      expectTypeOf<AccountLevelItem['actual']>().toBeNumber()
      expectTypeOf<AccountLevelItem['variance']>().toBeNumber()
      expectTypeOf<AccountLevelItem['rate']>().toBeNumber()
    })

    it('status is exactly the good|warning|bad union (3 members, no dupes)', () => {
      const statuses: AccountLevelItem['status'][] = ['good', 'warning', 'bad']
      expect(statuses).toHaveLength(3)
      expect(new Set(statuses).size).toBe(3)
      expectTypeOf<AccountLevelItem['status']>().toEqualTypeOf<'good' | 'warning' | 'bad'>()
    })
  })

  describe('DetailedBudget', () => {
    const sample: DetailedBudget = {
      stageLevel: [
        {
          stage: 'Planning',
          budget: 50000,
          actual: 45000,
          variance: -5000,
          rate: 0.9,
          status: 'good',
        },
      ],
      accountLevel: [
        {
          code: '4000',
          name: 'Sales',
          category: 'Revenue',
          budget: 100000,
          actual: 95000,
          variance: -5000,
          rate: 0.95,
          status: 'warning',
        },
      ],
    }

    it('constructs with both levels', () => {
      expect(sample.stageLevel).toHaveLength(1)
      expect(sample.accountLevel).toHaveLength(1)
    })

    it('array element types match the item interfaces', () => {
      expectTypeOf<DetailedBudget['stageLevel']>().toEqualTypeOf<StageLevelItem[]>()
      expectTypeOf<DetailedBudget['accountLevel']>().toEqualTypeOf<AccountLevelItem[]>()
    })

    it('accepts empty arrays for both levels (fail-safe: no breakdown)', () => {
      const empty: DetailedBudget = { stageLevel: [], accountLevel: [] }
      expect(empty.stageLevel).toHaveLength(0)
      expect(empty.accountLevel).toHaveLength(0)
    })
  })

  describe('VarianceItem', () => {
    const over: VarianceItem = {
      accountName: 'Travel Expense',
      budget: 10000,
      actual: 15000,
      variancePercent: 0.5,
      type: 'over',
    }
    const under: VarianceItem = {
      accountName: 'Software Costs',
      budget: 20000,
      actual: 12000,
      variancePercent: 0.4,
      type: 'under',
    }

    it('constructs both over/under variants', () => {
      expect(over.type).toBe('over')
      expect(under.type).toBe('under')
    })

    it('type is exactly the over|under union (2 members, no dupes)', () => {
      const types: VarianceItem['type'][] = ['over', 'under']
      expect(types).toHaveLength(2)
      expect(new Set(types).size).toBe(2)
      expectTypeOf<VarianceItem['type']>().toEqualTypeOf<'over' | 'under'>()
    })

    it('accepts a zero variance percent (boundary)', () => {
      const zero: VarianceItem = {
        accountName: 'Exact',
        budget: 1000,
        actual: 1000,
        variancePercent: 0,
        type: 'under',
      }
      expect(zero.variancePercent).toBe(0)
    })
  })

  describe('VarianceData', () => {
    it('wraps a significantVariances array of VarianceItem', () => {
      const data: VarianceData = {
        significantVariances: [
          {
            accountName: 'Travel',
            budget: 10000,
            actual: 15000,
            variancePercent: 0.5,
            type: 'over',
          },
        ],
      }
      expect(data.significantVariances).toHaveLength(1)
      expectTypeOf<VarianceData['significantVariances']>().toEqualTypeOf<VarianceItem[]>()
    })

    it('accepts an empty array (fail-safe: no significant variances)', () => {
      const empty: VarianceData = { significantVariances: [] }
      expect(empty.significantVariances).toHaveLength(0)
    })
  })

  describe('BudgetReportData', () => {
    const sample: BudgetReportData = {
      budgetVsActual: {
        fiscalYear: 2026,
        month: 7,
        items: [],
        totals: {
          revenue: { budget: 100000, actual: 95000, variance: -5000, rate: 0.95 },
          expenses: { budget: 60000, actual: 70000, variance: 10000, rate: 1.1667 },
          operatingIncome: { budget: 40000, actual: 25000, variance: -15000, rate: 0.625 },
        },
      },
      detailedBudget: { stageLevel: [], accountLevel: [] },
      variance: { significantVariances: [] },
      budgets: [
        {
          id: 'rec-1',
          fiscalYear: 2026,
          month: 7,
          accountCode: '4000',
          accountName: 'Sales Revenue',
          amount: 100000,
        },
      ],
    }

    it('constructs the full report aggregate', () => {
      expect(sample.budgetVsActual.fiscalYear).toBe(2026)
      expect(sample.detailedBudget.stageLevel).toHaveLength(0)
      expect(sample.variance.significantVariances).toHaveLength(0)
      expect(sample.budgets).toHaveLength(1)
    })

    it('member types match their interfaces', () => {
      expectTypeOf<BudgetReportData['budgetVsActual']>().toEqualTypeOf<BudgetVsActual>()
      expectTypeOf<BudgetReportData['detailedBudget']>().toEqualTypeOf<DetailedBudget>()
      expectTypeOf<BudgetReportData['variance']>().toEqualTypeOf<VarianceData>()
      expectTypeOf<BudgetReportData['budgets']>().toEqualTypeOf<BudgetRecord[]>()
    })

    it('accepts a fully-minimal fail-safe report (zeroed totals, empty collections)', () => {
      const minimal: BudgetReportData = {
        budgetVsActual: {
          fiscalYear: 0,
          month: 0,
          items: [],
          totals: {
            revenue: { budget: 0, actual: 0, variance: 0, rate: 0 },
            expenses: { budget: 0, actual: 0, variance: 0, rate: 0 },
            operatingIncome: { budget: 0, actual: 0, variance: 0, rate: 0 },
          },
        },
        detailedBudget: { stageLevel: [], accountLevel: [] },
        variance: { significantVariances: [] },
        budgets: [],
      }
      expect(minimal.budgets).toHaveLength(0)
      expect(minimal.budgetVsActual.items).toHaveLength(0)
    })
  })
})
