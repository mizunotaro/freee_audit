import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    shareholderRecord: { create: vi.fn(), findMany: vi.fn() },
    stockOptionPlan: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
    stockOptionGrant: { create: vi.fn() },
  },
}))

import { prisma } from '@/lib/db'
import {
  createShareholder,
  getShareholderSummary,
  createStockOptionPlan,
  createStockOptionGrant,
  getCapitalStructure,
} from '@/services/shareholder'

describe('Shareholder Service', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('createShareholder', () => {
    it('should create a shareholder', async () => {
      vi.mocked(prisma.shareholderRecord.create).mockResolvedValue({ id: 'sh-1' } as never)

      const result = await createShareholder({
        companyId: 'comp-1',
        shareholderName: '投資太郎',
        shareholderType: 'individual',
        sharesHeld: 1000,
        acquisitionDate: new Date('2024-01-01'),
      })

      expect(result.success).toBe(true)
    })

    it('should reject zero shares', async () => {
      const result = await createShareholder({
        companyId: 'comp-1',
        shareholderName: 'Test',
        shareholderType: 'individual',
        sharesHeld: 0,
        acquisitionDate: new Date(),
      })
      expect(result.success).toBe(false)
    })

    it('should reject invalid type', async () => {
      const result = await createShareholder({
        companyId: 'comp-1',
        shareholderName: 'Test',
        shareholderType: 'alien',
        sharesHeld: 100,
        acquisitionDate: new Date(),
      })
      expect(result.success).toBe(false)
    })
  })

  describe('getShareholderSummary', () => {
    it('should compute summary correctly', async () => {
      vi.mocked(prisma.shareholderRecord.findMany).mockResolvedValue([
        {
          shareholderName: 'A',
          shareholderType: 'founder',
          shareClass: 'common',
          sharesHeld: 6000,
        },
        {
          shareholderName: 'B',
          shareholderType: 'fund',
          shareClass: 'preferred_a',
          sharesHeld: 4000,
        },
      ] as never)

      const result = await getShareholderSummary('comp-1')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.totalShares).toBe(10000)
        expect(result.data.totalShareholders).toBe(2)
        expect(result.data.byType.founder.percentage).toBe(60)
        expect(result.data.topShareholders[0].name).toBe('A')
      }
    })
  })

  describe('createStockOptionPlan', () => {
    it('should create a plan', async () => {
      vi.mocked(prisma.stockOptionPlan.create).mockResolvedValue({ id: 'plan-1' } as never)

      const result = await createStockOptionPlan({
        companyId: 'comp-1',
        planName: '第1回新株予約権',
        resolutionDate: new Date('2024-06-15'),
        totalShares: 500,
        exercisePrice: 10000,
        exercisePeriodStart: new Date('2026-06-16'),
        exercisePeriodEnd: new Date('2034-06-15'),
      })

      expect(result.success).toBe(true)
    })

    it('should reject zero exercise price', async () => {
      const result = await createStockOptionPlan({
        companyId: 'comp-1',
        planName: 'Test',
        resolutionDate: new Date(),
        totalShares: 500,
        exercisePrice: 0,
        exercisePeriodStart: new Date(),
        exercisePeriodEnd: new Date(),
      })
      expect(result.success).toBe(false)
    })
  })

  describe('createStockOptionGrant', () => {
    it('should grant options within plan limit', async () => {
      vi.mocked(prisma.stockOptionPlan.findUnique).mockResolvedValue({
        id: 'plan-1',
        totalShares: 500,
        grants: [{ sharesGranted: 200 }],
      } as never)
      vi.mocked(prisma.stockOptionGrant.create).mockResolvedValue({ id: 'grant-1' } as never)

      const result = await createStockOptionGrant({
        planId: 'plan-1',
        granteeName: '田中太郎',
        sharesGranted: 100,
        grantDate: new Date(),
      })

      expect(result.success).toBe(true)
    })

    it('should reject grant exceeding plan limit', async () => {
      vi.mocked(prisma.stockOptionPlan.findUnique).mockResolvedValue({
        id: 'plan-1',
        totalShares: 500,
        grants: [{ sharesGranted: 450 }],
      } as never)

      const result = await createStockOptionGrant({
        planId: 'plan-1',
        granteeName: '田中太郎',
        sharesGranted: 100,
        grantDate: new Date(),
      })

      expect(result.success).toBe(false)
    })
  })

  describe('getCapitalStructure', () => {
    it('should compute fully diluted shares', async () => {
      vi.mocked(prisma.shareholderRecord.findMany).mockResolvedValue([
        { sharesHeld: 8000 },
        { sharesHeld: 2000 },
      ] as never)
      vi.mocked(prisma.stockOptionPlan.findMany).mockResolvedValue([
        {
          totalShares: 1000,
          grants: [
            { sharesGranted: 500, sharesExercised: 100, sharesCancelled: 50 },
            { sharesGranted: 300, sharesExercised: 0, sharesCancelled: 0 },
          ],
        },
      ] as never)

      const result = await getCapitalStructure('comp-1')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.issuedShares).toBe(10000)
        expect(result.data.potentialShares).toBe(650)
        expect(result.data.fullyDilutedShares).toBe(10650)
        expect(result.data.optionPoolTotal).toBe(1000)
        expect(result.data.optionPoolGranted).toBe(800)
        expect(result.data.optionPoolAvailable).toBe(200)
      }
    })
  })
})
