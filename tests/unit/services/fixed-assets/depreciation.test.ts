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
  importFixedAssetsFromFreee,
  type FixedAsset,
} from '@/services/fixed-assets/depreciation'
import { prisma } from '@/lib/db'
import { freeeClient } from '@/integrations/freee/client'

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

function makeAsset(id: string, name: string, acquisitionCost: number, salvageValue: number) {
  return {
    id,
    companyId: 'company-1',
    freeeAssetId: null,
    name,
    acquisitionDate: new Date('2024-01-01'),
    acquisitionCost,
    salvageValue,
    usefulLife: 5,
    depreciationMethod: 'straight_line',
    accumulatedDep: 0,
    bookValue: acquisitionCost,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

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

  describe('importFixedAssetsFromFreee', () => {
    it('should return unavailable message when freee responds without error', async () => {
      vi.mocked(freeeClient.getAccountItems).mockResolvedValue({
        data: [mockAsset as unknown as object],
        error: undefined,
      } as never)

      const result = await importFixedAssetsFromFreee(mockCompanyId, 999)

      expect(freeeClient.getAccountItems).toHaveBeenCalledWith(999)
      expect(result.imported).toBe(0)
      expect(result.error).toBe('Fixed assets API not yet available in freee')
    })

    it('should surface the freee API error message', async () => {
      vi.mocked(freeeClient.getAccountItems).mockResolvedValue({
        data: undefined,
        error: { message: 'Unauthorized', code: 'UNAUTHORIZED' },
      } as never)

      const result = await importFixedAssetsFromFreee(mockCompanyId, 999)

      expect(result.imported).toBe(0)
      expect(result.error).toBe('Unauthorized')
    })

    it('should catch thrown errors and return the message', async () => {
      vi.mocked(freeeClient.getAccountItems).mockRejectedValue(new Error('Network failure'))

      const result = await importFixedAssetsFromFreee(mockCompanyId, 999)

      expect(result.imported).toBe(0)
      expect(result.error).toBe('Network failure')
    })

    it('should return Unknown error for non-Error rejection', async () => {
      vi.mocked(freeeClient.getAccountItems).mockRejectedValue('boom')

      const result = await importFixedAssetsFromFreee(mockCompanyId, 999)

      expect(result.imported).toBe(0)
      expect(result.error).toBe('Unknown error')
    })
  })

  describe('calculateDepreciation - exact amounts', () => {
    it('should compute declining balance amount exactly', async () => {
      const decliningAsset: FixedAsset = {
        ...mockAsset,
        depreciationMethod: 'declining_balance',
      }
      const periodStart = new Date('2024-01-01')
      const periodEnd = new Date('2024-01-31')

      const result = await calculateDepreciation(decliningAsset, periodStart, periodEnd)

      // rate = 1 - (0.1)^(1/5); monthly = cost * rate / 12
      expect(result.depreciationAmount).toBe(30754)
      expect(result.accumulatedDepAfter).toBe(30754)
      expect(result.bookValueAfter).toBe(969246)
    })

    it('should compute fixed percentage amount exactly for life=5', async () => {
      const fixedPercentageAsset: FixedAsset = {
        ...mockAsset,
        depreciationMethod: 'fixed_percentage',
      }
      const periodStart = new Date('2024-01-01')
      const periodEnd = new Date('2024-01-31')

      const result = await calculateDepreciation(fixedPercentageAsset, periodStart, periodEnd)

      // rate 0.352; monthly = cost * 0.352 / 12
      expect(result.depreciationAmount).toBe(29333)
      expect(result.accumulatedDepAfter).toBe(29333)
      expect(result.bookValueAfter).toBe(970667)
    })

    it.each([
      [2, 5300],
      [3, 4467],
      [5, 2933],
      [8, 2192],
      [10, 2033],
      [15, 1867],
      [20, 1783],
      [40, 1600],
      [50, 1500],
    ])(
      'should apply the fixed percentage rate table for usefulLife=%i (dep=%i)',
      async (usefulLife, expected) => {
        const asset: FixedAsset = {
          ...mockAsset,
          acquisitionCost: 100000,
          salvageValue: 0,
          bookValue: 100000,
          usefulLife,
          depreciationMethod: 'fixed_percentage',
        }
        const periodStart = new Date('2024-01-01')
        const periodEnd = new Date('2024-01-31')

        const result = await calculateDepreciation(asset, periodStart, periodEnd)

        expect(result.depreciationAmount).toBe(expected)
      }
    )
  })

  describe('getTotalDepreciationByCategory - category bucketing', () => {
    it('should bucket depreciation amounts by asset category', async () => {
      vi.mocked(prisma.fixedAsset.findMany).mockResolvedValue([
        makeAsset('asset-bld', 'オフィスビル', 1200000, 200000),
        makeAsset('asset-car', '営業車', 600000, 100000),
        makeAsset('asset-mac', '製造機械', 300000, 0),
        makeAsset('asset-tool', '事務機器具', 240000, 0),
        makeAsset('asset-soft', '会計ソフト', 120000, 0),
        makeAsset('asset-other', '商標権', 60000, 0),
      ])
      vi.mocked(prisma.fixedAsset.update).mockResolvedValue({} as never)

      const totals = await getTotalDepreciationByCategory(mockCompanyId, 2024, 1)

      expect(Object.keys(totals)).toHaveLength(6)
      expect(totals['建物']).toBe(16667)
      expect(totals['車両運搬具']).toBe(8333)
      expect(totals['機械装置']).toBe(5000)
      expect(totals['工具器具備品']).toBe(4000)
      expect(totals['ソフトウェア']).toBe(2000)
      expect(totals['その他']).toBe(1000)
    })

    it('should accumulate amounts when multiple assets share a category', async () => {
      vi.mocked(prisma.fixedAsset.findMany).mockResolvedValue([
        makeAsset('a1', 'パソコン（器具）', 240000, 0),
        makeAsset('a2', 'デスク（備品）', 120000, 0),
      ])
      vi.mocked(prisma.fixedAsset.update).mockResolvedValue({} as never)

      const totals = await getTotalDepreciationByCategory(mockCompanyId, 2024, 1)

      expect(Object.keys(totals)).toEqual(['工具器具備品'])
      expect(totals['工具器具備品']).toBe(6000)
    })

    it('should skip fully depreciated assets when bucketing', async () => {
      const fullyDep = makeAsset('fd', '製造機械', 300000, 0)
      fullyDep.accumulatedDep = 300000
      fullyDep.bookValue = 0
      vi.mocked(prisma.fixedAsset.findMany).mockResolvedValue([fullyDep])
      vi.mocked(prisma.fixedAsset.update).mockResolvedValue({} as never)

      const totals = await getTotalDepreciationByCategory(mockCompanyId, 2024, 1)

      expect(totals).toEqual({})
    })
  })
})
