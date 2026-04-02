import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConversionRationaleService } from '@/services/conversion/conversion-rationale-service'

vi.mock('@/lib/db', () => ({
  prisma: {
    conversionRationale: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    rationaleAuditTrail: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    conversionProject: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(function (fn: Function) {
      return fn({
        conversionRationale: {
          findUnique: vi.fn(),
          create: vi.fn(),
        },
        rationaleAuditTrail: {
          create: vi.fn(),
        },
      })
    }),
  },
}))

function mockRationale(overrides = {}) {
  return {
    id: 'rat-1',
    projectId: 'proj-1',
    entityType: 'mapping',
    entityId: 'ent-1',
    rationaleType: 'mapping_basis',
    sourceReferenceId: null,
    targetReferenceId: null,
    sourceReference: null,
    targetReference: null,
    summary: 'Test rationale',
    summaryEn: null,
    detailedExplanation: null,
    detailedExplanationEn: null,
    impactAmount: null,
    impactDirection: null,
    isAiGenerated: false,
    aiModelUsed: null,
    aiConfidence: null,
    isReviewed: false,
    reviewedBy: null,
    reviewedAt: null,
    createdBy: 'user-1',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }
}

describe('ConversionRationaleService', () => {
  let service: ConversionRationaleService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ConversionRationaleService()
  })

  describe('create', () => {
    it('should create a rationale and audit trail', async function () {
      const { prisma } = await import('@/lib/db')
      const rationale = mockRationale()

      vi.mocked(prisma.conversionRationale.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.conversionRationale.create).mockResolvedValue(rationale)
      vi.mocked(prisma.rationaleAuditTrail.create).mockResolvedValue({} as any)

      const result = await service.create({
        projectId: 'proj-1',
        entityType: 'mapping',
        entityId: 'ent-1',
        rationaleType: 'mapping_basis',
        summary: 'Test rationale',
        createdBy: 'user-1',
      })

      expect(result.id).toBe('rat-1')
      expect(prisma.conversionRationale.create).toHaveBeenCalled()
      expect(prisma.rationaleAuditTrail.create).toHaveBeenCalled()
    })

    it('should throw if rationale already exists', async function () {
      const { prisma } = await import('@/lib/db')

      vi.mocked(prisma.conversionRationale.findUnique).mockResolvedValue(mockRationale())

      await expect(
        service.create({
          projectId: 'proj-1',
          entityType: 'mapping',
          entityId: 'ent-1',
          rationaleType: 'mapping_basis',
          summary: 'Test',
          createdBy: 'user-1',
        })
      ).rejects.toThrow('Rationale already exists')
    })
  })

  describe('getById', () => {
    it('should return rationale by id', async function () {
      const { prisma } = await import('@/lib/db')
      vi.mocked(prisma.conversionRationale.findUnique).mockResolvedValue(mockRationale())

      const result = await service.getById('rat-1')

      expect(result).not.toBeNull()
      expect(result!.id).toBe('rat-1')
    })

    it('should return null if not found', async function () {
      const { prisma } = await import('@/lib/db')
      vi.mocked(prisma.conversionRationale.findUnique).mockResolvedValue(null)

      const result = await service.getById('nonexistent')

      expect(result).toBeNull()
    })
  })

  describe('getByEntity', () => {
    it('should return rationales for an entity', async function () {
      const { prisma } = await import('@/lib/db')
      vi.mocked(prisma.conversionRationale.findMany).mockResolvedValue([mockRationale()])

      const results = await service.getByEntity('proj-1', 'mapping', 'ent-1')

      expect(results).toHaveLength(1)
    })
  })

  describe('getByProject', () => {
    it('should return paginated results', async function () {
      const { prisma } = await import('@/lib/db')
      vi.mocked(prisma.conversionRationale.count).mockResolvedValue(1)
      vi.mocked(prisma.conversionRationale.findMany).mockResolvedValue([mockRationale()])

      const result = await service.getByProject('proj-1')

      expect(result.data).toHaveLength(1)
      expect(result.pagination.total).toBe(1)
    })
  })

  describe('update', () => {
    it('should update rationale and create audit trail', async function () {
      const { prisma } = await import('@/lib/db')
      const updated = mockRationale({ summary: 'Updated' })

      vi.mocked(prisma.conversionRationale.findUnique).mockResolvedValue(mockRationale())
      vi.mocked(prisma.conversionRationale.update).mockResolvedValue(updated)
      vi.mocked(prisma.rationaleAuditTrail.create).mockResolvedValue({} as any)

      const result = await service.update('rat-1', { summary: 'Updated' }, 'user-1')

      expect(result.summary).toBe('Updated')
    })

    it('should throw if rationale not found', async function () {
      const { prisma } = await import('@/lib/db')
      vi.mocked(prisma.conversionRationale.findUnique).mockResolvedValue(null)

      await expect(service.update('bad-id', { summary: 'x' }, 'user-1')).rejects.toThrow(
        'Rationale not found'
      )
    })
  })

  describe('review', () => {
    it('should mark rationale as reviewed', async function () {
      const { prisma } = await import('@/lib/db')
      const reviewed = mockRationale({ isReviewed: true, reviewedBy: 'user-2' })

      vi.mocked(prisma.conversionRationale.findUnique).mockResolvedValue(mockRationale())
      vi.mocked(prisma.conversionRationale.update).mockResolvedValue(reviewed)
      vi.mocked(prisma.rationaleAuditTrail.create).mockResolvedValue({} as any)
      vi.mocked(prisma.conversionRationale.count).mockResolvedValueOnce(1).mockResolvedValueOnce(1)
      vi.mocked(prisma.conversionProject.update).mockResolvedValue({} as any)

      const result = await service.review('rat-1', 'user-2')

      expect(result.isReviewed).toBe(true)
    })
  })

  describe('delete', () => {
    it('should delete rationale and update project status', async function () {
      const { prisma } = await import('@/lib/db')
      const rationale = mockRationale()

      vi.mocked(prisma.conversionRationale.findUnique).mockResolvedValue(rationale)
      vi.mocked(prisma.rationaleAuditTrail.create).mockResolvedValue({} as any)
      vi.mocked(prisma.conversionRationale.delete).mockResolvedValue(rationale as any)
      vi.mocked(prisma.conversionRationale.count).mockResolvedValueOnce(0).mockResolvedValueOnce(0)
      vi.mocked(prisma.conversionProject.update).mockResolvedValue({} as any)

      await service.delete('rat-1')

      expect(prisma.conversionRationale.delete).toHaveBeenCalledWith({ where: { id: 'rat-1' } })
    })

    it('should throw if rationale not found', async function () {
      const { prisma } = await import('@/lib/db')
      vi.mocked(prisma.conversionRationale.findUnique).mockResolvedValue(null)

      await expect(service.delete('bad-id')).rejects.toThrow('Rationale not found')
    })
  })

  describe('getAuditTrail', () => {
    it('should return audit trail entries', async function () {
      const { prisma } = await import('@/lib/db')
      vi.mocked(prisma.rationaleAuditTrail.findMany).mockResolvedValue([
        {
          id: 'audit-1',
          rationaleId: 'rat-1',
          action: 'create',
          previousValue: null,
          newValue: JSON.stringify({ summary: 'test' }),
          changedFields: null,
          userId: 'user-1',
          userName: 'Test User',
          userRole: 'admin',
          ipAddress: null,
          userAgent: null,
          notes: null,
          createdAt: new Date('2024-01-01'),
        },
      ])

      const trail = await service.getAuditTrail('rat-1')

      expect(trail).toHaveLength(1)
      expect(trail[0].action).toBe('create')
    })
  })

  describe('generateAuditReport', () => {
    it('should generate audit report for a project', async function () {
      const { prisma } = await import('@/lib/db')

      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue({
        id: 'proj-1',
        name: 'Test Project',
      } as any)
      vi.mocked(prisma.conversionRationale.findMany).mockResolvedValue([
        mockRationale({ isReviewed: true, isAiGenerated: true, impactAmount: 500000 }),
        mockRationale({
          id: 'rat-2',
          isReviewed: false,
          isAiGenerated: false,
          impactAmount: -200000,
        }),
      ])

      const report = await service.generateAuditReport('proj-1')

      expect(report.projectName).toBe('Test Project')
      expect(report.summary.totalRationales).toBe(2)
      expect(report.summary.reviewedRationales).toBe(1)
      expect(report.summary.aiGeneratedRationales).toBe(1)
      expect(report.summary.pendingReview).toBe(1)
    })

    it('should throw if project not found', async function () {
      const { prisma } = await import('@/lib/db')
      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue(null)

      await expect(service.generateAuditReport('bad-id')).rejects.toThrow('Project not found')
    })
  })
})
