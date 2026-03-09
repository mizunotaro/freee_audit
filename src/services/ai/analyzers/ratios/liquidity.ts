import type { BalanceSheet, ProfitLoss } from '@/types'
import type { RatioDefinition, CalculatedRatio, RatioStatus } from './types'
import { safeDivide } from '@/lib/utils'

export const LIQUIDITY_RATIOS: readonly RatioDefinition[] = [
  {
    id: 'current_ratio',
    name: '流動比率',
    nameEn: 'Current Ratio',
    category: 'liquidity',
    formula: '流動資産 ÷ 流動負債 × 100',
    description: '短期的な支払能力を示す指標。200%以上が望ましい。',
    unit: 'percentage',
    thresholds: { excellent: 200, good: 150, fair: 100, poor: 80 },
    higherIsBetter: true,
  },
  {
    id: 'quick_ratio',
    name: '当座比率',
    nameEn: 'Quick Ratio',
    category: 'liquidity',
    formula: '（流動資産 - 棚卸資産） ÷ 流動負債 × 100',
    description: '棚卸資産を除く短期的な支払能力。100%以上が望ましい。',
    unit: 'percentage',
    thresholds: { excellent: 150, good: 100, fair: 80, poor: 50 },
    higherIsBetter: true,
  },
  {
    id: 'cash_ratio',
    name: '現金比率',
    nameEn: 'Cash Ratio',
    category: 'liquidity',
    formula: '（現金・預金 + 有価証券） ÷ 流動負債 × 100',
    description: '即座に支払える能力を示す指標。',
    unit: 'percentage',
    thresholds: { excellent: 50, good: 30, fair: 15, poor: 5 },
    higherIsBetter: true,
  },
  {
    id: 'working_capital',
    name: '運転資本',
    nameEn: 'Working Capital',
    category: 'liquidity',
    formula: '流動資産 - 流動負債',
    description: '日常業務に使用できる資本。',
    unit: 'number',
    thresholds: { excellent: 0, good: 0, fair: 0, poor: 0 },
    higherIsBetter: true,
  },
  {
    id: 'working_capital_ratio',
    name: '運転資本比率',
    nameEn: 'Working Capital Ratio',
    category: 'liquidity',
    formula: '（流動資産 - 流動負債） ÷ 総資産 × 100',
    description: '総資産に対する運転資本の割合。',
    unit: 'percentage',
    thresholds: { excellent: 30, good: 20, fair: 10, poor: 0 },
    higherIsBetter: true,
  },
]

export function calculateLiquidityRatios(
  bs: BalanceSheet,
  _pl: ProfitLoss,
  prevBS?: BalanceSheet
): CalculatedRatio[] {
  const currentAssets = bs.assets.current.reduce((sum, a) => sum + (a.amount ?? 0), 0)
  const currentLiabilities = bs.liabilities.current.reduce((sum, l) => sum + (l.amount ?? 0), 0)
  const totalAssets = bs.totalAssets

  const inventory =
    bs.assets.current.find(
      (a) => a.name.includes('棚卸') || a.name.includes('在庫') || a.code === '1005'
    )?.amount ?? 0

  const cashAndSecurities = bs.assets.current
    .filter(
      (a) =>
        a.name.includes('現金') ||
        a.name.includes('預金') ||
        a.name.includes('有価証券') ||
        a.code === '1001' ||
        a.code === '1002' ||
        a.code === '1003'
    )
    .reduce((sum, a) => sum + (a.amount ?? 0), 0)

  const prevCurrentAssets = prevBS
    ? prevBS.assets.current.reduce((sum, a) => sum + (a.amount ?? 0), 0)
    : undefined
  const prevCurrentLiabilities = prevBS
    ? prevBS.liabilities.current.reduce((sum, l) => sum + (l.amount ?? 0), 0)
    : undefined

  const calculateRatio = (definition: RatioDefinition, value: number): CalculatedRatio => {
    const status = evaluateRatio(value, definition)
    const formattedValue = formatValue(value, definition.unit)

    let trend: CalculatedRatio['trend']

    if (definition.id === 'current_ratio' && prevCurrentAssets && prevCurrentLiabilities) {
      const prevValue = safeDivide(prevCurrentAssets, prevCurrentLiabilities) * 100
      trend = {
        direction: determineTrend(value, prevValue),
        previousValue: prevValue,
        changePercent: calculateChangePercent(value, prevValue),
      }
    }

    return {
      definition,
      value,
      formattedValue,
      status,
      trend,
    }
  }

  return LIQUIDITY_RATIOS.map((def): CalculatedRatio => {
    let value = 0

    switch (def.id) {
      case 'current_ratio':
        value = safeDivide(currentAssets, currentLiabilities) * 100
        break
      case 'quick_ratio':
        value = safeDivide(currentAssets - inventory, currentLiabilities) * 100
        break
      case 'cash_ratio':
        value = safeDivide(cashAndSecurities, currentLiabilities) * 100
        break
      case 'working_capital':
        value = currentAssets - currentLiabilities
        break
      case 'working_capital_ratio':
        value = safeDivide(currentAssets - currentLiabilities, totalAssets) * 100
        break
    }

    return calculateRatio(def, value)
  })
}

function evaluateRatio(value: number, definition: RatioDefinition): RatioStatus {
  const { thresholds, higherIsBetter } = definition

  if (higherIsBetter) {
    if (value >= thresholds.excellent) return 'excellent'
    if (value >= thresholds.good) return 'good'
    if (value >= thresholds.fair) return 'fair'
    if (value >= thresholds.poor) return 'poor'
    return 'critical'
  } else {
    if (value <= thresholds.excellent) return 'excellent'
    if (value <= thresholds.good) return 'good'
    if (value <= thresholds.fair) return 'fair'
    if (value <= thresholds.poor) return 'poor'
    return 'critical'
  }
}

function formatValue(value: number, unit: string): string {
  switch (unit) {
    case 'percentage':
      return `${value.toFixed(1)}%`
    case 'ratio':
    case 'times':
      return `${value.toFixed(2)}`
    case 'days':
      return `${Math.round(value)}日`
    default:
      return value.toLocaleString('ja-JP')
  }
}

function determineTrend(current: number, previous: number): 'improving' | 'stable' | 'declining' {
  const change = ((current - previous) / Math.abs(previous)) * 100
  if (Math.abs(change) < 5) return 'stable'
  return change > 0 ? 'improving' : 'declining'
}

function calculateChangePercent(current: number, previous: number): number {
  if (previous === 0) return 0
  return ((current - previous) / Math.abs(previous)) * 100
}
