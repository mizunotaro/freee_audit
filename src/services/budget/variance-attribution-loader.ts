import { prisma } from '@/lib/db'
import type { ProfitLoss } from '@/types'
import {
  failure,
  tryCatch,
  createAppError,
  ERROR_CODES,
  type Result,
  type AppError,
} from '@/types/result'
import { getBudgetsByMonth } from './budget-service'
import {
  attributeVariance,
  type ActualsSource,
  type AccountAttributionInput,
  type AttributionInput,
  type AttributionOptions,
  type JournalEntry,
  type VarianceAttribution,
} from './variance-attribution'

/**
 * FIN-IMPL-01 — DB loader + account-key crosswalk for variance attribution.
 *
 * The pure attribution math lives in `variance-attribution.ts`. This module:
 *   1. Builds an account-key resolver from the union of actuals, budgets, and
 *      `AccountItem` rows (proposal §4.3: there are three incompatible account keys —
 *      journal stores the account *name*, budget stores a user *code*, MonthlyBalance
 *      stores a freee numeric *id* or user code). The resolver maps a journal's account
 *      name to the canonical accountCode + P&L category. It is best-effort; journals that
 *      fail to resolve are counted as `unmatched` and never attributed (honest signal).
 *   2. Resolves each journal to the P&L account(s) it touches (debit and/or credit side).
 *   3. Loads Budget + Journal + AccountItem (READ-ONLY inputs) and calls the pure core.
 *
 * `Journal`/`Budget`/`AccountItem` are read-only here; no Class-A path is modified.
 */

export type PlCategory = 'revenue' | 'cost_of_sales' | 'sga_expense'

export interface AccountResolution {
  accountCode: string
  accountName: string
  category: PlCategory
}

/** Maps a journal account key (the stored account *name*) → canonical resolution. */
export type AccountResolver = (accountKey: string) => AccountResolution | null

/** Minimal Budget shape consumed by the loader (subset of the Prisma `Budget` row). */
export interface BudgetRow {
  accountCode: string
  accountName: string
  amount: number
  departmentId?: string | null
}

/** Minimal Journal shape consumed by the loader (subset of the Prisma `Journal` row). */
export interface JournalRow {
  id: string
  freeeJournalId: string
  entryDate: Date
  description: string
  debitAccount: string
  creditAccount: string
  amount: number
}

/** Minimal AccountItem shape consumed by the loader (subset of the Prisma row). */
export interface AccountItemRow {
  name: string
  shortcut?: string | null
  shortcutNum?: string | null
  freeeId: number
  categoryType?: string | null
}

/**
 * Infers a P&L category from an account code by prefix (4xx revenue, 5xx cost of sales,
 * 6xx/7xx SGA). This duplicates the prefix method in `detailed-actual-vs-budget.ts:193`
 * and intentionally DISAGREES with the freee id-range method in `data-sync.ts:187`
 * (proposal §4.4). Used only as a fallback for accounts absent from the actuals P&L
 * (budget-only or AccountItem-only rows), where no authoritative category exists.
 *
 * Returns `null` for non-P&L / below-the-line prefixes (assets 1xx, liabilities 2xx,
 * equity 3xx, non-operating 8xx/9xx) so the resolver never attributes a balance-sheet
 * account or a synthetic below-the-line section (proposal §6.3 not_applicable).
 *
 * `PENDING HUMAN DETERMINATION`: replace both methods with a single authoritative
 * account→category map driven by `AccountItem.categoryType` (proposal §7.4, Class-A).
 */
export function inferCategoryFromCode(code: string): PlCategory | null {
  if (code.startsWith('4')) return 'revenue'
  if (code.startsWith('5')) return 'cost_of_sales'
  if (code.startsWith('6') || code.startsWith('7')) return 'sga_expense'
  return null
}

/**
 * Infers a P&L category from an `AccountItem.categoryType` string, with prefix fallback.
 * freee `category_type` values include `assets`, `liabilities`, `equity`, `income`,
 * `expense`, `cogs`/`cost_of_sales`. Mapping is conservative: only `income`→revenue,
 * `cogs`/`cost_of_sales`→cost_of_sales, and `expense`→sga_expense are inferred; balance-
 * sheet types fall back to the code prefix (and return `null` for non-P&L codes) so they
 * are never attributed.
 *
 * `PENDING HUMAN DETERMINATION` on the exact `category_type` vocabulary.
 */
function inferCategoryFromType(
  categoryType: string | null | undefined,
  fallbackCode: string
): PlCategory | null {
  const t = (categoryType ?? '').toLowerCase()
  if (t === 'income' || t === 'revenue') return 'revenue'
  if (t === 'cogs' || t === 'cost_of_sales') return 'cost_of_sales'
  if (t === 'expense') return 'sga_expense'
  return inferCategoryFromCode(fallbackCode)
}

/**
 * Builds a name→resolution map from the union of actuals (authoritative category), budget
 * rows, and AccountItem rows. Actuals win because their P&L array position is the only
 * authoritative category source; budgets and AccountItems are fallbacks (prefix/type
 * inferred). Lookup is by account *name* because `Journal.debitAccount`/`creditAccount`
 * store the account name (proposal §4.3).
 *
 * @param actuals - Actual P&L (carries authoritative code + name + category).
 * @param budgets - Budget rows (code + name).
 * @param accountItems - AccountItem rows (name + shortcut/shortcutNum/freeeId + type).
 * @returns A resolver function from account name to resolution (or `null`).
 */
export function buildAccountResolver(params: {
  actuals: ProfitLoss
  budgets: BudgetRow[]
  accountItems?: AccountItemRow[]
}): AccountResolver {
  const byName = new Map<string, AccountResolution>()

  for (const r of params.actuals.revenue) {
    byName.set(r.name, { accountCode: r.code, accountName: r.name, category: 'revenue' })
  }
  for (const c of params.actuals.costOfSales) {
    byName.set(c.name, { accountCode: c.code, accountName: c.name, category: 'cost_of_sales' })
  }
  for (const e of params.actuals.sgaExpenses) {
    byName.set(e.name, { accountCode: e.code, accountName: e.name, category: 'sga_expense' })
  }

  for (const b of params.budgets) {
    if (byName.has(b.accountName)) continue
    const category = inferCategoryFromCode(b.accountCode)
    if (category === null) continue // non-P&L / below-the-line budget: not attributable
    byName.set(b.accountName, {
      accountCode: b.accountCode,
      accountName: b.accountName,
      category,
    })
  }

  for (const ai of params.accountItems ?? []) {
    if (byName.has(ai.name)) continue
    const code = ai.shortcutNum ?? ai.shortcut ?? String(ai.freeeId)
    const category = inferCategoryFromType(ai.categoryType, code)
    if (category === null) continue // balance-sheet account: not attributable
    byName.set(ai.name, { accountCode: code, accountName: ai.name, category })
  }

  return (key: string) => (key ? (byName.get(key) ?? null) : null)
}

/**
 * Returns the ISO calendar window `[start, end]` (inclusive) for a fiscal year + month.
 *
 * `PENDING HUMAN DETERMINATION`: assumes `fiscalYear`/`month` are calendar-aligned
 * (month = calendar month of `fiscalYear`). Fiscal-year-start handling is out of scope.
 */
export function periodWindow(fiscalYear: number, month: number): { start: string; end: string } {
  const start = new Date(Date.UTC(fiscalYear, month - 1, 1))
  const end = new Date(Date.UTC(fiscalYear, month, 0))
  return { start: toIsoDate(start), end: toIsoDate(end) }
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/**
 * Resolves each journal to the P&L account(s) it touches within the period, grouping by
 * canonical accountCode. A journal is emitted to a side only if that side's account
 * resolves to a P&L account in scope (revenue/cost_of_sales/sga_expense); the other side
 * is typically a balance-sheet account (cash, payables) and is ignored. A journal touching
 * two P&L accounts (e.g. a reclassification) is emitted to both with opposite sides, so it
 * nets to zero across the pair (proposal §6.3 reclass edge case). Journals resolving to no
 * P&L account are counted as `unmatched`.
 *
 * @param journals - Raw journal rows (READ-ONLY).
 * @param resolver - Account-key resolver from `buildAccountResolver`.
 * @param fiscalYear - Fiscal year (calendar-aligned).
 * @param month - Period month (1-12).
 * @returns Grouped journals by accountCode + the unmatched count.
 */
export function resolveJournalsToAccounts(params: {
  journals: JournalRow[]
  resolver: AccountResolver
  fiscalYear: number
  month: number
}): {
  byAccount: Map<string, { resolution: AccountResolution; journals: JournalEntry[] }>
  unmatched: number
} {
  const { journals, resolver, fiscalYear, month } = params
  const window = periodWindow(fiscalYear, month)
  const byAccount = new Map<string, { resolution: AccountResolution; journals: JournalEntry[] }>()
  let unmatched = 0

  for (const j of journals) {
    const iso = toIsoDate(j.entryDate)
    if (iso < window.start || iso > window.end) continue

    const debit = resolver(j.debitAccount)
    const credit = resolver(j.creditAccount)
    let emitted = false

    if (debit) {
      pushJournal(byAccount, debit, {
        journalId: j.id,
        freeeJournalId: j.freeeJournalId,
        entryDate: iso,
        description: j.description,
        amount: j.amount,
        side: 'debit',
      })
      emitted = true
    }
    if (credit) {
      pushJournal(byAccount, credit, {
        journalId: j.id,
        freeeJournalId: j.freeeJournalId,
        entryDate: iso,
        description: j.description,
        amount: j.amount,
        side: 'credit',
      })
      emitted = true
    }
    if (!emitted) unmatched += 1
  }

  return { byAccount, unmatched }
}

function pushJournal(
  byAccount: Map<string, { resolution: AccountResolution; journals: JournalEntry[] }>,
  resolution: AccountResolution,
  entry: JournalEntry
): void {
  const existing = byAccount.get(resolution.accountCode)
  if (existing) {
    existing.journals.push(entry)
  } else {
    byAccount.set(resolution.accountCode, { resolution, journals: [entry] })
  }
}

/**
 * Builds the pure-core `AttributionInput` from loaded data: aggregates budgets by
 * accountCode (summing across departments), resolves journals to accounts, and unions
 * actuals ∪ budgets into the per-account input list. Pure (no Prisma) so it is unit-tested
 * with plain arrays.
 *
 * `PENDING HUMAN DETERMINATION`: journal attribution is company-wide — `Journal` has no
 * `departmentId`/segment (proposal §4.3), so a `departmentId` filter applies to budgets
 * only and cannot scope the journals. Department-level variance is therefore not feasible
 * on persisted data; the default is company-wide (departmentId undefined).
 */
export function prepareAttributionInput(params: {
  actuals: ProfitLoss
  budgets: BudgetRow[]
  journals: JournalRow[]
  accountItems?: AccountItemRow[]
  fiscalYear: number
  month: number
  departmentId?: string | null
  actualsSource?: ActualsSource
}): AttributionInput {
  const {
    actuals,
    budgets,
    journals,
    accountItems,
    fiscalYear,
    month,
    departmentId,
    actualsSource = 'monthly_balance',
  } = params

  const deptFilter = departmentId ?? ''
  const scopedBudgets =
    departmentId !== undefined
      ? budgets.filter((b) => (b.departmentId ?? '') === deptFilter)
      : budgets

  const budgetByCode = new Map<
    string,
    { accountCode: string; accountName: string; amount: number }
  >()
  for (const b of scopedBudgets) {
    const existing = budgetByCode.get(b.accountCode)
    if (existing) {
      existing.amount += b.amount
    } else {
      budgetByCode.set(b.accountCode, {
        accountCode: b.accountCode,
        accountName: b.accountName,
        amount: b.amount,
      })
    }
  }

  const resolver = buildAccountResolver({
    actuals,
    budgets: [...budgetByCode.values()],
    accountItems,
  })
  const { byAccount, unmatched } = resolveJournalsToAccounts({
    journals,
    resolver,
    fiscalYear,
    month,
  })

  const accounts: AccountAttributionInput[] = []
  const seen = new Set<string>()

  const push = (code: string, name: string, category: PlCategory, actual: number) => {
    if (seen.has(code)) return
    seen.add(code)
    accounts.push({
      accountCode: code,
      accountName: name,
      category,
      budget: budgetByCode.get(code)?.amount ?? 0,
      actual,
      journals: byAccount.get(code)?.journals ?? [],
    })
  }

  for (const r of actuals.revenue) push(r.code, r.name, 'revenue', r.amount)
  for (const c of actuals.costOfSales) push(c.code, c.name, 'cost_of_sales', c.amount)
  for (const e of actuals.sgaExpenses) push(e.code, e.name, 'sga_expense', e.amount)

  for (const b of budgetByCode.values()) {
    const category = inferCategoryFromCode(b.accountCode)
    if (category === null) continue // non-P&L budget: not attributable
    push(b.accountCode, b.accountName, category, 0)
  }

  return {
    fiscalYear,
    month,
    actualsSource,
    accounts,
    unmatchedJournalCount: unmatched,
  }
}

/**
 * Loads Budget + Journal + AccountItem (READ-ONLY) for a company/period and computes the
 * full variance attribution via the pure core. Journals and ledger data are read-only
 * inputs; all computation is in the non-Class-A budget service.
 *
 * @param params - Company id, fiscal year, month, actual P&L, attribution options, and an
 *   optional `departmentId` (budgets-only filter; journals stay company-wide) and
 *   `actualsSource` (default `monthly_balance`; set `sample`/`mock` when feeding synthetic
 *   P&L so the data-quality warning fires).
 * @returns `success(VarianceAttribution)` or `failure(AppError)` on validation/DB error.
 */
export async function computeVarianceAttribution(params: {
  companyId: string
  fiscalYear: number
  month: number
  actuals: ProfitLoss
  options?: AttributionOptions
  departmentId?: string | null
  actualsSource?: ActualsSource
}): Promise<Result<VarianceAttribution, AppError>> {
  const { companyId, fiscalYear, month, actuals, options, departmentId, actualsSource } = params

  if (!companyId) {
    return failure(createAppError(ERROR_CODES.VALIDATION_ERROR, 'companyId is required'))
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return failure(createAppError(ERROR_CODES.VALIDATION_ERROR, 'month must be an integer 1-12'))
  }
  if (!Number.isInteger(fiscalYear)) {
    return failure(createAppError(ERROR_CODES.VALIDATION_ERROR, 'fiscalYear must be an integer'))
  }

  const window = periodWindow(fiscalYear, month)
  const loadResult = await tryCatch(async () => {
    const [budgets, journals, accountItems] = await Promise.all([
      getBudgetsByMonth(companyId, fiscalYear, month),
      prisma.journal.findMany({
        where: {
          companyId,
          entryDate: {
            gte: new Date(window.start + 'T00:00:00.000Z'),
            lte: new Date(window.end + 'T23:59:59.999Z'),
          },
        },
      }),
      prisma.accountItem.findMany({ where: { companyId } }),
    ])
    return { budgets, journals, accountItems }
  }, ERROR_CODES.DATABASE_ERROR)
  if (!loadResult.success) return loadResult

  const { budgets, journals, accountItems } = loadResult.data
  const input = prepareAttributionInput({
    actuals,
    budgets: budgets.map((b) => ({
      accountCode: b.accountCode,
      accountName: b.accountName,
      amount: b.amount,
      departmentId: b.departmentId,
    })),
    journals: journals.map((j) => ({
      id: j.id,
      freeeJournalId: j.freeeJournalId,
      entryDate: j.entryDate,
      description: j.description,
      debitAccount: j.debitAccount,
      creditAccount: j.creditAccount,
      amount: j.amount,
    })),
    accountItems: accountItems.map((a) => ({
      name: a.name,
      shortcut: a.shortcut,
      shortcutNum: a.shortcutNum,
      freeeId: a.freeeId,
      categoryType: a.categoryType,
    })),
    fiscalYear,
    month,
    departmentId,
    actualsSource,
  })

  return attributeVariance(input, options)
}
