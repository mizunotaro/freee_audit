/**
 * IR FAQサービス
 *
 * IR FAQ情報の取得、作成、更新、削除、順序変更を行うサービス
 *
 * @module services/reports/ir-faq-service
 */

import { prisma } from '@/lib/db'
import { success, failure, ERROR_CODES } from '@/types/result'
import type {
  FAQ,
  FAQList,
  CreateFAQData,
  UpdateFAQData,
  ReorderFAQsData,
  IRReportServiceError,
} from '@/types/ir-report'

const DB_TIMEOUT_MS = 30000
const DB_MAX_WAIT_MS = 5000

type FAQResult = { success: true; data: FAQ } | { success: false; error: IRReportServiceError }
type FAQListResult =
  | { success: true; data: FAQList[] }
  | { success: false; error: IRReportServiceError }

function createServiceError(
  code: string,
  message: string,
  details?: Record<string, unknown>
): IRReportServiceError {
  return { code, message, details }
}

/**
 * FAQ一覧を取得する
 *
 * @param companyId - 企業ID
 * @returns FAQ一覧またはエラー
 *
 * @example
 * ```typescript
 * const result = await getFAQs('company-123')
 * if (result.success) {
 *   console.log(result.data) // FAQList[]
 * }
 * ```
 */
export async function getFAQs(companyId: string): Promise<FAQListResult> {
  if (!companyId || typeof companyId !== 'string') {
    return failure(createServiceError(ERROR_CODES.VALIDATION_ERROR, 'companyId is required'))
  }

  try {
    const faqs = await prisma.$transaction(
      async (tx) => {
        return tx.fAQ.findMany({
          where: { companyId },
          select: {
            id: true,
            companyId: true,
            question: true,
            category: true,
            sortOrder: true,
            isActive: true,
          },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        })
      },
      { maxWait: DB_MAX_WAIT_MS, timeout: DB_TIMEOUT_MS }
    )

    return success(faqs as FAQList[])
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get FAQs'
    return failure(createServiceError(ERROR_CODES.DATABASE_ERROR, message, { companyId }))
  }
}

/**
 * FAQを作成する
 *
 * @param data - 作成データ
 * @returns 作成されたFAQまたはエラー
 */
export async function createFAQ(data: CreateFAQData): Promise<FAQResult> {
  if (!data.companyId || typeof data.companyId !== 'string') {
    return failure(createServiceError(ERROR_CODES.VALIDATION_ERROR, 'companyId is required'))
  }

  if (!data.question || typeof data.question !== 'string') {
    return failure(createServiceError(ERROR_CODES.VALIDATION_ERROR, 'question is required'))
  }

  if (!data.answer || typeof data.answer !== 'string') {
    return failure(createServiceError(ERROR_CODES.VALIDATION_ERROR, 'answer is required'))
  }

  try {
    const faq = await prisma.$transaction(
      async (tx) => {
        const maxSortOrder = await tx.fAQ.aggregate({
          where: { companyId: data.companyId },
          _max: { sortOrder: true },
        })

        const sortOrder = data.sortOrder ?? (maxSortOrder._max.sortOrder ?? -1) + 1

        return tx.fAQ.create({
          data: {
            companyId: data.companyId,
            question: data.question,
            answer: data.answer,
            category: data.category ?? null,
            sortOrder,
            isActive: true,
          },
        })
      },
      { maxWait: DB_MAX_WAIT_MS, timeout: DB_TIMEOUT_MS }
    )

    return success(faq as unknown as FAQ)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create FAQ'
    return failure(createServiceError(ERROR_CODES.DATABASE_ERROR, message, { data }))
  }
}

/**
 * FAQを更新する
 *
 * @param id - FAQ ID
 * @param data - 更新データ
 * @returns 更新されたFAQまたはエラー
 */
export async function updateFAQ(id: string, data: UpdateFAQData): Promise<FAQResult> {
  if (!id || typeof id !== 'string') {
    return failure(createServiceError(ERROR_CODES.VALIDATION_ERROR, 'id is required'))
  }

  if (!data || Object.keys(data).length === 0) {
    return failure(createServiceError(ERROR_CODES.VALIDATION_ERROR, 'No update data provided'))
  }

  try {
    const faq = await prisma.$transaction(
      async (tx) => {
        const existing = await tx.fAQ.findUnique({ where: { id } })

        if (!existing) {
          throw new Error('NOT_FOUND')
        }

        return tx.fAQ.update({
          where: { id },
          data,
        })
      },
      { maxWait: DB_MAX_WAIT_MS, timeout: DB_TIMEOUT_MS }
    )

    return success(faq as unknown as FAQ)
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return failure(createServiceError(ERROR_CODES.NOT_FOUND, `FAQ not found: ${id}`))
    }
    const message = error instanceof Error ? error.message : 'Failed to update FAQ'
    return failure(createServiceError(ERROR_CODES.DATABASE_ERROR, message, { id, data }))
  }
}

/**
 * FAQを削除する
 *
 * @param id - FAQ ID
 * @returns 成功またはエラー
 */
export async function deleteFAQ(id: string): Promise<FAQListResult> {
  if (!id || typeof id !== 'string') {
    return failure(createServiceError(ERROR_CODES.VALIDATION_ERROR, 'id is required'))
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        const existing = await tx.fAQ.findUnique({ where: { id } })

        if (!existing) {
          throw new Error('NOT_FOUND')
        }

        await tx.fAQ.delete({ where: { id } })
      },
      { maxWait: DB_MAX_WAIT_MS, timeout: DB_TIMEOUT_MS }
    )

    return success([])
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return failure(createServiceError(ERROR_CODES.NOT_FOUND, `FAQ not found: ${id}`))
    }
    const message = error instanceof Error ? error.message : 'Failed to delete FAQ'
    return failure(createServiceError(ERROR_CODES.DATABASE_ERROR, message, { id }))
  }
}

/**
 * FAQ順序を変更する
 *
 * @param companyId - 企業ID
 * @param order - FAQ IDの順序配列
 * @returns 成功またはエラー
 */
export async function reorderFAQs(
  companyId: string,
  order: ReorderFAQsData
): Promise<FAQListResult> {
  if (!companyId || typeof companyId !== 'string') {
    return failure(createServiceError(ERROR_CODES.VALIDATION_ERROR, 'companyId is required'))
  }

  if (!order?.faqIds || !Array.isArray(order.faqIds)) {
    return failure(createServiceError(ERROR_CODES.VALIDATION_ERROR, 'faqIds array is required'))
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        const faqs = await tx.fAQ.findMany({
          where: { companyId },
        })

        const faqMap = new Map(faqs.map((f: { id: string }) => [f.id, f]))
        for (const faqId of order.faqIds) {
          if (!faqMap.has(faqId)) {
            throw new Error(`INVALID_FAQ: ${faqId}`)
          }
        }

        const updates = order.faqIds.map((faqId, index) =>
          tx.fAQ.update({
            where: { id: faqId },
            data: { sortOrder: index },
          })
        )

        await Promise.all(updates)
      },
      { maxWait: DB_MAX_WAIT_MS, timeout: DB_TIMEOUT_MS }
    )

    return success([])
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('INVALID_FAQ')) {
      return failure(
        createServiceError(
          ERROR_CODES.VALIDATION_ERROR,
          `Invalid FAQ ID in order: ${error.message}`
        )
      )
    }
    const message = error instanceof Error ? error.message : 'Failed to reorder FAQs'
    return failure(createServiceError(ERROR_CODES.DATABASE_ERROR, message, { companyId }))
  }
}

/**
 * FAQ詳細を取得する
 *
 * @param id - FAQ ID
 * @returns FAQ詳細またはエラー
 */
export async function getFAQ(id: string): Promise<FAQResult> {
  if (!id || typeof id !== 'string') {
    return failure(createServiceError(ERROR_CODES.VALIDATION_ERROR, 'id is required'))
  }

  try {
    const faq = await prisma.$transaction(
      async (tx) => {
        return tx.fAQ.findUnique({ where: { id } })
      },
      { maxWait: DB_MAX_WAIT_MS, timeout: DB_TIMEOUT_MS }
    )

    if (!faq) {
      return failure(createServiceError(ERROR_CODES.NOT_FOUND, `FAQ not found: ${id}`))
    }

    return success(faq as unknown as FAQ)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get FAQ'
    return failure(createServiceError(ERROR_CODES.DATABASE_ERROR, message, { id }))
  }
}

/**
 * アクティブなFAQ一覧を取得する
 *
 * @param companyId - 企業ID
 * @returns アクティブなFAQ一覧またはエラー
 */
export async function getActiveFAQs(companyId: string): Promise<FAQListResult> {
  if (!companyId || typeof companyId !== 'string') {
    return failure(createServiceError(ERROR_CODES.VALIDATION_ERROR, 'companyId is required'))
  }

  try {
    const faqs = await prisma.$transaction(
      async (tx) => {
        return tx.fAQ.findMany({
          where: { companyId, isActive: true },
          select: {
            id: true,
            companyId: true,
            question: true,
            category: true,
            sortOrder: true,
            isActive: true,
          },
          orderBy: [{ sortOrder: 'asc' }],
        })
      },
      { maxWait: DB_MAX_WAIT_MS, timeout: DB_TIMEOUT_MS }
    )

    return success(faqs as FAQList[])
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get active FAQs'
    return failure(createServiceError(ERROR_CODES.DATABASE_ERROR, message, { companyId }))
  }
}
