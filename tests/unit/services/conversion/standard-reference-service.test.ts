import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  StandardReferenceService,
  standardReferenceService,
} from '@/services/conversion/standard-reference-service'
import { prisma } from '@/lib/db'
import type { AccountingStandard, StandardReference, ReferenceType } from '@/types/conversion'

vi.mock('@/lib/db', () => ({
  prisma: {
    standardReference: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  },
}))

describe('StandardReferenceService', () => {
  let service: StandardReferenceService

  const mockReference: StandardReference = {
    id: 'ref-1',
    standard: 'JGAAP',
    referenceType: 'ASBJ_statement' as ReferenceType,
    referenceNumber: '会計基準第14号',
    title: 'リース取引に関する会計基準',
    titleEn: 'Accounting Standard for Lease Transactions',
    description: 'Test description',
    descriptionEn: 'Test description EN',
    effectiveDate: new Date('2020-01-01'),
    supersededDate: undefined,
    isActive: true,
    officialUrl: 'https://example.com',
    keywords: ['リース', '賃貸借'],
  }

  const mockReferenceDb = {
    id: 'ref-1',
    standard: 'JGAAP',
    referenceType: 'ASBJ_statement',
    referenceNumber: '会計基準第14号',
    title: 'リース取引に関する会計基準',
    titleEn: 'Accounting Standard for Lease Transactions',
    description: 'Test description',
    descriptionEn: 'Test description EN',
    effectiveDate: new Date('2020-01-01'),
    supersededDate: null,
    isActive: true,
    officialUrl: 'https://example.com',
    keywords: JSON.stringify(['リース', '賃貸借']),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    service = new StandardReferenceService()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('search', () => {
    it('should search references by standard', async () => {
      vi.mocked(prisma.standardReference.findMany).mockResolvedValue([mockReferenceDb] as any)

      const result = await service.search({ standard: 'JGAAP' })

      expect(result).toHaveLength(1)
      expect(result[0].standard).toBe('JGAAP')
    })

    it('should search references by query in title', async () => {
      vi.mocked(prisma.standardReference.findMany).mockResolvedValue([mockReferenceDb] as any)

      const result = await service.search({ query: 'リース' })

      expect(result).toHaveLength(1)
      expect(result[0].title).toContain('リース')
    })

    it('should search references by query in titleEn', async () => {
      vi.mocked(prisma.standardReference.findMany).mockResolvedValue([mockReferenceDb] as any)

      const result = await service.search({ query: 'Lease' })

      expect(result).toHaveLength(1)
    })

    it('should search references by query in referenceNumber', async () => {
      vi.mocked(prisma.standardReference.findMany).mockResolvedValue([mockReferenceDb] as any)

      const result = await service.search({ query: '会計基準第14号' })

      expect(result).toHaveLength(1)
    })

    it('should search references by keywords', async () => {
      vi.mocked(prisma.standardReference.findMany).mockResolvedValue([mockReferenceDb] as any)

      const result = await service.search({ keywords: ['リース'] })

      expect(result).toHaveLength(1)
    })

    it('should exclude superseded references by default', async () => {
      vi.mocked(prisma.standardReference.findMany).mockResolvedValue([mockReferenceDb] as any)

      await service.search({})

      expect(prisma.standardReference.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
          }),
        })
      )
    })

    it('should include superseded references when requested', async () => {
      vi.mocked(prisma.standardReference.findMany).mockResolvedValue([mockReferenceDb] as any)

      await service.search({ includeSuperseded: true })

      const calls = vi.mocked(prisma.standardReference.findMany).mock.calls
      expect(calls.length).toBeGreaterThan(0)
      expect(calls[0]?.[0]?.where).not.toHaveProperty('isActive')
    })

    it('should return empty array when no matches', async () => {
      vi.mocked(prisma.standardReference.findMany).mockResolvedValue([] as any)

      const result = await service.search({ query: 'nonexistent' })

      expect(result).toEqual([])
    })

    it('should order results by standard and referenceNumber', async () => {
      vi.mocked(prisma.standardReference.findMany).mockResolvedValue([] as any)

      await service.search({})

      expect(prisma.standardReference.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ standard: 'asc' }, { referenceNumber: 'asc' }],
        })
      )
    })
  })

  describe('getByNumber', () => {
    it('should return reference by standard and number', async () => {
      vi.mocked(prisma.standardReference.findUnique).mockResolvedValue(mockReferenceDb as any)

      const result = await service.getByNumber('JGAAP', '会計基準第14号')

      expect(result).not.toBeNull()
      expect(result?.standard).toBe('JGAAP')
      expect(result?.referenceNumber).toBe('会計基準第14号')
    })

    it('should return null when not found', async () => {
      vi.mocked(prisma.standardReference.findUnique).mockResolvedValue(null)

      const result = await service.getByNumber('JGAAP', 'nonexistent')

      expect(result).toBeNull()
    })

    it('should use compound unique key', async () => {
      vi.mocked(prisma.standardReference.findUnique).mockResolvedValue(mockReferenceDb as any)

      await service.getByNumber('JGAAP', '会計基準第14号')

      expect(prisma.standardReference.findUnique).toHaveBeenCalledWith({
        where: {
          standard_referenceNumber: {
            standard: 'JGAAP',
            referenceNumber: '会計基準第14号',
          },
        },
      })
    })
  })

  describe('findByKeywords', () => {
    it('should find references matching keywords', async () => {
      vi.mocked(prisma.standardReference.findMany).mockResolvedValue([mockReferenceDb] as any)

      const result = await service.findByKeywords(['リース', '賃貸借'])

      expect(result).toHaveLength(1)
    })

    it('should return empty array for empty keywords', async () => {
      const result = await service.findByKeywords([])

      expect(result).toEqual([])
      expect(prisma.standardReference.findMany).not.toHaveBeenCalled()
    })

    it('should perform case-insensitive keyword matching', async () => {
      vi.mocked(prisma.standardReference.findMany).mockResolvedValue([mockReferenceDb] as any)

      await service.findByKeywords(['LEASE'])

      expect(prisma.standardReference.findMany).toHaveBeenCalled()
    })

    it('should only return active references', async () => {
      vi.mocked(prisma.standardReference.findMany).mockResolvedValue([mockReferenceDb] as any)

      await service.findByKeywords(['リース'])

      expect(prisma.standardReference.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
      })
    })
  })

  describe('getActive', () => {
    it('should return all active references for standard', async () => {
      vi.mocked(prisma.standardReference.findMany).mockResolvedValue([mockReferenceDb] as any)

      const result = await service.getActive('JGAAP')

      expect(result).toHaveLength(1)
      expect(result[0].isActive).toBe(true)
    })

    it('should order by referenceNumber', async () => {
      vi.mocked(prisma.standardReference.findMany).mockResolvedValue([] as any)

      await service.getActive('JGAAP')

      expect(prisma.standardReference.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ referenceNumber: 'asc' }],
        })
      )
    })

    it('should return empty array when no active references', async () => {
      vi.mocked(prisma.standardReference.findMany).mockResolvedValue([] as any)

      const result = await service.getActive('IFRS')

      expect(result).toEqual([])
    })
  })

  describe('getById', () => {
    it('should return reference by id', async () => {
      vi.mocked(prisma.standardReference.findUnique).mockResolvedValue(mockReferenceDb as any)

      const result = await service.getById('ref-1')

      expect(result).not.toBeNull()
      expect(result?.id).toBe('ref-1')
    })

    it('should return null when not found', async () => {
      vi.mocked(prisma.standardReference.findUnique).mockResolvedValue(null)

      const result = await service.getById('nonexistent')

      expect(result).toBeNull()
    })
  })

  describe('getByNumbers', () => {
    it('should return references by number list', async () => {
      vi.mocked(prisma.standardReference.findMany).mockResolvedValue([mockReferenceDb] as any)

      const result = await service.getByNumbers(['会計基準第14号', '会計基準第26号'])

      expect(result).toHaveLength(1)
    })

    it('should filter by standard when provided', async () => {
      vi.mocked(prisma.standardReference.findMany).mockResolvedValue([] as any)

      await service.getByNumbers(['会計基準第14号'], 'JGAAP')

      expect(prisma.standardReference.findMany).toHaveBeenCalledWith({
        where: {
          referenceNumber: { in: ['会計基準第14号'] },
          standard: 'JGAAP',
        },
      })
    })

    it('should return empty array for empty list', async () => {
      const result = await service.getByNumbers([])

      expect(result).toEqual([])
      expect(prisma.standardReference.findMany).not.toHaveBeenCalled()
    })
  })

  describe('initializeSeed', () => {
    it('should seed references when none exist', async () => {
      vi.mocked(prisma.standardReference.count).mockResolvedValue(0)
      vi.mocked(prisma.standardReference.create).mockResolvedValue(mockReferenceDb as any)

      await service.initializeSeed()

      expect(prisma.standardReference.create).toHaveBeenCalled()
    })

    it('should not seed when references already exist', async () => {
      vi.mocked(prisma.standardReference.count).mockResolvedValue(10)

      await service.initializeSeed()

      expect(prisma.standardReference.create).not.toHaveBeenCalled()
    })

    it('should handle duplicate errors gracefully', async () => {
      vi.mocked(prisma.standardReference.count).mockResolvedValue(0)
      vi.mocked(prisma.standardReference.create).mockRejectedValue(new Error('Duplicate'))

      await expect(service.initializeSeed()).resolves.not.toThrow()
    })
  })

  describe('create', () => {
    it('should create a new reference', async () => {
      vi.mocked(prisma.standardReference.create).mockResolvedValue(mockReferenceDb as any)

      const result = await service.create({
        standard: 'JGAAP',
        referenceType: 'ASBJ_statement',
        referenceNumber: '会計基準第14号',
        title: 'リース取引に関する会計基準',
        titleEn: 'Accounting Standard for Lease Transactions',
        description: 'Test description',
        keywords: ['リース', '賃貸借'],
      })

      expect(result.standard).toBe('JGAAP')
      expect(result.title).toBe('リース取引に関する会計基準')
    })

    it('should stringify keywords', async () => {
      vi.mocked(prisma.standardReference.create).mockResolvedValue(mockReferenceDb as any)

      await service.create({
        standard: 'JGAAP',
        referenceType: 'ASBJ_statement',
        referenceNumber: '会計基準第14号',
        title: 'Test',
        keywords: ['test'],
      })

      expect(prisma.standardReference.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            keywords: JSON.stringify(['test']),
          }),
        })
      )
    })

    it('should handle optional fields', async () => {
      vi.mocked(prisma.standardReference.create).mockResolvedValue(mockReferenceDb as any)

      await service.create({
        standard: 'JGAAP',
        referenceType: 'ASBJ_statement',
        referenceNumber: '会計基準第14号',
        title: 'Test',
      })

      expect(prisma.standardReference.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            titleEn: undefined,
            description: undefined,
            keywords: null,
          }),
        })
      )
    })
  })

  describe('update', () => {
    it('should update reference', async () => {
      vi.mocked(prisma.standardReference.update).mockResolvedValue({
        ...mockReferenceDb,
        title: 'Updated Title',
      } as any)

      const result = await service.update('ref-1', { title: 'Updated Title' })

      expect(result.title).toBe('Updated Title')
    })

    it('should update isActive status', async () => {
      vi.mocked(prisma.standardReference.update).mockResolvedValue({
        ...mockReferenceDb,
        isActive: false,
        supersededDate: new Date(),
      } as any)

      const result = await service.update('ref-1', {
        isActive: false,
        supersededDate: new Date(),
      })

      expect(result.isActive).toBe(false)
    })

    it('should update keywords', async () => {
      vi.mocked(prisma.standardReference.update).mockResolvedValue(mockReferenceDb as any)

      await service.update('ref-1', { keywords: ['new', 'keywords'] })

      expect(prisma.standardReference.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            keywords: JSON.stringify(['new', 'keywords']),
          }),
        })
      )
    })
  })

  describe('mapToStandardReference', () => {
    it('should correctly map database object to StandardReference', async () => {
      vi.mocked(prisma.standardReference.findUnique).mockResolvedValue(mockReferenceDb as any)

      const result = await service.getById('ref-1')

      expect(result).toEqual({
        id: 'ref-1',
        standard: 'JGAAP',
        referenceType: 'ASBJ_statement',
        referenceNumber: '会計基準第14号',
        title: 'リース取引に関する会計基準',
        titleEn: 'Accounting Standard for Lease Transactions',
        description: 'Test description',
        descriptionEn: 'Test description EN',
        effectiveDate: expect.any(Date),
        supersededDate: undefined,
        isActive: true,
        officialUrl: 'https://example.com',
        keywords: ['リース', '賃貸借'],
      })
    })

    it('should handle null values', async () => {
      vi.mocked(prisma.standardReference.findUnique).mockResolvedValue({
        ...mockReferenceDb,
        titleEn: null,
        description: null,
        descriptionEn: null,
        effectiveDate: null,
        supersededDate: null,
        officialUrl: null,
        keywords: null,
      } as any)

      const result = await service.getById('ref-1')

      expect(result?.titleEn).toBeUndefined()
      expect(result?.description).toBeUndefined()
      expect(result?.keywords).toBeUndefined()
    })
  })

  describe('exported singleton instance', () => {
    it('should be exported correctly', () => {
      expect(standardReferenceService).toBeInstanceOf(StandardReferenceService)
    })
  })
})
