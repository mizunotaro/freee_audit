import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  syncAccountItemsFromFreee,
  getAccountItems,
  getAccountItemsByCategory,
  groupAccountItemsByCategory,
} from '@/services/account-items/account-items-service'
import { prisma } from '@/lib/db'
import { freeeClient } from '@/integrations/freee/client'

vi.mock('@/lib/db', () => ({
  prisma: {
    accountItem: {
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/integrations/freee/client', () => ({
  freeeClient: {
    getAccountItems: vi.fn(),
  },
}))

describe('AccountItemsService', () => {
  const mockCompanyId = 'company-1'
  const mockFreeeCompanyId = 12345

  const mockFreeeAccountItem: any = {
    id: 1,
    name: '現金',
    shortcut: 'GEN',
    shortcut_num: '100',
    account_category_id: 1,
    account_category_name: '流動資産',
    account_category: 'current_assets',
    account_category_balance: 'debit',
    corresponding_income_id: null,
    corresponding_income_name: null,
    corresponding_expense_id: null,
    corresponding_expense_name: null,
    searchable: true,
    cumulable: false,
    wallettx_account_name: null,
    partner_id: null,
    walletable_id: null,
  }

  const mockAccountItem = {
    id: 'item-1',
    companyId: mockCompanyId,
    freeeId: 1,
    name: '現金',
    shortcut: 'GEN',
    shortcutNum: '100',
    categoryId: 1,
    categoryName: '流動資産',
    categoryType: 'current_assets',
    correspondingIncomeId: null,
    correspondingIncomeName: null,
    correspondingExpenseId: null,
    correspondingExpenseName: null,
    searchable: true,
    cumulable: false,
    balance: 'debit' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('syncAccountItemsFromFreee', () => {
    it('should sync account items successfully', async () => {
      vi.mocked(freeeClient.getAccountItems).mockResolvedValue({
        data: [mockFreeeAccountItem],
        error: undefined,
      })
      vi.mocked(prisma.accountItem.upsert).mockResolvedValue(mockAccountItem as any)

      const result = await syncAccountItemsFromFreee(mockCompanyId, mockFreeeCompanyId)

      expect(result.success).toBe(true)
      expect(result.imported).toBe(1)
    })

    it('should return error when freee API fails', async () => {
      vi.mocked(freeeClient.getAccountItems).mockResolvedValue({
        data: undefined,
        error: { message: 'API Error', code: 'API_ERROR' } as any,
      })

      const result = await syncAccountItemsFromFreee(mockCompanyId, mockFreeeCompanyId)

      expect(result.success).toBe(false)
      expect(result.error).toBe('API Error')
      expect(result.imported).toBe(0)
    })

    it('should handle empty account items', async () => {
      vi.mocked(freeeClient.getAccountItems).mockResolvedValue({
        data: [],
        error: undefined,
      })

      const result = await syncAccountItemsFromFreee(mockCompanyId, mockFreeeCompanyId)

      expect(result.success).toBe(true)
      expect(result.imported).toBe(0)
    })

    it('should sync multiple account items', async () => {
      vi.mocked(freeeClient.getAccountItems).mockResolvedValue({
        data: [
          mockFreeeAccountItem,
          { ...mockFreeeAccountItem, id: 2, name: '普通預金' },
          { ...mockFreeeAccountItem, id: 3, name: '売掛金' },
        ],
        error: undefined,
      })
      vi.mocked(prisma.accountItem.upsert).mockResolvedValue(mockAccountItem as any)

      const result = await syncAccountItemsFromFreee(mockCompanyId, mockFreeeCompanyId)

      expect(result.imported).toBe(3)
      expect(prisma.accountItem.upsert).toHaveBeenCalledTimes(3)
    })

    it('should handle sync exceptions', async () => {
      vi.mocked(freeeClient.getAccountItems).mockRejectedValue(new Error('Network error'))

      const result = await syncAccountItemsFromFreee(mockCompanyId, mockFreeeCompanyId)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Network error')
    })

    it('should handle unknown error types', async () => {
      vi.mocked(freeeClient.getAccountItems).mockRejectedValue('Unknown error')

      const result = await syncAccountItemsFromFreee(mockCompanyId, mockFreeeCompanyId)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Unknown error')
    })

    it('should map category types correctly', async () => {
      const categories = [
        { category: 'current_assets', expected: 'current_assets' },
        { category: 'fixed_assets', expected: 'fixed_assets' },
        { category: 'current_liabilities', expected: 'current_liabilities' },
        { category: 'sales', expected: 'sales' },
        { category: 'sga_expenses', expected: 'sga_expenses' },
        { category: 'unknown_category', expected: 'sga_expenses' },
      ]

      for (const { category, expected } of categories) {
        vi.mocked(freeeClient.getAccountItems).mockResolvedValue({
          data: [{ ...mockFreeeAccountItem, account_category: category }],
          error: undefined,
        })
        vi.mocked(prisma.accountItem.upsert).mockResolvedValue(mockAccountItem as any)

        await syncAccountItemsFromFreee(mockCompanyId, mockFreeeCompanyId)

        expect(prisma.accountItem.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            create: expect.objectContaining({
              categoryType: expected,
            }),
          })
        )
      }
    })
  })

  describe('getAccountItems', () => {
    it('should return account items for company', async () => {
      vi.mocked(prisma.accountItem.findMany).mockResolvedValue([mockAccountItem] as any)

      const result = await getAccountItems(mockCompanyId)

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('現金')
    })

    it('should return empty array when no items', async () => {
      vi.mocked(prisma.accountItem.findMany).mockResolvedValue([])

      const result = await getAccountItems(mockCompanyId)

      expect(result).toEqual([])
    })

    it('should order by category and shortcut number', async () => {
      vi.mocked(prisma.accountItem.findMany).mockResolvedValue([])

      await getAccountItems(mockCompanyId)

      expect(prisma.accountItem.findMany).toHaveBeenCalledWith({
        where: { companyId: mockCompanyId },
        orderBy: [{ categoryId: 'asc' }, { shortcutNum: 'asc' }],
      })
    })
  })

  describe('getAccountItemsByCategory', () => {
    it('should return account items by category', async () => {
      vi.mocked(prisma.accountItem.findMany).mockResolvedValue([mockAccountItem] as any)

      const result = await getAccountItemsByCategory(mockCompanyId, 'current_assets')

      expect(result).toHaveLength(1)
      expect(result[0].categoryType).toBe('current_assets')
    })

    it('should filter by category type', async () => {
      vi.mocked(prisma.accountItem.findMany).mockResolvedValue([])

      await getAccountItemsByCategory(mockCompanyId, 'fixed_assets')

      expect(prisma.accountItem.findMany).toHaveBeenCalledWith({
        where: { companyId: mockCompanyId, categoryType: 'fixed_assets' },
        orderBy: { shortcutNum: 'asc' },
      })
    })

    it('should return empty array for non-existent category', async () => {
      vi.mocked(prisma.accountItem.findMany).mockResolvedValue([])

      const result = await getAccountItemsByCategory(mockCompanyId, 'non_existent' as any)

      expect(result).toEqual([])
    })
  })

  describe('groupAccountItemsByCategory', () => {
    it('should group items by category', () => {
      const items = [
        { ...mockAccountItem, categoryName: '流動資産', name: '現金' },
        { ...mockAccountItem, categoryName: '流動資産', name: '預金' },
        { ...mockAccountItem, categoryName: '固定資産', name: '建物' },
      ] as any[]

      const result = groupAccountItemsByCategory(items)

      expect(result.size).toBe(2)
      expect(result.get('流動資産')?.length).toBe(2)
      expect(result.get('固定資産')?.length).toBe(1)
    })

    it('should handle empty array', () => {
      const result = groupAccountItemsByCategory([])

      expect(result.size).toBe(0)
    })

    it('should handle single item', () => {
      const result = groupAccountItemsByCategory([mockAccountItem] as any)

      expect(result.size).toBe(1)
    })

    it('should handle items with same category', () => {
      const items = [
        { ...mockAccountItem, categoryName: '流動資産' },
        { ...mockAccountItem, categoryName: '流動資産' },
        { ...mockAccountItem, categoryName: '流動資産' },
      ] as any[]

      const result = groupAccountItemsByCategory(items)

      expect(result.size).toBe(1)
      expect(result.get('流動資産')?.length).toBe(3)
    })
  })

  describe('edge cases', () => {
    it('should handle account item with null optional fields', async () => {
      const itemWithNulls = {
        ...mockFreeeAccountItem,
        shortcut: null,
        shortcut_num: null,
        corresponding_income_id: null,
        corresponding_expense_id: null,
      }

      vi.mocked(freeeClient.getAccountItems).mockResolvedValue({
        data: [itemWithNulls],
        error: undefined,
      })
      vi.mocked(prisma.accountItem.upsert).mockResolvedValue(mockAccountItem as any)

      const result = await syncAccountItemsFromFreee(mockCompanyId, mockFreeeCompanyId)

      expect(result.success).toBe(true)
    })

    it('should handle very long account names', async () => {
      const longNameItem = {
        ...mockFreeeAccountItem,
        name: 'A'.repeat(500),
      }

      vi.mocked(freeeClient.getAccountItems).mockResolvedValue({
        data: [longNameItem],
        error: undefined,
      })
      vi.mocked(prisma.accountItem.upsert).mockResolvedValue(mockAccountItem as any)

      const result = await syncAccountItemsFromFreee(mockCompanyId, mockFreeeCompanyId)

      expect(result.success).toBe(true)
    })

    it('should handle special characters in account names', async () => {
      const specialCharItem = {
        ...mockFreeeAccountItem,
        name: '売上＆収益<特殊>',
      }

      vi.mocked(freeeClient.getAccountItems).mockResolvedValue({
        data: [specialCharItem],
        error: undefined,
      })
      vi.mocked(prisma.accountItem.upsert).mockResolvedValue(mockAccountItem as any)

      const result = await syncAccountItemsFromFreee(mockCompanyId, mockFreeeCompanyId)

      expect(result.success).toBe(true)
    })
  })
})
