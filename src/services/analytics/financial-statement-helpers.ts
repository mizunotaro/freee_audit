// Low-level financial-statement primitives shared by the legacy KPI system
// (financial-kpi.ts) and the strengthened ratio set (financial-ratios.ts):
// rounding helpers plus BalanceSheet/ProfitLoss field extraction by Japanese
// account-name keywords.

import type { BalanceSheet, ProfitLoss } from '@/types'

export function roundTo2(value: number): number {
  return Math.round(value * 100) / 100
}

export function roundTo4(value: number): number {
  return Math.round(value * 10000) / 10000
}

export function getTotalRevenue(pl: ProfitLoss): number {
  return pl.revenue.reduce((sum, item) => sum + item.amount, 0)
}

export function getTotalInventory(bs: BalanceSheet): number {
  return bs.assets.current
    .filter(
      (item) =>
        item.name.includes('棚卸') ||
        item.name.includes('商品') ||
        item.name.includes('製品') ||
        item.name.includes('材料')
    )
    .reduce((sum, item) => sum + item.amount, 0)
}

export function getTotalReceivables(bs: BalanceSheet): number {
  return bs.assets.current
    .filter(
      (item) =>
        item.name.includes('売掛') || item.name.includes('受取手形') || item.name.includes('未収')
    )
    .reduce((sum, item) => sum + item.amount, 0)
}

export function getTotalPayables(bs: BalanceSheet): number {
  return bs.liabilities.current
    .filter(
      (item) =>
        item.name.includes('買掛') || item.name.includes('支払手形') || item.name.includes('未払')
    )
    .reduce((sum, item) => sum + item.amount, 0)
}
