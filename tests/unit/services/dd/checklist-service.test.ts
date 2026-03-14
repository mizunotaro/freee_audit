import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DDChecklistService } from '@/services/dd/checklist-service'
import type { DDAnalyticsContext } from '@/services/dd/types'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    dDChecklist: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    dDChecklistItem: {
      createMany: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

const createMockChecklist = (overrides = {}) => ({
  id: 'checklist-123',
  companyId: 'company-123',
  type: 'IPO_SHORT_REVIEW',
  fiscalYear: 2024,
  status: 'IN_PROGRESS',
  materiality: null,
  overallScore: null,
  createdBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

const createMockChecklistItem = (overrides = {}) => ({
  id: 'item-1',
  checklistId: 'checklist-123',
  category: 'REVENUE_RECOGNITION',
  itemCode: 'REV-001',
  title: '収益認識の適切性',
  description: '収益認識基準の確認',
  status: 'PENDING',
  severity: 'HIGH',
  findings: null,
  recommendation: null,
  evidence: null,
  checkedAt: null,
  checkedBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

describe('DDChecklistService', () => {
  let service: DDChecklistService
  const mockCompanyId = 'company-123'
  const mockFiscalYear = 2024

  beforeEach(() => {
    service = new DDChecklistService()
    vi.clearAllMocks()
  })

  describe('createChecklist', () => {
    it('should create a checklist with default values', async () => {
      const mockChecklist = createMockChecklist()

      vi.mocked(prisma.dDChecklist.create).mockResolvedValue(mockChecklist)
      vi.mocked(prisma.dDChecklistItem.createMany).mockResolvedValue({ count: 25 })

      const result = await service.createChecklist({
        type: 'IPO_SHORT_REVIEW',
        fiscalYear: mockFiscalYear,
        companyId: mockCompanyId,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.type).toBe('IPO_SHORT_REVIEW')
        expect(result.data.fiscalYear).toBe(mockFiscalYear)
        expect(result.data.companyId).toBe(mockCompanyId)
      }
    })

    it('should create a checklist with custom materiality threshold', async () => {
      const mockChecklist = createMockChecklist({
        type: 'MA_FINANCIAL_DD',
        materiality: 50000000,
        createdBy: 'user-123',
      })

      vi.mocked(prisma.dDChecklist.create).mockResolvedValue(mockChecklist)
      vi.mocked(prisma.dDChecklistItem.createMany).mockResolvedValue({ count: 18 })

      const result = await service.createChecklist({
        type: 'MA_FINANCIAL_DD',
        fiscalYear: mockFiscalYear,
        companyId: mockCompanyId,
        materialityThreshold: 50000000,
        createdBy: 'user-123',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.materiality).toBe(50000000)
      }
    })

    it('should return error when database operation fails', async () => {
      vi.mocked(prisma.dDChecklist.create).mockRejectedValue(new Error('Database error'))

      const result = await service.createChecklist({
        type: 'IPO_SHORT_REVIEW',
        fiscalYear: mockFiscalYear,
        companyId: mockCompanyId,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('CREATE_FAILED')
      }
    })
  })

  describe('getChecklist', () => {
    it('should return checklist with items', async () => {
      const mockChecklist = createMockChecklist({
        overallScore: 75,
        items: [
          createMockChecklistItem({
            status: 'PASSED',
            checkedAt: new Date(),
            checkedBy: 'user-123',
          }),
        ],
      })

      vi.mocked(prisma.dDChecklist.findUnique).mockResolvedValue(mockChecklist)

      const result = await service.getChecklist('checklist-123')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.id).toBe('checklist-123')
        expect(result.data.items).toHaveLength(1)
        expect(result.data.items[0].itemCode).toBe('REV-001')
      }
    })

    it('should return error when checklist not found', async () => {
      vi.mocked(prisma.dDChecklist.findUnique).mockResolvedValue(null)
      const result = await service.getChecklist('non-existent')
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND')
      }
    })
  })

  describe('updateChecklistItem', () => {
    it('should update checklist item status', async () => {
      const mockUpdatedItem = createMockChecklistItem({
        status: 'PASSED',
        evidence: 'Evidence document',
        checkedAt: new Date(),
        checkedBy: 'user-123',
      })

      vi.mocked(prisma.dDChecklistItem.update).mockResolvedValue(mockUpdatedItem)
      const result = await service.updateChecklistItem('item-1', {
        status: 'PASSED',
        evidence: 'Evidence document',
        checkedBy: 'user-123',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.status).toBe('PASSED')
        expect(result.data.evidence).toBe('Evidence document')
      }
    })

    it('should update checklist item with findings', async () => {
      const mockUpdatedItem = createMockChecklistItem({
        itemCode: 'AR-001',
        title: '売掛金の実在性',
        status: 'FAILED',
        severity: 'CRITICAL',
        findings: JSON.stringify([
          { id: 'f1', title: '長期滞留債権', description: '180日以上の債権が存在' },
        ]),
        recommendation: '貸倒引当金の積増を検討',
        checkedAt: new Date(),
        checkedBy: 'user-123',
      })

      vi.mocked(prisma.dDChecklistItem.update).mockResolvedValue(mockUpdatedItem)

      const result = await service.updateChecklistItem('item-1', {
        status: 'FAILED',
        findings: JSON.stringify([
          { id: 'f1', title: '長期滞留債権', description: '180日以上の債権が存在' },
        ]),
        recommendation: '貸倒引当金の積増を検討',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.status).toBe('FAILED')
      }
    })
  })

  describe('runChecklist', () => {
    it('should run checklist and calculate overall score', async () => {
      const mockChecklist = createMockChecklist({
        items: [
          createMockChecklistItem({
            id: 'item-1',
            itemCode: 'REV-001',
            status: 'PASSED',
            severity: 'HIGH',
            checkedAt: new Date(),
            checkedBy: 'user',
          }),
          createMockChecklistItem({
            id: 'item-2',
            itemCode: 'AR-001',
            status: 'PASSED',
            severity: 'CRITICAL',
            checkedAt: new Date(),
            checkedBy: 'user',
          }),
          createMockChecklistItem({
            id: 'item-3',
            itemCode: 'INV-001',
            status: 'FAILED',
            severity: 'HIGH',
            findings: '[]',
            evidence: 'doc',
            checkedAt: new Date(),
            checkedBy: 'user',
          }),
          createMockChecklistItem({
            id: 'item-4',
            itemCode: 'TAX-001',
            status: 'PENDING',
            severity: 'MEDIUM',
          }),
        ],
      })

      vi.mocked(prisma.dDChecklist.findUnique).mockResolvedValue(mockChecklist)
      vi.mocked(prisma.dDChecklist.update).mockResolvedValue(
        createMockChecklist({
          status: 'COMPLETED',
          overallScore: 70,
        })
      )

      const result = await service.runChecklist('checklist-123')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.totalItems).toBe(4)
        expect(result.data.passedItems).toBe(2)
        expect(result.data.failedItems).toBe(1)
        expect(result.data.pendingItems).toBe(1)
        expect(result.data.overallScore).toBeGreaterThanOrEqual(0)
        expect(result.data.overallScore).toBeLessThanOrEqual(100)
      }
    })

    it('should return error when checklist not found', async () => {
      vi.mocked(prisma.dDChecklist.findUnique).mockResolvedValue(null)
      const result = await service.runChecklist('non-existent')
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND')
      }
    })
  })
})
