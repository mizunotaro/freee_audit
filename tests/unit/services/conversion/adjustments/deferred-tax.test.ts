import { describe, it, expect, beforeEach } from 'vitest'
import { DeferredTaxAdjustment } from '@/services/conversion/adjustments/deferred-tax'
import type { SourceFinancialData } from '@/services/conversion/adjustments/types'

const createSourceData = (overrides: Partial<SourceFinancialData> = {}): SourceFinancialData => ({
  balanceSheet: {
    assets: {
      current: [{ code: '1650', name: '繰延税金資産', amount: 3000000 }],
      fixed: [],
    },
    liabilities: {
      current: [],
      fixed: [{ code: '5310', name: '退職給付引当金', amount: 5000000 }],
    },
    equity: [{ code: '6100', name: '資本金', amount: 10000000 }],
    totalAssets: 3000000,
    totalLiabilities: 5000000,
    totalEquity: 10000000,
  },
  profitLoss: {
    revenue: [{ code: '7100', name: '売上高', amount: 100000000 }],
    costOfSales: [],
    sgaExpenses: [],
    nonOperatingIncome: [],
    nonOperatingExpenses: [],
    grossProfit: 40000000,
    operatingIncome: 15000000,
    netIncome: 10000000,
  },
  journals: [],
  fixedAssets: [
    {
      id: 'fa-1',
      code: '2100',
      name: '建物',
      acquisitionCost: 50000000,
      accumulatedDepreciation: 20000000,
      netBookValue: 30000000,
      usefulLife: 30,
      acquisitionDate: new Date('2020-01-01'),
      depreciationMethod: 'straight-line',
    },
  ],
  debts: [],
  ...overrides,
})

describe('DeferredTaxAdjustment', () => {
  let adjustment: DeferredTaxAdjustment

  beforeEach(() => {
    adjustment = new DeferredTaxAdjustment()
  })

  describe('properties', () => {
    it('has correct type', () => {
      expect(adjustment.type).toBe('deferred_tax')
    })

    it('has correct name', () => {
      expect(adjustment.name).toBe('繰延税金会計の調整')
    })
  })

  describe('isApplicable', () => {
    it('returns true when 繰延税金 asset exists', () => {
      const data = createSourceData()
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(true)
    })

    it('returns true when Deferred Tax (English) exists', () => {
      const data = createSourceData({
        balanceSheet: {
          assets: {
            current: [],
            fixed: [{ code: '1651', name: 'Deferred Tax Asset', amount: 2000000 }],
          },
          liabilities: { current: [], fixed: [] },
          equity: [],
          totalAssets: 2000000,
          totalLiabilities: 0,
          totalEquity: 0,
        },
      })
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(true)
    })

    it('returns true when code starts with 165', () => {
      const data = createSourceData({
        balanceSheet: {
          assets: { current: [{ code: '1650', name: 'その他', amount: 1000000 }], fixed: [] },
          liabilities: { current: [], fixed: [] },
          equity: [],
          totalAssets: 1000000,
          totalLiabilities: 0,
          totalEquity: 0,
        },
      })
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(true)
    })

    it('returns true when code starts with 465', () => {
      const data = createSourceData({
        balanceSheet: {
          assets: { current: [], fixed: [] },
          liabilities: {
            current: [],
            fixed: [{ code: '4650', name: '繰延税金負債', amount: 2000000 }],
          },
          equity: [],
          totalAssets: 0,
          totalLiabilities: 2000000,
          totalEquity: 0,
        },
      })
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(true)
    })

    it('returns false when no deferred tax accounts exist', () => {
      const data = createSourceData({
        balanceSheet: {
          assets: { current: [{ code: '1100', name: '現金預金', amount: 10000000 }], fixed: [] },
          liabilities: { current: [], fixed: [] },
          equity: [],
          totalAssets: 10000000,
          totalLiabilities: 0,
          totalEquity: 0,
        },
        fixedAssets: [],
      })
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(false)
    })
  })

  describe('calculate', () => {
    it('returns entry with deferred tax adjustments for retirement liability', async () => {
      const data = createSourceData()
      const entry = await adjustment.calculate('project-1', data, 'IFRS')

      expect(entry).not.toBeNull()
      expect(entry!.projectId).toBe('project-1')
      expect(entry!.type).toBe('deferred_tax')
      expect(entry!.ifrsReference).toBe('IAS 12 Income Taxes')
      expect(entry!.usgaapReference).toBe('ASC 740 Income Taxes')
    })

    it('returns entry with at least 2 lines', async () => {
      const data = createSourceData()
      const entry = await adjustment.calculate('project-1', data, 'IFRS')

      expect(entry).not.toBeNull()
      expect(entry!.lines.length).toBeGreaterThanOrEqual(2)
    })

    it('returns null when no temporary differences exist', async () => {
      const data = createSourceData({
        balanceSheet: {
          assets: { current: [], fixed: [] },
          liabilities: { current: [], fixed: [] },
          equity: [],
          totalAssets: 0,
          totalLiabilities: 0,
          totalEquity: 0,
        },
        fixedAssets: [],
      })
      const entry = await adjustment.calculate('project-1', data, 'IFRS')
      expect(entry).toBeNull()
    })

    it('identifies temporary differences from fixed assets with depreciation gap', async () => {
      const data = createSourceData({
        balanceSheet: {
          assets: {
            current: [{ code: '1650', name: '繰延税金資産', amount: 3000000 }],
            fixed: [],
          },
          liabilities: { current: [], fixed: [] },
          equity: [],
          totalAssets: 3000000,
          totalLiabilities: 0,
          totalEquity: 0,
        },
        fixedAssets: [
          {
            id: 'fa-1',
            code: '2100',
            name: '建物',
            acquisitionCost: 50000000,
            accumulatedDepreciation: 20000000,
            netBookValue: 15000000,
            usefulLife: 30,
            acquisitionDate: new Date('2020-01-01'),
            depreciationMethod: 'straight-line',
          },
        ],
      })
      const entry = await adjustment.calculate('project-1', data, 'IFRS')

      expect(entry).not.toBeNull()
    })

    it('handles USGAAP target standard', async () => {
      const data = createSourceData()
      const entry = await adjustment.calculate('project-1', data, 'USGAAP')

      expect(entry).not.toBeNull()
      expect(entry!.usgaapReference).toBe('ASC 740 Income Taxes')
    })

    it('generates unique IDs', async () => {
      const data = createSourceData()
      const entry1 = await adjustment.calculate('project-1', data, 'IFRS')
      const entry2 = await adjustment.calculate('project-1', data, 'IFRS')
      expect(entry1!.id).not.toBe(entry2!.id)
    })

    it('produces correct description', async () => {
      const data = createSourceData()
      const entry = await adjustment.calculate('project-1', data, 'IFRS')

      expect(entry!.description).toBe('繰延税金資産・負債の調整')
      expect(entry!.descriptionEn).toBe('Adjustment for deferred tax assets and liabilities')
    })

    it('handles retirement liability creating deductible temporary difference', async () => {
      const data = createSourceData({
        balanceSheet: {
          assets: { current: [], fixed: [] },
          liabilities: {
            current: [],
            fixed: [
              { code: '5310', name: '退職給付引当金', amount: 10000000 },
              { code: '5311', name: '年金債務', amount: 5000000 },
            ],
          },
          equity: [],
          totalAssets: 0,
          totalLiabilities: 15000000,
          totalEquity: 0,
        },
        fixedAssets: [],
      })
      const entry = await adjustment.calculate('project-1', data, 'IFRS')

      expect(entry).not.toBeNull()
      const dtaLine = entry!.lines.find((l) => l.accountCode === '1650')
      expect(dtaLine).toBeDefined()
    })

    it('skips small temporary differences below threshold', async () => {
      const data = createSourceData({
        balanceSheet: {
          assets: { current: [], fixed: [] },
          liabilities: { current: [], fixed: [] },
          equity: [],
          totalAssets: 0,
          totalLiabilities: 0,
          totalEquity: 0,
        },
        fixedAssets: [
          {
            id: 'fa-1',
            code: '2100',
            name: '建物',
            acquisitionCost: 1000,
            accumulatedDepreciation: 0,
            netBookValue: 1000,
            usefulLife: 30,
            acquisitionDate: new Date('2020-01-01'),
            depreciationMethod: 'straight-line',
          },
        ],
      })
      const entry = await adjustment.calculate('project-1', data, 'IFRS')
      expect(entry).toBeNull()
    })
  })

  describe('getReference', () => {
    it('returns IAS 12 for IFRS', () => {
      expect(adjustment.getReference('IFRS')).toBe('IAS 12 Income Taxes')
    })

    it('returns ASC 740 for USGAAP', () => {
      expect(adjustment.getReference('USGAAP')).toBe('ASC 740 Income Taxes')
    })
  })
})
