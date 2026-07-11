import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ProfitLoss } from '@/types'
import {
  buildAccountResolver,
  resolveJournalsToAccounts,
  prepareAttributionInput,
  periodWindow,
  inferCategoryFromCode,
  type BudgetRow,
  type JournalRow,
  type AccountItemRow,
} from '@/services/budget/variance-attribution-loader'
import { computeVarianceAttribution } from '@/services/budget/variance-attribution-loader'
import { getBudgetsByMonth } from '@/services/budget/budget-service'
import { prisma } from '@/lib/db'

vi.mock('@/services/budget/budget-service', () => ({
  getBudgetsByMonth: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    journal: { findMany: vi.fn() },
    accountItem: { findMany: vi.fn() },
  },
}))

const actuals: ProfitLoss = {
  fiscalYear: 2025,
  month: 6,
  revenue: [{ code: '400', name: '売上高', amount: 10000000 }],
  costOfSales: [],
  grossProfit: 10000000,
  grossProfitMargin: 100,
  sgaExpenses: [{ code: '600', name: '給与手当', amount: 940000 }],
  operatingIncome: 9060000,
  operatingMargin: 90.6,
  nonOperatingIncome: [],
  nonOperatingExpenses: [],
  ordinaryIncome: 9060000,
  extraordinaryIncome: [],
  extraordinaryLoss: [],
  incomeBeforeTax: 9060000,
  incomeTax: 2718000,
  netIncome: 6342000,
  depreciation: 0,
}

const budgets: BudgetRow[] = [
  { accountCode: '400', accountName: '売上高', amount: 9500000, departmentId: null },
  { accountCode: '600', accountName: '給与手当', amount: 800000, departmentId: null },
  { accountCode: '650', accountName: '地代家賃', amount: 200000, departmentId: null },
  { accountCode: '810', accountName: '支払利息', amount: 50000, departmentId: null },
]

const accountItems: AccountItemRow[] = [
  { name: '現金', shortcutNum: '111', freeeId: 111, categoryType: 'assets' },
  { name: '未払金', shortcutNum: '211', freeeId: 211, categoryType: 'liabilities' },
  { name: '給与手当', shortcutNum: '600', freeeId: 6000, categoryType: 'expense' },
]

const journals: JournalRow[] = [
  {
    id: 'j1',
    freeeJournalId: 'fj1',
    entryDate: new Date('2025-06-15T00:00:00.000Z'),
    description: '給与',
    debitAccount: '給与手当',
    creditAccount: '現金',
    amount: 940000,
  },
  {
    id: 'j2',
    freeeJournalId: 'fj2',
    entryDate: new Date('2025-06-10T00:00:00.000Z'),
    description: '家賃',
    debitAccount: '地代家賃',
    creditAccount: '未払金',
    amount: 100000,
  },
  {
    id: 'j3',
    freeeJournalId: 'fj3',
    entryDate: new Date('2025-07-05T00:00:00.000Z'),
    description: 'out of period',
    debitAccount: '給与手当',
    creditAccount: '現金',
    amount: 50000,
  },
  {
    id: 'j4',
    freeeJournalId: 'fj4',
    entryDate: new Date('2025-06-20T00:00:00.000Z'),
    description: 'cash sale',
    debitAccount: '現金',
    creditAccount: '売上高',
    amount: 10000000,
  },
  {
    id: 'j5',
    freeeJournalId: 'fj5',
    entryDate: new Date('2025-06-25T00:00:00.000Z'),
    description: 'both BS',
    debitAccount: '仮払金',
    creditAccount: '未収入金',
    amount: 200000,
  },
]

describe('inferCategoryFromCode', () => {
  it('maps P&L prefixes and rejects balance-sheet / below-the-line codes', () => {
    expect(inferCategoryFromCode('400')).toBe('revenue')
    expect(inferCategoryFromCode('500')).toBe('cost_of_sales')
    expect(inferCategoryFromCode('600')).toBe('sga_expense')
    expect(inferCategoryFromCode('710')).toBe('sga_expense')
    expect(inferCategoryFromCode('111')).toBeNull() // asset
    expect(inferCategoryFromCode('810')).toBeNull() // non-operating
  })
})

describe('periodWindow', () => {
  it('returns the inclusive calendar month window (calendar-aligned assumption)', () => {
    expect(periodWindow(2025, 6)).toEqual({ start: '2025-06-01', end: '2025-06-30' })
    expect(periodWindow(2024, 2)).toEqual({ start: '2024-02-01', end: '2024-02-29' }) // leap
    expect(periodWindow(2025, 2)).toEqual({ start: '2025-02-01', end: '2025-02-28' })
  })
})

describe('buildAccountResolver', () => {
  const resolver = buildAccountResolver({ actuals, budgets, accountItems })

  it('prefers actuals (authoritative category) over budgets and AccountItems', () => {
    expect(resolver('売上高')).toEqual({
      accountCode: '400',
      accountName: '売上高',
      category: 'revenue',
    })
    expect(resolver('給与手当')).toEqual({
      accountCode: '600',
      accountName: '給与手当',
      category: 'sga_expense',
    })
  })

  it('falls back to budgets for budget-only P&L accounts (prefix-inferred category)', () => {
    expect(resolver('地代家賃')).toEqual({
      accountCode: '650',
      accountName: '地代家賃',
      category: 'sga_expense',
    })
  })

  it('rejects balance-sheet AccountItems and below-the-line budgets', () => {
    expect(resolver('現金')).toBeNull() // AccountItem categoryType 'assets'
    expect(resolver('未払金')).toBeNull() // 'liabilities'
    expect(resolver('支払利息')).toBeNull() // budget code 810 → null
  })

  it('returns null for unknown account names', () => {
    expect(resolver('存在しない勘定')).toBeNull()
    expect(resolver('')).toBeNull()
  })
})

describe('resolveJournalsToAccounts', () => {
  const resolver = buildAccountResolver({ actuals, budgets, accountItems })
  const { byAccount, unmatched } = resolveJournalsToAccounts({
    journals,
    resolver,
    fiscalYear: 2025,
    month: 6,
  })

  it('emits a one-sided P&L journal to its P&L account with the correct side', () => {
    const pay = byAccount.get('600')!
    expect(pay.journals).toHaveLength(1)
    expect(pay.journals[0]).toMatchObject({ journalId: 'j1', side: 'debit', amount: 940000 })
    expect(pay.journals[0].entryDate).toBe('2025-06-15')
  })

  it('emits revenue on the credit side', () => {
    const rev = byAccount.get('400')!
    expect(rev.journals).toHaveLength(1)
    expect(rev.journals[0]).toMatchObject({ journalId: 'j4', side: 'credit', amount: 10000000 })
  })

  it('emits budget-only account journals too', () => {
    const rent = byAccount.get('650')!
    expect(rent.journals).toHaveLength(1)
    expect(rent.journals[0]).toMatchObject({ journalId: 'j2', side: 'debit', amount: 100000 })
  })

  it('skips journals outside the period (not counted as unmatched)', () => {
    // j3 is in July; it should not appear anywhere and not inflate unmatched.
    const allJournalIds = [...byAccount.values()].flatMap((g) => g.journals.map((j) => j.journalId))
    expect(allJournalIds).not.toContain('j3')
  })

  it('counts journals resolving to no P&L account as unmatched', () => {
    // j5 (仮払金 / 未収入金) resolves to no P&L account.
    expect(unmatched).toBe(1)
  })
})

describe('prepareAttributionInput', () => {
  it('unions actuals ∪ budgets, aggregates budgets by code, and excludes non-P&L budgets', () => {
    const input = prepareAttributionInput({
      actuals,
      budgets,
      journals,
      accountItems,
      fiscalYear: 2025,
      month: 6,
    })

    const codes = input.accounts.map((a) => a.accountCode)
    expect(codes).toEqual(['400', '600', '650']) // 810 excluded (non-P&L)
    expect(input.unmatchedJournalCount).toBe(1)

    const pay = input.accounts.find((a) => a.accountCode === '600')!
    expect(pay.budget).toBe(800000)
    expect(pay.actual).toBe(940000)
    expect(pay.journals[0].side).toBe('debit')

    const rev = input.accounts.find((a) => a.accountCode === '400')!
    expect(rev.budget).toBe(9500000)
    expect(rev.actual).toBe(10000000)
    expect(rev.journals[0].side).toBe('credit')

    // Budget-only account (no actual).
    const rent = input.accounts.find((a) => a.accountCode === '650')!
    expect(rent.budget).toBe(200000)
    expect(rent.actual).toBe(0)
    expect(rent.category).toBe('sga_expense')
  })

  it('scopes budgets to a department when departmentId is provided (journals stay company-wide)', () => {
    const deptBudgets: BudgetRow[] = [
      { accountCode: '600', accountName: '給与手当', amount: 500000, departmentId: 'dept-A' },
      { accountCode: '600', accountName: '給与手当', amount: 300000, departmentId: 'dept-B' },
    ]
    const scoped = prepareAttributionInput({
      actuals,
      budgets: deptBudgets,
      journals: [],
      fiscalYear: 2025,
      month: 6,
      departmentId: 'dept-A',
    })
    expect(scoped.accounts.find((a) => a.accountCode === '600')!.budget).toBe(500000)

    const all = prepareAttributionInput({
      actuals,
      budgets: deptBudgets,
      journals: [],
      fiscalYear: 2025,
      month: 6,
    })
    // departmentId undefined → both departments summed.
    expect(all.accounts.find((a) => a.accountCode === '600')!.budget).toBe(800000)
  })

  it('passes actualsSource through', () => {
    const input = prepareAttributionInput({
      actuals,
      budgets: [],
      journals: [],
      fiscalYear: 2025,
      month: 6,
      actualsSource: 'sample',
    })
    expect(input.actualsSource).toBe('sample')
  })
})

describe('computeVarianceAttribution (async, mocked DB)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads budgets + journals + account items and returns a success Result', async () => {
    vi.mocked(getBudgetsByMonth).mockResolvedValue(budgets as any)
    vi.mocked(prisma.journal.findMany).mockResolvedValue(journals as any)
    vi.mocked(prisma.accountItem.findMany).mockResolvedValue(accountItems as any)

    const result = await computeVarianceAttribution({
      companyId: 'company-1',
      fiscalYear: 2025,
      month: 6,
      actuals,
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    const codes = result.data.accounts.map((a) => a.accountCode)
    expect(codes).toEqual(['400', '600', '650'])

    // 給与手当: actual 940,000 − budget 800,000 = 140,000 (unfavorable expense over-run).
    const pay = result.data.accounts.find((a) => a.accountCode === '600')!
    expect(pay.variance).toBe(140000)
    expect(pay.favorable).toBe(false)
    expect(pay.reconciliation.unreconciled).toBe(0) // journal sums exactly to actual

    expect(result.data.dataQuality.unmatchedJournalCount).toBe(1)
    // period filter applied to journals
    expect(prisma.journal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: 'company-1',
          entryDate: {
            gte: new Date('2025-06-01T00:00:00.000Z'),
            lte: new Date('2025-06-30T23:59:59.999Z'),
          },
        }),
      })
    )
  })

  it('returns failure for an invalid month', async () => {
    const result = await computeVarianceAttribution({
      companyId: 'company-1',
      fiscalYear: 2025,
      month: 13,
      actuals,
    })
    expect(result.success).toBe(false)
  })

  it('returns failure for an empty companyId', async () => {
    const result = await computeVarianceAttribution({
      companyId: '',
      fiscalYear: 2025,
      month: 6,
      actuals,
    })
    expect(result.success).toBe(false)
  })

  it('returns failure when the DB load throws', async () => {
    vi.mocked(getBudgetsByMonth).mockRejectedValue(new Error('db down'))
    vi.mocked(prisma.journal.findMany).mockResolvedValue([])
    vi.mocked(prisma.accountItem.findMany).mockResolvedValue([])

    const result = await computeVarianceAttribution({
      companyId: 'company-1',
      fiscalYear: 2025,
      month: 6,
      actuals,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('DATABASE_ERROR')
    }
  })
})
