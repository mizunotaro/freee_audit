import { prisma } from '@/lib/db'
import { InsuranceType } from './schedule-manager'

export interface JournalMatchResult {
  insuranceType: InsuranceType
  expectedAmount: number
  actualJournalAmount: number
  journalDate: Date
  dueDate: Date
  status: 'paid' | 'overdue' | 'partial' | 'missing'
  variance: number
  journalId?: string
}

export interface InsurancePaymentFromJournal {
  journalId: string
  date: Date
  amount: number
  description: string
  debitAccount: string
  creditAccount: string
}

export class JournalMatcher {
  static readonly INSURANCE_ACCOUNT_PATTERNS: Record<InsuranceType, string[]> = {
    health: ['健康保険料', '健康保険', '介護保険料', '介護保険'],
    pension: ['厚生年金', '年金保険', '厚生年金保険'],
    employment: ['雇用保険', '雇用保険料'],
    work_accident: ['労災保険', '労働災害', '労災'],
    care: ['介護保険', '介護保険料'],
  }

  static async extractInsurancePaymentsFromJournals(
    companyId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Map<InsuranceType, InsurancePaymentFromJournal[]>> {
    const journals = await prisma.journal.findMany({
      where: {
        companyId,
        entryDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { entryDate: 'asc' },
    })

    const paymentsByType = new Map<InsuranceType, InsurancePaymentFromJournal[]>()

    for (const [type, patterns] of Object.entries(this.INSURANCE_ACCOUNT_PATTERNS)) {
      const matchingJournals = journals.filter((j) =>
        patterns.some(
          (pattern) =>
            j.description.includes(pattern) ||
            j.debitAccount.includes(pattern) ||
            j.creditAccount.includes(pattern)
        )
      )

      const payments = matchingJournals.map((j) => ({
        journalId: j.id,
        date: j.entryDate,
        amount: j.amount,
        description: j.description,
        debitAccount: j.debitAccount,
        creditAccount: j.creditAccount,
      }))

      paymentsByType.set(type as InsuranceType, payments)
    }

    return paymentsByType
  }

  static async matchPaymentsWithExpected(
    companyId: string,
    year: number,
    month: number
  ): Promise<JournalMatchResult[]> {
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0)

    const payments = await prisma.socialInsurancePayment.findMany({
      where: {
        companyId,
        year,
        month,
      },
    })

    const journalPayments = await this.extractInsurancePaymentsFromJournals(
      companyId,
      startDate,
      endDate
    )

    const results: JournalMatchResult[] = []

    for (const payment of payments) {
      const type = payment.insuranceType as InsuranceType
      const journals = journalPayments.get(type) || []
      const totalJournalAmount = journals.reduce((sum, j) => sum + j.amount, 0)

      let status: JournalMatchResult['status'] = 'missing'
      if (totalJournalAmount >= payment.expectedAmount) {
        status = 'paid'
      } else if (totalJournalAmount > 0) {
        status = 'partial'
      } else if (new Date() > payment.dueDate) {
        status = 'overdue'
      }

      results.push({
        insuranceType: type,
        expectedAmount: payment.expectedAmount,
        actualJournalAmount: totalJournalAmount,
        journalDate: journals[0]?.date || startDate,
        dueDate: payment.dueDate,
        status,
        variance: totalJournalAmount - payment.expectedAmount,
        journalId: journals[0]?.journalId,
      })
    }

    return results
  }

  static async detectMissingPayments(
    companyId: string,
    year: number,
    month: number
  ): Promise<InsuranceType[]> {
    const results = await this.matchPaymentsWithExpected(companyId, year, month)
    return results
      .filter((r) => r.status === 'missing' || r.status === 'overdue')
      .map((r) => r.insuranceType)
  }

  static async generatePaymentSuggestions(
    companyId: string,
    year: number,
    month: number
  ): Promise<{ insuranceType: InsuranceType; suggestedAmount: number; dueDate: Date }[]> {
    const payments = await prisma.socialInsurancePayment.findMany({
      where: {
        companyId,
        year,
        month,
        status: { in: ['pending', 'partial'] },
      },
    })

    return payments.map((p) => ({
      insuranceType: p.insuranceType as InsuranceType,
      suggestedAmount: p.expectedAmount - p.actualAmount,
      dueDate: p.dueDate,
    }))
  }
}
