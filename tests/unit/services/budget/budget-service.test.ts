import { describe, it, expect, vi, beforeEach } from 'vitest'
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

describe('budget-service', () => {
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

  describe('createBudget', () => {
    it('should create a budget entry', async () => {
      const input: CreateBudgetInput = {
        companyId: 'company-1',
        fiscalYear: 2024,
        month: 12,
        accountCode: 'R001',
        accountName: '売上高',
        amount: 10000000,
      }

      vi.mocked(prisma.budget.create).mockResolvedValue(mockBudget)

      const result = await createBudget(input)

      expect(prisma.budget.create).toHaveBeenCalledWith({
        data: {
          companyId: input.companyId,
          fiscalYear: input.fiscalYear,
          month: input.month,
          departmentId: input.departmentId,
          accountCode: input.accountCode,
          accountName: input.accountName,
          amount: input.amount,
          note: input.note,
        },
      })
      expect(result).toEqual(mockBudget)
    })

    it('should create budget with department and note', async () => {
      const input: CreateBudgetInput = {
        companyId: 'company-1',
        fiscalYear: 2024,
        month: 12,
        departmentId: 'dept-1',
        accountCode: 'R001',
        accountName: '売上高',
        amount: 10000000,
        note: 'Test note',
      }

      vi.mocked(prisma.budget.create).mockResolvedValue({
        ...mockBudget,
        departmentId: 'dept-1',
        note: 'Test note',
      })

      const result = await createBudget(input)

      expect(result.departmentId).toBe('dept-1')
      expect(result.note).toBe('Test note')
    })
  })

  describe('createBudgetBatch', () => {
    it('should create multiple budget entries', async () => {
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
          accountCode: 'R001',
          accountName: '売上高',
          amount: 1100000,
        },
      ]

      vi.mocked(prisma.budget.createMany).mockResolvedValue({ count: 2 })

      const result = await createBudgetBatch(inputs)

      expect(prisma.budget.createMany).toHaveBeenCalled()
      expect(result).toBe(2)
    })
  })

  describe('updateBudget', () => {
    it('should update budget amount', async () => {
      const input: UpdateBudgetInput = { amount: 12000000 }

      vi.mocked(prisma.budget.update).mockResolvedValue({
        ...mockBudget,
        amount: 12000000,
      })

      const result = await updateBudget('budget-1', input)

      expect(prisma.budget.update).toHaveBeenCalledWith({
        where: { id: 'budget-1' },
        data: {
          amount: input.amount,
          departmentId: input.departmentId,
          note: input.note,
        },
      })
      expect(result.amount).toBe(12000000)
    })

    it('should update department and note', async () => {
      const input: UpdateBudgetInput = {
        departmentId: 'dept-2',
        note: 'Updated note',
      }

      vi.mocked(prisma.budget.update).mockResolvedValue({
        ...mockBudget,
        departmentId: 'dept-2',
        note: 'Updated note',
      })

      const result = await updateBudget('budget-1', input)

      expect(result.departmentId).toBe('dept-2')
      expect(result.note).toBe('Updated note')
    })
  })

  describe('upsertBudget', () => {
    it('should upsert budget entry', async () => {
      const input: CreateBudgetInput = {
        companyId: 'company-1',
        fiscalYear: 2024,
        month: 12,
        accountCode: 'R001',
        accountName: '売上高',
        amount: 10000000,
      }

      vi.mocked(prisma.budget.upsert).mockResolvedValue(mockBudget)

      const result = await upsertBudget(input)

      expect(prisma.budget.upsert).toHaveBeenCalledWith({
        where: {
          companyId_fiscalYear_month_departmentId_accountCode: {
            companyId: input.companyId,
            fiscalYear: input.fiscalYear,
            month: input.month,
            departmentId: input.departmentId || '',
            accountCode: input.accountCode,
          },
        },
        update: {
          amount: input.amount,
          accountName: input.accountName,
          note: input.note,
        },
        create: expect.objectContaining({
          companyId: input.companyId,
          fiscalYear: input.fiscalYear,
          month: input.month,
        }),
      })
      expect(result).toEqual(mockBudget)
    })
  })

  describe('getBudgetById', () => {
    it('should return budget by id', async () => {
      vi.mocked(prisma.budget.findUnique).mockResolvedValue(mockBudget)

      const result = await getBudgetById('budget-1')

      expect(prisma.budget.findUnique).toHaveBeenCalledWith({
        where: { id: 'budget-1' },
      })
      expect(result).toEqual(mockBudget)
    })

    it('should return null for non-existent budget', async () => {
      vi.mocked(prisma.budget.findUnique).mockResolvedValue(null)

      const result = await getBudgetById('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('getBudgets', () => {
    it('should return budgets with filter', async () => {
      const filter: BudgetFilter = {
        companyId: 'company-1',
        fiscalYear: 2024,
        month: 12,
      }

      vi.mocked(prisma.budget.findMany).mockResolvedValue([mockBudget])

      const result = await getBudgets(filter)

      expect(prisma.budget.findMany).toHaveBeenCalledWith({
        where: {
          companyId: filter.companyId,
          fiscalYear: filter.fiscalYear,
          month: filter.month,
          departmentId: undefined,
          accountCode: undefined,
        },
        orderBy: [{ accountCode: 'asc' }],
      })
      expect(result).toEqual([mockBudget])
    })

    it('should filter by accountCode prefix', async () => {
      const filter: BudgetFilter = {
        companyId: 'company-1',
        accountCode: 'R',
      }

      vi.mocked(prisma.budget.findMany).mockResolvedValue([mockBudget])

      await getBudgets(filter)

      expect(prisma.budget.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            accountCode: { startsWith: 'R' },
          }),
        })
      )
    })
  })

  describe('getBudgetsByFiscalYear', () => {
    it('should return budgets for fiscal year', async () => {
      vi.mocked(prisma.budget.findMany).mockResolvedValue([mockBudget])

      const result = await getBudgetsByFiscalYear('company-1', 2024)

      expect(prisma.budget.findMany).toHaveBeenCalledWith({
        where: {
          companyId: 'company-1',
          fiscalYear: 2024,
        },
        orderBy: [{ month: 'asc' }, { accountCode: 'asc' }],
      })
      expect(result).toEqual([mockBudget])
    })
  })

  describe('getBudgetsByMonth', () => {
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
  })

  describe('deleteBudget', () => {
    it('should delete budget by id', async () => {
      vi.mocked(prisma.budget.delete).mockResolvedValue(mockBudget)

      await deleteBudget('budget-1')

      expect(prisma.budget.delete).toHaveBeenCalledWith({
        where: { id: 'budget-1' },
      })
    })
  })

  describe('deleteBudgetsByFiscalYear', () => {
    it('should delete all budgets for fiscal year', async () => {
      vi.mocked(prisma.budget.deleteMany).mockResolvedValue({ count: 12 })

      const result = await deleteBudgetsByFiscalYear('company-1', 2024)

      expect(prisma.budget.deleteMany).toHaveBeenCalledWith({
        where: {
          companyId: 'company-1',
          fiscalYear: 2024,
        },
      })
      expect(result).toBe(12)
    })
  })

  describe('getBudgetSummary', () => {
    it('should return budget summary by account', async () => {
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
          accountCode: 'C001',
          accountName: '売上原価',
          amount: 600000,
        },
      ])

      const result = await getBudgetSummary('company-1', 2024, 12)

      expect(result).toHaveLength(2)
      const revenueSummary = result.find((s) => s.accountCode === 'R001')
      expect(revenueSummary?.totalBudget).toBe(1500000)
      expect(revenueSummary?.accountName).toBe('売上高')
    })

    it('should return empty array when no budgets', async () => {
      vi.mocked(prisma.budget.findMany).mockResolvedValue([])

      const result = await getBudgetSummary('company-1', 2024, 12)

      expect(result).toEqual([])
    })
  })
})
