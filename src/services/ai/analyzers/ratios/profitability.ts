import type { BalanceSheet, ProfitLoss } from '@/types'
import type { RatioDefinition, CalculatedRatio, RatioStatus } from './types'
import { safeDivide } from '@/lib/utils'

export const PROFITABILITY_RATIOS: readonly RatioDefinition[] = [
  {
    id: 'gross_margin',
    name: '売上総利益率',
    nameEn: 'Gross Profit Margin',
    category: 'profitability',
    formula: '売上総利益 ÷ 売上高 × 100',
    description: '売上高に対する粗利の割合。業種により異なるが30%以上が目安。',
    unit: 'percentage',
    thresholds: { excellent: 40, good: 30, fair: 20, poor: 10 },
    higherIsBetter: true,
  },
  {
    id: 'operating_margin',
    name: '営業利益率',
    nameEn: 'Operating Margin',
    category: 'profitability',
    formula: '営業利益 ÷ 売上高 × 100',
    description: '本業の収益力を示す。10%以上が望ましい。',
    unit: 'percentage',
    thresholds: { excellent: 15, good: 10, fair: 5, poor: 2 },
    higherIsBetter: true,
  },
  {
    id: 'ordinary_margin',
    name: '経常利益率',
    nameEn: 'Ordinary Margin',
    category: 'profitability',
    formula: '経常利益 ÷ 売上高 × 100',
    description: '経常的な収益力を示す。',
    unit: 'percentage',
    thresholds: { excellent: 12, good: 8, fair: 4, poor: 1 },
    higherIsBetter: true,
  },
  {
    id: 'net_margin',
    name: '当期純利益率',
    nameEn: 'Net Profit Margin',
    category: 'profitability',
    formula: '当期純利益 ÷ 売上高 × 100',
    description: '最終的な収益性を示す。',
    unit: 'percentage',
    thresholds: { excellent: 10, good: 7, fair: 4, poor: 1 },
    higherIsBetter: true,
  },
  {
    id: 'roa',
    name: 'ROA（総資産利益率）',
    nameEn: 'Return on Assets',
    category: 'profitability',
    formula: '当期純利益 ÷ 総資産 × 100',
    description: '資産をどれだけ効率的に活用しているか。6%以上が目安。',
    unit: 'percentage',
    thresholds: { excellent: 10, good: 6, fair: 3, poor: 1 },
    higherIsBetter: true,
  },
  {
    id: 'roe',
    name: 'ROE（自己資本利益率）',
    nameEn: 'Return on Equity',
    category: 'profitability',
    formula: '当期純利益 ÷ 純資産 × 100',
    description: '自己資本に対する収益率。10%以上が目安。',
    unit: 'percentage',
    thresholds: { excellent: 15, good: 10, fair: 5, poor: 0 },
    higherIsBetter: true,
  },
  {
    id: 'roi',
    name: 'ROI（投資利益率）',
    nameEn: 'Return on Investment',
    category: 'profitability',
    formula: '（当期純利益 + 利息費用） ÷（純資産 + 有利子負債）× 100',
    description: '投下資本に対する収益率。',
    unit: 'percentage',
    thresholds: { excellent: 12, good: 8, fair: 4, poor: 0 },
    higherIsBetter: true,
  },
]

export function calculateProfitabilityRatios(
  bs: BalanceSheet,
  pl: ProfitLoss,
  prevBS?: BalanceSheet,
  prevPL?: ProfitLoss
): CalculatedRatio[] {
  const revenue = pl.revenue.reduce((sum, r) => sum + (r.amount ?? 0), 0)
  const grossProfit = pl.grossProfit ?? 0
  const operatingIncome = pl.operatingIncome ?? 0
  const ordinaryIncome = pl.ordinaryIncome ?? 0
  const netIncome = pl.netIncome ?? 0
  const totalAssets = bs.totalAssets
  const totalEquity = bs.totalEquity

  const interestExpense =
    pl.nonOperatingExpenses.find((e) => e.name.includes('支払利息'))?.amount ?? 0

  const interestBearingDebt =
    bs.liabilities.current
      .filter((l) => l.name.includes('借入') || l.name.includes('リース'))
      .reduce((sum, l) => sum + (l.amount ?? 0), 0) +
    bs.liabilities.fixed
      .filter((l) => l.name.includes('借入') || l.name.includes('社債'))
      .reduce((sum, l) => sum + (l.amount ?? 0), 0)

  const avgAssets = prevBS ? (totalAssets + prevBS.totalAssets) / 2 : totalAssets
  const avgEquity = prevBS ? (totalEquity + prevBS.totalEquity) / 2 : totalEquity

  const prevNetMargin =
    prevPL && revenue > 0
      ? safeDivide(
          prevPL.netIncome ?? 0,
          prevPL.revenue.reduce((s, r) => s + (r.amount ?? 0), 0)
        ) * 100
      : undefined

  return PROFITABILITY_RATIOS.map((def): CalculatedRatio => {
    let value = 0

    switch (def.id) {
      case 'gross_margin':
        value = safeDivide(grossProfit, revenue) * 100
        break
      case 'operating_margin':
        value = safeDivide(operatingIncome, revenue) * 100
        break
      case 'ordinary_margin':
        value = safeDivide(ordinaryIncome, revenue) * 100
        break
      case 'net_margin':
        value = safeDivide(netIncome, revenue) * 100
        break
      case 'roa':
        value = safeDivide(netIncome, avgAssets) * 100
        break
      case 'roe':
        value = safeDivide(netIncome, avgEquity) * 100
        break
      case 'roi':
        value = safeDivide(netIncome + interestExpense, totalEquity + interestBearingDebt) * 100
        break
    }

    const status = evaluateRatio(value, def)
    const formattedValue = formatValue(value, def.unit)

    let trend: CalculatedRatio['trend']
    if (def.id === 'net_margin' && prevNetMargin !== undefined) {
      trend = {
        direction: determineTrend(value, prevNetMargin),
        previousValue: prevNetMargin,
        changePercent: calculateChangePercent(value, prevNetMargin),
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
    default:
      return `${value.toFixed(2)}`
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
