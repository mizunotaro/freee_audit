import { BusinessReportWorkflowService } from '@/services/reports/business-report/workflow-service'

vi.mock('@/lib/db', () => ({
  prisma: {
    businessReport: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    businessReportApproval: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/db'

describe('BusinessReportWorkflowService', () => {
  let service: BusinessReportWorkflowService

  beforeEach(() => {
    service = new BusinessReportWorkflowService()
    vi.mocked(prisma.businessReport.findUnique).mockReset()
    vi.mocked(prisma.businessReport.update).mockReset()
    vi.mocked(prisma.businessReportApproval.create).mockReset()
    vi.mocked(prisma.businessReportApproval.findMany).mockReset()
  })

  describe('initiateWorkflow', () => {
    it('initiates workflow for existing report', async () => {
      vi.mocked(prisma.businessReport.findUnique).mockResolvedValueOnce({
        id: 'r1',
        status: 'draft',
      } as any)
      vi.mocked(prisma.businessReport.update).mockResolvedValueOnce({
        id: 'r1',
        status: 'under_review',
      } as any)
      vi.mocked(prisma.businessReportApproval.create).mockResolvedValueOnce({} as any)

      const result = await service.initiateWorkflow('r1', 'user-1')
      expect(result.success).toBe(true)
      expect(result.currentStep).toBe(0)
      expect(result.nextApprover).toBe('reviewer')
    })

    it('fails for non-existent report', async () => {
      vi.mocked(prisma.businessReport.findUnique).mockResolvedValueOnce(null)

      const result = await service.initiateWorkflow('nonexistent', 'user-1')
      expect(result.success).toBe(false)
      expect(result.message).toContain('not found')
    })

    it('handles database errors', async () => {
      vi.mocked(prisma.businessReport.findUnique).mockRejectedValueOnce(new Error('DB error'))

      const result = await service.initiateWorkflow('r1', 'user-1')
      expect(result.success).toBe(false)
    })
  })

  describe('approve', () => {
    it('records approval and moves to next step', async () => {
      vi.mocked(prisma.businessReportApproval.findMany).mockResolvedValueOnce([
        { completedAt: new Date(), role: 'preparer' } as any,
      ] as any)
      vi.mocked(prisma.businessReportApproval.create).mockResolvedValueOnce({} as any)
      vi.mocked(prisma.businessReport.update).mockResolvedValueOnce({} as any)
      vi.mocked(prisma.businessReport.findUnique).mockResolvedValueOnce({ id: 'r1' } as any)

      const result = await service.approve('r1', 'user-2')
      expect(result.success).toBe(true)
    })

    it('finalizes when all steps completed', async () => {
      vi.mocked(prisma.businessReportApproval.findMany).mockResolvedValueOnce([
        { completedAt: new Date() },
        { completedAt: new Date() },
        { completedAt: new Date() },
      ] as any)
      vi.mocked(prisma.businessReportApproval.create).mockResolvedValueOnce({} as any)
      vi.mocked(prisma.businessReport.update).mockResolvedValueOnce({
        id: 'r1',
        status: 'approved',
      } as any)
      vi.mocked(prisma.businessReport.findUnique).mockResolvedValueOnce({ id: 'r1' } as any)

      const result = await service.approve('r1', 'user-final')
      expect(result.success).toBe(true)
      expect(result.message).toContain('fully approved')
    })

    it('returns error when all steps already done', async () => {
      vi.mocked(prisma.businessReportApproval.findMany).mockResolvedValueOnce([
        { completedAt: new Date() },
        { completedAt: new Date() },
        { completedAt: new Date() },
        { completedAt: new Date() },
      ] as any)

      const result = await service.approve('r1', 'user-1')
      expect(result.success).toBe(false)
      expect(result.message).toContain('completed')
    })
  })

  describe('reject', () => {
    it('rejects and returns to draft', async () => {
      vi.mocked(prisma.businessReportApproval.findMany).mockResolvedValueOnce([] as any)
      vi.mocked(prisma.businessReportApproval.create).mockResolvedValueOnce({} as any)
      vi.mocked(prisma.businessReport.update).mockResolvedValueOnce({} as any)

      const result = await service.reject('r1', 'user-1', 'Issues found')
      expect(result.success).toBe(true)
      expect(result.message).toContain('rejected')
    })
  })

  describe('getWorkflowStatus', () => {
    it('returns workflow status', async () => {
      vi.mocked(prisma.businessReportApproval.findMany).mockResolvedValueOnce([
        { role: 'preparer', completedAt: new Date(), comment: null, createdAt: new Date() },
        { role: 'reviewer', completedAt: null, comment: null, createdAt: new Date() },
      ] as any)

      const result = await service.getWorkflowStatus('r1')
      expect(result.success).toBe(true)
      expect(result.approvals).toHaveLength(2)
      expect(result.totalSteps).toBe(4)
    })

    it('handles errors', async () => {
      vi.mocked(prisma.businessReportApproval.findMany).mockRejectedValueOnce(new Error('DB error'))

      const result = await service.getWorkflowStatus('r1')
      expect(result.success).toBe(false)
    })
  })

  describe('finalize', () => {
    it('finalizes approved report', async () => {
      vi.mocked(prisma.businessReport.findUnique).mockResolvedValueOnce({
        id: 'r1',
        status: 'approved',
      } as any)
      vi.mocked(prisma.businessReport.update).mockResolvedValueOnce({
        id: 'r1',
        status: 'finalized',
      } as any)

      const result = await service.finalize('r1')
      expect(result.success).toBe(true)
    })

    it('fails for non-approved report', async () => {
      vi.mocked(prisma.businessReport.findUnique).mockResolvedValueOnce({
        id: 'r1',
        status: 'draft',
      } as any)

      const result = await service.finalize('r1')
      expect(result.success).toBe(false)
    })

    it('fails for non-existent report', async () => {
      vi.mocked(prisma.businessReport.findUnique).mockResolvedValueOnce(null)

      const result = await service.finalize('nonexistent')
      expect(result.success).toBe(false)
    })
  })
})
