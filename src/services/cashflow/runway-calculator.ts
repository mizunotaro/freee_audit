import type { RunwayCalculation, CashFlowStatement } from '@/types'
import { addMonths, sumValues } from '@/lib/utils'

/**
 * Cash runway in months from a cash balance and an average net burn rate.
 *
 * Standard definition (Investopedia, "Cash Runway"):
 *   runway = cash balance ÷ net burn rate
 *
 * Returns `Infinity` when the entity is not burning cash (net burn ≤ 0) or when
 * the cash balance is non-finite. Returns 0 when there is cash but the burn rate
 * is not a positive, finite number it can divide by safely.
 */
export function computeRunwayMonths(currentCash: number, avgNetBurn: number): number {
  if (!Number.isFinite(currentCash)) return Infinity
  if (!Number.isFinite(avgNetBurn) || avgNetBurn <= 0) return Infinity
  return currentCash / avgNetBurn
}

export interface RunwayCalculationOptions {
  scenarioAdjustments?: {
    optimistic: number
    realistic: number
    pessimistic: number
  }
  adjustmentReasons?: {
    optimistic: string
    pessimistic: string
  }
}

/**
 * 現金残高と月次キャッシュフローから資金繰り余力（Runway）を算出する。
 *
 * 月次営業CFの平均から基準バーンレートを求め、シナリオ調整倍率（楽観/現実/悲観）を
 * 適用して各シナリオの Runway 月数と現金枯渇予定日を計算する。
 * 調整倍率が 1.0 以外の場合は理由の併記が必要（未指定時は既定値 1.0 に戻す）。
 *
 * @param currentCash - 現在の現金残高
 * @param monthlyCashFlows - 月次キャッシュフロー計算書の配列（空の場合は空結果を返す）
 * @param options - シナリオ調整倍率とその理由
 * @returns Runway 計算結果（月次バーンレート・Runway 月数・枯渇予定日・3 シナリオ）
 */
export function calculateRunway(
  currentCash: number,
  monthlyCashFlows: CashFlowStatement[],
  options: RunwayCalculationOptions = {}
): RunwayCalculation {
  if (monthlyCashFlows.length === 0) {
    return createEmptyRunwayResult(currentCash)
  }

  const monthlyNetCashFlows = monthlyCashFlows.map((cf) => {
    const operating =
      cf.operatingActivities?.netCashFromOperating ?? cf.operating?.netCashFromOperating ?? 0
    return operating
  })

  const avgMonthlyNetCashFlow = sumValues(monthlyNetCashFlows) / monthlyNetCashFlows.length

  const baseBurnRate = avgMonthlyNetCashFlow < 0 ? Math.abs(avgMonthlyNetCashFlow) : 0

  const adjustments = validateAndApplyAdjustments(
    options.scenarioAdjustments,
    options.adjustmentReasons
  )

  const realisticBurnRate = baseBurnRate * adjustments.realistic
  const optimisticBurnRate = baseBurnRate * adjustments.optimistic
  const pessimisticBurnRate = baseBurnRate * adjustments.pessimistic

  const realisticRunway = realisticBurnRate > 0 ? currentCash / realisticBurnRate : Infinity
  const optimisticRunway = optimisticBurnRate > 0 ? currentCash / optimisticBurnRate : Infinity
  const pessimisticRunway = pessimisticBurnRate > 0 ? currentCash / pessimisticBurnRate : Infinity

  const runwayMonths = realisticRunway
  const zeroCashDate =
    runwayMonths !== Infinity
      ? addMonths(new Date(), Math.floor(runwayMonths))
      : new Date('9999-12-31')

  return {
    monthlyBurnRate: Math.round(realisticBurnRate),
    runwayMonths: runwayMonths === Infinity ? 999 : Math.round(runwayMonths * 10) / 10,
    zeroCashDate,
    currentCash,
    scenarios: {
      optimistic: {
        burnRate: Math.round(optimisticBurnRate),
        runwayMonths: optimisticRunway === Infinity ? 999 : Math.round(optimisticRunway * 10) / 10,
      },
      realistic: {
        burnRate: Math.round(realisticBurnRate),
        runwayMonths: runwayMonths === Infinity ? 999 : Math.round(runwayMonths * 10) / 10,
      },
      pessimistic: {
        burnRate: Math.round(pessimisticBurnRate),
        runwayMonths:
          pessimisticRunway === Infinity ? 999 : Math.round(pessimisticRunway * 10) / 10,
      },
    },
    calculationBasis: {
      avgMonthlyNetCashFlow: Math.round(avgMonthlyNetCashFlow),
      dataPoints: monthlyCashFlows.length,
      adjustmentReasons: options.adjustmentReasons,
    },
  }
}

function createEmptyRunwayResult(currentCash: number): RunwayCalculation {
  return {
    monthlyBurnRate: 0,
    runwayMonths: 999,
    zeroCashDate: new Date('9999-12-31'),
    currentCash,
    scenarios: {
      optimistic: { burnRate: 0, runwayMonths: 999 },
      realistic: { burnRate: 0, runwayMonths: 999 },
      pessimistic: { burnRate: 0, runwayMonths: 999 },
    },
    calculationBasis: {
      avgMonthlyNetCashFlow: 0,
      dataPoints: 0,
    },
  }
}

function validateAndApplyAdjustments(
  adjustments?: RunwayCalculationOptions['scenarioAdjustments'],
  reasons?: RunwayCalculationOptions['adjustmentReasons']
): { optimistic: number; realistic: number; pessimistic: number } {
  const defaultAdjustments = {
    optimistic: 1.0,
    realistic: 1.0,
    pessimistic: 1.0,
  }

  if (!adjustments) {
    return defaultAdjustments
  }

  let optimistic = adjustments.optimistic
  let pessimistic = adjustments.pessimistic

  if (optimistic !== 1.0 && !reasons?.optimistic) {
    console.warn('Optimistic adjustment without reason - using default 1.0')
    optimistic = 1.0
  }

  if (pessimistic !== 1.0 && !reasons?.pessimistic) {
    console.warn('Pessimistic adjustment without reason - using default 1.0')
    pessimistic = 1.0
  }

  return {
    optimistic: Math.max(0.5, Math.min(2.0, optimistic)),
    realistic: 1.0,
    pessimistic: Math.max(0.5, Math.min(2.0, pessimistic)),
  }
}

export interface RunwayAlert {
  level: 'safe' | 'warning' | 'critical'
  message: string
  recommendation: string
}

/**
 * Runway 月数に応じた資金繰りアラートを返す。
 *
 * 12ヶ月以上で `safe`、6ヶ月以上で `warning`、3ヶ月以上で `critical`、
 * それ未満は資金ショート高危険の `critical` となる。
 *
 * @param runwayMonths - 資金繰り余力月数
 * @returns アラートレベル・メッセージ・推奨アクション
 */
export function getRunwayAlert(runwayMonths: number): RunwayAlert {
  if (runwayMonths >= 12) {
    return {
      level: 'safe',
      message: '資金繰りは安定しています',
      recommendation: '引き続き資金状況をモニタリングしてください',
    }
  } else if (runwayMonths >= 6) {
    return {
      level: 'warning',
      message: '資金繰りに注意が必要です',
      recommendation: '資金調達の計画を検討してください',
    }
  } else if (runwayMonths >= 3) {
    return {
      level: 'critical',
      message: '資金繰りが危険な状態です',
      recommendation: '早急に資金調達または支出削減を行ってください',
    }
  } else {
    return {
      level: 'critical',
      message: '資金ショートのリスクが高いです',
      recommendation: '直ちに資金調達、支払い繰延、コスト削減を実行してください',
    }
  }
}

/**
 * 直近3ヶ月と直前3ヶ月のバーンレートを比較してトレンドを判定する。
 *
 * 変化率が +10% 超で `increasing`、-10% 未満で `decreasing`、
 * それ以外は `stable` とする。データが3ヶ月未満の場合は `stable`。
 *
 * @param cashFlows - 月次キャッシュフロー計算書の配列
 * @returns トレンド方向と変化率（%）
 */
export function calculateBurnRateTrend(cashFlows: CashFlowStatement[]): {
  trend: 'increasing' | 'stable' | 'decreasing'
  rate: number
} {
  if (cashFlows.length < 3) {
    return { trend: 'stable', rate: 0 }
  }

  const sortedCFs = [...cashFlows].sort((a, b) => (a.month || 0) - (b.month || 0))
  const recent = sortedCFs.slice(-3)
  const previous = sortedCFs.slice(-6, -3)

  const recentBurn = calculateAverageBurnRate(recent)
  const previousBurn = calculateAverageBurnRate(previous)

  if (previousBurn === 0) {
    return { trend: 'stable', rate: 0 }
  }

  const changeRate = ((recentBurn - previousBurn) / previousBurn) * 100

  if (changeRate > 10) {
    return { trend: 'increasing', rate: changeRate }
  } else if (changeRate < -10) {
    return { trend: 'decreasing', rate: changeRate }
  } else {
    return { trend: 'stable', rate: changeRate }
  }
}

function calculateAverageBurnRate(cashFlows: CashFlowStatement[]): number {
  const burnRates = cashFlows.map((cf) => {
    const netCash =
      (cf.operatingActivities?.netCashFromOperating ?? 0) +
      (cf.investingActivities?.netCashFromInvesting ?? 0) +
      (cf.financingActivities?.netCashFromFinancing ?? 0)
    return netCash < 0 ? Math.abs(netCash) : 0
  })
  return sumValues(burnRates) / burnRates.length
}
