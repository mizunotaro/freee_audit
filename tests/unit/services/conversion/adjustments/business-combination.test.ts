import { describe, it, expect, beforeEach } from 'vitest'
import { BusinessCombinationAdjustment } from '@/services/conversion/adjustments/business-combination'
import type { SourceFinancialData } from '@/services/conversion/adjustments/types'

const createSourceData = (overrides: Partial<SourceFinancialData> = {}): SourceFinancialData => ({
  balanceSheet: {
    assets: {
      current: [],
      fixed: [
        { code: '2600', name: 'のれん', amount: 10000000 },
        { code: '2500', name: '無形固定資産', amount: 5000000 },
      ],
    },
    liabilities: {
      current: [],
      fixed: [],
    },
    equity: [{ code: '6100', name: '資本金', amount: 10000000 }],
    totalAssets: 15000000,
    totalLiabilities: 0,
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
  fixedAssets: [],
  debts: [],
  ...overrides,
})

describe('BusinessCombinationAdjustment', () => {
  let adjustment: BusinessCombinationAdjustment

  beforeEach(() => {
    adjustment = new BusinessCombinationAdjustment()
  })

  describe('properties', () => {
    it('has correct type', () => {
      expect(adjustment.type).toBe('business_combination')
    })

    it('has correct name', () => {
      expect(adjustment.name).toBe('企業結合の調整')
    })

    it('has correct description', () => {
      expect(adjustment.description).toBe('企業結合に伴う資産・負債の認識調整')
    })
  })

  describe('isApplicable', () => {
    it('returns true when goodwill exists in fixed assets', () => {
      const data = createSourceData()
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(true)
    })

    it('returns true when goodwill exists in current assets', () => {
      const data = createSourceData({
        balanceSheet: {
          assets: {
            current: [{ code: '2600', name: 'のれん', amount: 5000000 }],
            fixed: [],
          },
          liabilities: { current: [], fixed: [] },
          equity: [],
          totalAssets: 5000000,
          totalLiabilities: 0,
          totalEquity: 0,
        },
      })
      expect(adjustment.isApplicable(data, 'USGAAP')).toBe(true)
    })

    it('returns true when 営業権 exists', () => {
      const data = createSourceData({
        balanceSheet: {
          assets: { current: [], fixed: [{ code: '2610', name: '営業権', amount: 3000000 }] },
          liabilities: { current: [], fixed: [] },
          equity: [],
          totalAssets: 3000000,
          totalLiabilities: 0,
          totalEquity: 0,
        },
      })
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(true)
    })

    it('returns true when Goodwill (English) exists', () => {
      const data = createSourceData({
        balanceSheet: {
          assets: { current: [], fixed: [{ code: '2620', name: 'Goodwill', amount: 3000000 }] },
          liabilities: { current: [], fixed: [] },
          equity: [],
          totalAssets: 3000000,
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

    it('returns true when negative goodwill exists', () => {
      const data = createSourceData({
        balanceSheet: {
          assets: { current: [], fixed: [] },
          liabilities: {
            current: [{ code: '4900', name: '負ののれん', amount: 2000000 }],
            fixed: [],
          },
          equity: [],
          totalAssets: 0,
          totalLiabilities: 2000000,
          totalEquity: 0,
        },
      })
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(true)
    })

    it('returns true when Negative Goodwill (English) exists', () => {
      const data = createSourceData({
        balanceSheet: {
          assets: { current: [], fixed: [] },
          liabilities: {
            current: [{ code: '4901', name: 'Negative Goodwill', amount: 2000000 }],
            fixed: [],
          },
          equity: [],
          totalAssets: 0,
          totalLiabilities: 2000000,
          totalEquity: 0,
        },
      })
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(true)
    })

    it('returns false when no goodwill-related accounts exist', () => {
      const data = createSourceData({
        balanceSheet: {
          assets: {
            current: [{ code: '1100', name: '現金預金', amount: 10000000 }],
            fixed: [{ code: '2100', name: '建物', amount: 30000000 }],
          },
          liabilities: { current: [], fixed: [] },
          equity: [],
          totalAssets: 40000000,
          totalLiabilities: 0,
          totalEquity: 0,
        },
      })
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(false)
    })
  })

  describe('calculate', () => {
    it('returns entry with goodwill and intangible asset adjustments', async () => {
      const data = createSourceData()
      const entry = await adjustment.calculate('project-1', data, 'IFRS')

      expect(entry).not.toBeNull()
      expect(entry!.projectId).toBe('project-1')
      expect(entry!.type).toBe('business_combination')
      expect(entry!.lines.length).toBeGreaterThanOrEqual(2)
      expect(entry!.ifrsReference).toBe('IFRS 3 Business Combinations')
      expect(entry!.usgaapReference).toBe('ASC 805 Business Combinations')
      expect(entry!.aiSuggested).toBe(false)
      expect(entry!.isApproved).toBe(false)
    })

    it('returns entry with correct debit and credit lines for positive adjustments', async () => {
      const data = createSourceData()
      const entry = await adjustment.calculate('project-1', data, 'IFRS')

      const goodwillLine = entry!.lines.find((l) => l.accountCode === '2600')
      expect(goodwillLine).toBeDefined()
      expect(goodwillLine!.debit).toBeGreaterThan(0)
      expect(goodwillLine!.credit).toBe(0)
    })

    it('returns null when no goodwill or intangible assets exist', async () => {
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

    it('returns null when goodwill amount is zero', async () => {
      const data = createSourceData({
        balanceSheet: {
          assets: {
            current: [],
            fixed: [
              { code: '2600', name: 'のれん', amount: 0 },
              { code: '2500', name: '無形固定資産', amount: 0 },
            ],
          },
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

    it('handles USGAAP target standard', async () => {
      const data = createSourceData()
      const entry = await adjustment.calculate('project-1', data, 'USGAAP')

      expect(entry).not.toBeNull()
      expect(entry!.usgaapReference).toBe('ASC 805 Business Combinations')
    })

    it('generates unique IDs for each entry', async () => {
      const data = createSourceData()
      const entry1 = await adjustment.calculate('project-1', data, 'IFRS')
      const entry2 = await adjustment.calculate('project-1', data, 'IFRS')

      expect(entry1!.id).not.toBe(entry2!.id)
    })

    it('balances debit and credit in generated entry', async () => {
      const data = createSourceData()
      const entry = await adjustment.calculate('project-1', data, 'IFRS')

      const totalDebit = entry!.lines.reduce((sum, l) => sum + l.debit, 0)
      const totalCredit = entry!.lines.reduce((sum, l) => sum + l.credit, 0)
      expect(Math.abs(totalDebit - totalCredit)).toBeLessThanOrEqual(0.01)
    })

    it('handles negative goodwill (bargain purchase)', async () => {
      const data = createSourceData({
        balanceSheet: {
          assets: { current: [], fixed: [{ code: '2600', name: 'のれん', amount: -5000000 }] },
          liabilities: { current: [], fixed: [] },
          equity: [],
          totalAssets: -5000000,
          totalLiabilities: 0,
          totalEquity: 0,
        },
      })
      const entry = await adjustment.calculate('project-1', data, 'IFRS')

      if (entry) {
        const bargainGainLine = entry.lines.find((l) => l.accountCode === '9800')
        expect(bargainGainLine).toBeDefined()
        expect(bargainGainLine!.credit).toBeGreaterThan(0)
      }
    })

    it('produces entry with correct description', async () => {
      const data = createSourceData()
      const entry = await adjustment.calculate('project-1', data, 'IFRS')

      expect(entry!.description).toBe('企業結合時点での資産・負債の公正価値評価調整')
      expect(entry!.descriptionEn).toBe(
        'Fair value measurement adjustment for assets and liabilities at acquisition date'
      )
    })
  })

  describe('getReference', () => {
    it('returns IFRS 3 for IFRS', () => {
      expect(adjustment.getReference('IFRS')).toBe('IFRS 3 Business Combinations')
    })

    it('returns ASC 805 for USGAAP', () => {
      expect(adjustment.getReference('USGAAP')).toBe('ASC 805 Business Combinations')
    })
  })
})
