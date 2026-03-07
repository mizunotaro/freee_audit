import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { conversionProjectService } from '@/services/conversion/conversion-project-service'

vi.mock('@/lib/db', () => ({
  prisma: {
    accountingStandard: {
      findUnique: vi.fn(),
    },
    chartOfAccount: {
      findUnique: vi.fn(),
    },
    conversionProject: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
  },
}))

vi.mock('@/lib/api', () => ({
  withAuth: (handler: (req: unknown) => unknown) => handler,
  withAccountantAuth: (handler: (req: unknown) => unknown) => handler,
}))

describe('Conversion Projects API Integration', () => {
  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    companyId: 'company-1',
    role: 'ACCOUNTANT',
  }

  const mockJgaapStandard = {
    id: 'jgaap-id',
    code: 'JGAAP',
    name: '日本一般企業会計原則',
  }

  const mockUsgaapStandard = {
    id: 'usgaap-id',
    code: 'USGAAP',
    name: '米国会計基準',
  }

  const mockTargetCoa = {
    id: 'coa-1',
    companyId: 'company-1',
    standardId: 'usgaap-id',
    name: 'USGAAP COA',
  }

  const mockProjectDb = {
    id: 'project-1',
    companyId: 'company-1',
    name: 'Test Project',
    description: 'Test Description',
    sourceStandardId: 'jgaap-id',
    targetStandardId: 'usgaap-id',
    targetCoaId: 'coa-1',
    periodStart: new Date('2024-01-01'),
    periodEnd: new Date('2024-12-31'),
    status: 'draft',
    progress: 0,
    settings: JSON.stringify({
      includeJournals: true,
      includeFinancialStatements: true,
      generateAdjustingEntries: true,
      aiAssistedMapping: true,
    }),
    statistics: null,
    createdBy: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null,
    sourceStandard: mockJgaapStandard,
    targetStandard: mockUsgaapStandard,
    targetCoa: mockTargetCoa,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('GET /api/conversion/projects', () => {
    it('should return list of projects for company', async () => {
      vi.mocked(prisma.conversionProject.count).mockResolvedValue(1)
      vi.mocked(prisma.conversionProject.findMany).mockResolvedValue([mockProjectDb] as any)

      const req = {
        user: mockUser,
        url: 'http://localhost/api/conversion/projects',
      } as any

      const result = await conversionProjectService.getByCompany('company-1')

      expect(result.data).toHaveLength(1)
      expect(result.pagination.total).toBe(1)
    })

    it('should filter by status', async () => {
      vi.mocked(prisma.conversionProject.count).mockResolvedValue(1)
      vi.mocked(prisma.conversionProject.findMany).mockResolvedValue([mockProjectDb] as any)

      await conversionProjectService.getByCompany('company-1', { status: 'draft' })

      const findManyCalls = vi.mocked(prisma.conversionProject.findMany).mock.calls
      expect(findManyCalls.length).toBeGreaterThan(0)
      expect(findManyCalls[0]?.[0]?.where).toHaveProperty('status', 'draft')
    })

    it('should filter by target standard', async () => {
      vi.mocked(prisma.conversionProject.count).mockResolvedValue(1)
      vi.mocked(prisma.conversionProject.findMany).mockResolvedValue([mockProjectDb] as any)

      await conversionProjectService.getByCompany('company-1', { targetStandard: 'USGAAP' })

      const findManyCalls = vi.mocked(prisma.conversionProject.findMany).mock.calls
      expect(findManyCalls.length).toBeGreaterThan(0)
      expect(findManyCalls[0]?.[0]?.where).toHaveProperty('targetStandard')
    })

    it('should support pagination', async () => {
      vi.mocked(prisma.conversionProject.count).mockResolvedValue(50)
      vi.mocked(prisma.conversionProject.findMany).mockResolvedValue([] as any)

      const result = await conversionProjectService.getByCompany('company-1', undefined, 2, 10)

      expect(result.pagination.page).toBe(2)
      expect(result.pagination.limit).toBe(10)
      expect(result.pagination.totalPages).toBe(5)
    })
  })

  describe('POST /api/conversion/projects', () => {
    it('should create project with valid data', async () => {
      vi.mocked(prisma.accountingStandard.findUnique)
        .mockResolvedValueOnce(mockJgaapStandard as any)
        .mockResolvedValueOnce(mockUsgaapStandard as any)
      vi.mocked(prisma.chartOfAccount.findUnique).mockResolvedValue(mockTargetCoa as any)
      vi.mocked(prisma.conversionProject.create).mockResolvedValue(mockProjectDb as any)

      const createData = {
        name: 'Test Project',
        description: 'Test Description',
        targetStandard: 'USGAAP' as const,
        targetCoaId: 'coa-1',
        periodStart: '2024-01-01',
        periodEnd: '2024-12-31',
        settings: {
          includeJournals: true,
          includeFinancialStatements: true,
        },
      }

      const result = await conversionProjectService.create('company-1', createData, 'user-1')

      expect(result.name).toBe('Test Project')
      expect(result.targetStandard).toBe('USGAAP')
    })

    it('should reject invalid period dates', async () => {
      const invalidData = {
        name: 'Test',
        targetStandard: 'USGAAP' as const,
        targetCoaId: 'coa-1',
        periodStart: '2024-12-31',
        periodEnd: '2024-01-01',
      }

      const startDate = new Date(invalidData.periodStart)
      const endDate = new Date(invalidData.periodEnd)

      expect(startDate > endDate).toBe(true)
    })

    it('should require valid target standard', async () => {
      vi.mocked(prisma.accountingStandard.findUnique)
        .mockResolvedValueOnce(mockJgaapStandard as any)
        .mockResolvedValueOnce(null)

      const createData = {
        name: 'Test Project',
        targetStandard: 'INVALID' as any,
        targetCoaId: 'coa-1',
        periodStart: '2024-01-01',
        periodEnd: '2024-12-31',
        settings: {},
      }

      await expect(conversionProjectService.create('company-1', createData)).rejects.toThrow()
    })

    it('should require existing COA', async () => {
      vi.mocked(prisma.accountingStandard.findUnique)
        .mockResolvedValueOnce(mockJgaapStandard as any)
        .mockResolvedValueOnce(mockUsgaapStandard as any)
      vi.mocked(prisma.chartOfAccount.findUnique).mockResolvedValue(null)

      const createData = {
        name: 'Test Project',
        targetStandard: 'USGAAP' as const,
        targetCoaId: 'non-existent',
        periodStart: '2024-01-01',
        periodEnd: '2024-12-31',
        settings: {},
      }

      await expect(conversionProjectService.create('company-1', createData)).rejects.toThrow(
        'Target COA not found'
      )
    })
  })

  describe('GET /api/conversion/projects/:id', () => {
    it('should return project by id', async () => {
      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue(mockProjectDb as any)

      const result = await conversionProjectService.getById('project-1')

      expect(result).not.toBeNull()
      expect(result?.id).toBe('project-1')
    })

    it('should return null for non-existent project', async () => {
      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue(null)

      const result = await conversionProjectService.getById('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('PUT /api/conversion/projects/:id', () => {
    it('should update project in draft status', async () => {
      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue(mockProjectDb as any)
      vi.mocked(prisma.conversionProject.update).mockResolvedValue({
        ...mockProjectDb,
        name: 'Updated Name',
      } as any)

      const result = await conversionProjectService.update('project-1', { name: 'Updated Name' })

      expect(result.name).toBe('Updated Name')
    })

    it('should reject update for non-draft/mapping status', async () => {
      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue({
        ...mockProjectDb,
        status: 'converting',
      } as any)

      await expect(
        conversionProjectService.update('project-1', { name: 'Updated' })
      ).rejects.toThrow('Cannot update project')
    })
  })

  describe('DELETE /api/conversion/projects/:id', () => {
    it('should delete project in draft status', async () => {
      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue(mockProjectDb as any)
      vi.mocked(prisma.conversionProject.delete).mockResolvedValue(mockProjectDb as any)

      await conversionProjectService.delete('project-1')

      expect(prisma.conversionProject.delete).toHaveBeenCalledWith({
        where: { id: 'project-1' },
      })
    })

    it('should reject delete for converting status', async () => {
      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue({
        ...mockProjectDb,
        status: 'converting',
      } as any)

      await expect(conversionProjectService.delete('project-1')).rejects.toThrow(
        'Cannot delete project while conversion is in progress'
      )
    })
  })
})
