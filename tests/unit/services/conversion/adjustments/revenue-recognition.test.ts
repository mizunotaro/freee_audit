import { describe, it, expect, beforeEach } from 'vitest'
import { RevenueRecognitionAdjustment } from '@/services/conversion/adjustments/revenue-recognition'
import type { SourceFinancialData } from '@/services/conversion/adjustments/types'

const createSourceData = (overrides: Partial<SourceFinancialData> = {}): SourceFinancialData => ({
  balanceSheet: {
    assets: {
      current: [{ code: '1300', name: '未収収益', amount: 5000000 }],
      fixed: [],
    },
    liabilities: {
      current: [{ code: '4200', name: '前受収益', amount: 10000000 }],
      fixed: [],
    },
    equity: [{ code: '6100', name: '資本金', amount: 10000000 }],
    totalAssets: 5000000,
    totalLiabilities: 10000000,
    totalEquity: 10000000,
  },
  profitLoss: {
    revenue: [{ code: '7100', name: 'サブスクリプション売上', amount: 50000000 }],
    costOfSales: [],
    sgaExpenses: [],
    nonOperatingIncome: [],
    nonOperatingExpenses: [],
    grossProfit: 50000000,
    operatingIncome: 20000000,
    netIncome: 15000000,
  },
  journals: [],
  fixedAssets: [],
  debts: [],
  ...overrides,
})

describe('RevenueRecognitionAdjustment', () => {
  let adjustment: RevenueRecognitionAdjustment

  beforeEach(() => {
    adjustment = new RevenueRecognitionAdjustment()
  })

  describe('properties', () => {
    it('has correct type', () => {
      expect(adjustment.type).toBe('revenue_recognition')
    })

    it('has correct name', () => {
      expect(adjustment.name).toBe('収益認識の調整')
    })
  })

  describe('isApplicable', () => {
    it('returns true when 前受 revenue item exists', () => {
      const data = createSourceData({
        profitLoss: {
          revenue: [{ code: '7100', name: '前受売上', amount: 50000000 }],
          costOfSales: [],
          sgaExpenses: [],
          nonOperatingIncome: [],
          nonOperatingExpenses: [],
          grossProfit: 50000000,
          operatingIncome: 20000000,
          netIncome: 15000000,
        },
      })
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(true)
    })

    it('returns true when 未収 revenue item exists', () => {
      const data = createSourceData({
        profitLoss: {
          revenue: [{ code: '7100', name: '未収売上', amount: 50000000 }],
          costOfSales: [],
          sgaExpenses: [],
          nonOperatingIncome: [],
          nonOperatingExpenses: [],
          grossProfit: 50000000,
          operatingIncome: 20000000,
          netIncome: 15000000,
        },
      })
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(true)
    })

    it('returns true when 契約 revenue item exists', () => {
      const data = createSourceData({
        profitLoss: {
          revenue: [{ code: '7100', name: '契約収益', amount: 50000000 }],
          costOfSales: [],
          sgaExpenses: [],
          nonOperatingIncome: [],
          nonOperatingExpenses: [],
          grossProfit: 50000000,
          operatingIncome: 20000000,
          netIncome: 15000000,
        },
      })
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(true)
    })

    it('returns true when サブスクリプション revenue item exists', () => {
      const data = createSourceData()
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(true)
    })

    it('returns true when Advances (English) revenue item exists', () => {
      const data = createSourceData({
        profitLoss: {
          revenue: [{ code: '7100', name: 'Advances from Customers', amount: 50000000 }],
          costOfSales: [],
          sgaExpenses: [],
          nonOperatingIncome: [],
          nonOperatingExpenses: [],
          grossProfit: 50000000,
          operatingIncome: 20000000,
          netIncome: 15000000,
        },
      })
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(true)
    })

    it('returns true when Deferred (English) revenue item exists', () => {
      const data = createSourceData({
        profitLoss: {
          revenue: [{ code: '7100', name: 'Deferred Revenue', amount: 50000000 }],
          costOfSales: [],
          sgaExpenses: [],
          nonOperatingIncome: [],
          nonOperatingExpenses: [],
          grossProfit: 50000000,
          operatingIncome: 20000000,
          netIncome: 15000000,
        },
      })
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(true)
    })

    it('returns true when Subscription (English) revenue item exists', () => {
      const data = createSourceData({
        profitLoss: {
          revenue: [{ code: '7100', name: 'Subscription Revenue', amount: 50000000 }],
          costOfSales: [],
          sgaExpenses: [],
          nonOperatingIncome: [],
          nonOperatingExpenses: [],
          grossProfit: 50000000,
          operatingIncome: 20000000,
          netIncome: 15000000,
        },
      })
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(true)
    })

    it('returns true when journal has 前受収益 credit line', () => {
      const data = createSourceData({
        profitLoss: {
          revenue: [{ code: '7100', name: '売上高', amount: 50000000 }],
          costOfSales: [],
          sgaExpenses: [],
          nonOperatingIncome: [],
          nonOperatingExpenses: [],
          grossProfit: 50000000,
          operatingIncome: 20000000,
          netIncome: 15000000,
        },
        journals: [
          {
            id: 'j-1',
            entryDate: new Date('2024-01-15'),
            description: '前受収益計上',
            lines: [
              { accountCode: '1100', accountName: '現金預金', debit: 1000000, credit: 0 },
              { accountCode: '4200', accountName: '前受収益', debit: 0, credit: 1000000 },
            ],
          },
        ],
      })
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(true)
    })

    it('returns true when journal has Deferred Revenue credit line', () => {
      const data = createSourceData({
        profitLoss: {
          revenue: [{ code: '7100', name: '売上高', amount: 50000000 }],
          costOfSales: [],
          sgaExpenses: [],
          nonOperatingIncome: [],
          nonOperatingExpenses: [],
          grossProfit: 50000000,
          operatingIncome: 20000000,
          netIncome: 15000000,
        },
        journals: [
          {
            id: 'j-1',
            entryDate: new Date('2024-01-15'),
            description: 'Deferred Revenue',
            lines: [
              { accountCode: '1100', accountName: 'Cash', debit: 1000000, credit: 0 },
              { accountCode: '4200', accountName: 'Deferred Revenue', debit: 0, credit: 1000000 },
            ],
          },
        ],
      })
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(true)
    })

    it('returns false when no revenue recognition items exist', () => {
      const data = createSourceData({
        profitLoss: {
          revenue: [{ code: '7100', name: '売上高', amount: 50000000 }],
          costOfSales: [],
          sgaExpenses: [],
          nonOperatingIncome: [],
          nonOperatingExpenses: [],
          grossProfit: 50000000,
          operatingIncome: 20000000,
          netIncome: 15000000,
        },
        balanceSheet: {
          assets: { current: [], fixed: [] },
          liabilities: { current: [], fixed: [] },
          equity: [],
          totalAssets: 0,
          totalLiabilities: 0,
          totalEquity: 0,
        },
        journals: [],
      })
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(false)
    })
  })

  describe('calculate', () => {
    it('returns entry with deferred and accrued revenue adjustments', async () => {
      const data = createSourceData()
      const entry = await adjustment.calculate('project-1', data, 'IFRS')

      expect(entry).not.toBeNull()
      expect(entry!.projectId).toBe('project-1')
      expect(entry!.type).toBe('revenue_recognition')
      expect(entry!.lines.length).toBeGreaterThanOrEqual(2)
    })

    it('creates deferred revenue lines when 前受 revenue exists', async () => {
      const data = createSourceData()
      const entry = await adjustment.calculate('project-1', data, 'IFRS')

      expect(entry).not.toBeNull()
      const deferredLine = entry!.lines.find((l) => l.accountCode === '4200')
      expect(deferredLine).toBeDefined()
    })

    it('creates accrued revenue lines when 未収 revenue exists', async () => {
      const data = createSourceData()
      const entry = await adjustment.calculate('project-1', data, 'IFRS')

      expect(entry).not.toBeNull()
      const accruedLine = entry!.lines.find((l) => l.accountCode === '1300')
      expect(accruedLine).toBeDefined()
    })

    it('returns null when no prepaid or accrued revenue exists', async () => {
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

    it('handles only prepaid revenue (no accrued)', async () => {
      const data = createSourceData({
        balanceSheet: {
          assets: { current: [], fixed: [] },
          liabilities: {
            current: [{ code: '4200', name: '前受収益', amount: 8000000 }],
            fixed: [],
          },
          equity: [],
          totalAssets: 0,
          totalLiabilities: 8000000,
          totalEquity: 0,
        },
      })
      const entry = await adjustment.calculate('project-1', data, 'IFRS')

      expect(entry).not.toBeNull()
      expect(entry!.lines.length).toBeGreaterThanOrEqual(2)
    })

    it('handles only accrued revenue (no prepaid)', async () => {
      const data = createSourceData({
        balanceSheet: {
          assets: {
            current: [{ code: '1300', name: '未収収益', amount: 8000000 }],
            fixed: [],
          },
          liabilities: { current: [], fixed: [] },
          equity: [],
          totalAssets: 8000000,
          totalLiabilities: 0,
          totalEquity: 0,
        },
      })
      const entry = await adjustment.calculate('project-1', data, 'IFRS')

      expect(entry).not.toBeNull()
      expect(entry!.lines.length).toBeGreaterThanOrEqual(2)
    })

    it('handles USGAAP target standard', async () => {
      const data = createSourceData()
      const entry = await adjustment.calculate('project-1', data, 'USGAAP')

      expect(entry).not.toBeNull()
      expect(entry!.usgaapReference).toBe('ASC 606 Revenue from Contracts with Customers')
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

      expect(entry!.description).toBe('収益認識タイミングの調整（5基準の適用）')
      expect(entry!.descriptionEn).toBe(
        'Revenue recognition timing adjustment (5-step model application)'
      )
    })

    it('handles Advances (English) prepaid revenue', async () => {
      const data = createSourceData({
        balanceSheet: {
          assets: { current: [], fixed: [] },
          liabilities: {
            current: [{ code: '4200', name: 'Advances from Customers', amount: 5000000 }],
            fixed: [],
          },
          equity: [],
          totalAssets: 0,
          totalLiabilities: 5000000,
          totalEquity: 0,
        },
      })
      const entry = await adjustment.calculate('project-1', data, 'IFRS')

      expect(entry).not.toBeNull()
    })

    it('handles Accrued (English) accrued revenue', async () => {
      const data = createSourceData({
        balanceSheet: {
          assets: {
            current: [{ code: '1300', name: 'Accrued Revenue', amount: 5000000 }],
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

    it('returns null when prepaid and accrued amounts are zero', async () => {
      const data = createSourceData({
        balanceSheet: {
          assets: {
            current: [{ code: '1300', name: '未収収益', amount: 0 }],
            fixed: [],
          },
          liabilities: {
            current: [{ code: '4200', name: '前受収益', amount: 0 }],
            fixed: [],
          },
          equity: [],
          totalAssets: 0,
          totalLiabilities: 0,
          totalEquity: 0,
        },
      })
      const entry = await adjustment.calculate('project-1', data, 'IFRS')
      expect(entry).toBeNull()
    })
  })

  describe('getReference', () => {
    it('returns IFRS 15 for IFRS', () => {
      expect(adjustment.getReference('IFRS')).toBe('IFRS 15 Revenue from Contracts with Customers')
    })

    it('returns ASC 606 for USGAAP', () => {
      expect(adjustment.getReference('USGAAP')).toBe(
        'ASC 606 Revenue from Contracts with Customers'
      )
    })
  })
})
