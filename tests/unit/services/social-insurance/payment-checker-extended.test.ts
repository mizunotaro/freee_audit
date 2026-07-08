import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PaymentChecker } from '@/services/social-insurance/payment-checker'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    socialInsurancePayment: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

describe('PaymentCheckerExtended', () => {
  const mockCompanyId = 'company-1'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('updatePayment — amount fallback', () => {
    it('should reuse the existing amount/dueDate when the update omits them', async () => {
      const futureDueDate = new Date()
      futureDueDate.setDate(futureDueDate.getDate() + 30)

      vi.mocked(prisma.socialInsurancePayment.findUnique).mockResolvedValue({
        id: 'payment-1',
        expectedAmount: 100000,
        actualAmount: 50000,
        dueDate: futureDueDate,
      } as any)
      vi.mocked(prisma.socialInsurancePayment.update).mockResolvedValue({} as any)

      // actualAmount/expectedAmount/dueDate を含まない部分更新
      await PaymentChecker.updatePayment('payment-1', { notes: '振込確認済み' })

      // 既存 actualAmount(50000) < expectedAmount(100000) -> partial。
      // フォールバックせず undefined を使えば paid になるため、partial であることが
      // ?? の右辺(既存値)が採用されたことの強い証明になる。
      expect(prisma.socialInsurancePayment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'partial',
            notes: '振込確認済み',
          }),
        })
      )
    })
  })

  describe('getPaymentSummary — missing payment date', () => {
    it('should map a null paymentDate to undefined', async () => {
      vi.mocked(prisma.socialInsurancePayment.findMany).mockResolvedValue([
        {
          id: 'payment-1',
          insuranceType: 'health',
          year: 2024,
          month: 6,
          expectedAmount: 100000,
          actualAmount: 80000,
          status: 'partial',
          paymentDate: null,
        } as any,
      ])

      const result = await PaymentChecker.getPaymentSummary(mockCompanyId, 2024)

      expect(result).toHaveLength(1)
      // paymentDate ?? undefined の右辺経路
      expect(result[0].paymentDate).toBeUndefined()
      expect(result[0].variance).toBe(-20000)
      expect(result[0].status).toBe('partial')
    })
  })
})
