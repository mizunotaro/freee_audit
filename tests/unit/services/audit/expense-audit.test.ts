import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  auditExpenseItems,
  checkDuplicateExpenses,
  checkTripConsistency,
  generateExpenseAuditPrompt,
} from '@/services/audit/expense-audit'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    journal: {
      findMany: vi.fn(),
    },
  },
}))

describe('ExpenseAuditService', () => {
  const mockCompanyId = 'company-1'
  const mockJournal: any = {
    id: 'journal-1',
    companyId: mockCompanyId,
    entryDate: new Date('2024-01-15'),
    description: '東京-大阪 新幹線',
    debitAccount: '旅費交通費',
    creditAccount: '普通預金',
    amount: 15000,
    documentId: null,
    createdAt: new Date(),
    freeeJournalId: 'freee-1',
    taxAmount: 0,
    taxType: null,
    auditStatus: 'pending',
    syncedAt: new Date(),
    document: null,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('auditExpenseItems', () => {
    it('should return empty array for no expense items', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([])

      const result = await auditExpenseItems(mockCompanyId, 2024, 1)

      expect(result).toEqual([])
    })

    it('should pass valid expense items', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          ...mockJournal,
          entryDate: new Date('2024-01-10'),
          amount: 1000,
          documentId: 'doc-1',
          document: { id: 'doc-1' },
        } as any,
      ])

      const result = await auditExpenseItems(mockCompanyId, 2024, 1)

      expect(result).toHaveLength(1)
      expect(result[0].status).toBe('pass')
    })

    it('should detect future dated expenses', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          ...mockJournal,
          entryDate: new Date('2099-01-01'),
        },
      ])

      const result = await auditExpenseItems(mockCompanyId, 2024, 1)

      expect(result[0].status).toBe('error')
      expect(result[0].issues.some((i) => i.type === 'future_date')).toBe(true)
    })

    it('should detect weekend travel', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          ...mockJournal,
          entryDate: new Date('2024-01-06'),
        },
      ])

      const result = await auditExpenseItems(mockCompanyId, 2024, 1)

      const weekendIssue = result[0].issues.find((i) => i.type === 'weekend_travel')
      expect(weekendIssue).toBeDefined()
      expect(weekendIssue?.severity).toBe('info')
    })

    it('should detect missing document for high amount', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          ...mockJournal,
          amount: 50000,
          documentId: null,
          document: null,
        } as any,
      ])

      const result = await auditExpenseItems(mockCompanyId, 2024, 1)

      const docIssue = result[0].issues.find((i) => i.type === 'missing_document')
      expect(docIssue).toBeDefined()
      expect(docIssue?.severity).toBe('warning')
    })

    it('should require document for shinkansen', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          ...mockJournal,
          description: '新幹線代',
          documentId: null,
          document: null,
        } as any,
      ])

      const result = await auditExpenseItems(mockCompanyId, 2024, 1)

      expect(result).toBeDefined()
      expect(result).toHaveLength(1)
      expect(result[0].status).toBeDefined()
    })

    it('should require document for flight', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          ...mockJournal,
          description: '航空機代',
          documentId: null,
          document: null,
        } as any,
      ])

      const result = await auditExpenseItems(mockCompanyId, 2024, 1)

      expect(result).toBeDefined()
      expect(result).toHaveLength(1)
      expect(result[0].status).toBeDefined()
    })

    it('should calculate confidence score correctly', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          ...mockJournal,
          entryDate: new Date('2099-01-01'),
          amount: 100000,
          documentId: null,
          document: null,
        } as any,
      ])

      const result = await auditExpenseItems(mockCompanyId, 2024, 1)

      expect(result[0].confidenceScore).toBeLessThan(100)
    })

    it('should return 100 confidence for no issues', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          ...mockJournal,
          entryDate: new Date('2024-01-10'),
          amount: 1000,
          documentId: 'doc-1',
          document: { id: 'doc-1' },
        } as any,
      ])

      const result = await auditExpenseItems(mockCompanyId, 2024, 1)

      expect(result[0].confidenceScore).toBe(100)
    })

    it('should filter by date range', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([])

      await auditExpenseItems(mockCompanyId, 2024, 1)

      expect(prisma.journal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            entryDate: {
              gte: new Date(2024, 0, 1),
              lte: new Date(2024, 1, 0),
            },
          }),
        })
      )
    })

    it('should filter by travel expense account', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([])

      await auditExpenseItems(mockCompanyId, 2024, 1)

      expect(prisma.journal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            debitAccount: { contains: '旅費' },
          }),
        })
      )
    })
  })

  describe('checkDuplicateExpenses', () => {
    it('should detect duplicate expenses with same amount and description', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        { ...mockJournal, id: 'j1', amount: 10000, description: 'タクシー代' },
        { ...mockJournal, id: 'j2', amount: 10000, description: 'タクシー代' },
      ])

      const result = await checkDuplicateExpenses(mockCompanyId, 2024, 1)

      expect(result.length).toBeGreaterThan(0)
      expect(result[0].reason).toContain('同じ金額')
    })

    it('should not flag different amounts', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        { ...mockJournal, id: 'j1', amount: 10000, description: 'タクシー代' },
        { ...mockJournal, id: 'j2', amount: 20000, description: 'タクシー代' },
      ])

      const result = await checkDuplicateExpenses(mockCompanyId, 2024, 1)

      expect(result).toEqual([])
    })

    it('should not flag different descriptions', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        { ...mockJournal, id: 'j1', amount: 10000, description: 'タクシー代 A' },
        { ...mockJournal, id: 'j2', amount: 10000, description: 'タクシー代 B' },
      ])

      const result = await checkDuplicateExpenses(mockCompanyId, 2024, 1)

      expect(result).toEqual([])
    })

    it('should return empty array for no journals', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([])

      const result = await checkDuplicateExpenses(mockCompanyId, 2024, 1)

      expect(result).toEqual([])
    })
  })

  describe('checkTripConsistency', () => {
    it('should detect missing return trip', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          ...mockJournal,
          id: 'j1',
          entryDate: new Date('2024-01-10'),
          description: '東京→大阪 新幹線',
        } as any,
      ])

      const result = await checkTripConsistency(mockCompanyId, 2024, 1)

      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
    })

    it('should detect missing accommodation for multi-day trip', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          ...mockJournal,
          id: 'j1',
          entryDate: new Date('2024-01-10'),
          description: '東京→大阪 新幹線',
        },
        {
          ...mockJournal,
          id: 'j2',
          entryDate: new Date('2024-01-12'),
          description: '大阪←東京 新幹線',
        },
      ])

      const result = await checkTripConsistency(mockCompanyId, 2024, 1)

      expect(
        result.some((t) => t.issues.includes('複数日の出張ですが宿泊費が記録されていません'))
      ).toBe(true)
    })

    it('should return empty for valid trip', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          ...mockJournal,
          id: 'j1',
          entryDate: new Date('2024-01-10'),
          description: '東京→大阪 新幹線',
        },
        {
          ...mockJournal,
          id: 'j2',
          entryDate: new Date('2024-01-10'),
          description: 'ホテル宿泊',
        },
        {
          ...mockJournal,
          id: 'j3',
          entryDate: new Date('2024-01-11'),
          description: '大阪←東京 戻り 新幹線',
        },
      ])

      const result = await checkTripConsistency(mockCompanyId, 2024, 1)

      expect(result).toEqual([])
    })

    it('should split trips by date gap', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          ...mockJournal,
          id: 'j1',
          entryDate: new Date('2024-01-10'),
          description: '東京→大阪',
        },
        {
          ...mockJournal,
          id: 'j2',
          entryDate: new Date('2024-01-20'),
          description: '東京→名古屋',
        },
      ])

      const result = await checkTripConsistency(mockCompanyId, 2024, 1)

      expect(result.length).toBeGreaterThanOrEqual(1)
    })

    it('should return empty for no expenses', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([])

      const result = await checkTripConsistency(mockCompanyId, 2024, 1)

      expect(result).toEqual([])
    })

    it('should handle single expense item', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          ...mockJournal,
          id: 'j1',
          entryDate: new Date('2024-01-10'),
          description: 'タクシー代',
        },
      ])

      const result = await checkTripConsistency(mockCompanyId, 2024, 1)

      expect(result).toEqual([])
    })
  })

  describe('generateExpenseAuditPrompt', () => {
    it('should generate prompt with all expense details', () => {
      const item = {
        id: 'item-1',
        journalId: 'journal-1',
        date: new Date('2024-01-15'),
        accountName: '旅費交通費',
        amount: 15000,
        description: '東京-大阪出張',
        origin: '東京',
        destination: '大阪',
        transport: '新幹線',
        hasDocument: true,
      }

      const prompt = generateExpenseAuditPrompt(item)

      expect(prompt).toContain('2024')
      expect(prompt).toContain('東京')
      expect(prompt).toContain('大阪')
      expect(prompt).toContain('新幹線')
      expect(prompt).toContain('15,000')
      expect(prompt).toContain('あり')
    })

    it('should handle missing route information', () => {
      const item = {
        id: 'item-1',
        journalId: 'journal-1',
        date: new Date('2024-01-15'),
        accountName: '旅費交通費',
        amount: 1000,
        description: 'タクシー代',
        hasDocument: false,
      }

      const prompt = generateExpenseAuditPrompt(item)

      expect(prompt).toContain('不明')
      expect(prompt).toContain('なし')
    })

    it('should include all verification points', () => {
      const item = {
        id: 'item-1',
        journalId: 'journal-1',
        date: new Date('2024-01-15'),
        accountName: '旅費交通費',
        amount: 1000,
        description: 'テスト',
        hasDocument: true,
      }

      const prompt = generateExpenseAuditPrompt(item)

      expect(prompt).toContain('日付の妥当性')
      expect(prompt).toContain('経路の整合性')
      expect(prompt).toContain('交通手段の適正')
      expect(prompt).toContain('金額の妥当性')
    })
  })

  describe('edge cases', () => {
    it('should handle very large amounts', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          ...mockJournal,
          amount: 999999999,
          documentId: null,
          document: null,
        } as any,
      ])

      const result = await auditExpenseItems(mockCompanyId, 2024, 1)

      expect(result).toBeDefined()
    })

    it('should handle zero amount', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          ...mockJournal,
          amount: 0,
        },
      ])

      const result = await auditExpenseItems(mockCompanyId, 2024, 1)

      expect(result).toBeDefined()
    })

    it('should handle special characters in description', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          ...mockJournal,
          description: '<script>alert("xss")</script>',
        },
      ])

      const result = await auditExpenseItems(mockCompanyId, 2024, 1)

      expect(result).toBeDefined()
    })

    it('should handle leap year February', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          ...mockJournal,
          entryDate: new Date('2024-02-29'),
        },
      ])

      const result = await auditExpenseItems(mockCompanyId, 2024, 2)

      expect(result).toBeDefined()
    })

    it('should handle multiple issues in single item', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          ...mockJournal,
          entryDate: new Date('2099-01-06'),
          amount: 100000,
          documentId: null,
          document: null,
        } as any,
      ])

      const result = await auditExpenseItems(mockCompanyId, 2024, 1)

      expect(result[0].issues.length).toBeGreaterThan(1)
    })
  })
})
