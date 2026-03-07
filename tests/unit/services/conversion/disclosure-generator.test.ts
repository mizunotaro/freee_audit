import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { DisclosureDocument, DisclosureCategory } from '@/types/conversion'

vi.mock('@/lib/db', () => {
  const mockFindUnique = vi.fn()
  const mockFindFirst = vi.fn()
  const mockFindMany = vi.fn()
  const mockCreate = vi.fn()
  const mockUpdate = vi.fn()
  const mockDelete = vi.fn()
  const mockDeleteMany = vi.fn()

  return {
    prisma: {
      conversionProject: {
        findUnique: mockFindUnique,
      },
      adjustingEntry: {
        findMany: mockFindMany,
      },
      conversionRationale: {
        findMany: mockFindMany,
      },
      disclosureDocument: {
        findUnique: mockFindUnique,
        findFirst: mockFindFirst,
        findMany: mockFindMany,
        create: mockCreate,
        update: mockUpdate,
        delete: mockDelete,
        deleteMany: mockDeleteMany,
      },
      disclosureStandardReference: {
        deleteMany: mockDeleteMany,
        create: mockCreate,
      },
      disclosureRationaleLink: {
        deleteMany: mockDeleteMany,
        create: mockCreate,
      },
    },
  }
})

vi.mock('@/lib/conversion/disclosure-ai-enhancer', () => {
  return {
    DisclosureAIEnhancer: class MockDisclosureAIEnhancer {
      enhance = vi.fn().mockResolvedValue({
        enhancedContent: 'Enhanced content',
        enhancedContentEn: 'Enhanced content EN',
        addedReferences: ['ASC 235'],
        improvements: ['Added references'],
      })
    },
  }
})

describe('DisclosureGenerator', () => {
  let generator: any
  let prisma: any

  const mockProject = {
    id: 'project-1',
    targetStandardId: 'usgaap-standard',
    periodStart: new Date('2024-01-01'),
    periodEnd: new Date('2024-12-31'),
    company: { name: 'Test Company' },
    sourceStandard: { id: 'jgaap', name: 'JGAAP' },
    targetStandard: { id: 'usgaap', name: 'US GAAP' },
  }

  const createMockDisclosure = (overrides?: Record<string, unknown>): Record<string, unknown> => ({
    id: 'disclosure-1',
    projectId: 'project-1',
    category: 'significant_accounting_policies',
    title: '重要な会計方針',
    titleEn: 'Significant Accounting Policies',
    content: 'Test content',
    contentEn: 'Test content EN',
    sections: null,
    isGenerated: true,
    isAiEnhanced: false,
    generatedAt: new Date(),
    updatedAt: new Date(),
    reviewedBy: null,
    reviewedAt: null,
    sortOrder: 0,
    references: [],
    rationaleLinks: [],
    ...overrides,
  })

  beforeEach(async () => {
    vi.clearAllMocks()
    const db = await import('@/lib/db')
    prisma = db.prisma

    const { DisclosureGenerator } = await import('@/services/conversion/disclosure-generator')
    generator = new DisclosureGenerator()
  })

  describe('getById', () => {
    it('should return disclosure by id', async () => {
      prisma.disclosureDocument.findUnique.mockResolvedValue(createMockDisclosure())

      const result = await generator.getById('disclosure-1')

      expect(result).not.toBeNull()
      expect(result?.id).toBe('disclosure-1')
    })

    it('should return null if disclosure not found', async () => {
      prisma.disclosureDocument.findUnique.mockResolvedValue(null)

      const result = await generator.getById('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('getByProject', () => {
    it('should return all disclosures for project', async () => {
      prisma.disclosureDocument.findMany.mockResolvedValue([createMockDisclosure()])

      const result = await generator.getByProject('project-1')

      expect(result).toHaveLength(1)
      expect(result[0].projectId).toBe('project-1')
    })
  })

  describe('update', () => {
    it('should update disclosure content', async () => {
      prisma.disclosureDocument.update.mockResolvedValue(
        createMockDisclosure({
          content: 'Updated content',
          contentEn: 'Updated content EN',
          isAiEnhanced: true,
        })
      )

      const result = await generator.update('disclosure-1', {
        content: 'Updated content',
        contentEn: 'Updated content EN',
        isAiEnhanced: true,
      })

      expect(result.content).toBe('Updated content')
      expect(result.isAiEnhanced).toBe(true)
    })
  })

  describe('review', () => {
    it('should mark disclosure as reviewed', async () => {
      prisma.disclosureDocument.update.mockResolvedValue(
        createMockDisclosure({
          reviewedBy: 'user-1',
          reviewedAt: new Date(),
        })
      )

      const result = await generator.review('disclosure-1', 'user-1')

      expect(result.reviewedBy).toBe('user-1')
      expect(result.reviewedAt).toBeDefined()
    })
  })

  describe('delete', () => {
    it('should delete disclosure', async () => {
      prisma.disclosureDocument.delete.mockResolvedValue({})

      await generator.delete('disclosure-1')

      expect(prisma.disclosureDocument.delete).toHaveBeenCalledWith({
        where: { id: 'disclosure-1' },
      })
    })
  })

  describe('deleteByProject', () => {
    it('should delete all disclosures for project', async () => {
      prisma.disclosureDocument.deleteMany.mockResolvedValue({ count: 2 })

      await generator.deleteByProject('project-1')

      expect(prisma.disclosureDocument.deleteMany).toHaveBeenCalledWith({
        where: { projectId: 'project-1' },
      })
    })
  })
})
