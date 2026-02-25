import type { RunwayCalculation, CashFlowStatement } from '@/types'
import { addMonths, sumValues } from '@/lib/utils'

export function calculateRunway(
  currentCash: number,
  monthlyCashFlows: CashFlowStatement[],
  scenarioAdjustments: {
    optimistic: number
    realistic: number
    pessimistic: number
  } = { optimistic: 0.8, realistic: 1.0, pessimistic: 1.3 }
): RunwayCalculation {
  const avgRevenue = calculateAverageMonthlyRevenue(monthlyCashFlows)
  const avgExpenses = calculateAverageMonthlyExpenses(monthlyCashFlows)

  const monthlyBurnRate = avgExpenses - avgRevenue

  const realisticBurnRate = monthlyBurnRate * scenarioAdjustments.realistic
  const optimisticBurnRate = monthlyBurnRate * scenarioAdjustments.optimistic
  const pessimisticBurnRate = monthlyBurnRate * scenarioAdjustments.pessimistic

  const realisticRunway = realisticBurnRate > 0 ? currentCash / realisticBurnRate : Infinity
  const optimisticRunway = optimisticBurnRate > 0 ? currentCash / optimisticBurnRate : Infinity
  const pessimisticRunway = pessimisticBurnRate > 0 ? currentCash / pessimisticBurnRate : Infinity

  const runwayMonths = realisticRunway
  const zeroCashDate = addMonths(new Date(), Math.floor(runwayMonths))

  return {
    monthlyBurnRate: Math.round(realisticBurnRate),
    runwayMonths: Math.round(runwayMonths * 10) / 10,
    zeroCashDate,
    currentCash: monthlyCashFlows[monthlyCashFlows.length - 1]?.endingCash || currentCash,
    scenarios: {
      optimistic: {
        burnRate: Math.round(optimisticBurnRate),
        runwayMonths: Math.round(optimisticRunway * 10) / 10,
      },
      realistic: {
        burnRate: Math.round(realisticBurnRate),
        runwayMonths: Math.round(realisticRunway * 10) / 10,
      },
      pessimistic: {
        burnRate: Math.round(pessimisticBurnRate),
        runwayMonths: Math.round(pessimisticRunway * 10) / 10,
      },
    },
  }
}

function calculateAverageMonthlyRevenue(cashFlows: CashFlowStatement[]): number {
  if (cashFlows.length === 0) return 0

  const revenues = cashFlows.map((cf) => {
    const op = cf.operatingActivities
    if (!op) return 0
    let revenue = 0
    if (op.netIncome > 0) revenue += op.netIncome
    if (op.increaseInReceivables > 0) revenue += op.increaseInReceivables
    if (op.increaseInPayables > 0) revenue += op.increaseInPayables
    return revenue
  })

  return sumValues(revenues) / revenues.length
}

function calculateAverageMonthlyExpenses(cashFlows: CashFlowStatement[]): number {
  if (cashFlows.length === 0) return 0

  const expenses = cashFlows.map((cf) => {
    const op = cf.operatingActivities
    let expense = 0
    if (op) {
      if (op.netIncome < 0) expense += Math.abs(op.netIncome)
      if (op.increaseInReceivables < 0) expense += Math.abs(op.increaseInReceivables)
      if (op.decreaseInInventory < 0) expense += Math.abs(op.decreaseInInventory)
      if (op.increaseInPayables < 0) expense += Math.abs(op.increaseInPayables)
    }

    expense += Math.abs(cf.investingActivities?.purchaseOfFixedAssets ?? 0)
    expense += Math.abs(cf.financingActivities?.repaymentOfBorrowing ?? 0)
    expense += Math.abs(cf.financingActivities?.dividendPaid ?? 0)

    return expense
  })

  return sumValues(expenses) / expenses.length
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
