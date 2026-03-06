import { AccrualExpense } from '@prisma/client'
import { prisma } from '@/lib/db'

export interface AccrualExpenseInput {
  companyId: string
  accountCode: string
  accountName: string
  accrualYear: number
  accrualMonth: number
  expectedAmount: number
  actualAmount: number
  accrualJournalId?: string
  notes?: string
}

export interface PaymentCheckResult {
  accrualId: string
  accountName: string
  accrualYear: number
  accrualMonth: number
  expectedAmount: number
  actualAmount: number
  status: 'accrued' | 'paid' | 'overdue' | 'anomaly'
  daysSinceAccrual: number
}

export class AccrualExpenseTracker {
  static readonly ACCRUAL_ACCOUNT_PATTERNS = [
    '未払費用',
    '未払賃金',
    '未払給料',
    '未払広告料',
    '未払水道光熱費',
    '未払修繕費',
    '未払税金',
    '未払金',
    'アクラウル',
  ]

  static readonly TYPICAL_PAYMENT_TERMS: Record<string, number> = {
    未払賃金: 15,
    未払給料: 15,
    未払広告料: 30,
    未払水道光熱費: 30,
    未払修繕費: 30,
    未払税金: 60,
  }

  static async getAccrualExpenses(companyId: string): Promise<AccrualExpense[]> {
    return prisma.accrualExpense.findMany({
      where: { companyId },
      orderBy: [{ accrualYear: 'desc' }, { accrualMonth: 'desc' }],
    })
  }

  static async getUnpaidAccrualExpenses(companyId: string): Promise<AccrualExpense[]> {
    return prisma.accrualExpense.findMany({
      where: { companyId, status: 'ACCRUED' },
      orderBy: [{ accrualYear: 'desc' }, { accrualMonth: 'desc' }],
    })
  }

  static async createAccrualExpense(data: AccrualExpenseInput): Promise<AccrualExpense> {
    return prisma.accrualExpense.create({
      data: {
        companyId: data.companyId,
        accountCode: data.accountCode,
        accountName: data.accountName,
        accrualYear: data.accrualYear,
        accrualMonth: data.accrualMonth,
        expectedAmount: data.expectedAmount,
        actualAmount: data.actualAmount,
        accrualJournalId: data.accrualJournalId,
        status: 'ACCRUED',
        notes: data.notes,
      },
    })
  }

  static async recordPayment(
    accrualId: string,
    paymentYear: number,
    paymentMonth: number,
    paymentJournalId: string
  ): Promise<AccrualExpense> {
    return prisma.accrualExpense.update({
      where: { id: accrualId },
      data: {
        paymentYear,
        paymentMonth,
        paymentJournalId,
        status: 'PAID',
      },
    })
  }

  static async checkPaymentStatus(companyId: string): Promise<PaymentCheckResult[]> {
    const accruals = await this.getUnpaidAccrualExpenses(companyId)
    const results: PaymentCheckResult[] = []
    const now = new Date()

    for (const accrual of accruals) {
      const accrualDate = new Date(accrual.accrualYear, accrual.accrualMonth - 1, 1)
      const daysSinceAccrual = Math.floor(
        (now.getTime() - accrualDate.getTime()) / (24 * 60 * 60 * 1000)
      )

      const expectedPaymentDays = this.TYPICAL_PAYMENT_TERMS[accrual.accountName] || 30
      const isOverdue = daysSinceAccrual > expectedPaymentDays

      results.push({
        accrualId: accrual.id,
        accountName: accrual.accountName,
        accrualYear: accrual.accrualYear,
        accrualMonth: accrual.accrualMonth,
        expectedAmount: accrual.expectedAmount,
        actualAmount: accrual.actualAmount,
        status: isOverdue ? 'overdue' : 'accrued',
        daysSinceAccrual,
      })
    }

    return results
  }

  static async detectAccrualExpensesFromJournals(
    companyId: string,
    year: number,
    month: number
  ): Promise<AccrualExpenseInput[]> {
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0)

    const journals = await prisma.journal.findMany({
      where: {
        companyId,
        entryDate: { gte: startDate, lte: endDate },
        creditAccount: { contains: '未払' },
      },
    })

    const detected: AccrualExpenseInput[] = []

    for (const journal of journals) {
      detected.push({
        companyId,
        accountCode: journal.creditAccount,
        accountName: journal.creditAccount,
        accrualYear: year,
        accrualMonth: month,
        expectedAmount: journal.amount,
        actualAmount: journal.amount,
        accrualJournalId: journal.id,
        notes: journal.description,
      })
    }

    return detected
  }

  static async checkAnomalies(companyId: string): Promise<AccrualExpense[]> {
    const accruals = await prisma.accrualExpense.findMany({
      where: { companyId },
    })

    const anomalies: AccrualExpense[] = []

    for (const accrual of accruals) {
      const variance = Math.abs(accrual.actualAmount - accrual.expectedAmount)
      const varianceRatio = accrual.expectedAmount > 0 ? variance / accrual.expectedAmount : 0

      if (varianceRatio > 0.1) {
        anomalies.push(accrual)
      }
    }

    return anomalies
  }

  static async matchPaymentsWithAccruals(
    companyId: string,
    year: number,
    month: number
  ): Promise<{ matched: AccrualExpense[]; unmatched: AccrualExpense[] }> {
    const accruals = await this.getUnpaidAccrualExpenses(companyId)
    const previousMonth = month === 1 ? 12 : month - 1
    const previousYear = month === 1 ? year - 1 : year

    const paymentJournals = await prisma.journal.findMany({
      where: {
        companyId,
        entryDate: {
          gte: new Date(year, month - 1, 1),
          lt: new Date(year, month, 1),
        },
        debitAccount: { contains: '未払' },
      },
    })

    const matched: AccrualExpense[] = []
    const unmatched: AccrualExpense[] = []

    for (const accrual of accruals) {
      if (accrual.accrualYear === previousYear && accrual.accrualMonth === previousMonth) {
        const matchingJournal = paymentJournals.find(
          (j) =>
            j.debitAccount === accrual.accountName &&
            Math.abs(j.amount - accrual.actualAmount) < 1000
        )

        if (matchingJournal) {
          await this.recordPayment(accrual.id, year, month, matchingJournal.id)
          matched.push(accrual)
        } else {
          unmatched.push(accrual)
        }
      }
    }

    return { matched, unmatched }
  }
}
