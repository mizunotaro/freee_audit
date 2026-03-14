import { describe, it, expect, beforeEach } from 'vitest'
import {
  AdjustmentCalculator,
  adjustmentCalculator,
  LeaseClassificationAdjustment,
  DeferredTaxAdjustment,
  RevenueRecognitionAdjustment,
} from '@/services/conversion/adjustment-calculator'
import {
  type SourceFinancialData,
  type BalanceSheet,
  type ProfitLoss,
  type Journal,
  type FixedAsset,
  validateAdjustingEntry,
  calculatePresentValue,
} from '@/services/conversion/adjustments/types'
import { isSuccess, isFailure } from '@/types/result'
import type { AdjustmentType } from '@/types/conversion'

const createMockSourceData = (
  overrides: Partial<SourceFinancialData> = {}
): SourceFinancialData => {
  const defaultBalanceSheet: BalanceSheet = {
    assets: {
      current: [
        { code: '1100', name: '現金預金', amount: 10000000 },
        { code: '1200', name: '売掛金', amount: 5000000 },
      ],
      fixed: [
        { code: '2100', name: '建物', amount: 30000000 },
        { code: '2600', name: 'のれん', amount: 5000000 },
      ],
    },
    liabilities: {
      current: [
        { code: '4100', name: '買掛金', amount: 3000000 },
        { code: '4200', name: '前受収益', amount: 1000000 },
      ],
      fixed: [
        { code: '5100', name: '長期借入金', amount: 20000000 },
        { code: '5310', name: '退職給付引当金', amount: 8000000 },
      ],
    },
    equity: [
      { code: '6100', name: '資本金', amount: 10000000 },
      { code: '6200', name: '利益剰余金', amount: 15000000 },
    ],
    totalAssets: 50000000,
    totalLiabilities: 32000000,
    totalEquity: 25000000,
  }

  const defaultProfitLoss: ProfitLoss = {
    revenue: [{ code: '7100', name: '売上高', amount: 100000000 }],
    costOfSales: [{ code: '8100', name: '売上原価', amount: 60000000 }],
    sgaExpenses: [
      { code: '9100', name: '給与手当', amount: 20000000 },
      { code: '9200', name: 'リース料', amount: 5000000 },
    ],
    nonOperatingIncome: [],
    nonOperatingExpenses: [],
    grossProfit: 40000000,
    operatingIncome: 15000000,
    netIncome: 10000000,
  }

  const defaultJournals: Journal[] = [
    {
      id: 'journal-1',
      entryDate: new Date('2024-01-15'),
      description: 'リース料支払',
      lines: [
        { accountCode: '9200', accountName: 'リース料', debit: 500000, credit: 0 },
        { accountCode: '1100', accountName: '現金預金', debit: 0, credit: 500000 },
      ],
    },
  ]

  const defaultFixedAssets: FixedAsset[] = [
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
  ]

  return {
    balanceSheet: defaultBalanceSheet,
    profitLoss: defaultProfitLoss,
    journals: defaultJournals,
    fixedAssets: defaultFixedAssets,
    debts: [],
    ...overrides,
  }
}

describe('AdjustmentCalculator', () => {
  let calculator: AdjustmentCalculator

  beforeEach(() => {
    calculator = new AdjustmentCalculator()
  })

  describe('constructor', () => {
    it('should initialize all adjustment strategies', () => {
      const types = calculator.getAvailableTypes()
      expect(types.length).toBe(8)
    })
  })

  describe('calculateAll', () => {
    it('should calculate all applicable adjustments', async () => {
      const sourceData = createMockSourceData()
      const entries = await calculator.calculateAll('project-1', sourceData, 'IFRS')

      expect(entries.length).toBeGreaterThan(0)

      for (const entry of entries) {
        expect(entry.projectId).toBe('project-1')
        expect(entry.lines.length).toBeGreaterThanOrEqual(2)
        expect(entry.ifrsReference).toBeDefined()
        expect(entry.usgaapReference).toBeDefined()
      }
    })

    it('should skip inapplicable adjustments', async () => {
      const sourceData = createMockSourceData({
        balanceSheet: {
          assets: { current: [], fixed: [] },
          liabilities: { current: [], fixed: [] },
          equity: [],
          totalAssets: 0,
          totalLiabilities: 0,
          totalEquity: 0,
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
      })

      const entries = await calculator.calculateAll('project-1', sourceData, 'IFRS')
      expect(entries.length).toBe(0)
    })

    it('should validate adjusting entries for balance', async () => {
      const sourceData = createMockSourceData()
      const entries = await calculator.calculateAll('project-1', sourceData, 'USGAAP')

      for (const entry of entries) {
        const validation = validateAdjustingEntry(entry)
        expect(validation.isValid).toBe(true)
      }
    })
  })

  describe('calculate', () => {
    it('should calculate specific adjustment type', async () => {
      const sourceData = createMockSourceData({
        balanceSheet: {
          ...createMockSourceData().balanceSheet,
          assets: {
            current: [{ code: '1650', name: '繰延税金資産', amount: 2000000 }],
            fixed: [],
          },
        },
      })
      const result = await calculator.calculate('project-1', 'deferred_tax', sourceData, 'IFRS')

      expect(isSuccess(result)).toBe(true)
      if (isSuccess(result)) {
        expect(result.data).not.toBeNull()
        expect(result.data?.type).toBe('deferred_tax')
      }
    })

    it('should return null for inapplicable adjustment', async () => {
      const sourceData = createMockSourceData({
        balanceSheet: {
          assets: { current: [], fixed: [] },
          liabilities: { current: [], fixed: [] },
          equity: [],
          totalAssets: 0,
          totalLiabilities: 0,
          totalEquity: 0,
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
      })

      const result = await calculator.calculate('project-1', 'deferred_tax', sourceData, 'IFRS')

      expect(isSuccess(result)).toBe(true)
      if (isSuccess(result)) {
        expect(result.data).toBeNull()
      }
    })

    it('should return error for unknown adjustment type', async () => {
      const sourceData = createMockSourceData()

      const result = await calculator.calculate(
        'project-1',
        'unknown_type' as AdjustmentType,
        sourceData,
        'IFRS'
      )
      expect(isFailure(result)).toBe(true)
      if (isFailure(result)) {
        expect(result.error.message).toContain('Unknown adjustment type')
      }
    })
  })

  describe('generateRecommendations', () => {
    it('should generate recommendations with correct priority', async () => {
      const sourceData = createMockSourceData()
      const recommendations = await calculator.generateRecommendations(
        'project-1',
        sourceData,
        'IFRS'
      )

      expect(recommendations.length).toBeGreaterThan(0)

      for (const rec of recommendations) {
        expect(['high', 'medium', 'low']).toContain(rec.priority)
        expect(rec.title).toBeDefined()
        expect(rec.description).toBeDefined()
        expect(rec.references.length).toBeGreaterThan(0)
      }
    })

    it('should sort recommendations by priority', async () => {
      const sourceData = createMockSourceData()
      const recommendations = await calculator.generateRecommendations(
        'project-1',
        sourceData,
        'USGAAP'
      )

      const priorityOrder = { high: 0, medium: 1, low: 2 }
      for (let i = 1; i < recommendations.length; i++) {
        const prevPriority = priorityOrder[recommendations[i - 1].priority]
        const currPriority = priorityOrder[recommendations[i].priority]
        expect(prevPriority).toBeLessThanOrEqual(currPriority)
      }
    })
  })

  describe('estimateImpact', () => {
    it('should correctly estimate balance sheet impact', () => {
      const entry = {
        id: 'test-id',
        projectId: 'project-1',
        type: 'lease_classification' as AdjustmentType,
        description: 'Test',
        lines: [
          { accountCode: '2200', accountName: '使用権資産', debit: 1000000, credit: 0 },
          { accountCode: '4100', accountName: 'リース負債', debit: 0, credit: 1000000 },
        ],
        aiSuggested: false,
        isApproved: false,
      }

      const impact = calculator.estimateImpact(entry)

      expect(impact.assetChange).toBe(1000000)
      expect(impact.liabilityChange).toBe(1000000)
      expect(impact.affectedAccounts).toContain('使用権資産')
      expect(impact.affectedAccounts).toContain('リース負債')
    })

    it('should correctly estimate P&L impact', () => {
      const entry = {
        id: 'test-id',
        projectId: 'project-1',
        type: 'revenue_recognition' as AdjustmentType,
        description: 'Test',
        lines: [
          { accountCode: '7000', accountName: '売上高', debit: 0, credit: 500000 },
          { accountCode: '4200', accountName: '前受収益', debit: 500000, credit: 0 },
        ],
        aiSuggested: false,
        isApproved: false,
      }

      const impact = calculator.estimateImpact(entry)

      expect(impact.liabilityChange).toBe(-500000)
      expect(impact.netIncomeChange).toBe(500000)
    })
  })

  describe('getApplicableTypes', () => {
    it('should return only applicable adjustment types', () => {
      const sourceData = createMockSourceData({
        balanceSheet: {
          ...createMockSourceData().balanceSheet,
          assets: {
            current: [{ code: '1650', name: '繰延税金資産', amount: 2000000 }],
            fixed: createMockSourceData().balanceSheet.assets.fixed,
          },
        },
      })
      const applicableTypes = calculator.getApplicableTypes(sourceData, 'IFRS')

      expect(applicableTypes.length).toBeGreaterThan(0)
      expect(applicableTypes).toContain('deferred_tax')
    })
  })

  describe('exported singleton instance', () => {
    it('should be exported as adjustmentCalculator', () => {
      expect(adjustmentCalculator).toBeInstanceOf(AdjustmentCalculator)
    })
  })
})

describe('LeaseClassificationAdjustment', () => {
  let adjustment: LeaseClassificationAdjustment

  beforeEach(() => {
    adjustment = new LeaseClassificationAdjustment()
  })

  describe('isApplicable', () => {
    it('should return true when lease accounts exist', () => {
      const sourceData = createMockSourceData({
        balanceSheet: {
          ...createMockSourceData().balanceSheet,
          assets: {
            current: [],
            fixed: [{ code: '2200', name: 'リース資産', amount: 5000000 }],
          },
        },
      })

      expect(adjustment.isApplicable(sourceData, 'IFRS')).toBe(true)
    })

    it('should return true when lease payments exist in journals', () => {
      const sourceData = createMockSourceData()
      expect(adjustment.isApplicable(sourceData, 'IFRS')).toBe(true)
    })

    it('should return false when no lease-related accounts', () => {
      const sourceData = createMockSourceData({
        journals: [],
        profitLoss: {
          ...createMockSourceData().profitLoss,
          sgaExpenses: [{ code: '9100', name: '給与手当', amount: 20000000 }],
        },
      })

      expect(adjustment.isApplicable(sourceData, 'IFRS')).toBe(false)
    })
  })

  describe('calculate', () => {
    it('should calculate ROU asset and lease liability', async () => {
      const sourceData = createMockSourceData()
      const entry = await adjustment.calculate('project-1', sourceData, 'IFRS')

      expect(entry).not.toBeNull()
      expect(entry?.type).toBe('lease_classification')
      expect(entry?.lines.length).toBeGreaterThanOrEqual(2)

      const totalDebit = entry?.lines.reduce((sum, l) => sum + l.debit, 0) || 0
      const totalCredit = entry?.lines.reduce((sum, l) => sum + l.credit, 0) || 0
      expect(totalDebit).toBe(totalCredit)
    })

    it('should include correct references', async () => {
      const sourceData = createMockSourceData()
      const entry = await adjustment.calculate('project-1', sourceData, 'IFRS')

      expect(entry?.ifrsReference).toBe('IFRS 16 Leases')
    })
  })

  describe('getReference', () => {
    it('should return IFRS reference', () => {
      expect(adjustment.getReference('IFRS')).toBe('IFRS 16 Leases')
    })

    it('should return USGAAP reference', () => {
      expect(adjustment.getReference('USGAAP')).toBe('ASC 842 Leases')
    })
  })
})

describe('DeferredTaxAdjustment', () => {
  let adjustment: DeferredTaxAdjustment

  beforeEach(() => {
    adjustment = new DeferredTaxAdjustment()
  })

  describe('isApplicable', () => {
    it('should return true when deferred tax accounts exist', () => {
      const sourceData = createMockSourceData({
        balanceSheet: {
          ...createMockSourceData().balanceSheet,
          assets: {
            current: [{ code: '1650', name: '繰延税金資産', amount: 2000000 }],
            fixed: [],
          },
          liabilities: { current: [], fixed: [] },
          equity: [],
          totalAssets: 2000000,
          totalLiabilities: 0,
          totalEquity: 0,
        },
      })

      expect(adjustment.isApplicable(sourceData, 'IFRS')).toBe(true)
    })
  })

  describe('calculate', () => {
    it('should calculate deferred tax adjustment', async () => {
      const sourceData = createMockSourceData()
      const entry = await adjustment.calculate('project-1', sourceData, 'IFRS')

      if (entry) {
        expect(entry.type).toBe('deferred_tax')
        expect(entry.ifrsReference).toBe('IAS 12 Income Taxes')
        expect(entry.usgaapReference).toBe('ASC 740 Income Taxes')
      }
    })
  })
})

describe('RevenueRecognitionAdjustment', () => {
  let adjustment: RevenueRecognitionAdjustment

  beforeEach(() => {
    adjustment = new RevenueRecognitionAdjustment()
  })

  describe('isApplicable', () => {
    it('should return true when prepaid revenue exists', () => {
      const sourceData = createMockSourceData({
        profitLoss: {
          ...createMockSourceData().profitLoss,
          revenue: [
            { code: '7100', name: '売上高', amount: 100000000 },
            { code: '7150', name: '前受収益', amount: 1000000 },
          ],
        },
      })
      expect(adjustment.isApplicable(sourceData, 'IFRS')).toBe(true)
    })
  })

  describe('getReference', () => {
    it('should return IFRS 15 reference', () => {
      expect(adjustment.getReference('IFRS')).toBe('IFRS 15 Revenue from Contracts with Customers')
    })

    it('should return ASC 606 reference', () => {
      expect(adjustment.getReference('USGAAP')).toBe(
        'ASC 606 Revenue from Contracts with Customers'
      )
    })
  })
})

describe('validateAdjustingEntry', () => {
  it('should return valid for balanced entry', () => {
    const entry = {
      id: 'test-id',
      projectId: 'project-1',
      type: 'lease_classification' as AdjustmentType,
      description: 'Test',
      lines: [
        { accountCode: '2200', accountName: '資産', debit: 1000, credit: 0 },
        { accountCode: '3100', accountName: '負債', debit: 0, credit: 1000 },
      ],
      aiSuggested: false,
      isApproved: false,
    }

    const result = validateAdjustingEntry(entry)
    expect(result.isValid).toBe(true)
  })

  it('should return invalid for unbalanced entry', () => {
    const entry = {
      id: 'test-id',
      projectId: 'project-1',
      type: 'lease_classification' as AdjustmentType,
      description: 'Test',
      lines: [
        { accountCode: '2200', accountName: '資産', debit: 1000, credit: 0 },
        { accountCode: '3100', accountName: '負債', debit: 0, credit: 500 },
      ],
      aiSuggested: false,
      isApproved: false,
    }

    const result = validateAdjustingEntry(entry)
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('do not balance')
  })

  it('should return invalid for entry with no lines', () => {
    const entry = {
      id: 'test-id',
      projectId: 'project-1',
      type: 'lease_classification' as AdjustmentType,
      description: 'Test',
      lines: [],
      aiSuggested: false,
      isApproved: false,
    }

    const result = validateAdjustingEntry(entry)
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('at least one line')
  })
})

describe('calculatePresentValue', () => {
  it('should calculate present value correctly', () => {
    const payment = 100000
    const rate = 0.05
    const periods = 5

    const pv = calculatePresentValue(payment, rate, periods)

    expect(pv).toBeGreaterThan(0)
    expect(pv).toBeLessThan(payment * periods * 12)
  })

  it('should handle zero rate', () => {
    const payment = 100000
    const rate = 0
    const periods = 5

    const pv = calculatePresentValue(payment, rate, periods)

    expect(pv).toBe(payment * periods * 12)
  })
})
