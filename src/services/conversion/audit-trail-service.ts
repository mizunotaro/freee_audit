import { prisma } from '@/lib/db'
import type { AuditAction, ApprovalStage } from '@/types/conversion'

export interface AuditTrailEntry {
  id: string
  projectId: string
  action: AuditAction
  entityType: string
  entityId?: string
  previousValue?: unknown
  newValue?: unknown
  changedFields?: string[]
  userId: string
  userName: string
  userRole: string
  ipAddress: string
  userAgent: string
  metadata?: Record<string, unknown>
  createdAt: Date
}

export interface AuditTrailReport {
  projectId: string
  projectName: string
  generatedAt: Date
  summary: {
    totalEntries: number
    byAction: Record<string, number>
    byUser: Array<{ userId: string; userName: string; count: number }>
    byDate: Array<{ date: string; count: number }>
  }
  timeline: AuditTrailEntry[]
  approvals: Array<{
    stage: ApprovalStage
    approver: string
    approvedAt: Date
    comment?: string
  }>
  significantChanges: Array<{
    action: AuditAction
    entityType: string
    description: string
    changedBy: string
    changedAt: Date
  }>
}

export interface AuditTrailFilters {
  action?: AuditAction
  entityType?: string
  userId?: string
  dateFrom?: Date
  dateTo?: Date
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

export interface LogParams {
  projectId: string
  action: AuditAction
  entityType: string
  entityId?: string
  previousValue?: unknown
  newValue?: unknown
  metadata?: Record<string, unknown>
  userId?: string
  ipAddress?: string
  userAgent?: string
}

export class AuditTrailService {
  async log(params: LogParams): Promise<AuditTrailEntry> {
    const user = params.userId
      ? await prisma.user.findUnique({
          where: { id: params.userId },
          select: { name: true, role: true },
        })
      : null

    const changedFields = this.extractChangedFields(params.previousValue, params.newValue)

    const entry = await prisma.conversionAuditLog.create({
      data: {
        projectId: params.projectId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        oldValue: params.previousValue ? JSON.stringify(params.previousValue) : null,
        newValue: params.newValue ? JSON.stringify(params.newValue) : null,
        userId: params.userId ?? null,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
        notes: params.metadata
          ? JSON.stringify({
              ...params.metadata,
              changedFields,
              userName: user?.name,
              userRole: user?.role,
            })
          : JSON.stringify({ changedFields, userName: user?.name, userRole: user?.role }),
      },
    })

    return {
      id: entry.id,
      projectId: entry.projectId,
      action: entry.action as AuditAction,
      entityType: entry.entityType,
      entityId: entry.entityId ?? undefined,
      previousValue: entry.oldValue ? JSON.parse(entry.oldValue) : undefined,
      newValue: entry.newValue ? JSON.parse(entry.newValue) : undefined,
      changedFields,
      userId: entry.userId ?? '',
      userName: user?.name ?? 'Unknown',
      userRole: user?.role ?? 'unknown',
      ipAddress: entry.ipAddress ?? '',
      userAgent: entry.userAgent ?? '',
      metadata: params.metadata,
      createdAt: entry.createdAt,
    }
  }

  async getByProject(
    projectId: string,
    filters?: AuditTrailFilters,
    page: number = 1,
    limit: number = 50
  ): Promise<PaginatedResult<AuditTrailEntry>> {
    const where: Record<string, unknown> = { projectId }

    if (filters) {
      if (filters.action) where.action = filters.action
      if (filters.entityType) where.entityType = filters.entityType
      if (filters.userId) where.userId = filters.userId
      if (filters.dateFrom)
        where.createdAt = { ...(where.createdAt as object), gte: filters.dateFrom }
      if (filters.dateTo) where.createdAt = { ...(where.createdAt as object), lte: filters.dateTo }
    }

    const total = await prisma.conversionAuditLog.count({ where })
    const entries = await prisma.conversionAuditLog.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    })

    const userIds = [...new Set(entries.map((e) => e.userId).filter(Boolean))]
    const users = await prisma.user.findMany({
      where: { id: { in: userIds as string[] } },
      select: { id: true, name: true, role: true },
    })
    const userMap = new Map(users.map((u) => [u.id, u]))

    return {
      data: entries.map((e) => this.mapToEntry(e, userMap)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  async generateReport(projectId: string): Promise<AuditTrailReport> {
    const project = await prisma.conversionProject.findUnique({
      where: { id: projectId },
      select: { name: true },
    })

    if (!project) {
      throw new Error(`Project not found: ${projectId}`)
    }

    const entries = await prisma.conversionAuditLog.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    })

    const userIds = [...new Set(entries.map((e) => e.userId).filter(Boolean))]
    const users = await prisma.user.findMany({
      where: { id: { in: userIds as string[] } },
      select: { id: true, name: true, role: true },
    })
    const userMap = new Map(users.map((u) => [u.id, u]))

    const mappedEntries = entries.map((e) => this.mapToEntry(e, userMap))

    const byAction: Record<string, number> = {}
    const byUserMap = new Map<string, { userName: string; count: number }>()
    const byDateMap = new Map<string, number>()

    for (const entry of mappedEntries) {
      byAction[entry.action] = (byAction[entry.action] ?? 0) + 1

      const existingUser = byUserMap.get(entry.userId)
      if (existingUser) {
        existingUser.count++
      } else {
        byUserMap.set(entry.userId, { userName: entry.userName, count: 1 })
      }

      const dateStr = entry.createdAt.toISOString().split('T')[0]
      byDateMap.set(dateStr, (byDateMap.get(dateStr) ?? 0) + 1)
    }

    const approvalEntries = mappedEntries.filter(
      (e) => e.action === 'approval_approve' || e.action === 'approval_submit'
    )

    const significantActions: AuditAction[] = [
      'project_execute',
      'mapping_batch_approve',
      'adjustment_approve',
      'approval_approve',
      'approval_reject',
    ]

    const significantChanges = mappedEntries
      .filter((e) => significantActions.includes(e.action))
      .map((e) => ({
        action: e.action,
        entityType: e.entityType,
        description: this.getActionDescription(e),
        changedBy: e.userName,
        changedAt: e.createdAt,
      }))

    return {
      projectId,
      projectName: project.name,
      generatedAt: new Date(),
      summary: {
        totalEntries: mappedEntries.length,
        byAction,
        byUser: Array.from(byUserMap.entries()).map(([userId, data]) => ({
          userId,
          userName: data.userName,
          count: data.count,
        })),
        byDate: Array.from(byDateMap.entries())
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => a.date.localeCompare(b.date)),
      },
      timeline: mappedEntries,
      approvals: approvalEntries.map((e) => ({
        stage: (e.metadata?.stage as ApprovalStage) ?? 'final_approval',
        approver: e.userName,
        approvedAt: e.createdAt,
        comment: e.metadata?.comment as string | undefined,
      })),
      significantChanges,
    }
  }

  async export(projectId: string, format: 'csv' | 'excel' | 'pdf'): Promise<Buffer> {
    const entries = await this.getByProject(projectId, undefined, 1, 10000)

    if (format === 'csv') {
      return this.exportToCsv(entries.data)
    }

    throw new Error(`Export format '${format}' not yet implemented`)
  }

  private exportToCsv(entries: AuditTrailEntry[]): Buffer {
    const headers = [
      'ID',
      'Project ID',
      'Action',
      'Entity Type',
      'Entity ID',
      'User',
      'User Role',
      'IP Address',
      'Created At',
      'Previous Value',
      'New Value',
    ]

    const rows = entries.map((e) => [
      e.id,
      e.projectId,
      e.action,
      e.entityType,
      e.entityId ?? '',
      e.userName,
      e.userRole,
      e.ipAddress,
      e.createdAt.toISOString(),
      e.previousValue ? JSON.stringify(e.previousValue) : '',
      e.newValue ? JSON.stringify(e.newValue) : '',
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n')

    return Buffer.from(csvContent, 'utf-8')
  }

  private extractChangedFields(previousValue?: unknown, newValue?: unknown): string[] {
    if (!previousValue || !newValue) return []
    if (typeof previousValue !== 'object' || typeof newValue !== 'object') return []

    const prev = previousValue as Record<string, unknown>
    const next = newValue as Record<string, unknown>
    const allKeys = new Set([...Object.keys(prev), ...Object.keys(next)])

    return Array.from(allKeys).filter((key) => {
      return JSON.stringify(prev[key]) !== JSON.stringify(next[key])
    })
  }

  private getActionDescription(entry: AuditTrailEntry): string {
    const descriptions: Record<string, string> = {
      project_create: 'Project created',
      project_update: 'Project updated',
      project_delete: 'Project deleted',
      project_execute: 'Conversion executed',
      project_abort: 'Conversion aborted',
      mapping_create: 'Account mapping created',
      mapping_update: 'Account mapping updated',
      mapping_delete: 'Account mapping deleted',
      mapping_approve: 'Account mapping approved',
      mapping_batch_approve: 'Batch mapping approval',
      rationale_create: 'Conversion rationale created',
      rationale_update: 'Conversion rationale updated',
      rationale_review: 'Conversion rationale reviewed',
      adjustment_create: 'Adjusting entry created',
      adjustment_update: 'Adjusting entry updated',
      adjustment_approve: 'Adjusting entry approved',
      approval_submit: 'Submitted for approval',
      approval_approve: 'Approved',
      approval_reject: 'Rejected',
      approval_escalate: 'Escalated',
      export_generate: 'Export generated',
    }

    return descriptions[entry.action] ?? `${entry.action} on ${entry.entityType}`
  }

  private mapToEntry(
    entry: {
      id: string
      projectId: string
      action: string
      entityType: string
      entityId: string | null
      oldValue: string | null
      newValue: string | null
      userId: string | null
      ipAddress: string | null
      userAgent: string | null
      notes: string | null
      createdAt: Date
    },
    userMap: Map<string, { name: string; role: string }>
  ): AuditTrailEntry {
    const user = entry.userId ? userMap.get(entry.userId) : null
    let metadata: Record<string, unknown> | undefined
    let userName = user?.name ?? 'Unknown'
    let userRole = user?.role ?? 'unknown'

    if (entry.notes) {
      try {
        const parsed = JSON.parse(entry.notes) as Record<string, unknown>
        metadata = parsed
        if (typeof parsed.userName === 'string') userName = parsed.userName
        if (typeof parsed.userRole === 'string') userRole = parsed.userRole
      } catch {
        // ignore parse errors
      }
    }

    return {
      id: entry.id,
      projectId: entry.projectId,
      action: entry.action as AuditAction,
      entityType: entry.entityType,
      entityId: entry.entityId ?? undefined,
      previousValue: entry.oldValue ? JSON.parse(entry.oldValue) : undefined,
      newValue: entry.newValue ? JSON.parse(entry.newValue) : undefined,
      changedFields: metadata?.changedFields as string[] | undefined,
      userId: entry.userId ?? '',
      userName,
      userRole,
      ipAddress: entry.ipAddress ?? '',
      userAgent: entry.userAgent ?? '',
      metadata,
      createdAt: entry.createdAt,
    }
  }
}

export const auditTrailService = new AuditTrailService()
