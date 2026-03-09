import type { BalanceSheet, ProfitLoss } from '@/types'
import type { RatioDefinition, CalculatedRatio, RatioStatus } from './types'
import { safeDivide } from '@/lib/utils'

export const SAFETY_RATIOS: readonly RatioDefinition[] = [
  {
    id: 'equity_ratio',
    name: '自己資本比率',
    nameEn: 'Equity Ratio',
    category: 'safety',
    formula: '純資産 ÷ 総資産 × 100',
    description: '自己資本が総資産に占める割合。30%以上が望ましい。',
    unit: 'percentage',
    thresholds: { excellent: 50, good: 30, fair: 20, poor: 10 },
    higherIsBetter: true,
  },
  {
    id: 'debt_to_equity',
    name: '負債比率（D/Eレシオ）',
    nameEn: 'Debt to Equity Ratio',
    category: 'safety',
    formula: '負債 ÷ 純資産',
    description: '自己資本に対する負債の割合。1.0倍以下が望ましい。',
    unit: 'ratio',
    thresholds: { excellent: 0.5, good: 1.0, fair: 2.0, poor: 3.0 },
    higherIsBetter: false,
  },
  {
    id: 'debt_ratio',
    name: '負債比率',
    nameEn: 'Debt Ratio',
    category: 'safety',
    formula: '負債 ÷ 総資産 × 100',
    description: '総資産に占める負債の割合。',
    unit: 'percentage',
    thresholds: { excellent: 50, good: 70, fair: 80, poor: 90 },
    higherIsBetter: false,
  },
  {
    id: 'fixed_ratio',
    name: '固定比率',
    nameEn: 'Fixed Ratio',
    category: 'safety',
    formula: '固定資産 ÷ 純資産 × 100',
    description: '固定資産が自己資本でどれだけ賄われているか。100%以下が望ましい。',
    unit: 'percentage',
    thresholds: { excellent: 80, good: 100, fair: 120, poor: 150 },
    higherIsBetter: false,
  },
  {
    id: 'fixed_long_term_ratio',
    name: '固定長期適合率',
    nameEn: 'Fixed to Long-term Capital Ratio',
    category: 'safety',
    formula: '固定資産 ÷（純資産 + 固定負債）× 100',
    description: '固定資産が長期資本で賄われている割合。100%以下が望ましい。',
    unit: 'percentage',
    thresholds: { excellent: 80, good: 100, fair: 110, poor: 120 },
    higherIsBetter: false,
  },
  {
    id: 'interest_coverage',
    name: 'インタレスト・カバレッジ・レシオ',
    nameEn: 'Interest Coverage Ratio',
    category: 'safety',
    formula: '営業利益 ÷ 支払利息',
    description: '営業利益で支払利息を何倍カバーできるか。3倍以上が望ましい。',
    unit: 'times',
    thresholds: { excellent: 5, good: 3, fair: 1.5, poor: 1 },
    higherIsBetter: true,
  },
]

export function calculateSafetyRatios(
  bs: BalanceSheet,
  pl: ProfitLoss,
  prevBS?: BalanceSheet
): CalculatedRatio[] {
  const totalAssets = bs.totalAssets
  const totalLiabilities = bs.totalLiabilities
  const totalEquity = bs.totalEquity
  const fixedAssets = bs.assets.fixed.reduce((sum, a) => sum + (a.amount ?? 0), 0)
  const fixedLiabilities = bs.liabilities.fixed.reduce((sum, l) => sum + (l.amount ?? 0), 0)

  const operatingIncome = pl.operatingIncome ?? 0
  const interestExpense =
    pl.nonOperatingExpenses.find((e) => e.name.includes('支払利息') || e.name.includes('利息'))
      ?.amount ?? 0

  const prevEquity = prevBS ? prevBS.totalEquity : undefined

  return SAFETY_RATIOS.map((def): CalculatedRatio => {
    let value = 0

    switch (def.id) {
      case 'equity_ratio':
        value = safeDivide(totalEquity, totalAssets) * 100
        break
      case 'debt_to_equity':
        value = safeDivide(totalLiabilities, totalEquity)
        break
      case 'debt_ratio':
        value = safeDivide(totalLiabilities, totalAssets) * 100
        break
      case 'fixed_ratio':
        value = safeDivide(fixedAssets, totalEquity) * 100
        break
      case 'fixed_long_term_ratio':
        value = safeDivide(fixedAssets, totalEquity + fixedLiabilities) * 100
        break
      case 'interest_coverage':
        value = safeDivide(operatingIncome, interestExpense)
        break
    }

    const status = evaluateRatio(value, def)
    const formattedValue = formatValue(value, def.unit)

    let trend: CalculatedRatio['trend']
    if (def.id === 'equity_ratio' && prevEquity && prevBS) {
      const prevValue = safeDivide(prevEquity, prevBS.totalAssets) * 100
      trend = {
        direction: determineTrend(value, prevValue, def.higherIsBetter),
        previousValue: prevValue,
        changePercent: calculateChangePercent(value, prevValue),
      }
    }

    return {
      definition: def,
      value,
      formattedValue,
      status,
      trend,
    }
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
    default:
      return value.toLocaleString('ja-JP')
  }
}

function determineTrend(
  current: number,
  previous: number,
  higherIsBetter: boolean
): 'improving' | 'stable' | 'declining' {
  const change = ((current - previous) / Math.abs(previous)) * 100
  if (Math.abs(change) < 5) return 'stable'
  if (higherIsBetter) {
    return change > 0 ? 'improving' : 'declining'
  }
  return change < 0 ? 'improving' : 'declining'
}

function calculateChangePercent(current: number, previous: number): number {
  if (previous === 0) return 0
  return ((current - previous) / Math.abs(previous)) * 100
}
