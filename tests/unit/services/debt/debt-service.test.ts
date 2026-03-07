import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  syncDebtsFromFreee,
  getCashOutForecasts,
  getMonthlyCashOutSummary,
  getTotalUpcomingCashOut,
} from '@/services/debt/debt-service'
import { prisma } from '@/lib/db'
import { freeeClient } from '@/integrations/freee/client'

vi.mock('@/lib/db', () => ({
  prisma: {
    debt: {
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/integrations/freee/client', () => ({
  freeeClient: {
    getDeals: vi.fn(),
  },
}))

describe('debt-service', () => {
  const mockCompanyId = 'company-1'
  const mockFreeeCompanyId = 12345

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('syncDebtsFromFreee', () => {
    it('should sync debts from freee successfully', async () => {
      vi.mocked(freeeClient.getDeals).mockResolvedValue({
        data: [
          {
            id: 1,
            company_id: mockFreeeCompanyId,
            issue_date: '2024-01-01',
            partner_id: 100,
            partner: { id: 100, name: '取引先A', shortcut: 'A' },
            due_date: '2024-12-31',
            due_amount: 100000,
            amount: 100000,
            status: 'unsettled',
            details: [
              {
                account_item_id: 1,
                account_item_name: '買掛金',
                amount: 100000,
                description: '請求書 #001',
                vat_id: null,
                vat_name: null,
              },
            ],
            payments: [],
          },
        ],
      })

      vi.mocked(prisma.debt.upsert).mockResolvedValue({} as any)

      const result = await syncDebtsFromFreee(mockCompanyId, mockFreeeCompanyId)

      expect(result.success).toBe(true)
      expect(result.imported).toBe(1)
    })

    it('should handle freee API error', async () => {
      vi.mocked(freeeClient.getDeals).mockResolvedValue({
        error: { message: 'API Error', code: '500' },
      })

      const result = await syncDebtsFromFreee(mockCompanyId, mockFreeeCompanyId)

      expect(result.success).toBe(false)
      expect(result.imported).toBe(0)
      expect(result.error).toBe('API Error')
    })

    it('should skip deals without due date', async () => {
      vi.mocked(freeeClient.getDeals).mockResolvedValue({
        data: [
          {
            id: 1,
            company_id: mockFreeeCompanyId,
            issue_date: '2024-01-01',
            partner_id: 100,
            partner: { id: 100, name: '取引先A', shortcut: 'A' },
            due_date: null,
            due_amount: 100000,
            amount: 100000,
            status: 'unsettled',
            details: [
              {
                account_item_id: 1,
                account_item_name: '買掛金',
                amount: 100000,
                description: '請求書 #001',
                vat_id: null,
                vat_name: null,
              },
            ],
            payments: [],
          },
        ],
      })

      const result = await syncDebtsFromFreee(mockCompanyId, mockFreeeCompanyId)

      expect(result.imported).toBe(0)
    })

    it('should skip deals with zero due amount', async () => {
      vi.mocked(freeeClient.getDeals).mockResolvedValue({
        data: [
          {
            id: 1,
            company_id: mockFreeeCompanyId,
            issue_date: '2024-01-01',
            partner_id: 100,
            partner: { id: 100, name: '取引先A', shortcut: 'A' },
            due_date: '2024-12-31',
            due_amount: 0,
            amount: 0,
            status: 'unsettled',
            details: [
              {
                account_item_id: 1,
                account_item_name: '買掛金',
                amount: 0,
                description: '請求書 #001',
                vat_id: null,
                vat_name: null,
              },
            ],
            payments: [],
          },
        ],
      })

      const result = await syncDebtsFromFreee(mockCompanyId, mockFreeeCompanyId)

      expect(result.imported).toBe(0)
    })

    it('should mark overdue debts correctly', async () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 10)

      vi.mocked(freeeClient.getDeals).mockResolvedValue({
        data: [
          {
            id: 1,
            company_id: mockFreeeCompanyId,
            issue_date: '2024-01-01',
            partner_id: 100,
            partner: { id: 100, name: '取引先A', shortcut: 'A' },
            due_date: pastDate.toISOString().split('T')[0],
            due_amount: 100000,
            amount: 100000,
            status: 'unsettled',
            details: [
              {
                account_item_id: 1,
                account_item_name: '買掛金',
                amount: 100000,
                description: '請求書 #001',
                vat_id: null,
                vat_name: null,
              },
            ],
            payments: [],
          },
        ],
      })

      vi.mocked(prisma.debt.upsert).mockResolvedValue({} as any)

      await syncDebtsFromFreee(mockCompanyId, mockFreeeCompanyId)

      expect(prisma.debt.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            status: 'OVERDUE',
          }),
        })
      )
    })

    it('should categorize debts as payable', async () => {
      vi.mocked(freeeClient.getDeals).mockResolvedValue({
        data: [
          {
            id: 1,
            company_id: mockFreeeCompanyId,
            issue_date: '2024-01-01',
            partner_id: 100,
            partner: { id: 100, name: '取引先A', shortcut: 'A' },
            due_date: '2025-12-31',
            due_amount: 100000,
            amount: 100000,
            status: 'unsettled',
            details: [
              {
                account_item_id: 1,
                account_item_name: '買掛金',
                amount: 100000,
                description: '請求書 #001',
                vat_id: null,
                vat_name: null,
              },
            ],
            payments: [],
          },
        ],
      })

      vi.mocked(prisma.debt.upsert).mockResolvedValue({} as any)

      await syncDebtsFromFreee(mockCompanyId, mockFreeeCompanyId)

      expect(prisma.debt.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            category: 'payable',
          }),
        })
      )
    })

    it('should categorize debts as loan', async () => {
      vi.mocked(freeeClient.getDeals).mockResolvedValue({
        data: [
          {
            id: 1,
            company_id: mockFreeeCompanyId,
            issue_date: '2024-01-01',
            partner_id: 100,
            partner: { id: 100, name: '銀行', shortcut: 'B' },
            due_date: '2025-12-31',
            due_amount: 1000000,
            amount: 1000000,
            status: 'unsettled',
            details: [
              {
                account_item_id: 2,
                account_item_name: '長期借入金',
                amount: 1000000,
                description: '借入',
                vat_id: null,
                vat_name: null,
              },
            ],
            payments: [],
          },
        ],
      })

      vi.mocked(prisma.debt.upsert).mockResolvedValue({} as any)

      await syncDebtsFromFreee(mockCompanyId, mockFreeeCompanyId)

      expect(prisma.debt.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            category: 'loan',
          }),
        })
      )
    })

    it('should handle empty deals list', async () => {
      vi.mocked(freeeClient.getDeals).mockResolvedValue({
        data: [],
      })

      const result = await syncDebtsFromFreee(mockCompanyId, mockFreeeCompanyId)

      expect(result.success).toBe(true)
      expect(result.imported).toBe(0)
    })

    it('should handle exception', async () => {
      vi.mocked(freeeClient.getDeals).mockRejectedValue(new Error('Network error'))

      const result = await syncDebtsFromFreee(mockCompanyId, mockFreeeCompanyId)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Network error')
    })

    it('should use custom months ahead parameter', async () => {
      vi.mocked(freeeClient.getDeals).mockResolvedValue({
        data: [],
      })

      await syncDebtsFromFreee(mockCompanyId, mockFreeeCompanyId, 12)

      expect(freeeClient.getDeals).toHaveBeenCalled()
    })
  })

  describe('getCashOutForecasts', () => {
    it('should return cash out forecasts', async () => {
      const futureDate = new Date()
      futureDate.setMonth(futureDate.getMonth() + 1)

      vi.mocked(prisma.debt.findMany).mockResolvedValue([
        {
          id: 'debt-1',
          companyId: mockCompanyId,
          amount: 100000,
          dueDate: futureDate,
          category: 'payable',
          description: '請求書 #001',
          partnerName: '取引先A',
          status: 'PENDING',
        } as any,
      ])

      const result = await getCashOutForecasts(mockCompanyId)

      expect(result).toHaveLength(1)
      expect(result[0].amount).toBe(100000)
      expect(result[0].category).toBe('payable')
    })

    it('should calculate urgency as high for overdue debts', async () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 5)

      vi.mocked(prisma.debt.findMany).mockResolvedValue([
        {
          id: 'debt-1',
          companyId: mockCompanyId,
          amount: 100000,
          dueDate: pastDate,
          category: 'payable',
          description: '請求書',
          partnerName: '取引先A',
          status: 'OVERDUE',
        } as any,
      ])

      const result = await getCashOutForecasts(mockCompanyId)

      expect(result[0].urgency).toBe('high')
    })

    it('should calculate urgency as high for debts due within 7 days', async () => {
      const nearDate = new Date()
      nearDate.setDate(nearDate.getDate() + 5)

      vi.mocked(prisma.debt.findMany).mockResolvedValue([
        {
          id: 'debt-1',
          companyId: mockCompanyId,
          amount: 100000,
          dueDate: nearDate,
          category: 'payable',
          description: '請求書',
          partnerName: '取引先A',
          status: 'PENDING',
        } as any,
      ])

      const result = await getCashOutForecasts(mockCompanyId)

      expect(result[0].urgency).toBe('high')
    })

    it('should calculate urgency as medium for debts due within 30 days', async () => {
      const mediumDate = new Date()
      mediumDate.setDate(mediumDate.getDate() + 15)

      vi.mocked(prisma.debt.findMany).mockResolvedValue([
        {
          id: 'debt-1',
          companyId: mockCompanyId,
          amount: 100000,
          dueDate: mediumDate,
          category: 'payable',
          description: '請求書',
          partnerName: '取引先A',
          status: 'PENDING',
        } as any,
      ])

      const result = await getCashOutForecasts(mockCompanyId)

      expect(result[0].urgency).toBe('medium')
    })

    it('should calculate urgency as low for debts due after 30 days', async () => {
      const farDate = new Date()
      farDate.setDate(farDate.getDate() + 60)

      vi.mocked(prisma.debt.findMany).mockResolvedValue([
        {
          id: 'debt-1',
          companyId: mockCompanyId,
          amount: 100000,
          dueDate: farDate,
          category: 'payable',
          description: '請求書',
          partnerName: '取引先A',
          status: 'PENDING',
        } as any,
      ])

      const result = await getCashOutForecasts(mockCompanyId)

      expect(result[0].urgency).toBe('low')
    })

    it('should filter by custom months ahead', async () => {
      vi.mocked(prisma.debt.findMany).mockResolvedValue([])

      await getCashOutForecasts(mockCompanyId, 6)

      expect(prisma.debt.findMany).toHaveBeenCalled()
    })

    it('should exclude paid debts', async () => {
      vi.mocked(prisma.debt.findMany).mockResolvedValue([])

      await getCashOutForecasts(mockCompanyId)

      expect(prisma.debt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['PENDING', 'OVERDUE'] },
          }),
        })
      )
    })
  })

  describe('getMonthlyCashOutSummary', () => {
    it('should group forecasts by month', async () => {
      const date1 = new Date('2024-12-15')
      const date2 = new Date('2024-12-25')
      const date3 = new Date('2025-01-15')

      vi.mocked(prisma.debt.findMany).mockResolvedValue([
        {
          id: 'debt-1',
          companyId: mockCompanyId,
          amount: 100000,
          dueDate: date1,
          category: 'payable',
          status: 'PENDING',
        } as any,
        {
          id: 'debt-2',
          companyId: mockCompanyId,
          amount: 200000,
          dueDate: date2,
          category: 'loan',
          status: 'PENDING',
        } as any,
        {
          id: 'debt-3',
          companyId: mockCompanyId,
          amount: 150000,
          dueDate: date3,
          category: 'payable',
          status: 'PENDING',
        } as any,
      ])

      const result = await getMonthlyCashOutSummary(mockCompanyId)

      expect(result.length).toBeGreaterThanOrEqual(1)
    })

    it('should calculate total amount per month', async () => {
      const date = new Date('2024-12-15')

      vi.mocked(prisma.debt.findMany).mockResolvedValue([
        {
          id: 'debt-1',
          companyId: mockCompanyId,
          amount: 100000,
          dueDate: date,
          category: 'payable',
          status: 'PENDING',
        } as any,
        {
          id: 'debt-2',
          companyId: mockCompanyId,
          amount: 200000,
          dueDate: date,
          category: 'loan',
          status: 'PENDING',
        } as any,
      ])

      const result = await getMonthlyCashOutSummary(mockCompanyId)

      const decSummary = result.find((s) => s.month === '2024-12')
      expect(decSummary?.totalAmount).toBe(300000)
    })

    it('should count items per month', async () => {
      const date = new Date('2024-12-15')

      vi.mocked(prisma.debt.findMany).mockResolvedValue([
        {
          id: 'debt-1',
          companyId: mockCompanyId,
          amount: 100000,
          dueDate: date,
          category: 'payable',
          status: 'PENDING',
        } as any,
        {
          id: 'debt-2',
          companyId: mockCompanyId,
          amount: 200000,
          dueDate: date,
          category: 'loan',
          status: 'PENDING',
        } as any,
      ])

      const result = await getMonthlyCashOutSummary(mockCompanyId)

      const decSummary = result.find((s) => s.month === '2024-12')
      expect(decSummary?.itemCount).toBe(2)
    })

    it('should categorize amounts correctly', async () => {
      const date = new Date('2024-12-15')

      vi.mocked(prisma.debt.findMany).mockResolvedValue([
        {
          id: 'debt-1',
          companyId: mockCompanyId,
          amount: 100000,
          dueDate: date,
          category: 'payable',
          status: 'PENDING',
        } as any,
        {
          id: 'debt-2',
          companyId: mockCompanyId,
          amount: 200000,
          dueDate: date,
          category: 'loan',
          status: 'PENDING',
        } as any,
      ])

      const result = await getMonthlyCashOutSummary(mockCompanyId)

      const decSummary = result.find((s) => s.month === '2024-12')
      expect(decSummary?.categories.payable).toBe(100000)
      expect(decSummary?.categories.loan).toBe(200000)
    })
  })

  describe('getTotalUpcomingCashOut', () => {
    it('should return total upcoming cash out', async () => {
      vi.mocked(prisma.debt.findMany).mockResolvedValue([
        { amount: 100000 } as any,
        { amount: 200000 } as any,
      ])

      const result = await getTotalUpcomingCashOut(mockCompanyId)

      expect(result).toBe(300000)
    })

    it('should return zero when no debts', async () => {
      vi.mocked(prisma.debt.findMany).mockResolvedValue([])

      const result = await getTotalUpcomingCashOut(mockCompanyId)

      expect(result).toBe(0)
    })

    it('should use custom days parameter', async () => {
      vi.mocked(prisma.debt.findMany).mockResolvedValue([])

      await getTotalUpcomingCashOut(mockCompanyId, 60)

      expect(prisma.debt.findMany).toHaveBeenCalled()
    })
  })
})
