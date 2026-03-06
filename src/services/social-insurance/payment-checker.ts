import { SocialInsurancePayment } from '@prisma/client'
import { prisma } from '@/lib/db'
import { InsuranceType } from './schedule-manager'

export interface PaymentCheckResult {
  insuranceType: InsuranceType
  year: number
  month: number
  expectedAmount: number
  actualAmount: number
  status: 'paid' | 'pending' | 'partial' | 'overdue'
  variance: number
  paymentDate?: Date
}

export interface CreatePaymentInput {
  companyId: string
  insuranceType: InsuranceType
  year: number
  month: number
  expectedAmount: number
  actualAmount: number
  dueDate: Date
  journalEntryId?: string
  paymentDate?: Date
  notes?: string
}

export class PaymentChecker {
  static readonly INSURANCE_RATE: Record<InsuranceType, { employee: number; employer: number }> = {
    health: { employee: 0.05, employer: 0.05 },
    pension: { employee: 0.0915, employer: 0.0915 },
    employment: { employee: 0.006, employer: 0.0095 },
    work_accident: { employee: 0, employer: 0.003 },
    care: { employee: 0.009, employer: 0.009 },
  }

  static async getPayments(
    companyId: string,
    filters?: { insuranceType?: InsuranceType; year?: number; month?: number }
  ): Promise<SocialInsurancePayment[]> {
    const where: any = { companyId }
    if (filters?.insuranceType) {
      where.insuranceType = filters.insuranceType
    }
    if (filters?.year) {
      where.year = filters.year
    }
    if (filters?.month) {
      where.month = filters.month
    }
    return prisma.socialInsurancePayment.findMany({
      where,
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    })
  }

  static async createPayment(data: CreatePaymentInput): Promise<SocialInsurancePayment> {
    const status = this.calculateStatus(data.actualAmount, data.expectedAmount, data.dueDate)

    return prisma.socialInsurancePayment.create({
      data: {
        companyId: data.companyId,
        insuranceType: data.insuranceType,
        year: data.year,
        month: data.month,
        expectedAmount: data.expectedAmount,
        actualAmount: data.actualAmount,
        dueDate: data.dueDate,
        journalEntryId: data.journalEntryId,
        paymentDate: data.paymentDate,
        status,
        notes: data.notes,
      },
    })
  }

  static async updatePayment(
    id: string,
    data: Partial<CreatePaymentInput>
  ): Promise<SocialInsurancePayment> {
    const existing = await prisma.socialInsurancePayment.findUnique({ where: { id } })
    if (!existing) {
      throw new Error('Payment not found')
    }

    const status = this.calculateStatus(
      data.actualAmount ?? existing.actualAmount,
      data.expectedAmount ?? existing.expectedAmount,
      data.dueDate ?? existing.dueDate
    )

    return prisma.socialInsurancePayment.update({
      where: { id },
      data: {
        ...data,
        status,
      },
    })
  }

  static calculateStatus(actualAmount: number, expectedAmount: number, dueDate: Date): string {
    if (actualAmount === 0) {
      return new Date() > dueDate ? 'overdue' : 'pending'
    }
    if (actualAmount < expectedAmount) {
      return 'partial'
    }
    return 'paid'
  }

  static calculateExpectedPremium(
    totalSalary: number,
    insuranceType: InsuranceType,
    includeEmployer: boolean = true
  ): number {
    const rates = this.INSURANCE_RATE[insuranceType]
    const employeePremium = totalSalary * rates.employee
    if (includeEmployer) {
      const employerPremium = totalSalary * rates.employer
      return employeePremium + employerPremium
    }
    return employeePremium
  }

  static async getPaymentSummary(companyId: string, year: number): Promise<PaymentCheckResult[]> {
    const payments = await prisma.socialInsurancePayment.findMany({
      where: { companyId, year },
    })

    return payments.map((p) => ({
      insuranceType: p.insuranceType as InsuranceType,
      year: p.year,
      month: p.month,
      expectedAmount: p.expectedAmount,
      actualAmount: p.actualAmount,
      status: p.status as PaymentCheckResult['status'],
      variance: p.actualAmount - p.expectedAmount,
      paymentDate: p.paymentDate ?? undefined,
    }))
  }

  static async getOverduePayments(companyId: string): Promise<SocialInsurancePayment[]> {
    const now = new Date()
    return prisma.socialInsurancePayment.findMany({
      where: {
        companyId,
        dueDate: { lt: now },
        status: { in: ['pending', 'partial'] },
      },
      orderBy: { dueDate: 'asc' },
    })
  }

  static async checkPaymentAnomalies(
    companyId: string,
    threshold: number = 0.1
  ): Promise<SocialInsurancePayment[]> {
    const payments = await prisma.socialInsurancePayment.findMany({
      where: { companyId },
    })

    return payments.filter((p) => {
      if (p.expectedAmount === 0) return false
      const varianceRatio = Math.abs(p.actualAmount - p.expectedAmount) / p.expectedAmount
      return varianceRatio > threshold
    })
  }
}
