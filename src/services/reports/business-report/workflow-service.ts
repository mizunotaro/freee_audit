import { prisma } from '@/lib/db'
import type { ApprovalStep, WorkflowResult, BusinessReportStatus } from '@/types/reports/business'

/**
 * 事業報告書の承認ワークフロー（作成→レビュー→承認→確定）を管理するサービス。
 *
 * 4段階の承認ステップ（preparer/reviewer/approver/final_approver）に沿って
 * ステータス遷移と承認記録を DB に保持する。
 */
export class BusinessReportWorkflowService {
  private readonly approvalSteps: ApprovalStep[] = [
    { role: 'preparer', action: 'review', required: true },
    { role: 'reviewer', action: 'approve', required: true },
    { role: 'approver', action: 'confirm', required: true },
    { role: 'final_approver', action: 'final_approve', required: false },
  ]

  /**
   * 報告書の承認ワークフローを開始し、ステータスを `under_review` にする。
   *
   * @param reportId - 報告書ID
   * @param userId - 実行者ID
   * @returns ワークフロー結果。報告書不存在や例外時は `success: false`。
   */
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

  /**
   * 現在の承認ステップを承認し、次ステップへ進める。最終ステップでは `approved` にする。
   *
   * @param reportId - 報告書ID
   * @param userId - 承認者ID
   * @param comment - 承認コメント（オプション）
   * @returns ワークフロー結果。全ステップ完了時や例外時は `success: false`。
   */
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

  /**
   * 報告書を差戻し、ステータスを `draft` に戻す。
   *
   * @param reportId - 報告書ID
   * @param userId - 実行者ID
   * @param reason - 差戻し理由
   * @returns ワークフロー結果。例外時は `success: false`。
   */
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

  /**
   * 報告書の現在の承認ステップと承認履歴を取得する。
   *
   * @param reportId - 報告書ID
   * @returns ワークフロー状態。`success`・`currentStep`/`totalSteps`・承認履歴、例外時は `success: false`。
   */
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

  /**
   * 承認済みの報告書を確定（`finalized`）する。
   *
   * @param reportId - 報告書ID
   * @returns ワークフロー結果。報告書不存在・未承認・例外時は `success: false`。
   */
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
