import { prisma } from '@/lib/db'
import type {
  ConversionRationale,
  CreateRationaleInput,
  UpdateRationaleInput,
  RationaleFilters,
  EntityType,
  RationaleType,
  RationaleAuditEntry,
  AuditReport,
  StandardReference,
} from '@/types/conversion'
import type { PaginatedResult, BatchResult } from './account-mapping-service'

export class ConversionRationaleService {
  async create(data: CreateRationaleInput): Promise<ConversionRationale> {
    const existing = await prisma.conversionRationale.findUnique({
      where: {
        projectId_entityType_entityId_rationaleType: {
          projectId: data.projectId,
          entityType: data.entityType,
          entityId: data.entityId,
          rationaleType: data.rationaleType,
        },
      },
    })

    if (existing) {
      throw new Error('Rationale already exists for this entity and type')
    }

    const rationale = await prisma.conversionRationale.create({
      data: {
        projectId: data.projectId,
        entityType: data.entityType,
        entityId: data.entityId,
        rationaleType: data.rationaleType,
        sourceReferenceId: data.sourceReferenceId,
        targetReferenceId: data.targetReferenceId,
        summary: data.summary,
        summaryEn: data.summaryEn,
        detailedExplanation: data.detailedExplanation,
        detailedExplanationEn: data.detailedExplanationEn,
        impactAmount: data.impactAmount,
        impactDirection: data.impactDirection,
        isAiGenerated: data.isAiGenerated ?? false,
        aiModelUsed: data.aiModelUsed,
        aiConfidence: data.aiConfidence,
        isReviewed: false,
        createdBy: data.createdBy,
      },
      include: {
        sourceReference: true,
        targetReference: true,
      },
    })

    await this.createAuditTrail(
      rationale.id,
      'create',
      null,
      this.rationaleToJSON(rationale),
      data.createdBy
    )

    return this.mapToConversionRationale(rationale)
  }

  async createBatch(rationales: CreateRationaleInput[]): Promise<BatchResult> {
    const result: BatchResult = {
      success: 0,
      failed: 0,
      errors: [],
    }

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < rationales.length; i++) {
        try {
          const data = rationales[i]

          const existing = await tx.conversionRationale.findUnique({
            where: {
              projectId_entityType_entityId_rationaleType: {
                projectId: data.projectId,
                entityType: data.entityType,
                entityId: data.entityId,
                rationaleType: data.rationaleType,
              },
            },
          })

          if (existing) {
            result.failed++
            result.errors.push({ index: i, message: 'Rationale already exists' })
            continue
          }

          const created = await tx.conversionRationale.create({
            data: {
              projectId: data.projectId,
              entityType: data.entityType,
              entityId: data.entityId,
              rationaleType: data.rationaleType,
              sourceReferenceId: data.sourceReferenceId,
              targetReferenceId: data.targetReferenceId,
              summary: data.summary,
              summaryEn: data.summaryEn,
              detailedExplanation: data.detailedExplanation,
              detailedExplanationEn: data.detailedExplanationEn,
              impactAmount: data.impactAmount,
              impactDirection: data.impactDirection,
              isAiGenerated: data.isAiGenerated ?? false,
              aiModelUsed: data.aiModelUsed,
              aiConfidence: data.aiConfidence,
              isReviewed: false,
              createdBy: data.createdBy,
            },
          })

          await tx.rationaleAuditTrail.create({
            data: {
              rationaleId: created.id,
              action: 'create',
              newValue: JSON.stringify(data),
              userId: data.createdBy,
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

  async getById(id: string): Promise<ConversionRationale | null> {
    const rationale = await prisma.conversionRationale.findUnique({
      where: { id },
      include: {
        sourceReference: true,
        targetReference: true,
      },
    })

    if (!rationale) return null

    return this.mapToConversionRationale(rationale)
  }

  async getByEntity(
    projectId: string,
    entityType: EntityType,
    entityId: string
  ): Promise<ConversionRationale[]> {
    const rationales = await prisma.conversionRationale.findMany({
      where: {
        projectId,
        entityType,
        entityId,
      },
      include: {
        sourceReference: true,
        targetReference: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    return rationales.map((r) => this.mapToConversionRationale(r))
  }

  async getByProject(
    projectId: string,
    filters?: RationaleFilters,
    page: number = 1,
    limit: number = 50
  ): Promise<PaginatedResult<ConversionRationale>> {
    const where: Record<string, unknown> = { projectId }

    if (filters) {
      if (filters.entityType) where.entityType = filters.entityType
      if (filters.rationaleType) where.rationaleType = filters.rationaleType
      if (filters.isReviewed !== undefined) where.isReviewed = filters.isReviewed
      if (filters.isAiGenerated !== undefined) where.isAiGenerated = filters.isAiGenerated
    }

    const total = await prisma.conversionRationale.count({ where })
    const rationales = await prisma.conversionRationale.findMany({
      where,
      include: {
        sourceReference: true,
        targetReference: true,
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    })

    return {
      data: rationales.map((r) => this.mapToConversionRationale(r)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  async update(
    id: string,
    data: UpdateRationaleInput,
    userId: string
  ): Promise<ConversionRationale> {
    const existing = await prisma.conversionRationale.findUnique({
      where: { id },
    })

    if (!existing) {
      throw new Error(`Rationale not found: ${id}`)
    }

    const previousValue = this.rationaleToJSON(existing)
    const changedFields = Object.keys(data)

    const rationale = await prisma.conversionRationale.update({
      where: { id },
      data: {
        sourceReferenceId: data.sourceReferenceId,
        targetReferenceId: data.targetReferenceId,
        summary: data.summary,
        summaryEn: data.summaryEn,
        detailedExplanation: data.detailedExplanation,
        detailedExplanationEn: data.detailedExplanationEn,
        impactAmount: data.impactAmount,
        impactDirection: data.impactDirection,
      },
      include: {
        sourceReference: true,
        targetReference: true,
      },
    })

    await this.createAuditTrail(
      id,
      'update',
      previousValue,
      this.rationaleToJSON(rationale),
      userId,
      changedFields
    )

    return this.mapToConversionRationale(rationale)
  }

  async review(id: string, userId: string, notes?: string): Promise<ConversionRationale> {
    const existing = await prisma.conversionRationale.findUnique({
      where: { id },
    })

    if (!existing) {
      throw new Error(`Rationale not found: ${id}`)
    }

    const previousValue = this.rationaleToJSON(existing)

    const rationale = await prisma.conversionRationale.update({
      where: { id },
      data: {
        isReviewed: true,
        reviewedBy: userId,
        reviewedAt: new Date(),
      },
      include: {
        sourceReference: true,
        targetReference: true,
      },
    })

    await this.createAuditTrail(
      id,
      'review',
      previousValue,
      this.rationaleToJSON(rationale),
      userId,
      ['isReviewed', 'reviewedBy', 'reviewedAt'],
      notes
    )

    await this.updateProjectReviewStatus(existing.projectId)

    return this.mapToConversionRationale(rationale)
  }

  async reviewBatch(ids: string[], userId: string): Promise<BatchResult> {
    const result: BatchResult = {
      success: 0,
      failed: 0,
      errors: [],
    }

    const projectIds = new Set<string>()

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < ids.length; i++) {
        try {
          const existing = await tx.conversionRationale.findUnique({
            where: { id: ids[i] },
          })

          if (!existing) {
            result.failed++
            result.errors.push({ index: i, message: 'Rationale not found' })
            continue
          }

          const previousValue = JSON.stringify(existing)

          await tx.conversionRationale.update({
            where: { id: ids[i] },
            data: {
              isReviewed: true,
              reviewedBy: userId,
              reviewedAt: new Date(),
            },
          })

          await tx.rationaleAuditTrail.create({
            data: {
              rationaleId: ids[i],
              action: 'review',
              previousValue,
              newValue: JSON.stringify({
                isReviewed: true,
                reviewedBy: userId,
                reviewedAt: new Date().toISOString(),
              }),
              changedFields: JSON.stringify(['isReviewed', 'reviewedBy', 'reviewedAt']),
              userId,
            },
          })

          projectIds.add(existing.projectId)
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

    for (const projectId of projectIds) {
      await this.updateProjectReviewStatus(projectId)
    }

    return result
  }

  async updateProjectReviewStatus(projectId: string): Promise<void> {
    const [totalCount, reviewedCount] = await Promise.all([
      prisma.conversionRationale.count({ where: { projectId } }),
      prisma.conversionRationale.count({ where: { projectId, isReviewed: true } }),
    ])

    let status: string
    if (totalCount === 0) {
      status = 'not_started'
    } else if (reviewedCount === 0) {
      status = 'not_started'
    } else if (reviewedCount < totalCount) {
      status = 'in_progress'
    } else {
      status = 'completed'
    }

    await prisma.conversionProject.update({
      where: { id: projectId },
      data: {
        rationaleReviewStatus: status,
        rationaleReviewedAt: status === 'completed' ? new Date() : undefined,
      },
    })
  }

  async getAuditTrail(rationaleId: string): Promise<RationaleAuditEntry[]> {
    const trail = await prisma.rationaleAuditTrail.findMany({
      where: { rationaleId },
      orderBy: { createdAt: 'asc' },
    })

    return trail.map((t) => ({
      id: t.id,
      rationaleId: t.rationaleId,
      action: t.action as 'create' | 'update' | 'review' | 'approve' | 'reject',
      previousValue: t.previousValue ? JSON.parse(t.previousValue) : undefined,
      newValue: t.newValue ? JSON.parse(t.newValue) : undefined,
      changedFields: t.changedFields ? JSON.parse(t.changedFields) : undefined,
      userId: t.userId ?? undefined,
      userName: t.userName ?? undefined,
      userRole: t.userRole ?? undefined,
      ipAddress: t.ipAddress ?? undefined,
      userAgent: t.userAgent ?? undefined,
      notes: t.notes ?? undefined,
      createdAt: t.createdAt,
    }))
  }

  async generateAuditReport(projectId: string): Promise<AuditReport> {
    const project = await prisma.conversionProject.findUnique({
      where: { id: projectId },
    })

    if (!project) {
      throw new Error(`Project not found: ${projectId}`)
    }

    const rationales = await prisma.conversionRationale.findMany({
      where: { projectId },
      include: {
        sourceReference: true,
        targetReference: true,
      },
    })

    const totalRationales = rationales.length
    const reviewedRationales = rationales.filter((r) => r.isReviewed).length
    const aiGeneratedRationales = rationales.filter((r) => r.isAiGenerated).length
    const pendingReview = totalRationales - reviewedRationales

    const byEntityType: Record<EntityType, number> = {
      mapping: 0,
      journal_conversion: 0,
      adjusting_entry: 0,
      fs_conversion: 0,
    }

    const byRationaleType: Record<RationaleType, number> = {
      mapping_basis: 0,
      difference_explanation: 0,
      adjustment_reason: 0,
      disclosure_requirement: 0,
      measurement_change: 0,
      presentation_change: 0,
    }

    for (const r of rationales) {
      byEntityType[r.entityType as EntityType] = (byEntityType[r.entityType as EntityType] || 0) + 1
      byRationaleType[r.rationaleType as RationaleType] =
        (byRationaleType[r.rationaleType as RationaleType] || 0) + 1
    }

    const unreviewedItems = rationales
      .filter((r) => !r.isReviewed)
      .map((r) => ({
        entityType: r.entityType as EntityType,
        entityId: r.entityId,
        summary: r.summary,
        createdAt: r.createdAt,
      }))

    const significantImpacts = rationales
      .filter((r) => r.impactAmount !== null && Math.abs(r.impactAmount!) > 0)
      .sort((a, b) => Math.abs(b.impactAmount!) - Math.abs(a.impactAmount!))
      .slice(0, 20)
      .map((r) => ({
        entityType: r.entityType as EntityType,
        entityId: r.entityId,
        impactAmount: r.impactAmount!,
        summary: r.summary,
      }))

    const referenceUsage = new Map<string, { reference: StandardReference; count: number }>()

    for (const r of rationales) {
      if (r.sourceReference) {
        const key = r.sourceReference.id
        const existing = referenceUsage.get(key)
        if (existing) {
          existing.count++
        } else {
          referenceUsage.set(key, {
            reference: this.mapToStandardReference(r.sourceReference),
            count: 1,
          })
        }
      }
      if (r.targetReference) {
        const key = r.targetReference.id
        const existing = referenceUsage.get(key)
        if (existing) {
          existing.count++
        } else {
          referenceUsage.set(key, {
            reference: this.mapToStandardReference(r.targetReference),
            count: 1,
          })
        }
      }
    }

    const standardReferences = Array.from(referenceUsage.values())
      .sort((a, b) => b.count - a.count)
      .map((v) => ({
        reference: v.reference,
        usageCount: v.count,
      }))

    return {
      projectId,
      projectName: project.name,
      generatedAt: new Date(),
      summary: {
        totalRationales,
        reviewedRationales,
        aiGeneratedRationales,
        pendingReview,
      },
      byEntityType,
      byRationaleType,
      unreviewedItems,
      significantImpacts,
      standardReferences,
    }
  }

  async delete(id: string, userId?: string): Promise<void> {
    const rationale = await prisma.conversionRationale.findUnique({
      where: { id },
    })

    if (!rationale) {
      throw new Error(`Rationale not found: ${id}`)
    }

    await prisma.rationaleAuditTrail.create({
      data: {
        rationaleId: id,
        action: 'delete',
        previousValue: JSON.stringify(rationale),
        userId,
      },
    })

    await prisma.conversionRationale.delete({
      where: { id },
    })

    await this.updateProjectReviewStatus(rationale.projectId)
  }

  private async createAuditTrail(
    rationaleId: string,
    action: string,
    previousValue: string | null,
    newValue: string | null,
    userId?: string,
    changedFields?: string[],
    notes?: string
  ): Promise<void> {
    await prisma.rationaleAuditTrail.create({
      data: {
        rationaleId,
        action,
        previousValue,
        newValue,
        changedFields: changedFields ? JSON.stringify(changedFields) : null,
        userId,
        notes,
      },
    })
  }

  private rationaleToJSON(rationale: {
    id: string
    projectId: string
    entityType: string
    entityId: string
    rationaleType: string
    sourceReferenceId: string | null
    targetReferenceId: string | null
    summary: string
    summaryEn: string | null
    detailedExplanation: string | null
    detailedExplanationEn: string | null
    impactAmount: number | null
    impactDirection: string | null
    isAiGenerated: boolean
    aiModelUsed: string | null
    aiConfidence: number | null
    isReviewed: boolean
    reviewedBy: string | null
    reviewedAt: Date | null
    createdBy: string | null
  }): string {
    return JSON.stringify({
      id: rationale.id,
      projectId: rationale.projectId,
      entityType: rationale.entityType,
      entityId: rationale.entityId,
      rationaleType: rationale.rationaleType,
      sourceReferenceId: rationale.sourceReferenceId,
      targetReferenceId: rationale.targetReferenceId,
      summary: rationale.summary,
      summaryEn: rationale.summaryEn,
      detailedExplanation: rationale.detailedExplanation,
      detailedExplanationEn: rationale.detailedExplanationEn,
      impactAmount: rationale.impactAmount,
      impactDirection: rationale.impactDirection,
      isAiGenerated: rationale.isAiGenerated,
      aiModelUsed: rationale.aiModelUsed,
      aiConfidence: rationale.aiConfidence,
      isReviewed: rationale.isReviewed,
      reviewedBy: rationale.reviewedBy,
      reviewedAt: rationale.reviewedAt?.toISOString(),
      createdBy: rationale.createdBy,
    })
  }

  private mapToConversionRationale(rationale: {
    id: string
    projectId: string
    entityType: string
    entityId: string
    rationaleType: string
    sourceReferenceId: string | null
    targetReferenceId: string | null
    sourceReference: {
      id: string
      standard: string
      referenceType: string
      referenceNumber: string
      title: string
      titleEn: string | null
      description: string | null
      descriptionEn: string | null
      effectiveDate: Date | null
      supersededDate: Date | null
      isActive: boolean
      officialUrl: string | null
      keywords: string | null
    } | null
    targetReference: {
      id: string
      standard: string
      referenceType: string
      referenceNumber: string
      title: string
      titleEn: string | null
      description: string | null
      descriptionEn: string | null
      effectiveDate: Date | null
      supersededDate: Date | null
      isActive: boolean
      officialUrl: string | null
      keywords: string | null
    } | null
    summary: string
    summaryEn: string | null
    detailedExplanation: string | null
    detailedExplanationEn: string | null
    impactAmount: number | null
    impactDirection: string | null
    isAiGenerated: boolean
    aiModelUsed: string | null
    aiConfidence: number | null
    isReviewed: boolean
    reviewedBy: string | null
    reviewedAt: Date | null
    createdBy: string | null
    createdAt: Date
    updatedAt: Date
  }): ConversionRationale {
    return {
      id: rationale.id,
      projectId: rationale.projectId,
      entityType: rationale.entityType as EntityType,
      entityId: rationale.entityId,
      rationaleType: rationale.rationaleType as RationaleType,
      sourceReference: rationale.sourceReference
        ? this.mapToStandardReference(rationale.sourceReference)
        : undefined,
      targetReference: rationale.targetReference
        ? this.mapToStandardReference(rationale.targetReference)
        : undefined,
      summary: rationale.summary,
      summaryEn: rationale.summaryEn ?? undefined,
      detailedExplanation: rationale.detailedExplanation ?? undefined,
      detailedExplanationEn: rationale.detailedExplanationEn ?? undefined,
      impactAmount: rationale.impactAmount ?? undefined,
      impactDirection: rationale.impactDirection as
        | 'increase'
        | 'decrease'
        | 'reclassification'
        | undefined,
      isAiGenerated: rationale.isAiGenerated,
      aiModelUsed: rationale.aiModelUsed ?? undefined,
      aiConfidence: rationale.aiConfidence ?? undefined,
      isReviewed: rationale.isReviewed,
      reviewedBy: rationale.reviewedBy ?? undefined,
      reviewedAt: rationale.reviewedAt ?? undefined,
      createdBy: rationale.createdBy ?? undefined,
      createdAt: rationale.createdAt,
      updatedAt: rationale.updatedAt,
    }
  }

  private mapToStandardReference(reference: {
    id: string
    standard: string
    referenceType: string
    referenceNumber: string
    title: string
    titleEn: string | null
    description: string | null
    descriptionEn: string | null
    effectiveDate: Date | null
    supersededDate: Date | null
    isActive: boolean
    officialUrl: string | null
    keywords: string | null
  }): StandardReference {
    return {
      id: reference.id,
      standard: reference.standard as 'JGAAP' | 'USGAAP' | 'IFRS',
      referenceType: reference.referenceType as ReferenceType,
      referenceNumber: reference.referenceNumber,
      title: reference.title,
      titleEn: reference.titleEn ?? undefined,
      description: reference.description ?? undefined,
      descriptionEn: reference.descriptionEn ?? undefined,
      effectiveDate: reference.effectiveDate ?? undefined,
      supersededDate: reference.supersededDate ?? undefined,
      isActive: reference.isActive,
      officialUrl: reference.officialUrl ?? undefined,
      keywords: reference.keywords ? JSON.parse(reference.keywords) : undefined,
    }
  }
}

type ReferenceType =
  | 'ASBJ_statement'
  | 'ASBJ_guidance'
  | 'JICPA_guideline'
  | 'ASC_topic'
  | 'ASC_subtopic'
  | 'ASC_section'
  | 'ASC_paragraph'
  | 'IFRS_standard'
  | 'IAS_standard'
  | 'IFRIC_interpretation'
  | 'SIC_interpretation'

export const conversionRationaleService = new ConversionRationaleService()
