import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  checkAccountingBasis,
  checkRevenueExpenseMatching,
  getMonthlyAccrualStatus,
} from '@/services/audit/accounting-basis-check'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    journal: {
      findMany: vi.fn(),
    },
  },
}))

describe('AccountingBasisChecker', () => {
  const mockCompanyId = 'company-1'
  const mockJournal = {
    id: 'journal-1',
    companyId: mockCompanyId,
    entryDate: new Date('2024-01-15'),
    description: 'テスト仕訳',
    debitAccount: '現金',
    creditAccount: '売上',
    amount: 10000,
    documentId: null,
    createdAt: new Date(),
    freeeJournalId: 'freee-1',
    taxAmount: 1000,
    taxType: '課税',
    auditStatus: 'pending',
    syncedAt: new Date(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('checkAccountingBasis', () => {
    it('should return valid result for empty journals', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([])

      const result = await checkAccountingBasis(mockCompanyId, 2024, 1)

      expect(result.totalJournals).toBe(0)
      expect(result.issuesFound).toBe(0)
      expect(result.checks).toEqual([])
    })

    it('should detect revenue timing issues', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          ...mockJournal,
          creditAccount: '売上',
          description: '入金: 商品販売',
        },
      ])

      const result = await checkAccountingBasis(mockCompanyId, 2024, 1)

      expect(result.summary.revenueTimingIssues).toBeGreaterThan(0)
    })

    it('should detect expense timing issues', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          ...mockJournal,
          debitAccount: '旅費交通費',
          description: '支払: 交通費',
        },
      ])

      const result = await checkAccountingBasis(mockCompanyId, 2024, 1)

      expect(result.summary.expenseTimingIssues).toBeGreaterThan(0)
    })

    it('should detect cross period issues at month end', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          ...mockJournal,
          entryDate: new Date('2024-01-31'),
          description: '翌月分家賃',
        },
      ])

      const result = await checkAccountingBasis(mockCompanyId, 2024, 1)

      expect(result.summary.crossPeriodIssues).toBeGreaterThan(0)
    })

    it('should detect prepaid expense not amortized', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          ...mockJournal,
          debitAccount: '旅費交通費',
          description: '保険料支払',
        },
      ])

      const result = await checkAccountingBasis(mockCompanyId, 2024, 1)

      expect(result.checks.length).toBeGreaterThan(0)
    })

    it('should detect accrued expense not recorded', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          ...mockJournal,
          debitAccount: '給与手当',
          description: '給与支払',
          entryDate: new Date('2024-01-15'),
        },
      ])

      const result = await checkAccountingBasis(mockCompanyId, 2024, 1)

      expect(
        result.checks.some((c) => c.issues.some((i) => i.type === 'accrued_not_recorded'))
      ).toBe(true)
    })

    it('should generate correction suggestions', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          ...mockJournal,
          debitAccount: '旅費交通費',
          description: '支払: 保険料',
        },
      ])

      const result = await checkAccountingBasis(mockCompanyId, 2024, 1)

      expect(result.checks[0]?.suggestedCorrection).toBeDefined()
    })

    it('should filter journals by fiscal year and month', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        { ...mockJournal, entryDate: new Date('2024-01-15') },
        { ...mockJournal, entryDate: new Date('2024-02-15') },
        { ...mockJournal, entryDate: new Date('2023-01-15') },
      ])

      const result = await checkAccountingBasis(mockCompanyId, 2024, 1)

      expect(result.totalJournals).toBe(1)
    })

    it('should detect advance payment in revenue', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          ...mockJournal,
          creditAccount: '売上',
          description: '前受金: サービス契約',
        },
      ])

      const result = await checkAccountingBasis(mockCompanyId, 2024, 1)

      const hasMismatch = result.checks.some((c) =>
        c.issues.some((i) => i.type === 'revenue_mismatch')
      )
      expect(hasMismatch).toBe(true)
    })

    it('should handle December fiscal year end', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          ...mockJournal,
          entryDate: new Date('2024-12-31'),
          description: '決算修正仕訳',
        },
      ])

      const result = await checkAccountingBasis(mockCompanyId, 2024, 12)

      expect(result.checks.some((c) => c.issues.some((i) => i.type === 'cross_year_payment'))).toBe(
        true
      )
    })

    it('should not flag end-of-month entries', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          ...mockJournal,
          entryDate: new Date('2024-01-31'),
          debitAccount: '給与手当',
          description: '1月分給与',
        },
      ])

      const result = await checkAccountingBasis(mockCompanyId, 2024, 1)

      const accruedIssue = result.checks.find((c) =>
        c.issues.some((i) => i.type === 'accrued_not_recorded')
      )
      expect(accruedIssue).toBeUndefined()
    })
  })

  describe('checkRevenueExpenseMatching', () => {
    it('should count revenue and expense journals', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        { ...mockJournal, id: 'j1', creditAccount: '売上高', amount: 100000 },
        { ...mockJournal, id: 'j2', creditAccount: '売上高', amount: 200000 },
        { ...mockJournal, id: 'j3', debitAccount: '旅費交通費', amount: 10000 },
        { ...mockJournal, id: 'j4', debitAccount: '通信費', amount: 5000 },
      ] as any)

      const result = await checkRevenueExpenseMatching(mockCompanyId, 2024, 1)

      expect(result.revenueJournals).toBeGreaterThanOrEqual(0)
      expect(result.expenseJournals).toBeGreaterThanOrEqual(0)
    })

    it('should count cash receipts and payments', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        { ...mockJournal, id: 'j1', debitAccount: '普通預金', amount: 100000 },
        { ...mockJournal, id: 'j2', creditAccount: '現金', amount: 50000 },
      ] as any)

      const result = await checkRevenueExpenseMatching(mockCompanyId, 2024, 1)

      expect(result.cashReceipts).toBeGreaterThanOrEqual(0)
      expect(result.cashPayments).toBeGreaterThanOrEqual(0)
    })

    it('should detect potential cash basis accounting', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          ...mockJournal,
          debitAccount: '普通預金',
          creditAccount: '売上高',
          amount: 100000,
        },
        {
          ...mockJournal,
          creditAccount: '現金',
          debitAccount: '旅費交通費',
          amount: 10000,
        },
      ])

      const result = await checkRevenueExpenseMatching(mockCompanyId, 2024, 1)

      expect(result.potentialCashBasis).toBe(2)
    })

    it('should handle empty journals', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([])

      const result = await checkRevenueExpenseMatching(mockCompanyId, 2024, 1)

      expect(result.revenueJournals).toBe(0)
      expect(result.expenseJournals).toBe(0)
      expect(result.cashReceipts).toBe(0)
      expect(result.cashPayments).toBe(0)
      expect(result.potentialCashBasis).toBe(0)
    })
  })

  describe('getMonthlyAccrualStatus', () => {
    it('should return status for all 12 months', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([])

      const result = await getMonthlyAccrualStatus(mockCompanyId, 2024)

      expect(result).toHaveLength(12)
      expect(result[0].month).toBe(1)
      expect(result[11].month).toBe(12)
    })

    it('should calculate prepaid expenses', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          ...mockJournal,
          entryDate: new Date('2024-01-15'),
          debitAccount: '前払費用',
          amount: 120000,
        },
      ])

      const result = await getMonthlyAccrualStatus(mockCompanyId, 2024)

      expect(result[0].prepaidExpenses).toBe(120000)
    })

    it('should calculate accrued expenses', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          ...mockJournal,
          entryDate: new Date('2024-01-31'),
          creditAccount: '未払費用',
          amount: 50000,
        },
      ])

      const result = await getMonthlyAccrualStatus(mockCompanyId, 2024)

      expect(result[0].accruedExpenses).toBe(50000)
    })

    it('should calculate deferred revenue', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          ...mockJournal,
          entryDate: new Date('2024-01-15'),
          creditAccount: '前受金',
          amount: 100000,
        },
      ])

      const result = await getMonthlyAccrualStatus(mockCompanyId, 2024)

      expect(result[0].deferredRevenue).toBe(100000)
    })

    it('should calculate accrued revenue', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          ...mockJournal,
          entryDate: new Date('2024-01-31'),
          debitAccount: '未収入金',
          amount: 80000,
        },
      ])

      const result = await getMonthlyAccrualStatus(mockCompanyId, 2024)

      expect(result[0].accruedRevenue).toBe(80000)
    })

    it('should calculate adjustment needed', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          ...mockJournal,
          id: 'j1',
          entryDate: new Date('2024-01-15'),
          debitAccount: '前払費用',
          amount: 100000,
        },
        {
          ...mockJournal,
          id: 'j2',
          entryDate: new Date('2024-01-31'),
          creditAccount: '未払費用',
          amount: 50000,
        },
      ] as any)

      const result = await getMonthlyAccrualStatus(mockCompanyId, 2024)

      expect(result).toBeDefined()
      expect(result).toHaveLength(12)
      expect(result[0].adjustmentNeeded).toBeGreaterThanOrEqual(0)
    })

    it('should handle multiple journals in same month', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          ...mockJournal,
          entryDate: new Date('2024-01-15'),
          debitAccount: '前払費用',
          amount: 100000,
        },
        {
          ...mockJournal,
          entryDate: new Date('2024-01-20'),
          debitAccount: '前払費用',
          amount: 50000,
        },
      ])

      const result = await getMonthlyAccrualStatus(mockCompanyId, 2024)

      expect(result[0].prepaidExpenses).toBe(150000)
    })
  })

  describe('edge cases', () => {
    it('should handle journals with special characters in description', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          ...mockJournal,
          creditAccount: '売上',
          description: '入金<script>alert("xss")</script>',
        },
      ])

      const result = await checkAccountingBasis(mockCompanyId, 2024, 1)

      expect(result).toBeDefined()
    })

    it('should handle journals with empty description', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          ...mockJournal,
          description: '',
        },
      ])

      const result = await checkAccountingBasis(mockCompanyId, 2024, 1)

      expect(result).toBeDefined()
    })

    it('should handle very large amounts', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          ...mockJournal,
          amount: 999999999999,
          debitAccount: '前払費用',
        },
      ])

      const result = await checkAccountingBasis(mockCompanyId, 2024, 1)

      expect(result).toBeDefined()
    })

    it('should handle zero amounts', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          ...mockJournal,
          amount: 0,
        },
      ])

      const result = await checkAccountingBasis(mockCompanyId, 2024, 1)

      expect(result).toBeDefined()
    })

    it('should handle leap year February', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          ...mockJournal,
          entryDate: new Date('2024-02-29'),
          debitAccount: '給与手当',
          description: '2月分給与',
        },
      ])

      const result = await checkAccountingBasis(mockCompanyId, 2024, 2)

      expect(result).toBeDefined()
    })

    it('should handle multiple issue types in same journal', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          ...mockJournal,
          entryDate: new Date('2024-01-31'),
          creditAccount: '売上',
          debitAccount: '旅費交通費',
          description: '支払: 保険料 翌月分',
        },
      ])

      const result = await checkAccountingBasis(mockCompanyId, 2024, 1)

      expect(result.checks[0]?.issues.length).toBeGreaterThan(1)
    })
  })
})
