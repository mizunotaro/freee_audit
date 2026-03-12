/**
 * IRイベントサービス
 *
 * IRイベント情報の取得、作成、更新、削除を行うサービス
 *
 * @module services/reports/ir-event-service
 */

import { prisma } from '@/lib/db'
import { success, failure, ERROR_CODES } from '@/types/result'
import type {
  IREvent,
  IREventList,
  IREventFilters,
  IREventCreateInput,
  IREventUpdateInput,
  IRReportServiceError,
  IREventResult,
  IREventListResult,
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
 * IRイベント一覧を取得する
 *
 * @param companyId - 企業ID
 * @param filters - フィルタ条件（オプション）
 * @returns IRイベント一覧またはエラー
 *
 * @example
 * ```typescript
 * const result = await getIREvents('company-123', { status: 'scheduled' })
 * if (result.success) {
 *   console.log(result.data) // IREventList[]
 * }
 * ```
 */
export async function getIREvents(
  companyId: string,
  filters?: IREventFilters
): Promise<IREventListResult> {
  if (!companyId || typeof companyId !== 'string') {
    return failure(createServiceError(ERROR_CODES.VALIDATION_ERROR, 'companyId is required'))
  }

  try {
    const where: Record<string, unknown> = { companyId }

    if (filters?.eventType) {
      where.eventType = filters.eventType
    }
    if (filters?.status) {
      where.status = filters.status
    }
    if (filters?.startDate) {
      where.scheduledDate = {
        ...((where.scheduledDate as Record<string, Date>) ?? {}),
        gte: filters.startDate,
      }
    }
    if (filters?.endDate) {
      where.scheduledDate = {
        ...((where.scheduledDate as Record<string, Date>) ?? {}),
        lte: filters.endDate,
      }
    }

    const events = await prisma.$transaction(
      async (tx) => {
        return tx.iREvent.findMany({
          where,
          select: {
            id: true,
            companyId: true,
            eventType: true,
            title: true,
            scheduledDate: true,
            status: true,
          },
          orderBy: { scheduledDate: 'asc' },
        })
      },
      { maxWait: DB_MAX_WAIT_MS, timeout: DB_TIMEOUT_MS }
    )

    return success(events as IREventList[])
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get IR events'
    return failure(
      createServiceError(ERROR_CODES.DATABASE_ERROR, message, {
        companyId,
        filters,
      })
    )
  }
}

/**
 * IRイベントを作成する
 *
 * @param data - 作成データ
 * @returns 作成されたIRイベントまたはエラー
 */
export async function createIREvent(data: IREventCreateInput): Promise<IREventResult> {
  if (!data.companyId || typeof data.companyId !== 'string') {
    return failure(createServiceError(ERROR_CODES.VALIDATION_ERROR, 'companyId is required'))
  }

  if (!data.eventType || typeof data.eventType !== 'string') {
    return failure(createServiceError(ERROR_CODES.VALIDATION_ERROR, 'eventType is required'))
  }

  if (!data.title || typeof data.title !== 'string') {
    return failure(createServiceError(ERROR_CODES.VALIDATION_ERROR, 'title is required'))
  }

  if (!data.scheduledDate || !(data.scheduledDate instanceof Date)) {
    return failure(
      createServiceError(
        ERROR_CODES.VALIDATION_ERROR,
        'scheduledDate is required and must be a Date'
      )
    )
  }

  try {
    const event = await prisma.$transaction(
      async (tx) => {
        return tx.iREvent.create({
          data: {
            companyId: data.companyId,
            eventType: data.eventType,
            title: data.title,
            titleEn: data.titleEn ?? null,
            description: data.description ?? null,
            descriptionEn: data.descriptionEn ?? null,
            scheduledDate: data.scheduledDate,
            status: 'scheduled',
          },
        })
      },
      { maxWait: DB_MAX_WAIT_MS, timeout: DB_TIMEOUT_MS }
    )

    return success(event as unknown as IREvent)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create IR event'
    return failure(createServiceError(ERROR_CODES.DATABASE_ERROR, message, { data }))
  }
}

/**
 * IRイベントを更新する
 *
 * @param id - イベントID
 * @param data - 更新データ
 * @returns 更新されたIRイベントまたはエラー
 */
export async function updateIREvent(id: string, data: IREventUpdateInput): Promise<IREventResult> {
  if (!id || typeof id !== 'string') {
    return failure(createServiceError(ERROR_CODES.VALIDATION_ERROR, 'id is required'))
  }

  if (!data || Object.keys(data).length === 0) {
    return failure(createServiceError(ERROR_CODES.VALIDATION_ERROR, 'No update data provided'))
  }

  try {
    const event = await prisma.$transaction(
      async (tx) => {
        const existing = await tx.iREvent.findUnique({ where: { id } })

        if (!existing) {
          throw new Error('NOT_FOUND')
        }

        const updateData: Record<string, unknown> = {}
        if (data.title !== undefined) updateData.title = data.title
        if (data.titleEn !== undefined) updateData.titleEn = data.titleEn
        if (data.description !== undefined) updateData.description = data.description
        if (data.descriptionEn !== undefined) updateData.descriptionEn = data.descriptionEn
        if (data.scheduledDate !== undefined) updateData.scheduledDate = data.scheduledDate
        if (data.status !== undefined) updateData.status = data.status

        return tx.iREvent.update({
          where: { id },
          data: updateData,
        })
      },
      { maxWait: DB_MAX_WAIT_MS, timeout: DB_TIMEOUT_MS }
    )

    return success(event as unknown as IREvent)
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return failure(createServiceError(ERROR_CODES.NOT_FOUND, `IR Event not found: ${id}`))
    }
    const message = error instanceof Error ? error.message : 'Failed to update IR event'
    return failure(createServiceError(ERROR_CODES.DATABASE_ERROR, message, { id, data }))
  }
}

/**
 * IRイベントを削除する
 *
 * @param id - イベントID
 * @returns 成功またはエラー
 */
export async function deleteIREvent(id: string): Promise<IREventListResult> {
  if (!id || typeof id !== 'string') {
    return failure(createServiceError(ERROR_CODES.VALIDATION_ERROR, 'id is required'))
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        const existing = await tx.iREvent.findUnique({ where: { id } })

        if (!existing) {
          throw new Error('NOT_FOUND')
        }

        await tx.iREvent.delete({ where: { id } })
      },
      { maxWait: DB_MAX_WAIT_MS, timeout: DB_TIMEOUT_MS }
    )

    return success([])
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return failure(createServiceError(ERROR_CODES.NOT_FOUND, `IR Event not found: ${id}`))
    }
    const message = error instanceof Error ? error.message : 'Failed to delete IR event'
    return failure(createServiceError(ERROR_CODES.DATABASE_ERROR, message, { id }))
  }
}

/**
 * 今後のIRイベントを取得する
 *
 * @param companyId - 企業ID
 * @returns 今後のIRイベント一覧またはエラー
 */
export async function getUpcomingIREvents(companyId: string): Promise<IREventListResult> {
  if (!companyId || typeof companyId !== 'string') {
    return failure(createServiceError(ERROR_CODES.VALIDATION_ERROR, 'companyId is required'))
  }

  try {
    const events = await prisma.$transaction(
      async (tx) => {
        return tx.iREvent.findMany({
          where: {
            companyId,
            scheduledDate: { gte: new Date() },
            status: 'scheduled',
          },
          select: {
            id: true,
            companyId: true,
            eventType: true,
            title: true,
            scheduledDate: true,
            status: true,
          },
          orderBy: { scheduledDate: 'asc' },
          take: 10,
        })
      },
      { maxWait: DB_MAX_WAIT_MS, timeout: DB_TIMEOUT_MS }
    )

    return success(events as IREventList[])
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get upcoming IR events'
    return failure(createServiceError(ERROR_CODES.DATABASE_ERROR, message, { companyId }))
  }
}

/**
 * IRイベント詳細を取得する
 *
 * @param id - イベントID
 * @returns IRイベント詳細またはエラー
 */
export async function getIREvent(id: string): Promise<IREventResult> {
  if (!id || typeof id !== 'string') {
    return failure(createServiceError(ERROR_CODES.VALIDATION_ERROR, 'id is required'))
  }

  try {
    const event = await prisma.$transaction(
      async (tx) => {
        return tx.iREvent.findUnique({ where: { id } })
      },
      { maxWait: DB_MAX_WAIT_MS, timeout: DB_TIMEOUT_MS }
    )

    if (!event) {
      return failure(createServiceError(ERROR_CODES.NOT_FOUND, `IR Event not found: ${id}`))
    }

    return success(event as unknown as IREvent)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get IR event'
    return failure(createServiceError(ERROR_CODES.DATABASE_ERROR, message, { id }))
  }
}
