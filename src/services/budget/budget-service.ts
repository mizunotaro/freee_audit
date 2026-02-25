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

export async function getBudgetById(id: string): Promise<Budget | null> {
  return prisma.budget.findUnique({
    where: { id },
  })
}

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

export async function deleteBudget(id: string): Promise<void> {
  await prisma.budget.delete({
    where: { id },
  })
}

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
