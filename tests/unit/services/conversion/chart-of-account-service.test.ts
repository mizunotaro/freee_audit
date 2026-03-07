import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ChartOfAccountService } from '@/services/conversion/chart-of-account-service'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    accountingStandard: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    chartOfAccount: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    chartOfAccountItem: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      aggregate: vi.fn(),
      count: vi.fn(),
    },
    accountMapping: {
      count: vi.fn(),
    },
    conversionProject: {
      count: vi.fn(),
    },
    $transaction: vi.fn((fn) => {
      if (typeof fn === 'function') {
        return fn({
          chartOfAccountItem: {
            create: vi.fn().mockResolvedValue({ id: 'item-1' }),
          },
        })
      }
      return Promise.all(fn)
    }),
  },
}))

describe('ChartOfAccountService', () => {
  let service: ChartOfAccountService

  const mockStandard = {
    id: 'standard-jgaap',
    code: 'JGAAP',
    name: '日本基準',
    nameEn: 'Japanese GAAP',
    description: 'Japanese Generally Accepted Accounting Principles',
    countryCode: 'JP',
    isActive: true,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockCOA = {
    id: 'coa-1',
    companyId: 'company-1',
    standardId: 'standard-jgaap',
    name: 'Test COA',
    description: 'Test Description',
    version: 1,
    isActive: true,
    isDefault: false,
    standard: mockStandard,
    items: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockItem = {
    id: 'item-1',
    coaId: 'coa-1',
    code: '1000',
    name: '現金及び預金',
    nameEn: 'Cash and Cash Equivalents',
    category: 'current_asset',
    subcategory: null,
    normalBalance: 'debit',
    parentId: null,
    level: 0,
    sortOrder: 0,
    isConvertible: true,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ChartOfAccountService()
  })

  describe('create', () => {
    it('should create COA with items', async () => {
      vi.mocked(prisma.accountingStandard.findUnique).mockResolvedValue(mockStandard as any)
      vi.mocked(prisma.chartOfAccount.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.chartOfAccount.create).mockResolvedValue(mockCOA as any)
      vi.mocked(prisma.chartOfAccountItem.create).mockResolvedValue(mockItem as any)
      vi.mocked(prisma.chartOfAccountItem.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.chartOfAccount.findUnique).mockResolvedValue({
        ...mockCOA,
        items: [mockItem],
      } as any)

      const result = await service.create({
        companyId: 'company-1',
        standardId: 'standard-jgaap',
        name: 'Test COA',
        description: 'Test Description',
        items: [
          {
            code: '1000',
            name: '現金及び預金',
            nameEn: 'Cash and Cash Equivalents',
            category: 'current_asset',
            normalBalance: 'debit',
          },
        ],
      })

      expect(result.name).toBe('Test COA')
      expect(prisma.chartOfAccount.create).toHaveBeenCalled()
    })

    it('should fail with duplicate names', async () => {
      vi.mocked(prisma.accountingStandard.findUnique).mockResolvedValue(mockStandard as any)
      vi.mocked(prisma.chartOfAccount.findFirst).mockResolvedValue(mockCOA as any)

      await expect(
        service.create({
          companyId: 'company-1',
          standardId: 'standard-jgaap',
          name: 'Test COA',
        })
      ).rejects.toThrow('already exists')
    })
  })

  describe('getById', () => {
    it('should return COA by id', async () => {
      vi.mocked(prisma.chartOfAccount.findUnique).mockResolvedValue({
        ...mockCOA,
        items: [mockItem],
      } as any)

      const result = await service.getById('coa-1')

      expect(result).not.toBeNull()
      expect(result?.id).toBe('coa-1')
      expect(result?.name).toBe('Test COA')
    })

    it('should return null for non-existent COA', async () => {
      vi.mocked(prisma.chartOfAccount.findUnique).mockResolvedValue(null)

      const result = await service.getById('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('getByCompany', () => {
    it('should return all COAs for a company', async () => {
      vi.mocked(prisma.chartOfAccount.findMany).mockResolvedValue([mockCOA] as any)

      const results = await service.getByCompany('company-1')

      expect(results).toHaveLength(1)
      expect(results[0].companyId).toBe('company-1')
    })
  })

  describe('update', () => {
    it('should update COA', async () => {
      vi.mocked(prisma.chartOfAccount.update).mockResolvedValue({
        ...mockCOA,
        name: 'Updated COA',
      } as any)

      const result = await service.update('coa-1', { name: 'Updated COA' })

      expect(result.name).toBe('Updated COA')
    })
  })

  describe('delete', () => {
    it('should delete COA without dependencies', async () => {
      vi.mocked(prisma.accountMapping.count).mockResolvedValue(0)
      vi.mocked(prisma.conversionProject.count).mockResolvedValue(0)
      vi.mocked(prisma.chartOfAccount.delete).mockResolvedValue(mockCOA as any)

      await service.delete('coa-1')

      expect(prisma.chartOfAccount.delete).toHaveBeenCalledWith({
        where: { id: 'coa-1' },
      })
    })

    it('should fail when COA has mappings', async () => {
      vi.mocked(prisma.accountMapping.count).mockResolvedValue(5)

      await expect(service.delete('coa-1')).rejects.toThrow('existing account mappings')
    })

    it('should fail when COA is used in projects', async () => {
      vi.mocked(prisma.accountMapping.count).mockResolvedValue(0)
      vi.mocked(prisma.conversionProject.count).mockResolvedValue(2)

      await expect(service.delete('coa-1')).rejects.toThrow('conversion projects')
    })
  })

  describe('addItem', () => {
    it('should add item to COA', async () => {
      vi.mocked(prisma.chartOfAccount.findUnique).mockResolvedValue({
        ...mockCOA,
        items: [],
      } as any)
      vi.mocked(prisma.chartOfAccountItem.aggregate).mockResolvedValue({
        _max: { sortOrder: 0 },
      } as any)
      vi.mocked(prisma.chartOfAccountItem.create).mockResolvedValue(mockItem as any)

      const result = await service.addItem('coa-1', {
        code: '1000',
        name: '現金及び預金',
        nameEn: 'Cash and Cash Equivalents',
        category: 'current_asset',
        normalBalance: 'debit',
      })

      expect(result.code).toBe('1000')
    })

    it('should fail with duplicate code', async () => {
      vi.mocked(prisma.chartOfAccount.findUnique).mockResolvedValue({
        ...mockCOA,
        items: [mockItem],
      } as any)

      await expect(
        service.addItem('coa-1', {
          code: '1000',
          name: '現金及び預金',
          nameEn: 'Cash and Cash Equivalents',
          category: 'current_asset',
          normalBalance: 'debit',
        })
      ).rejects.toThrow('already exists')
    })
  })

  describe('updateItem', () => {
    it('should update item', async () => {
      vi.mocked(prisma.chartOfAccountItem.update).mockResolvedValue({
        ...mockItem,
        name: 'Updated Name',
      } as any)

      const result = await service.updateItem('item-1', { name: 'Updated Name' })

      expect(result.name).toBe('Updated Name')
    })
  })

  describe('deleteItem', () => {
    it('should delete item without children', async () => {
      vi.mocked(prisma.chartOfAccountItem.count).mockResolvedValue(0)
      vi.mocked(prisma.accountMapping.count).mockResolvedValue(0)
      vi.mocked(prisma.chartOfAccountItem.delete).mockResolvedValue(mockItem as any)

      await service.deleteItem('item-1')

      expect(prisma.chartOfAccountItem.delete).toHaveBeenCalled()
    })

    it('should fail when item has children', async () => {
      vi.mocked(prisma.chartOfAccountItem.count).mockResolvedValue(3)

      await expect(service.deleteItem('item-1')).rejects.toThrow('child items')
    })

    it('should fail when item has mappings', async () => {
      vi.mocked(prisma.chartOfAccountItem.count).mockResolvedValue(0)
      vi.mocked(prisma.accountMapping.count).mockResolvedValue(2)

      await expect(service.deleteItem('item-1')).rejects.toThrow('existing mappings')
    })
  })

  describe('reorderItems', () => {
    it('should reorder items', async () => {
      vi.mocked(prisma.$transaction).mockResolvedValue([] as any)

      await service.reorderItems('coa-1', ['item-2', 'item-1', 'item-3'])

      expect(prisma.$transaction).toHaveBeenCalled()
    })
  })

  describe('getTemplates', () => {
    it('should return available templates', async () => {
      const templates = await service.getTemplates()

      expect(templates.length).toBeGreaterThan(0)
      expect(templates[0]).toHaveProperty('id')
      expect(templates[0]).toHaveProperty('name')
      expect(templates[0]).toHaveProperty('standardId')
    })
  })

  describe('createFromTemplate', () => {
    it('should create COA from template', async () => {
      vi.mocked(prisma.accountingStandard.findFirst).mockResolvedValue(mockStandard as any)
      vi.mocked(prisma.chartOfAccount.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.chartOfAccount.create).mockResolvedValue(mockCOA as any)
      vi.mocked(prisma.chartOfAccountItem.create).mockResolvedValue(mockItem as any)
      vi.mocked(prisma.chartOfAccountItem.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.chartOfAccount.findUnique).mockResolvedValue({
        ...mockCOA,
        items: [mockItem],
      } as any)

      const result = await service.createFromTemplate('company-1', 'template-jgaap-standard')

      expect(result).toBeDefined()
    })
  })

  describe('validate', () => {
    it('should validate COA and return result', async () => {
      vi.mocked(prisma.chartOfAccount.findUnique).mockResolvedValue({
        ...mockCOA,
        items: [mockItem],
      } as any)

      const result = await service.validate('coa-1')

      expect(result).toHaveProperty('isValid')
      expect(result).toHaveProperty('errors')
      expect(result).toHaveProperty('warnings')
    })

    it('should return error for non-existent COA', async () => {
      vi.mocked(prisma.chartOfAccount.findUnique).mockResolvedValue(null)

      const result = await service.validate('non-existent')

      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].code).toBe('NOT_FOUND')
    })
  })

  describe('setAsDefault', () => {
    it('should set COA as default', async () => {
      vi.mocked(prisma.chartOfAccount.findUnique).mockResolvedValue(mockCOA as any)
      vi.mocked(prisma.$transaction).mockResolvedValue([] as any)

      await service.setAsDefault('coa-1')

      expect(prisma.$transaction).toHaveBeenCalled()
    })

    it('should fail for non-existent COA', async () => {
      vi.mocked(prisma.chartOfAccount.findUnique).mockResolvedValue(null)

      await expect(service.setAsDefault('non-existent')).rejects.toThrow('not found')
    })
  })
})
