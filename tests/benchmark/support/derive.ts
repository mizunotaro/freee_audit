import { z } from 'zod'
import type { Journal, ProfitLoss, ProfitLossItem } from '@/types'
import {
  failure,
  success,
  type Result,
  type AppError,
  createAppError,
  ERROR_CODES,
} from '@/types/result'
import { accountByCode } from './accounts'

export interface DerivedBalanceRow {
  id: string
  companyId: string
  fiscalYear: number
  month: number
  accountCode: string
  accountName: string
  category: string
  amount: number
}

const journalsArraySchema = z.array(
  z.object({
    companyId: z.string(),
    entryDate: z.instanceof(Date),
    debitAccount: z.string(),
    creditAccount: z.string(),
    amount: z.number(),
  })
)

/**
 * Aggregates journals into monthly balance rows keyed by (month, accountCode).
 * Both legs of each double-entry posting contribute to their respective account
 * balances, producing rows in every report category across all 12 months.
 *
 * This mirrors the shape the real report pipeline reads (MonthlyBalanceRow) so
 * the benchmark exercises the production aggregation path at a realistic scale.
 */
export function journalsToBalanceRows(
  journals: Journal[],
  companyId: string,
  fiscalYear: number
): Result<DerivedBalanceRow[], AppError> {
  const parsed = journalsArraySchema.safeParse(journals)
  if (!parsed.success) {
    return failure(createAppError(ERROR_CODES.VALIDATION_ERROR, parsed.error.message))
  }

  const byKey = new Map<string, DerivedBalanceRow>()

  for (const j of journals) {
    const month = j.entryDate.getMonth() + 1
    for (const code of [j.debitAccount, j.creditAccount]) {
      const account = accountByCode(code)
      if (!account) continue
      const key = `${month}|${code}`
      const existing = byKey.get(key)
      if (existing) {
        existing.amount += j.amount
      } else {
        byKey.set(key, {
          id: `bal-${month}-${code}`,
          companyId,
          fiscalYear,
          month,
          accountCode: code,
          accountName: account.name,
          category: account.category,
          amount: j.amount,
        })
      }
    }
  }

  return success([...byKey.values()])
}

function aggregateItems(
  journals: Journal[],
  select: (j: Journal) => { code: string; amount: number } | null
): ProfitLossItem[] {
  const totals = new Map<string, number>()
  for (const j of journals) {
    const picked = select(j)
    if (!picked) continue
    totals.set(picked.code, (totals.get(picked.code) ?? 0) + picked.amount)
  }
  const items: ProfitLossItem[] = []
  for (const [code, amount] of totals) {
    const account = accountByCode(code)
    items.push({ code, name: account?.name ?? code, amount })
  }
  return items
}

/**
 * Builds a ProfitLoss for a single month by classifying each journal through its
 * account category: revenue (credited), cost of sales (debited), SGA (debited).
 */
export function journalsToProfitLoss(
  journals: Journal[],
  fiscalYear: number,
  month: number
): Result<ProfitLoss, AppError> {
  const parsed = journalsArraySchema.safeParse(journals)
  if (!parsed.success) {
    return failure(createAppError(ERROR_CODES.VALIDATION_ERROR, parsed.error.message))
  }

  const monthJournals = journals.filter((j) => j.entryDate.getMonth() + 1 === month)

  const revenue = aggregateItems(monthJournals, (j) =>
    accountByCode(j.creditAccount)?.category === 'revenue'
      ? { code: j.creditAccount, amount: j.amount }
      : null
  )
  const costOfSales = aggregateItems(monthJournals, (j) =>
    accountByCode(j.debitAccount)?.category === 'cost_of_sales'
      ? { code: j.debitAccount, amount: j.amount }
      : null
  )
  const sgaExpenses = aggregateItems(monthJournals, (j) =>
    accountByCode(j.debitAccount)?.category === 'sga_expense'
      ? { code: j.debitAccount, amount: j.amount }
      : null
  )

  const totalRevenue = revenue.reduce((s, r) => s + r.amount, 0)
  const totalCost = costOfSales.reduce((s, c) => s + c.amount, 0)
  const grossProfit = totalRevenue - totalCost
  const grossProfitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0
  const totalSga = sgaExpenses.reduce((s, e) => s + e.amount, 0)
  const operatingIncome = grossProfit - totalSga
  const operatingMargin = totalRevenue > 0 ? (operatingIncome / totalRevenue) * 100 : 0
  const depreciation = sgaExpenses.find((e) => e.name.includes('償却'))?.amount ?? 0

  const profitLoss: ProfitLoss = {
    fiscalYear,
    month,
    revenue,
    costOfSales,
    grossProfit,
    grossProfitMargin,
    sgaExpenses,
    operatingIncome,
    operatingMargin,
    nonOperatingIncome: [],
    nonOperatingExpenses: [],
    ordinaryIncome: operatingIncome,
    extraordinaryIncome: [],
    extraordinaryLoss: [],
    incomeBeforeTax: operatingIncome,
    incomeTax: Math.round(operatingIncome * 0.3),
    netIncome: Math.round(operatingIncome * 0.7),
    depreciation,
  }

  return success(profitLoss)
}
