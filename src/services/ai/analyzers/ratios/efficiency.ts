import type { BalanceSheet, ProfitLoss } from '@/types'
import type { RatioDefinition, CalculatedRatio, RatioStatus } from './types'
import { safeDivide } from '@/lib/utils'

export const EFFICIENCY_RATIOS: readonly RatioDefinition[] = [
  {
    id: 'asset_turnover',
    name: '総資産回転率',
    nameEn: 'Asset Turnover Ratio',
    category: 'efficiency',
    formula: '売上高 ÷ 総資産',
    description: '資産をどれだけ効率的に活用して売上を生み出しているか。',
    unit: 'times',
    thresholds: { excellent: 2.0, good: 1.5, fair: 1.0, poor: 0.5 },
    higherIsBetter: true,
  },
  {
    id: 'inventory_turnover',
    name: '棚卸資産回転率',
    nameEn: 'Inventory Turnover Ratio',
    category: 'efficiency',
    formula: '売上原価 ÷ 棚卸資産',
    description: '在庫がどれだけ迅速に販売されているか。',
    unit: 'times',
    thresholds: { excellent: 12, good: 8, fair: 4, poor: 2 },
    higherIsBetter: true,
  },
  {
    id: 'receivables_turnover',
    name: '売上債権回転率',
    nameEn: 'Receivables Turnover Ratio',
    category: 'efficiency',
    formula: '売上高 ÷ 売上債権',
    description: '売掛金がどれだけ迅速に回収されているか。',
    unit: 'times',
    thresholds: { excellent: 12, good: 8, fair: 6, poor: 4 },
    higherIsBetter: true,
  },
  {
    id: 'payables_turnover',
    name: '仕入債務回転率',
    nameEn: 'Payables Turnover Ratio',
    category: 'efficiency',
    formula: '売上原価 ÷ 仕入債務',
    description: '買掛金の支払サイクル。',
    unit: 'times',
    thresholds: { excellent: 12, good: 8, fair: 6, poor: 4 },
    higherIsBetter: true,
  },
  {
    id: 'days_inventory',
    name: '棚卸資産回転期間',
    nameEn: 'Days Inventory Outstanding',
    category: 'efficiency',
    formula: '365 ÷ 棚卸資産回転率',
    description: '在庫が販売されるまでの平均日数。',
    unit: 'days',
    thresholds: { excellent: 30, good: 45, fair: 90, poor: 180 },
    higherIsBetter: false,
  },
  {
    id: 'days_sales_outstanding',
    name: '売上債権回転期間',
    nameEn: 'Days Sales Outstanding',
    category: 'efficiency',
    formula: '365 ÷ 売上債権回転率',
    description: '売掛金が回収されるまでの平均日数。',
    unit: 'days',
    thresholds: { excellent: 30, good: 45, fair: 60, poor: 90 },
    higherIsBetter: false,
  },
]

export function calculateEfficiencyRatios(
  bs: BalanceSheet,
  pl: ProfitLoss,
  prevBS?: BalanceSheet
): CalculatedRatio[] {
  const revenue = pl.revenue.reduce((sum, r) => sum + (r.amount ?? 0), 0)
  const costOfSales = pl.costOfSales.reduce((sum, c) => sum + (c.amount ?? 0), 0)
  const totalAssets = bs.totalAssets

  const inventory =
    bs.assets.current.find(
      (a) => a.name.includes('棚卸') || a.name.includes('在庫') || a.code === '1005'
    )?.amount ?? 0

  const receivables = bs.assets.current
    .filter((a) => a.name.includes('売掛') || a.name.includes('受取') || a.code === '1003')
    .reduce((sum, a) => sum + (a.amount ?? 0), 0)

  const payables = bs.liabilities.current
    .filter((l) => l.name.includes('買掛') || l.name.includes('未払') || l.code === '2001')
    .reduce((sum, l) => sum + (l.amount ?? 0), 0)

  const avgAssets = prevBS ? (totalAssets + prevBS.totalAssets) / 2 : totalAssets

  return EFFICIENCY_RATIOS.map((def): CalculatedRatio => {
    let value = 0

    switch (def.id) {
      case 'asset_turnover':
        value = safeDivide(revenue, avgAssets)
        break
      case 'inventory_turnover':
        value = safeDivide(costOfSales, inventory)
        break
      case 'receivables_turnover':
        value = safeDivide(revenue, receivables)
        break
      case 'payables_turnover':
        value = safeDivide(costOfSales, payables)
        break
      case 'days_inventory': {
        const invTurnover = safeDivide(costOfSales, inventory)
        value = invTurnover > 0 ? 365 / invTurnover : 0
        break
      }
      case 'days_sales_outstanding': {
        const recTurnover = safeDivide(revenue, receivables)
        value = recTurnover > 0 ? 365 / recTurnover : 0
        break
      }
    }

    const status = evaluateRatio(value, def)
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
    case 'times':
      return `${value.toFixed(2)}回`
    case 'days':
      return `${Math.round(value)}日`
    default:
      return value.toFixed(2)
  }
}
