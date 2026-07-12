import { describe, it, expect, vi } from 'vitest'
import type { ProfitLoss } from '@/types'
import {
  buildAccountResolver,
  resolveJournalsToAccounts,
  prepareAttributionInput,
  computeVarianceAttribution,
  type BudgetRow,
  type JournalRow,
  type AccountItemRow,
} from '@/services/budget/variance-attribution-loader'

/**
 * EDGE-01 — error / edge-case deepening for the variance-attribution loader.
 *
 * Covers branches left uncovered by variance-attribution-loader.test.ts:
 *   - inferCategoryFromType: income / cogs / expense hits (existing suite only
 *     exercised balance-sheet types via actuals-shadowed items) and a null
 *     categoryType (the `?? ''` fallback).
 *   - AccountItem code fallback chain: shortcutNum → shortcut → String(freeeId).
 *   - buildAccountResolver costOfSales loop (existing actuals had empty costOfSales).
 *   - pushJournal: a second journal to the same account (the `existing` branch).
 *   - prepareAttributionInput: costOfSales actuals, and a null-departmentId budget
 *     excluded by the department scope filter.
 *   - computeVarianceAttribution: non-integer fiscalYear (returns before any DB call).
 *
 * Only pure helpers + the pre-DB validation path are exercised, so the prisma /
 * getBudgetsByMonth mocks are stubs that are never invoked.
 */

vi.mock('@/lib/db', () => ({
  prisma: {
    journal: { findMany: vi.fn() },
    accountItem: { findMany: vi.fn() },
  },
}))
vi.mock('@/services/budget/budget-service', () => ({
  getBudgetsByMonth: vi.fn(),
}))

const actuals: ProfitLoss = {
  fiscalYear: 2025,
  month: 6,
  revenue: [{ code: '400', name: '売上高', amount: 10000000 }],
  costOfSales: [{ code: '500', name: '売上原価', amount: 6000000 }],
  grossProfit: 4000000,
  grossProfitMargin: 40,
  sgaExpenses: [{ code: '600', name: '給与手当', amount: 940000 }],
  operatingIncome: 3060000,
  operatingMargin: 30.6,
  nonOperatingIncome: [],
  nonOperatingExpenses: [],
  ordinaryIncome: 3060000,
  extraordinaryIncome: [],
  extraordinaryLoss: [],
  incomeBeforeTax: 3060000,
  incomeTax: 918000,
  netIncome: 2142000,
  depreciation: 0,
}

describe('buildAccountResolver — AccountItem category-type inference & code fallbacks', () => {
  // Each item has a name absent from actuals/budgets so the AccountItem loop
  // actually runs inferCategoryFromType for it.
  const accountItems: AccountItemRow[] = [
    { name: '受取利息', shortcutNum: '410', shortcut: null, freeeId: 4100, categoryType: 'income' },
    { name: '仕入', shortcutNum: null, shortcut: '510', freeeId: 5100, categoryType: 'cogs' },
    { name: '消耗品費', shortcutNum: null, shortcut: null, freeeId: 6100, categoryType: 'expense' },
    { name: '雑勘定', shortcutNum: null, shortcut: null, freeeId: 9900, categoryType: null },
  ]
  const resolver = buildAccountResolver({ actuals, budgets: [], accountItems })

  it('infers revenue from categoryType income and uses shortcutNum as the code', () => {
    expect(resolver('受取利息')).toEqual({
      accountCode: '410',
      accountName: '受取利息',
      category: 'revenue',
    })
  })

  it('infers cost_of_sales from categoryType cogs and falls back to shortcut', () => {
    expect(resolver('仕入')).toEqual({
      accountCode: '510',
      accountName: '仕入',
      category: 'cost_of_sales',
    })
  })

  it('infers sga_expense from categoryType expense and falls back to String(freeeId)', () => {
    expect(resolver('消耗品費')).toEqual({
      accountCode: '6100',
      accountName: '消耗品費',
      category: 'sga_expense',
    })
  })

  it('returns null when categoryType is null and the freeeId-derived code is non-P&L', () => {
    // categoryType null → `?? ''` → empty string → falls through every type check →
    // inferCategoryFromCode('9900') → null → not attributable.
    expect(resolver('雑勘定')).toBeNull()
  })

  it('resolves a costOfSales actual through the costOfSales resolver loop', () => {
    expect(resolver('売上原価')).toEqual({
      accountCode: '500',
      accountName: '売上原価',
      category: 'cost_of_sales',
    })
  })
})

describe('resolveJournalsToAccounts — multiple journals to one account', () => {
  it('accumulates two journals debiting the same account into one group', () => {
    const resolver = buildAccountResolver({ actuals, budgets: [], accountItems: [] })
    const journals: JournalRow[] = [
      {
        id: 'j1',
        freeeJournalId: 'fj1',
        entryDate: new Date('2025-06-10T00:00:00.000Z'),
        description: 'pay1',
        debitAccount: '給与手当',
        creditAccount: '現金',
        amount: 500000,
      },
      {
        id: 'j2',
        freeeJournalId: 'fj2',
        entryDate: new Date('2025-06-15T00:00:00.000Z'),
        description: 'pay2',
        debitAccount: '給与手当',
        creditAccount: '現金',
        amount: 440000,
      },
    ]
    const { byAccount } = resolveJournalsToAccounts({
      journals,
      resolver,
      fiscalYear: 2025,
      month: 6,
    })
    const pay = byAccount.get('600')!
    expect(pay.journals).toHaveLength(2)
    expect(pay.journals.map((j) => j.journalId)).toEqual(['j1', 'j2'])
  })
})

describe('prepareAttributionInput — costOfSales actuals & department scope', () => {
  it('includes costOfSales accounts from actuals in the attribution input', () => {
    const input = prepareAttributionInput({
      actuals,
      budgets: [],
      journals: [],
      fiscalYear: 2025,
      month: 6,
    })
    const cogs = input.accounts.find((a) => a.accountCode === '500')!
    expect(cogs.category).toBe('cost_of_sales')
    expect(cogs.actual).toBe(6000000)
  })

  it('excludes a null-departmentId budget when scoping to a specific department', () => {
    const budgets: BudgetRow[] = [
      { accountCode: '600', accountName: '給与手当', amount: 500000, departmentId: null },
      { accountCode: '600', accountName: '給与手当', amount: 300000, departmentId: 'dept-A' },
    ]
    const scoped = prepareAttributionInput({
      actuals,
      budgets,
      journals: [],
      fiscalYear: 2025,
      month: 6,
      departmentId: 'dept-A',
    })
    // The null-departmentId row is filtered out (null ?? '' === 'dept-A' is false);
    // only the dept-A row (300,000) is summed.
    expect(scoped.accounts.find((a) => a.accountCode === '600')!.budget).toBe(300000)
  })
})

describe('computeVarianceAttribution — non-integer fiscalYear', () => {
  it('returns VALIDATION_ERROR before any DB access', async () => {
    const result = await computeVarianceAttribution({
      companyId: 'company-1',
      fiscalYear: 2025.5,
      month: 6,
      actuals,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR')
    }
  })
})
