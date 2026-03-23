import { describe, it, expect, beforeEach, vi } from 'vitest'
import { BusinessReportDataAggregator } from '@/services/reports/business-report/data-aggregator'

vi.mock('@/lib/db', () => ({
  prisma: {
    company: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ id: 'company-123', name: 'Test Company', fiscalYearStart: 1 }),
    },
    monthlyBalance: { findMany: vi.fn().mockResolvedValue([]) },
    shareholderComposition: { findMany: vi.fn().mockResolvedValue([]) },
    user: { findMany: vi.fn().mockResolvedValue([]) },
    boardMeeting: { findMany: vi.fn().mockResolvedValue([]) },
    journal: { findMany: vi.fn().mockResolvedValue([]) },
    fixedAsset: { findMany: vi.fn().mockResolvedValue([]) },
  },
}))

describe('BusinessReportDataAggregator', () => {
  let aggregator: BusinessReportDataAggregator

  beforeEach(() => {
    aggregator = new BusinessReportDataAggregator()
  })

  describe('aggregate', () => {
    it('should return aggregated data', async () => {
      const result = await aggregator.aggregate('company-123', 2024)
      expect(result).toBeDefined()
      expect(result.companyInfo).toBeDefined()
      expect(result.financialData).toBeDefined()
    })

    it('should validate data', async () => {
      const result = await aggregator.validateData({
        companyInfo: { id: 'test', name: 'Test Company', fiscalYearStart: 1 },
        financialData: {
          monthlyBalances: [
            { month: 1, fiscalYear: 2024, category: 'revenue', accountName: 'Sales', amount: 1000 },
          ],
          currentYearTotals: { revenue: 1000 },
          previousYearTotals: {},
        },
        shareholders: {
          totalShares: 1000,
          shareholderComposition: [{ type: 'individual', numberOfShares: 1000, percentage: 100 }],
        },
        officers: {
          directors: [{ id: '1', name: 'Director A', position: 'President' }],
          auditors: [],
        },
        boardMeetings: [],
        journals: { entries: [], totals: {} },
        fixedAssets: [],
        relatedParties: [],
        calculatedMetrics: {
          revenueGrowth: 0,
          operatingMargin: 0,
          netMargin: 0,
          roe: 0,
          roa: 1,
          currentRatio: 1,
          debtToEquity: 0,
        },
      })
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })
})
