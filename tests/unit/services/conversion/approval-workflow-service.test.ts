import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApprovalWorkflowService } from '@/services/conversion/approval-workflow-service'

vi.mock('@/lib/db', () => ({
  prisma: {
    approvalWorkflow: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    approvalAssignee: {
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    approvalHistoryEntry: {
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}))

function mockWorkflow(overrides = {}) {
  return {
    id: 'wf-1',
    projectId: 'proj-1',
    stage: 'mapping_review',
    status: 'pending',
    dueDate: null,
    completedAt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    assignees: [
      {
        id: 'asgn-1',
        userId: 'user-1',
        userName: 'Test User',
        userRole: 'admin',
        assignedAt: new Date('2024-01-01'),
        isRequired: true,
        approvedAt: null,
        comment: null,
      },
    ],
    history: [],
    ...overrides,
  }
}

describe('ApprovalWorkflowService', () => {
  let service: ApprovalWorkflowService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ApprovalWorkflowService()
  })

  describe('startWorkflow', () => {
    it('should create a new workflow', async function () {
      const { prisma } = await import('@/lib/db')

      vi.mocked(prisma.approvalWorkflow.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.approvalWorkflow.create).mockResolvedValue(mockWorkflow())
      vi.mocked(prisma.approvalHistoryEntry.create).mockResolvedValue({} as any)

      const workflow = await service.startWorkflow({
        projectId: 'proj-1',
        assignees: [{ userId: 'user-1', userName: 'Test', userRole: 'admin' }],
      })

      expect(workflow.projectId).toBe('proj-1')
      expect(workflow.stage).toBe('mapping_review')
      expect(workflow.status).toBe('pending')
    })

    it('should return existing workflow if one exists', async function () {
      const { prisma } = await import('@/lib/db')

      vi.mocked(prisma.approvalWorkflow.findUnique).mockResolvedValue(mockWorkflow())

      const workflow = await service.startWorkflow({ projectId: 'proj-1' })

      expect(workflow.id).toBe('wf-1')
      expect(prisma.approvalWorkflow.create).not.toHaveBeenCalled()
    })
  })

  describe('getWorkflow', () => {
    it('should return workflow by projectId', async function () {
      const { prisma } = await import('@/lib/db')
      vi.mocked(prisma.approvalWorkflow.findUnique).mockResolvedValue(mockWorkflow())

      const workflow = await service.getWorkflow('proj-1')

      expect(workflow).not.toBeNull()
      expect(workflow!.id).toBe('wf-1')
    })

    it('should return null if not found', async function () {
      const { prisma } = await import('@/lib/db')
      vi.mocked(prisma.approvalWorkflow.findUnique).mockResolvedValue(null)

      const result = await service.getWorkflow('nonexistent')

      expect(result).toBeNull()
    })
  })

  describe('getCurrentStage', () => {
    it('should return current stage', async function () {
      const { prisma } = await import('@/lib/db')
      vi.mocked(prisma.approvalWorkflow.findUnique).mockResolvedValue({
        stage: 'mapping_review',
      } as any)

      const stage = await service.getCurrentStage('proj-1')

      expect(stage).toBe('mapping_review')
    })

    it('should return null if workflow not found', async function () {
      const { prisma } = await import('@/lib/db')
      vi.mocked(prisma.approvalWorkflow.findUnique).mockResolvedValue(null)

      const result = await service.getCurrentStage('nonexistent')

      expect(result).toBeUndefined()
    })
  })

  describe('advanceStage', () => {
    it('should advance to next stage when all required approved', async function () {
      const { prisma } = await import('@/lib/db')

      const approvedWorkflow = mockWorkflow({
        stage: 'mapping_review',
        assignees: [
          {
            id: 'a1',
            userId: 'u1',
            userName: 'Test',
            userRole: 'admin',
            assignedAt: new Date(),
            isRequired: true,
            approvedAt: new Date(),
            comment: null,
          },
        ],
      })
      vi.mocked(prisma.approvalWorkflow.findUnique).mockResolvedValue(approvedWorkflow)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ name: 'Test', role: 'admin' } as any)
      vi.mocked(prisma.approvalWorkflow.update).mockResolvedValue({
        ...approvedWorkflow,
        stage: 'rationale_review',
        status: 'in_review',
      })
      vi.mocked(prisma.approvalHistoryEntry.create).mockResolvedValue({} as any)

      const result = await service.advanceStage('proj-1', 'user-1')

      expect(result.stage).toBe('rationale_review')
    })

    it('should throw if not all required assignees approved', async function () {
      const { prisma } = await import('@/lib/db')

      vi.mocked(prisma.approvalWorkflow.findUnique).mockResolvedValue(mockWorkflow())

      await expect(service.advanceStage('proj-1', 'user-1')).rejects.toThrow(
        'Not all required assignees have approved'
      )
    })

    it('should throw if at final stage', async function () {
      const { prisma } = await import('@/lib/db')

      vi.mocked(prisma.approvalWorkflow.findUnique).mockResolvedValue(
        mockWorkflow({
          stage: 'final_approval',
          assignees: [
            {
              id: 'a1',
              userId: 'u1',
              userName: 'Test',
              userRole: 'admin',
              assignedAt: new Date(),
              isRequired: true,
              approvedAt: new Date(),
              comment: null,
            },
          ],
        })
      )

      await expect(service.advanceStage('proj-1', 'user-1')).rejects.toThrow('Cannot advance')
    })
  })

  describe('reject', () => {
    it('should set status to rejected', async function () {
      const { prisma } = await import('@/lib/db')

      vi.mocked(prisma.approvalWorkflow.findUnique)
        .mockResolvedValueOnce(mockWorkflow())
        .mockResolvedValueOnce(mockWorkflow({ status: 'rejected' }))
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ name: 'Test', role: 'admin' } as any)
      vi.mocked(prisma.approvalWorkflow.update).mockResolvedValue({} as any)
      vi.mocked(prisma.approvalHistoryEntry.create).mockResolvedValue({} as any)

      const result = await service.reject('proj-1', 'mapping_review', 'user-1', 'Errors found')

      expect(result.status).toBe('rejected')
    })

    it('should throw if stage mismatch', async function () {
      const { prisma } = await import('@/lib/db')

      vi.mocked(prisma.approvalWorkflow.findUnique).mockResolvedValue(
        mockWorkflow({ stage: 'rationale_review' })
      )

      await expect(service.reject('proj-1', 'mapping_review', 'user-1', 'reason')).rejects.toThrow(
        'Current stage is rationale_review'
      )
    })
  })

  describe('escalate', () => {
    it('should set status to escalated', async function () {
      const { prisma } = await import('@/lib/db')

      vi.mocked(prisma.approvalWorkflow.findUnique)
        .mockResolvedValueOnce(mockWorkflow())
        .mockResolvedValueOnce(mockWorkflow({ status: 'escalated' }))
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ name: 'Test', role: 'admin' } as any)
      vi.mocked(prisma.approvalWorkflow.update).mockResolvedValue({} as any)
      vi.mocked(prisma.approvalHistoryEntry.create).mockResolvedValue({} as any)

      const result = await service.escalate('proj-1', 'mapping_review', 'user-1', 'Need escalation')

      expect(result.status).toBe('escalated')
    })
  })

  describe('addAssignee', () => {
    it('should add a new assignee', async function () {
      const { prisma } = await import('@/lib/db')

      vi.mocked(prisma.approvalWorkflow.findUnique)
        .mockResolvedValueOnce(mockWorkflow())
        .mockResolvedValueOnce(mockWorkflow())
      vi.mocked(prisma.approvalAssignee.create).mockResolvedValue({} as any)

      const result = await service.addAssignee('proj-1', {
        userId: 'user-2',
        userName: 'New User',
        userRole: 'reviewer',
      })

      expect(prisma.approvalAssignee.create).toHaveBeenCalled()
      expect(result.projectId).toBe('proj-1')
    })
  })

  describe('getPendingActions', () => {
    it('should return pending actions for user', async function () {
      const { prisma } = await import('@/lib/db')

      vi.mocked(prisma.approvalAssignee.findMany).mockResolvedValue([
        {
          userId: 'user-1',
          approvedAt: null,
          assignedAt: new Date(),
          workflowId: 'wf-1',
          id: 'asgn-1',
          userName: 'Test',
          userRole: 'admin',
          isRequired: true,
          comment: null,
          workflow: {
            projectId: 'proj-1',
            status: 'pending',
            stage: 'mapping_review',
            dueDate: null,
            id: 'wf-1',
            createdAt: new Date(),
            updatedAt: new Date(),
            completedAt: null,
            project: { name: 'Test Project', id: 'proj-1' },
          },
        },
      ] as any)

      const actions = await service.getPendingActions('user-1')

      expect(actions).toHaveLength(1)
      expect(actions[0].projectId).toBe('proj-1')
    })
  })

  describe('getHistory', () => {
    it('should return empty array if workflow not found', async function () {
      const { prisma } = await import('@/lib/db')
      vi.mocked(prisma.approvalWorkflow.findUnique).mockResolvedValue(null)

      const history = await service.getHistory('nonexistent')

      expect(history).toEqual([])
    })
  })
})
