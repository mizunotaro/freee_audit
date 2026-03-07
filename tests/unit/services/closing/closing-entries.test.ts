import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  generateClosingEntries,
  calculateTaxEffectAccounting,
  getTaxEffectHistory,
  generateTaxEffectJournalEntry,
  checkPrepaidExpenses,
} from '@/services/closing/closing-entries'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    fixedAsset: {
      findMany: vi.fn(),
    },
    monthlyBalance: {
      findMany: vi.fn(),
    },
    taxEffectAccounting: {
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

describe('closing-entries', () => {
  const mockCompanyId = 'company-1'
  const mockFiscalYear = 2024
  const mockClosingMonth = 12

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generateClosingEntries', () => {
    it('should generate depreciation entries', async () => {
      vi.mocked(prisma.fixedAsset.findMany).mockResolvedValue([
        {
          id: 'asset-1',
          companyId: mockCompanyId,
          name: '建物',
          acquisitionCost: 10000000,
          salvageValue: 0,
          usefulLife: 20,
          accumulatedDep: 2000000,
          bookValue: 8000000,
        } as any,
      ])

      vi.mocked(prisma.monthlyBalance.findMany).mockResolvedValue([])

      const result = await generateClosingEntries(mockCompanyId, mockFiscalYear, mockClosingMonth)

      expect(result.length).toBeGreaterThanOrEqual(1)
      const depreciationEntry = result.find((e) => e.type === 'depreciation')
      expect(depreciationEntry).toBeDefined()
      expect(depreciationEntry?.debitAccount).toBe('減価償却費')
      expect(depreciationEntry?.creditAccount).toBe('減価償却累計額')
    })

    it('should calculate annual depreciation correctly', async () => {
      vi.mocked(prisma.fixedAsset.findMany).mockResolvedValue([
        {
          id: 'asset-1',
          companyId: mockCompanyId,
          name: '建物',
          acquisitionCost: 12000000,
          salvageValue: 0,
          usefulLife: 12,
          accumulatedDep: 0,
          bookValue: 12000000,
        } as any,
      ])

      vi.mocked(prisma.monthlyBalance.findMany).mockResolvedValue([])

      const result = await generateClosingEntries(mockCompanyId, mockFiscalYear, mockClosingMonth)

      const depreciationEntry = result.find((e) => e.type === 'depreciation')
      expect(depreciationEntry?.amount).toBe(1000000)
    })

    it('should generate allowance for doubtful accounts entry when adjustment needed', async () => {
      vi.mocked(prisma.fixedAsset.findMany).mockResolvedValue([])

      vi.mocked(prisma.monthlyBalance.findMany).mockResolvedValue([
        {
          id: 'balance-1',
          companyId: mockCompanyId,
          fiscalYear: mockFiscalYear,
          month: mockClosingMonth,
          category: 'current_assets',
          accountName: '売掛金',
          amount: 10000000,
        } as any,
        {
          id: 'balance-2',
          companyId: mockCompanyId,
          fiscalYear: mockFiscalYear,
          month: mockClosingMonth,
          category: 'current_assets',
          accountName: '貸倒引当金',
          amount: 50000,
        } as any,
      ])

      const result = await generateClosingEntries(mockCompanyId, mockFiscalYear, mockClosingMonth)

      const allowanceEntry = result.find((e) => e.type === 'allowance_doubtful')
      expect(allowanceEntry).toBeDefined()
    })

    it('should handle zero receivables', async () => {
      vi.mocked(prisma.fixedAsset.findMany).mockResolvedValue([])

      vi.mocked(prisma.monthlyBalance.findMany).mockResolvedValue([])

      const result = await generateClosingEntries(mockCompanyId, mockFiscalYear, mockClosingMonth)

      const allowanceEntry = result.find((e) => e.type === 'allowance_doubtful')
      expect(allowanceEntry).toBeUndefined()
    })

    it('should generate accrued bonus entry', async () => {
      vi.mocked(prisma.fixedAsset.findMany).mockResolvedValue([])
      vi.mocked(prisma.monthlyBalance.findMany).mockResolvedValue([])

      const result = await generateClosingEntries(mockCompanyId, mockFiscalYear, mockClosingMonth)

      const bonusEntry = result.find((e) => e.type === 'accrued_bonus')
      expect(bonusEntry).toBeDefined()
    })

    it('should include correct fiscal year and month in entries', async () => {
      vi.mocked(prisma.fixedAsset.findMany).mockResolvedValue([
        {
          id: 'asset-1',
          companyId: mockCompanyId,
          name: '建物',
          acquisitionCost: 12000000,
          salvageValue: 0,
          usefulLife: 12,
          accumulatedDep: 0,
          bookValue: 12000000,
        } as any,
      ])

      vi.mocked(prisma.monthlyBalance.findMany).mockResolvedValue([])

      const result = await generateClosingEntries(mockCompanyId, mockFiscalYear, mockClosingMonth)

      expect(result.every((e) => e.fiscalYear === mockFiscalYear)).toBe(true)
      expect(result.every((e) => e.month === mockClosingMonth)).toBe(true)
    })

    it('should handle multiple assets', async () => {
      vi.mocked(prisma.fixedAsset.findMany).mockResolvedValue([
        {
          id: 'asset-1',
          companyId: mockCompanyId,
          name: '建物',
          acquisitionCost: 10000000,
          salvageValue: 0,
          usefulLife: 20,
          accumulatedDep: 0,
          bookValue: 10000000,
        } as any,
        {
          id: 'asset-2',
          companyId: mockCompanyId,
          name: '車両',
          acquisitionCost: 5000000,
          salvageValue: 0,
          usefulLife: 5,
          accumulatedDep: 0,
          bookValue: 5000000,
        } as any,
      ])

      vi.mocked(prisma.monthlyBalance.findMany).mockResolvedValue([])

      const result = await generateClosingEntries(mockCompanyId, mockFiscalYear, mockClosingMonth)

      const depreciationEntries = result.filter((e) => e.type === 'depreciation')
      expect(depreciationEntries).toHaveLength(2)
    })
  })

  describe('calculateTaxEffectAccounting', () => {
    it('should calculate deferred tax assets', async () => {
      vi.mocked(prisma.fixedAsset.findMany).mockResolvedValue([])

      vi.mocked(prisma.monthlyBalance.findMany).mockResolvedValue([
        {
          id: 'balance-1',
          companyId: mockCompanyId,
          fiscalYear: mockFiscalYear,
          month: 12,
          accountName: '貸倒引当金',
          amount: 1000000,
        } as any,
      ])

      vi.mocked(prisma.taxEffectAccounting.upsert).mockResolvedValue({
        id: 'tax-1',
        companyId: mockCompanyId,
        fiscalYear: mockFiscalYear,
        deferredTaxAsset: 300000,
        deferredTaxLiability: 0,
        netDeferredTax: 300000,
      } as any)

      const result = await calculateTaxEffectAccounting(mockCompanyId, mockFiscalYear)

      expect(result.fiscalYear).toBe(mockFiscalYear)
      expect(result.effectiveTaxRate).toBe(0.3)
    })

    it('should calculate deferred tax liabilities', async () => {
      vi.mocked(prisma.fixedAsset.findMany).mockResolvedValue([
        {
          id: 'asset-1',
          companyId: mockCompanyId,
          name: '建物',
          acquisitionCost: 10000000,
          salvageValue: 0,
          usefulLife: 20,
          accumulatedDep: 1000000,
          bookValue: 9000000,
        } as any,
      ])

      vi.mocked(prisma.monthlyBalance.findMany).mockResolvedValue([])

      vi.mocked(prisma.taxEffectAccounting.upsert).mockResolvedValue({
        id: 'tax-1',
        companyId: mockCompanyId,
        fiscalYear: mockFiscalYear,
        deferredTaxAsset: 0,
        deferredTaxLiability: 50000,
        netDeferredTax: -50000,
      } as any)

      const result = await calculateTaxEffectAccounting(mockCompanyId, mockFiscalYear)

      expect(result.timingDifferences.length).toBeGreaterThan(0)
    })

    it('should use custom effective tax rate', async () => {
      vi.mocked(prisma.fixedAsset.findMany).mockResolvedValue([])
      vi.mocked(prisma.monthlyBalance.findMany).mockResolvedValue([])

      vi.mocked(prisma.taxEffectAccounting.upsert).mockResolvedValue({
        id: 'tax-1',
        companyId: mockCompanyId,
        fiscalYear: mockFiscalYear,
        deferredTaxAsset: 0,
        deferredTaxLiability: 0,
        netDeferredTax: 0,
      } as any)

      const result = await calculateTaxEffectAccounting(mockCompanyId, mockFiscalYear, 0.25)

      expect(result.effectiveTaxRate).toBe(0.25)
    })

    it('should handle empty data', async () => {
      vi.mocked(prisma.fixedAsset.findMany).mockResolvedValue([])
      vi.mocked(prisma.monthlyBalance.findMany).mockResolvedValue([])

      vi.mocked(prisma.taxEffectAccounting.upsert).mockResolvedValue({
        id: 'tax-1',
        companyId: mockCompanyId,
        fiscalYear: mockFiscalYear,
        deferredTaxAsset: 0,
        deferredTaxLiability: 0,
        netDeferredTax: 0,
      } as any)

      const result = await calculateTaxEffectAccounting(mockCompanyId, mockFiscalYear)

      expect(result.deferredTaxAsset).toBe(0)
      expect(result.deferredTaxLiability).toBe(0)
    })
  })

  describe('getTaxEffectHistory', () => {
    it('should return tax effect history for range', async () => {
      vi.mocked(prisma.taxEffectAccounting.findMany).mockResolvedValue([
        {
          id: 'tax-1',
          companyId: mockCompanyId,
          fiscalYear: 2022,
          deferredTaxAsset: 100000,
          deferredTaxLiability: 0,
          netDeferredTax: 100000,
        },
        {
          id: 'tax-2',
          companyId: mockCompanyId,
          fiscalYear: 2023,
          deferredTaxAsset: 150000,
          deferredTaxLiability: 0,
          netDeferredTax: 150000,
        },
      ] as any)

      const result = await getTaxEffectHistory(mockCompanyId, 2022, 2023)

      expect(result).toHaveLength(2)
      expect(result[0].fiscalYear).toBe(2022)
      expect(result[1].fiscalYear).toBe(2023)
    })

    it('should return empty array for no records', async () => {
      vi.mocked(prisma.taxEffectAccounting.findMany).mockResolvedValue([])

      const result = await getTaxEffectHistory(mockCompanyId, 2020, 2021)

      expect(result).toHaveLength(0)
    })

    it('should order by fiscal year ascending', async () => {
      vi.mocked(prisma.taxEffectAccounting.findMany).mockResolvedValue([
        { fiscalYear: 2022 } as any,
        { fiscalYear: 2023 } as any,
      ])

      await getTaxEffectHistory(mockCompanyId, 2022, 2023)

      expect(prisma.taxEffectAccounting.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { fiscalYear: 'asc' },
        })
      )
    })
  })

  describe('generateTaxEffectJournalEntry', () => {
    it('should generate journal entry for deferred tax asset', () => {
      const taxEffect = {
        fiscalYear: 2024,
        timingDifferences: [],
        deferredTaxAsset: 300000,
        deferredTaxLiability: 0,
        netDeferredTax: 300000,
        effectiveTaxRate: 0.3,
      }

      const result = generateTaxEffectJournalEntry(taxEffect, 2024, 12)

      expect(result.type).toBe('tax_effect')
      expect(result.debitAccount).toBe('繰延税金資産')
      expect(result.creditAccount).toBe('法人税等調整額')
      expect(result.amount).toBe(300000)
    })

    it('should generate journal entry for deferred tax liability', () => {
      const taxEffect = {
        fiscalYear: 2024,
        timingDifferences: [],
        deferredTaxAsset: 0,
        deferredTaxLiability: 200000,
        netDeferredTax: -200000,
        effectiveTaxRate: 0.3,
      }

      const result = generateTaxEffectJournalEntry(taxEffect, 2024, 12)

      expect(result.debitAccount).toBe('法人税等調整額')
      expect(result.creditAccount).toBe('繰延税金負債')
      expect(result.amount).toBe(200000)
    })

    it('should handle zero net deferred tax', () => {
      const taxEffect = {
        fiscalYear: 2024,
        timingDifferences: [],
        deferredTaxAsset: 0,
        deferredTaxLiability: 0,
        netDeferredTax: 0,
        effectiveTaxRate: 0.3,
      }

      const result = generateTaxEffectJournalEntry(taxEffect, 2024, 12)

      expect(result.amount).toBe(0)
    })
  })

  describe('checkPrepaidExpenses', () => {
    it('should detect prepaid expenses', async () => {
      vi.mocked(prisma.monthlyBalance.findMany).mockResolvedValue([
        {
          id: 'balance-1',
          companyId: mockCompanyId,
          fiscalYear: mockFiscalYear,
          month: mockClosingMonth,
          category: 'current_assets',
          accountName: '前払保険料',
          amount: 120000,
        } as any,
      ])

      const result = await checkPrepaidExpenses(mockCompanyId, mockFiscalYear, mockClosingMonth)

      expect(result.length).toBeGreaterThan(0)
      expect(result[0].accountName).toBe('前払保険料')
      expect(result[0].monthlyAmortization).toBe(10000)
    })

    it('should detect prepaid lease', async () => {
      vi.mocked(prisma.monthlyBalance.findMany).mockResolvedValue([
        {
          id: 'balance-1',
          companyId: mockCompanyId,
          fiscalYear: mockFiscalYear,
          month: mockClosingMonth,
          category: 'current_assets',
          accountName: '前払リース料',
          amount: 600000,
        } as any,
      ])

      const result = await checkPrepaidExpenses(mockCompanyId, mockFiscalYear, mockClosingMonth)

      expect(result.length).toBeGreaterThan(0)
      expect(result[0].suggestedTreatment).toContain('月次経理')
    })

    it('should return empty array when no prepaid expenses', async () => {
      vi.mocked(prisma.monthlyBalance.findMany).mockResolvedValue([
        {
          id: 'balance-1',
          companyId: mockCompanyId,
          fiscalYear: mockFiscalYear,
          month: mockClosingMonth,
          category: 'current_assets',
          accountName: '現金',
          amount: 1000000,
        } as any,
      ])

      const result = await checkPrepaidExpenses(mockCompanyId, mockFiscalYear, mockClosingMonth)

      expect(result).toHaveLength(0)
    })

    it('should ignore zero amount prepaid expenses', async () => {
      vi.mocked(prisma.monthlyBalance.findMany).mockResolvedValue([
        {
          id: 'balance-1',
          companyId: mockCompanyId,
          fiscalYear: mockFiscalYear,
          month: mockClosingMonth,
          category: 'current_assets',
          accountName: '前払保険料',
          amount: 0,
        } as any,
      ])

      const result = await checkPrepaidExpenses(mockCompanyId, mockFiscalYear, mockClosingMonth)

      expect(result).toHaveLength(0)
    })
  })
})
