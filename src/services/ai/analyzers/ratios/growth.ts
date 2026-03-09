import type { BalanceSheet, ProfitLoss } from '@/types'
import type { RatioDefinition, CalculatedRatio, RatioStatus } from './types'

export const GROWTH_RATIOS: readonly RatioDefinition[] = [
  {
    id: 'revenue_growth',
    name: '売上成長率',
    nameEn: 'Revenue Growth Rate',
    category: 'growth',
    formula: '（当期売上 - 前期売上） ÷ 前期売上 × 100',
    description: '売上の前期比成長率。',
    unit: 'percentage',
    thresholds: { excellent: 20, good: 10, fair: 0, poor: -10 },
    higherIsBetter: true,
  },
  {
    id: 'operating_income_growth',
    name: '営業利益成長率',
    nameEn: 'Operating Income Growth Rate',
    category: 'growth',
    formula: '（当期営業利益 - 前期営業利益） ÷ |前期営業利益| × 100',
    description: '営業利益の前期比成長率。',
    unit: 'percentage',
    thresholds: { excellent: 20, good: 10, fair: 0, poor: -10 },
    higherIsBetter: true,
  },
  {
    id: 'net_income_growth',
    name: '純利益成長率',
    nameEn: 'Net Income Growth Rate',
    category: 'growth',
    formula: '（当期純利益 - 前期純利益） ÷ |前期純利益| × 100',
    description: '純利益の前期比成長率。',
    unit: 'percentage',
    thresholds: { excellent: 20, good: 10, fair: 0, poor: -10 },
    higherIsBetter: true,
  },
  {
    id: 'total_assets_growth',
    name: '総資産成長率',
    nameEn: 'Total Assets Growth Rate',
    category: 'growth',
    formula: '（当期総資産 - 前期総資産） ÷ 前期総資産 × 100',
    description: '総資産の前期比成長率。',
    unit: 'percentage',
    thresholds: { excellent: 15, good: 8, fair: 0, poor: -5 },
    higherIsBetter: true,
  },
  {
    id: 'equity_growth',
    name: '自己資本成長率',
    nameEn: 'Equity Growth Rate',
    category: 'growth',
    formula: '（当期純資産 - 前期純資産） ÷ 前期純資産 × 100',
    description: '自己資本の前期比成長率。',
    unit: 'percentage',
    thresholds: { excellent: 15, good: 8, fair: 0, poor: -5 },
    higherIsBetter: true,
  },
]

export function calculateGrowthRatios(
  bs: BalanceSheet,
  pl: ProfitLoss,
  prevBS?: BalanceSheet,
  prevPL?: ProfitLoss
): CalculatedRatio[] {
  const revenue = pl.revenue.reduce((sum, r) => sum + (r.amount ?? 0), 0)
  const operatingIncome = pl.operatingIncome ?? 0
  const netIncome = pl.netIncome ?? 0
  const totalAssets = bs.totalAssets
  const totalEquity = bs.totalEquity

  const prevRevenue = prevPL
    ? prevPL.revenue.reduce((sum, r) => sum + (r.amount ?? 0), 0)
    : undefined
  const prevOperatingIncome = prevPL?.operatingIncome
  const prevNetIncome = prevPL?.netIncome
  const prevTotalAssets = prevBS?.totalAssets
  const prevTotalEquity = prevBS?.totalEquity

  return GROWTH_RATIOS.map((def): CalculatedRatio => {
    let value = 0
    let hasPreviousData = false

    switch (def.id) {
      case 'revenue_growth':
        if (prevRevenue !== undefined && prevRevenue !== 0) {
          value = ((revenue - prevRevenue) / Math.abs(prevRevenue)) * 100
          hasPreviousData = true
        }
        break
      case 'operating_income_growth':
        if (prevOperatingIncome !== undefined && prevOperatingIncome !== 0) {
          value = ((operatingIncome - prevOperatingIncome) / Math.abs(prevOperatingIncome)) * 100
          hasPreviousData = true
        }
        break
      case 'net_income_growth':
        if (prevNetIncome !== undefined && prevNetIncome !== 0) {
          value = ((netIncome - prevNetIncome) / Math.abs(prevNetIncome)) * 100
          hasPreviousData = true
        }
        break
      case 'total_assets_growth':
        if (prevTotalAssets !== undefined && prevTotalAssets !== 0) {
          value = ((totalAssets - prevTotalAssets) / Math.abs(prevTotalAssets)) * 100
          hasPreviousData = true
        }
        break
      case 'equity_growth':
        if (prevTotalEquity !== undefined && prevTotalEquity !== 0) {
          value = ((totalEquity - prevTotalEquity) / Math.abs(prevTotalEquity)) * 100
          hasPreviousData = true
        }
        break
    }

    const status = hasPreviousData ? evaluateRatio(value, def) : 'fair'
    const formattedValue = formatValue(value, def.unit)

    return {
      definition: def,
      value,
      formattedValue,
      status,
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
      return value.toFixed(2)
  }
}
