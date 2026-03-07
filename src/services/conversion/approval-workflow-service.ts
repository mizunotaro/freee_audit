import { prisma } from '@/lib/db'
import type { ApprovalStage, ApprovalStatus } from '@/types/conversion'

export interface ApprovalWorkflow {
  id: string
  projectId: string
  stage: ApprovalStage
  status: ApprovalStatus
  assignees: ApprovalAssignee[]
  history: ApprovalHistoryEntry[]
  dueDate?: Date
  completedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface ApprovalAssignee {
  id: string
  userId: string
  userName: string
  userRole: string
  assignedAt: Date
  isRequired: boolean
  approvedAt?: Date
  comment?: string
}

export interface ApprovalHistoryEntry {
  id: string
  stage: ApprovalStage
  action: 'submit' | 'approve' | 'reject' | 'escalate' | 'comment'
  userId: string
  userName: string
  userRole: string
  comment?: string
  createdAt: Date
}

export interface PendingAction {
  projectId: string
  projectName: string
  stage: ApprovalStage
  dueDate?: Date
  itemCount: number
  assignedAt: Date
}

export interface CreateWorkflowOptions {
  projectId: string
  assignees?: Array<{
    userId: string
    userName: string
    userRole: string
    isRequired?: boolean
  }>
  dueDate?: Date
}

const STAGE_ORDER: ApprovalStage[] = [
  'mapping_review',
  'rationale_review',
  'adjustment_review',
  'fs_review',
  'final_approval',
]

export class ApprovalWorkflowService {
  async startWorkflow(options: CreateWorkflowOptions): Promise<ApprovalWorkflow> {
    const existing = await prisma.approvalWorkflow.findUnique({
      where: { projectId: options.projectId },
      include: {
        assignees: true,
        history: { orderBy: { createdAt: 'asc' } },
      },
    })

    if (existing) {
      return this.mapToWorkflow(existing)
    }

    const workflow = await prisma.approvalWorkflow.create({
      data: {
        projectId: options.projectId,
        stage: 'mapping_review',
        status: 'pending',
        dueDate: options.dueDate ?? null,
        assignees: options.assignees
          ? {
              create: options.assignees.map((a) => ({
                userId: a.userId,
                userName: a.userName,
                userRole: a.userRole,
                isRequired: a.isRequired ?? true,
              })),
            }
          : undefined,
      },
      include: {
        assignees: true,
        history: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    await this.addHistoryEntry(workflow.id, 'mapping_review', 'submit', {
      userId: 'system',
      userName: 'System',
      userRole: 'system',
      comment: 'Workflow started',
    })

    return this.mapToWorkflow(workflow)
  }

  async getWorkflow(projectId: string): Promise<ApprovalWorkflow | null> {
    const workflow = await prisma.approvalWorkflow.findUnique({
      where: { projectId },
      include: {
        assignees: true,
        history: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!workflow) return null
    return this.mapToWorkflow(workflow)
  }

  async getCurrentStage(projectId: string): Promise<ApprovalStage | null> {
    const workflow = await prisma.approvalWorkflow.findUnique({
      where: { projectId },
      select: { stage: true },
    })

    return workflow?.stage as ApprovalStage | null
  }

  async advanceStage(projectId: string, userId: string): Promise<ApprovalWorkflow> {
    const workflow = await prisma.approvalWorkflow.findUnique({
      where: { projectId },
      include: { assignees: true },
    })

    if (!workflow) {
      throw new Error(`Workflow not found for project: ${projectId}`)
    }

    const currentIndex = STAGE_ORDER.indexOf(workflow.stage as ApprovalStage)
    if (currentIndex === -1 || currentIndex >= STAGE_ORDER.length - 1) {
      throw new Error('Cannot advance: already at final stage')
    }

    const nextStage = STAGE_ORDER[currentIndex + 1]
    const allRequiredApproved = workflow.assignees
      .filter((a) => a.isRequired)
      .every((a) => a.approvedAt !== null)

    if (!allRequiredApproved) {
      throw new Error('Not all required assignees have approved')
    }

    const user = await this.getUserInfo(userId)
    const updated = await prisma.approvalWorkflow.update({
      where: { id: workflow.id },
      data: {
        stage: nextStage,
        status: 'in_review',
      },
      include: {
        assignees: true,
        history: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    await this.addHistoryEntry(workflow.id, nextStage, 'submit', {
      userId,
      userName: user.name,
      userRole: user.role,
      comment: `Advanced to ${nextStage}`,
    })

    return this.mapToWorkflow(updated)
  }

  async approve(
    projectId: string,
    stage: ApprovalStage,
    userId: string,
    comment?: string
  ): Promise<ApprovalWorkflow> {
    const workflow = await prisma.approvalWorkflow.findUnique({
      where: { projectId },
      include: { assignees: true },
    })

    if (!workflow) {
      throw new Error(`Workflow not found for project: ${projectId}`)
    }

    if (workflow.stage !== stage) {
      throw new Error(`Current stage is ${workflow.stage}, not ${stage}`)
    }

    const user = await this.getUserInfo(userId)

    const assignee = workflow.assignees.find((a) => a.userId === userId)
    if (assignee) {
      await prisma.approvalAssignee.update({
        where: { id: assignee.id },
        data: {
          approvedAt: new Date(),
          comment: comment ?? null,
        },
      })
    }

    await this.addHistoryEntry(workflow.id, stage, 'approve', {
      userId,
      userName: user.name,
      userRole: user.role,
      comment,
    })

    const updatedAssignees = await prisma.approvalAssignee.findMany({
      where: { workflowId: workflow.id },
    })
    const allApproved = updatedAssignees.every((a) => a.approvedAt !== null)

    let newStatus: ApprovalStatus = workflow.status as ApprovalStatus
    if (allApproved && stage === 'final_approval') {
      newStatus = 'approved'
      await prisma.approvalWorkflow.update({
        where: { id: workflow.id },
        data: {
          status: newStatus,
          completedAt: new Date(),
        },
      })
    } else if (allApproved) {
      newStatus = 'approved'
      await prisma.approvalWorkflow.update({
        where: { id: workflow.id },
        data: { status: newStatus },
      })
    }

    return this.getWorkflow(projectId) as Promise<ApprovalWorkflow>
  }

  async reject(
    projectId: string,
    stage: ApprovalStage,
    userId: string,
    reason: string
  ): Promise<ApprovalWorkflow> {
    const workflow = await prisma.approvalWorkflow.findUnique({
      where: { projectId },
    })

    if (!workflow) {
      throw new Error(`Workflow not found for project: ${projectId}`)
    }

    if (workflow.stage !== stage) {
      throw new Error(`Current stage is ${workflow.stage}, not ${stage}`)
    }

    const user = await this.getUserInfo(userId)

    await prisma.approvalWorkflow.update({
      where: { id: workflow.id },
      data: { status: 'rejected' },
    })

    await this.addHistoryEntry(workflow.id, stage, 'reject', {
      userId,
      userName: user.name,
      userRole: user.role,
      comment: reason,
    })

    return this.getWorkflow(projectId) as Promise<ApprovalWorkflow>
  }

  async escalate(
    projectId: string,
    stage: ApprovalStage,
    userId: string,
    reason: string
  ): Promise<ApprovalWorkflow> {
    const workflow = await prisma.approvalWorkflow.findUnique({
      where: { projectId },
    })

    if (!workflow) {
      throw new Error(`Workflow not found for project: ${projectId}`)
    }

    const user = await this.getUserInfo(userId)

    await prisma.approvalWorkflow.update({
      where: { id: workflow.id },
      data: { status: 'escalated' },
    })

    await this.addHistoryEntry(workflow.id, stage, 'escalate', {
      userId,
      userName: user.name,
      userRole: user.role,
      comment: reason,
    })

    return this.getWorkflow(projectId) as Promise<ApprovalWorkflow>
  }

  async addAssignee(
    projectId: string,
    assignee: {
      userId: string
      userName: string
      userRole: string
      isRequired?: boolean
    }
  ): Promise<ApprovalWorkflow> {
    const workflow = await prisma.approvalWorkflow.findUnique({
      where: { projectId },
    })

    if (!workflow) {
      throw new Error(`Workflow not found for project: ${projectId}`)
    }

    await prisma.approvalAssignee.create({
      data: {
        workflowId: workflow.id,
        userId: assignee.userId,
        userName: assignee.userName,
        userRole: assignee.userRole,
        isRequired: assignee.isRequired ?? true,
      },
    })

    return this.getWorkflow(projectId) as Promise<ApprovalWorkflow>
  }

  async getPendingActions(userId: string): Promise<PendingAction[]> {
    const assignees = await prisma.approvalAssignee.findMany({
      where: {
        userId,
        approvedAt: null,
      },
      include: {
        workflow: {
          include: {
            project: true,
          },
        },
      },
    })

    return assignees
      .filter((a) => a.workflow.status !== 'approved' && a.workflow.status !== 'rejected')
      .map((a) => ({
        projectId: a.workflow.projectId,
        projectName: a.workflow.project.name,
        stage: a.workflow.stage as ApprovalStage,
        dueDate: a.workflow.dueDate ?? undefined,
        itemCount: 1,
        assignedAt: a.assignedAt,
      }))
  }

  async getHistory(projectId: string): Promise<ApprovalHistoryEntry[]> {
    const workflow = await prisma.approvalWorkflow.findUnique({
      where: { projectId },
      include: {
        history: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!workflow) return []

    return workflow.history.map((h) => ({
      id: h.id,
      stage: h.stage as ApprovalStage,
      action: h.action as ApprovalHistoryEntry['action'],
      userId: h.userId,
      userName: h.userName,
      userRole: h.userRole,
      comment: h.comment ?? undefined,
      createdAt: h.createdAt,
    }))
  }

  private async addHistoryEntry(
    workflowId: string,
    stage: ApprovalStage,
    action: ApprovalHistoryEntry['action'],
    data: {
      userId: string
      userName: string
      userRole: string
      comment?: string
    }
  ): Promise<void> {
    await prisma.approvalHistoryEntry.create({
      data: {
        workflowId,
        stage,
        action,
        userId: data.userId,
        userName: data.userName,
        userRole: data.userRole,
        comment: data.comment ?? null,
      },
    })
  }

  private async getUserInfo(userId: string): Promise<{ name: string; role: string }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, role: true },
    })

    if (!user) {
      return { name: 'Unknown', role: 'unknown' }
    }

    return { name: user.name, role: user.role }
  }

  private mapToWorkflow(workflow: {
    id: string
    projectId: string
    stage: string
    status: string
    dueDate: Date | null
    completedAt: Date | null
    createdAt: Date
    updatedAt: Date
    assignees: Array<{
      id: string
      userId: string
      userName: string
      userRole: string
      assignedAt: Date
      isRequired: boolean
      approvedAt: Date | null
      comment: string | null
    }>
    history: Array<{
      id: string
      stage: string
      action: string
      userId: string
      userName: string
      userRole: string
      comment: string | null
      createdAt: Date
    }>
  }): ApprovalWorkflow {
    return {
      id: workflow.id,
      projectId: workflow.projectId,
      stage: workflow.stage as ApprovalStage,
      status: workflow.status as ApprovalStatus,
      dueDate: workflow.dueDate ?? undefined,
      completedAt: workflow.completedAt ?? undefined,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
      assignees: workflow.assignees.map((a) => ({
        id: a.id,
        userId: a.userId,
        userName: a.userName,
        userRole: a.userRole,
        assignedAt: a.assignedAt,
        isRequired: a.isRequired,
        approvedAt: a.approvedAt ?? undefined,
        comment: a.comment ?? undefined,
      })),
      history: workflow.history.map((h) => ({
        id: h.id,
        stage: h.stage as ApprovalStage,
        action: h.action as ApprovalHistoryEntry['action'],
        userId: h.userId,
        userName: h.userName,
        userRole: h.userRole,
        comment: h.comment ?? undefined,
        createdAt: h.createdAt,
      })),
    }
  }
}

export const approvalWorkflowService = new ApprovalWorkflowService()
