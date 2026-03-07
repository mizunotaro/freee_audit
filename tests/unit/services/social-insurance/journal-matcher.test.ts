import { describe, it, expect, vi, beforeEach } from 'vitest'
import { JournalMatcher } from '@/services/social-insurance/journal-matcher'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    journal: {
      findMany: vi.fn(),
    },
    socialInsurancePayment: {
      findMany: vi.fn(),
    },
  },
}))

describe('JournalMatcher', () => {
  const mockCompanyId = 'company-1'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('INSURANCE_ACCOUNT_PATTERNS', () => {
    it('should have patterns for all insurance types', () => {
      expect(JournalMatcher.INSURANCE_ACCOUNT_PATTERNS.health).toBeDefined()
      expect(JournalMatcher.INSURANCE_ACCOUNT_PATTERNS.pension).toBeDefined()
      expect(JournalMatcher.INSURANCE_ACCOUNT_PATTERNS.employment).toBeDefined()
      expect(JournalMatcher.INSURANCE_ACCOUNT_PATTERNS.work_accident).toBeDefined()
      expect(JournalMatcher.INSURANCE_ACCOUNT_PATTERNS.care).toBeDefined()
    })

    it('should include common patterns for health insurance', () => {
      const patterns = JournalMatcher.INSURANCE_ACCOUNT_PATTERNS.health
      expect(patterns.some((p) => p.includes('健康保険'))).toBe(true)
    })

    it('should include common patterns for pension', () => {
      const patterns = JournalMatcher.INSURANCE_ACCOUNT_PATTERNS.pension
      expect(patterns.some((p) => p.includes('厚生年金'))).toBe(true)
    })
  })

  describe('extractInsurancePaymentsFromJournals', () => {
    it('should extract payments grouped by insurance type', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          id: 'journal-1',
          entryDate: new Date('2024-06-15'),
          amount: 100000,
          description: '健康保険料 6月分',
          debitAccount: '健康保険料',
          creditAccount: '現金',
        } as any,
      ])

      const result = await JournalMatcher.extractInsurancePaymentsFromJournals(
        mockCompanyId,
        new Date('2024-01-01'),
        new Date('2024-12-31')
      )

      expect(result.size).toBeGreaterThan(0)
    })

    it('should match by description', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          id: 'journal-1',
          entryDate: new Date('2024-06-15'),
          amount: 100000,
          description: '厚生年金保険料',
          debitAccount: '福利厚生費',
          creditAccount: '現金',
        } as any,
      ])

      const result = await JournalMatcher.extractInsurancePaymentsFromJournals(
        mockCompanyId,
        new Date('2024-01-01'),
        new Date('2024-12-31')
      )

      expect(result.has('pension')).toBe(true)
    })

    it('should match by debit account', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          id: 'journal-1',
          entryDate: new Date('2024-06-15'),
          amount: 100000,
          description: '支払',
          debitAccount: '雇用保険料',
          creditAccount: '現金',
        } as any,
      ])

      const result = await JournalMatcher.extractInsurancePaymentsFromJournals(
        mockCompanyId,
        new Date('2024-01-01'),
        new Date('2024-12-31')
      )

      expect(result.has('employment')).toBe(true)
    })

    it('should match by credit account', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          id: 'journal-1',
          entryDate: new Date('2024-06-15'),
          amount: 100000,
          description: '支払',
          debitAccount: '経費',
          creditAccount: '労災保険',
        } as any,
      ])

      const result = await JournalMatcher.extractInsurancePaymentsFromJournals(
        mockCompanyId,
        new Date('2024-01-01'),
        new Date('2024-12-31')
      )

      expect(result.has('work_accident')).toBe(true)
    })

    it('should return empty map when no matching journals', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          id: 'journal-1',
          entryDate: new Date('2024-06-15'),
          amount: 100000,
          description: 'その他経費',
          debitAccount: '経費',
          creditAccount: '現金',
        } as any,
      ])

      const result = await JournalMatcher.extractInsurancePaymentsFromJournals(
        mockCompanyId,
        new Date('2024-01-01'),
        new Date('2024-12-31')
      )

      const allEmpty = Array.from(result.values()).every((arr) => arr.length === 0)
      expect(allEmpty).toBe(true)
    })

    it('should order journals by entry date', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([])

      await JournalMatcher.extractInsurancePaymentsFromJournals(
        mockCompanyId,
        new Date('2024-01-01'),
        new Date('2024-12-31')
      )

      expect(prisma.journal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { entryDate: 'asc' },
        })
      )
    })
  })

  describe('matchPaymentsWithExpected', () => {
    it('should return matched results', async () => {
      vi.mocked(prisma.socialInsurancePayment.findMany).mockResolvedValue([
        {
          id: 'payment-1',
          insuranceType: 'health',
          expectedAmount: 100000,
          dueDate: new Date('2024-06-30'),
        } as any,
      ])

      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          id: 'journal-1',
          entryDate: new Date('2024-06-15'),
          amount: 100000,
          description: '健康保険料',
          debitAccount: '健康保険料',
          creditAccount: '現金',
        } as any,
      ])

      const result = await JournalMatcher.matchPaymentsWithExpected(mockCompanyId, 2024, 6)

      expect(result.length).toBeGreaterThan(0)
      expect(result[0].insuranceType).toBe('health')
    })

    it('should calculate variance', async () => {
      vi.mocked(prisma.socialInsurancePayment.findMany).mockResolvedValue([
        {
          id: 'payment-1',
          insuranceType: 'health',
          expectedAmount: 100000,
          dueDate: new Date('2024-06-30'),
        } as any,
      ])

      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          id: 'journal-1',
          entryDate: new Date('2024-06-15'),
          amount: 80000,
          description: '健康保険料',
          debitAccount: '健康保険料',
          creditAccount: '現金',
        } as any,
      ])

      const result = await JournalMatcher.matchPaymentsWithExpected(mockCompanyId, 2024, 6)

      expect(result[0].variance).toBe(-20000)
    })

    it('should set status as paid when journal matches expected', async () => {
      vi.mocked(prisma.socialInsurancePayment.findMany).mockResolvedValue([
        {
          id: 'payment-1',
          insuranceType: 'health',
          expectedAmount: 100000,
          dueDate: new Date('2024-06-30'),
        } as any,
      ])

      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          id: 'journal-1',
          entryDate: new Date('2024-06-15'),
          amount: 100000,
          description: '健康保険料',
          debitAccount: '健康保険料',
          creditAccount: '現金',
        } as any,
      ])

      const result = await JournalMatcher.matchPaymentsWithExpected(mockCompanyId, 2024, 6)

      expect(result[0].status).toBe('paid')
    })

    it('should set status as partial when journal is less', async () => {
      vi.mocked(prisma.socialInsurancePayment.findMany).mockResolvedValue([
        {
          id: 'payment-1',
          insuranceType: 'health',
          expectedAmount: 100000,
          dueDate: new Date('2024-06-30'),
        } as any,
      ])

      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          id: 'journal-1',
          entryDate: new Date('2024-06-15'),
          amount: 50000,
          description: '健康保険料',
          debitAccount: '健康保険料',
          creditAccount: '現金',
        } as any,
      ])

      const result = await JournalMatcher.matchPaymentsWithExpected(mockCompanyId, 2024, 6)

      expect(result[0].status).toBe('partial')
    })

    it('should set status as overdue when no journal and past due date', async () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 10)

      vi.mocked(prisma.socialInsurancePayment.findMany).mockResolvedValue([
        {
          id: 'payment-1',
          insuranceType: 'health',
          expectedAmount: 100000,
          dueDate: pastDate,
        } as any,
      ])

      vi.mocked(prisma.journal.findMany).mockResolvedValue([])

      const result = await JournalMatcher.matchPaymentsWithExpected(mockCompanyId, 2024, 6)

      expect(result[0].status).toBe('overdue')
    })

    it('should set status as missing when no journal and future due date', async () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 10)

      vi.mocked(prisma.socialInsurancePayment.findMany).mockResolvedValue([
        {
          id: 'payment-1',
          insuranceType: 'health',
          expectedAmount: 100000,
          dueDate: futureDate,
        } as any,
      ])

      vi.mocked(prisma.journal.findMany).mockResolvedValue([])

      const result = await JournalMatcher.matchPaymentsWithExpected(mockCompanyId, 2024, 6)

      expect(result[0].status).toBe('missing')
    })

    it('should return empty array when no payments', async () => {
      vi.mocked(prisma.socialInsurancePayment.findMany).mockResolvedValue([])
      vi.mocked(prisma.journal.findMany).mockResolvedValue([])

      const result = await JournalMatcher.matchPaymentsWithExpected(mockCompanyId, 2024, 6)

      expect(result).toHaveLength(0)
    })
  })

  describe('detectMissingPayments', () => {
    it('should return insurance types with missing payments', async () => {
      vi.mocked(prisma.socialInsurancePayment.findMany).mockResolvedValue([
        {
          id: 'payment-1',
          insuranceType: 'health',
          expectedAmount: 100000,
          dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        } as any,
      ])

      vi.mocked(prisma.journal.findMany).mockResolvedValue([])

      const result = await JournalMatcher.detectMissingPayments(mockCompanyId, 2024, 6)

      expect(result).toContain('health')
    })

    it('should return empty array when all payments are made', async () => {
      vi.mocked(prisma.socialInsurancePayment.findMany).mockResolvedValue([
        {
          id: 'payment-1',
          insuranceType: 'health',
          expectedAmount: 100000,
          dueDate: new Date(),
        } as any,
      ])

      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          id: 'journal-1',
          entryDate: new Date(),
          amount: 100000,
          description: '健康保険料',
          debitAccount: '健康保険料',
          creditAccount: '現金',
        } as any,
      ])

      const result = await JournalMatcher.detectMissingPayments(mockCompanyId, 2024, 6)

      expect(result).toHaveLength(0)
    })
  })

  describe('generatePaymentSuggestions', () => {
    it('should suggest payments for pending items', async () => {
      vi.mocked(prisma.socialInsurancePayment.findMany).mockResolvedValue([
        {
          id: 'payment-1',
          insuranceType: 'health',
          expectedAmount: 100000,
          actualAmount: 50000,
          dueDate: new Date(),
        } as any,
      ])

      const result = await JournalMatcher.generatePaymentSuggestions(mockCompanyId, 2024, 6)

      expect(result).toHaveLength(1)
      expect(result[0].suggestedAmount).toBe(50000)
    })

    it('should return empty array when no pending payments', async () => {
      vi.mocked(prisma.socialInsurancePayment.findMany).mockResolvedValue([])

      const result = await JournalMatcher.generatePaymentSuggestions(mockCompanyId, 2024, 6)

      expect(result).toHaveLength(0)
    })

    it('should calculate remaining amount correctly', async () => {
      vi.mocked(prisma.socialInsurancePayment.findMany).mockResolvedValue([
        {
          id: 'payment-1',
          insuranceType: 'health',
          expectedAmount: 100000,
          actualAmount: 30000,
          dueDate: new Date(),
        } as any,
      ])

      const result = await JournalMatcher.generatePaymentSuggestions(mockCompanyId, 2024, 6)

      expect(result[0].suggestedAmount).toBe(70000)
    })
  })
})
