import { prisma } from '@/lib/db'
import type { ApprovalStep, WorkflowResult, BusinessReportStatus } from '@/types/reports/business'

export class BusinessReportWorkflowService {
  private readonly approvalSteps: ApprovalStep[] = [
    { role: 'preparer', action: 'review', required: true },
    { role: 'reviewer', action: 'approve', required: true },
    { role: 'approver', action: 'confirm', required: true },
    { role: 'final_approver', action: 'final_approve', required: false },
  ]

  async initiateWorkflow(reportId: string, userId: string): Promise<WorkflowResult> {
    try {
      const report = await prisma.businessReport.findUnique({
        where: { id: reportId },
      })

      if (!report) {
        return { success: false, message: 'Report not found' }
      }

      await prisma.businessReport.update({
        where: { id: reportId },
        data: {
          status: 'under_review' as BusinessReportStatus,
          updatedAt: new Date(),
        },
      })

      await prisma.businessReportApproval.create({
        data: {
          reportId,
          userId,
          role: 'preparer',
          action: 'review',
          step: 0,
          required: true,
          completedAt: null,
          createdAt: new Date(),
        },
      })

      return {
        success: true,
        currentStep: 0,
        message: 'Workflow initiated successfully',
        nextApprover: 'reviewer',
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to initiate workflow',
      }
    }
  }

  async approve(reportId: string, userId: string, comment?: string): Promise<WorkflowResult> {
    try {
      const approvals = await prisma.businessReportApproval.findMany({
        where: { reportId },
        orderBy: { createdAt: 'asc' },
      })

      const currentStep = approvals.filter((a) => a.completedAt !== null).length
      const nextStep = currentStep

      if (nextStep >= this.approvalSteps.length) {
        return { success: false, message: 'All approval steps completed' }
      }

      await prisma.businessReportApproval.create({
        data: {
          reportId,
          userId,
          role: this.approvalSteps[nextStep]?.role || 'unknown',
          action: this.approvalSteps[nextStep]?.action || 'approve',
          step: nextStep + 1,
          required: true,
          comment,
          completedAt: new Date(),
          createdAt: new Date(),
        },
      })

      const isFinalApproval = nextStep >= this.approvalSteps.length - 1

      if (isFinalApproval) {
        await prisma.businessReport.update({
          where: { id: reportId },
          data: {
            status: 'approved' as BusinessReportStatus,
            approvedBy: userId,
            approvedAt: new Date(),
            updatedAt: new Date(),
          },
        })

        return {
          success: true,
          message: 'Report fully approved',
        }
      }

      return {
        success: true,
        currentStep: nextStep + 1,
        message: 'Approval recorded',
        nextApprover: this.approvalSteps[nextStep + 1]?.role,
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Approval failed',
      }
    }
  }

  async reject(reportId: string, userId: string, reason: string): Promise<WorkflowResult> {
    try {
      const approvals = await prisma.businessReportApproval.findMany({
        where: { reportId },
      })

      await prisma.businessReportApproval.create({
        data: {
          reportId,
          userId,
          role: 'reviewer',
          action: 'reject',
          step: approvals.length,
          required: true,
          comment: reason,
          completedAt: new Date(),
          createdAt: new Date(),
        },
      })

      await prisma.businessReport.update({
        where: { id: reportId },
        data: {
          status: 'draft' as BusinessReportStatus,
          updatedAt: new Date(),
        },
      })

      return {
        success: true,
        message: 'Report rejected and returned to draft',
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Rejection failed',
      }
    }
  }

  async getWorkflowStatus(reportId: string): Promise<{
    success: boolean
    currentStep?: number
    totalSteps?: number
    approvals?: Array<{
      role: string
      status: string
      comment?: string | null
      createdAt: Date
    }>
    message?: string
  }> {
    try {
      const approvals = await prisma.businessReportApproval.findMany({
        where: { reportId },
        orderBy: { createdAt: 'asc' },
      })

      const approvedCount = approvals.filter((a) => a.completedAt !== null).length

      return {
        success: true,
        currentStep: approvedCount,
        totalSteps: this.approvalSteps.length,
        approvals: approvals.map((a) => ({
          role: a.role,
          status: a.completedAt ? 'approved' : 'pending',
          comment: a.comment,
          createdAt: a.createdAt,
        })),
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get workflow status',
      }
    }
  }

  async finalize(reportId: string): Promise<WorkflowResult> {
    try {
      const report = await prisma.businessReport.findUnique({
        where: { id: reportId },
      })

      if (!report) {
        return { success: false, message: 'Report not found' }
      }

      if (report.status !== 'approved') {
        return { success: false, message: 'Report must be approved before finalization' }
      }

      await prisma.businessReport.update({
        where: { id: reportId },
        data: {
          status: 'finalized' as BusinessReportStatus,
          updatedAt: new Date(),
        },
      })

      return {
        success: true,
        message: 'Report finalized successfully',
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Finalization failed',
      }
    }
  }
}
