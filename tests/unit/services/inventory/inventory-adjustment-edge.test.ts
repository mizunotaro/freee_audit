import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  detectInventoryAlerts,
  analyzeInventoryTrend,
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

const companyId = 'company-1'

function storedAdjustment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'adj-1',
    companyId,
    fiscalYear: 2024,
    month: 1,
    openingBalance: 1000,
    closingBalance: 1200,
    adjustment: 200,
    status: 'PENDING',
    journalEntryId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('inventory — edge branches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('detectInventoryAlerts — variance threshold boundary (strict >)', () => {
    it('does not raise LARGE_VARIANCE when variance rate equals the threshold exactly', async () => {
      // openingBalance 1000, adjustment 200 ⇒ varianceRate = 0.2 === threshold.
      vi.mocked(prisma.inventoryAdjustment.findUnique).mockResolvedValue(
        storedAdjustment({
          openingBalance: 1000,
          closingBalance: 1200,
          adjustment: 200,
          journalEntryId: 'je-1',
        })
      )

      const alerts = await detectInventoryAlerts(companyId, 2024, 1, 0.2)
      expect(alerts.find((a) => a.type === 'LARGE_VARIANCE')).toBeUndefined()
      // journalEntryId is set and status is not SKIPPED ⇒ no MISSING_JOURNAL either.
      expect(alerts).toHaveLength(0)
    })

    it('raises LARGE_VARIANCE immediately above the threshold', async () => {
      vi.mocked(prisma.inventoryAdjustment.findUnique).mockResolvedValue(
        storedAdjustment({
          openingBalance: 1000,
          closingBalance: 1201,
          adjustment: 201,
          journalEntryId: 'je-1',
        })
      )

      const alerts = await detectInventoryAlerts(companyId, 2024, 1, 0.2)
      const variance = alerts.find((a) => a.type === 'LARGE_VARIANCE')
      expect(variance).toBeDefined()
      expect(variance?.severity).toBe('error')
    })

    it('honours a custom threshold at its exact boundary', async () => {
      vi.mocked(prisma.inventoryAdjustment.findUnique).mockResolvedValue(
        storedAdjustment({
          openingBalance: 1000,
          closingBalance: 1500,
          adjustment: 500,
          journalEntryId: 'je-1',
        })
      )
      // 500 / 1000 = 0.5 === custom threshold ⇒ no alert.
      const alerts = await detectInventoryAlerts(companyId, 2024, 1, 0.5)
      expect(alerts.find((a) => a.type === 'LARGE_VARIANCE')).toBeUndefined()
    })
  })

  describe('analyzeInventoryTrend — stable-branch boundaries', () => {
    it('is stable when the last three adjustments are mixed (no sign reaches two)', async () => {
      vi.mocked(prisma.inventoryAdjustment.findMany).mockResolvedValue([
        storedAdjustment({ month: 1, closingBalance: 1000, adjustment: 100 }),
        storedAdjustment({ month: 2, closingBalance: 900, adjustment: -100 }),
        storedAdjustment({ month: 3, closingBalance: 1000, adjustment: 0 }),
      ])

      const analysis = await analyzeInventoryTrend(companyId, 2024)
      expect(analysis.trend).toBe('stable')
      expect(analysis.totalAdjustment).toBe(0)
      expect(analysis.averageBalance).toBeCloseTo(966.6667, 3)
    })

    it('is stable with exactly two data points (insufficient for trend detection)', async () => {
      vi.mocked(prisma.inventoryAdjustment.findMany).mockResolvedValue([
        storedAdjustment({ month: 1, closingBalance: 1000, adjustment: 100 }),
        storedAdjustment({ month: 2, closingBalance: 1100, adjustment: 100 }),
      ])

      const analysis = await analyzeInventoryTrend(companyId, 2024)
      expect(analysis.trend).toBe('stable')
      expect(analysis.totalAdjustment).toBe(200)
      expect(analysis.averageBalance).toBe(1050)
      expect(analysis.monthlyData).toHaveLength(2)
    })

    it('is stable when recent adjustments are all zero', async () => {
      vi.mocked(prisma.inventoryAdjustment.findMany).mockResolvedValue([
        storedAdjustment({ month: 1, closingBalance: 1000, adjustment: 0 }),
        storedAdjustment({ month: 2, closingBalance: 1000, adjustment: 0 }),
        storedAdjustment({ month: 3, closingBalance: 1000, adjustment: 0 }),
      ])

      const analysis = await analyzeInventoryTrend(companyId, 2024)
      expect(analysis.trend).toBe('stable')
    })
  })
})
