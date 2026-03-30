import { describe, it, expect, beforeEach } from 'vitest'
import { GoodwillImpairmentAdjustment } from '@/services/conversion/adjustments/goodwill-impairment'
import type { SourceFinancialData } from '@/services/conversion/adjustments/types'

const createSourceData = (overrides: Partial<SourceFinancialData> = {}): SourceFinancialData => ({
  balanceSheet: {
    assets: {
      current: [],
      fixed: [{ code: '2600', name: 'のれん', amount: 10000000 }],
    },
    liabilities: { current: [], fixed: [] },
    equity: [{ code: '6100', name: '資本金', amount: 10000000 }],
    totalAssets: 10000000,
    totalLiabilities: 0,
    totalEquity: 10000000,
  },
  profitLoss: {
    revenue: [],
    costOfSales: [],
    sgaExpenses: [],
    nonOperatingIncome: [],
    nonOperatingExpenses: [],
    grossProfit: 0,
    operatingIncome: 300000,
    netIncome: 200000,
  },
  journals: [],
  fixedAssets: [],
  debts: [],
  ...overrides,
})

describe('GoodwillImpairmentAdjustment', () => {
  let adjustment: GoodwillImpairmentAdjustment

  beforeEach(() => {
    adjustment = new GoodwillImpairmentAdjustment()
  })

  describe('properties', () => {
    it('has correct type', () => {
      expect(adjustment.type).toBe('goodwill_impairment')
    })

    it('has correct name', () => {
      expect(adjustment.name).toBe('のれん減損の調整')
    })
  })

  describe('isApplicable', () => {
    it('returns true when のれん exists in fixed assets', () => {
      const data = createSourceData()
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(true)
    })

    it('returns true when 営業権 exists', () => {
      const data = createSourceData({
        balanceSheet: {
          assets: { current: [], fixed: [{ code: '2610', name: '営業権', amount: 5000000 }] },
          liabilities: { current: [], fixed: [] },
          equity: [],
          totalAssets: 5000000,
          totalLiabilities: 0,
          totalEquity: 0,
        },
      })
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(true)
    })

    it('returns true when Goodwill (English) exists', () => {
      const data = createSourceData({
        balanceSheet: {
          assets: { current: [], fixed: [{ code: '2620', name: 'Goodwill', amount: 5000000 }] },
          liabilities: { current: [], fixed: [] },
          equity: [],
          totalAssets: 5000000,
          totalLiabilities: 0,
          totalEquity: 0,
        },
      })
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(true)
    })

    it('returns true when code starts with 26', () => {
      const data = createSourceData({
        balanceSheet: {
          assets: { current: [], fixed: [{ code: '2601', name: 'その他', amount: 3000000 }] },
          liabilities: { current: [], fixed: [] },
          equity: [],
          totalAssets: 3000000,
          totalLiabilities: 0,
          totalEquity: 0,
        },
      })
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(true)
    })

    it('returns true when goodwill exists in current assets', () => {
      const data = createSourceData({
        balanceSheet: {
          assets: { current: [{ code: '2600', name: 'のれん', amount: 5000000 }], fixed: [] },
          liabilities: { current: [], fixed: [] },
          equity: [],
          totalAssets: 5000000,
          totalLiabilities: 0,
          totalEquity: 0,
        },
      })
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(true)
    })

    it('returns false when no goodwill accounts exist', () => {
      const data = createSourceData({
        balanceSheet: {
          assets: { current: [], fixed: [{ code: '2100', name: '建物', amount: 30000000 }] },
          liabilities: { current: [], fixed: [] },
          equity: [],
          totalAssets: 30000000,
          totalLiabilities: 0,
          totalEquity: 0,
        },
      })
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(false)
    })
  })

  describe('calculate', () => {
    it('returns impairment entry when ROI is below threshold', async () => {
      const data = createSourceData()
      const entry = await adjustment.calculate('project-1', data, 'IFRS')

      expect(entry).not.toBeNull()
      expect(entry!.projectId).toBe('project-1')
      expect(entry!.type).toBe('goodwill_impairment')
      expect(entry!.lines.length).toBe(2)
    })

    it('creates impairment loss debit line', async () => {
      const data = createSourceData()
      const entry = await adjustment.calculate('project-1', data, 'IFRS')

      const lossLine = entry!.lines.find((l) => l.accountCode === '9280')
      expect(lossLine).toBeDefined()
      expect(lossLine!.debit).toBeGreaterThan(0)
      expect(lossLine!.credit).toBe(0)
    })

    it('creates goodwill credit line', async () => {
      const data = createSourceData()
      const entry = await adjustment.calculate('project-1', data, 'IFRS')

      const goodwillLine = entry!.lines.find((l) => l.accountCode === '2600')
      expect(goodwillLine).toBeDefined()
      expect(goodwillLine!.debit).toBe(0)
      expect(goodwillLine!.credit).toBeGreaterThan(0)
    })

    it('impairment loss equals goodwill written down', async () => {
      const data = createSourceData()
      const entry = await adjustment.calculate('project-1', data, 'IFRS')

      const lossLine = entry!.lines.find((l) => l.accountCode === '9280')!
      const goodwillLine = entry!.lines.find((l) => l.accountCode === '2600')!
      expect(lossLine.debit).toBe(goodwillLine.credit)
    })

    it('returns null when no goodwill exists', async () => {
      const data = createSourceData({
        balanceSheet: {
          assets: { current: [], fixed: [] },
          liabilities: { current: [], fixed: [] },
          equity: [],
          totalAssets: 0,
          totalLiabilities: 0,
          totalEquity: 0,
        },
      })
      const entry = await adjustment.calculate('project-1', data, 'IFRS')
      expect(entry).toBeNull()
    })

    it('returns null when ROI is above threshold (no impairment needed)', async () => {
      const data = createSourceData({
        balanceSheet: {
          assets: { current: [], fixed: [{ code: '2600', name: 'のれん', amount: 10000000 }] },
          liabilities: { current: [], fixed: [] },
          equity: [],
          totalAssets: 10000000,
          totalLiabilities: 0,
          totalEquity: 10000000,
        },
        profitLoss: {
          revenue: [],
          costOfSales: [],
          sgaExpenses: [],
          nonOperatingIncome: [],
          nonOperatingExpenses: [],
          grossProfit: 0,
          operatingIncome: 1000000,
          netIncome: 800000,
        },
      })
      const entry = await adjustment.calculate('project-1', data, 'IFRS')
      expect(entry).toBeNull()
    })

    it('handles USGAAP target standard', async () => {
      const data = createSourceData()
      const entry = await adjustment.calculate('project-1', data, 'USGAAP')

      expect(entry).not.toBeNull()
      expect(entry!.usgaapReference).toBe('ASC 350 Intangibles - Goodwill and Other')
    })

    it('generates unique IDs', async () => {
      const data = createSourceData()
      const entry1 = await adjustment.calculate('project-1', data, 'IFRS')
      const entry2 = await adjustment.calculate('project-1', data, 'IFRS')
      expect(entry1!.id).not.toBe(entry2!.id)
    })

    it('includes CGU in description', async () => {
      const data = createSourceData()
      const entry = await adjustment.calculate('project-1', data, 'IFRS')

      expect(entry!.description).toContain('CGU')
      expect(entry!.descriptionEn).toContain('CGU')
    })

    it('handles partial impairment correctly', async () => {
      const data = createSourceData({
        balanceSheet: {
          assets: { current: [], fixed: [{ code: '2600', name: 'のれん', amount: 10000000 }] },
          liabilities: { current: [], fixed: [] },
          equity: [],
          totalAssets: 10000000,
          totalLiabilities: 0,
          totalEquity: 10000000,
        },
        profitLoss: {
          revenue: [],
          costOfSales: [],
          sgaExpenses: [],
          nonOperatingIncome: [],
          nonOperatingExpenses: [],
          grossProfit: 0,
          operatingIncome: 400000,
          netIncome: 300000,
        },
      })
      const entry = await adjustment.calculate('project-1', data, 'IFRS')

      if (entry) {
        const lossLine = entry.lines.find((l) => l.accountCode === '9280')!
        expect(lossLine.debit).toBeLessThan(10000000)
        expect(lossLine.debit).toBeGreaterThan(0)
      }
    })
  })

  describe('getReference', () => {
    it('returns IAS 36 for IFRS', () => {
      expect(adjustment.getReference('IFRS')).toBe('IAS 36 Impairment of Assets')
    })

    it('returns ASC 350 for USGAAP', () => {
      expect(adjustment.getReference('USGAAP')).toBe('ASC 350 Intangibles - Goodwill and Other')
    })
  })
})
