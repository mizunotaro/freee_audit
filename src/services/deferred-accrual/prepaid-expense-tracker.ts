import { prisma } from '@/lib/db'
import type { PrepaidExpense, PrepaidAmortization } from '@prisma/client'

export interface PrepaidExpenseWithAmortizations {
  id: string
  companyId: string
  accountCode: string
  accountName: string
  originalAmount: number
  remainingAmount: number
  startDate: Date
  endDate: Date
  totalMonths: number
  monthlyAmount: number
  status: string
  notes: string | null
  createdAt: Date
  updatedAt: Date
  amortizations: {
    id: string
    prepaidId: string
    year: number
    month: number
    expectedAmount: number
    actualAmount: number
    journalEntryId: string | null
    status: string
    createdAt: Date
    updatedAt: Date
  }[]
}

export interface PrepaidExpenseInput {
  companyId: string
  accountCode: string
  accountName: string
  originalAmount: number
  startDate: Date
  endDate: Date
  totalMonths: number
  notes?: string
}

export interface AmortizationCheckResult {
  prepaidId: string
  accountName: string
  year: number
  month: number
  expectedAmount: number
  actualAmount: number
  status: 'completed' | 'partial' | 'missing' | 'over_amortized'
  variance: number
}

export class PrepaidExpenseTracker {
  static readonly PREPAID_ACCOUNT_PATTERNS = [
    '前払費用',
    '前払リース料',
    '前払保険料',
    '前払ソフトウェア',
    '前払広告料',
    '前払賃借料',
    'プレペイド',
  ]

  static async getPrepaidExpenses(companyId: string): Promise<PrepaidExpenseWithAmortizations[]> {
    return prisma.prepaidExpense.findMany({
      where: { companyId },
      include: { amortizations: true },
      orderBy: { startDate: 'desc' },
    }) as Promise<PrepaidExpenseWithAmortizations[]>
  }

  static async getActivePrepaidExpenses(
    companyId: string
  ): Promise<PrepaidExpenseWithAmortizations[]> {
    return prisma.prepaidExpense.findMany({
      where: { companyId, status: 'ACTIVE' },
      include: { amortizations: true },
      orderBy: { startDate: 'desc' },
    }) as Promise<PrepaidExpenseWithAmortizations[]>
  }

  static async createPrepaidExpense(data: PrepaidExpenseInput): Promise<PrepaidExpense> {
    const monthlyAmount = Math.round(data.originalAmount / data.totalMonths)
    const remainingAmount = data.originalAmount

    return prisma.prepaidExpense.create({
      data: {
        companyId: data.companyId,
        accountCode: data.accountCode,
        accountName: data.accountName,
        originalAmount: data.originalAmount,
        remainingAmount,
        startDate: data.startDate,
        endDate: data.endDate,
        totalMonths: data.totalMonths,
        monthlyAmount,
        status: 'ACTIVE',
        notes: data.notes,
      },
    })
  }

  static async updatePrepaidExpense(
    id: string,
    data: Partial<PrepaidExpenseInput>
  ): Promise<PrepaidExpense> {
    const updateData: any = { ...data }
    if (data.originalAmount && data.totalMonths) {
      updateData.monthlyAmount = Math.round(data.originalAmount / data.totalMonths)
    }
    return prisma.prepaidExpense.update({
      where: { id },
      data: updateData,
    })
  }

  static async recordAmortization(
    prepaidId: string,
    year: number,
    month: number,
    actualAmount: number,
    journalEntryId?: string
  ): Promise<PrepaidAmortization> {
    const prepaid = await prisma.prepaidExpense.findUnique({
      where: { id: prepaidId },
    })
    if (!prepaid) {
      throw new Error('Prepaid expense not found')
    }

    const status = actualAmount >= prepaid.monthlyAmount ? 'completed' : 'partial'

    const amortization = await prisma.prepaidAmortization.create({
      data: {
        prepaidId,
        year,
        month,
        expectedAmount: prepaid.monthlyAmount,
        actualAmount,
        journalEntryId,
        status,
      },
    })

    await prisma.prepaidExpense.update({
      where: { id: prepaidId },
      data: {
        remainingAmount: prepaid.remainingAmount - actualAmount,
      },
    })

    await this.checkAndUpdateStatus(prepaidId)

    return amortization
  }

  static async checkAndUpdateStatus(prepaidId: string): Promise<void> {
    const prepaid = await prisma.prepaidExpense.findUnique({
      where: { id: prepaidId },
      include: { amortizations: true },
    })
    if (!prepaid) return

    if (prepaid.remainingAmount <= 0) {
      await prisma.prepaidExpense.update({
        where: { id: prepaidId },
        data: { status: 'FULLY_AMORTIZED' },
      })
    }
  }

  static async checkAmortizationSchedule(
    companyId: string,
    year: number,
    month: number
  ): Promise<AmortizationCheckResult[]> {
    const prepaids = await this.getActivePrepaidExpenses(companyId)
    const results: AmortizationCheckResult[] = []

    for (const prepaid of prepaids) {
      const startDate = new Date(prepaid.startDate)
      const endDate = new Date(prepaid.endDate)
      const checkDate = new Date(year, month - 1, 1)

      if (checkDate >= startDate && checkDate <= endDate) {
        const amortization = prepaid.amortizations.find((a) => a.year === year && a.month === month)

        results.push({
          prepaidId: prepaid.id,
          accountName: prepaid.accountName,
          year,
          month,
          expectedAmount: prepaid.monthlyAmount,
          actualAmount: amortization?.actualAmount || 0,
          status: (amortization?.status || 'missing') as
            | 'completed'
            | 'partial'
            | 'missing'
            | 'over_amortized',
          variance: (amortization?.actualAmount || 0) - prepaid.monthlyAmount,
        })
      }
    }

    return results
  }

  static async detectPrepaidExpensesFromJournals(
    companyId: string
  ): Promise<PrepaidExpenseInput[]> {
    const journals = await prisma.journal.findMany({
      where: {
        companyId,
      },
      orderBy: { entryDate: 'desc' },
    })

    const filteredJournals = journals.filter((j) =>
      this.PREPAID_ACCOUNT_PATTERNS.some((p) => j.debitAccount.includes(p))
    )

    const detected: PrepaidExpenseInput[] = []

    for (const journal of filteredJournals) {
      const months = this.extractMonthsFromDescription(journal.description)
      if (months > 1) {
        detected.push({
          companyId,
          accountCode: journal.debitAccount,
          accountName: journal.debitAccount,
          originalAmount: journal.amount,
          startDate: journal.entryDate,
          endDate: new Date(
            journal.entryDate.getFullYear(),
            journal.entryDate.getMonth() + months,
            0
          ),
          totalMonths: months,
          notes: journal.description,
        })
      }
    }

    return detected
  }

  private static async calculateMonthlyAverage(companyId: string): Promise<number> {
    const result = await prisma.journal.aggregate({
      where: { companyId },
      _avg: { amount: true },
    })
    return result._avg.amount || 1000000
  }

  private static extractMonthsFromDescription(description: string): number {
    const match = description.match(/(\d+)[ヶカ月]/)
    if (match) {
      return parseInt(match[1])
    }
    if (description.includes('年間') || description.includes('1年')) {
      return 12
    }
    return 1
  }

  static async generateAmortizationEntries(
    companyId: string,
    year: number,
    month: number
  ): Promise<{ prepaidId: string; accountName: string; amount: number }[]> {
    const prepaids = await this.getActivePrepaidExpenses(companyId)
    const entries: { prepaidId: string; accountName: string; amount: number }[] = []

    for (const prepaid of prepaids) {
      const startDate = new Date(prepaid.startDate)
      const endDate = new Date(prepaid.endDate)
      const checkDate = new Date(year, month - 1, 1)

      if (checkDate >= startDate && checkDate <= endDate) {
        const hasAmortization = prepaid.amortizations.some(
          (a) => a.year === year && a.month === month
        )
        if (!hasAmortization) {
          entries.push({
            prepaidId: prepaid.id,
            accountName: prepaid.accountName,
            amount: prepaid.monthlyAmount,
          })
        }
      }
    }

    return entries
  }
}
