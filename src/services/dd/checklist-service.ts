import { Result, createAppError } from '@/types/result'
import type {
  DDChecklistType,
  DDSeverity,
  DDItemStatus,
  DDCategory,
  DDCheckResult,
  DDChecklistRunResult,
  DDChecklistItemDefinition,
} from './types'
import { prisma } from '@/lib/db'
import type { DDChecklist, DDChecklistItem } from '@prisma/client'

export interface DDChecklistConfig {
  type: DDChecklistType
  fiscalYear: number
  companyId: string
  materialityThreshold?: number
  skipItems?: string[]
  focusCategories?: DDCategory[]
  createdBy?: string
}

export class DDChecklistService {
  async createChecklist(config: DDChecklistConfig): Promise<Result<DDChecklist>> {
    try {
      const checklist = await prisma.dDChecklist.create({
        data: {
          companyId: config.companyId,
          type: config.type,
          fiscalYear: config.fiscalYear,
          status: 'IN_PROGRESS',
          materiality: config.materialityThreshold ?? null,
          createdBy: config.createdBy ?? null,
        },
      })

      const definitions = await this.getChecklistDefinitions(config.type)
      const itemsData = definitions.map((def) => ({
        checklistId: checklist.id,
        category: def.category,
        itemCode: def.code,
        title: def.title,
        description: def.description,
        status: 'PENDING' as const,
        severity: def.severity,
      }))

      await prisma.dDChecklistItem.createMany({
        data: itemsData,
      })

      return { success: true, data: checklist }
    } catch (error) {
      return {
        success: false,
        error: createAppError(
          'CREATE_FAILED',
          error instanceof Error ? error.message : 'Failed to create checklist',
          { cause: error instanceof Error ? error : undefined }
        ),
      }
    }
  }

  async getChecklist(id: string): Promise<Result<DDChecklist & { items: DDChecklistItem[] }>> {
    try {
      const checklist = await prisma.dDChecklist.findUnique({
        where: { id },
        include: {
          items: true,
        },
      })

      if (!checklist) {
        return {
          success: false,
          error: createAppError('NOT_FOUND', 'Checklist not found'),
        }
      }

      return { success: true, data: checklist }
    } catch (error) {
      return {
        success: false,
        error: createAppError(
          'FETCH_FAILED',
          error instanceof Error ? error.message : 'Failed to fetch checklist',
          { cause: error instanceof Error ? error : undefined }
        ),
      }
    }
  }

  async updateChecklistItem(
    itemId: string,
    data: {
      status?: DDItemStatus
      findings?: string
      recommendation?: string
      evidence?: string
      checkedBy?: string
    }
  ): Promise<Result<DDChecklistItem>> {
    try {
      const item = await prisma.dDChecklistItem.update({
        where: { id: itemId },
        data: {
          status: data.status ?? undefined,
          findings: data.findings ?? undefined,
          recommendation: data.recommendation ?? undefined,
          evidence: data.evidence ?? undefined,
          checkedBy: data.checkedBy ?? undefined,
          checkedAt: data.status ? new Date() : undefined,
        },
      })

      return { success: true, data: item }
    } catch (error) {
      return {
        success: false,
        error: createAppError(
          'UPDATE_FAILED',
          error instanceof Error ? error.message : 'Failed to update item',
          { cause: error instanceof Error ? error : undefined }
        ),
      }
    }
  }

  async runChecklist(id: string): Promise<Result<DDChecklistRunResult>> {
    try {
      const checklistResult = await this.getChecklist(id)
      if (!checklistResult.success) {
        return { success: false, error: checklistResult.error }
      }

      const checklist = checklistResult.data
      const items = checklist.items

      const results: DDCheckResult[] = items.map((item: DDChecklistItem) => ({
        itemCode: item.itemCode,
        status: item.status as DDItemStatus,
        severity: item.severity as DDSeverity,
        findings: item.findings ? JSON.parse(item.findings) : [],
        evidence: item.evidence
          ? [{ type: 'DOCUMENT' as const, reference: item.evidence, summary: '' }]
          : [],
        checkedAt: item.checkedAt ?? new Date(),
        checkedBy: item.checkedBy ?? 'system',
      }))

      const runResult: DDChecklistRunResult = {
        checklistId: id,
        companyId: checklist.companyId,
        type: checklist.type as DDChecklistType,
        fiscalYear: checklist.fiscalYear,
        totalItems: items.length,
        passedItems: items.filter((i: DDChecklistItem) => i.status === 'PASSED').length,
        failedItems: items.filter((i: DDChecklistItem) => i.status === 'FAILED').length,
        pendingItems: items.filter((i: DDChecklistItem) => i.status === 'PENDING').length,
        naItems: items.filter((i: DDChecklistItem) => i.status === 'N_A').length,
        criticalFindings: items.filter(
          (i: DDChecklistItem) => i.severity === 'CRITICAL' && i.status === 'FAILED'
        ).length,
        highFindings: items.filter(
          (i: DDChecklistItem) => i.severity === 'HIGH' && i.status === 'FAILED'
        ).length,
        mediumFindings: items.filter(
          (i: DDChecklistItem) => i.severity === 'MEDIUM' && i.status === 'FAILED'
        ).length,
        lowFindings: items.filter((i: DDChecklistItem) => i.severity === 'LOW').length,
        overallScore: this.calculateOverallScore(items),
        results,
        runAt: new Date(),
        runBy: 'system',
      }

      await prisma.dDChecklist.update({
        where: { id },
        data: {
          overallScore: runResult.overallScore,
          status: 'COMPLETED',
        },
      })

      return { success: true, data: runResult }
    } catch (error) {
      return {
        success: false,
        error: createAppError(
          'RUN_FAILED',
          error instanceof Error ? error.message : 'Failed to run checklist',
          { cause: error instanceof Error ? error : undefined }
        ),
      }
    }
  }

  private calculateOverallScore(items: DDChecklistItem[]): number {
    const weights: Record<string, number> = {
      PASSED: 100,
      FAILED: 0,
      PENDING: 50,
      N_A: 50,
      IN_PROGRESS: 50,
    }

    const severityWeights: Record<string, number> = {
      CRITICAL: 5,
      HIGH: 4,
      MEDIUM: 3,
      LOW: 2,
      INFO: 1,
    }

    let totalWeight = 0
    let score = 0

    for (const item of items) {
      const statusWeight = weights[item.status] ?? 50
      const severityWeight = severityWeights[item.severity] ?? 1
      totalWeight += severityWeight
      score += statusWeight * severityWeight
    }

    return totalWeight > 0 ? Math.round(score / totalWeight) : 0
  }

  private async getChecklistDefinitions(
    type: DDChecklistType
  ): Promise<DDChecklistItemDefinition[]> {
    const { IPO_SHORT_REVIEW_CHECKLIST } = await import('./checklists/ipo-short-review')
    const { MA_FINANCIAL_DD_CHECKLIST } = await import('./checklists/ma-financial-dd')

    const definitionsMap: Record<string, DDChecklistItemDefinition[]> = {
      IPO_SHORT_REVIEW: [...IPO_SHORT_REVIEW_CHECKLIST],
      MA_FINANCIAL_DD: [...MA_FINANCIAL_DD_CHECKLIST],
      TAX_DD: [...IPO_SHORT_REVIEW_CHECKLIST], // TODO: Create dedicated checklist
      COMPREHENSIVE: [...IPO_SHORT_REVIEW_CHECKLIST, ...MA_FINANCIAL_DD_CHECKLIST],
    }

    return definitionsMap[type] ?? []
  }
}

export const ddChecklistService = new DDChecklistService()
