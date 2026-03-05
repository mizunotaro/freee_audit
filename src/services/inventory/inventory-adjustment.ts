import { prisma } from '@/lib/db'

export interface InventoryAdjustmentData {
  companyId: string
  fiscalYear: number
  month: number
  openingBalance: number
  closingBalance: number
}

export interface InventoryAdjustmentResult {
  id: string
  fiscalYear: number
  month: number
  openingBalance: number
  closingBalance: number
  adjustment: number
  status: string
  journalEntryId: string | null
}

export interface InventoryAlert {
  type: 'NO_INVENTORY_COUNT' | 'LARGE_VARIANCE' | 'MISSING_JOURNAL'
  severity: 'warning' | 'error'
  fiscalYear: number
  month: number
  message: string
  details?: Record<string, unknown>
}

export async function checkInventoryAdjustmentStatus(
  companyId: string,
  fiscalYear: number,
  month: number
): Promise<{ hasAdjustment: boolean; adjustment?: InventoryAdjustmentResult }> {
  const adjustment = await prisma.inventoryAdjustment.findUnique({
    where: {
      companyId_fiscalYear_month: {
        companyId,
        fiscalYear,
        month,
      },
    },
  })

  if (!adjustment) {
    return { hasAdjustment: false }
  }

  return {
    hasAdjustment: true,
    adjustment: {
      id: adjustment.id,
      fiscalYear: adjustment.fiscalYear,
      month: adjustment.month,
      openingBalance: adjustment.openingBalance,
      closingBalance: adjustment.closingBalance,
      adjustment: adjustment.adjustment,
      status: adjustment.status,
      journalEntryId: adjustment.journalEntryId,
    },
  }
}

export async function getInventoryAdjustments(
  companyId: string,
  fiscalYear: number
): Promise<InventoryAdjustmentResult[]> {
  const adjustments = await prisma.inventoryAdjustment.findMany({
    where: {
      companyId,
      fiscalYear,
    },
    orderBy: {
      month: 'asc',
    },
  })

  return adjustments.map((a) => ({
    id: a.id,
    fiscalYear: a.fiscalYear,
    month: a.month,
    openingBalance: a.openingBalance,
    closingBalance: a.closingBalance,
    adjustment: a.adjustment,
    status: a.status,
    journalEntryId: a.journalEntryId,
  }))
}

export async function createInventoryAdjustment(
  data: InventoryAdjustmentData
): Promise<InventoryAdjustmentResult> {
  const adjustment = data.closingBalance - data.openingBalance

  const result = await prisma.inventoryAdjustment.upsert({
    where: {
      companyId_fiscalYear_month: {
        companyId: data.companyId,
        fiscalYear: data.fiscalYear,
        month: data.month,
      },
    },
    update: {
      openingBalance: data.openingBalance,
      closingBalance: data.closingBalance,
      adjustment,
      status: 'PENDING',
    },
    create: {
      companyId: data.companyId,
      fiscalYear: data.fiscalYear,
      month: data.month,
      openingBalance: data.openingBalance,
      closingBalance: data.closingBalance,
      adjustment,
      status: 'PENDING',
    },
  })

  return {
    id: result.id,
    fiscalYear: result.fiscalYear,
    month: result.month,
    openingBalance: result.openingBalance,
    closingBalance: result.closingBalance,
    adjustment: result.adjustment,
    status: result.status,
    journalEntryId: result.journalEntryId,
  }
}

export function generateInventoryJournalEntry(
  adjustment: InventoryAdjustmentResult,
  inventoryAccountId: string,
  cogsAccountId: string
): {
  debitAccount: string
  creditAccount: string
  amount: number
  description: string
} | null {
  if (adjustment.adjustment === 0) {
    return null
  }

  if (adjustment.adjustment > 0) {
    return {
      debitAccount: inventoryAccountId,
      creditAccount: cogsAccountId,
      amount: Math.abs(adjustment.adjustment),
      description: `月次棚卸増加（${adjustment.fiscalYear}年${adjustment.month}月）`,
    }
  } else {
    return {
      debitAccount: cogsAccountId,
      creditAccount: inventoryAccountId,
      amount: Math.abs(adjustment.adjustment),
      description: `月次棚卸減少（${adjustment.fiscalYear}年${adjustment.month}月）`,
    }
  }
}

export async function markJournalCreated(
  adjustmentId: string,
  journalEntryId: string
): Promise<void> {
  await prisma.inventoryAdjustment.update({
    where: { id: adjustmentId },
    data: {
      journalEntryId,
      status: 'COMPLETED',
    },
  })
}

export async function detectInventoryAlerts(
  companyId: string,
  fiscalYear: number,
  currentMonth: number,
  varianceThreshold: number = 0.2
): Promise<InventoryAlert[]> {
  const alerts: InventoryAlert[] = []

  for (let month = 1; month <= currentMonth; month++) {
    const { hasAdjustment, adjustment } = await checkInventoryAdjustmentStatus(
      companyId,
      fiscalYear,
      month
    )

    if (!hasAdjustment) {
      alerts.push({
        type: 'NO_INVENTORY_COUNT',
        severity: 'warning',
        fiscalYear,
        month,
        message: `${fiscalYear}年${month}月の棚卸が実施されていません`,
      })
      continue
    }

    if (adjustment && adjustment.journalEntryId === null && adjustment.status !== 'SKIPPED') {
      alerts.push({
        type: 'MISSING_JOURNAL',
        severity: 'warning',
        fiscalYear,
        month,
        message: `${fiscalYear}年${month}月の棚卸仕訳が未作成です`,
        details: { adjustment },
      })
    }

    if (adjustment && adjustment.openingBalance > 0) {
      const varianceRate = Math.abs(adjustment.adjustment) / adjustment.openingBalance
      if (varianceRate > varianceThreshold) {
        alerts.push({
          type: 'LARGE_VARIANCE',
          severity: 'error',
          fiscalYear,
          month,
          message: `${fiscalYear}年${month}月の棚卸差異が大きいです（${(varianceRate * 100).toFixed(1)}%）`,
          details: {
            openingBalance: adjustment.openingBalance,
            closingBalance: adjustment.closingBalance,
            adjustment: adjustment.adjustment,
            varianceRate,
          },
        })
      }
    }
  }

  return alerts
}

export async function analyzeInventoryTrend(
  companyId: string,
  fiscalYear: number
): Promise<{
  averageBalance: number
  totalAdjustment: number
  trend: 'increasing' | 'decreasing' | 'stable'
  monthlyData: Array<{ month: number; balance: number; adjustment: number }>
}> {
  const adjustments = await getInventoryAdjustments(companyId, fiscalYear)

  if (adjustments.length === 0) {
    return {
      averageBalance: 0,
      totalAdjustment: 0,
      trend: 'stable',
      monthlyData: [],
    }
  }

  const monthlyData = adjustments.map((a) => ({
    month: a.month,
    balance: a.closingBalance,
    adjustment: a.adjustment,
  }))

  const totalAdjustment = adjustments.reduce((sum, a) => sum + a.adjustment, 0)
  const averageBalance =
    adjustments.reduce((sum, a) => sum + a.closingBalance, 0) / adjustments.length

  let trend: 'increasing' | 'decreasing' | 'stable' = 'stable'
  if (adjustments.length >= 3) {
    const recentAdjustments = adjustments.slice(-3)
    const positiveCount = recentAdjustments.filter((a) => a.adjustment > 0).length
    const negativeCount = recentAdjustments.filter((a) => a.adjustment < 0).length

    if (positiveCount >= 2) {
      trend = 'increasing'
    } else if (negativeCount >= 2) {
      trend = 'decreasing'
    }
  }

  return {
    averageBalance,
    totalAdjustment,
    trend,
    monthlyData,
  }
}

export async function skipInventoryAdjustment(
  companyId: string,
  fiscalYear: number,
  month: number,
  reason: string
): Promise<void> {
  await prisma.inventoryAdjustment.upsert({
    where: {
      companyId_fiscalYear_month: {
        companyId,
        fiscalYear,
        month,
      },
    },
    update: {
      status: 'SKIPPED',
    },
    create: {
      companyId,
      fiscalYear,
      month,
      openingBalance: 0,
      closingBalance: 0,
      adjustment: 0,
      status: 'SKIPPED',
    },
  })
}
