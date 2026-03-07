import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  ConversionProjectService,
  conversionProjectService,
} from '@/services/conversion/conversion-project-service'
import { prisma } from '@/lib/db'
import type { CreateConversionProjectRequest, ConversionSettings } from '@/types/conversion'

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

describe('ConversionProjectService', () => {
  let service: ConversionProjectService

  const mockJgaapStandard = {
    id: 'jgaap-id',
    code: 'JGAAP',
    name: '日本一般企業会計原則',
    nameEn: 'Japanese GAAP',
  }

  const mockUsgaapStandard = {
    id: 'usgaap-id',
    code: 'USGAAP',
    name: '米国会計基準',
    nameEn: 'US GAAP',
  }

  const mockTargetCoa = {
    id: 'coa-1',
    companyId: 'company-1',
    standardId: 'usgaap-id',
    name: 'USGAAP COA',
  }

  const mockSettings: ConversionSettings = {
    includeJournals: true,
    includeFinancialStatements: true,
    generateAdjustingEntries: true,
    aiAssistedMapping: true,
  }

  const mockCreateRequest: CreateConversionProjectRequest = {
    name: 'Test Project',
    description: 'Test Description',
    targetStandard: 'USGAAP',
    targetCoaId: 'coa-1',
    periodStart: '2024-01-01',
    periodEnd: '2024-12-31',
    settings: {
      includeJournals: true,
      includeFinancialStatements: true,
    },
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
    settings: JSON.stringify(mockSettings),
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
    service = new ConversionProjectService()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('create', () => {
    it('should create a new project successfully', async () => {
      vi.mocked(prisma.accountingStandard.findUnique)
        .mockResolvedValueOnce(mockJgaapStandard as any)
        .mockResolvedValueOnce(mockUsgaapStandard as any)
      vi.mocked(prisma.chartOfAccount.findUnique).mockResolvedValue(mockTargetCoa as any)
      vi.mocked(prisma.conversionProject.create).mockResolvedValue(mockProjectDb as any)

      const result = await service.create('company-1', mockCreateRequest, 'user-1')

      expect(result.id).toBe('project-1')
      expect(result.name).toBe('Test Project')
      expect(result.sourceStandard).toBe('JGAAP')
      expect(result.targetStandard).toBe('USGAAP')
      expect(result.status).toBe('draft')
      expect(result.progress).toBe(0)
      expect(prisma.conversionProject.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: 'company-1',
            name: 'Test Project',
            description: 'Test Description',
          }),
        })
      )
    })

    it('should throw error when JGAAP standard not found', async () => {
      vi.mocked(prisma.accountingStandard.findUnique).mockResolvedValueOnce(null)

      await expect(service.create('company-1', mockCreateRequest)).rejects.toThrow(
        'JGAAP standard not found'
      )
    })

    it('should throw error when target standard not found', async () => {
      vi.mocked(prisma.accountingStandard.findUnique)
        .mockResolvedValueOnce(mockJgaapStandard as any)
        .mockResolvedValueOnce(null)

      await expect(service.create('company-1', mockCreateRequest)).rejects.toThrow(
        'Target standard not found: USGAAP'
      )
    })

    it('should throw error when target COA not found', async () => {
      vi.mocked(prisma.accountingStandard.findUnique)
        .mockResolvedValueOnce(mockJgaapStandard as any)
        .mockResolvedValueOnce(mockUsgaapStandard as any)
      vi.mocked(prisma.chartOfAccount.findUnique).mockResolvedValue(null)

      await expect(service.create('company-1', mockCreateRequest)).rejects.toThrow(
        'Target COA not found: coa-1'
      )
    })

    it('should merge default settings with provided settings', async () => {
      vi.mocked(prisma.accountingStandard.findUnique)
        .mockResolvedValueOnce(mockJgaapStandard as any)
        .mockResolvedValueOnce(mockUsgaapStandard as any)
      vi.mocked(prisma.chartOfAccount.findUnique).mockResolvedValue(mockTargetCoa as any)
      vi.mocked(prisma.conversionProject.create).mockResolvedValue(mockProjectDb as any)

      await service.create('company-1', {
        ...mockCreateRequest,
        settings: { includeJournals: false },
      })

      const createCall = vi.mocked(prisma.conversionProject.create).mock.calls[0][0]
      const settings = JSON.parse(createCall.data.settings as string)

      expect(settings.includeJournals).toBe(false)
      expect(settings.includeFinancialStatements).toBe(true)
      expect(settings.generateAdjustingEntries).toBe(true)
      expect(settings.aiAssistedMapping).toBe(true)
    })
  })

  describe('getById', () => {
    it('should return project by id', async () => {
      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue(mockProjectDb as any)

      const result = await service.getById('project-1')

      expect(result).not.toBeNull()
      expect(result?.id).toBe('project-1')
      expect(result?.name).toBe('Test Project')
    })

    it('should return null when project not found', async () => {
      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue(null)

      const result = await service.getById('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('getByCompany', () => {
    it('should return paginated projects for company', async () => {
      vi.mocked(prisma.conversionProject.count).mockResolvedValue(2)
      vi.mocked(prisma.conversionProject.findMany).mockResolvedValue([
        mockProjectDb,
        { ...mockProjectDb, id: 'project-2' },
      ] as any)

      const result = await service.getByCompany('company-1')

      expect(result.data).toHaveLength(2)
      expect(result.pagination.page).toBe(1)
      expect(result.pagination.limit).toBe(20)
      expect(result.pagination.total).toBe(2)
      expect(result.pagination.totalPages).toBe(1)
    })

    it('should filter by status', async () => {
      vi.mocked(prisma.conversionProject.count).mockResolvedValue(1)
      vi.mocked(prisma.conversionProject.findMany).mockResolvedValue([mockProjectDb] as any)

      await service.getByCompany('company-1', { status: 'draft' })

      const findManyCalls = vi.mocked(prisma.conversionProject.findMany).mock.calls
      expect(findManyCalls.length).toBeGreaterThan(0)
      expect(findManyCalls[0]?.[0]?.where).toHaveProperty('status', 'draft')
    })

    it('should filter by target standard', async () => {
      vi.mocked(prisma.conversionProject.count).mockResolvedValue(1)
      vi.mocked(prisma.conversionProject.findMany).mockResolvedValue([mockProjectDb] as any)

      await service.getByCompany('company-1', { targetStandard: 'USGAAP' })

      const findManyCalls = vi.mocked(prisma.conversionProject.findMany).mock.calls
      expect(findManyCalls.length).toBeGreaterThan(0)
      expect(findManyCalls[0]?.[0]?.where).toHaveProperty('targetStandard')
    })

    it('should filter by period', async () => {
      vi.mocked(prisma.conversionProject.count).mockResolvedValue(1)
      vi.mocked(prisma.conversionProject.findMany).mockResolvedValue([mockProjectDb] as any)

      await service.getByCompany('company-1', {
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
      })

      const findManyCalls = vi.mocked(prisma.conversionProject.findMany).mock.calls
      expect(findManyCalls.length).toBeGreaterThan(0)
      expect(findManyCalls[0]?.[0]?.where).toHaveProperty('periodStart')
      expect(findManyCalls[0]?.[0]?.where).toHaveProperty('periodEnd')
    })

    it('should support pagination', async () => {
      vi.mocked(prisma.conversionProject.count).mockResolvedValue(50)
      vi.mocked(prisma.conversionProject.findMany).mockResolvedValue([] as any)

      const result = await service.getByCompany('company-1', undefined, 2, 10)

      expect(result.pagination.page).toBe(2)
      expect(result.pagination.limit).toBe(10)
      expect(result.pagination.totalPages).toBe(5)
    })
  })

  describe('update', () => {
    it('should update project name', async () => {
      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue(mockProjectDb as any)
      vi.mocked(prisma.conversionProject.update).mockResolvedValue({
        ...mockProjectDb,
        name: 'Updated Name',
      } as any)

      const result = await service.update('project-1', { name: 'Updated Name' })

      expect(result.name).toBe('Updated Name')
    })

    it('should update project settings', async () => {
      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue(mockProjectDb as any)
      vi.mocked(prisma.conversionProject.update).mockResolvedValue(mockProjectDb as any)

      await service.update('project-1', {
        settings: { includeJournals: false },
      })

      const updateCall = vi.mocked(prisma.conversionProject.update).mock.calls[0][0]
      const settings = JSON.parse(updateCall.data.settings as string)
      expect(settings.includeJournals).toBe(false)
    })

    it('should update project status', async () => {
      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue(mockProjectDb as any)
      vi.mocked(prisma.conversionProject.update).mockResolvedValue({
        ...mockProjectDb,
        status: 'mapping',
      } as any)

      const result = await service.update('project-1', { status: 'mapping' })

      expect(result.status).toBe('mapping')
    })

    it('should throw error when project not found', async () => {
      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue(null)

      await expect(service.update('non-existent', { name: 'Test' })).rejects.toThrow(
        'Project not found'
      )
    })

    it('should throw error when status is not draft or mapping', async () => {
      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue({
        ...mockProjectDb,
        status: 'converting',
      } as any)

      await expect(service.update('project-1', { name: 'Test' })).rejects.toThrow(
        'Cannot update project with status: converting'
      )
    })

    it('should allow update when status is mapping', async () => {
      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue({
        ...mockProjectDb,
        status: 'mapping',
      } as any)
      vi.mocked(prisma.conversionProject.update).mockResolvedValue({
        ...mockProjectDb,
        status: 'mapping',
        name: 'Updated',
      } as any)

      const result = await service.update('project-1', { name: 'Updated' })

      expect(result.name).toBe('Updated')
    })
  })

  describe('delete', () => {
    it('should delete project successfully', async () => {
      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue(mockProjectDb as any)
      vi.mocked(prisma.conversionProject.delete).mockResolvedValue(mockProjectDb as any)

      await service.delete('project-1')

      expect(prisma.conversionProject.delete).toHaveBeenCalledWith({
        where: { id: 'project-1' },
      })
    })

    it('should throw error when project not found', async () => {
      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue(null)

      await expect(service.delete('non-existent')).rejects.toThrow('Project not found')
    })

    it('should throw error when project is converting', async () => {
      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue({
        ...mockProjectDb,
        status: 'converting',
      } as any)

      await expect(service.delete('project-1')).rejects.toThrow(
        'Cannot delete project while conversion is in progress'
      )
    })
  })

  describe('updateProgress', () => {
    it('should update progress only', async () => {
      vi.mocked(prisma.conversionProject.update).mockResolvedValue(mockProjectDb as any)

      await service.updateProgress('project-1', 50)

      expect(prisma.conversionProject.update).toHaveBeenCalledWith({
        where: { id: 'project-1' },
        data: { progress: 50 },
      })
    })

    it('should update progress and status', async () => {
      vi.mocked(prisma.conversionProject.update).mockResolvedValue(mockProjectDb as any)

      await service.updateProgress('project-1', 100, 'completed')

      expect(prisma.conversionProject.update).toHaveBeenCalledWith({
        where: { id: 'project-1' },
        data: expect.objectContaining({
          progress: 100,
          status: 'completed',
          completedAt: expect.any(Date),
        }),
      })
    })

    it('should set completedAt when status is completed', async () => {
      vi.mocked(prisma.conversionProject.update).mockResolvedValue(mockProjectDb as any)

      await service.updateProgress('project-1', 100, 'completed')

      const updateCall = vi.mocked(prisma.conversionProject.update).mock.calls[0][0]
      expect(updateCall.data).toHaveProperty('completedAt')
    })

    it('should not set completedAt for other statuses', async () => {
      vi.mocked(prisma.conversionProject.update).mockResolvedValue(mockProjectDb as any)

      await service.updateProgress('project-1', 50, 'mapping')

      const updateCall = vi.mocked(prisma.conversionProject.update).mock.calls[0][0]
      expect(updateCall.data).not.toHaveProperty('completedAt')
    })
  })

  describe('updateStatistics', () => {
    it('should update project statistics', async () => {
      vi.mocked(prisma.conversionProject.update).mockResolvedValue(mockProjectDb as any)

      const statistics = {
        totalAccounts: 100,
        mappedAccounts: 80,
        reviewRequiredCount: 10,
        totalJournals: 500,
        convertedJournals: 450,
        adjustingEntryCount: 15,
        averageConfidence: 0.92,
      }

      await service.updateStatistics('project-1', statistics)

      expect(prisma.conversionProject.update).toHaveBeenCalledWith({
        where: { id: 'project-1' },
        data: {
          statistics: JSON.stringify(statistics),
        },
      })
    })
  })

  describe('mapToProject', () => {
    it('should correctly map database object to ConversionProject', async () => {
      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue(mockProjectDb as any)

      const result = await service.getById('project-1')

      expect(result).toEqual({
        id: 'project-1',
        companyId: 'company-1',
        name: 'Test Project',
        description: 'Test Description',
        sourceStandard: 'JGAAP',
        targetStandard: 'USGAAP',
        targetCoaId: 'coa-1',
        periodStart: expect.any(Date),
        periodEnd: expect.any(Date),
        status: 'draft',
        progress: 0,
        settings: mockSettings,
        statistics: undefined,
        createdBy: 'user-1',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        completedAt: undefined,
      })
    })

    it('should handle null description', async () => {
      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue({
        ...mockProjectDb,
        description: null,
      } as any)

      const result = await service.getById('project-1')

      expect(result?.description).toBeUndefined()
    })

    it('should parse statistics when present', async () => {
      const stats = {
        totalAccounts: 100,
        mappedAccounts: 80,
        reviewRequiredCount: 10,
        totalJournals: 500,
        convertedJournals: 450,
        adjustingEntryCount: 15,
        averageConfidence: 0.92,
      }

      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue({
        ...mockProjectDb,
        statistics: JSON.stringify(stats),
      } as any)

      const result = await service.getById('project-1')

      expect(result?.statistics).toEqual(stats)
    })
  })

  describe('exported singleton instance', () => {
    it('should be exported correctly', () => {
      expect(conversionProjectService).toBeInstanceOf(ConversionProjectService)
    })
  })
})
