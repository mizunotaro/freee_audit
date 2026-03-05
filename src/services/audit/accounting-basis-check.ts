import { prisma } from '@/lib/db'

export interface AccountingBasisCheck {
  journalId: string
  entryDate: Date
  description: string
  debitAccount: string
  creditAccount: string
  amount: number
  issues: AccountingBasisIssue[]
  suggestedCorrection?: string
}

export interface AccountingBasisIssue {
  type: AccountingBasisIssueType
  severity: 'info' | 'warning' | 'error'
  message: string
  details?: Record<string, unknown>
}

export type AccountingBasisIssueType =
  | 'payment_before_recognition'
  | 'receipt_before_recognition'
  | 'cross_month_payment'
  | 'cross_year_payment'
  | 'prepaid_not_amortized'
  | 'accrued_not_recorded'
  | 'revenue_mismatch'
  | 'expense_timing'

export interface AccrualCheckResult {
  totalJournals: number
  issuesFound: number
  checks: AccountingBasisCheck[]
  summary: {
    revenueTimingIssues: number
    expenseTimingIssues: number
    crossPeriodIssues: number
  }
}

export async function checkAccountingBasis(
  companyId: string,
  fiscalYear: number,
  month: number
): Promise<AccrualCheckResult> {
  const journals = await prisma.journal.findMany({
    where: {
      companyId,
    },
  })

  const filteredJournals = journals.filter((j) => {
    const entryMonth = j.entryDate.getMonth() + 1
    const entryYear = j.entryDate.getFullYear()
    return entryYear === fiscalYear && entryMonth === month
  })

  const checks: AccountingBasisCheck[] = []
  let revenueTimingIssues = 0
  let expenseTimingIssues = 0
  let crossPeriodIssues = 0

  for (const journal of filteredJournals) {
    const issues: AccountingBasisIssue[] = []

    const revenueIssues = checkRevenueTiming(journal)
    issues.push(...revenueIssues)
    if (revenueIssues.length > 0) revenueTimingIssues++

    const expenseIssues = checkExpenseTiming(journal)
    issues.push(...expenseIssues)
    if (expenseIssues.length > 0) expenseTimingIssues++

    const crossPeriodIssue = checkCrossPeriod(journal, fiscalYear, month)
    issues.push(...crossPeriodIssue)
    if (crossPeriodIssue.length > 0) crossPeriodIssues++

    if (issues.length > 0) {
      checks.push({
        journalId: journal.id,
        entryDate: journal.entryDate,
        description: journal.description,
        debitAccount: journal.debitAccount,
        creditAccount: journal.creditAccount,
        amount: journal.amount,
        issues,
        suggestedCorrection: generateCorrectionSuggestion(journal, issues),
      })
    }
  }

  return {
    totalJournals: filteredJournals.length,
    issuesFound: checks.length,
    checks,
    summary: {
      revenueTimingIssues,
      expenseTimingIssues,
      crossPeriodIssues,
    },
  }
}

function checkRevenueTiming(journal: {
  entryDate: Date
  description: string
  creditAccount: string
  amount: number
}): AccountingBasisIssue[] {
  const issues: AccountingBasisIssue[] = []

  if (journal.creditAccount.includes('売上') || journal.creditAccount.includes('収入')) {
    if (journal.description.includes('入金') || journal.description.includes('振込')) {
      issues.push({
        type: 'receipt_before_recognition',
        severity: 'warning',
        message: '入金と同時に売上計上されています。発生主義に基づく計上時期を確認してください',
        details: {
          description: journal.description,
        },
      })
    }
  }

  if (journal.description.includes('前受') || journal.description.includes('預り')) {
    if (journal.creditAccount.includes('売上')) {
      issues.push({
        type: 'revenue_mismatch',
        severity: 'warning',
        message: '前受金の売上計上時期を確認してください',
        details: {
          description: journal.description,
          account: journal.creditAccount,
        },
      })
    }
  }

  return issues
}

function checkExpenseTiming(journal: {
  entryDate: Date
  description: string
  debitAccount: string
  amount: number
}): AccountingBasisIssue[] {
  const issues: AccountingBasisIssue[] = []

  if (journal.description.includes('支払') || journal.description.includes('振込')) {
    if (
      journal.debitAccount.includes('費') &&
      !journal.debitAccount.includes('前払') &&
      !journal.debitAccount.includes('未払')
    ) {
      issues.push({
        type: 'payment_before_recognition',
        severity: 'warning',
        message: '支払と同時に費用計上されています。発生主義に基づく計上時期を確認してください',
        details: {
          description: journal.description,
          account: journal.debitAccount,
        },
      })
    }
  }

  const prepaidKeywords = ['保険', 'リース', '賃借', '広告', '年会費']
  for (const keyword of prepaidKeywords) {
    if (journal.description.includes(keyword)) {
      if (journal.debitAccount.includes('費') && !journal.debitAccount.includes('前払')) {
        issues.push({
          type: 'prepaid_not_amortized',
          severity: 'info',
          message: `${keyword}関連の費用は前払費用として処理すべき可能性があります`,
          details: {
            keyword,
            description: journal.description,
          },
        })
      }
    }
  }

  const accruedKeywords = ['給与', '賞与', '利息', '家賃', '費用']
  for (const keyword of accruedKeywords) {
    if (journal.description.includes(keyword)) {
      const endOfMonth = isEndOfMonth(journal.entryDate)
      if (!endOfMonth && !journal.debitAccount.includes('未払')) {
        issues.push({
          type: 'accrued_not_recorded',
          severity: 'info',
          message: `${keyword}関連の費用は月次計上すべき可能性があります`,
          details: {
            keyword,
            description: journal.description,
            entryDate: journal.entryDate,
          },
        })
      }
    }
  }

  return issues
}

function checkCrossPeriod(
  journal: {
    entryDate: Date
    description: string
    debitAccount: string
    creditAccount: string
    amount: number
  },
  fiscalYear: number,
  month: number
): AccountingBasisIssue[] {
  const issues: AccountingBasisIssue[] = []

  const lastDayOfMonth = new Date(fiscalYear, month, 0).getDate()
  const isLastDay = journal.entryDate.getDate() === lastDayOfMonth

  if (isLastDay) {
    if (journal.description.includes('翌月') || journal.description.includes('翌年')) {
      issues.push({
        type: 'cross_month_payment',
        severity: 'warning',
        message: '月末の仕訳に翌期間に関連する内容が含まれています',
        details: {
          description: journal.description,
          entryDate: journal.entryDate,
        },
      })
    }
  }

  if (month === 12) {
    if (journal.description.includes('決算') || journal.description.includes('修正')) {
      issues.push({
        type: 'cross_year_payment',
        severity: 'info',
        message: '決算整理仕訳を確認してください',
        details: {
          description: journal.description,
        },
      })
    }
  }

  return issues
}

function isEndOfMonth(date: Date): boolean {
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  return date.getDate() === lastDay
}

function generateCorrectionSuggestion(
  journal: {
    entryDate: Date
    description: string
    debitAccount: string
    creditAccount: string
    amount: number
  },
  issues: AccountingBasisIssue[]
): string {
  const suggestions: string[] = []

  for (const issue of issues) {
    switch (issue.type) {
      case 'payment_before_recognition':
        suggestions.push('費用の発生時期に合わせて計上し、支払時に未払費用を消込してください')
        break
      case 'receipt_before_recognition':
        suggestions.push('役務提供時点で売上を計上し、入金時に前受金を消込してください')
        break
      case 'prepaid_not_amortized':
        suggestions.push('前払費用として資産計上し、月次で費用化してください')
        break
      case 'accrued_not_recorded':
        suggestions.push('月次で未払費用を計上し、支払時に消込してください')
        break
      case 'cross_month_payment':
        suggestions.push('翌月分は前払費用または未払費用として処理してください')
        break
    }
  }

  return suggestions.join(' / ')
}

export async function checkRevenueExpenseMatching(
  companyId: string,
  fiscalYear: number,
  month: number
): Promise<{
  revenueJournals: number
  expenseJournals: number
  cashReceipts: number
  cashPayments: number
  potentialCashBasis: number
}> {
  const journals = await prisma.journal.findMany({
    where: { companyId },
  })

  const monthJournals = journals.filter((j) => {
    const entryMonth = j.entryDate.getMonth() + 1
    const entryYear = j.entryDate.getFullYear()
    return entryYear === fiscalYear && entryMonth === month
  })

  const revenueJournals = monthJournals.filter((j) => j.creditAccount.includes('売上')).length

  const expenseJournals = monthJournals.filter((j) => j.debitAccount.includes('費')).length

  const cashReceipts = monthJournals.filter(
    (j) => j.debitAccount.includes('預金') || j.debitAccount.includes('現金')
  ).length

  const cashPayments = monthJournals.filter(
    (j) => j.creditAccount.includes('預金') || j.creditAccount.includes('現金')
  ).length

  const potentialCashBasis = monthJournals.filter((j) => {
    const hasCash =
      j.debitAccount.includes('預金') ||
      j.debitAccount.includes('現金') ||
      j.creditAccount.includes('預金') ||
      j.creditAccount.includes('現金')

    const hasRevenueOrExpense = j.creditAccount.includes('売上') || j.debitAccount.includes('費')

    return hasCash && hasRevenueOrExpense
  }).length

  return {
    revenueJournals,
    expenseJournals,
    cashReceipts,
    cashPayments,
    potentialCashBasis,
  }
}

export interface MonthlyAccrualStatus {
  month: number
  prepaidExpenses: number
  accruedExpenses: number
  deferredRevenue: number
  accruedRevenue: number
  adjustmentNeeded: number
}

export async function getMonthlyAccrualStatus(
  companyId: string,
  fiscalYear: number
): Promise<MonthlyAccrualStatus[]> {
  const statuses: MonthlyAccrualStatus[] = []

  for (let month = 1; month <= 12; month++) {
    const journals = await prisma.journal.findMany({
      where: { companyId },
    })

    const monthJournals = journals.filter((j) => {
      const entryMonth = j.entryDate.getMonth() + 1
      const entryYear = j.entryDate.getFullYear()
      return entryYear === fiscalYear && entryMonth === month
    })

    const prepaidExpenses = monthJournals
      .filter((j) => j.debitAccount.includes('前払'))
      .reduce((sum, j) => sum + j.amount, 0)

    const accruedExpenses = monthJournals
      .filter((j) => j.creditAccount.includes('未払'))
      .reduce((sum, j) => sum + j.amount, 0)

    const deferredRevenue = monthJournals
      .filter((j) => j.creditAccount.includes('前受'))
      .reduce((sum, j) => sum + j.amount, 0)

    const accruedRevenue = monthJournals
      .filter((j) => j.debitAccount.includes('未収'))
      .reduce((sum, j) => sum + j.amount, 0)

    statuses.push({
      month,
      prepaidExpenses,
      accruedExpenses,
      deferredRevenue,
      accruedRevenue,
      adjustmentNeeded:
        Math.abs(prepaidExpenses - accruedExpenses) + Math.abs(deferredRevenue - accruedRevenue),
    })
  }

  return statuses
}
