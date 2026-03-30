import { describe, it, expect, beforeEach } from 'vitest'
import { ForeignCurrencyAdjustment } from '@/services/conversion/adjustments/foreign-currency'
import type { SourceFinancialData } from '@/services/conversion/adjustments/types'

const createSourceData = (overrides: Partial<SourceFinancialData> = {}): SourceFinancialData => ({
  balanceSheet: {
    assets: {
      current: [{ code: '1350', name: '外貨建預金', amount: 15000000 }],
      fixed: [],
    },
    liabilities: {
      current: [{ code: '4550', name: '外貨建買掛金', amount: 7500000 }],
      fixed: [],
    },
    equity: [{ code: '6100', name: '資本金', amount: 10000000 }],
    totalAssets: 15000000,
    totalLiabilities: 7500000,
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

describe('ForeignCurrencyAdjustment', () => {
  let adjustment: ForeignCurrencyAdjustment

  beforeEach(() => {
    adjustment = new ForeignCurrencyAdjustment()
  })

  describe('properties', () => {
    it('has correct type', () => {
      expect(adjustment.type).toBe('foreign_currency')
    })

    it('has correct name', () => {
      expect(adjustment.name).toBe('外貨換算の調整')
    })
  })

  describe('isApplicable', () => {
    it('returns true when 外貨 asset exists', () => {
      const data = createSourceData()
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(true)
    })

    it('returns true when Foreign currency account exists', () => {
      const data = createSourceData({
        balanceSheet: {
          assets: {
            current: [{ code: '1351', name: 'Foreign Currency Deposit', amount: 5000000 }],
            fixed: [],
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

    it('returns true when USD account exists', () => {
      const data = createSourceData({
        balanceSheet: {
          assets: { current: [{ code: '1352', name: 'USD預金', amount: 5000000 }], fixed: [] },
          liabilities: { current: [], fixed: [] },
          equity: [],
          totalAssets: 5000000,
          totalLiabilities: 0,
          totalEquity: 0,
        },
      })
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(true)
    })

    it('returns true when EUR account exists', () => {
      const data = createSourceData({
        balanceSheet: {
          assets: { current: [{ code: '1353', name: 'EUR預金', amount: 5000000 }], fixed: [] },
          liabilities: { current: [], fixed: [] },
          equity: [],
          totalAssets: 5000000,
          totalLiabilities: 0,
          totalEquity: 0,
        },
      })
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(true)
    })

    it('returns true when ドル account exists', () => {
      const data = createSourceData({
        balanceSheet: {
          assets: { current: [{ code: '1354', name: 'ドル建預金', amount: 5000000 }], fixed: [] },
          liabilities: { current: [], fixed: [] },
          equity: [],
          totalAssets: 5000000,
          totalLiabilities: 0,
          totalEquity: 0,
        },
      })
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(true)
    })

    it('returns true when ユーロ account exists', () => {
      const data = createSourceData({
        balanceSheet: {
          assets: { current: [{ code: '1355', name: 'ユーロ建預金', amount: 5000000 }], fixed: [] },
          liabilities: { current: [], fixed: [] },
          equity: [],
          totalAssets: 5000000,
          totalLiabilities: 0,
          totalEquity: 0,
        },
      })
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(true)
    })

    it('returns true when journal has 為替 line', () => {
      const data = createSourceData({
        balanceSheet: {
          assets: { current: [], fixed: [] },
          liabilities: { current: [], fixed: [] },
          equity: [],
          totalAssets: 0,
          totalLiabilities: 0,
          totalEquity: 0,
        },
        journals: [
          {
            id: 'j-1',
            entryDate: new Date('2024-01-15'),
            description: '為替差損',
            lines: [{ accountCode: '9600', accountName: '為替差損', debit: 100000, credit: 0 }],
          },
        ],
      })
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(true)
    })

    it('returns true when journal has Translation line', () => {
      const data = createSourceData({
        balanceSheet: {
          assets: { current: [], fixed: [] },
          liabilities: { current: [], fixed: [] },
          equity: [],
          totalAssets: 0,
          totalLiabilities: 0,
          totalEquity: 0,
        },
        journals: [
          {
            id: 'j-1',
            entryDate: new Date('2024-01-15'),
            description: 'Translation adjustment',
            lines: [{ accountCode: '6750', accountName: 'Translation', debit: 100000, credit: 0 }],
          },
        ],
      })
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(true)
    })

    it('returns false when no foreign currency accounts or journals', () => {
      const data = createSourceData({
        balanceSheet: {
          assets: { current: [{ code: '1100', name: '現金預金', amount: 10000000 }], fixed: [] },
          liabilities: { current: [], fixed: [] },
          equity: [],
          totalAssets: 10000000,
          totalLiabilities: 0,
          totalEquity: 0,
        },
        journals: [],
      })
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(false)
    })
  })

  describe('calculate', () => {
    it('returns entry with foreign currency translation adjustments', async () => {
      const data = createSourceData()
      const entry = await adjustment.calculate('project-1', data, 'IFRS')

      expect(entry).not.toBeNull()
      expect(entry!.projectId).toBe('project-1')
      expect(entry!.type).toBe('foreign_currency')
      expect(entry!.lines.length).toBeGreaterThanOrEqual(2)
    })

    it('returns null when no foreign currency accounts exist', async () => {
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

    it('creates asset adjustment line with debit when positive', async () => {
      const data = createSourceData({
        balanceSheet: {
          assets: { current: [{ code: '1350', name: '外貨建預金', amount: 15000000 }], fixed: [] },
          liabilities: { current: [], fixed: [] },
          equity: [],
          totalAssets: 15000000,
          totalLiabilities: 0,
          totalEquity: 0,
        },
      })
      const entry = await adjustment.calculate('project-1', data, 'IFRS')

      expect(entry).not.toBeNull()
      const assetLine = entry!.lines.find((l) => l.accountCode === '1350')
      expect(assetLine).toBeDefined()
    })

    it('creates equity adjustment (為替換算調整勘定) line', async () => {
      const data = createSourceData()
      const entry = await adjustment.calculate('project-1', data, 'IFRS')

      expect(entry).not.toBeNull()
      const equityLine = entry!.lines.find((l) => l.accountCode === '6750')
      expect(equityLine).toBeDefined()
    })

    it('handles USGAAP target standard', async () => {
      const data = createSourceData()
      const entry = await adjustment.calculate('project-1', data, 'USGAAP')

      expect(entry).not.toBeNull()
      expect(entry!.usgaapReference).toBe('ASC 830 Foreign Currency Matters')
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

      expect(entry!.description).toBe('外貨建資産・負債の期末日レート換算調整')
      expect(entry!.descriptionEn).toBe('Foreign currency translation adjustment at closing rate')
    })

    it('returns null when only non-foreign accounts exist', async () => {
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
      const entry = await adjustment.calculate('project-1', data, 'IFRS')
      expect(entry).toBeNull()
    })
  })

  describe('getReference', () => {
    it('returns IAS 21 for IFRS', () => {
      expect(adjustment.getReference('IFRS')).toBe(
        'IAS 21 The Effects of Changes in Foreign Exchange Rates'
      )
    })

    it('returns ASC 830 for USGAAP', () => {
      expect(adjustment.getReference('USGAAP')).toBe('ASC 830 Foreign Currency Matters')
    })
  })
})
