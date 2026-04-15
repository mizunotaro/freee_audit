import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    budgetPlan: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
    budgetVariance: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
  },
}))

import { prisma } from '@/lib/db'
import {
  createBudgetPlan,
  calculateVariances,
  recordVarianceReason,
  getBudgetPlans,
  getVariancesForBoardReport,
} from '@/services/budget-management'

describe('Budget Management Service', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('createBudgetPlan', () => {
    it('should create a plan with items', async () => {
      vi.mocked(prisma.budgetPlan.create).mockResolvedValue({ id: 'plan-1' } as never)

      const result = await createBudgetPlan({
        companyId: 'comp-1',
        fiscalYear: 2026,
        name: 'FY2026予算',
        items: [
          { accountItem: '売上高', month: 4, budgetAmount: 10000000 },
          { accountItem: '人件費', month: 4, budgetAmount: 5000000 },
        ],
      })

      expect(result.success).toBe(true)
    })

    it('should reject empty items', async () => {
      const result = await createBudgetPlan({
        companyId: 'comp-1',
        fiscalYear: 2026,
        name: 'Test',
        items: [],
      })
      expect(result.success).toBe(false)
    })

    it('should reject invalid fiscal year', async () => {
      const result = await createBudgetPlan({
        companyId: 'comp-1',
        fiscalYear: 1999,
        name: 'Test',
        items: [{ accountItem: 'Test', budgetAmount: 1000 }],
      })
      expect(result.success).toBe(false)
    })
  })

  describe('calculateVariances', () => {
    it('should detect significant variances (>10%)', async () => {
      vi.mocked(prisma.budgetPlan.findUnique).mockResolvedValue({
        id: 'plan-1',
        fiscalYear: 2026,
        name: 'FY2026',
        items: [
          { accountItem: '売上高', month: 4, budgetAmount: 10000000 },
          { accountItem: '人件費', month: 4, budgetAmount: 5000000 },
        ],
      } as never)
      vi.mocked(prisma.budgetVariance.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.budgetVariance.create).mockResolvedValue({} as never)

      const result = await calculateVariances({
        planId: 'plan-1',
        actualData: [
          { accountItem: '売上高', month: 4, amount: 8000000 },
          { accountItem: '人件費', month: 4, amount: 5200000 },
        ],
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.significantVariances.length).toBeGreaterThan(0)
        const salesVariance = result.data.significantVariances.find(
          (v) => v.accountItem === '売上高'
        )
        expect(salesVariance).toBeDefined()
        expect(salesVariance!.varianceRate).toBeLessThan(0)
      }
    })
  })

  describe('recordVarianceReason', () => {
    it('should record a reason', async () => {
      vi.mocked(prisma.budgetVariance.update).mockResolvedValue({ id: 'v-1' } as never)

      const result = await recordVarianceReason({
        varianceId: 'v-1',
        reason: '大型案件の受注遅延のため',
        boardReportNote:
          '4月の売上未達は大型案件の受注タイミングが5月にずれたため。5月に回復見込み。',
      })

      expect(result.success).toBe(true)
    })

    it('should reject empty reason', async () => {
      const result = await recordVarianceReason({
        varianceId: 'v-1',
        reason: '',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('getBudgetPlans', () => {
    it('should return plans', async () => {
      vi.mocked(prisma.budgetPlan.findMany).mockResolvedValue([
        { id: 'p1', name: 'FY2026', fiscalYear: 2026, version: 1, status: 'active' },
      ] as never)

      const result = await getBudgetPlans('comp-1', 2026)
      expect(result.success).toBe(true)
    })
  })

  describe('getVariancesForBoardReport', () => {
    it('should return actionable variances', async () => {
      vi.mocked(prisma.budgetVariance.findMany).mockResolvedValue([
        {
          accountItem: '売上高',
          month: 4,
          budgetAmount: 10000000,
          actualAmount: 8000000,
          variance: -2000000,
          varianceRate: -0.2,
          reason: '受注遅延',
          boardReportNote: '5月に回復見込み',
        },
      ] as never)

      const result = await getVariancesForBoardReport('plan-1')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(1)
        expect(result.data[0].boardReportNote).toContain('5月')
      }
    })
  })
})
