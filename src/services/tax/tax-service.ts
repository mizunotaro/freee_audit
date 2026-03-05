import { PrismaClient, TaxSchedule, TaxPayment } from '@prisma/client'

const prisma = new PrismaClient()

export type TaxType = 'corporate' | 'withholding' | 'depreciation' | 'consumption'
export type TaxStatus = 'PENDING' | 'FILED' | 'PAID'

export interface CreateTaxScheduleInput {
  companyId: string
  taxType: TaxType
  fiscalYear: number
  dueDate: Date
  amount?: number
  note?: string
}

export interface UpdateTaxScheduleInput {
  amount?: number
  status?: TaxStatus
  filedDate?: Date
  paidDate?: Date
  note?: string
}

export interface CreateTaxPaymentInput {
  taxScheduleId: string
  paymentDate: Date
  amount: number
  paymentMethod: string
  referenceNumber?: string
  note?: string
}

export class TaxService {
  static async getTaxSchedules(companyId: string, fiscalYear?: number): Promise<TaxSchedule[]> {
    const where: any = { companyId }
    if (fiscalYear) {
      where.fiscalYear = fiscalYear
    }
    return prisma.taxSchedule.findMany({
      where,
      include: { payments: true },
      orderBy: [{ fiscalYear: 'asc' }, { dueDate: 'asc' }],
    })
  }

  static async getTaxScheduleById(id: string): Promise<TaxSchedule | null> {
    return prisma.taxSchedule.findUnique({
      where: { id },
      include: { payments: true },
    })
  }

  static async createTaxSchedule(data: CreateTaxScheduleInput): Promise<TaxSchedule> {
    return prisma.taxSchedule.create({
      data: {
        companyId: data.companyId,
        taxType: data.taxType,
        fiscalYear: data.fiscalYear,
        dueDate: data.dueDate,
        amount: data.amount,
        note: data.note,
      },
    })
  }

  static async updateTaxSchedule(id: string, data: UpdateTaxScheduleInput): Promise<TaxSchedule> {
    return prisma.taxSchedule.update({
      where: { id },
      data,
    })
  }

  static async deleteTaxSchedule(id: string): Promise<TaxSchedule> {
    return prisma.taxSchedule.delete({
      where: { id },
    })
  }

  static async createTaxPayment(data: CreateTaxPaymentInput): Promise<TaxPayment> {
    const payment = await prisma.taxPayment.create({
      data: {
        taxScheduleId: data.taxScheduleId,
        paymentDate: data.paymentDate,
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        referenceNumber: data.referenceNumber,
        note: data.note,
      },
    })

    const totalPaid = await this.getTotalPaidAmount(data.taxScheduleId)
    const schedule = await prisma.taxSchedule.findUnique({
      where: { id: data.taxScheduleId },
    })

    if (schedule && schedule.amount && totalPaid >= schedule.amount) {
      await prisma.taxSchedule.update({
        where: { id: data.taxScheduleId },
        data: { status: 'PAID', paidDate: data.paymentDate },
      })
    }

    return payment
  }

  static async getTaxPayments(taxScheduleId: string): Promise<TaxPayment[]> {
    return prisma.taxPayment.findMany({
      where: { taxScheduleId },
      orderBy: { paymentDate: 'asc' },
    })
  }

  static async getTotalPaidAmount(taxScheduleId: string): Promise<number> {
    const payments = await prisma.taxPayment.findMany({
      where: { taxScheduleId },
      select: { amount: true },
    })
    return payments.reduce((sum, p) => sum + p.amount, 0)
  }

  static async generateDefaultTaxSchedules(
    companyId: string,
    fiscalYearEndMonth: number,
    fiscalYear: number
  ): Promise<TaxSchedule[]> {
    const schedules: CreateTaxScheduleInput[] = []
    const year = fiscalYear

    const corporateDueDate = new Date(year + 1, fiscalYearEndMonth + 2, 1)
    schedules.push({
      companyId,
      taxType: 'corporate',
      fiscalYear: year,
      dueDate: corporateDueDate,
      note: '法人税（法人所得税・法人住民税）',
    })

    const withholdingDueDates = [5, 11]
    withholdingDueDates.forEach((month) => {
      const dueDate = new Date(year + 1, month, 10)
      schedules.push({
        companyId,
        taxType: 'withholding',
        fiscalYear: year,
        dueDate,
        note: '源泉徴収税',
      })
    })

    const depreciationDueDate = new Date(year + 1, fiscalYearEndMonth + 2, 1)
    schedules.push({
      companyId,
      taxType: 'depreciation',
      fiscalYear: year,
      dueDate: depreciationDueDate,
      note: '償却資産税',
    })

    const consumptionDueDate = new Date(year + 1, fiscalYearEndMonth + 2, 1)
    schedules.push({
      companyId,
      taxType: 'consumption',
      fiscalYear: year,
      dueDate: consumptionDueDate,
      note: '消費税',
    })

    return Promise.all(schedules.map((s) => this.createTaxSchedule(s)))
  }
}
