import { freeeClient, type FreeeDeal } from '@/integrations/freee/client'
import { prisma } from '@/lib/db'

export interface DebtInfo {
  id: string
  freeeDealId: string | null
  partnerId: string | null
  partnerName: string | null
  description: string | null
  amount: number
  dueDate: Date
  paymentDate: Date | null
  status: 'PENDING' | 'PAID' | 'OVERDUE'
  category: 'payable' | 'loan' | 'other'
}

export interface CashOutForecast {
  date: Date
  amount: number
  category: string
  description: string
  partnerName: string | null
  urgency: 'high' | 'medium' | 'low'
}

export interface MonthlyCashOutSummary {
  month: string
  totalAmount: number
  itemCount: number
  categories: {
    payable: number
    loan: number
    other: number
  }
}

export async function syncDebtsFromFreee(
  companyId: string,
  freeeCompanyId: number,
  monthsAhead: number = 6
): Promise<{ success: boolean; imported: number; error?: string }> {
  try {
    const startDate = new Date()
    const endDate = new Date()
    endDate.setMonth(endDate.getMonth() + monthsAhead)

    const result = await freeeClient.getDeals(freeeCompanyId, startDate, endDate)

    if (result.error) {
      return { success: false, imported: 0, error: result.error.message }
    }

    const deals = result.data || []
    let imported = 0

    for (const deal of deals) {
      if (!deal.due_date || deal.due_amount <= 0) continue

      const dueDate = new Date(deal.due_date)
      const isOverdue = dueDate < new Date()
      const status = isOverdue ? 'OVERDUE' : 'PENDING'

      const category = determineDebtCategory(deal)

      await prisma.debt.upsert({
        where: {
          id: `${companyId}-${deal.id}`,
        },
        update: {
          partnerId: deal.partner_id?.toString() || null,
          partnerName: deal.partner?.name || null,
          description: deal.details[0]?.description || null,
          amount: deal.due_amount,
          dueDate,
          status,
          category,
        },
        create: {
          id: `${companyId}-${deal.id}`,
          companyId,
          freeeDealId: deal.id.toString(),
          partnerId: deal.partner_id?.toString() || null,
          partnerName: deal.partner?.name || null,
          description: deal.details[0]?.description || null,
          amount: deal.due_amount,
          dueDate,
          status,
          category,
        },
      })
      imported++
    }

    return { success: true, imported }
  } catch (error) {
    console.error('Failed to sync debts:', error)
    return {
      success: false,
      imported: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export async function getCashOutForecasts(
  companyId: string,
  monthsAhead: number = 3
): Promise<CashOutForecast[]> {
  const startDate = new Date()
  const endDate = new Date()
  endDate.setMonth(endDate.getMonth() + monthsAhead)

  const debts = await prisma.debt.findMany({
    where: {
      companyId,
      dueDate: {
        gte: startDate,
        lte: endDate,
      },
      status: {
        in: ['PENDING', 'OVERDUE'],
      },
    },
    orderBy: {
      dueDate: 'asc',
    },
  })

  return debts.map((debt) => {
    const daysUntilDue = Math.ceil(
      (new Date(debt.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    )

    let urgency: 'high' | 'medium' | 'low'
    if (daysUntilDue <= 7 || debt.status === 'OVERDUE') {
      urgency = 'high'
    } else if (daysUntilDue <= 30) {
      urgency = 'medium'
    } else {
      urgency = 'low'
    }

    return {
      date: new Date(debt.dueDate),
      amount: debt.amount,
      category: debt.category,
      description: debt.description || '',
      partnerName: debt.partnerName,
      urgency,
    }
  })
}

export async function getMonthlyCashOutSummary(
  companyId: string,
  monthsAhead: number = 6
): Promise<MonthlyCashOutSummary[]> {
  const forecasts = await getCashOutForecasts(companyId, monthsAhead)

  const monthlyMap = new Map<string, MonthlyCashOutSummary>()

  for (const forecast of forecasts) {
    const monthKey = forecast.date.toISOString().slice(0, 7)
    const existing = monthlyMap.get(monthKey) || {
      month: monthKey,
      totalAmount: 0,
      itemCount: 0,
      categories: { payable: 0, loan: 0, other: 0 },
    }

    existing.totalAmount += forecast.amount
    existing.itemCount += 1
    existing.categories[forecast.category as keyof typeof existing.categories] += forecast.amount

    monthlyMap.set(monthKey, existing)
  }

  return Array.from(monthlyMap.values()).sort((a, b) => a.month.localeCompare(b.month))
}

export async function getTotalUpcomingCashOut(
  companyId: string,
  days: number = 30
): Promise<number> {
  const startDate = new Date()
  const endDate = new Date()
  endDate.setDate(endDate.getDate() + days)

  const debts = await prisma.debt.findMany({
    where: {
      companyId,
      dueDate: {
        gte: startDate,
        lte: endDate,
      },
      status: {
        in: ['PENDING', 'OVERDUE'],
      },
    },
  })

  return debts.reduce((sum, debt) => sum + debt.amount, 0)
}

function determineDebtCategory(deal: FreeeDeal): string {
  const accountItemName = deal.details[0]?.account_item_name?.toLowerCase() || ''

  if (accountItemName.includes('買掛') || accountItemName.includes('未払')) {
    return 'payable'
  }

  if (accountItemName.includes('借入') || accountItemName.includes('ローン')) {
    return 'loan'
  }

  return 'other'
}
