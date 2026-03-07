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

describe('PaymentChecker', () => {
  const mockCompanyId = 'company-1'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('INSURANCE_RATE', () => {
    it('should have rates for all insurance types', () => {
      expect(PaymentChecker.INSURANCE_RATE.health).toBeDefined()
      expect(PaymentChecker.INSURANCE_RATE.pension).toBeDefined()
      expect(PaymentChecker.INSURANCE_RATE.employment).toBeDefined()
      expect(PaymentChecker.INSURANCE_RATE.work_accident).toBeDefined()
      expect(PaymentChecker.INSURANCE_RATE.care).toBeDefined()
    })

    it('should have employee and employer rates', () => {
      expect(PaymentChecker.INSURANCE_RATE.health.employee).toBe(0.05)
      expect(PaymentChecker.INSURANCE_RATE.health.employer).toBe(0.05)
      expect(PaymentChecker.INSURANCE_RATE.work_accident.employee).toBe(0)
    })
  })

  describe('getPayments', () => {
    it('should return all payments for company', async () => {
      vi.mocked(prisma.socialInsurancePayment.findMany).mockResolvedValue([
        { id: 'payment-1', companyId: mockCompanyId } as any,
      ])

      const result = await PaymentChecker.getPayments(mockCompanyId)

      expect(result).toHaveLength(1)
    })

    it('should filter by insurance type', async () => {
      vi.mocked(prisma.socialInsurancePayment.findMany).mockResolvedValue([])

      await PaymentChecker.getPayments(mockCompanyId, { insuranceType: 'health' })

      expect(prisma.socialInsurancePayment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            insuranceType: 'health',
          }),
        })
      )
    })

    it('should filter by year', async () => {
      vi.mocked(prisma.socialInsurancePayment.findMany).mockResolvedValue([])

      await PaymentChecker.getPayments(mockCompanyId, { year: 2024 })

      expect(prisma.socialInsurancePayment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            year: 2024,
          }),
        })
      )
    })

    it('should filter by month', async () => {
      vi.mocked(prisma.socialInsurancePayment.findMany).mockResolvedValue([])

      await PaymentChecker.getPayments(mockCompanyId, { month: 6 })

      expect(prisma.socialInsurancePayment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            month: 6,
          }),
        })
      )
    })

    it('should order by year and month descending', async () => {
      vi.mocked(prisma.socialInsurancePayment.findMany).mockResolvedValue([])

      await PaymentChecker.getPayments(mockCompanyId)

      expect(prisma.socialInsurancePayment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ year: 'desc' }, { month: 'desc' }],
        })
      )
    })
  })

  describe('createPayment', () => {
    it('should create new payment', async () => {
      vi.mocked(prisma.socialInsurancePayment.create).mockResolvedValue({
        id: 'payment-1',
        companyId: mockCompanyId,
        insuranceType: 'health',
        year: 2024,
        month: 6,
        expectedAmount: 100000,
        actualAmount: 100000,
        status: 'paid',
      } as any)

      const result = await PaymentChecker.createPayment({
        companyId: mockCompanyId,
        insuranceType: 'health',
        year: 2024,
        month: 6,
        expectedAmount: 100000,
        actualAmount: 100000,
        dueDate: new Date(),
      })

      expect(result.id).toBe('payment-1')
    })

    it('should calculate status as paid when actual equals expected', async () => {
      vi.mocked(prisma.socialInsurancePayment.create).mockResolvedValue({} as any)

      await PaymentChecker.createPayment({
        companyId: mockCompanyId,
        insuranceType: 'health',
        year: 2024,
        month: 6,
        expectedAmount: 100000,
        actualAmount: 100000,
        dueDate: new Date(),
      })

      expect(prisma.socialInsurancePayment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'paid',
          }),
        })
      )
    })

    it('should calculate status as partial when actual less than expected', async () => {
      vi.mocked(prisma.socialInsurancePayment.create).mockResolvedValue({} as any)

      await PaymentChecker.createPayment({
        companyId: mockCompanyId,
        insuranceType: 'health',
        year: 2024,
        month: 6,
        expectedAmount: 100000,
        actualAmount: 50000,
        dueDate: new Date(),
      })

      expect(prisma.socialInsurancePayment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'partial',
          }),
        })
      )
    })
  })

  describe('updatePayment', () => {
    it('should update existing payment', async () => {
      vi.mocked(prisma.socialInsurancePayment.findUnique).mockResolvedValue({
        id: 'payment-1',
        expectedAmount: 100000,
        actualAmount: 50000,
        dueDate: new Date(),
      } as any)

      vi.mocked(prisma.socialInsurancePayment.update).mockResolvedValue({
        id: 'payment-1',
        actualAmount: 100000,
      } as any)

      const result = await PaymentChecker.updatePayment('payment-1', {
        actualAmount: 100000,
      })

      expect(result.actualAmount).toBe(100000)
    })

    it('should throw error when payment not found', async () => {
      vi.mocked(prisma.socialInsurancePayment.findUnique).mockResolvedValue(null)

      await expect(
        PaymentChecker.updatePayment('non-existent', { actualAmount: 100000 })
      ).rejects.toThrow('Payment not found')
    })

    it('should recalculate status on update', async () => {
      vi.mocked(prisma.socialInsurancePayment.findUnique).mockResolvedValue({
        id: 'payment-1',
        expectedAmount: 100000,
        actualAmount: 50000,
        dueDate: new Date(),
      } as any)

      vi.mocked(prisma.socialInsurancePayment.update).mockResolvedValue({} as any)

      await PaymentChecker.updatePayment('payment-1', { actualAmount: 100000 })

      expect(prisma.socialInsurancePayment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'paid',
          }),
        })
      )
    })
  })

  describe('calculateStatus', () => {
    it('should return overdue when no payment and past due date', () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 10)

      const result = PaymentChecker.calculateStatus(0, 100000, pastDate)

      expect(result).toBe('overdue')
    })

    it('should return pending when no payment and future due date', () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 10)

      const result = PaymentChecker.calculateStatus(0, 100000, futureDate)

      expect(result).toBe('pending')
    })

    it('should return partial when actual less than expected', () => {
      const result = PaymentChecker.calculateStatus(50000, 100000, new Date())

      expect(result).toBe('partial')
    })

    it('should return paid when actual equals or exceeds expected', () => {
      const result = PaymentChecker.calculateStatus(100000, 100000, new Date())

      expect(result).toBe('paid')
    })

    it('should return paid when actual exceeds expected', () => {
      const result = PaymentChecker.calculateStatus(150000, 100000, new Date())

      expect(result).toBe('paid')
    })
  })

  describe('calculateExpectedPremium', () => {
    it('should calculate employee + employer premium by default', () => {
      const result = PaymentChecker.calculateExpectedPremium(500000, 'health')

      expect(result).toBe(50000)
    })

    it('should calculate only employee premium when specified', () => {
      const result = PaymentChecker.calculateExpectedPremium(500000, 'health', false)

      expect(result).toBe(25000)
    })

    it('should handle zero salary', () => {
      const result = PaymentChecker.calculateExpectedPremium(0, 'health')

      expect(result).toBe(0)
    })

    it('should calculate pension premium correctly', () => {
      const result = PaymentChecker.calculateExpectedPremium(500000, 'pension')

      expect(result).toBe(91500)
    })

    it('should calculate employment insurance correctly', () => {
      const result = PaymentChecker.calculateExpectedPremium(500000, 'employment')

      expect(result).toBe(7750)
    })

    it('should calculate work accident insurance (employer only)', () => {
      const result = PaymentChecker.calculateExpectedPremium(500000, 'work_accident')

      expect(result).toBe(1500)
    })
  })

  describe('getPaymentSummary', () => {
    it('should return payment summary for year', async () => {
      vi.mocked(prisma.socialInsurancePayment.findMany).mockResolvedValue([
        {
          id: 'payment-1',
          insuranceType: 'health',
          year: 2024,
          month: 6,
          expectedAmount: 100000,
          actualAmount: 100000,
          status: 'paid',
          paymentDate: new Date(),
        } as any,
      ])

      const result = await PaymentChecker.getPaymentSummary(mockCompanyId, 2024)

      expect(result).toHaveLength(1)
      expect(result[0].year).toBe(2024)
      expect(result[0].variance).toBe(0)
    })
  })

  describe('getOverduePayments', () => {
    it('should return overdue payments', async () => {
      vi.mocked(prisma.socialInsurancePayment.findMany).mockResolvedValue([
        {
          id: 'payment-1',
          dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
          status: 'pending',
        } as any,
      ])

      const result = await PaymentChecker.getOverduePayments(mockCompanyId)

      expect(result).toHaveLength(1)
    })

    it('should filter by pending and partial status', async () => {
      vi.mocked(prisma.socialInsurancePayment.findMany).mockResolvedValue([])

      await PaymentChecker.getOverduePayments(mockCompanyId)

      expect(prisma.socialInsurancePayment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['pending', 'partial'] },
          }),
        })
      )
    })
  })

  describe('checkPaymentAnomalies', () => {
    it('should identify payments with significant variance', async () => {
      vi.mocked(prisma.socialInsurancePayment.findMany).mockResolvedValue([
        {
          id: 'payment-1',
          expectedAmount: 100000,
          actualAmount: 150000,
        } as any,
      ])

      const result = await PaymentChecker.checkPaymentAnomalies(mockCompanyId)

      expect(result).toHaveLength(1)
    })

    it('should use custom threshold', async () => {
      vi.mocked(prisma.socialInsurancePayment.findMany).mockResolvedValue([
        {
          id: 'payment-1',
          expectedAmount: 100000,
          actualAmount: 120000,
        } as any,
      ])

      const result = await PaymentChecker.checkPaymentAnomalies(mockCompanyId, 0.1)

      expect(result).toHaveLength(1)
    })

    it('should not flag small variances', async () => {
      vi.mocked(prisma.socialInsurancePayment.findMany).mockResolvedValue([
        {
          id: 'payment-1',
          expectedAmount: 100000,
          actualAmount: 105000,
        } as any,
      ])

      const result = await PaymentChecker.checkPaymentAnomalies(mockCompanyId, 0.1)

      expect(result).toHaveLength(0)
    })

    it('should handle zero expected amount', async () => {
      vi.mocked(prisma.socialInsurancePayment.findMany).mockResolvedValue([
        {
          id: 'payment-1',
          expectedAmount: 0,
          actualAmount: 1000,
        } as any,
      ])

      const result = await PaymentChecker.checkPaymentAnomalies(mockCompanyId)

      expect(result).toHaveLength(0)
    })
  })
})
