import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  checkInventoryAdjustmentStatus,
  getInventoryAdjustments,
  createInventoryAdjustment,
  generateInventoryJournalEntry,
  markJournalCreated,
  detectInventoryAlerts,
  analyzeInventoryTrend,
  skipInventoryAdjustment,
  type InventoryAdjustmentResult,
} from '@/services/inventory/inventory-adjustment'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    inventoryAdjustment: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
  },
}))

describe('InventoryAdjustmentService', () => {
  const mockCompanyId = 'company-1'
  const mockAdjustment = {
    id: 'adj-1',
    companyId: mockCompanyId,
    fiscalYear: 2024,
    month: 1,
    openingBalance: 1000000,
    closingBalance: 1200000,
    adjustment: 200000,
    status: 'PENDING',
    journalEntryId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('checkInventoryAdjustmentStatus', () => {
    it('should return adjustment when it exists', async () => {
      vi.mocked(prisma.inventoryAdjustment.findUnique).mockResolvedValue(mockAdjustment)

      const result = await checkInventoryAdjustmentStatus(mockCompanyId, 2024, 1)

      expect(result.hasAdjustment).toBe(true)
      expect(result.adjustment).toBeDefined()
      expect(result.adjustment?.adjustment).toBe(200000)
    })

    it('should return false when adjustment does not exist', async () => {
      vi.mocked(prisma.inventoryAdjustment.findUnique).mockResolvedValue(null)

      const result = await checkInventoryAdjustmentStatus(mockCompanyId, 2024, 1)

      expect(result.hasAdjustment).toBe(false)
      expect(result.adjustment).toBeUndefined()
    })
  })

  describe('getInventoryAdjustments', () => {
    it('should return all adjustments for fiscal year', async () => {
      vi.mocked(prisma.inventoryAdjustment.findMany).mockResolvedValue([
        mockAdjustment,
        { ...mockAdjustment, id: 'adj-2', month: 2 },
      ])

      const result = await getInventoryAdjustments(mockCompanyId, 2024)

      expect(prisma.inventoryAdjustment.findMany).toHaveBeenCalledWith({
        where: { companyId: mockCompanyId, fiscalYear: 2024 },
        orderBy: { month: 'asc' },
      })
      expect(result).toHaveLength(2)
    })

    it('should return empty array when no adjustments exist', async () => {
      vi.mocked(prisma.inventoryAdjustment.findMany).mockResolvedValue([])

      const result = await getInventoryAdjustments(mockCompanyId, 2024)

      expect(result).toEqual([])
    })
  })

  describe('createInventoryAdjustment', () => {
    it('should create new adjustment with positive variance', async () => {
      vi.mocked(prisma.inventoryAdjustment.upsert).mockResolvedValue(mockAdjustment)

      const result = await createInventoryAdjustment({
        companyId: mockCompanyId,
        fiscalYear: 2024,
        month: 1,
        openingBalance: 1000000,
        closingBalance: 1200000,
      })

      expect(result.adjustment).toBe(200000)
      expect(result.status).toBe('PENDING')
    })

    it('should create adjustment with negative variance', async () => {
      const negativeAdjustment = {
        ...mockAdjustment,
        closingBalance: 800000,
        adjustment: -200000,
      }
      vi.mocked(prisma.inventoryAdjustment.upsert).mockResolvedValue(negativeAdjustment)

      const result = await createInventoryAdjustment({
        companyId: mockCompanyId,
        fiscalYear: 2024,
        month: 1,
        openingBalance: 1000000,
        closingBalance: 800000,
      })

      expect(result.adjustment).toBe(-200000)
    })

    it('should create adjustment with zero variance', async () => {
      const zeroAdjustment = {
        ...mockAdjustment,
        closingBalance: 1000000,
        adjustment: 0,
      }
      vi.mocked(prisma.inventoryAdjustment.upsert).mockResolvedValue(zeroAdjustment)

      const result = await createInventoryAdjustment({
        companyId: mockCompanyId,
        fiscalYear: 2024,
        month: 1,
        openingBalance: 1000000,
        closingBalance: 1000000,
      })

      expect(result.adjustment).toBe(0)
    })

    it('should update existing adjustment', async () => {
      vi.mocked(prisma.inventoryAdjustment.upsert).mockResolvedValue({
        ...mockAdjustment,
        closingBalance: 1500000,
        adjustment: 500000,
      })

      const result = await createInventoryAdjustment({
        companyId: mockCompanyId,
        fiscalYear: 2024,
        month: 1,
        openingBalance: 1000000,
        closingBalance: 1500000,
      })

      expect(result.adjustment).toBe(500000)
    })
  })

  describe('generateInventoryJournalEntry', () => {
    const mockAdjResult: InventoryAdjustmentResult = {
      id: 'adj-1',
      fiscalYear: 2024,
      month: 1,
      openingBalance: 1000000,
      closingBalance: 1200000,
      adjustment: 200000,
      status: 'PENDING',
      journalEntryId: null,
    }

    it('should generate debit inventory entry for positive adjustment', () => {
      const entry = generateInventoryJournalEntry(
        mockAdjResult,
        'inventory-account',
        'cogs-account'
      )

      expect(entry).not.toBeNull()
      expect(entry?.debitAccount).toBe('inventory-account')
      expect(entry?.creditAccount).toBe('cogs-account')
      expect(entry?.amount).toBe(200000)
      expect(entry?.description).toContain('増加')
    })

    it('should generate debit cogs entry for negative adjustment', () => {
      const negativeAdj: InventoryAdjustmentResult = {
        ...mockAdjResult,
        adjustment: -200000,
      }

      const entry = generateInventoryJournalEntry(negativeAdj, 'inventory-account', 'cogs-account')

      expect(entry).not.toBeNull()
      expect(entry?.debitAccount).toBe('cogs-account')
      expect(entry?.creditAccount).toBe('inventory-account')
      expect(entry?.amount).toBe(200000)
      expect(entry?.description).toContain('減少')
    })

    it('should return null for zero adjustment', () => {
      const zeroAdj: InventoryAdjustmentResult = {
        ...mockAdjResult,
        adjustment: 0,
      }

      const entry = generateInventoryJournalEntry(zeroAdj, 'inventory-account', 'cogs-account')

      expect(entry).toBeNull()
    })

    it('should include fiscal year and month in description', () => {
      const entry = generateInventoryJournalEntry(
        mockAdjResult,
        'inventory-account',
        'cogs-account'
      )

      expect(entry?.description).toContain('2024年1月')
    })
  })

  describe('markJournalCreated', () => {
    it('should update adjustment with journal entry id', async () => {
      vi.mocked(prisma.inventoryAdjustment.update).mockResolvedValue({
        ...mockAdjustment,
        journalEntryId: 'journal-1',
        status: 'COMPLETED',
      })

      await markJournalCreated('adj-1', 'journal-1')

      expect(prisma.inventoryAdjustment.update).toHaveBeenCalledWith({
        where: { id: 'adj-1' },
        data: { journalEntryId: 'journal-1', status: 'COMPLETED' },
      })
    })
  })

  describe('detectInventoryAlerts', () => {
    it('should detect missing inventory count', async () => {
      vi.mocked(prisma.inventoryAdjustment.findUnique).mockResolvedValue(null)

      const alerts = await detectInventoryAlerts(mockCompanyId, 2024, 1)

      expect(alerts.length).toBe(1)
      expect(alerts[0].type).toBe('NO_INVENTORY_COUNT')
      expect(alerts[0].severity).toBe('warning')
    })

    it('should detect missing journal entry', async () => {
      vi.mocked(prisma.inventoryAdjustment.findUnique).mockResolvedValue({
        ...mockAdjustment,
        journalEntryId: null,
        status: 'PENDING',
      })

      const alerts = await detectInventoryAlerts(mockCompanyId, 2024, 1)

      const missingJournalAlert = alerts.find((a) => a.type === 'MISSING_JOURNAL')
      expect(missingJournalAlert).toBeDefined()
      expect(missingJournalAlert?.severity).toBe('warning')
    })

    it('should detect large variance', async () => {
      vi.mocked(prisma.inventoryAdjustment.findUnique).mockResolvedValue({
        ...mockAdjustment,
        openingBalance: 1000000,
        closingBalance: 500000,
        adjustment: -500000,
        journalEntryId: null,
      })

      const alerts = await detectInventoryAlerts(mockCompanyId, 2024, 1, 0.2)

      const varianceAlert = alerts.find((a) => a.type === 'LARGE_VARIANCE')
      expect(varianceAlert).toBeDefined()
      expect(varianceAlert?.severity).toBe('error')
    })

    it('should not alert for variance below threshold', async () => {
      vi.mocked(prisma.inventoryAdjustment.findUnique).mockResolvedValue({
        ...mockAdjustment,
        openingBalance: 1000000,
        closingBalance: 1100000,
        adjustment: 100000,
        journalEntryId: 'journal-1',
        status: 'COMPLETED',
      })

      const alerts = await detectInventoryAlerts(mockCompanyId, 2024, 1, 0.2)

      const varianceAlert = alerts.find((a) => a.type === 'LARGE_VARIANCE')
      expect(varianceAlert).toBeUndefined()
    })

    it('should skip SKIPPED adjustments for journal alerts', async () => {
      vi.mocked(prisma.inventoryAdjustment.findUnique).mockResolvedValue({
        ...mockAdjustment,
        status: 'SKIPPED',
        journalEntryId: null,
      })

      const alerts = await detectInventoryAlerts(mockCompanyId, 2024, 1)

      const missingJournalAlert = alerts.find((a) => a.type === 'MISSING_JOURNAL')
      expect(missingJournalAlert).toBeUndefined()
    })

    it('should check all months up to current month', async () => {
      vi.mocked(prisma.inventoryAdjustment.findUnique).mockResolvedValue(null)

      const alerts = await detectInventoryAlerts(mockCompanyId, 2024, 3)

      expect(alerts.length).toBe(3)
    })
  })

  describe('analyzeInventoryTrend', () => {
    it('should analyze inventory trend with increasing pattern', async () => {
      vi.mocked(prisma.inventoryAdjustment.findMany).mockResolvedValue([
        { ...mockAdjustment, month: 1, closingBalance: 1000000, adjustment: 100000 },
        { ...mockAdjustment, month: 2, closingBalance: 1100000, adjustment: 100000 },
        { ...mockAdjustment, month: 3, closingBalance: 1200000, adjustment: 100000 },
      ])

      const analysis = await analyzeInventoryTrend(mockCompanyId, 2024)

      expect(analysis.trend).toBe('increasing')
      expect(analysis.totalAdjustment).toBe(300000)
      expect(analysis.averageBalance).toBe(1100000)
    })

    it('should analyze inventory trend with decreasing pattern', async () => {
      vi.mocked(prisma.inventoryAdjustment.findMany).mockResolvedValue([
        { ...mockAdjustment, month: 1, closingBalance: 1200000, adjustment: -100000 },
        { ...mockAdjustment, month: 2, closingBalance: 1100000, adjustment: -100000 },
        { ...mockAdjustment, month: 3, closingBalance: 1000000, adjustment: -100000 },
      ])

      const analysis = await analyzeInventoryTrend(mockCompanyId, 2024)

      expect(analysis.trend).toBe('decreasing')
    })

    it('should return increasing trend with 2 positive out of 3 adjustments', async () => {
      vi.mocked(prisma.inventoryAdjustment.findMany).mockResolvedValue([
        { ...mockAdjustment, month: 1, closingBalance: 1000000, adjustment: 100000 },
        { ...mockAdjustment, month: 2, closingBalance: 900000, adjustment: -100000 },
        { ...mockAdjustment, month: 3, closingBalance: 1000000, adjustment: 100000 },
      ])

      const analysis = await analyzeInventoryTrend(mockCompanyId, 2024)

      expect(analysis.trend).toBe('increasing')
    })

    it('should return empty analysis for no data', async () => {
      vi.mocked(prisma.inventoryAdjustment.findMany).mockResolvedValue([])

      const analysis = await analyzeInventoryTrend(mockCompanyId, 2024)

      expect(analysis.averageBalance).toBe(0)
      expect(analysis.totalAdjustment).toBe(0)
      expect(analysis.trend).toBe('stable')
      expect(analysis.monthlyData).toEqual([])
    })

    it('should return stable trend with insufficient data', async () => {
      vi.mocked(prisma.inventoryAdjustment.findMany).mockResolvedValue([
        { ...mockAdjustment, month: 1, closingBalance: 1000000, adjustment: 100000 },
      ])

      const analysis = await analyzeInventoryTrend(mockCompanyId, 2024)

      expect(analysis.trend).toBe('stable')
    })

    it('should include monthly data in analysis', async () => {
      vi.mocked(prisma.inventoryAdjustment.findMany).mockResolvedValue([
        { ...mockAdjustment, month: 1, closingBalance: 1000000, adjustment: 100000 },
        { ...mockAdjustment, month: 2, closingBalance: 1100000, adjustment: 100000 },
      ])

      const analysis = await analyzeInventoryTrend(mockCompanyId, 2024)

      expect(analysis.monthlyData).toHaveLength(2)
      expect(analysis.monthlyData[0].month).toBe(1)
      expect(analysis.monthlyData[1].month).toBe(2)
    })
  })

  describe('skipInventoryAdjustment', () => {
    it('should create skipped adjustment entry', async () => {
      vi.mocked(prisma.inventoryAdjustment.upsert).mockResolvedValue({
        ...mockAdjustment,
        status: 'SKIPPED',
        openingBalance: 0,
        closingBalance: 0,
        adjustment: 0,
      })

      await skipInventoryAdjustment(mockCompanyId, 2024, 1, 'No inventory')

      expect(prisma.inventoryAdjustment.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { status: 'SKIPPED' },
          create: expect.objectContaining({
            status: 'SKIPPED',
            openingBalance: 0,
            closingBalance: 0,
            adjustment: 0,
          }),
        })
      )
    })

    it('should update existing adjustment to skipped', async () => {
      vi.mocked(prisma.inventoryAdjustment.upsert).mockResolvedValue({
        ...mockAdjustment,
        status: 'SKIPPED',
      })

      await skipInventoryAdjustment(mockCompanyId, 2024, 1, 'No inventory')

      expect(prisma.inventoryAdjustment.upsert).toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it('should handle zero opening balance in variance detection', async () => {
      vi.mocked(prisma.inventoryAdjustment.findUnique).mockResolvedValue({
        ...mockAdjustment,
        openingBalance: 0,
        closingBalance: 100000,
        adjustment: 100000,
        journalEntryId: null,
      })

      const alerts = await detectInventoryAlerts(mockCompanyId, 2024, 1)

      const varianceAlert = alerts.find((a) => a.type === 'LARGE_VARIANCE')
      expect(varianceAlert).toBeUndefined()
    })

    it('should handle very large adjustment amounts', async () => {
      vi.mocked(prisma.inventoryAdjustment.upsert).mockResolvedValue({
        ...mockAdjustment,
        openingBalance: 1000000000,
        closingBalance: 2000000000,
        adjustment: 1000000000,
      })

      const result = await createInventoryAdjustment({
        companyId: mockCompanyId,
        fiscalYear: 2024,
        month: 1,
        openingBalance: 1000000000,
        closingBalance: 2000000000,
      })

      expect(result.adjustment).toBe(1000000000)
    })
  })
})
