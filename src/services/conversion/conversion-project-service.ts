import { prisma } from '@/lib/db'
import type {
  ConversionProject,
  ConversionSettings,
  ConversionStatistics,
  ConversionStatus,
  AccountingStandard,
  CreateConversionProjectRequest,
} from '@/types/conversion'

const DEFAULT_SETTINGS: ConversionSettings = {
  includeJournals: true,
  includeFinancialStatements: true,
  generateAdjustingEntries: true,
  aiAssistedMapping: true,
}

export interface ProjectFilters {
  status?: ConversionStatus
  targetStandard?: string
  periodStart?: Date
  periodEnd?: Date
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

export class ConversionProjectService {
  async create(
    companyId: string,
    data: CreateConversionProjectRequest,
    userId?: string
  ): Promise<ConversionProject> {
    const jgaapStandard = await prisma.accountingStandard.findUnique({
      where: { code: 'JGAAP' },
    })
    if (!jgaapStandard) {
      throw new Error('JGAAP standard not found. Please run seed first.')
    }

    const targetStandard = await prisma.accountingStandard.findUnique({
      where: { code: data.targetStandard },
    })
    if (!targetStandard) {
      throw new Error(`Target standard not found: ${data.targetStandard}`)
    }

    const targetCoa = await prisma.chartOfAccount.findUnique({
      where: { id: data.targetCoaId },
    })
    if (!targetCoa) {
      throw new Error(`Target COA not found: ${data.targetCoaId}`)
    }

    const settings: ConversionSettings = {
      ...DEFAULT_SETTINGS,
      ...data.settings,
    }

    const project = await prisma.conversionProject.create({
      data: {
        companyId,
        name: data.name,
        description: data.description ?? null,
        sourceStandardId: jgaapStandard.id,
        targetStandardId: targetStandard.id,
        targetCoaId: data.targetCoaId,
        periodStart: new Date(data.periodStart),
        periodEnd: new Date(data.periodEnd),
        status: 'draft',
        progress: 0,
        settings: JSON.stringify(settings),
        createdBy: userId ?? null,
      },
      include: {
        sourceStandard: true,
        targetStandard: true,
        targetCoa: true,
      },
    })

    return this.mapToProject(project)
  }

  async getById(id: string): Promise<ConversionProject | null> {
    const project = await prisma.conversionProject.findUnique({
      where: { id },
      include: {
        sourceStandard: true,
        targetStandard: true,
        targetCoa: true,
      },
    })

    if (!project) return null
    return this.mapToProject(project)
  }

  async getByCompany(
    companyId: string,
    filters?: ProjectFilters,
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedResult<ConversionProject>> {
    const where: Record<string, unknown> = { companyId }

    if (filters) {
      if (filters.status) where.status = filters.status
      if (filters.targetStandard) {
        where.targetStandard = { code: filters.targetStandard }
      }
      if (filters.periodStart) {
        where.periodStart = { gte: filters.periodStart }
      }
      if (filters.periodEnd) {
        where.periodEnd = { lte: filters.periodEnd }
      }
    }

    const total = await prisma.conversionProject.count({ where })
    const projects = await prisma.conversionProject.findMany({
      where,
      include: {
        sourceStandard: true,
        targetStandard: true,
        targetCoa: true,
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    })

    return {
      data: projects.map((p) => this.mapToProject(p)),
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
    data: Partial<{
      name: string
      description: string
      settings: Partial<ConversionSettings>
      status: ConversionStatus
    }>
  ): Promise<ConversionProject> {
    const existing = await prisma.conversionProject.findUnique({
      where: { id },
    })

    if (!existing) {
      throw new Error(`Project not found: ${id}`)
    }

    if (!['draft', 'mapping'].includes(existing.status)) {
      throw new Error(`Cannot update project with status: ${existing.status}`)
    }

    const updateData: Record<string, unknown> = {}

    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.status !== undefined) updateData.status = data.status

    if (data.settings) {
      const currentSettings = JSON.parse(existing.settings) as ConversionSettings
      updateData.settings = JSON.stringify({
        ...currentSettings,
        ...data.settings,
      })
    }

    const project = await prisma.conversionProject.update({
      where: { id },
      data: updateData,
      include: {
        sourceStandard: true,
        targetStandard: true,
        targetCoa: true,
      },
    })

    return this.mapToProject(project)
  }

  async delete(id: string): Promise<void> {
    const project = await prisma.conversionProject.findUnique({
      where: { id },
    })

    if (!project) {
      throw new Error(`Project not found: ${id}`)
    }

    if (project.status === 'converting') {
      throw new Error('Cannot delete project while conversion is in progress')
    }

    await prisma.conversionProject.delete({
      where: { id },
    })
  }

  async updateProgress(id: string, progress: number, status?: ConversionStatus): Promise<void> {
    const updateData: Record<string, unknown> = { progress }

    if (status) {
      updateData.status = status
      if (status === 'completed') {
        updateData.completedAt = new Date()
      }
    }

    await prisma.conversionProject.update({
      where: { id },
      data: updateData,
    })
  }

  async updateStatistics(id: string, statistics: ConversionStatistics): Promise<void> {
    await prisma.conversionProject.update({
      where: { id },
      data: {
        statistics: JSON.stringify(statistics),
      },
    })
  }

  private mapToProject(project: {
    id: string
    companyId: string
    name: string
    description: string | null
    sourceStandard: { code: string }
    targetStandard: { code: string }
    targetCoaId: string
    periodStart: Date
    periodEnd: Date
    status: string
    progress: number
    settings: string
    statistics: string | null
    createdBy: string | null
    createdAt: Date
    updatedAt: Date
    completedAt: Date | null
  }): ConversionProject {
    return {
      id: project.id,
      companyId: project.companyId,
      name: project.name,
      description: project.description ?? undefined,
      sourceStandard: project.sourceStandard.code as AccountingStandard,
      targetStandard: project.targetStandard.code as AccountingStandard,
      targetCoaId: project.targetCoaId,
      periodStart: project.periodStart,
      periodEnd: project.periodEnd,
      status: project.status as ConversionStatus,
      progress: project.progress,
      settings: JSON.parse(project.settings) as ConversionSettings,
      statistics: project.statistics
        ? (JSON.parse(project.statistics) as ConversionStatistics)
        : undefined,
      createdBy: project.createdBy ?? '',
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      completedAt: project.completedAt ?? undefined,
    }
  }
}

export const conversionProjectService = new ConversionProjectService()
