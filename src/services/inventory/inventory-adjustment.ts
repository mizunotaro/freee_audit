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

/**
 * 指定月の棚卸調整が存在するか確認する。
 *
 * @param companyId - 企業ID
 * @param fiscalYear - 会計年度
 * @param month - 月（1〜12）
 * @returns 調整が存在する場合は `hasAdjustment: true` と調整データ、未登録時は `hasAdjustment: false`
 */
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

/**
 * 指定年度の全月次棚卸調整を月昇順で取得する。
 *
 * @param companyId - 企業ID
 * @param fiscalYear - 会計年度
 * @returns 棚卸調整の配列（月昇順）
 */
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

/**
 * 棚卸調整を作成または更新する（upsert）。
 *
 * 期末・期首残高の差額を `adjustment` として計算し、ステータス `PENDING` で登録する。
 * 同一企業/年度/月のレコードが存在する場合は更新する。
 *
 * @param data - 棚卸調整データ（企業ID・年度・月・期首/期末残高）
 * @returns 作成/更新された棚卸調整
 */
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

/**
 * 棚卸調整から仕訳（借方/貸方勘定・金額・摘要）を生成する。
 *
 * 棚卸増加（正の差異）は 棚卸資産/借方・売上原価/貸方、
 * 棚卸減少（負の差異）は 売上原価/借方・棚卸資産/貸方とする。
 * 差異が 0 の場合は仕訳不要として `null` を返す。
 *
 * @param adjustment - 棚卸調整結果
 * @param inventoryAccountId - 棚卸資産の勘定科目ID
 * @param cogsAccountId - 売上原価の勘定科目ID
 * @returns 仕訳データ。差異が 0 の場合は `null`。
 */
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

/**
 * 棚卸調整に仕訳IDを紐付け、ステータスを `COMPLETED` に更新する。
 *
 * @param adjustmentId - 棚卸調整ID
 * @param journalEntryId - 作成された仕訳ID
 */
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

/**
 * 指定年度の1月から currentMonth までの棚卸に関するアラートを検出する。
 *
 * 未実施（NO_INVENTORY_COUNT）、仕訳未作成（MISSING_JOURNAL）、
 * 大幅な差異（LARGE_VARIANCE）の3種別を順にチェックする。
 *
 * @param companyId - 企業ID
 * @param fiscalYear - 会計年度
 * @param currentMonth - チェック対象の直近月（1〜12）
 * @param varianceThreshold - 差異率の閾値（既定 0.2 = 20%）。期首残高に対する差異の絶対値比で超過時にアラート
 * @returns 検出されたアラートの配列
 */
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

/**
 * 指定年度の棚卸残高・調整額のトレンドを分析する。
 *
 * 平均残高・調整額合計・月次データを算出し、直近3ヶ月の増減傾向から
 * `increasing`/`decreasing`/`stable` を判定する。データが3ヶ月未満の場合は `stable`。
 *
 * @param companyId - 企業ID
 * @param fiscalYear - 会計年度
 * @returns 平均残高・調整額合計・トレンド方向・月次データ
 */
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

/**
 * 指定月の棚卸調整をスキップ扱い（ステータス `SKIPPED`）で登録する。
 *
 * 既存レコードがある場合はステータスのみ更新し、未登録の場合は残高 0 で新規作成する。
 *
 * @param companyId - 企業ID
 * @param fiscalYear - 会計年度
 * @param month - 月（1〜12）
 * @param _reason - スキップ理由（現状未使用、将来の監査ログ用）
 */
export async function skipInventoryAdjustment(
  companyId: string,
  fiscalYear: number,
  month: number,
  _reason: string
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
