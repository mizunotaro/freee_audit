import { describe, it, expect, beforeEach } from 'vitest'
import { FinancialInstrumentAdjustment } from '@/services/conversion/adjustments/financial-instrument'
import type { SourceFinancialData } from '@/services/conversion/adjustments/types'

const createSourceData = (overrides: Partial<SourceFinancialData> = {}): SourceFinancialData => ({
  balanceSheet: {
    assets: {
      current: [],
      fixed: [{ code: '1600', name: '投資有価証券', amount: 10000000 }],
    },
    liabilities: {
      current: [],
      fixed: [],
    },
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
    operatingIncome: 0,
    netIncome: 0,
  },
  journals: [],
  fixedAssets: [],
  debts: [],
  ...overrides,
})

describe('FinancialInstrumentAdjustment', () => {
  let adjustment: FinancialInstrumentAdjustment

  beforeEach(() => {
    adjustment = new FinancialInstrumentAdjustment()
  })

  describe('properties', () => {
    it('has correct type', () => {
      expect(adjustment.type).toBe('financial_instrument')
    })

    it('has correct name', () => {
      expect(adjustment.name).toBe('金融商品の調整')
    })
  })

  describe('isApplicable', () => {
    it('returns true when 投資有価証券 exists', () => {
      const data = createSourceData()
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(true)
    })

    it('returns true when その他有価証券 exists', () => {
      const data = createSourceData({
        balanceSheet: {
          assets: {
            current: [],
            fixed: [{ code: '1601', name: 'その他有価証券', amount: 5000000 }],
          },
          liabilities: { current: [], fixed: [] },
          equity: [],
          totalAssets: 5000000,
          totalLiabilities: 0,
          totalEquity: 0,
        },
      })
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(true)
    })

    it('returns true when デリバティブ exists in assets', () => {
      const data = createSourceData({
        balanceSheet: {
          assets: {
            current: [{ code: '1690', name: 'デリバティブ資産', amount: 2000000 }],
            fixed: [],
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

    it('returns true when Investment Securities (English) exists', () => {
      const data = createSourceData({
        balanceSheet: {
          assets: {
            current: [],
            fixed: [{ code: '1602', name: 'Investment Securities', amount: 3000000 }],
          },
          liabilities: { current: [], fixed: [] },
          equity: [],
          totalAssets: 3000000,
          totalLiabilities: 0,
          totalEquity: 0,
        },
      })
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(true)
    })

    it('returns true when code starts with 16', () => {
      const data = createSourceData({
        balanceSheet: {
          assets: { current: [], fixed: [{ code: '1600', name: '投資', amount: 3000000 }] },
          liabilities: { current: [], fixed: [] },
          equity: [],
          totalAssets: 3000000,
          totalLiabilities: 0,
          totalEquity: 0,
        },
      })
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(true)
    })

    it('returns true when 社債 liability exists', () => {
      const data = createSourceData({
        balanceSheet: {
          assets: { current: [], fixed: [] },
          liabilities: {
            current: [{ code: '4300', name: '社債', amount: 5000000 }],
            fixed: [],
          },
          equity: [],
          totalAssets: 0,
          totalLiabilities: 5000000,
          totalEquity: 0,
        },
      })
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(true)
    })

    it('returns true when 借入金 liability exists', () => {
      const data = createSourceData({
        balanceSheet: {
          assets: { current: [], fixed: [] },
          liabilities: {
            current: [{ code: '4400', name: '短期借入金', amount: 5000000 }],
            fixed: [],
          },
          equity: [],
          totalAssets: 0,
          totalLiabilities: 5000000,
          totalEquity: 0,
        },
      })
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(true)
    })

    it('returns true when Derivative liability exists', () => {
      const data = createSourceData({
        balanceSheet: {
          assets: { current: [], fixed: [] },
          liabilities: {
            current: [],
            fixed: [{ code: '4800', name: 'Derivative Liability', amount: 3000000 }],
          },
          equity: [],
          totalAssets: 0,
          totalLiabilities: 3000000,
          totalEquity: 0,
        },
      })
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(true)
    })

    it('returns false when no financial instrument accounts exist', () => {
      const data = createSourceData({
        balanceSheet: {
          assets: { current: [{ code: '1100', name: '現金預金', amount: 10000000 }], fixed: [] },
          liabilities: { current: [], fixed: [] },
          equity: [],
          totalAssets: 10000000,
          totalLiabilities: 0,
          totalEquity: 0,
        },
      })
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(false)
    })
  })

  describe('calculate', () => {
    it('returns entry with fair value adjustments for investment securities', async () => {
      const data = createSourceData()
      const entry = await adjustment.calculate('project-1', data, 'IFRS')

      expect(entry).not.toBeNull()
      expect(entry!.projectId).toBe('project-1')
      expect(entry!.type).toBe('financial_instrument')
      expect(entry!.lines.length).toBeGreaterThanOrEqual(2)
    })

    it('creates asset appreciation lines with debit on valuation account', async () => {
      const data = createSourceData()
      const entry = await adjustment.calculate('project-1', data, 'IFRS')

      const valuationLine = entry!.lines.find((l) => l.accountCode === '1690')
      expect(valuationLine).toBeDefined()
      expect(valuationLine!.debit).toBeGreaterThan(0)
    })

    it('returns null when no financial instruments exist', async () => {
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

    it('handles derivatives in current assets', async () => {
      const data = createSourceData({
        balanceSheet: {
          assets: {
            current: [{ code: '1691', name: 'デリバティブ', amount: 5000000 }],
            fixed: [],
          },
          liabilities: { current: [], fixed: [] },
          equity: [],
          totalAssets: 5000000,
          totalLiabilities: 0,
          totalEquity: 0,
        },
      })
      const entry = await adjustment.calculate('project-1', data, 'IFRS')
      expect(entry).not.toBeNull()
    })

    it('handles derivatives in current liabilities', async () => {
      const data = createSourceData({
        balanceSheet: {
          assets: { current: [], fixed: [] },
          liabilities: {
            current: [{ code: '4900', name: 'デリバティブ負債', amount: 3000000 }],
            fixed: [],
          },
          equity: [],
          totalAssets: 0,
          totalLiabilities: 3000000,
          totalEquity: 0,
        },
      })
      const entry = await adjustment.calculate('project-1', data, 'IFRS')
      expect(entry).not.toBeNull()
    })

    it('handles USGAAP target standard', async () => {
      const data = createSourceData()
      const entry = await adjustment.calculate('project-1', data, 'USGAAP')
      expect(entry).not.toBeNull()
      expect(entry!.usgaapReference).toBe('ASC 320/825 Financial Instruments')
    })

    it('generates unique IDs', async () => {
      const data = createSourceData()
      const entry1 = await adjustment.calculate('project-1', data, 'IFRS')
      const entry2 = await adjustment.calculate('project-1', data, 'IFRS')
      expect(entry1!.id).not.toBe(entry2!.id)
    })

    it('produces correct descriptions', async () => {
      const data = createSourceData()
      const entry = await adjustment.calculate('project-1', data, 'IFRS')

      expect(entry!.description).toBe('金融商品の公正価値評価調整')
      expect(entry!.descriptionEn).toBe(
        'Fair value measurement adjustment for financial instruments'
      )
    })
  })

  describe('getReference', () => {
    it('returns IFRS 9 for IFRS', () => {
      expect(adjustment.getReference('IFRS')).toBe('IFRS 9 Financial Instruments')
    })

    it('returns ASC 320/825 for USGAAP', () => {
      expect(adjustment.getReference('USGAAP')).toBe('ASC 320/825 Financial Instruments')
    })
  })
})
