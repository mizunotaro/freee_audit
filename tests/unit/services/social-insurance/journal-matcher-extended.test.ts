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

describe('JournalMatcherExtended', () => {
  const mockCompanyId = 'company-1'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('matchPaymentsWithExpected — unknown insurance type', () => {
    it('should tolerate a payment whose type is absent from the journal map', async () => {
      // 期待支払に only-insurance マップ外の type が含まれる場合、
      // journalPayments.get(type) は undefined になり || [] のフォールバック経路に入る
      const futureDueDate = new Date()
      futureDueDate.setDate(futureDueDate.getDate() + 10)

      vi.mocked(prisma.socialInsurancePayment.findMany).mockResolvedValue([
        {
          id: 'payment-1',
          insuranceType: 'unknown_type',
          expectedAmount: 100000,
          dueDate: futureDueDate,
        } as any,
      ])
      // health/pension/employment/work_accident/care 以外の journal は抽出されない前提
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          id: 'journal-1',
          entryDate: new Date('2024-06-15'),
          amount: 50000,
          description: 'その他保険料',
          debitAccount: '経費',
          creditAccount: '現金',
        } as any,
      ])

      const result = await JournalMatcher.matchPaymentsWithExpected(mockCompanyId, 2024, 6)

      expect(result).toHaveLength(1)
      expect(result[0].insuranceType).toBe('unknown_type')
      // フォールバックで空配列になるため実績 0
      expect(result[0].actualJournalAmount).toBe(0)
      expect(result[0].variance).toBe(-100000)
      // 期限前で実績0 -> missing
      expect(result[0].status).toBe('missing')
      // journal が無いときは期間開始日へフォールバック
      expect(result[0].journalDate).toEqual(new Date(2024, 5, 1))
    })
  })
})
