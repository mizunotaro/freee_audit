import { prisma } from '@/lib/db'
import { failure, createAppError, tryCatch, type Result, type AppError } from '@/types/result'

export interface CreateBudgetPlanOptions {
  companyId: string
  fiscalYear: number
  name: string
  version?: number
  sourceFile?: string
  notes?: string
  items: BudgetItemInput[]
}

export interface BudgetItemInput {
  accountItem: string
  department?: string
  month?: number
  budgetAmount: number
  notes?: string
}

export interface BudgetVarianceReport {
  fiscalYear: number
  planName: string
  totalBudget: number
  totalActual: number
  totalVariance: number
  totalVarianceRate: number
  byMonth: MonthlyVariance[]
  significantVariances: SignificantVariance[]
}

export interface MonthlyVariance {
  month: number
  budget: number
  actual: number
  variance: number
  varianceRate: number
}

export interface SignificantVariance {
  accountItem: string
  month: number
  budget: number
  actual: number
  variance: number
  varianceRate: number
  reason: string | null
  boardReportNote: string | null
}

export interface RecordVarianceReasonOptions {
  varianceId: string
  reason: string
  boardReportNote?: string
  actionRequired?: boolean
}

const SIGNIFICANT_VARIANCE_THRESHOLD = 0.1

export async function createBudgetPlan(
  options: CreateBudgetPlanOptions
): Promise<Result<{ id: string }, AppError>> {
  if (!options.companyId || !options.name) {
    return failure(createAppError('VALIDATION_ERROR', 'companyId and name are required'))
  }

  if (options.fiscalYear < 2000 || options.fiscalYear > 2100) {
    return failure(createAppError('VALIDATION_ERROR', 'fiscalYear must be between 2000 and 2100'))
  }

  if (!options.items || options.items.length === 0) {
    return failure(createAppError('VALIDATION_ERROR', 'At least one budget item is required'))
  }

  return tryCatch(async () => {
    const plan = await prisma.budgetPlan.create({
      data: {
        companyId: options.companyId,
        fiscalYear: options.fiscalYear,
        name: options.name,
        version: options.version ?? 1,
        sourceFile: options.sourceFile,
        notes: options.notes,
        items: {
          create: options.items.map((item) => ({
            accountItem: item.accountItem,
            department: item.department,
            month: item.month,
            budgetAmount: item.budgetAmount,
            notes: item.notes,
          })),
        },
      },
    })

    return { id: plan.id }
  }, 'DATABASE_ERROR')
}

export async function calculateVariances(options: {
  planId: string
  actualData: Array<{ accountItem: string; month: number; amount: number }>
}): Promise<Result<BudgetVarianceReport, AppError>> {
  if (!options.planId) {
    return failure(createAppError('VALIDATION_ERROR', 'planId is required'))
  }

  return tryCatch(async () => {
    const plan = await prisma.budgetPlan.findUnique({
      where: { id: options.planId },
      include: { items: true },
    })

    if (!plan) throw new Error('Budget plan not found')

    const budgetByKey = new Map<string, number>()
    for (const item of plan.items) {
      const key = `${item.accountItem}|${item.month ?? 0}`
      budgetByKey.set(key, (budgetByKey.get(key) ?? 0) + item.budgetAmount)
    }

    const monthlyBudget = new Map<number, number>()
    const monthlyActual = new Map<number, number>()

    for (const item of plan.items) {
      if (item.month) {
        monthlyBudget.set(item.month, (monthlyBudget.get(item.month) ?? 0) + item.budgetAmount)
      }
    }

    const significantVariances: SignificantVariance[] = []

    for (const actual of options.actualData) {
      monthlyActual.set(actual.month, (monthlyActual.get(actual.month) ?? 0) + actual.amount)

      const key = `${actual.accountItem}|${actual.month}`
      const budget = budgetByKey.get(key) ?? 0
      const variance = actual.amount - budget
      const varianceRate = budget !== 0 ? variance / budget : 0

      const existingVariance = await prisma.budgetVariance.findFirst({
        where: {
          planId: options.planId,
          accountItem: actual.accountItem,
          month: actual.month,
        },
      })

      if (existingVariance) {
        await prisma.budgetVariance.update({
          where: { id: existingVariance.id },
          data: {
            budgetAmount: budget,
            actualAmount: actual.amount,
            variance,
            varianceRate,
          },
        })
      } else {
        await prisma.budgetVariance.create({
          data: {
            planId: options.planId,
            accountItem: actual.accountItem,
            month: actual.month,
            budgetAmount: budget,
            actualAmount: actual.amount,
            variance,
            varianceRate,
          },
        })
      }

      if (Math.abs(varianceRate) >= SIGNIFICANT_VARIANCE_THRESHOLD) {
        significantVariances.push({
          accountItem: actual.accountItem,
          month: actual.month,
          budget,
          actual: actual.amount,
          variance,
          varianceRate,
          reason: existingVariance?.reason ?? null,
          boardReportNote: existingVariance?.boardReportNote ?? null,
        })
      }
    }

    const allMonths = new Set([...monthlyBudget.keys(), ...monthlyActual.keys()])
    const byMonth: MonthlyVariance[] = [...allMonths]
      .sort((a, b) => a - b)
      .map((month) => {
        const budget = monthlyBudget.get(month) ?? 0
        const actual = monthlyActual.get(month) ?? 0
        return {
          month,
          budget,
          actual,
          variance: actual - budget,
          varianceRate: budget !== 0 ? (actual - budget) / budget : 0,
        }
      })

    const totalBudget = byMonth.reduce((sum, m) => sum + m.budget, 0)
    const totalActual = byMonth.reduce((sum, m) => sum + m.actual, 0)

    return {
      fiscalYear: plan.fiscalYear,
      planName: plan.name,
      totalBudget,
      totalActual,
      totalVariance: totalActual - totalBudget,
      totalVarianceRate: totalBudget !== 0 ? (totalActual - totalBudget) / totalBudget : 0,
      byMonth,
      significantVariances,
    }
  }, 'DATABASE_ERROR')
}

export async function recordVarianceReason(
  options: RecordVarianceReasonOptions
): Promise<Result<{ id: string }, AppError>> {
  if (!options.varianceId || !options.reason) {
    return failure(createAppError('VALIDATION_ERROR', 'varianceId and reason are required'))
  }

  return tryCatch(async () => {
    const variance = await prisma.budgetVariance.update({
      where: { id: options.varianceId },
      data: {
        reason: options.reason,
        boardReportNote: options.boardReportNote,
        actionRequired: options.actionRequired ?? false,
      },
    })
    return { id: variance.id }
  }, 'DATABASE_ERROR')
}

export async function getBudgetPlans(
  companyId: string,
  fiscalYear?: number
): Promise<
  Result<
    Array<{ id: string; name: string; fiscalYear: number; version: number; status: string }>,
    AppError
  >
> {
  if (!companyId) {
    return failure(createAppError('VALIDATION_ERROR', 'companyId is required'))
  }

  return tryCatch(async () => {
    const plans = await prisma.budgetPlan.findMany({
      where: {
        companyId,
        ...(fiscalYear ? { fiscalYear } : {}),
      },
      select: {
        id: true,
        name: true,
        fiscalYear: true,
        version: true,
        status: true,
      },
      orderBy: [{ fiscalYear: 'desc' }, { version: 'desc' }],
    })
    return plans
  }, 'DATABASE_ERROR')
}

export async function getVariancesForBoardReport(
  planId: string
): Promise<Result<SignificantVariance[], AppError>> {
  if (!planId) {
    return failure(createAppError('VALIDATION_ERROR', 'planId is required'))
  }

  return tryCatch(async () => {
    const variances = await prisma.budgetVariance.findMany({
      where: {
        planId,
        OR: [{ actionRequired: true }, { boardReportNote: { not: null } }],
      },
      orderBy: [{ month: 'asc' }, { accountItem: 'asc' }],
    })

    return variances.map((v) => ({
      accountItem: v.accountItem,
      month: v.month,
      budget: v.budgetAmount,
      actual: v.actualAmount,
      variance: v.variance,
      varianceRate: v.varianceRate,
      reason: v.reason,
      boardReportNote: v.boardReportNote,
    }))
  }, 'DATABASE_ERROR')
}
