import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getFixedAssets,
  calculateDepreciation,
  generateDepreciationSchedule,
  calculateMonthlyDepreciation,
  generateDepreciationJournalEntries,
  getTotalDepreciationByCategory,
  createFixedAsset,
  deleteFixedAsset,
  type FixedAsset,
} from '@/services/fixed-assets/depreciation'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    fixedAsset: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

vi.mock('@/integrations/freee/client', () => ({
  freeeClient: {
    getAccountItems: vi.fn(),
  },
}))

describe('DepreciationService', () => {
  const mockCompanyId = 'company-1'
  const mockAsset: FixedAsset = {
    id: 'asset-1',
    companyId: mockCompanyId,
    freeeAssetId: 'freee-1',
    name: 'テスト機器',
    acquisitionDate: new Date('2024-01-01'),
    acquisitionCost: 1000000,
    salvageValue: 100000,
    usefulLife: 5,
    depreciationMethod: 'straight_line',
    accumulatedDep: 0,
    bookValue: 1000000,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getFixedAssets', () => {
    it('should return all fixed assets for a company', async () => {
      vi.mocked(prisma.fixedAsset.findMany).mockResolvedValue([
        {
          id: 'asset-1',
          companyId: mockCompanyId,
          freeeAssetId: 'freee-1',
          name: 'テスト機器',
          acquisitionDate: new Date('2024-01-01'),
          acquisitionCost: 1000000,
          salvageValue: 100000,
          usefulLife: 5,
          depreciationMethod: 'straight_line',
          accumulatedDep: 0,
          bookValue: 1000000,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])

      const result = await getFixedAssets(mockCompanyId)

      expect(prisma.fixedAsset.findMany).toHaveBeenCalledWith({
        where: { companyId: mockCompanyId },
        orderBy: { acquisitionDate: 'desc' },
      })
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('テスト機器')
    })

    it('should return empty array when no assets exist', async () => {
      vi.mocked(prisma.fixedAsset.findMany).mockResolvedValue([])

      const result = await getFixedAssets(mockCompanyId)

      expect(result).toEqual([])
    })
  })

  describe('calculateDepreciation - straight_line', () => {
    it('should calculate straight line depreciation for one month', async () => {
      const periodStart = new Date('2024-01-01')
      const periodEnd = new Date('2024-01-31')

      const result = await calculateDepreciation(mockAsset, periodStart, periodEnd)

      expect(result.assetId).toBe('asset-1')
      expect(result.depreciationMethod).toBe('straight_line')
      expect(result.depreciationAmount).toBe(15000)
      expect(result.accumulatedDepAfter).toBe(15000)
      expect(result.bookValueAfter).toBe(985000)
    })

    it('should calculate straight line depreciation for multiple months', async () => {
      const periodStart = new Date('2024-01-01')
      const periodEnd = new Date('2024-03-31')

      const result = await calculateDepreciation(mockAsset, periodStart, periodEnd)

      expect(result.depreciationAmount).toBe(45000)
    })

    it('should not depreciate below salvage value', async () => {
      const fullyDepreciatedAsset: FixedAsset = {
        ...mockAsset,
        accumulatedDep: 850000,
        bookValue: 150000,
      }
      const periodStart = new Date('2024-01-01')
      const periodEnd = new Date('2024-01-31')

      const result = await calculateDepreciation(fullyDepreciatedAsset, periodStart, periodEnd)

      expect(result.bookValueAfter).toBeGreaterThanOrEqual(mockAsset.salvageValue)
    })
  })

  describe('calculateDepreciation - declining_balance', () => {
    it('should calculate declining balance depreciation', async () => {
      const decliningAsset: FixedAsset = {
        ...mockAsset,
        depreciationMethod: 'declining_balance',
      }
      const periodStart = new Date('2024-01-01')
      const periodEnd = new Date('2024-01-31')

      const result = await calculateDepreciation(decliningAsset, periodStart, periodEnd)

      expect(result.depreciationMethod).toBe('declining_balance')
      expect(result.depreciationAmount).toBeGreaterThan(0)
    })

    it('should not depreciate when book value equals salvage value', async () => {
      const assetAtSalvage: FixedAsset = {
        ...mockAsset,
        depreciationMethod: 'declining_balance',
        accumulatedDep: 900000,
        bookValue: 100000,
      }
      const periodStart = new Date('2024-01-01')
      const periodEnd = new Date('2024-01-31')

      const result = await calculateDepreciation(assetAtSalvage, periodStart, periodEnd)

      expect(result.depreciationAmount).toBe(0)
    })
  })

  describe('calculateDepreciation - fixed_percentage', () => {
    it('should calculate fixed percentage depreciation', async () => {
      const fixedPercentageAsset: FixedAsset = {
        ...mockAsset,
        depreciationMethod: 'fixed_percentage',
      }
      const periodStart = new Date('2024-01-01')
      const periodEnd = new Date('2024-01-31')

      const result = await calculateDepreciation(fixedPercentageAsset, periodStart, periodEnd)

      expect(result.depreciationMethod).toBe('fixed_percentage')
      expect(result.depreciationAmount).toBeGreaterThan(0)
    })

    it('should not depreciate when book value is at minimum', async () => {
      const minimalValueAsset: FixedAsset = {
        ...mockAsset,
        depreciationMethod: 'fixed_percentage',
        accumulatedDep: 999999,
        bookValue: 1,
        salvageValue: 1,
      }
      const periodStart = new Date('2024-01-01')
      const periodEnd = new Date('2024-01-31')

      const result = await calculateDepreciation(minimalValueAsset, periodStart, periodEnd)

      expect(result.depreciationAmount).toBe(0)
    })
  })

  describe('generateDepreciationSchedule', () => {
    it('should generate full depreciation schedule', async () => {
      const schedule = await generateDepreciationSchedule(mockAsset)

      expect(schedule.assetId).toBe('asset-1')
      expect(schedule.acquisitionCost).toBe(1000000)
      expect(schedule.salvageValue).toBe(100000)
      expect(schedule.usefulLife).toBe(5)
      expect(schedule.annualDepreciation).toBe(180000)
      expect(schedule.monthlyDepreciation).toBe(15000)
      expect(schedule.remainingLife).toBe(5)
      expect(schedule.schedule.length).toBe(5)
    })

    it('should have correct final book value equal to salvage value', async () => {
      const schedule = await generateDepreciationSchedule(mockAsset)

      const finalYear = schedule.schedule[schedule.schedule.length - 1]
      expect(finalYear.endingBookValue).toBe(mockAsset.salvageValue)
    })

    it('should handle partially depreciated assets', async () => {
      const partiallyDepreciatedAsset: FixedAsset = {
        ...mockAsset,
        accumulatedDep: 360000,
        bookValue: 640000,
      }

      const schedule = await generateDepreciationSchedule(partiallyDepreciatedAsset)

      expect(schedule.remainingLife).toBe(3)
    })

    it('should return remaining life 0 for fully depreciated assets', async () => {
      const fullyDepreciatedAsset: FixedAsset = {
        ...mockAsset,
        accumulatedDep: 900000,
        bookValue: 100000,
      }

      const schedule = await generateDepreciationSchedule(fullyDepreciatedAsset)

      expect(schedule.remainingLife).toBe(0)
      expect(schedule.schedule.length).toBe(0)
    })
  })

  describe('calculateMonthlyDepreciation', () => {
    it('should calculate depreciation for all eligible assets', async () => {
      vi.mocked(prisma.fixedAsset.findMany).mockResolvedValue([
        {
          id: 'asset-1',
          companyId: mockCompanyId,
          freeeAssetId: 'freee-1',
          name: 'テスト機器',
          acquisitionDate: new Date('2024-01-01'),
          acquisitionCost: 1000000,
          salvageValue: 100000,
          usefulLife: 5,
          depreciationMethod: 'straight_line',
          accumulatedDep: 0,
          bookValue: 1000000,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])
      vi.mocked(prisma.fixedAsset.update).mockResolvedValue({} as any)

      const result = await calculateMonthlyDepreciation(mockCompanyId, 2024, 1)

      expect(result.length).toBe(1)
      expect(result[0].depreciationAmount).toBe(15000)
    })

    it('should skip assets acquired after period end', async () => {
      vi.mocked(prisma.fixedAsset.findMany).mockResolvedValue([
        {
          id: 'asset-1',
          companyId: mockCompanyId,
          freeeAssetId: 'freee-1',
          name: 'テスト機器',
          acquisitionDate: new Date('2024-02-15'),
          acquisitionCost: 1000000,
          salvageValue: 100000,
          usefulLife: 5,
          depreciationMethod: 'straight_line',
          accumulatedDep: 0,
          bookValue: 1000000,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])

      const result = await calculateMonthlyDepreciation(mockCompanyId, 2024, 1)

      expect(result.length).toBe(0)
    })

    it('should skip fully depreciated assets', async () => {
      vi.mocked(prisma.fixedAsset.findMany).mockResolvedValue([
        {
          id: 'asset-1',
          companyId: mockCompanyId,
          freeeAssetId: 'freee-1',
          name: 'テスト機器',
          acquisitionDate: new Date('2024-01-01'),
          acquisitionCost: 1000000,
          salvageValue: 100000,
          usefulLife: 5,
          depreciationMethod: 'straight_line',
          accumulatedDep: 900000,
          bookValue: 100000,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])

      const result = await calculateMonthlyDepreciation(mockCompanyId, 2024, 1)

      expect(result.length).toBe(0)
    })

    it('should update asset after depreciation', async () => {
      vi.mocked(prisma.fixedAsset.findMany).mockResolvedValue([
        {
          id: 'asset-1',
          companyId: mockCompanyId,
          freeeAssetId: 'freee-1',
          name: 'テスト機器',
          acquisitionDate: new Date('2024-01-01'),
          acquisitionCost: 1000000,
          salvageValue: 100000,
          usefulLife: 5,
          depreciationMethod: 'straight_line',
          accumulatedDep: 0,
          bookValue: 1000000,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])
      vi.mocked(prisma.fixedAsset.update).mockResolvedValue({} as any)

      await calculateMonthlyDepreciation(mockCompanyId, 2024, 1)

      expect(prisma.fixedAsset.update).toHaveBeenCalledWith({
        where: { id: 'asset-1' },
        data: {
          accumulatedDep: 15000,
          bookValue: 985000,
        },
      })
    })
  })

  describe('generateDepreciationJournalEntries', () => {
    it('should generate journal entries for depreciation', async () => {
      vi.mocked(prisma.fixedAsset.findMany).mockResolvedValue([
        {
          id: 'asset-1',
          companyId: mockCompanyId,
          freeeAssetId: 'freee-1',
          name: 'テスト機器',
          acquisitionDate: new Date('2024-01-01'),
          acquisitionCost: 1000000,
          salvageValue: 100000,
          usefulLife: 5,
          depreciationMethod: 'straight_line',
          accumulatedDep: 0,
          bookValue: 1000000,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])
      vi.mocked(prisma.fixedAsset.update).mockResolvedValue({} as any)

      const entries = await generateDepreciationJournalEntries(
        mockCompanyId,
        2024,
        1,
        'dep-account',
        'accum-dep-account'
      )

      expect(entries.length).toBe(1)
      expect(entries[0].debitAccount).toBe('dep-account')
      expect(entries[0].creditAccount).toBe('accum-dep-account')
      expect(entries[0].amount).toBe(15000)
      expect(entries[0].description).toContain('2024年1月')
    })
  })

  describe('getTotalDepreciationByCategory', () => {
    it('should group depreciation by asset category', async () => {
      vi.mocked(prisma.fixedAsset.findMany).mockResolvedValue([
        {
          id: 'asset-1',
          companyId: mockCompanyId,
          freeeAssetId: 'freee-1',
          name: 'パソコン（器具備品）',
          acquisitionDate: new Date('2024-01-01'),
          acquisitionCost: 200000,
          salvageValue: 20000,
          usefulLife: 5,
          depreciationMethod: 'straight_line',
          accumulatedDep: 0,
          bookValue: 200000,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'asset-2',
          companyId: mockCompanyId,
          freeeAssetId: 'freee-2',
          name: 'デスク（器具）',
          acquisitionDate: new Date('2024-01-01'),
          acquisitionCost: 100000,
          salvageValue: 10000,
          usefulLife: 5,
          depreciationMethod: 'straight_line',
          accumulatedDep: 0,
          bookValue: 100000,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])
      vi.mocked(prisma.fixedAsset.update).mockResolvedValue({} as any)

      const totals = await getTotalDepreciationByCategory(mockCompanyId, 2024, 1)

      expect(Object.keys(totals).length).toBeGreaterThan(0)
    })
  })

  describe('createFixedAsset', () => {
    it('should create a new fixed asset', async () => {
      vi.mocked(prisma.fixedAsset.create).mockResolvedValue({
        id: 'asset-1',
        companyId: mockCompanyId,
        freeeAssetId: null,
        name: '新機器',
        acquisitionDate: new Date('2024-01-01'),
        acquisitionCost: 1000000,
        salvageValue: 100000,
        usefulLife: 5,
        depreciationMethod: 'straight_line',
        accumulatedDep: 0,
        bookValue: 1000000,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await createFixedAsset(mockCompanyId, {
        name: '新機器',
        acquisitionDate: new Date('2024-01-01'),
        acquisitionCost: 1000000,
        salvageValue: 100000,
        usefulLife: 5,
        depreciationMethod: 'straight_line',
      })

      expect(result.name).toBe('新機器')
      expect(result.accumulatedDep).toBe(0)
      expect(result.bookValue).toBe(1000000)
    })
  })

  describe('deleteFixedAsset', () => {
    it('should delete a fixed asset', async () => {
      vi.mocked(prisma.fixedAsset.delete).mockResolvedValue({} as any)

      await deleteFixedAsset('asset-1')

      expect(prisma.fixedAsset.delete).toHaveBeenCalledWith({
        where: { id: 'asset-1' },
      })
    })
  })

  describe('edge cases', () => {
    it('should handle zero useful life gracefully', async () => {
      const zeroLifeAsset: FixedAsset = {
        ...mockAsset,
        usefulLife: 0,
      }
      const periodStart = new Date('2024-01-01')
      const periodEnd = new Date('2024-01-31')

      expect(() => calculateDepreciation(zeroLifeAsset, periodStart, periodEnd)).not.toThrow()
    })

    it('should handle zero acquisition cost', async () => {
      const zeroCostAsset: FixedAsset = {
        ...mockAsset,
        acquisitionCost: 0,
        salvageValue: 0,
        bookValue: 0,
      }
      const periodStart = new Date('2024-01-01')
      const periodEnd = new Date('2024-01-31')

      const result = await calculateDepreciation(zeroCostAsset, periodStart, periodEnd)

      expect(result.depreciationAmount).toBe(0)
    })

    it('should round depreciation amounts', async () => {
      const oddAmountAsset: FixedAsset = {
        ...mockAsset,
        acquisitionCost: 1234567,
        salvageValue: 123456,
        usefulLife: 7,
      }
      const periodStart = new Date('2024-01-01')
      const periodEnd = new Date('2024-01-31')

      const result = await calculateDepreciation(oddAmountAsset, periodStart, periodEnd)

      expect(Number.isInteger(result.depreciationAmount)).toBe(true)
      expect(Number.isInteger(result.accumulatedDepAfter)).toBe(true)
      expect(Number.isInteger(result.bookValueAfter)).toBe(true)
    })
  })
})
