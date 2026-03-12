/**
 * IRレポートサービス
 *
 * IRレポートの作成、取得、更新、削除、公開、複製を行うサービス
 *
 * @module services/reports/ir-report-service
 */

import { prisma } from '@/lib/db'
import { success, failure, ERROR_CODES } from '@/types/result'
import type {
  IRReport,
  IRReportList,
  IRReportFilters,
  IRReportSection,
  IRReportCreateInput,
  IRReportUpdateInput,
  IRReportSectionUpdateInput,
  ReorderSectionsData,
  IRSectionType,
  IRReportServiceError,
  IRReportResult,
  IRReportListResult,
  IRReportSectionResult,
} from '@/types/ir-report'

const DB_TIMEOUT_MS = 30000
const DB_MAX_WAIT_MS = 5000

function parseSectionData(data: string | null): Record<string, unknown> | undefined {
  if (!data) return undefined
  try {
    return JSON.parse(data) as Record<string, unknown>
  } catch {
    return undefined
  }
}

function stringifySectionData(data: Record<string, unknown> | undefined): string | null {
  if (!data) return null
  try {
    return JSON.stringify(data)
  } catch {
    return null
  }
}

function mapSectionFromPrisma(section: {
  id: string
  reportId: string
  sectionType: string
  title: string
  titleEn: string | null
  content: string
  contentEn: string | null
  data: string | null
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}): IRReportSection {
  return {
    id: section.id,
    reportId: section.reportId,
    sectionType: section.sectionType as IRSectionType,
    title: section.title,
    titleEn: section.titleEn ?? undefined,
    content: section.content,
    contentEn: section.contentEn ?? undefined,
    data: parseSectionData(section.data),
    sortOrder: section.sortOrder,
    createdAt: section.createdAt,
    updatedAt: section.updatedAt,
  }
}

interface PrismaIRReport {
  id: string
  companyId: string
  reportType: string
  fiscalYear: number
  quarter: number | null
  title: string
  titleEn: string | null
  summary: string | null
  summaryEn: string | null
  language: string
  status: string
  publishedAt: Date | null
  publishedBy: string | null
  createdAt: Date
  updatedAt: Date
  sections: Array<{
    id: string
    reportId: string
    sectionType: string
    title: string
    titleEn: string | null
    content: string
    contentEn: string | null
    data: string | null
    sortOrder: number
    createdAt: Date
    updatedAt: Date
  }>
}

function mapReportFromPrisma(report: PrismaIRReport): IRReport {
  return {
    id: report.id,
    companyId: report.companyId,
    reportType: report.reportType as IRReport['reportType'],
    fiscalYear: report.fiscalYear,
    quarter: report.quarter ?? undefined,
    title: report.title,
    titleEn: report.titleEn ?? undefined,
    summary: report.summary ?? undefined,
    summaryEn: report.summaryEn ?? undefined,
    sections: report.sections.map(mapSectionFromPrisma),
    status: report.status as IRReport['status'],
    language: report.language as IRReport['language'],
    publishedAt: report.publishedAt ?? undefined,
    publishedBy: report.publishedBy ?? undefined,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
  }
}

function createServiceError(
  code: string,
  message: string,
  details?: Record<string, unknown>
): IRReportServiceError {
  return { code, message, details }
}

/**
 * IRReport一覧を取得する
 *
 * @param companyId - 企業ID
 * @param filters - フィルタ条件
 * @returns IRReport一覧またはエラー
 *
 * @example
 * ```typescript
 * const result = await getIRReports('company-123', { fiscalYear: 2024 })
 * if (result.success) {
 *   console.log(result.data) // IRReportList[]
 * }
 * ```
 */
export async function getIRReports(
  companyId: string,
  filters?: IRReportFilters
): Promise<IRReportListResult> {
  if (!companyId || typeof companyId !== 'string') {
    return failure(createServiceError(ERROR_CODES.VALIDATION_ERROR, 'companyId is required'))
  }

  try {
    const where: Record<string, unknown> = { companyId }

    if (filters?.fiscalYear !== undefined) {
      where.fiscalYear = filters.fiscalYear
    }
    if (filters?.reportType) {
      where.reportType = filters.reportType
    }
    if (filters?.status) {
      where.status = filters.status
    }
    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search } },
        { summary: { contains: filters.search } },
      ]
    }

    const reports = await prisma.$transaction(
      async (tx) => {
        return tx.iRReport.findMany({
          where,
          select: {
            id: true,
            companyId: true,
            reportType: true,
            fiscalYear: true,
            quarter: true,
            title: true,
            status: true,
            publishedAt: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: [{ fiscalYear: 'desc' }, { createdAt: 'desc' }],
        })
      },
      { maxWait: DB_MAX_WAIT_MS, timeout: DB_TIMEOUT_MS }
    )

    return success(reports as IRReportList[])
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get IR reports'
    return failure(
      createServiceError(ERROR_CODES.DATABASE_ERROR, message, {
        companyId,
        filters,
      })
    )
  }
}

/**
 * IRReport詳細を取得する
 *
 * @param id - レポートID
 * @returns IRReport詳細またはエラー
 */
export async function getIRReport(id: string): Promise<IRReportResult> {
  if (!id || typeof id !== 'string') {
    return failure(createServiceError(ERROR_CODES.VALIDATION_ERROR, 'id is required'))
  }

  try {
    const report = await prisma.$transaction(
      async (tx) => {
        return tx.iRReport.findUnique({
          where: { id },
          include: {
            sections: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        })
      },
      { maxWait: DB_MAX_WAIT_MS, timeout: DB_TIMEOUT_MS }
    )

    if (!report) {
      return failure(createServiceError(ERROR_CODES.NOT_FOUND, `IR Report not found: ${id}`))
    }

    return success(mapReportFromPrisma(report as PrismaIRReport))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get IR report'
    return failure(createServiceError(ERROR_CODES.DATABASE_ERROR, message, { id }))
  }
}

/**
 * IRReportを作成する
 *
 * @param data - 作成データ
 * @returns 作成されたIRReportまたはエラー
 */
export async function createIRReport(data: IRReportCreateInput): Promise<IRReportResult> {
  if (!data.companyId || !data.fiscalYear || !data.title) {
    return failure(createServiceError(ERROR_CODES.VALIDATION_ERROR, 'Missing required fields'))
  }

  if (typeof data.fiscalYear !== 'number' || data.fiscalYear < 1900) {
    return failure(createServiceError(ERROR_CODES.VALIDATION_ERROR, 'Invalid fiscalYear'))
  }

  try {
    const report = await prisma.$transaction(
      async (tx) => {
        return tx.iRReport.create({
          data: {
            companyId: data.companyId,
            reportType: data.reportType,
            fiscalYear: data.fiscalYear,
            quarter: data.quarter ?? null,
            title: data.title,
            titleEn: data.titleEn ?? null,
            summary: data.summary ?? null,
            summaryEn: data.summaryEn ?? null,
            language: data.language ?? 'ja',
            status: 'DRAFT',
          },
          include: {
            sections: true,
          },
        })
      },
      { maxWait: DB_MAX_WAIT_MS, timeout: DB_TIMEOUT_MS }
    )

    return success(mapReportFromPrisma(report as PrismaIRReport))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create IR report'
    return failure(createServiceError(ERROR_CODES.DATABASE_ERROR, message, { data }))
  }
}

/**
 * IRReportを更新する
 *
 * @param id - レポートID
 * @param data - 更新データ
 * @returns 更新されたIRReportまたはエラー
 */
export async function updateIRReport(
  id: string,
  data: IRReportUpdateInput
): Promise<IRReportResult> {
  if (!id || typeof id !== 'string') {
    return failure(createServiceError(ERROR_CODES.VALIDATION_ERROR, 'id is required'))
  }

  if (!data || Object.keys(data).length === 0) {
    return failure(createServiceError(ERROR_CODES.VALIDATION_ERROR, 'No update data provided'))
  }

  try {
    const existing = await prisma.$transaction(
      async (tx) => {
        return tx.iRReport.findUnique({ where: { id } })
      },
      { maxWait: DB_MAX_WAIT_MS, timeout: DB_TIMEOUT_MS }
    )

    if (!existing) {
      return failure(createServiceError(ERROR_CODES.NOT_FOUND, `IR Report not found: ${id}`))
    }

    const report = await prisma.$transaction(
      async (tx) => {
        return tx.iRReport.update({
          where: { id },
          data,
          include: {
            sections: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        })
      },
      { maxWait: DB_MAX_WAIT_MS, timeout: DB_TIMEOUT_MS }
    )

    return success(mapReportFromPrisma(report as PrismaIRReport))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update IR report'
    return failure(createServiceError(ERROR_CODES.DATABASE_ERROR, message, { id, data }))
  }
}

/**
 * IRReportを削除する
 *
 * @param id - レポートID
 * @returns 成功またはエラー
 */
export async function deleteIRReport(id: string): Promise<IRReportListResult> {
  if (!id || typeof id !== 'string') {
    return failure(createServiceError(ERROR_CODES.VALIDATION_ERROR, 'id is required'))
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.iRReportSection.deleteMany({ where: { reportId: id } })
        await tx.iRReport.delete({ where: { id } })
      },
      { maxWait: DB_MAX_WAIT_MS, timeout: DB_TIMEOUT_MS }
    )

    return success([])
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete IR report'
    return failure(createServiceError(ERROR_CODES.DATABASE_ERROR, message, { id }))
  }
}

/**
 * IRReportを公開する
 *
 * @param id - レポートID
 * @returns 公開されたIRReportまたはエラー
 */
export async function publishIRReport(id: string): Promise<IRReportResult> {
  if (!id || typeof id !== 'string') {
    return failure(createServiceError(ERROR_CODES.VALIDATION_ERROR, 'id is required'))
  }

  try {
    const report = await prisma.$transaction(
      async (tx) => {
        const existing = await tx.iRReport.findUnique({ where: { id } })
        if (!existing) {
          throw new Error('NOT_FOUND')
        }
        if (existing.status === 'PUBLISHED') {
          throw new Error('ALREADY_PUBLISHED')
        }

        return tx.iRReport.update({
          where: { id },
          data: {
            status: 'PUBLISHED',
            publishedAt: new Date(),
          },
          include: {
            sections: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        })
      },
      { maxWait: DB_MAX_WAIT_MS, timeout: DB_TIMEOUT_MS }
    )

    return success(mapReportFromPrisma(report as PrismaIRReport))
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'NOT_FOUND') {
        return failure(createServiceError(ERROR_CODES.NOT_FOUND, `IR Report not found: ${id}`))
      }
      if (error.message === 'ALREADY_PUBLISHED') {
        return failure(
          createServiceError(ERROR_CODES.BUSINESS_LOGIC_ERROR, 'Report is already published')
        )
      }
      return failure(createServiceError(ERROR_CODES.DATABASE_ERROR, error.message, { id }))
    }
    return failure(
      createServiceError(ERROR_CODES.DATABASE_ERROR, 'Failed to publish IR report', {
        id,
      })
    )
  }
}

/**
 * IRReportを複製する
 *
 * @param id - 複製元レポートID
 * @returns 複製されたIRReportまたはエラー
 */
export async function duplicateIRReport(id: string): Promise<IRReportResult> {
  if (!id || typeof id !== 'string') {
    return failure(createServiceError(ERROR_CODES.VALIDATION_ERROR, 'id is required'))
  }

  try {
    const report = await prisma.$transaction(
      async (tx) => {
        const original = await tx.iRReport.findUnique({
          where: { id },
          include: {
            sections: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        })

        if (!original) {
          throw new Error('NOT_FOUND')
        }

        const newReport = await tx.iRReport.create({
          data: {
            companyId: original.companyId,
            reportType: original.reportType,
            fiscalYear: original.fiscalYear,
            quarter: original.quarter,
            title: `${original.title} (コピー)`,
            titleEn: original.titleEn ? `${original.titleEn} (Copy)` : null,
            summary: original.summary,
            summaryEn: original.summaryEn,
            language: original.language,
            status: 'DRAFT',
            sections: {
              create: original.sections.map(
                (section: {
                  sectionType: string
                  title: string
                  titleEn: string | null
                  content: string
                  contentEn: string | null
                  data: string | null
                  sortOrder: number
                }) => ({
                  sectionType: section.sectionType,
                  title: section.title,
                  titleEn: section.titleEn,
                  content: section.content,
                  contentEn: section.contentEn,
                  data: section.data,
                  sortOrder: section.sortOrder,
                })
              ),
            },
          },
          include: {
            sections: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        })

        return newReport
      },
      { maxWait: DB_MAX_WAIT_MS, timeout: DB_TIMEOUT_MS }
    )

    return success(mapReportFromPrisma(report as PrismaIRReport))
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return failure(createServiceError(ERROR_CODES.NOT_FOUND, `IR Report not found: ${id}`))
    }
    const message = error instanceof Error ? error.message : 'Failed to duplicate IR report'
    return failure(createServiceError(ERROR_CODES.DATABASE_ERROR, message, { id }))
  }
}

/**
 * セクション一覧を取得する
 *
 * @param reportId - レポートID
 * @returns セクション一覧またはエラー
 */
export async function getSections(reportId: string): Promise<IRReportListResult> {
  if (!reportId || typeof reportId !== 'string') {
    return failure(createServiceError(ERROR_CODES.VALIDATION_ERROR, 'reportId is required'))
  }

  try {
    const sections = await prisma.$transaction(
      async (tx) => {
        return tx.iRReportSection.findMany({
          where: { reportId },
          orderBy: { sortOrder: 'asc' },
        })
      },
      { maxWait: DB_MAX_WAIT_MS, timeout: DB_TIMEOUT_MS }
    )

    return success(sections as unknown as IRReportList[])
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get sections'
    return failure(createServiceError(ERROR_CODES.DATABASE_ERROR, message, { reportId }))
  }
}

/**
 * セクションを更新する
 *
 * @param reportId - レポートID
 * @param sectionType - セクションタイプ
 * @param data - 更新データ
 * @returns 更新されたセクションまたはエラー
 */
export async function updateSection(
  reportId: string,
  sectionType: IRSectionType,
  data: IRReportSectionUpdateInput
): Promise<IRReportSectionResult> {
  if (!reportId || typeof reportId !== 'string') {
    return failure(createServiceError(ERROR_CODES.VALIDATION_ERROR, 'reportId is required'))
  }

  if (!sectionType || typeof sectionType !== 'string') {
    return failure(createServiceError(ERROR_CODES.VALIDATION_ERROR, 'sectionType is required'))
  }

  if (!data || Object.keys(data).length === 0) {
    return failure(createServiceError(ERROR_CODES.VALIDATION_ERROR, 'No update data provided'))
  }

  try {
    const section = await prisma.$transaction(
      async (tx) => {
        const existing = await tx.iRReportSection.findFirst({
          where: { reportId, sectionType },
        })

        if (!existing) {
          throw new Error('NOT_FOUND')
        }

        const updateData: Record<string, unknown> = { ...data }
        if (data.data !== undefined) {
          updateData.data = stringifySectionData(data.data)
        }

        return tx.iRReportSection.update({
          where: { id: existing.id },
          data: updateData,
        })
      },
      { maxWait: DB_MAX_WAIT_MS, timeout: DB_TIMEOUT_MS }
    )

    return success(mapSectionFromPrisma(section as Parameters<typeof mapSectionFromPrisma>[0]))
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return failure(createServiceError(ERROR_CODES.NOT_FOUND, `Section not found: ${sectionType}`))
    }
    const message = error instanceof Error ? error.message : 'Failed to update section'
    return failure(
      createServiceError(ERROR_CODES.DATABASE_ERROR, message, { reportId, sectionType })
    )
  }
}

/**
 * セクション順序を変更する
 *
 * @param reportId - レポートID
 * @param order - セクションIDの順序配列
 * @returns 成功またはエラー
 */
export async function reorderSections(
  reportId: string,
  order: ReorderSectionsData
): Promise<IRReportListResult> {
  if (!reportId || typeof reportId !== 'string') {
    return failure(createServiceError(ERROR_CODES.VALIDATION_ERROR, 'reportId is required'))
  }

  if (!order?.sectionIds || !Array.isArray(order.sectionIds)) {
    return failure(createServiceError(ERROR_CODES.VALIDATION_ERROR, 'sectionIds array is required'))
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        const sections = await tx.iRReportSection.findMany({
          where: { reportId },
        })

        const sectionMap = new Map(sections.map((s: { id: string }) => [s.id, s]))
        for (const sectionId of order.sectionIds) {
          if (!sectionMap.has(sectionId)) {
            throw new Error(`INVALID_SECTION: ${sectionId}`)
          }
        }

        const updates = order.sectionIds.map((sectionId, index) =>
          tx.iRReportSection.update({
            where: { id: sectionId },
            data: { sortOrder: index },
          })
        )

        await Promise.all(updates)
      },
      { maxWait: DB_MAX_WAIT_MS, timeout: DB_TIMEOUT_MS }
    )

    return success([])
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('INVALID_SECTION')) {
      return failure(
        createServiceError(
          ERROR_CODES.VALIDATION_ERROR,
          `Invalid section ID in order: ${error.message}`
        )
      )
    }
    const message = error instanceof Error ? error.message : 'Failed to reorder sections'
    return failure(createServiceError(ERROR_CODES.DATABASE_ERROR, message, { reportId }))
  }
}
