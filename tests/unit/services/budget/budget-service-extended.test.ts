import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createBudget,
  createBudgetBatch,
  updateBudget,
  upsertBudget,
  getBudgetById,
  getBudgets,
  getBudgetsByFiscalYear,
  getBudgetsByMonth,
  deleteBudget,
  deleteBudgetsByFiscalYear,
  getBudgetSummary,
  type CreateBudgetInput,
  type UpdateBudgetInput,
  type BudgetFilter,
} from '@/services/budget/budget-service'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    budget: {
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))

describe('BudgetServiceExtended', () => {
  const mockBudget = {
    id: 'budget-1',
    companyId: 'company-1',
    fiscalYear: 2024,
    month: 12,
    departmentId: null,
    accountCode: 'R001',
    accountName: '売上高',
    amount: 10000000,
    note: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('createBudget - extended', () => {
    it('should create budget with all optional fields', async () => {
      const input: CreateBudgetInput = {
        companyId: 'company-1',
        fiscalYear: 2024,
        month: 6,
        departmentId: 'dept-1',
        accountCode: 'C001',
        accountName: '売上原価',
        amount: 5000000,
        note: 'Q2 budget adjustment',
      }

      vi.mocked(prisma.budget.create).mockResolvedValue({
        ...mockBudget,
        ...input,
      })

      const result = await createBudget(input)

      expect(result.departmentId).toBe('dept-1')
      expect(result.note).toBe('Q2 budget adjustment')
    })

    it('should handle zero amount budget', async () => {
      const input: CreateBudgetInput = {
        companyId: 'company-1',
        fiscalYear: 2024,
        month: 12,
        accountCode: 'R001',
        accountName: '売上高',
        amount: 0,
      }

      vi.mocked(prisma.budget.create).mockResolvedValue({
        ...mockBudget,
        amount: 0,
      })

      const result = await createBudget(input)

      expect(result.amount).toBe(0)
    })

    it('should handle negative amount budget', async () => {
      const input: CreateBudgetInput = {
        companyId: 'company-1',
        fiscalYear: 2024,
        month: 12,
        accountCode: 'R001',
        accountName: '売上高',
        amount: -1000000,
      }

      vi.mocked(prisma.budget.create).mockResolvedValue({
        ...mockBudget,
        amount: -1000000,
      })

      const result = await createBudget(input)

      expect(result.amount).toBe(-1000000)
    })

    it('should handle very large amount', async () => {
      const input: CreateBudgetInput = {
        companyId: 'company-1',
        fiscalYear: 2024,
        month: 12,
        accountCode: 'R001',
        accountName: '売上高',
        amount: 999999999999,
      }

      vi.mocked(prisma.budget.create).mockResolvedValue({
        ...mockBudget,
        amount: 999999999999,
      })

      const result = await createBudget(input)

      expect(result.amount).toBe(999999999999)
    })

    it('should handle special characters in account name', async () => {
      const input: CreateBudgetInput = {
        companyId: 'company-1',
        fiscalYear: 2024,
        month: 12,
        accountCode: 'R001',
        accountName: '売上高（テスト）&特別',
        amount: 1000000,
      }

      vi.mocked(prisma.budget.create).mockResolvedValue({
        ...mockBudget,
        accountName: '売上高（テスト）&特別',
      })

      const result = await createBudget(input)

      expect(result.accountName).toBe('売上高（テスト）&特別')
    })
  })

  describe('createBudgetBatch - extended', () => {
    it('should handle empty batch', async () => {
      vi.mocked(prisma.budget.createMany).mockResolvedValue({ count: 0 })

      const result = await createBudgetBatch([])

      expect(result).toBe(0)
    })

    it('should handle large batch', async () => {
      const inputs: CreateBudgetInput[] = Array.from({ length: 100 }, (_, i) => ({
        companyId: 'company-1',
        fiscalYear: 2024,
        month: (i % 12) + 1,
        accountCode: `R${String(i).padStart(3, '0')}`,
        accountName: `勘定科目${i}`,
        amount: 1000000,
      }))

      vi.mocked(prisma.budget.createMany).mockResolvedValue({ count: 100 })

      const result = await createBudgetBatch(inputs)

      expect(result).toBe(100)
    })

    it('should handle batch with mixed data', async () => {
      const inputs: CreateBudgetInput[] = [
        {
          companyId: 'company-1',
          fiscalYear: 2024,
          month: 1,
          accountCode: 'R001',
          accountName: '売上高',
          amount: 1000000,
        },
        {
          companyId: 'company-1',
          fiscalYear: 2024,
          month: 2,
          accountCode: 'C001',
          accountName: '売上原価',
          amount: 500000,
          departmentId: 'dept-1',
          note: 'With note',
        },
        {
          companyId: 'company-1',
          fiscalYear: 2024,
          month: 3,
          accountCode: 'E001',
          accountName: '経費',
          amount: 0,
        },
      ]

      vi.mocked(prisma.budget.createMany).mockResolvedValue({ count: 3 })

      const result = await createBudgetBatch(inputs)

      expect(result).toBe(3)
    })
  })

  describe('updateBudget - extended', () => {
    it('should update only amount', async () => {
      const input: UpdateBudgetInput = { amount: 15000000 }

      vi.mocked(prisma.budget.update).mockResolvedValue({
        ...mockBudget,
        amount: 15000000,
      })

      const result = await updateBudget('budget-1', input)

      expect(result.amount).toBe(15000000)
      expect(result.departmentId).toBeNull()
      expect(result.note).toBeNull()
    })

    it('should update departmentId to null', async () => {
      const input: UpdateBudgetInput = { departmentId: null }

      vi.mocked(prisma.budget.update).mockResolvedValue({
        ...mockBudget,
        departmentId: null,
      })

      const result = await updateBudget('budget-1', input)

      expect(result.departmentId).toBeNull()
    })

    it('should clear note by setting to undefined', async () => {
      const input: UpdateBudgetInput = { note: undefined }

      vi.mocked(prisma.budget.update).mockResolvedValue({
        ...mockBudget,
        note: null,
      })

      const result = await updateBudget('budget-1', input)

      expect(result.note).toBeNull()
    })

    it('should update all fields at once', async () => {
      const input: UpdateBudgetInput = {
        amount: 20000000,
        departmentId: 'dept-2',
        note: 'Updated note',
      }

      vi.mocked(prisma.budget.update).mockResolvedValue({
        ...mockBudget,
        ...input,
      })

      const result = await updateBudget('budget-1', input)

      expect(result.amount).toBe(20000000)
      expect(result.departmentId).toBe('dept-2')
      expect(result.note).toBe('Updated note')
    })
  })

  describe('upsertBudget - extended', () => {
    it('should handle upsert with empty departmentId', async () => {
      const input: CreateBudgetInput = {
        companyId: 'company-1',
        fiscalYear: 2024,
        month: 12,
        departmentId: '',
        accountCode: 'R001',
        accountName: '売上高',
        amount: 10000000,
      }

      vi.mocked(prisma.budget.upsert).mockResolvedValue(mockBudget)

      await upsertBudget(input)

      expect(prisma.budget.upsert).toHaveBeenCalledWith({
        where: {
          companyId_fiscalYear_month_departmentId_accountCode: {
            companyId: 'company-1',
            fiscalYear: 2024,
            month: 12,
            departmentId: '',
            accountCode: 'R001',
          },
        },
        update: {
          amount: 10000000,
          accountName: '売上高',
          note: undefined,
        },
        create: {
          companyId: 'company-1',
          fiscalYear: 2024,
          month: 12,
          departmentId: '',
          accountCode: 'R001',
          accountName: '売上高',
          amount: 10000000,
          note: undefined,
        },
      })
    })

    it('should handle upsert with all fields', async () => {
      const input: CreateBudgetInput = {
        companyId: 'company-1',
        fiscalYear: 2024,
        month: 6,
        departmentId: 'dept-1',
        accountCode: 'C001',
        accountName: '売上原価',
        amount: 5000000,
        note: 'Test note',
      }

      vi.mocked(prisma.budget.upsert).mockResolvedValue({
        ...mockBudget,
        ...input,
      })

      const result = await upsertBudget(input)

      expect(result).toBeDefined()
    })
  })

  describe('getBudgets - extended', () => {
    it('should filter by departmentId', async () => {
      const filter: BudgetFilter = {
        companyId: 'company-1',
        departmentId: 'dept-1',
      }

      vi.mocked(prisma.budget.findMany).mockResolvedValue([mockBudget])

      await getBudgets(filter)

      expect(prisma.budget.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            departmentId: 'dept-1',
          }),
        })
      )
    })

    it('should filter by fiscalYear only', async () => {
      const filter: BudgetFilter = {
        companyId: 'company-1',
        fiscalYear: 2024,
      }

      vi.mocked(prisma.budget.findMany).mockResolvedValue([mockBudget])

      await getBudgets(filter)

      expect(prisma.budget.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            fiscalYear: 2024,
          }),
        })
      )
    })

    it('should return empty array when no matches', async () => {
      vi.mocked(prisma.budget.findMany).mockResolvedValue([])

      const result = await getBudgets({
        companyId: 'company-1',
        fiscalYear: 2024,
        month: 12,
      })

      expect(result).toEqual([])
    })

    it('should order by accountCode ascending', async () => {
      vi.mocked(prisma.budget.findMany).mockResolvedValue([mockBudget])

      await getBudgets({ companyId: 'company-1' })

      expect(prisma.budget.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ accountCode: 'asc' }],
        })
      )
    })
  })

  describe('getBudgetsByFiscalYear - extended', () => {
    it('should order by month and accountCode', async () => {
      vi.mocked(prisma.budget.findMany).mockResolvedValue([mockBudget])

      await getBudgetsByFiscalYear('company-1', 2024)

      expect(prisma.budget.findMany).toHaveBeenCalledWith({
        where: {
          companyId: 'company-1',
          fiscalYear: 2024,
        },
        orderBy: [{ month: 'asc' }, { accountCode: 'asc' }],
      })
    })

    it('should return budgets for all 12 months', async () => {
      const budgets = Array.from({ length: 12 }, (_, i) => ({
        ...mockBudget,
        month: i + 1,
        id: `budget-${i + 1}`,
      }))

      vi.mocked(prisma.budget.findMany).mockResolvedValue(budgets)

      const result = await getBudgetsByFiscalYear('company-1', 2024)

      expect(result).toHaveLength(12)
    })
  })

  describe('getBudgetsByMonth - extended', () => {
    it('should return budgets for specific month', async () => {
      vi.mocked(prisma.budget.findMany).mockResolvedValue([mockBudget])

      const result = await getBudgetsByMonth('company-1', 2024, 12)

      expect(prisma.budget.findMany).toHaveBeenCalledWith({
        where: {
          companyId: 'company-1',
          fiscalYear: 2024,
          month: 12,
        },
        orderBy: [{ accountCode: 'asc' }],
      })
      expect(result).toEqual([mockBudget])
    })

    it('should return empty array for month with no budgets', async () => {
      vi.mocked(prisma.budget.findMany).mockResolvedValue([])

      const result = await getBudgetsByMonth('company-1', 2024, 1)

      expect(result).toEqual([])
    })
  })

  describe('deleteBudget - extended', () => {
    it('should delete budget and return void', async () => {
      vi.mocked(prisma.budget.delete).mockResolvedValue(mockBudget)

      await deleteBudget('budget-1')

      expect(prisma.budget.delete).toHaveBeenCalledWith({
        where: { id: 'budget-1' },
      })
    })
  })

  describe('deleteBudgetsByFiscalYear - extended', () => {
    it('should return count of deleted budgets', async () => {
      vi.mocked(prisma.budget.deleteMany).mockResolvedValue({ count: 24 })

      const result = await deleteBudgetsByFiscalYear('company-1', 2024)

      expect(result).toBe(24)
    })

    it('should return zero when no budgets to delete', async () => {
      vi.mocked(prisma.budget.deleteMany).mockResolvedValue({ count: 0 })

      const result = await deleteBudgetsByFiscalYear('company-1', 2024)

      expect(result).toBe(0)
    })
  })

  describe('getBudgetSummary - extended', () => {
    it('should aggregate multiple budgets with same accountCode', async () => {
      vi.mocked(prisma.budget.findMany).mockResolvedValue([
        { ...mockBudget, accountCode: 'R001', accountName: '売上高', amount: 1000000 },
        {
          ...mockBudget,
          id: 'budget-2',
          accountCode: 'R001',
          accountName: '売上高',
          amount: 500000,
        },
        {
          ...mockBudget,
          id: 'budget-3',
          accountCode: 'R001',
          accountName: '売上高',
          amount: 300000,
        },
      ])

      const result = await getBudgetSummary('company-1', 2024, 12)

      expect(result).toHaveLength(1)
      expect(result[0].accountCode).toBe('R001')
      expect(result[0].totalBudget).toBe(1800000)
    })

    it('should handle multiple different accountCodes', async () => {
      vi.mocked(prisma.budget.findMany).mockResolvedValue([
        { ...mockBudget, accountCode: 'R001', accountName: '売上高', amount: 10000000 },
        {
          ...mockBudget,
          id: 'budget-2',
          accountCode: 'C001',
          accountName: '売上原価',
          amount: 6000000,
        },
        {
          ...mockBudget,
          id: 'budget-3',
          accountCode: 'E001',
          accountName: '経費',
          amount: 2000000,
        },
      ])

      const result = await getBudgetSummary('company-1', 2024, 12)

      expect(result).toHaveLength(3)
      const codes = result.map((r) => r.accountCode)
      expect(codes).toContain('R001')
      expect(codes).toContain('C001')
      expect(codes).toContain('E001')
    })

    it('should use first accountName for duplicates', async () => {
      vi.mocked(prisma.budget.findMany).mockResolvedValue([
        { ...mockBudget, accountCode: 'R001', accountName: '売上高', amount: 1000000 },
        {
          ...mockBudget,
          id: 'budget-2',
          accountCode: 'R001',
          accountName: '売上高（別名）',
          amount: 500000,
        },
      ])

      const result = await getBudgetSummary('company-1', 2024, 12)

      expect(result[0].accountName).toBe('売上高')
    })

    it('should handle budgets with zero amounts', async () => {
      vi.mocked(prisma.budget.findMany).mockResolvedValue([
        { ...mockBudget, accountCode: 'R001', accountName: '売上高', amount: 0 },
        { ...mockBudget, id: 'budget-2', accountCode: 'C001', accountName: '売上原価', amount: 0 },
      ])

      const result = await getBudgetSummary('company-1', 2024, 12)

      expect(result).toHaveLength(2)
      expect(result[0].totalBudget).toBe(0)
      expect(result[1].totalBudget).toBe(0)
    })

    it('should handle budgets with negative amounts', async () => {
      vi.mocked(prisma.budget.findMany).mockResolvedValue([
        { ...mockBudget, accountCode: 'R001', accountName: '売上高', amount: 1000000 },
        {
          ...mockBudget,
          id: 'budget-2',
          accountCode: 'R001',
          accountName: '売上高',
          amount: -200000,
        },
      ])

      const result = await getBudgetSummary('company-1', 2024, 12)

      expect(result[0].totalBudget).toBe(800000)
    })
  })

  describe('edge cases', () => {
    it('should handle fiscal year boundary (year 2000)', async () => {
      vi.mocked(prisma.budget.findMany).mockResolvedValue([])

      const result = await getBudgetsByFiscalYear('company-1', 2000)

      expect(result).toEqual([])
    })

    it('should handle fiscal year boundary (year 2100)', async () => {
      vi.mocked(prisma.budget.findMany).mockResolvedValue([])

      const result = await getBudgetsByFiscalYear('company-1', 2100)

      expect(result).toEqual([])
    })

    it('should handle all months (1-12)', async () => {
      for (let month = 1; month <= 12; month++) {
        vi.mocked(prisma.budget.findMany).mockResolvedValue([{ ...mockBudget, month }])

        const result = await getBudgetsByMonth('company-1', 2024, month)

        expect(result).toBeDefined()
      }
    })

    it('should handle very long account names', async () => {
      const longName = 'あ'.repeat(500)
      const input: CreateBudgetInput = {
        companyId: 'company-1',
        fiscalYear: 2024,
        month: 12,
        accountCode: 'R001',
        accountName: longName,
        amount: 1000000,
      }

      vi.mocked(prisma.budget.create).mockResolvedValue({
        ...mockBudget,
        accountName: longName,
      })

      const result = await createBudget(input)

      expect(result.accountName).toBe(longName)
    })

    it('should handle special characters in account code', async () => {
      const input: CreateBudgetInput = {
        companyId: 'company-1',
        fiscalYear: 2024,
        month: 12,
        accountCode: 'R-001/A_B',
        accountName: '売上高',
        amount: 1000000,
      }

      vi.mocked(prisma.budget.create).mockResolvedValue({
        ...mockBudget,
        accountCode: 'R-001/A_B',
      })

      const result = await createBudget(input)

      expect(result.accountCode).toBe('R-001/A_B')
    })

    it('should handle very long notes', async () => {
      const longNote = 'テスト'.repeat(1000)
      const input: CreateBudgetInput = {
        companyId: 'company-1',
        fiscalYear: 2024,
        month: 12,
        accountCode: 'R001',
        accountName: '売上高',
        amount: 1000000,
        note: longNote,
      }

      vi.mocked(prisma.budget.create).mockResolvedValue({
        ...mockBudget,
        note: longNote,
      })

      const result = await createBudget(input)

      expect(result.note).toBe(longNote)
    })

    it('should handle unicode in departmentId', async () => {
      const input: CreateBudgetInput = {
        companyId: 'company-1',
        fiscalYear: 2024,
        month: 12,
        accountCode: 'R001',
        accountName: '売上高',
        amount: 1000000,
        departmentId: 'dept-日本語-テスト',
      }

      vi.mocked(prisma.budget.create).mockResolvedValue({
        ...mockBudget,
        departmentId: 'dept-日本語-テスト',
      })

      const result = await createBudget(input)

      expect(result.departmentId).toBe('dept-日本語-テスト')
    })
  })
})
