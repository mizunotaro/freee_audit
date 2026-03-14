import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  AccountMappingService,
  accountMappingService,
} from '@/services/conversion/account-mapping-service'
import { prisma } from '@/lib/db'
import { isSuccess, isFailure } from '@/types/result'

vi.mock('@/lib/db', () => ({
  prisma: {
    accountMapping: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
      aggregate: vi.fn(),
    },
    chartOfAccountItem: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    chartOfAccount: {
      findUnique: vi.fn(),
    },
    conversionProject: {
      findFirst: vi.fn(),
    },
    conversionAuditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => {
      const mockTx = {
        accountMapping: {
          findUnique: vi.fn(),
          create: vi.fn(),
          update: vi.fn(),
        },
        conversionAuditLog: {
          create: vi.fn(),
        },
      }
      return fn(mockTx)
    }),
  },
}))

describe('AccountMappingService', () => {
  let service: AccountMappingService

  const mockSourceItem = {
    id: 'source-item-1',
    code: '1000',
    name: '現金',
    nameEn: 'Cash',
    coaId: 'source-coa-1',
    category: 'current_asset',
    subcategory: null,
    normalBalance: 'debit',
    parentId: null,
    level: 0,
    sortOrder: 1,
    isConvertible: true,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockTargetItem = {
    id: 'target-item-1',
    code: '1100',
    name: 'Cash and Cash Equivalents',
    nameEn: 'Cash and Cash Equivalents',
    coaId: 'target-coa-1',
    category: 'current_asset',
    subcategory: null,
    normalBalance: 'debit',
    parentId: null,
    level: 0,
    sortOrder: 1,
    isConvertible: true,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockSourceCoa = {
    id: 'source-coa-1',
    companyId: 'company-1',
    standardId: 'jgaap',
    name: 'JGAAP COA',
    description: 'Test COA',
    version: 1,
    isActive: true,
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockTargetCoa = {
    id: 'target-coa-1',
    companyId: 'company-1',
    standardId: 'usgaap',
    name: 'USGAAP COA',
    description: 'Test COA',
    version: 1,
    isActive: true,
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockMapping = {
    id: 'mapping-1',
    companyId: 'company-1',
    sourceCoaId: 'source-coa-1',
    sourceItemId: 'source-item-1',
    targetCoaId: 'target-coa-1',
    targetItemId: 'target-item-1',
    mappingType: '1to1',
    conversionRule: null,
    percentage: null,
    confidence: 1.0,
    isManualReview: false,
    isApproved: false,
    notes: null,
    createdBy: 'user-1',
    approvedBy: null,
    approvedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    sourceItem: mockSourceItem,
    targetItem: mockTargetItem,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    service = new AccountMappingService()
  })

  describe('create', () => {
    it('should create 1to1 mapping', async () => {
      vi.mocked(prisma.chartOfAccountItem.findUnique)
        .mockResolvedValueOnce(mockSourceItem)
        .mockResolvedValueOnce(mockTargetItem)
      vi.mocked(prisma.chartOfAccount.findUnique)
        .mockResolvedValueOnce(mockSourceCoa)
        .mockResolvedValueOnce(mockTargetCoa)
      vi.mocked(prisma.accountMapping.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.accountMapping.findMany).mockResolvedValue([])
      vi.mocked(prisma.accountMapping.create).mockResolvedValue(mockMapping)

      const result = await service.create({
        companyId: 'company-1',
        sourceCoaId: 'source-coa-1',
        sourceItemId: 'source-item-1',
        targetCoaId: 'target-coa-1',
        targetItemId: 'target-item-1',
        mappingType: '1to1',
      })

      expect(isSuccess(result)).toBe(true)
      if (isSuccess(result)) {
        expect(result.data.sourceAccountCode).toBe('1000')
        expect(result.data.targetAccountCode).toBe('1100')
        expect(result.data.mappingType).toBe('1to1')
      }
    })

    it('should return error for duplicate mapping', async () => {
      vi.mocked(prisma.chartOfAccountItem.findUnique)
        .mockResolvedValueOnce(mockSourceItem)
        .mockResolvedValueOnce(mockTargetItem)
      vi.mocked(prisma.chartOfAccount.findUnique)
        .mockResolvedValueOnce(mockSourceCoa)
        .mockResolvedValueOnce(mockTargetCoa)
      vi.mocked(prisma.accountMapping.findUnique).mockResolvedValue(mockMapping)

      const result = await service.create({
        companyId: 'company-1',
        sourceCoaId: 'source-coa-1',
        sourceItemId: 'source-item-1',
        targetCoaId: 'target-coa-1',
        targetItemId: 'target-item-1',
        mappingType: '1to1',
      })
      expect(isFailure(result)).toBe(true)
      if (isFailure(result)) {
        expect(result.error.message).toContain('Duplicate mapping')
      }
    })

    it('should return error for invalid conversion rule', async () => {
      vi.mocked(prisma.chartOfAccountItem.findUnique)
        .mockResolvedValueOnce(mockSourceItem)
        .mockResolvedValueOnce(mockTargetItem)
      vi.mocked(prisma.chartOfAccount.findUnique)
        .mockResolvedValueOnce(mockSourceCoa)
        .mockResolvedValueOnce(mockTargetCoa)

      const result = await service.create({
        companyId: 'company-1',
        sourceCoaId: 'source-coa-1',
        sourceItemId: 'source-item-1',
        targetCoaId: 'target-coa-1',
        targetItemId: 'target-item-1',
        mappingType: '1to1',
        conversionRule: { type: 'invalid' as 'direct' },
      })
      expect(isFailure(result)).toBe(true)
      if (isFailure(result)) {
        expect(result.error.message).toContain('Invalid conversion rule type')
      }
    })

    it('should return error when source item not found', async () => {
      vi.mocked(prisma.chartOfAccountItem.findUnique).mockResolvedValue(null)

      const result = await service.create({
        companyId: 'company-1',
        sourceCoaId: 'source-coa-1',
        sourceItemId: 'non-existent',
        targetCoaId: 'target-coa-1',
        targetItemId: 'target-item-1',
        mappingType: '1to1',
      })
      expect(isFailure(result)).toBe(true)
      if (isFailure(result)) {
        expect(result.error.message).toContain('Source item not found')
      }
    })

    it('should return error when target item not found', async () => {
      vi.mocked(prisma.chartOfAccountItem.findUnique)
        .mockResolvedValueOnce(mockSourceItem)
        .mockResolvedValueOnce(null)

      const result = await service.create({
        companyId: 'company-1',
        sourceCoaId: 'source-coa-1',
        sourceItemId: 'source-item-1',
        targetCoaId: 'target-coa-1',
        targetItemId: 'non-existent',
        mappingType: '1to1',
      })
      expect(isFailure(result)).toBe(true)
      if (isFailure(result)) {
        expect(result.error.message).toContain('Target item not found')
      }
    })
  })

  describe('getById', () => {
    it('should return mapping by id', async () => {
      vi.mocked(prisma.accountMapping.findUnique).mockResolvedValue(mockMapping)

      const result = await service.getById('mapping-1')

      expect(result).toBeDefined()
      expect(result?.id).toBe('mapping-1')
    })

    it('should return null for non-existent mapping', async () => {
      vi.mocked(prisma.accountMapping.findUnique).mockResolvedValue(null)

      const result = await service.getById('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('getByCompany', () => {
    it('should return paginated mappings for company', async () => {
      vi.mocked(prisma.accountMapping.count).mockResolvedValue(1)
      vi.mocked(prisma.accountMapping.findMany).mockResolvedValue([mockMapping])

      const result = await service.getByCompany('company-1')

      expect(result.data).toHaveLength(1)
      expect(result.pagination.total).toBe(1)
      expect(result.pagination.page).toBe(1)
    })

    it('should apply filters correctly', async () => {
      vi.mocked(prisma.accountMapping.count).mockResolvedValue(0)
      vi.mocked(prisma.accountMapping.findMany).mockResolvedValue([])

      await service.getByCompany('company-1', {
        sourceCoaId: 'source-coa-1',
        isApproved: true,
        minConfidence: 0.8,
      })

      expect(prisma.accountMapping.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            sourceCoaId: 'source-coa-1',
            isApproved: true,
            confidence: { gte: 0.8 },
          }),
        })
      )
    })
  })

  describe('update', () => {
    it('should update mapping', async () => {
      vi.mocked(prisma.accountMapping.findUnique).mockResolvedValue(mockMapping)
      vi.mocked(prisma.accountMapping.findMany).mockResolvedValue([])
      vi.mocked(prisma.accountMapping.update).mockResolvedValue({
        ...mockMapping,
        notes: 'Updated notes',
      })

      const result = await service.update('mapping-1', { notes: 'Updated notes' })

      expect(result).toBeDefined()
    })

    it('should return error for non-existent mapping', async () => {
      vi.mocked(prisma.accountMapping.findUnique).mockResolvedValue(null)

      const result = await service.update('non-existent', { notes: 'test' })
      expect(isFailure(result)).toBe(true)
      if (isFailure(result)) {
        expect(result.error.message).toContain('Mapping not found')
      }
    })
  })

  describe('delete', () => {
    it('should delete mapping', async () => {
      vi.mocked(prisma.accountMapping.findUnique).mockResolvedValue(mockMapping)
      vi.mocked(prisma.accountMapping.delete).mockResolvedValue(mockMapping)

      await service.delete('mapping-1')

      expect(prisma.accountMapping.delete).toHaveBeenCalledWith({ where: { id: 'mapping-1' } })
    })

    it('should return error for non-existent mapping', async () => {
      vi.mocked(prisma.accountMapping.findUnique).mockResolvedValue(null)

      const result = await service.delete('non-existent')
      expect(isFailure(result)).toBe(true)
      if (isFailure(result)) {
        expect(result.error.message).toContain('Mapping not found')
      }
    })
  })

  describe('approve', () => {
    it('should approve mapping', async () => {
      vi.mocked(prisma.accountMapping.findUnique).mockResolvedValue(mockMapping)
      vi.mocked(prisma.accountMapping.update).mockResolvedValue({
        ...mockMapping,
        isApproved: true,
        approvedBy: 'user-1',
        approvedAt: new Date(),
      })
      vi.mocked(prisma.conversionProject.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.conversionAuditLog.create).mockResolvedValue({} as never)

      const result = await service.approve('mapping-1', 'user-1')

      expect(prisma.accountMapping.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isApproved: true,
            approvedBy: 'user-1',
          }),
        })
      )
    })
  })

  describe('getUnapprovedCount', () => {
    it('should return count of unapproved mappings', async () => {
      vi.mocked(prisma.accountMapping.count).mockResolvedValue(5)

      const result = await service.getUnapprovedCount('company-1')

      expect(result).toBe(5)
      expect(prisma.accountMapping.count).toHaveBeenCalledWith({
        where: { companyId: 'company-1', isApproved: false },
      })
    })
  })

  describe('getStatistics', () => {
    it('should return correct statistics', async () => {
      vi.mocked(prisma.accountMapping.count)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(7)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(2)
      vi.mocked(prisma.accountMapping.groupBy).mockResolvedValue([
        { mappingType: '1to1', _count: { mappingType: 8 } } as never,
        { mappingType: '1toN', _count: { mappingType: 2 } } as never,
      ])
      vi.mocked(prisma.accountMapping.aggregate).mockResolvedValue({
        _avg: { confidence: 0.85 },
      } as never)

      const result = await service.getStatistics('company-1')

      expect(result.total).toBe(10)
      expect(result.approved).toBe(7)
      expect(result.pending).toBe(3)
      expect(result.needsReview).toBe(2)
      expect(result.byType['1to1']).toBe(8)
      expect(result.byType['1toN']).toBe(2)
      expect(result.averageConfidence).toBe(0.85)
    })
  })

  describe('export', () => {
    it('should export to CSV', async () => {
      vi.mocked(prisma.accountMapping.findMany).mockResolvedValue([mockMapping])

      const result = await service.export('company-1', 'csv')

      expect(result).toBeInstanceOf(Buffer)
      const csvContent = result.toString('utf-8')
      expect(csvContent).toContain('ID')
      expect(csvContent).toContain('Source Code')
    })
  })

  describe('exported singleton instance', () => {
    it('should be exported as accountMappingService', () => {
      expect(accountMappingService).toBeInstanceOf(AccountMappingService)
    })
  })
})
