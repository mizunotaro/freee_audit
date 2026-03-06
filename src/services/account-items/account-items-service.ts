import { freeeClient, type FreeeAccountItem } from '@/integrations/freee/client'
import { prisma } from '@/lib/db'

export interface AccountItem {
  id: string
  freeeId: number
  companyId: string
  name: string
  shortcut: string | null
  shortcutNum: string | null
  categoryId: number
  categoryName: string
  categoryType: AccountCategoryType
  correspondingIncomeId: number | null
  correspondingIncomeName: string | null
  correspondingExpenseId: number | null
  correspondingExpenseName: string | null
  searchable: boolean
  cumulable: boolean
  balance: 'debit' | 'credit'
}

export type AccountCategoryType =
  | 'current_assets'
  | 'fixed_assets'
  | 'deferred_assets'
  | 'current_liabilities'
  | 'fixed_liabilities'
  | 'net_assets'
  | 'sales'
  | 'cost_of_sales'
  | 'sga_expenses'
  | 'non_operating_income'
  | 'non_operating_expenses'
  | 'special_income'
  | 'special_loss'
  | 'corporate_tax_etc'
  | 'balance_forward'

export async function syncAccountItemsFromFreee(
  companyId: string,
  freeeCompanyId: number
): Promise<{ success: boolean; imported: number; error?: string }> {
  try {
    const result = await freeeClient.getAccountItems(freeeCompanyId)

    if (result.error) {
      return { success: false, imported: 0, error: result.error.message }
    }

    const items = result.data || []
    let imported = 0

    for (const item of items) {
      await prisma.accountItem.upsert({
        where: {
          companyId_freeeId: {
            companyId,
            freeeId: item.id,
          },
        },
        update: {
          name: item.name,
          shortcut: item.shortcut,
          shortcutNum: item.shortcut_num,
          categoryId: item.account_category_id,
          categoryName: item.account_category_name,
          categoryType: mapCategoryType(item.account_category),
          correspondingIncomeId: item.corresponding_income_id,
          correspondingIncomeName: item.corresponding_income_name,
          correspondingExpenseId: item.corresponding_expense_id,
          correspondingExpenseName: item.corresponding_expense_name,
          searchable: item.searchable,
          cumulable: item.cumulable,
          balance: item.account_category_balance === 'debit' ? 'debit' : 'credit',
        },
        create: {
          companyId,
          freeeId: item.id,
          name: item.name,
          shortcut: item.shortcut,
          shortcutNum: item.shortcut_num,
          categoryId: item.account_category_id,
          categoryName: item.account_category_name,
          categoryType: mapCategoryType(item.account_category),
          correspondingIncomeId: item.corresponding_income_id,
          correspondingIncomeName: item.corresponding_income_name,
          correspondingExpenseId: item.corresponding_expense_id,
          correspondingExpenseName: item.corresponding_expense_name,
          searchable: item.searchable,
          cumulable: item.cumulable,
          balance: item.account_category_balance === 'debit' ? 'debit' : 'credit',
        },
      })
      imported++
    }

    return { success: true, imported }
  } catch (error) {
    console.error('Failed to sync account items:', error)
    return {
      success: false,
      imported: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export async function getAccountItems(companyId: string): Promise<AccountItem[]> {
  const items = await prisma.accountItem.findMany({
    where: { companyId },
    orderBy: [{ categoryId: 'asc' }, { shortcutNum: 'asc' }],
  })

  return items.map((item) => ({
    id: item.id,
    freeeId: item.freeeId,
    companyId: item.companyId,
    name: item.name,
    shortcut: item.shortcut,
    shortcutNum: item.shortcutNum,
    categoryId: item.categoryId,
    categoryName: item.categoryName,
    categoryType: item.categoryType as AccountCategoryType,
    correspondingIncomeId: item.correspondingIncomeId,
    correspondingIncomeName: item.correspondingIncomeName,
    correspondingExpenseId: item.correspondingExpenseId,
    correspondingExpenseName: item.correspondingExpenseName,
    searchable: item.searchable,
    cumulable: item.cumulable,
    balance: item.balance as 'debit' | 'credit',
  }))
}

export async function getAccountItemsByCategory(
  companyId: string,
  categoryType: AccountCategoryType
): Promise<AccountItem[]> {
  const items = await prisma.accountItem.findMany({
    where: { companyId, categoryType },
    orderBy: { shortcutNum: 'asc' },
  })

  return items.map((item) => ({
    id: item.id,
    freeeId: item.freeeId,
    companyId: item.companyId,
    name: item.name,
    shortcut: item.shortcut,
    shortcutNum: item.shortcutNum,
    categoryId: item.categoryId,
    categoryName: item.categoryName,
    categoryType: item.categoryType as AccountCategoryType,
    correspondingIncomeId: item.correspondingIncomeId,
    correspondingIncomeName: item.correspondingIncomeName,
    correspondingExpenseId: item.correspondingExpenseId,
    correspondingExpenseName: item.correspondingExpenseName,
    searchable: item.searchable,
    cumulable: item.cumulable,
    balance: item.balance as 'debit' | 'credit',
  }))
}

function mapCategoryType(category: string): AccountCategoryType {
  const mapping: Record<string, AccountCategoryType> = {
    current_assets: 'current_assets',
    fixed_assets: 'fixed_assets',
    deferred_assets: 'deferred_assets',
    current_liabilities: 'current_liabilities',
    fixed_liabilities: 'fixed_liabilities',
    net_assets: 'net_assets',
    sales: 'sales',
    cost_of_sales: 'cost_of_sales',
    sga_expenses: 'sga_expenses',
    non_operating_income: 'non_operating_income',
    non_operating_expenses: 'non_operating_expenses',
    special_income: 'special_income',
    special_loss: 'special_loss',
    corporate_tax_etc: 'corporate_tax_etc',
    balance_forward: 'balance_forward',
  }
  return mapping[category] || 'sga_expenses'
}

export function groupAccountItemsByCategory(items: AccountItem[]): Map<string, AccountItem[]> {
  const grouped = new Map<string, AccountItem[]>()

  for (const item of items) {
    const category = item.categoryName
    if (!grouped.has(category)) {
      grouped.set(category, [])
    }
    grouped.get(category)!.push(item)
  }

  return grouped
}
