import { describe, it, expect, beforeEach, vi } from 'vitest'
import { LeaseClassificationAdjustment } from '@/services/conversion/adjustments/lease-classification'
import type { SourceFinancialData } from '@/services/conversion/adjustments/types'

vi.mock('@/services/conversion/adjustments/types', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/conversion/adjustments/types')>()
  return {
    ...actual,
    generateAdjustmentId: () => 'adj_test-uuid',
  }
})

const createSourceData = (overrides: Partial<SourceFinancialData> = {}): SourceFinancialData => ({
  balanceSheet: {
    assets: {
      current: [],
      fixed: [],
    },
    liabilities: {
      current: [],
      fixed: [],
    },
    equity: [{ code: '6100', name: '資本金', amount: 10000000 }],
    totalAssets: 0,
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

describe('LeaseClassificationAdjustment', () => {
  let adjustment: LeaseClassificationAdjustment

  beforeEach(() => {
    adjustment = new LeaseClassificationAdjustment()
  })

  describe('properties', () => {
    it('has correct type', () => {
      expect(adjustment.type).toBe('lease_classification')
    })

    it('has correct name', () => {
      expect(adjustment.name).toBe('リース取引の分類調整')
    })
  })

  describe('isApplicable', () => {
    it('returns true when リース asset exists in fixed assets', () => {
      const data = createSourceData({
        balanceSheet: {
          assets: { current: [], fixed: [{ code: '2200', name: 'リース資産', amount: 5000000 }] },
          liabilities: { current: [], fixed: [] },
          equity: [],
          totalAssets: 5000000,
          totalLiabilities: 0,
          totalEquity: 0,
        },
      })
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(true)
    })

    it('returns true when 賃借 exists', () => {
      const data = createSourceData({
        balanceSheet: {
          assets: { current: [], fixed: [{ code: '2201', name: '賃借資産', amount: 5000000 }] },
          liabilities: { current: [], fixed: [] },
          equity: [],
          totalAssets: 5000000,
          totalLiabilities: 0,
          totalEquity: 0,
        },
      })
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(true)
    })

    it('returns true when Lease (English) exists', () => {
      const data = createSourceData({
        balanceSheet: {
          assets: { current: [], fixed: [{ code: '2202', name: 'Lease Asset', amount: 5000000 }] },
          liabilities: { current: [], fixed: [] },
          equity: [],
          totalAssets: 5000000,
          totalLiabilities: 0,
          totalEquity: 0,
        },
      })
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(true)
    })

    it('returns true when Lease liability exists in fixed liabilities', () => {
      const data = createSourceData({
        balanceSheet: {
          assets: { current: [], fixed: [] },
          liabilities: {
            current: [],
            fixed: [{ code: '3100', name: 'リース負債', amount: 5000000 }],
          },
          equity: [],
          totalAssets: 0,
          totalLiabilities: 5000000,
          totalEquity: 0,
        },
      })
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(true)
    })

    it('returns true when operating leases exist in source data', () => {
      const data = createSourceData({
        leases: [
          {
            id: 'lease-1',
            code: 'L001',
            name: 'オフィスリース',
            leaseType: 'operating',
            leaseTerm: 5,
            leasePayment: 1000000,
            paymentFrequency: 'monthly',
            startDate: new Date('2024-01-01'),
            endDate: new Date('2029-01-01'),
          },
        ],
      })
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(true)
    })

    it('returns false for finance-only leases', () => {
      const data = createSourceData({
        leases: [
          {
            id: 'lease-1',
            code: 'L001',
            name: 'ファイナンスリース',
            leaseType: 'finance',
            leaseTerm: 5,
            leasePayment: 1000000,
            paymentFrequency: 'monthly',
            startDate: new Date('2024-01-01'),
            endDate: new Date('2029-01-01'),
          },
        ],
      })
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(false)
    })

    it('returns true when journal has リース debit line', () => {
      const data = createSourceData({
        journals: [
          {
            id: 'j-1',
            entryDate: new Date('2024-01-15'),
            description: 'リース料',
            lines: [{ accountCode: '9200', accountName: 'リース料', debit: 500000, credit: 0 }],
          },
        ],
      })
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(true)
    })

    it('returns true when journal has 賃借料 debit line', () => {
      const data = createSourceData({
        journals: [
          {
            id: 'j-1',
            entryDate: new Date('2024-01-15'),
            description: '賃借料',
            lines: [{ accountCode: '9201', accountName: '賃借料', debit: 300000, credit: 0 }],
          },
        ],
      })
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(true)
    })

    it('returns false when no lease-related data exists', () => {
      const data = createSourceData()
      expect(adjustment.isApplicable(data, 'IFRS')).toBe(false)
    })
  })

  describe('calculate', () => {
    it('returns entry with ROU asset and lease liability from operating leases', async () => {
      const data = createSourceData({
        leases: [
          {
            id: 'lease-1',
            code: 'L001',
            name: 'オフィスリース',
            leaseType: 'operating',
            leaseTerm: 5,
            leasePayment: 1000000,
            paymentFrequency: 'monthly',
            startDate: new Date('2024-01-01'),
            endDate: new Date('2029-01-01'),
          },
        ],
      })
      const entry = await adjustment.calculate('project-1', data, 'IFRS')

      expect(entry).not.toBeNull()
      expect(entry!.projectId).toBe('project-1')
      expect(entry!.type).toBe('lease_classification')
      expect(entry!.lines.length).toBe(2)
    })

    it('creates ROU asset line with debit', async () => {
      const data = createSourceData({
        leases: [
          {
            id: 'lease-1',
            code: 'L001',
            name: 'オフィスリース',
            leaseType: 'operating',
            leaseTerm: 5,
            leasePayment: 1000000,
            paymentFrequency: 'monthly',
            startDate: new Date('2024-01-01'),
            endDate: new Date('2029-01-01'),
          },
        ],
      })
      const entry = await adjustment.calculate('project-1', data, 'IFRS')

      const rouLine = entry!.lines.find((l) => l.accountCode === '2200')
      expect(rouLine).toBeDefined()
      expect(rouLine!.debit).toBeGreaterThan(0)
      expect(rouLine!.credit).toBe(0)
    })

    it('creates lease liability line with credit', async () => {
      const data = createSourceData({
        leases: [
          {
            id: 'lease-1',
            code: 'L001',
            name: 'オフィスリース',
            leaseType: 'operating',
            leaseTerm: 5,
            leasePayment: 1000000,
            paymentFrequency: 'monthly',
            startDate: new Date('2024-01-01'),
            endDate: new Date('2029-01-01'),
          },
        ],
      })
      const entry = await adjustment.calculate('project-1', data, 'IFRS')

      const liabilityLine = entry!.lines.find((l) => l.accountCode === '3100')
      expect(liabilityLine).toBeDefined()
      expect(liabilityLine!.debit).toBe(0)
      expect(liabilityLine!.credit).toBeGreaterThan(0)
    })

    it('ROU asset equals lease liability for each lease', async () => {
      const data = createSourceData({
        leases: [
          {
            id: 'lease-1',
            code: 'L001',
            name: 'オフィスリース',
            leaseType: 'operating',
            leaseTerm: 5,
            leasePayment: 1000000,
            paymentFrequency: 'monthly',
            startDate: new Date('2024-01-01'),
            endDate: new Date('2029-01-01'),
          },
        ],
      })
      const entry = await adjustment.calculate('project-1', data, 'IFRS')

      const rouLine = entry!.lines.find((l) => l.accountCode === '2200')!
      const liabilityLine = entry!.lines.find((l) => l.accountCode === '3100')!
      expect(rouLine.debit).toBe(liabilityLine.credit)
    })

    it('uses custom discount rate from lease', async () => {
      const data = createSourceData({
        leases: [
          {
            id: 'lease-1',
            code: 'L001',
            name: 'オフィスリース',
            leaseType: 'operating',
            leaseTerm: 3,
            leasePayment: 500000,
            paymentFrequency: 'monthly',
            startDate: new Date('2024-01-01'),
            endDate: new Date('2027-01-01'),
            discountRate: 0.08,
          },
        ],
      })
      const entry = await adjustment.calculate('project-1', data, 'IFRS')

      expect(entry).not.toBeNull()
      expect(entry!.lines[0].debit).toBeGreaterThan(0)
    })

    it('uses default discount rate when not provided', async () => {
      const data = createSourceData({
        leases: [
          {
            id: 'lease-1',
            code: 'L001',
            name: 'オフィスリース',
            leaseType: 'operating',
            leaseTerm: 3,
            leasePayment: 500000,
            paymentFrequency: 'monthly',
            startDate: new Date('2024-01-01'),
            endDate: new Date('2027-01-01'),
          },
        ],
      })
      const entry = await adjustment.calculate('project-1', data, 'IFRS')

      expect(entry).not.toBeNull()
    })

    it('returns null when no operating leases exist', async () => {
      const data = createSourceData({
        leases: [
          {
            id: 'lease-1',
            code: 'L001',
            name: 'ファイナンスリース',
            leaseType: 'finance',
            leaseTerm: 5,
            leasePayment: 1000000,
            paymentFrequency: 'monthly',
            startDate: new Date('2024-01-01'),
            endDate: new Date('2029-01-01'),
          },
        ],
      })
      const entry = await adjustment.calculate('project-1', data, 'IFRS')
      expect(entry).toBeNull()
    })

    it('returns null when leases array is empty', async () => {
      const data = createSourceData({ leases: [] })
      const entry = await adjustment.calculate('project-1', data, 'IFRS')
      expect(entry).toBeNull()
    })

    it('infers operating leases from journal entries', async () => {
      const data = createSourceData({
        journals: [
          {
            id: 'j-1',
            entryDate: new Date('2024-01-15'),
            description: 'リース料支払',
            lines: [
              { accountCode: '9200', accountName: 'リース料', debit: 500000, credit: 0 },
              { accountCode: '1100', accountName: '現金預金', debit: 0, credit: 500000 },
            ],
          },
        ],
      })
      const entry = await adjustment.calculate('project-1', data, 'IFRS')

      expect(entry).not.toBeNull()
      expect(entry!.lines[0].accountCode).toBe('2200')
      expect(entry!.lines[1].accountCode).toBe('3100')
    })

    it('handles multiple operating leases', async () => {
      const data = createSourceData({
        leases: [
          {
            id: 'lease-1',
            code: 'L001',
            name: 'オフィスリース',
            leaseType: 'operating',
            leaseTerm: 5,
            leasePayment: 1000000,
            paymentFrequency: 'monthly',
            startDate: new Date('2024-01-01'),
            endDate: new Date('2029-01-01'),
          },
          {
            id: 'lease-2',
            code: 'L002',
            name: ' warehouseリース',
            leaseType: 'operating',
            leaseTerm: 3,
            leasePayment: 500000,
            paymentFrequency: 'monthly',
            startDate: new Date('2024-01-01'),
            endDate: new Date('2027-01-01'),
          },
        ],
      })
      const entry = await adjustment.calculate('project-1', data, 'IFRS')

      expect(entry).not.toBeNull()
      expect(entry!.lines[0].debit).toBeGreaterThan(0)
      expect(entry!.lines[1].credit).toBeGreaterThan(0)
    })

    it('handles USGAAP target standard', async () => {
      const data = createSourceData({
        leases: [
          {
            id: 'lease-1',
            code: 'L001',
            name: 'オフィスリース',
            leaseType: 'operating',
            leaseTerm: 5,
            leasePayment: 1000000,
            paymentFrequency: 'monthly',
            startDate: new Date('2024-01-01'),
            endDate: new Date('2029-01-01'),
          },
        ],
      })
      const entry = await adjustment.calculate('project-1', data, 'USGAAP')

      expect(entry).not.toBeNull()
      expect(entry!.usgaapReference).toBe('ASC 842 Leases')
    })

    it('produces correct descriptions', async () => {
      const data = createSourceData({
        leases: [
          {
            id: 'lease-1',
            code: 'L001',
            name: 'オフィスリース',
            leaseType: 'operating',
            leaseTerm: 5,
            leasePayment: 1000000,
            paymentFrequency: 'monthly',
            startDate: new Date('2024-01-01'),
            endDate: new Date('2029-01-01'),
          },
        ],
      })
      const entry = await adjustment.calculate('project-1', data, 'IFRS')

      expect(entry!.description).toBe('オペレーティングリースの使用権資産・リース負債への計上')
      expect(entry!.descriptionEn).toBe(
        'Recognition of right-of-use assets and lease liabilities for operating leases'
      )
    })
  })

  describe('getReference', () => {
    it('returns IFRS 16 for IFRS', () => {
      expect(adjustment.getReference('IFRS')).toBe('IFRS 16 Leases')
    })

    it('returns ASC 842 for USGAAP', () => {
      expect(adjustment.getReference('USGAAP')).toBe('ASC 842 Leases')
    })
  })
})
