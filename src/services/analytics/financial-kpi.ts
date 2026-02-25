import type { BalanceSheet, ProfitLoss, FinancialKPIs, CashFlowStatement } from '@/types'
import { safeDivide, calculateGrowthRate } from '@/lib/utils'
import { calculateFreeCashFlow } from '@/services/cashflow/calculator'

export function calculateFinancialKPIs(
  bs: BalanceSheet,
  pl: ProfitLoss,
  cf: CashFlowStatement,
  previousPL?: ProfitLoss
): FinancialKPIs {
  return {
    fiscalYear: pl.fiscalYear,
    month: pl.month,
    profitability: calculateProfitabilityKPIs(bs, pl),
    efficiency: calculateEfficiencyKPIs(bs, pl),
    safety: calculateSafetyKPIs(bs),
    growth: calculateGrowthKPIs(pl, previousPL),
    cashFlow: calculateCashFlowKPIs(pl, cf),
  }
}

function calculateProfitabilityKPIs(
  bs: BalanceSheet,
  pl: ProfitLoss
): FinancialKPIs['profitability'] {
  const totalAssets = bs.totalAssets
  const equity = bs.totalEquity
  const revenue = getTotalRevenue(pl)

  const roe = safeDivide(pl.netIncome, equity) * 100
  const roa = safeDivide(pl.netIncome, totalAssets) * 100
  const ros = safeDivide(pl.operatingIncome, revenue) * 100
  const grossProfitMargin = pl.grossProfitMargin
  const operatingMargin = pl.operatingMargin
  const ebitdaMargin = calculateEBITDAMargin(pl)

  return {
    roe: roundTo2(roe),
    roa: roundTo2(roa),
    ros: roundTo2(ros),
    grossProfitMargin: roundTo2(grossProfitMargin),
    operatingMargin: roundTo2(operatingMargin),
    ebitdaMargin: roundTo2(ebitdaMargin),
  }
}

function calculateEfficiencyKPIs(bs: BalanceSheet, pl: ProfitLoss): FinancialKPIs['efficiency'] {
  const revenue = getTotalRevenue(pl)
  const costOfSales = pl.costOfSales.reduce((sum, item) => sum + item.amount, 0)

  const totalAssets = bs.totalAssets
  const inventory = getTotalInventory(bs)
  const receivables = getTotalReceivables(bs)
  const payables = getTotalPayables(bs)

  const assetTurnover = safeDivide(revenue, totalAssets)
  const inventoryTurnover = safeDivide(costOfSales, inventory)
  const receivablesTurnover = safeDivide(revenue, receivables)
  const payablesTurnover = safeDivide(costOfSales, payables)

  return {
    assetTurnover: roundTo2(assetTurnover),
    inventoryTurnover: roundTo2(inventoryTurnover),
    receivablesTurnover: roundTo2(receivablesTurnover),
    payablesTurnover: roundTo2(payablesTurnover),
  }
}

function calculateSafetyKPIs(bs: BalanceSheet): FinancialKPIs['safety'] {
  const currentAssets = bs.assets.current.reduce((sum, item) => sum + item.amount, 0)
  const currentLiabilities = bs.liabilities.current.reduce((sum, item) => sum + item.amount, 0)
  const inventory = getTotalInventory(bs)
  const totalLiabilities = bs.totalLiabilities
  const equity = bs.totalEquity
  const totalAssets = bs.totalAssets

  const currentRatio = safeDivide(currentAssets, currentLiabilities) * 100
  const quickRatio = safeDivide(currentAssets - inventory, currentLiabilities) * 100
  const debtToEquity = safeDivide(totalLiabilities, equity)
  const equityRatio = safeDivide(equity, totalAssets) * 100

  return {
    currentRatio: roundTo2(currentRatio),
    quickRatio: roundTo2(quickRatio),
    debtToEquity: roundTo2(debtToEquity),
    equityRatio: roundTo2(equityRatio),
  }
}

function calculateGrowthKPIs(pl: ProfitLoss, previousPL?: ProfitLoss): FinancialKPIs['growth'] {
  if (!previousPL) {
    return {
      revenueGrowth: 0,
      profitGrowth: 0,
    }
  }

  const currentRevenue = getTotalRevenue(pl)
  const previousRevenue = getTotalRevenue(previousPL)
  const currentProfit = pl.netIncome
  const previousProfit = previousPL.netIncome

  return {
    revenueGrowth: roundTo2(calculateGrowthRate(currentRevenue, previousRevenue)),
    profitGrowth: roundTo2(calculateGrowthRate(currentProfit, previousProfit)),
  }
}

function calculateCashFlowKPIs(pl: ProfitLoss, cf: CashFlowStatement): FinancialKPIs['cashFlow'] {
  const fcf = calculateFreeCashFlow(cf)
  const revenue = getTotalRevenue(pl)
  const fcfMargin = safeDivide(fcf, revenue) * 100

  return {
    fcf: Math.round(fcf),
    fcfMargin: roundTo2(fcfMargin),
  }
}

function calculateEBITDAMargin(pl: ProfitLoss): number {
  const ebitda = pl.operatingIncome + (pl.depreciation || 0)
  const revenue = getTotalRevenue(pl)
  return safeDivide(ebitda, revenue) * 100
}

function getTotalRevenue(pl: ProfitLoss): number {
  return pl.revenue.reduce((sum, item) => sum + item.amount, 0)
}

function getTotalInventory(bs: BalanceSheet): number {
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

function getTotalReceivables(bs: BalanceSheet): number {
  return bs.assets.current
    .filter(
      (item) =>
        item.name.includes('売掛') || item.name.includes('受取手形') || item.name.includes('未収')
    )
    .reduce((sum, item) => sum + item.amount, 0)
}

function getTotalPayables(bs: BalanceSheet): number {
  return bs.liabilities.current
    .filter(
      (item) =>
        item.name.includes('買掛') || item.name.includes('支払手形') || item.name.includes('未払')
    )
    .reduce((sum, item) => sum + item.amount, 0)
}

function roundTo2(value: number): number {
  return Math.round(value * 100) / 100
}

export interface KPIBenchmark {
  kpi: string
  value: number
  benchmark: number
  status: 'good' | 'warning' | 'bad'
  description: string
}

export function getKPIBenchmarks(kpis: FinancialKPIs): KPIBenchmark[] {
  return [
    {
      kpi: 'ROE',
      value: kpis.profitability.roe,
      benchmark: 10,
      status:
        kpis.profitability.roe >= 10 ? 'good' : kpis.profitability.roe >= 5 ? 'warning' : 'bad',
      description: '自己資本利益率。10%以上が望ましい',
    },
    {
      kpi: 'ROA',
      value: kpis.profitability.roa,
      benchmark: 5,
      status:
        kpis.profitability.roa >= 5 ? 'good' : kpis.profitability.roa >= 2 ? 'warning' : 'bad',
      description: '総資産利益率。5%以上が望ましい',
    },
    {
      kpi: '流動比率',
      value: kpis.safety.currentRatio,
      benchmark: 150,
      status:
        kpis.safety.currentRatio >= 150
          ? 'good'
          : kpis.safety.currentRatio >= 100
            ? 'warning'
            : 'bad',
      description: '短期的な支払能力。150%以上が望ましい',
    },
    {
      kpi: 'D/E比率',
      value: kpis.safety.debtToEquity,
      benchmark: 1.0,
      status:
        kpis.safety.debtToEquity <= 1.0
          ? 'good'
          : kpis.safety.debtToEquity <= 2.0
            ? 'warning'
            : 'bad',
      description: '財務リスク。1.0以下が望ましい',
    },
    {
      kpi: '自己資本比率',
      value: kpis.safety.equityRatio,
      benchmark: 30,
      status:
        kpis.safety.equityRatio >= 30 ? 'good' : kpis.safety.equityRatio >= 20 ? 'warning' : 'bad',
      description: '財務の安定性。30%以上が望ましい',
    },
    {
      kpi: '売上総利益率',
      value: kpis.profitability.grossProfitMargin,
      benchmark: 30,
      status:
        kpis.profitability.grossProfitMargin >= 30
          ? 'good'
          : kpis.profitability.grossProfitMargin >= 20
            ? 'warning'
            : 'bad',
      description: '収益力の基本指標',
    },
    {
      kpi: '営業利益率',
      value: kpis.profitability.operatingMargin,
      benchmark: 10,
      status:
        kpis.profitability.operatingMargin >= 10
          ? 'good'
          : kpis.profitability.operatingMargin >= 5
            ? 'warning'
            : 'bad',
      description: '本業の収益性。10%以上推奨',
    },
    {
      kpi: 'EBITDAマージン',
      value: kpis.profitability.ebitdaMargin,
      benchmark: 15,
      status:
        kpis.profitability.ebitdaMargin >= 15
          ? 'good'
          : kpis.profitability.ebitdaMargin >= 10
            ? 'warning'
            : 'bad',
      description: 'キャッシュ創出力。15%以上推奨',
    },
  ]
}
