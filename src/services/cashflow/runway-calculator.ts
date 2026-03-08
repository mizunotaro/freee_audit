import type { RunwayCalculation, CashFlowStatement } from '@/types'
import { addMonths, sumValues } from '@/lib/utils'

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
