import type { KPIResult, RunwayCalculation, BalanceSheet, ProfitLoss } from '@/types'

export function calculateROE(netIncome: number, equity: number): KPIResult {
  const value = equity > 0 ? (netIncome / equity) * 100 : 0

  return {
    name: 'ROE',
    value,
    unit: '%',
    format: 'percentage',
    description: '自己資本利益率 (Return on Equity)',
  }
}

export function calculateROA(netIncome: number, totalAssets: number): KPIResult {
  const value = totalAssets > 0 ? (netIncome / totalAssets) * 100 : 0

  return {
    name: 'ROA',
    value,
    unit: '%',
    format: 'percentage',
    description: '総資産利益率 (Return on Assets)',
  }
}

export function calculateROS(operatingIncome: number, revenue: number): KPIResult {
  const value = revenue > 0 ? (operatingIncome / revenue) * 100 : 0

  return {
    name: 'ROS',
    value,
    unit: '%',
    format: 'percentage',
    description: '売上高営業利益率 (Return on Sales)',
  }
}

export function calculateGrossMargin(grossProfit: number, revenue: number): KPIResult {
  const value = revenue > 0 ? (grossProfit / revenue) * 100 : 0

  return {
    name: 'GrossMargin',
    value,
    unit: '%',
    format: 'percentage',
    description: '売上総利益率',
  }
}

export function calculateOperatingMargin(operatingIncome: number, revenue: number): KPIResult {
  const value = revenue > 0 ? (operatingIncome / revenue) * 100 : 0

  return {
    name: 'OperatingMargin',
    value,
    unit: '%',
    format: 'percentage',
    description: '営業利益率',
  }
}

export function calculateEBITDA(
  operatingIncome: number,
  depreciation: number,
  amortization: number
): number {
  return operatingIncome + depreciation + amortization
}

export function calculateEBITDAMargin(ebitda: number, revenue: number): KPIResult {
  const value = revenue > 0 ? (ebitda / revenue) * 100 : 0

  return {
    name: 'EBITDAMargin',
    value,
    unit: '%',
    format: 'percentage',
    description: 'EBITDAマージン',
  }
}

export function calculateCurrentRatio(
  currentAssets: number,
  currentLiabilities: number
): KPIResult {
  const value = currentLiabilities > 0 ? (currentAssets / currentLiabilities) * 100 : 0

  return {
    name: 'CurrentRatio',
    value,
    unit: '%',
    format: 'percentage',
    description: '流動比率',
  }
}

export function calculateQuickRatio(
  currentAssets: number,
  inventory: number,
  currentLiabilities: number
): KPIResult {
  const value =
    currentLiabilities > 0 ? ((currentAssets - inventory) / currentLiabilities) * 100 : 0

  return {
    name: 'QuickRatio',
    value,
    unit: '%',
    format: 'percentage',
    description: '当座比率',
  }
}

export function calculateDERatio(totalLiabilities: number, equity: number): KPIResult {
  const value = equity > 0 ? totalLiabilities / equity : 0

  return {
    name: 'DERatio',
    value,
    unit: '',
    format: 'ratio',
    description: 'D/E比率 (負債自己資本比率)',
  }
}

export function calculateEquityRatio(equity: number, totalAssets: number): KPIResult {
  const value = totalAssets > 0 ? (equity / totalAssets) * 100 : 0

  return {
    name: 'EquityRatio',
    value,
    unit: '%',
    format: 'percentage',
    description: '自己資本比率',
  }
}

export function calculateRunway(
  currentCash: number,
  averageMonthlyRevenue: number,
  averageMonthlyExpenses: number
): RunwayCalculation {
  const burnRate = averageMonthlyExpenses - averageMonthlyRevenue
  const runwayMonths = burnRate > 0 ? Math.floor(currentCash / burnRate) : Infinity

  const zeroCashDate = new Date()
  if (runwayMonths !== Infinity) {
    zeroCashDate.setMonth(zeroCashDate.getMonth() + runwayMonths)
  }

  return {
    monthlyBurnRate: burnRate,
    runwayMonths,
    zeroCashDate,
    currentCash,
    scenarios: {
      optimistic: {
        burnRate: burnRate * 0.8,
        runwayMonths: burnRate > 0 ? Math.floor(currentCash / (burnRate * 0.8)) : Infinity,
      },
      realistic: { burnRate, runwayMonths },
      pessimistic: {
        burnRate: burnRate * 1.2,
        runwayMonths: burnRate > 0 ? Math.floor(currentCash / (burnRate * 1.2)) : Infinity,
      },
    },
  }
}

export function calculateRunwayKPI(runway: RunwayCalculation): KPIResult {
  return {
    name: 'Runway',
    value: runway.runwayMonths === Infinity ? 999 : runway.runwayMonths,
    unit: 'ヶ月',
    format: 'months',
    description: '資金繰り維持期間',
  }
}

export function calculateAllKPIs(
  bs: BalanceSheet,
  pl: ProfitLoss,
  depreciation: number = 0,
  amortization: number = 0
): KPIResult[] {
  const totalAssets = bs.totalAssets
  const equity = bs.totalEquity
  const currentAssets = bs.assets.current.reduce((sum, item) => sum + item.amount, 0)
  const currentLiabilities = bs.liabilities.current.reduce((sum, item) => sum + item.amount, 0)
  const inventory = bs.assets.current
    .filter((item) => item.name.includes('棚卸') || item.name.includes('在庫'))
    .reduce((sum, item) => sum + item.amount, 0)
  const totalLiabilities = bs.totalLiabilities

  const ebitda = calculateEBITDA(pl.operatingIncome, depreciation, amortization)
  const totalRevenue = pl.revenue.reduce((sum, item) => sum + item.amount, 0)

  return [
    calculateROE(pl.netIncome, equity),
    calculateROA(pl.netIncome, totalAssets),
    calculateROS(pl.operatingIncome, totalRevenue),
    calculateGrossMargin(pl.grossProfit, totalRevenue),
    calculateOperatingMargin(pl.operatingIncome, totalRevenue),
    calculateEBITDAMargin(ebitda, totalRevenue),
    calculateCurrentRatio(currentAssets, currentLiabilities),
    calculateQuickRatio(currentAssets, inventory, currentLiabilities),
    calculateDERatio(totalLiabilities, equity),
    calculateEquityRatio(equity, totalAssets),
  ]
}
