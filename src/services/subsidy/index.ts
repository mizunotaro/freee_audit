import { prisma } from '@/lib/db'
import { failure, createAppError, tryCatch, type Result, type AppError } from '@/types/result'

export interface CreateSubsidyProjectOptions {
  companyId: string
  subsidyType: string
  projectCode: string
  projectName: string
  programName: string
  institution: string
  piDepartment?: string
  piName: string
  workerDepartment?: string
  workerName?: string
  startDate: Date
  endDate: Date
  totalBudget: number
  subsidyRate: number
  indirectCostRate?: number
}

export interface CreateSubsidyJournalOptions {
  projectId: string
  date: Date
  workerName: string
  startTime?: string
  endTime?: string
  excludedHours?: number
  amedHours: number
  totalHours: number
  activityText: string
  confidence?: number
  reviewFlags?: string[]
  sourceEventIds?: string[]
}

export interface SubsidyJournalEntry {
  id: string
  date: Date
  workerName: string
  startTime: string | null
  endTime: string | null
  excludedHours: number
  amedHours: number
  totalHours: number
  activityText: string
  confidence: number
  reviewFlags: string[]
  status: string
}

export interface ExpenditureSummary {
  fiscalYear: number
  totalAmount: number
  byCategory: Record<string, number>
  subsidyEligible: number
  indirectCosts: number
}

export async function createSubsidyProject(
  options: CreateSubsidyProjectOptions
): Promise<Result<{ id: string }, AppError>> {
  if (!options.companyId || !options.projectCode) {
    return failure(createAppError('VALIDATION_ERROR', 'companyId and projectCode are required'))
  }

  if (options.subsidyRate < 0 || options.subsidyRate > 1) {
    return failure(createAppError('VALIDATION_ERROR', 'subsidyRate must be between 0 and 1'))
  }

  return tryCatch(async () => {
    const project = await prisma.subsidyProject.create({
      data: {
        companyId: options.companyId,
        subsidyType: options.subsidyType,
        projectCode: options.projectCode,
        projectName: options.projectName,
        programName: options.programName,
        institution: options.institution,
        piDepartment: options.piDepartment,
        piName: options.piName,
        workerDepartment: options.workerDepartment,
        workerName: options.workerName,
        startDate: options.startDate,
        endDate: options.endDate,
        totalBudget: options.totalBudget,
        subsidyRate: options.subsidyRate,
        indirectCostRate: options.indirectCostRate ?? 0.1,
      },
    })
    return { id: project.id }
  }, 'DATABASE_ERROR')
}

export async function getSubsidyProjects(
  companyId: string
): Promise<
  Result<
    Array<{
      id: string
      projectCode: string
      projectName: string
      subsidyType: string
      status: string
    }>,
    AppError
  >
> {
  if (!companyId) {
    return failure(createAppError('VALIDATION_ERROR', 'companyId is required'))
  }

  return tryCatch(async () => {
    const projects = await prisma.subsidyProject.findMany({
      where: { companyId },
      select: {
        id: true,
        projectCode: true,
        projectName: true,
        subsidyType: true,
        status: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    return projects
  }, 'DATABASE_ERROR')
}

export async function createSubsidyJournal(
  options: CreateSubsidyJournalOptions
): Promise<Result<{ id: string }, AppError>> {
  if (!options.projectId || !options.workerName || !options.activityText) {
    return failure(
      createAppError('VALIDATION_ERROR', 'projectId, workerName, and activityText are required')
    )
  }

  if (options.amedHours < 0 || options.totalHours < 0) {
    return failure(createAppError('VALIDATION_ERROR', 'Hours must be non-negative'))
  }

  if (options.amedHours > options.totalHours) {
    return failure(createAppError('VALIDATION_ERROR', 'amedHours cannot exceed totalHours'))
  }

  const prohibited = ['同上', '〃', '作業', 'MTG', '会議']
  const textLower = options.activityText.trim()
  if (prohibited.some((p) => textLower === p)) {
    return failure(
      createAppError(
        'VALIDATION_ERROR',
        `作業内容が抽象的です。具体的な記述が必要です: "${textLower}"`
      )
    )
  }

  if (options.activityText.length < 15) {
    return failure(
      createAppError('VALIDATION_ERROR', '作業内容は15文字以上の具体的な記述が必要です')
    )
  }

  return tryCatch(async () => {
    const journal = await prisma.subsidyJournal.create({
      data: {
        projectId: options.projectId,
        date: options.date,
        workerName: options.workerName,
        startTime: options.startTime ?? null,
        endTime: options.endTime ?? null,
        excludedHours: options.excludedHours ?? 0,
        amedHours: options.amedHours,
        totalHours: options.totalHours,
        activityText: options.activityText,
        confidence: options.confidence ?? 1.0,
        reviewFlags: JSON.stringify(options.reviewFlags ?? []),
        sourceEventIds: JSON.stringify(options.sourceEventIds ?? []),
      },
    })
    return { id: journal.id }
  }, 'DATABASE_ERROR')
}

export async function getSubsidyJournals(options: {
  projectId: string
  year: number
  month: number
  workerName?: string
}): Promise<Result<SubsidyJournalEntry[], AppError>> {
  const { projectId, year, month } = options

  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0, 23, 59, 59)

  return tryCatch(async () => {
    const journals = await prisma.subsidyJournal.findMany({
      where: {
        projectId,
        date: { gte: startDate, lte: endDate },
        ...(options.workerName ? { workerName: options.workerName } : {}),
      },
      orderBy: { date: 'asc' },
    })

    return journals.map((j) => ({
      id: j.id,
      date: j.date,
      workerName: j.workerName,
      startTime: j.startTime,
      endTime: j.endTime,
      excludedHours: j.excludedHours,
      amedHours: j.amedHours,
      totalHours: j.totalHours,
      activityText: j.activityText,
      confidence: j.confidence,
      reviewFlags: JSON.parse(j.reviewFlags) as string[],
      status: j.status,
    }))
  }, 'DATABASE_ERROR')
}

export async function getExpenditureSummary(options: {
  projectId: string
  fiscalYear: number
}): Promise<Result<ExpenditureSummary, AppError>> {
  return tryCatch(async () => {
    const expenditures = await prisma.subsidyExpenditure.findMany({
      where: {
        projectId: options.projectId,
        fiscalYear: options.fiscalYear,
      },
    })

    const project = await prisma.subsidyProject.findUnique({
      where: { id: options.projectId },
      select: { subsidyRate: true, indirectCostRate: true },
    })

    const byCategory: Record<string, number> = {}
    let totalAmount = 0
    for (const exp of expenditures) {
      byCategory[exp.category] = (byCategory[exp.category] ?? 0) + exp.amount
      totalAmount += exp.amount
    }

    const indirectRate = project?.indirectCostRate ?? 0.1
    const directCosts = totalAmount / (1 + indirectRate)
    const indirectCosts = totalAmount - directCosts

    return {
      fiscalYear: options.fiscalYear,
      totalAmount,
      byCategory,
      subsidyEligible: totalAmount * (project?.subsidyRate ?? 2 / 3),
      indirectCosts,
    }
  }, 'DATABASE_ERROR')
}
