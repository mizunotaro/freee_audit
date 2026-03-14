import { prisma } from '@/lib/db'
import type { AccountMapping, ConversionRule, MappingCondition } from '@/types/conversion'
import {
  type Result,
  type AppError,
  success,
  failure,
  isFailure,
  createAppError,
  ERROR_CODES,
} from '@/types/result'

export interface CreateMappingInput {
  companyId: string
  sourceCoaId: string
  sourceItemId: string
  targetCoaId: string
  targetItemId: string
  mappingType: '1to1' | '1toN' | 'Nto1' | 'complex'
  conversionRule?: ConversionRule
  percentage?: number
  notes?: string
  confidence?: number
  isManualReview?: boolean
  createdBy?: string
}

export interface UpdateMappingInput {
  targetItemId?: string
  mappingType?: '1to1' | '1toN' | 'Nto1' | 'complex'
  conversionRule?: ConversionRule
  percentage?: number
  notes?: string
  confidence?: number
  isManualReview?: boolean
}

export interface MappingFilters {
  sourceCoaId?: string
  targetCoaId?: string
  mappingType?: string
  isApproved?: boolean
  isManualReview?: boolean
  minConfidence?: number
}

export interface PaginatedResult<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface BatchResult {
  success: number
  failed: number
  errors: Array<{ index: number; message: string }>
}

export interface MappingStatistics {
  total: number
  approved: number
  pending: number
  needsReview: number
  byType: Record<string, number>
  averageConfidence: number
}

export class AccountMappingService {
  async create(data: CreateMappingInput): Promise<Result<AccountMapping, AppError>> {
    const validationResult = await this.validateMappingInput(data)
    if (isFailure(validationResult)) {
      return validationResult
    }

    const existingMapping = await prisma.accountMapping.findUnique({
      where: {
        companyId_sourceItemId_targetCoaId: {
          companyId: data.companyId,
          sourceItemId: data.sourceItemId,
          targetCoaId: data.targetCoaId,
        },
      },
    })

    if (existingMapping) {
      return failure(
        createAppError(
          ERROR_CODES.VALIDATION_ERROR,
          'Duplicate mapping: this source item is already mapped to this target COA'
        )
      )
    }

    const circularResult = await this.checkCircularReference(data.sourceItemId, data.targetItemId)
    if (isFailure(circularResult)) {
      return circularResult
    }

    const mapping = await prisma.accountMapping.create({
      data: {
        companyId: data.companyId,
        sourceCoaId: data.sourceCoaId,
        sourceItemId: data.sourceItemId,
        targetCoaId: data.targetCoaId,
        targetItemId: data.targetItemId,
        mappingType: data.mappingType,
        conversionRule: data.conversionRule ? JSON.stringify(data.conversionRule) : null,
        percentage: data.percentage,
        confidence: data.confidence ?? 1.0,
        isManualReview: data.isManualReview ?? false,
        isApproved: false,
        notes: data.notes,
        createdBy: data.createdBy,
      },
      include: {
        sourceItem: true,
        targetItem: true,
      },
    })

    return success(this.mapToAccountMapping(mapping))
  }

  async createBatch(mappings: CreateMappingInput[]): Promise<BatchResult> {
    const result: BatchResult = {
      success: 0,
      failed: 0,
      errors: [],
    }

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < mappings.length; i++) {
        try {
          await this.validateMappingInput(mappings[i])

          const existingMapping = await tx.accountMapping.findUnique({
            where: {
              companyId_sourceItemId_targetCoaId: {
                companyId: mappings[i].companyId,
                sourceItemId: mappings[i].sourceItemId,
                targetCoaId: mappings[i].targetCoaId,
              },
            },
          })

          if (existingMapping) {
            result.failed++
            result.errors.push({ index: i, message: 'Duplicate mapping' })
            continue
          }

          await tx.accountMapping.create({
            data: {
              companyId: mappings[i].companyId,
              sourceCoaId: mappings[i].sourceCoaId,
              sourceItemId: mappings[i].sourceItemId,
              targetCoaId: mappings[i].targetCoaId,
              targetItemId: mappings[i].targetItemId,
              mappingType: mappings[i].mappingType,
              conversionRule: mappings[i].conversionRule
                ? JSON.stringify(mappings[i].conversionRule)
                : null,
              percentage: mappings[i].percentage,
              confidence: mappings[i].confidence ?? 1.0,
              isManualReview: mappings[i].isManualReview ?? false,
              isApproved: false,
              notes: mappings[i].notes,
              createdBy: mappings[i].createdBy,
            },
          })

          result.success++
        } catch (error) {
          result.failed++
          result.errors.push({
            index: i,
            message: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      }
    })

    return result
  }

  async getById(id: string): Promise<AccountMapping | null> {
    const mapping = await prisma.accountMapping.findUnique({
      where: { id },
      include: {
        sourceItem: true,
        targetItem: true,
      },
    })

    if (!mapping) return null

    return this.mapToAccountMapping(mapping)
  }

  async getByCompany(
    companyId: string,
    filters?: MappingFilters,
    page: number = 1,
    limit: number = 50
  ): Promise<PaginatedResult<AccountMapping>> {
    const where: Record<string, unknown> = { companyId }

    if (filters) {
      if (filters.sourceCoaId) where.sourceCoaId = filters.sourceCoaId
      if (filters.targetCoaId) where.targetCoaId = filters.targetCoaId
      if (filters.mappingType) where.mappingType = filters.mappingType
      if (filters.isApproved !== undefined) where.isApproved = filters.isApproved
      if (filters.isManualReview !== undefined) where.isManualReview = filters.isManualReview
      if (filters.minConfidence !== undefined) {
        where.confidence = { gte: filters.minConfidence }
      }
    }

    const total = await prisma.accountMapping.count({ where })
    const mappings = await prisma.accountMapping.findMany({
      where,
      include: {
        sourceItem: true,
        targetItem: true,
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    })

    return {
      data: mappings.map((m) => this.mapToAccountMapping(m)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  async getBySourceAccount(companyId: string, sourceItemId: string): Promise<AccountMapping[]> {
    const mappings = await prisma.accountMapping.findMany({
      where: {
        companyId,
        sourceItemId,
      },
      include: {
        sourceItem: true,
        targetItem: true,
      },
    })

    return mappings.map((m) => this.mapToAccountMapping(m))
  }

  async update(id: string, data: UpdateMappingInput): Promise<Result<AccountMapping, AppError>> {
    const existing = await prisma.accountMapping.findUnique({
      where: { id },
    })

    if (!existing) {
      return failure(createAppError(ERROR_CODES.NOT_FOUND, `Mapping not found: ${id}`))
    }

    if (data.targetItemId && data.targetItemId !== existing.targetItemId) {
      const circularResult = await this.checkCircularReference(
        existing.sourceItemId,
        data.targetItemId
      )
      if (isFailure(circularResult)) {
        return circularResult
      }
    }

    const mapping = await prisma.accountMapping.update({
      where: { id },
      data: {
        targetItemId: data.targetItemId,
        mappingType: data.mappingType,
        conversionRule: data.conversionRule ? JSON.stringify(data.conversionRule) : undefined,
        percentage: data.percentage,
        notes: data.notes,
        confidence: data.confidence,
        isManualReview: data.isManualReview,
      },
      include: {
        sourceItem: true,
        targetItem: true,
      },
    })

    return success(this.mapToAccountMapping(mapping))
  }

  async delete(id: string): Promise<Result<void, AppError>> {
    const mapping = await prisma.accountMapping.findUnique({
      where: { id },
    })

    if (!mapping) {
      return failure(createAppError(ERROR_CODES.NOT_FOUND, `Mapping not found: ${id}`))
    }

    await prisma.accountMapping.delete({
      where: { id },
    })

    return success(undefined)
  }

  async approve(id: string, userId: string): Promise<Result<AccountMapping, AppError>> {
    const mapping = await prisma.accountMapping.findUnique({
      where: { id },
    })

    if (!mapping) {
      return failure(createAppError(ERROR_CODES.NOT_FOUND, `Mapping not found: ${id}`))
    }

    const updated = await prisma.accountMapping.update({
      where: { id },
      data: {
        isApproved: true,
        approvedBy: userId,
        approvedAt: new Date(),
      },
      include: {
        sourceItem: true,
        targetItem: true,
      },
    })

    await this.createAuditLog(mapping.companyId, id, 'approve', userId, {
      previousStatus: 'pending',
      newStatus: 'approved',
    })

    return success(this.mapToAccountMapping(updated))
  }

  async approveBatch(ids: string[], userId: string): Promise<BatchResult> {
    const result: BatchResult = {
      success: 0,
      failed: 0,
      errors: [],
    }

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < ids.length; i++) {
        try {
          const mapping = await tx.accountMapping.findUnique({
            where: { id: ids[i] },
          })

          if (!mapping) {
            result.failed++
            result.errors.push({ index: i, message: 'Mapping not found' })
            continue
          }

          await tx.accountMapping.update({
            where: { id: ids[i] },
            data: {
              isApproved: true,
              approvedBy: userId,
              approvedAt: new Date(),
            },
          })

          await tx.conversionAuditLog.create({
            data: {
              projectId: '',
              action: 'mapping_approve',
              entityType: 'account_mapping',
              entityId: ids[i],
              userId,
              newValue: JSON.stringify({
                previousStatus: 'pending',
                newStatus: 'approved',
              }),
            },
          })

          result.success++
        } catch (error) {
          result.failed++
          result.errors.push({
            index: i,
            message: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      }
    })

    return result
  }

  async getUnapprovedCount(companyId: string): Promise<number> {
    return prisma.accountMapping.count({
      where: {
        companyId,
        isApproved: false,
      },
    })
  }

  async getStatistics(companyId: string): Promise<MappingStatistics> {
    const [totalCount, approvedCount, pendingCount, needsReviewCount, typeStats, avgConfidence] =
      await Promise.all([
        prisma.accountMapping.count({ where: { companyId } }),
        prisma.accountMapping.count({
          where: { companyId, isApproved: true },
        }),
        prisma.accountMapping.count({
          where: { companyId, isApproved: false },
        }),
        prisma.accountMapping.count({
          where: { companyId, isManualReview: true },
        }),
        prisma.accountMapping.groupBy({
          by: ['mappingType'],
          where: { companyId },
          _count: { mappingType: true },
        }),
        prisma.accountMapping.aggregate({
          where: { companyId },
          _avg: { confidence: true },
        }),
      ])

    const byType: Record<string, number> = {}
    for (const stat of typeStats) {
      byType[stat.mappingType] = stat._count.mappingType
    }

    return {
      total: totalCount,
      approved: approvedCount,
      pending: pendingCount,
      needsReview: needsReviewCount,
      byType,
      averageConfidence: avgConfidence._avg.confidence ?? 0,
    }
  }

  async export(companyId: string, format: 'csv' | 'excel'): Promise<Buffer> {
    const mappings = await prisma.accountMapping.findMany({
      where: { companyId },
      include: {
        sourceItem: true,
        targetItem: true,
        sourceCoa: true,
        targetCoa: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    if (format === 'csv') {
      return this.exportToCSV(mappings)
    } else {
      return this.exportToExcel(mappings)
    }
  }

  private async validateMappingInput(data: CreateMappingInput): Promise<Result<void, AppError>> {
    const sourceItem = await prisma.chartOfAccountItem.findUnique({
      where: { id: data.sourceItemId },
    })

    if (!sourceItem) {
      return failure(
        createAppError(ERROR_CODES.NOT_FOUND, `Source item not found: ${data.sourceItemId}`)
      )
    }

    const targetItem = await prisma.chartOfAccountItem.findUnique({
      where: { id: data.targetItemId },
    })

    if (!targetItem) {
      return failure(
        createAppError(ERROR_CODES.NOT_FOUND, `Target item not found: ${data.targetItemId}`)
      )
    }

    const sourceCoa = await prisma.chartOfAccount.findUnique({
      where: { id: data.sourceCoaId },
    })

    if (!sourceCoa) {
      return failure(
        createAppError(ERROR_CODES.NOT_FOUND, `Source COA not found: ${data.sourceCoaId}`)
      )
    }

    const targetCoa = await prisma.chartOfAccount.findUnique({
      where: { id: data.targetCoaId },
    })

    if (!targetCoa) {
      return failure(
        createAppError(ERROR_CODES.NOT_FOUND, `Target COA not found: ${data.targetCoaId}`)
      )
    }

    if (sourceItem.coaId !== data.sourceCoaId) {
      return failure(
        createAppError(
          ERROR_CODES.VALIDATION_ERROR,
          'Source item does not belong to the specified source COA'
        )
      )
    }

    if (targetItem.coaId !== data.targetCoaId) {
      return failure(
        createAppError(
          ERROR_CODES.VALIDATION_ERROR,
          'Target item does not belong to the specified target COA'
        )
      )
    }

    if (data.conversionRule) {
      const ruleResult = this.validateConversionRule(data.conversionRule)
      if (isFailure(ruleResult)) {
        return ruleResult
      }
    }

    if (data.percentage !== undefined && (data.percentage < 0 || data.percentage > 100)) {
      return failure(
        createAppError(ERROR_CODES.VALIDATION_ERROR, 'Percentage must be between 0 and 100')
      )
    }

    return success(undefined)
  }

  private validateConversionRule(rule: ConversionRule): Result<void, AppError> {
    const validTypes = ['direct', 'percentage', 'formula', 'ai_suggested']
    if (!validTypes.includes(rule.type)) {
      return failure(
        createAppError(ERROR_CODES.VALIDATION_ERROR, `Invalid conversion rule type: ${rule.type}`)
      )
    }

    if (rule.type === 'percentage' && rule.percentage === undefined) {
      return failure(
        createAppError(ERROR_CODES.VALIDATION_ERROR, 'Percentage rule requires percentage value')
      )
    }

    if (rule.type === 'formula' && !rule.formula) {
      return failure(
        createAppError(ERROR_CODES.VALIDATION_ERROR, 'Formula rule requires formula expression')
      )
    }

    if (rule.conditions) {
      for (const condition of rule.conditions) {
        const conditionResult = this.validateCondition(condition)
        if (isFailure(conditionResult)) {
          return conditionResult
        }
      }
    }

    return success(undefined)
  }

  private validateCondition(condition: MappingCondition): Result<void, AppError> {
    const validOperators = ['equals', 'contains', 'gt', 'lt', 'between']
    if (!validOperators.includes(condition.operator)) {
      return failure(
        createAppError(
          ERROR_CODES.VALIDATION_ERROR,
          `Invalid condition operator: ${condition.operator}`
        )
      )
    }

    if (!condition.field || condition.field.trim() === '') {
      return failure(createAppError(ERROR_CODES.VALIDATION_ERROR, 'Condition field is required'))
    }

    if (!condition.targetAccountId || condition.targetAccountId.trim() === '') {
      return failure(
        createAppError(ERROR_CODES.VALIDATION_ERROR, 'Condition target account ID is required')
      )
    }

    return success(undefined)
  }

  private async checkCircularReference(
    sourceItemId: string,
    targetItemId: string
  ): Promise<Result<void, AppError>> {
    if (sourceItemId === targetItemId) {
      return failure(
        createAppError(
          ERROR_CODES.VALIDATION_ERROR,
          'Circular reference: source and target items cannot be the same'
        )
      )
    }

    const visited = new Set<string>()
    const queue = [targetItemId]

    while (queue.length > 0) {
      const currentId = queue.shift()!

      if (currentId === sourceItemId) {
        return failure(
          createAppError(
            ERROR_CODES.VALIDATION_ERROR,
            'Circular reference detected in mapping chain'
          )
        )
      }

      if (visited.has(currentId)) continue
      visited.add(currentId)

      const mappingsAsSource = await prisma.accountMapping.findMany({
        where: { sourceItemId: currentId },
        select: { targetItemId: true },
      })

      for (const mapping of mappingsAsSource) {
        queue.push(mapping.targetItemId)
      }
    }

    return success(undefined)
  }

  private async createAuditLog(
    companyId: string,
    entityId: string,
    action: string,
    userId: string,
    details: Record<string, unknown>
  ): Promise<void> {
    const project = await prisma.conversionProject.findFirst({
      where: { companyId },
    })

    await prisma.conversionAuditLog.create({
      data: {
        projectId: project?.id ?? '',
        action,
        entityType: 'account_mapping',
        entityId,
        userId,
        newValue: JSON.stringify(details),
      },
    })
  }

  private mapToAccountMapping(mapping: {
    id: string
    sourceItem: { id: string; code: string; name: string }
    targetItem: { id: string; code: string; name: string }
    mappingType: string
    conversionRule: string | null
    confidence: number
    isManualReview: boolean
    notes: string | null
  }): AccountMapping {
    return {
      id: mapping.id,
      sourceAccountId: mapping.sourceItem.id,
      sourceAccountCode: mapping.sourceItem.code,
      sourceAccountName: mapping.sourceItem.name,
      targetAccountId: mapping.targetItem.id,
      targetAccountCode: mapping.targetItem.code,
      targetAccountName: mapping.targetItem.name,
      mappingType: mapping.mappingType as '1to1' | '1toN' | 'Nto1' | 'complex',
      conversionRule: mapping.conversionRule
        ? (JSON.parse(mapping.conversionRule) as ConversionRule)
        : undefined,
      confidence: mapping.confidence,
      isManualReview: mapping.isManualReview,
      notes: mapping.notes ?? undefined,
    }
  }

  private exportToCSV(
    mappings: Array<{
      id: string
      sourceItem: { code: string; name: string }
      targetItem: { code: string; name: string }
      mappingType: string
      confidence: number
      isApproved: boolean
      isManualReview: boolean
      notes: string | null
    }>
  ): Buffer {
    const headers = [
      'ID',
      'Source Code',
      'Source Name',
      'Target Code',
      'Target Name',
      'Mapping Type',
      'Confidence',
      'Approved',
      'Manual Review',
      'Notes',
    ]

    const rows = mappings.map((m) => [
      m.id,
      m.sourceItem.code,
      m.sourceItem.name,
      m.targetItem.code,
      m.targetItem.name,
      m.mappingType,
      m.confidence.toFixed(2),
      m.isApproved ? 'Yes' : 'No',
      m.isManualReview ? 'Yes' : 'No',
      m.notes ?? '',
    ])

    const csv = [headers.join(','), ...rows.map((r) => r.map(escapeCsvField).join(','))].join('\n')

    return Buffer.from(csv, 'utf-8')
  }

  private exportToExcel(
    mappings: Array<{
      id: string
      sourceItem: { code: string; name: string }
      targetItem: { code: string; name: string }
      mappingType: string
      confidence: number
      isApproved: boolean
      isManualReview: boolean
      notes: string | null
    }>
  ): Buffer {
    return this.exportToCSV(mappings)
  }
}

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export const accountMappingService = new AccountMappingService()
