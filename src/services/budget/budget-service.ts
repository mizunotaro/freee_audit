import { prisma } from '@/lib/db'
import type { Budget } from '@prisma/client'

export interface CreateBudgetInput {
  companyId: string
  fiscalYear: number
  month: number
  departmentId?: string
  accountCode: string
  accountName: string
  amount: number
  note?: string
}

export interface UpdateBudgetInput {
  amount?: number
  departmentId?: string | null
  note?: string
}

export interface BudgetFilter {
  companyId: string
  fiscalYear?: number
  month?: number
  departmentId?: string
  accountCode?: string
}

/**
 * Creates a single budget entry.
 *
 * @param data - Budget fields (company, fiscal year, month, account, amount).
 * @returns The created Budget record.
 * @throws Rejected with a Prisma error if the write fails or a constraint is violated.
 */
export async function createBudget(data: CreateBudgetInput): Promise<Budget> {
  return prisma.budget.create({
    data: {
      companyId: data.companyId,
      fiscalYear: data.fiscalYear,
      month: data.month,
      departmentId: data.departmentId,
      accountCode: data.accountCode,
      accountName: data.accountName,
      amount: data.amount,
      note: data.note,
    },
  })
}

/**
 * Bulk-inserts budget entries via `createMany`.
 *
 * @param data - Budget entries to insert.
 * @returns The number of rows actually created.
 * @throws Rejected with a Prisma error on failure.
 */
export async function createBudgetBatch(data: CreateBudgetInput[]): Promise<number> {
  const result = await prisma.budget.createMany({
    data: data.map((item) => ({
      companyId: item.companyId,
      fiscalYear: item.fiscalYear,
      month: item.month,
      departmentId: item.departmentId,
      accountCode: item.accountCode,
      accountName: item.accountName,
      amount: item.amount,
      note: item.note,
    })),
  })
  return result.count
}

/**
 * Updates the amount, department, and/or note of an existing budget entry.
 *
 * @param id - Budget record id.
 * @param data - Fields to update.
 * @returns The updated Budget record.
 * @throws Rejected with a Prisma error (e.g. P2025) if the id does not exist.
 */
export async function updateBudget(id: string, data: UpdateBudgetInput): Promise<Budget> {
  return prisma.budget.update({
    where: { id },
    data: {
      amount: data.amount,
      departmentId: data.departmentId,
      note: data.note,
    },
  })
}

/**
 * Creates or updates a budget entry keyed by the unique constraint
 * (companyId, fiscalYear, month, departmentId, accountCode). A missing
 * `departmentId` is normalized to an empty string.
 *
 * @param data - Budget fields.
 * @returns The created or updated Budget record.
 * @throws Rejected with a Prisma error on failure.
 */
export async function upsertBudget(data: CreateBudgetInput): Promise<Budget> {
  return prisma.budget.upsert({
    where: {
      companyId_fiscalYear_month_departmentId_accountCode: {
        companyId: data.companyId,
        fiscalYear: data.fiscalYear,
        month: data.month,
        departmentId: data.departmentId || '',
        accountCode: data.accountCode,
      },
    },
    update: {
      amount: data.amount,
      accountName: data.accountName,
      note: data.note,
    },
    create: {
      companyId: data.companyId,
      fiscalYear: data.fiscalYear,
      month: data.month,
      departmentId: data.departmentId,
      accountCode: data.accountCode,
      accountName: data.accountName,
      amount: data.amount,
      note: data.note,
    },
  })
}

/**
 * Fetches a single budget entry by id.
 *
 * @param id - Budget record id.
 * @returns The Budget record, or `null` if not found.
 * @throws Rejected with a Prisma error on failure.
 */
export async function getBudgetById(id: string): Promise<Budget | null> {
  return prisma.budget.findUnique({
    where: { id },
  })
}

/**
 * Lists budget entries for a company, optionally filtered by fiscal year, month,
 * department, or account-code prefix (`startsWith`).
 *
 * @param filter - Filter criteria; `companyId` is required.
 * @returns Matching Budget records ordered by accountCode.
 * @throws Rejected with a Prisma error on failure.
 */
export async function getBudgets(filter: BudgetFilter): Promise<Budget[]> {
  return prisma.budget.findMany({
    where: {
      companyId: filter.companyId,
      fiscalYear: filter.fiscalYear,
      month: filter.month,
      departmentId: filter.departmentId,
      accountCode: filter.accountCode ? { startsWith: filter.accountCode } : undefined,
    },
    orderBy: [{ accountCode: 'asc' }],
  })
}

/**
 * Lists all budget entries for a company in a fiscal year.
 *
 * @param companyId - Company id.
 * @param fiscalYear - Fiscal year.
 * @returns Budget records ordered by month then accountCode.
 * @throws Rejected with a Prisma error on failure.
 */
export async function getBudgetsByFiscalYear(
  companyId: string,
  fiscalYear: number
): Promise<Budget[]> {
  return prisma.budget.findMany({
    where: {
      companyId,
      fiscalYear,
    },
    orderBy: [{ month: 'asc' }, { accountCode: 'asc' }],
  })
}

/**
 * Lists budget entries for a specific company and month within a fiscal year.
 *
 * @param companyId - Company id.
 * @param fiscalYear - Fiscal year.
 * @param month - Month (1-12).
 * @returns Budget records ordered by accountCode.
 * @throws Rejected with a Prisma error on failure.
 */
export async function getBudgetsByMonth(
  companyId: string,
  fiscalYear: number,
  month: number
): Promise<Budget[]> {
  return prisma.budget.findMany({
    where: {
      companyId,
      fiscalYear,
      month,
    },
    orderBy: [{ accountCode: 'asc' }],
  })
}

/**
 * Deletes a single budget entry.
 *
 * @param id - Budget record id.
 * @throws Rejected with a Prisma error (e.g. P2025) if the id does not exist.
 */
export async function deleteBudget(id: string): Promise<void> {
  await prisma.budget.delete({
    where: { id },
  })
}

/**
 * Deletes all budget entries for a company in a fiscal year.
 *
 * @param companyId - Company id.
 * @param fiscalYear - Fiscal year.
 * @returns The number of records deleted.
 * @throws Rejected with a Prisma error on failure.
 */
export async function deleteBudgetsByFiscalYear(
  companyId: string,
  fiscalYear: number
): Promise<number> {
  const result = await prisma.budget.deleteMany({
    where: {
      companyId,
      fiscalYear,
    },
  })
  return result.count
}

/**
 * Aggregates a company's budget for a specific month by account code.
 *
 * @param companyId - Company id.
 * @param fiscalYear - Fiscal year.
 * @param month - Month (1-12).
 * @returns One summary row per account code with the total budgeted amount.
 * @throws Rejected with a Prisma error on failure.
 */
export async function getBudgetSummary(
  companyId: string,
  fiscalYear: number,
  month: number
): Promise<{ accountCode: string; accountName: string; totalBudget: number }[]> {
  const budgets = await getBudgetsByMonth(companyId, fiscalYear, month)

  const summary = new Map<string, { accountName: string; total: number }>()

  for (const budget of budgets) {
    const existing = summary.get(budget.accountCode)
    if (existing) {
      existing.total += budget.amount
    } else {
      summary.set(budget.accountCode, {
        accountName: budget.accountName,
        total: budget.amount,
      })
    }
  }

  return Array.from(summary.entries()).map(([accountCode, data]) => ({
    accountCode,
    accountName: data.accountName,
    totalBudget: data.total,
  }))
}
