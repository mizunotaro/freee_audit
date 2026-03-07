import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  AccountingStandardService,
  AccountingStandardServiceError,
  accountingStandardService,
} from '@/services/conversion/accounting-standard-service'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    accountingStandard: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      createMany: vi.fn(),
    },
  },
}))

describe('AccountingStandardService', () => {
  let service: AccountingStandardService

  const mockStandards = [
    {
      id: '1',
      code: 'JGAAP',
      name: '日本基準',
      nameEn: 'Japanese GAAP',
      description: '日本の一般に公正妥当と認められる企業会計の原則',
      countryCode: 'JP',
      isActive: true,
      sortOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: '2',
      code: 'USGAAP',
      name: 'US GAAP',
      nameEn: 'United States Generally Accepted Accounting Principles',
      description: '米国の一般に公正妥当と認められる企業会計の原則',
      countryCode: 'US',
      isActive: true,
      sortOrder: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: '3',
      code: 'IFRS',
      name: 'IFRS',
      nameEn: 'International Financial Reporting Standards',
      description: '国際会計基準',
      countryCode: 'XX',
      isActive: true,
      sortOrder: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    service = new AccountingStandardService()
    accountingStandardService.clearCache()
  })

  describe('getAll', () => {
    it('should return all accounting standards', async () => {
      vi.mocked(prisma.accountingStandard.findMany).mockResolvedValue(mockStandards)

      const result = await service.getAll()

      expect(result).toHaveLength(3)
      expect(result[0].code).toBe('JGAAP')
      expect(result[1].code).toBe('USGAAP')
      expect(result[2].code).toBe('IFRS')
      expect(prisma.accountingStandard.findMany).toHaveBeenCalledWith({
        orderBy: { sortOrder: 'asc' },
      })
    })

    it('should return empty array when no data', async () => {
      vi.mocked(prisma.accountingStandard.findMany).mockResolvedValue([])

      const result = await service.getAll()

      expect(result).toHaveLength(0)
    })

    it('should cache results', async () => {
      vi.mocked(prisma.accountingStandard.findMany).mockResolvedValue(mockStandards)

      await service.getAll()
      await service.getAll()

      expect(prisma.accountingStandard.findMany).toHaveBeenCalledTimes(1)
    })

    it('should throw AccountingStandardServiceError on database error', async () => {
      vi.mocked(prisma.accountingStandard.findMany).mockRejectedValue(new Error('DB error'))

      await expect(service.getAll()).rejects.toThrow(AccountingStandardServiceError)
      await expect(service.getAll()).rejects.toThrow('Failed to fetch accounting standards')
    })
  })

  describe('getByCode', () => {
    it('should return JGAAP standard', async () => {
      vi.mocked(prisma.accountingStandard.findUnique).mockResolvedValue(mockStandards[0])

      const result = await service.getByCode('JGAAP')

      expect(result).not.toBeNull()
      expect(result?.code).toBe('JGAAP')
      expect(result?.name).toBe('日本基準')
      expect(result?.nameEn).toBe('Japanese GAAP')
      expect(result?.countryCode).toBe('JP')
    })

    it('should return USGAAP standard', async () => {
      vi.mocked(prisma.accountingStandard.findUnique).mockResolvedValue(mockStandards[1])

      const result = await service.getByCode('USGAAP')

      expect(result).not.toBeNull()
      expect(result?.code).toBe('USGAAP')
      expect(result?.name).toBe('US GAAP')
    })

    it('should return IFRS standard', async () => {
      vi.mocked(prisma.accountingStandard.findUnique).mockResolvedValue(mockStandards[2])

      const result = await service.getByCode('IFRS')

      expect(result).not.toBeNull()
      expect(result?.code).toBe('IFRS')
    })

    it('should return null for invalid code', async () => {
      vi.mocked(prisma.accountingStandard.findUnique).mockResolvedValue(null)

      const result = await service.getByCode('INVALID' as 'JGAAP' | 'USGAAP' | 'IFRS')

      expect(result).toBeNull()
    })

    it('should cache results by code', async () => {
      vi.mocked(prisma.accountingStandard.findUnique).mockResolvedValue(mockStandards[0])

      await service.getByCode('JGAAP')
      await service.getByCode('JGAAP')

      expect(prisma.accountingStandard.findUnique).toHaveBeenCalledTimes(1)
    })

    it('should throw AccountingStandardServiceError on database error', async () => {
      vi.mocked(prisma.accountingStandard.findUnique).mockRejectedValue(new Error('DB error'))

      await expect(service.getByCode('JGAAP')).rejects.toThrow(AccountingStandardServiceError)
      await expect(service.getByCode('JGAAP')).rejects.toThrow(
        'Failed to fetch accounting standard with code: JGAAP'
      )
    })
  })

  describe('getActive', () => {
    it('should return active accounting standards only', async () => {
      const activeStandards = [mockStandards[0], mockStandards[1]]
      vi.mocked(prisma.accountingStandard.findMany).mockResolvedValue(activeStandards)

      const result = await service.getActive()

      expect(result).toHaveLength(2)
      expect(prisma.accountingStandard.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      })
    })

    it('should return empty array when no active standards', async () => {
      vi.mocked(prisma.accountingStandard.findMany).mockResolvedValue([])

      const result = await service.getActive()

      expect(result).toHaveLength(0)
    })

    it('should cache results', async () => {
      vi.mocked(prisma.accountingStandard.findMany).mockResolvedValue(mockStandards)

      await service.getActive()
      await service.getActive()

      expect(prisma.accountingStandard.findMany).toHaveBeenCalledTimes(1)
    })

    it('should throw AccountingStandardServiceError on database error', async () => {
      vi.mocked(prisma.accountingStandard.findMany).mockRejectedValue(new Error('DB error'))

      await expect(service.getActive()).rejects.toThrow(AccountingStandardServiceError)
      await expect(service.getActive()).rejects.toThrow(
        'Failed to fetch active accounting standards'
      )
    })
  })

  describe('initializeSeed', () => {
    it('should create seed data when empty', async () => {
      vi.mocked(prisma.accountingStandard.count).mockResolvedValue(0)
      vi.mocked(prisma.accountingStandard.createMany).mockResolvedValue({ count: 3 })

      await service.initializeSeed()

      expect(prisma.accountingStandard.count).toHaveBeenCalled()
      expect(prisma.accountingStandard.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ code: 'JGAAP', isActive: true }),
          expect.objectContaining({ code: 'USGAAP', isActive: true }),
          expect.objectContaining({ code: 'IFRS', isActive: true }),
        ]),
        skipDuplicates: true,
      })
    })

    it('should not duplicate data on re-run', async () => {
      vi.mocked(prisma.accountingStandard.count).mockResolvedValue(3)

      await service.initializeSeed()

      expect(prisma.accountingStandard.count).toHaveBeenCalled()
      expect(prisma.accountingStandard.createMany).not.toHaveBeenCalled()
    })

    it('should throw AccountingStandardServiceError on database error', async () => {
      vi.mocked(prisma.accountingStandard.count).mockRejectedValue(new Error('DB error'))

      await expect(service.initializeSeed()).rejects.toThrow(AccountingStandardServiceError)
      await expect(service.initializeSeed()).rejects.toThrow('Failed to initialize seed data')
    })
  })

  describe('clearCache', () => {
    it('should clear cache', async () => {
      vi.mocked(prisma.accountingStandard.findMany).mockResolvedValue(mockStandards)

      await service.getAll()
      service.clearCache()
      await service.getAll()

      expect(prisma.accountingStandard.findMany).toHaveBeenCalledTimes(2)
    })
  })

  describe('exported singleton instance', () => {
    it('should be exported as accountingStandardService', () => {
      expect(accountingStandardService).toBeInstanceOf(AccountingStandardService)
    })
  })

  describe('AccountingStandardServiceError', () => {
    it('should have correct name', () => {
      const error = new AccountingStandardServiceError('test', 'TEST_CODE')
      expect(error.name).toBe('AccountingStandardServiceError')
    })

    it('should store code and originalError', () => {
      const originalError = new Error('original')
      const error = new AccountingStandardServiceError('test', 'TEST_CODE', originalError)

      expect(error.code).toBe('TEST_CODE')
      expect(error.originalError).toBe(originalError)
    })
  })
})
