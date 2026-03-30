import { describe, it, expect, beforeEach } from 'vitest'
import { RetirementBenefitAdjustment } from '@/services/conversion/adjustments/retirement-benefit'
import type { SourceFinancialData } from '@/services/conversion/adjustments/types'

const createSourceData = (overrides: Partial<SourceFinancialData> = {}): SourceFinancialData => ({
  balanceSheet: {
    assets: {
      current: [],
      fixed: [{ code: '1790', name: '年金資産', amount: 3000000 }],
    },
    liabilities: {
      current: [],
      fixed: [{ code: '5310', name: '退職給付引当金', amount: 10000000 }],
    },
    equity: [{ code: '6100', name: '資本金', amount: 10000000 }],
    totalAssets: 3000000,
    totalLiabilities: 10000000,
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

describe('RetirementBenefitAdjustment', () => {
  let adjustment: RetirementBenefitAdjustment

  beforeEach(() => {
    adjustment = new RetirementBenefitAdjustment()
  })

  describe('properties', () => {
    it('has correct type', () => {
      expect(adjustment.type).toBe('retirement_benefit')
    })

    it('has correct name', () => {
      expect(adjustment.name).toBe('退職給付費用の調整')
    })
  })

  describe('isApplicable', () => {
    it('returns true when 退職 liability exists', () => {
      const data = createSourceData()
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(true)
    })

    it('returns true when 年金 account exists', () => {
      const data = createSourceData({
        balanceSheet: {
          assets: { current: [], fixed: [{ code: '1791', name: '年金基金', amount: 5000000 }] },
          liabilities: { current: [], fixed: [] },
          equity: [],
          totalAssets: 5000000,
          totalLiabilities: 0,
          totalEquity: 0,
        },
      })
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(true)
    })

    it('returns true when Pension (English) account exists', () => {
      const data = createSourceData({
        balanceSheet: {
          assets: { current: [], fixed: [] },
          liabilities: {
            current: [],
            fixed: [{ code: '5311', name: 'Pension Liability', amount: 5000000 }],
          },
          equity: [],
          totalAssets: 0,
          totalLiabilities: 5000000,
          totalEquity: 0,
        },
      })
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(true)
    })

    it('returns true when Retirement (English) account exists', () => {
      const data = createSourceData({
        balanceSheet: {
          assets: { current: [], fixed: [] },
          liabilities: {
            current: [],
            fixed: [{ code: '5312', name: 'Retirement Benefit', amount: 5000000 }],
          },
          equity: [],
          totalAssets: 0,
          totalLiabilities: 5000000,
          totalEquity: 0,
        },
      })
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(true)
    })

    it('returns true when Retiree account exists', () => {
      const data = createSourceData({
        balanceSheet: {
          assets: { current: [], fixed: [] },
          liabilities: {
            current: [],
            fixed: [{ code: '5313', name: 'Retiree Benefits', amount: 5000000 }],
          },
          equity: [],
          totalAssets: 0,
          totalLiabilities: 5000000,
          totalEquity: 0,
        },
      })
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(true)
    })

    it('returns false when no retirement-related accounts exist', () => {
      const data = createSourceData({
        balanceSheet: {
          assets: { current: [], fixed: [] },
          liabilities: {
            current: [],
            fixed: [{ code: '5100', name: '長期借入金', amount: 5000000 }],
          },
          equity: [],
          totalAssets: 0,
          totalLiabilities: 5000000,
          totalEquity: 0,
        },
      })
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(false)
    })
  })

  describe('calculate', () => {
    it('returns entry with retirement benefit adjustments', async () => {
      const data = createSourceData()
      const entry = await adjustment.calculate('project-1', data, 'IFRS')

      expect(entry).not.toBeNull()
      expect(entry!.projectId).toBe('project-1')
      expect(entry!.type).toBe('retirement_benefit')
      expect(entry!.lines.length).toBeGreaterThanOrEqual(2)
    })

    it('creates retirement benefit obligation line', async () => {
      const data = createSourceData()
      const entry = await adjustment.calculate('project-1', data, 'IFRS')

      const dboLine = entry!.lines.find((l) => l.accountCode === '5310')
      expect(dboLine).toBeDefined()
    })

    it('creates plan asset line when pension assets exist', async () => {
      const data = createSourceData()
      const entry = await adjustment.calculate('project-1', data, 'IFRS')

      const planAssetLine = entry!.lines.find((l) => l.accountCode === '1790')
      expect(planAssetLine).toBeDefined()
    })

    it('returns null when no retirement liability exists', async () => {
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

    it('returns null when net adjustment is below threshold', async () => {
      const data = createSourceData({
        balanceSheet: {
          assets: { current: [], fixed: [] },
          liabilities: {
            current: [],
            fixed: [{ code: '5310', name: '退職給付引当金', amount: 100 }],
          },
          equity: [],
          totalAssets: 0,
          totalLiabilities: 100,
          totalEquity: 0,
        },
      })
      const entry = await adjustment.calculate('project-1', data, 'IFRS')
      expect(entry).toBeNull()
    })

    it('balances debit and credit in generated entry', async () => {
      const data = createSourceData()
      const entry = await adjustment.calculate('project-1', data, 'IFRS')

      const totalDebit = entry!.lines.reduce((sum, l) => sum + l.debit, 0)
      const totalCredit = entry!.lines.reduce((sum, l) => sum + l.credit, 0)
      expect(Math.abs(totalDebit - totalCredit)).toBeLessThanOrEqual(0.01)
    })

    it('handles USGAAP target standard', async () => {
      const data = createSourceData()
      const entry = await adjustment.calculate('project-1', data, 'USGAAP')

      expect(entry).not.toBeNull()
      expect(entry!.usgaapReference).toBe('ASC 715 Compensation - Retirement Benefits')
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

      expect(entry!.description).toBe('退職給付債務の再計算と調整')
      expect(entry!.descriptionEn).toBe(
        'Remeasurement and adjustment of retirement benefit obligations'
      )
    })

    it('creates past service cost line when applicable', async () => {
      const data = createSourceData({
        balanceSheet: {
          assets: { current: [], fixed: [] },
          liabilities: {
            current: [],
            fixed: [{ code: '5310', name: '退職給付引当金', amount: 50000000 }],
          },
          equity: [],
          totalAssets: 0,
          totalLiabilities: 50000000,
          totalEquity: 0,
        },
      })
      const entry = await adjustment.calculate('project-1', data, 'IFRS')

      if (entry) {
        const pastServiceLine = entry.lines.find((l) => l.accountCode === '9370')
        expect(pastServiceLine).toBeDefined()
      }
    })

    it('handles retirement liability without plan assets', async () => {
      const data = createSourceData({
        balanceSheet: {
          assets: { current: [], fixed: [] },
          liabilities: {
            current: [],
            fixed: [{ code: '5310', name: '退職給付引当金', amount: 20000000 }],
          },
          equity: [],
          totalAssets: 0,
          totalLiabilities: 20000000,
          totalEquity: 0,
        },
      })
      const entry = await adjustment.calculate('project-1', data, 'IFRS')

      expect(entry).not.toBeNull()
    })
  })

  describe('getReference', () => {
    it('returns IAS 19 for IFRS', () => {
      expect(adjustment.getReference('IFRS')).toBe('IAS 19 Employee Benefits')
    })

    it('returns ASC 715 for USGAAP', () => {
      expect(adjustment.getReference('USGAAP')).toBe('ASC 715 Compensation - Retirement Benefits')
    })
  })
})
