/**
 * 株主構成サービス
 *
 * 株主構成情報の取得、登録、更新、削除を行うサービス
 *
 * @module services/reports/ir-shareholder-service
 */

import { prisma } from '@/lib/db'
import { success, failure, ERROR_CODES } from '@/types/result'
import type {
  ShareholderData,
  ShareholderDataCreateInput,
  ShareholderDataFilters,
  IRReportServiceError,
  ShareholderDataResult,
  ShareholderDataListResult,
} from '@/types/ir-report'

const DB_TIMEOUT_MS = 30000
const DB_MAX_WAIT_MS = 5000

function createServiceError(
  code: string,
  message: string,
  details?: Record<string, unknown>
): IRReportServiceError {
  return { code, message, details }
}

/**
 * 株主構成一覧を取得する
 *
 * @param companyId - 企業ID
 * @param filters - フィルタ条件（オプション）
 * @returns 株主構成一覧またはエラー
 *
 * @example
 * ```typescript
 * const result = await getShareholderCompositions('company-123', { asOfDate: new Date('2024-03-31') })
 * if (result.success) {
 *   console.log(result.data) // ShareholderData[]
 * }
 * ```
 */
export async function getShareholderCompositions(
  companyId: string,
  filters?: ShareholderDataFilters
): Promise<ShareholderDataListResult> {
  if (!companyId || typeof companyId !== 'string') {
    return failure(createServiceError(ERROR_CODES.VALIDATION_ERROR, 'companyId is required'))
  }

  try {
    const where: Record<string, unknown> = { companyId }

    if (filters?.asOfDate) {
      where.asOfDate = filters.asOfDate
    }
    if (filters?.shareholderType) {
      where.shareholderType = filters.shareholderType
    }

    const compositions = await prisma.$transaction(
      async (tx) => {
        return tx.shareholderComposition.findMany({
          where,
          orderBy: [{ asOfDate: 'desc' }, { percentage: 'desc' }],
        })
      },
      { maxWait: DB_MAX_WAIT_MS, timeout: DB_TIMEOUT_MS }
    )

    return success(compositions as ShareholderData[])
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to get shareholder compositions'
    return failure(
      createServiceError(ERROR_CODES.DATABASE_ERROR, message, {
        companyId,
        filters,
      })
    )
  }
}

/**
 * 株主構成を登録または更新する
 *
 * @param data - 株主構成データ
 * @returns 作成/更新された株主構成またはエラー
 */
export async function upsertShareholderComposition(
  data: ShareholderDataCreateInput
): Promise<ShareholderDataResult> {
  if (!data.companyId || typeof data.companyId !== 'string') {
    return failure(createServiceError(ERROR_CODES.VALIDATION_ERROR, 'companyId is required'))
  }

  if (!data.asOfDate || !(data.asOfDate instanceof Date)) {
    return failure(
      createServiceError(ERROR_CODES.VALIDATION_ERROR, 'asOfDate is required and must be a Date')
    )
  }

  if (!data.shareholderType || typeof data.shareholderType !== 'string') {
    return failure(createServiceError(ERROR_CODES.VALIDATION_ERROR, 'shareholderType is required'))
  }

  if (typeof data.sharesHeld !== 'number' || data.sharesHeld < 0) {
    return failure(
      createServiceError(ERROR_CODES.VALIDATION_ERROR, 'sharesHeld must be a non-negative number')
    )
  }

  if (typeof data.percentage !== 'number' || data.percentage < 0 || data.percentage > 100) {
    return failure(
      createServiceError(ERROR_CODES.VALIDATION_ERROR, 'percentage must be between 0 and 100')
    )
  }

  try {
    const composition = await prisma.$transaction(
      async (tx) => {
        const existing = await tx.shareholderComposition.findFirst({
          where: {
            companyId: data.companyId,
            asOfDate: data.asOfDate,
            shareholderName: data.shareholderName,
          },
        })

        if (existing) {
          return tx.shareholderComposition.update({
            where: { id: existing.id },
            data: {
              shareholderType: data.shareholderType,
              sharesHeld: data.sharesHeld,
              percentage: data.percentage,
            },
          })
        }

        return tx.shareholderComposition.create({
          data: {
            companyId: data.companyId,
            asOfDate: data.asOfDate,
            shareholderType: data.shareholderType,
            shareholderName: data.shareholderName ?? null,
            sharesHeld: data.sharesHeld,
            percentage: data.percentage,
          },
        })
      },
      { maxWait: DB_MAX_WAIT_MS, timeout: DB_TIMEOUT_MS }
    )

    return success(composition as unknown as ShareholderData)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to upsert shareholder composition'
    return failure(createServiceError(ERROR_CODES.DATABASE_ERROR, message, { data }))
  }
}

/**
 * 株主構成を削除する
 *
 * @param id - 株主構成ID
 * @returns 成功またはエラー
 */
export async function deleteShareholderComposition(id: string): Promise<ShareholderDataListResult> {
  if (!id || typeof id !== 'string') {
    return failure(createServiceError(ERROR_CODES.VALIDATION_ERROR, 'id is required'))
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        const existing = await tx.shareholderComposition.findUnique({
          where: { id },
        })

        if (!existing) {
          throw new Error('NOT_FOUND')
        }

        await tx.shareholderComposition.delete({ where: { id } })
      },
      { maxWait: DB_MAX_WAIT_MS, timeout: DB_TIMEOUT_MS }
    )

    return success([])
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return failure(
        createServiceError(ERROR_CODES.NOT_FOUND, `Shareholder composition not found: ${id}`)
      )
    }
    const message =
      error instanceof Error ? error.message : 'Failed to delete shareholder composition'
    return failure(createServiceError(ERROR_CODES.DATABASE_ERROR, message, { id }))
  }
}

/**
 * 最新の株主構成を取得する
 *
 * @param companyId - 企業ID
 * @returns 最新の株主構成一覧またはエラー
 */
export async function getLatestShareholderComposition(
  companyId: string
): Promise<ShareholderDataListResult> {
  if (!companyId || typeof companyId !== 'string') {
    return failure(createServiceError(ERROR_CODES.VALIDATION_ERROR, 'companyId is required'))
  }

  try {
    const latest = await prisma.$transaction(
      async (tx) => {
        const latestRecord = await tx.shareholderComposition.findFirst({
          where: { companyId },
          orderBy: { asOfDate: 'desc' },
          select: { asOfDate: true },
        })

        if (!latestRecord) {
          return []
        }

        return tx.shareholderComposition.findMany({
          where: {
            companyId,
            asOfDate: latestRecord.asOfDate,
          },
          orderBy: { percentage: 'desc' },
        })
      },
      { maxWait: DB_MAX_WAIT_MS, timeout: DB_TIMEOUT_MS }
    )

    return success(latest as unknown as ShareholderData[])
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to get latest shareholder composition'
    return failure(createServiceError(ERROR_CODES.DATABASE_ERROR, message, { companyId }))
  }
}
