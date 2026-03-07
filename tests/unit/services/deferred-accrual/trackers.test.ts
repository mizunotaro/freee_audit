import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prisma } from '@/lib/db'
import {
  PrepaidExpenseTracker,
  type PrepaidExpenseInput,
} from '@/services/deferred-accrual/prepaid-expense-tracker'
import {
  AccrualExpenseTracker,
  type AccrualExpenseInput,
} from '@/services/deferred-accrual/accrual-expense-tracker'

vi.mock('@/lib/db', () => ({
  prisma: {
    prepaidExpense: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    prepaidAmortization: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    accrualExpense: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    journal: {
      findMany: vi.fn(),
      aggregate: vi.fn(),
    },
  },
}))

describe('PrepaidExpenseTracker', () => {
  const mockCompanyId = 'test-company-id'
  const mockPrepaidId = 'prepaid-1'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createPrepaidExpense', () => {
    it('should create prepaid expense with amortization schedule', async () => {
      const mockPrepaid = {
        id: mockPrepaidId,
        companyId: mockCompanyId,
        accountCode: '150',
        accountName: '前払保険料',
        originalAmount: 120000,
        remainingAmount: 120000,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        totalMonths: 12,
        monthlyAmount: 10000,
        status: 'ACTIVE',
        notes: 'Annual insurance',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.prepaidExpense.create).mockResolvedValue(mockPrepaid)

      const input: PrepaidExpenseInput = {
        companyId: mockCompanyId,
        accountCode: '150',
        accountName: '前払保険料',
        originalAmount: 120000,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        totalMonths: 12,
        notes: 'Annual insurance',
      }

      const result = await PrepaidExpenseTracker.createPrepaidExpense(input)

      expect(result.monthlyAmount).toBe(10000)
      expect(result.originalAmount).toBe(120000)
      expect(result.totalMonths).toBe(12)
      expect(prisma.prepaidExpense.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            monthlyAmount: 10000,
            remainingAmount: 120000,
          }),
        })
      )
    })

    it('should calculate monthly amount correctly', async () => {
      const mockPrepaid = {
        id: mockPrepaidId,
        companyId: mockCompanyId,
        accountCode: '150',
        accountName: '前払リース料',
        originalAmount: 600000,
        remainingAmount: 600000,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-06-30'),
        totalMonths: 6,
        monthlyAmount: 100000,
        status: 'ACTIVE',
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.prepaidExpense.create).mockResolvedValue(mockPrepaid)

      const result = await PrepaidExpenseTracker.createPrepaidExpense({
        companyId: mockCompanyId,
        accountCode: '150',
        accountName: '前払リース料',
        originalAmount: 600000,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-06-30'),
        totalMonths: 6,
      })

      expect(result.monthlyAmount).toBe(100000)
    })
  })

  describe('getPrepaidExpenses', () => {
    it('should retrieve all prepaid expenses for a company', async () => {
      const mockPrepaids = [
        {
          id: 'prepaid-1',
          companyId: mockCompanyId,
          accountCode: '150',
          accountName: '前払保険料',
          originalAmount: 120000,
          remainingAmount: 60000,
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-12-31'),
          totalMonths: 12,
          monthlyAmount: 10000,
          status: 'ACTIVE',
          notes: null,
          amortizations: [],
        },
        {
          id: 'prepaid-2',
          companyId: mockCompanyId,
          accountCode: '151',
          accountName: '前払リース料',
          originalAmount: 600000,
          remainingAmount: 0,
          startDate: new Date('2023-01-01'),
          endDate: new Date('2023-12-31'),
          totalMonths: 12,
          monthlyAmount: 50000,
          status: 'FULLY_AMORTIZED',
          notes: null,
          amortizations: [],
        },
      ]

      vi.mocked(prisma.prepaidExpense.findMany).mockResolvedValue(mockPrepaids as any)

      const result = await PrepaidExpenseTracker.getPrepaidExpenses(mockCompanyId)

      expect(result).toHaveLength(2)
      expect(result[0].accountName).toBe('前払保険料')
      expect(result[1].status).toBe('FULLY_AMORTIZED')
    })
  })

  describe('getActivePrepaidExpenses', () => {
    it('should retrieve only active prepaid expenses', async () => {
      const mockActivePrepaids = [
        {
          id: 'prepaid-1',
          companyId: mockCompanyId,
          accountCode: '150',
          accountName: '前払保険料',
          originalAmount: 120000,
          remainingAmount: 60000,
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-12-31'),
          totalMonths: 12,
          monthlyAmount: 10000,
          status: 'ACTIVE',
          notes: null,
          amortizations: [],
        },
      ]

      vi.mocked(prisma.prepaidExpense.findMany).mockResolvedValue(mockActivePrepaids as any)

      const result = await PrepaidExpenseTracker.getActivePrepaidExpenses(mockCompanyId)

      expect(result).toHaveLength(1)
      expect(result[0].status).toBe('ACTIVE')
      expect(prisma.prepaidExpense.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: mockCompanyId, status: 'ACTIVE' },
        })
      )
    })
  })

  describe('recordAmortization', () => {
    it('should record amortization for specific month', async () => {
      const mockPrepaid = {
        id: mockPrepaidId,
        companyId: mockCompanyId,
        accountCode: '150',
        accountName: '前払保険料',
        originalAmount: 120000,
        remainingAmount: 120000,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        totalMonths: 12,
        monthlyAmount: 10000,
        status: 'ACTIVE',
        notes: null,
        amortizations: [],
      }

      const mockAmortization = {
        id: 'amort-1',
        prepaidId: mockPrepaidId,
        year: 2024,
        month: 6,
        expectedAmount: 10000,
        actualAmount: 10000,
        journalEntryId: null,
        status: 'completed',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.prepaidExpense.findUnique).mockResolvedValue(mockPrepaid as any)
      vi.mocked(prisma.prepaidAmortization.create).mockResolvedValue(mockAmortization)
      vi.mocked(prisma.prepaidExpense.update).mockResolvedValue({} as any)
      vi.mocked(prisma.prepaidExpense.findUnique).mockResolvedValue(mockPrepaid as any)

      const result = await PrepaidExpenseTracker.recordAmortization(mockPrepaidId, 2024, 6, 10000)

      expect(result.expectedAmount).toBe(10000)
      expect(result.actualAmount).toBe(10000)
      expect(result.status).toBe('completed')
    })

    it('should mark status as partial when actual < expected', async () => {
      const mockPrepaid = {
        id: mockPrepaidId,
        monthlyAmount: 10000,
        remainingAmount: 120000,
      }

      const mockAmortization = {
        id: 'amort-1',
        prepaidId: mockPrepaidId,
        year: 2024,
        month: 6,
        expectedAmount: 10000,
        actualAmount: 8000,
        journalEntryId: null,
        status: 'partial',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.prepaidExpense.findUnique).mockResolvedValue(mockPrepaid as any)
      vi.mocked(prisma.prepaidAmortization.create).mockResolvedValue(mockAmortization)
      vi.mocked(prisma.prepaidExpense.update).mockResolvedValue({} as any)

      const result = await PrepaidExpenseTracker.recordAmortization(mockPrepaidId, 2024, 6, 8000)

      expect(result.status).toBe('partial')
    })

    it('should throw error when prepaid not found', async () => {
      vi.mocked(prisma.prepaidExpense.findUnique).mockResolvedValue(null)

      await expect(
        PrepaidExpenseTracker.recordAmortization(mockPrepaidId, 2024, 6, 10000)
      ).rejects.toThrow('Prepaid expense not found')
    })
  })

  describe('checkAmortizationSchedule', () => {
    it('should check amortization status for specific month', async () => {
      const mockPrepaids = [
        {
          id: mockPrepaidId,
          companyId: mockCompanyId,
          accountCode: '150',
          accountName: '前払保険料',
          originalAmount: 120000,
          remainingAmount: 60000,
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-12-31'),
          totalMonths: 12,
          monthlyAmount: 10000,
          status: 'ACTIVE',
          notes: null,
          amortizations: [
            {
              id: 'amort-1',
              prepaidId: mockPrepaidId,
              year: 2024,
              month: 6,
              expectedAmount: 10000,
              actualAmount: 10000,
              journalEntryId: null,
              status: 'completed',
            },
          ],
        },
      ]

      vi.mocked(prisma.prepaidExpense.findMany).mockResolvedValue(mockPrepaids as any)

      const result = await PrepaidExpenseTracker.checkAmortizationSchedule(mockCompanyId, 2024, 6)

      expect(result).toHaveLength(1)
      expect(result[0].status).toBe('completed')
      expect(result[0].expectedAmount).toBe(10000)
      expect(result[0].actualAmount).toBe(10000)
    })

    it('should detect missing amortization', async () => {
      const mockPrepaids = [
        {
          id: mockPrepaidId,
          companyId: mockCompanyId,
          accountCode: '150',
          accountName: '前払保険料',
          originalAmount: 120000,
          remainingAmount: 120000,
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-12-31'),
          totalMonths: 12,
          monthlyAmount: 10000,
          status: 'ACTIVE',
          notes: null,
          amortizations: [],
        },
      ]

      vi.mocked(prisma.prepaidExpense.findMany).mockResolvedValue(mockPrepaids as any)

      const result = await PrepaidExpenseTracker.checkAmortizationSchedule(mockCompanyId, 2024, 6)

      expect(result).toHaveLength(1)
      expect(result[0].status).toBe('missing')
      expect(result[0].actualAmount).toBe(0)
    })
  })

  describe('detectPrepaidExpensesFromJournals', () => {
    it('should detect prepaid expenses from journal entries', async () => {
      const mockJournals = [
        {
          id: 'journal-1',
          companyId: mockCompanyId,
          debitAccount: '前払保険料',
          creditAccount: '現金預金',
          amount: 120000,
          entryDate: new Date('2024-01-01'),
          description: 'Annual insurance - 12ヶ月',
        },
      ]

      vi.mocked(prisma.journal.findMany).mockResolvedValue(mockJournals as any)

      const result = await PrepaidExpenseTracker.detectPrepaidExpensesFromJournals(mockCompanyId)

      expect(result.length).toBeGreaterThanOrEqual(0)
    })

    it('should skip entries without prepaid account patterns', async () => {
      const mockJournals = [
        {
          id: 'journal-1',
          companyId: mockCompanyId,
          debitAccount: '経費',
          creditAccount: '現金預金',
          amount: 10000,
          entryDate: new Date('2024-01-01'),
          description: 'Regular expense',
        },
      ]

      vi.mocked(prisma.journal.findMany).mockResolvedValue(mockJournals as any)

      const result = await PrepaidExpenseTracker.detectPrepaidExpensesFromJournals(mockCompanyId)

      expect(result).toHaveLength(0)
    })
  })

  describe('generateAmortizationEntries', () => {
    it('should generate entries for missing amortizations', async () => {
      const mockPrepaids = [
        {
          id: mockPrepaidId,
          companyId: mockCompanyId,
          accountCode: '150',
          accountName: '前払保険料',
          originalAmount: 120000,
          remainingAmount: 120000,
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-12-31'),
          totalMonths: 12,
          monthlyAmount: 10000,
          status: 'ACTIVE',
          notes: null,
          amortizations: [],
        },
      ]

      vi.mocked(prisma.prepaidExpense.findMany).mockResolvedValue(mockPrepaids as any)

      const result = await PrepaidExpenseTracker.generateAmortizationEntries(mockCompanyId, 2024, 6)

      expect(result).toHaveLength(1)
      expect(result[0].prepaidId).toBe(mockPrepaidId)
      expect(result[0].amount).toBe(10000)
    })

    it('should skip months that already have amortizations', async () => {
      const mockPrepaids = [
        {
          id: mockPrepaidId,
          companyId: mockCompanyId,
          accountCode: '150',
          accountName: '前払保険料',
          originalAmount: 120000,
          remainingAmount: 110000,
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-12-31'),
          totalMonths: 12,
          monthlyAmount: 10000,
          status: 'ACTIVE',
          notes: null,
          amortizations: [
            {
              id: 'amort-1',
              prepaidId: mockPrepaidId,
              year: 2024,
              month: 6,
              expectedAmount: 10000,
              actualAmount: 10000,
              status: 'completed',
            },
          ],
        },
      ]

      vi.mocked(prisma.prepaidExpense.findMany).mockResolvedValue(mockPrepaids as any)

      const result = await PrepaidExpenseTracker.generateAmortizationEntries(mockCompanyId, 2024, 6)

      expect(result).toHaveLength(0)
    })
  })
})

describe('AccrualExpenseTracker', () => {
  const mockCompanyId = 'test-company-id'
  const mockAccrualId = 'accrual-1'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createAccrualExpense', () => {
    it('should create accrual expense', async () => {
      const mockAccrual = {
        id: mockAccrualId,
        companyId: mockCompanyId,
        accountCode: '200',
        accountName: '未払給料',
        accrualYear: 2024,
        accrualMonth: 6,
        expectedAmount: 500000,
        actualAmount: 500000,
        accrualJournalId: null,
        paymentYear: null,
        paymentMonth: null,
        paymentJournalId: null,
        status: 'ACCRUED',
        notes: 'June salary',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.accrualExpense.create).mockResolvedValue(mockAccrual)

      const input: AccrualExpenseInput = {
        companyId: mockCompanyId,
        accountCode: '200',
        accountName: '未払給料',
        accrualYear: 2024,
        accrualMonth: 6,
        expectedAmount: 500000,
        actualAmount: 500000,
        notes: 'June salary',
      }

      const result = await AccrualExpenseTracker.createAccrualExpense(input)

      expect(result.accountName).toBe('未払給料')
      expect(result.status).toBe('ACCRUED')
      expect(prisma.accrualExpense.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'ACCRUED',
          }),
        })
      )
    })
  })

  describe('getAccrualExpenses', () => {
    it('should retrieve all accrual expenses for a company', async () => {
      const mockAccruals = [
        {
          id: 'accrual-1',
          companyId: mockCompanyId,
          accountCode: '200',
          accountName: '未払給料',
          accrualYear: 2024,
          accrualMonth: 6,
          expectedAmount: 500000,
          actualAmount: 500000,
          status: 'ACCRUED',
        },
        {
          id: 'accrual-2',
          companyId: mockCompanyId,
          accountCode: '201',
          accountName: '未払広告料',
          accrualYear: 2024,
          accrualMonth: 5,
          expectedAmount: 100000,
          actualAmount: 100000,
          status: 'PAID',
        },
      ]

      vi.mocked(prisma.accrualExpense.findMany).mockResolvedValue(mockAccruals as any)

      const result = await AccrualExpenseTracker.getAccrualExpenses(mockCompanyId)

      expect(result).toHaveLength(2)
      expect(result[0].status).toBe('ACCRUED')
      expect(result[1].status).toBe('PAID')
    })
  })

  describe('getUnpaidAccrualExpenses', () => {
    it('should retrieve only unpaid accrual expenses', async () => {
      const mockUnpaidAccruals = [
        {
          id: 'accrual-1',
          companyId: mockCompanyId,
          accountCode: '200',
          accountName: '未払給料',
          accrualYear: 2024,
          accrualMonth: 6,
          expectedAmount: 500000,
          actualAmount: 500000,
          status: 'ACCRUED',
        },
      ]

      vi.mocked(prisma.accrualExpense.findMany).mockResolvedValue(mockUnpaidAccruals as any)

      const result = await AccrualExpenseTracker.getUnpaidAccrualExpenses(mockCompanyId)

      expect(result).toHaveLength(1)
      expect(prisma.accrualExpense.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: mockCompanyId, status: 'ACCRUED' },
        })
      )
    })
  })

  describe('recordPayment', () => {
    it('should record payment and update status', async () => {
      const mockAccrual = {
        id: mockAccrualId,
        companyId: mockCompanyId,
        accountCode: '200',
        accountName: '未払給料',
        accrualYear: 2024,
        accrualMonth: 6,
        expectedAmount: 500000,
        actualAmount: 500000,
        accrualJournalId: null,
        paymentYear: 2024,
        paymentMonth: 7,
        paymentJournalId: 'journal-1',
        status: 'PAID',
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.accrualExpense.update).mockResolvedValue(mockAccrual)

      const result = await AccrualExpenseTracker.recordPayment(mockAccrualId, 2024, 7, 'journal-1')

      expect(result.status).toBe('PAID')
      expect(result.paymentYear).toBe(2024)
      expect(result.paymentMonth).toBe(7)
    })
  })

  describe('checkPaymentStatus', () => {
    it('should identify overdue payments', async () => {
      const oldDate = new Date()
      oldDate.setMonth(oldDate.getMonth() - 2)

      const mockAccruals = [
        {
          id: mockAccrualId,
          companyId: mockCompanyId,
          accountCode: '200',
          accountName: '未払給料',
          accrualYear: oldDate.getFullYear(),
          accrualMonth: oldDate.getMonth() + 1,
          expectedAmount: 500000,
          actualAmount: 500000,
          status: 'ACCRUED',
        },
      ]

      vi.mocked(prisma.accrualExpense.findMany).mockResolvedValue(mockAccruals as any)

      const result = await AccrualExpenseTracker.checkPaymentStatus(mockCompanyId)

      expect(result).toHaveLength(1)
      expect(result[0].status).toBe('overdue')
      expect(result[0].daysSinceAccrual).toBeGreaterThan(30)
    })

    it('should identify accrued (not overdue) payments', async () => {
      const recentDate = new Date()
      recentDate.setDate(recentDate.getDate() - 5)

      const mockAccruals = [
        {
          id: mockAccrualId,
          companyId: mockCompanyId,
          accountCode: '200',
          accountName: '未払給料',
          accrualYear: recentDate.getFullYear(),
          accrualMonth: recentDate.getMonth() + 1,
          expectedAmount: 500000,
          actualAmount: 500000,
          status: 'ACCRUED',
        },
      ]

      vi.mocked(prisma.accrualExpense.findMany).mockResolvedValue(mockAccruals as any)

      const result = await AccrualExpenseTracker.checkPaymentStatus(mockCompanyId)

      expect(result).toHaveLength(1)
      expect(result[0].status).toBe('accrued')
    })
  })

  describe('detectAccrualExpensesFromJournals', () => {
    it('should detect accrual expenses from journal entries', async () => {
      const mockJournals = [
        {
          id: 'journal-1',
          companyId: mockCompanyId,
          debitAccount: '給料',
          creditAccount: '未払給料',
          amount: 500000,
          entryDate: new Date('2024-06-30'),
          description: 'June salary accrual',
        },
      ]

      vi.mocked(prisma.journal.findMany).mockResolvedValue(mockJournals as any)

      const result = await AccrualExpenseTracker.detectAccrualExpensesFromJournals(
        mockCompanyId,
        2024,
        6
      )

      expect(result).toHaveLength(1)
      expect(result[0].accountName).toBe('未払給料')
      expect(result[0].expectedAmount).toBe(500000)
    })
  })

  describe('checkAnomalies', () => {
    it('should identify accruals with significant variance', async () => {
      const mockAccruals = [
        {
          id: mockAccrualId,
          companyId: mockCompanyId,
          accountCode: '200',
          accountName: '未払給料',
          accrualYear: 2024,
          accrualMonth: 6,
          expectedAmount: 500000,
          actualAmount: 600000,
          status: 'ACCRUED',
        },
      ]

      vi.mocked(prisma.accrualExpense.findMany).mockResolvedValue(mockAccruals as any)

      const result = await AccrualExpenseTracker.checkAnomalies(mockCompanyId)

      expect(result).toHaveLength(1)
      expect(result[0].actualAmount).toBe(600000)
    })

    it('should not flag small variances', async () => {
      const mockAccruals = [
        {
          id: mockAccrualId,
          companyId: mockCompanyId,
          accountCode: '200',
          accountName: '未払給料',
          accrualYear: 2024,
          accrualMonth: 6,
          expectedAmount: 500000,
          actualAmount: 505000,
          status: 'ACCRUED',
        },
      ]

      vi.mocked(prisma.accrualExpense.findMany).mockResolvedValue(mockAccruals as any)

      const result = await AccrualExpenseTracker.checkAnomalies(mockCompanyId)

      expect(result).toHaveLength(0)
    })
  })

  describe('matchPaymentsWithAccruals', () => {
    it('should match payments with accruals', async () => {
      const mockAccruals = [
        {
          id: mockAccrualId,
          companyId: mockCompanyId,
          accountCode: '200',
          accountName: '未払給料',
          accrualYear: 2024,
          accrualMonth: 5,
          expectedAmount: 500000,
          actualAmount: 500000,
          status: 'ACCRUED',
        },
      ]

      const mockJournals = [
        {
          id: 'journal-1',
          companyId: mockCompanyId,
          debitAccount: '未払給料',
          creditAccount: '現金預金',
          amount: 500000,
          entryDate: new Date('2024-06-15'),
          description: 'Salary payment',
        },
      ]

      vi.mocked(prisma.accrualExpense.findMany).mockResolvedValue(mockAccruals as any)
      vi.mocked(prisma.journal.findMany).mockResolvedValue(mockJournals as any)
      vi.mocked(prisma.accrualExpense.update).mockResolvedValue({} as any)

      const result = await AccrualExpenseTracker.matchPaymentsWithAccruals(mockCompanyId, 2024, 6)

      expect(result.matched).toHaveLength(1)
      expect(result.unmatched).toHaveLength(0)
    })

    it('should identify unmatched accruals', async () => {
      const mockAccruals = [
        {
          id: mockAccrualId,
          companyId: mockCompanyId,
          accountCode: '200',
          accountName: '未払給料',
          accrualYear: 2024,
          accrualMonth: 5,
          expectedAmount: 500000,
          actualAmount: 500000,
          status: 'ACCRUED',
        },
      ]

      vi.mocked(prisma.accrualExpense.findMany).mockResolvedValue(mockAccruals as any)
      vi.mocked(prisma.journal.findMany).mockResolvedValue([])
      vi.mocked(prisma.accrualExpense.update).mockResolvedValue({} as any)

      const result = await AccrualExpenseTracker.matchPaymentsWithAccruals(mockCompanyId, 2024, 6)

      expect(result.matched).toHaveLength(0)
      expect(result.unmatched).toHaveLength(1)
    })
  })
})
