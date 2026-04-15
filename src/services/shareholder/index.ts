import { prisma } from '@/lib/db'
import { failure, createAppError, tryCatch, type Result, type AppError } from '@/types/result'

export interface CreateShareholderOptions {
  companyId: string
  shareholderName: string
  shareholderType: string
  address?: string
  sharesHeld: number
  shareClass?: string
  acquisitionDate: Date
  acquisitionPrice?: number
  votingRights?: number
  notes?: string
}

export interface ShareholderSummary {
  totalShares: number
  totalShareholders: number
  byClass: Record<string, { shares: number; holders: number }>
  byType: Record<string, { shares: number; holders: number; percentage: number }>
  topShareholders: Array<{ name: string; shares: number; percentage: number }>
}

export interface CreateStockOptionPlanOptions {
  companyId: string
  planName: string
  resolutionDate: Date
  totalShares: number
  exercisePrice: number
  vestingSchedule?: Record<string, unknown>
  exercisePeriodStart: Date
  exercisePeriodEnd: Date
  conditions?: string
}

export interface CreateStockOptionGrantOptions {
  planId: string
  granteeName: string
  granteeTitle?: string
  sharesGranted: number
  grantDate: Date
}

export interface CapitalStructure {
  issuedShares: number
  potentialShares: number
  fullyDilutedShares: number
  shareholderCount: number
  optionPoolTotal: number
  optionPoolGranted: number
  optionPoolAvailable: number
}

const SHAREHOLDER_TYPES = [
  'individual',
  'corporate',
  'fund',
  'founder',
  'employee',
  'other',
] as const

export async function createShareholder(
  options: CreateShareholderOptions
): Promise<Result<{ id: string }, AppError>> {
  if (!options.companyId || !options.shareholderName) {
    return failure(createAppError('VALIDATION_ERROR', 'companyId and shareholderName are required'))
  }
  if (options.sharesHeld <= 0) {
    return failure(createAppError('VALIDATION_ERROR', 'sharesHeld must be positive'))
  }
  if (!SHAREHOLDER_TYPES.includes(options.shareholderType as (typeof SHAREHOLDER_TYPES)[number])) {
    return failure(
      createAppError(
        'VALIDATION_ERROR',
        `Invalid shareholderType. Must be one of: ${SHAREHOLDER_TYPES.join(', ')}`
      )
    )
  }

  return tryCatch(async () => {
    const record = await prisma.shareholderRecord.create({
      data: {
        companyId: options.companyId,
        shareholderName: options.shareholderName,
        shareholderType: options.shareholderType,
        address: options.address,
        sharesHeld: options.sharesHeld,
        shareClass: options.shareClass ?? 'common',
        acquisitionDate: options.acquisitionDate,
        acquisitionPrice: options.acquisitionPrice,
        votingRights: options.votingRights ?? 1.0,
        notes: options.notes,
      },
    })
    return { id: record.id }
  }, 'DATABASE_ERROR')
}

export async function getShareholderSummary(
  companyId: string
): Promise<Result<ShareholderSummary, AppError>> {
  if (!companyId) {
    return failure(createAppError('VALIDATION_ERROR', 'companyId is required'))
  }

  return tryCatch(async () => {
    const records = await prisma.shareholderRecord.findMany({
      where: { companyId },
      orderBy: { sharesHeld: 'desc' },
    })

    const totalShares = records.reduce((sum, r) => sum + r.sharesHeld, 0)

    const byClass: Record<string, { shares: number; holders: number }> = {}
    const byType: Record<string, { shares: number; holders: number; percentage: number }> = {}

    for (const r of records) {
      if (!byClass[r.shareClass]) byClass[r.shareClass] = { shares: 0, holders: 0 }
      byClass[r.shareClass].shares += r.sharesHeld
      byClass[r.shareClass].holders += 1

      if (!byType[r.shareholderType])
        byType[r.shareholderType] = { shares: 0, holders: 0, percentage: 0 }
      byType[r.shareholderType].shares += r.sharesHeld
      byType[r.shareholderType].holders += 1
    }

    for (const type of Object.keys(byType)) {
      byType[type].percentage =
        totalShares > 0 ? Math.round((byType[type].shares / totalShares) * 10000) / 100 : 0
    }

    const topShareholders = records.slice(0, 10).map((r) => ({
      name: r.shareholderName,
      shares: r.sharesHeld,
      percentage: totalShares > 0 ? Math.round((r.sharesHeld / totalShares) * 10000) / 100 : 0,
    }))

    return {
      totalShares,
      totalShareholders: records.length,
      byClass,
      byType,
      topShareholders,
    }
  }, 'DATABASE_ERROR')
}

export async function createStockOptionPlan(
  options: CreateStockOptionPlanOptions
): Promise<Result<{ id: string }, AppError>> {
  if (!options.companyId || !options.planName) {
    return failure(createAppError('VALIDATION_ERROR', 'companyId and planName are required'))
  }
  if (options.totalShares <= 0 || options.exercisePrice <= 0) {
    return failure(
      createAppError('VALIDATION_ERROR', 'totalShares and exercisePrice must be positive')
    )
  }

  return tryCatch(async () => {
    const plan = await prisma.stockOptionPlan.create({
      data: {
        companyId: options.companyId,
        planName: options.planName,
        resolutionDate: options.resolutionDate,
        totalShares: options.totalShares,
        exercisePrice: options.exercisePrice,
        vestingSchedule: JSON.stringify(options.vestingSchedule ?? {}),
        exercisePeriodStart: options.exercisePeriodStart,
        exercisePeriodEnd: options.exercisePeriodEnd,
        conditions: options.conditions,
      },
    })
    return { id: plan.id }
  }, 'DATABASE_ERROR')
}

export async function createStockOptionGrant(
  options: CreateStockOptionGrantOptions
): Promise<Result<{ id: string }, AppError>> {
  if (!options.planId || !options.granteeName) {
    return failure(createAppError('VALIDATION_ERROR', 'planId and granteeName are required'))
  }
  if (options.sharesGranted <= 0) {
    return failure(createAppError('VALIDATION_ERROR', 'sharesGranted must be positive'))
  }

  return tryCatch(async () => {
    const plan = await prisma.stockOptionPlan.findUnique({
      where: { id: options.planId },
      include: { grants: true },
    })
    if (!plan) throw new Error('Stock option plan not found')

    const totalGranted = plan.grants.reduce((sum, g) => sum + g.sharesGranted, 0)
    if (totalGranted + options.sharesGranted > plan.totalShares) {
      throw new Error(
        `Exceeds plan limit. Available: ${plan.totalShares - totalGranted}, requested: ${options.sharesGranted}`
      )
    }

    const grant = await prisma.stockOptionGrant.create({
      data: {
        planId: options.planId,
        granteeName: options.granteeName,
        granteeTitle: options.granteeTitle,
        sharesGranted: options.sharesGranted,
        grantDate: options.grantDate,
      },
    })
    return { id: grant.id }
  }, 'DATABASE_ERROR')
}

export async function getCapitalStructure(
  companyId: string
): Promise<Result<CapitalStructure, AppError>> {
  if (!companyId) {
    return failure(createAppError('VALIDATION_ERROR', 'companyId is required'))
  }

  return tryCatch(async () => {
    const shareholders = await prisma.shareholderRecord.findMany({
      where: { companyId },
    })
    const issuedShares = shareholders.reduce((sum, s) => sum + s.sharesHeld, 0)

    const plans = await prisma.stockOptionPlan.findMany({
      where: { companyId },
      include: { grants: true },
    })

    let optionPoolTotal = 0
    let optionPoolGranted = 0
    let potentialShares = 0

    for (const plan of plans) {
      optionPoolTotal += plan.totalShares
      const granted = plan.grants.reduce((sum, g) => sum + g.sharesGranted, 0)
      const exercised = plan.grants.reduce((sum, g) => sum + g.sharesExercised, 0)
      const cancelled = plan.grants.reduce((sum, g) => sum + g.sharesCancelled, 0)
      optionPoolGranted += granted
      potentialShares += granted - exercised - cancelled
    }

    return {
      issuedShares,
      potentialShares,
      fullyDilutedShares: issuedShares + potentialShares,
      shareholderCount: shareholders.length,
      optionPoolTotal,
      optionPoolGranted,
      optionPoolAvailable: optionPoolTotal - optionPoolGranted,
    }
  }, 'DATABASE_ERROR')
}
