import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  TaxService,
  type CreateTaxScheduleInput,
  type UpdateTaxScheduleInput,
  type CreateTaxPaymentInput,
} from '@/services/tax/tax-service'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    taxSchedule: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    taxPayment: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

describe('TaxService', () => {
  const mockCompanyId = 'company-1'
  const mockTaxSchedule = {
    id: 'schedule-1',
    companyId: mockCompanyId,
    taxType: 'corporate',
    fiscalYear: 2024,
    dueDate: new Date('2025-03-31'),
    amount: 1000000,
    status: 'PENDING',
    filedDate: null,
    paidDate: null,
    note: '法人税',
    createdAt: new Date(),
    updatedAt: new Date(),
    payments: [],
  }

  const mockTaxPayment = {
    id: 'payment-1',
    taxScheduleId: 'schedule-1',
    paymentDate: new Date('2025-03-30'),
    amount: 500000,
    paymentMethod: 'bank_transfer',
    referenceNumber: 'REF-001',
    note: 'Partial payment',
    createdAt: new Date(),
  }

  const mockPaymentSelect = {
    id: 'payment-1',
    amount: 500000,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getTaxSchedules', () => {
    it('should return all tax schedules for a company', async () => {
      vi.mocked(prisma.taxSchedule.findMany).mockResolvedValue([mockTaxSchedule])

      const result = await TaxService.getTaxSchedules(mockCompanyId)

      expect(prisma.taxSchedule.findMany).toHaveBeenCalledWith({
        where: { companyId: mockCompanyId },
        include: { payments: true },
        orderBy: [{ fiscalYear: 'asc' }, { dueDate: 'asc' }],
      })
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(mockTaxSchedule)
    })

    it('should filter schedules by fiscal year', async () => {
      vi.mocked(prisma.taxSchedule.findMany).mockResolvedValue([mockTaxSchedule])

      await TaxService.getTaxSchedules(mockCompanyId, 2024)

      expect(prisma.taxSchedule.findMany).toHaveBeenCalledWith({
        where: { companyId: mockCompanyId, fiscalYear: 2024 },
        include: { payments: true },
        orderBy: [{ fiscalYear: 'asc' }, { dueDate: 'asc' }],
      })
    })

    it('should return empty array when no schedules exist', async () => {
      vi.mocked(prisma.taxSchedule.findMany).mockResolvedValue([])

      const result = await TaxService.getTaxSchedules(mockCompanyId)

      expect(result).toEqual([])
    })
  })

  describe('getTaxScheduleById', () => {
    it('should return a tax schedule by id', async () => {
      vi.mocked(prisma.taxSchedule.findUnique).mockResolvedValue(mockTaxSchedule)

      const result = await TaxService.getTaxScheduleById('schedule-1')

      expect(prisma.taxSchedule.findUnique).toHaveBeenCalledWith({
        where: { id: 'schedule-1' },
        include: { payments: true },
      })
      expect(result).toEqual(mockTaxSchedule)
    })

    it('should return null for non-existent schedule', async () => {
      vi.mocked(prisma.taxSchedule.findUnique).mockResolvedValue(null)

      const result = await TaxService.getTaxScheduleById('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('createTaxSchedule', () => {
    it('should create a new tax schedule', async () => {
      const input: CreateTaxScheduleInput = {
        companyId: mockCompanyId,
        taxType: 'corporate',
        fiscalYear: 2024,
        dueDate: new Date('2025-03-31'),
        amount: 1000000,
        note: '法人税',
      }

      vi.mocked(prisma.taxSchedule.create).mockResolvedValue(mockTaxSchedule)

      const result = await TaxService.createTaxSchedule(input)

      expect(prisma.taxSchedule.create).toHaveBeenCalledWith({
        data: {
          companyId: input.companyId,
          taxType: input.taxType,
          fiscalYear: input.fiscalYear,
          dueDate: input.dueDate,
          amount: input.amount,
          note: input.note,
        },
      })
      expect(result).toEqual(mockTaxSchedule)
    })

    it('should create schedule without amount and note', async () => {
      const input: CreateTaxScheduleInput = {
        companyId: mockCompanyId,
        taxType: 'consumption',
        fiscalYear: 2024,
        dueDate: new Date('2025-03-31'),
      }

      vi.mocked(prisma.taxSchedule.create).mockResolvedValue({
        ...mockTaxSchedule,
        taxType: 'consumption',
        amount: null,
        note: null,
      })

      const result = await TaxService.createTaxSchedule(input)

      expect(result.taxType).toBe('consumption')
      expect(result.amount).toBeNull()
    })
  })

  describe('updateTaxSchedule', () => {
    it('should update tax schedule amount', async () => {
      const input: UpdateTaxScheduleInput = { amount: 1500000 }

      vi.mocked(prisma.taxSchedule.update).mockResolvedValue({
        ...mockTaxSchedule,
        amount: 1500000,
      })

      const result = await TaxService.updateTaxSchedule('schedule-1', input)

      expect(prisma.taxSchedule.update).toHaveBeenCalledWith({
        where: { id: 'schedule-1' },
        data: { amount: 1500000 },
      })
      expect(result.amount).toBe(1500000)
    })

    it('should update schedule status to FILED', async () => {
      const filedDate = new Date('2025-03-15')
      const input: UpdateTaxScheduleInput = { status: 'FILED', filedDate }

      vi.mocked(prisma.taxSchedule.update).mockResolvedValue({
        ...mockTaxSchedule,
        status: 'FILED',
        filedDate,
      })

      const result = await TaxService.updateTaxSchedule('schedule-1', input)

      expect(result.status).toBe('FILED')
      expect(result.filedDate).toEqual(filedDate)
    })

    it('should update schedule status to PAID', async () => {
      const paidDate = new Date('2025-03-20')
      const input: UpdateTaxScheduleInput = { status: 'PAID', paidDate }

      vi.mocked(prisma.taxSchedule.update).mockResolvedValue({
        ...mockTaxSchedule,
        status: 'PAID',
        paidDate,
      })

      const result = await TaxService.updateTaxSchedule('schedule-1', input)

      expect(result.status).toBe('PAID')
    })
  })

  describe('deleteTaxSchedule', () => {
    it('should delete a tax schedule', async () => {
      vi.mocked(prisma.taxSchedule.delete).mockResolvedValue(mockTaxSchedule)

      await TaxService.deleteTaxSchedule('schedule-1')

      expect(prisma.taxSchedule.delete).toHaveBeenCalledWith({
        where: { id: 'schedule-1' },
      })
    })
  })

  describe('createTaxPayment', () => {
    it('should create a tax payment', async () => {
      const input: CreateTaxPaymentInput = {
        taxScheduleId: 'schedule-1',
        paymentDate: new Date('2025-03-30'),
        amount: 500000,
        paymentMethod: 'bank_transfer',
      }

      vi.mocked(prisma.taxPayment.create).mockResolvedValue(mockTaxPayment)
      vi.mocked(prisma.taxPayment.findMany).mockResolvedValue([mockPaymentSelect] as any)
      vi.mocked(prisma.taxSchedule.findUnique).mockResolvedValue({
        ...mockTaxSchedule,
        amount: 1000000,
      })
      vi.mocked(prisma.taxSchedule.update).mockResolvedValue(mockTaxSchedule)

      const result = await TaxService.createTaxPayment(input)

      expect(prisma.taxPayment.create).toHaveBeenCalled()
      expect(result).toEqual(mockTaxPayment)
    })

    it('should mark schedule as PAID when fully paid', async () => {
      const input: CreateTaxPaymentInput = {
        taxScheduleId: 'schedule-1',
        paymentDate: new Date('2025-03-30'),
        amount: 1000000,
        paymentMethod: 'bank_transfer',
      }

      vi.mocked(prisma.taxPayment.create).mockResolvedValue({
        ...mockTaxPayment,
        amount: 1000000,
      })
      vi.mocked(prisma.taxPayment.findMany).mockResolvedValue([
        { ...mockPaymentSelect, amount: 1000000 },
      ] as any)
      vi.mocked(prisma.taxSchedule.findUnique).mockResolvedValue({
        ...mockTaxSchedule,
        amount: 1000000,
      })
      vi.mocked(prisma.taxSchedule.update).mockResolvedValue({
        ...mockTaxSchedule,
        status: 'PAID',
        paidDate: input.paymentDate,
      })

      await TaxService.createTaxPayment(input)

      expect(prisma.taxSchedule.update).toHaveBeenCalledWith({
        where: { id: 'schedule-1' },
        data: { status: 'PAID', paidDate: input.paymentDate },
      })
    })

    it('should not mark as PAID when partially paid', async () => {
      const input: CreateTaxPaymentInput = {
        taxScheduleId: 'schedule-1',
        paymentDate: new Date('2025-03-30'),
        amount: 300000,
        paymentMethod: 'bank_transfer',
      }

      vi.mocked(prisma.taxPayment.create).mockResolvedValue(mockTaxPayment)
      vi.mocked(prisma.taxPayment.findMany).mockResolvedValue([
        { ...mockPaymentSelect, amount: 300000 },
      ] as any)
      vi.mocked(prisma.taxSchedule.findUnique).mockResolvedValue({
        ...mockTaxSchedule,
        amount: 1000000,
      })

      await TaxService.createTaxPayment(input)

      expect(prisma.taxSchedule.update).not.toHaveBeenCalled()
    })
  })

  describe('getTaxPayments', () => {
    it('should return all payments for a schedule', async () => {
      vi.mocked(prisma.taxPayment.findMany).mockResolvedValue([mockTaxPayment])

      const result = await TaxService.getTaxPayments('schedule-1')

      expect(prisma.taxPayment.findMany).toHaveBeenCalledWith({
        where: { taxScheduleId: 'schedule-1' },
        orderBy: { paymentDate: 'asc' },
      })
      expect(result).toHaveLength(1)
    })

    it('should return empty array when no payments exist', async () => {
      vi.mocked(prisma.taxPayment.findMany).mockResolvedValue([])

      const result = await TaxService.getTaxPayments('schedule-1')

      expect(result).toEqual([])
    })
  })

  describe('getTotalPaidAmount', () => {
    it('should calculate total paid amount', async () => {
      vi.mocked(prisma.taxPayment.findMany).mockResolvedValue([
        { ...mockPaymentSelect, amount: 300000 },
        { ...mockPaymentSelect, amount: 500000 },
      ] as any)

      const result = await TaxService.getTotalPaidAmount('schedule-1')

      expect(result).toBe(800000)
    })

    it('should return 0 when no payments exist', async () => {
      vi.mocked(prisma.taxPayment.findMany).mockResolvedValue([])

      const result = await TaxService.getTotalPaidAmount('schedule-1')

      expect(result).toBe(0)
    })
  })

  describe('generateDefaultTaxSchedules', () => {
    it('should generate default schedules without withholding special rule', async () => {
      ;(prisma.taxSchedule.create as any).mockImplementation(async (args: any) => ({
        id: `schedule-${args.data.taxType}`,
        companyId: args.data.companyId,
        taxType: args.data.taxType,
        fiscalYear: args.data.fiscalYear,
        dueDate: args.data.dueDate,
        amount: null,
        status: 'PENDING',
        filedDate: null,
        paidDate: null,
        note: args.data.note,
        createdAt: new Date(),
        updatedAt: new Date(),
        payments: [],
      }))

      const result = await TaxService.generateDefaultTaxSchedules(mockCompanyId, 12, 2024, false)

      expect(result.length).toBe(5)
      expect(result.map((s) => s.taxType)).toContain('corporate')
      expect(result.map((s) => s.taxType)).toContain('consumption')
      expect(result.map((s) => s.taxType)).toContain('depreciation')
      expect(result.filter((s) => s.taxType === 'withholding').length).toBe(2)
    })

    it('should generate schedules with withholding special rule', async () => {
      ;(prisma.taxSchedule.create as any).mockImplementation(async (args: any) => ({
        id: `schedule-${args.data.taxType}`,
        companyId: args.data.companyId,
        taxType: args.data.taxType,
        fiscalYear: args.data.fiscalYear,
        dueDate: args.data.dueDate,
        amount: null,
        status: 'PENDING',
        filedDate: null,
        paidDate: null,
        note: args.data.note,
        createdAt: new Date(),
        updatedAt: new Date(),
        payments: [],
      }))

      const result = await TaxService.generateDefaultTaxSchedules(mockCompanyId, 12, 2024, true)

      const withholdingSchedules = result.filter((s) => s.taxType === 'withholding')
      expect(withholdingSchedules.length).toBe(2)
      expect(withholdingSchedules[0].note).toContain('納期の特例')
    })

    it('should generate correct due dates based on fiscal year end', async () => {
      ;(prisma.taxSchedule.create as any).mockImplementation(async (args: any) => ({
        id: `schedule-${args.data.taxType}`,
        companyId: args.data.companyId,
        taxType: args.data.taxType,
        fiscalYear: args.data.fiscalYear,
        dueDate: args.data.dueDate,
        amount: null,
        status: 'PENDING',
        filedDate: null,
        paidDate: null,
        note: args.data.note,
        createdAt: new Date(),
        updatedAt: new Date(),
        payments: [],
      }))

      const result = await TaxService.generateDefaultTaxSchedules(mockCompanyId, 3, 2024, false)

      const corporateSchedule = result.find((s) => s.taxType === 'corporate')
      expect(corporateSchedule).toBeDefined()
    })
  })
})
