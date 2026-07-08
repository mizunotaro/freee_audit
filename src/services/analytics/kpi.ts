import type { KPIResult, RunwayCalculation, BalanceSheet, ProfitLoss } from '@/types'

/**
 * Calculates Return on Equity (ROE): net income as a percentage of equity.
 *
 * @param netIncome - Net income for the period.
 * @param equity - Total shareholders' equity.
 * @returns KPIResult holding ROE in percent; `0` when equity is zero.
 */
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

/**
 * Calculates Return on Assets (ROA): net income as a percentage of total assets.
 *
 * @param netIncome - Net income for the period.
 * @param totalAssets - Total assets.
 * @returns KPIResult holding ROA in percent; `0` when total assets is zero.
 */
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

/**
 * Calculates Return on Sales (ROS): operating income as a percentage of revenue.
 *
 * @param operatingIncome - Operating income.
 * @param revenue - Total revenue.
 * @returns KPIResult holding ROS in percent; `0` when revenue is zero.
 */
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

/**
 * Calculates gross profit margin: gross profit as a percentage of revenue.
 *
 * @param grossProfit - Gross profit.
 * @param revenue - Total revenue.
 * @returns KPIResult holding the margin in percent; `0` when revenue is zero.
 */
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

/**
 * Calculates operating margin: operating income as a percentage of revenue.
 *
 * @param operatingIncome - Operating income.
 * @param revenue - Total revenue.
 * @returns KPIResult holding the margin in percent; `0` when revenue is zero.
 */
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

/**
 * Calculates EBITDA by adding depreciation and amortization back to operating income.
 *
 * @param operatingIncome - Operating income.
 * @param depreciation - Depreciation expense.
 * @param amortization - Amortization expense (e.g. goodwill).
 * @returns EBITDA as a raw currency amount.
 */
export function calculateEBITDA(
  operatingIncome: number,
  depreciation: number,
  amortization: number
): number {
  return operatingIncome + depreciation + amortization
}

/**
 * Calculates EBITDA margin: EBITDA as a percentage of revenue.
 *
 * @param ebitda - EBITDA (see {@link calculateEBITDA}).
 * @param revenue - Total revenue.
 * @returns KPIResult holding the margin in percent; `0` when revenue is zero.
 */
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

/**
 * Calculates current ratio: current assets as a percentage of current liabilities.
 *
 * @param currentAssets - Total current assets.
 * @param currentLiabilities - Total current liabilities.
 * @returns KPIResult holding the ratio in percent; `0` when current liabilities is zero.
 */
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

/**
 * Calculates quick (acid-test) ratio: current assets less inventory, as a percentage
 * of current liabilities.
 *
 * @param currentAssets - Total current assets.
 * @param inventory - Inventory included in current assets.
 * @param currentLiabilities - Total current liabilities.
 * @returns KPIResult holding the ratio in percent; `0` when current liabilities is zero.
 */
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

/**
 * Calculates debt-to-equity (D/E) ratio: total liabilities divided by equity.
 *
 * @param totalLiabilities - Total liabilities.
 * @param equity - Total shareholders' equity.
 * @returns KPIResult holding the unitless ratio; `0` when equity is zero.
 */
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

/**
 * Calculates equity ratio: equity as a percentage of total assets.
 *
 * @param equity - Total shareholders' equity.
 * @param totalAssets - Total assets.
 * @returns KPIResult holding the ratio in percent; `0` when total assets is zero.
 */
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

/**
 * Calculates cash runway: how many months the current cash balance lasts given the
 * net burn rate (monthly expenses minus monthly revenue).
 *
 * @param currentCash - Cash balance at the start.
 * @param averageMonthlyRevenue - Average monthly revenue.
 * @param averageMonthlyExpenses - Average monthly expenses.
 * @returns RunwayCalculation with burn rate, runway months, projected zero-cash date,
 *   and optimistic/realistic/pessimistic scenarios. `runwayMonths` is `Infinity` when
 *   the business is not burning cash.
 */
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

/**
 * Wraps a RunwayCalculation into a displayable KPIResult.
 *
 * @param runway - Precomputed runway (see {@link calculateRunway}).
 * @returns KPIResult expressed in months; capped at 999 when runway is infinite.
 */
export function calculateRunwayKPI(runway: RunwayCalculation): KPIResult {
  return {
    name: 'Runway',
    value: runway.runwayMonths === Infinity ? 999 : runway.runwayMonths,
    unit: 'ヶ月',
    format: 'months',
    description: '資金繰り維持期間',
  }
}

/**
 * Computes the standard set of financial KPIs from a balance sheet and P&L.
 *
 * Inventory is detected from current-asset items whose names contain "棚卸" or "在庫".
 *
 * @param bs - Balance sheet.
 * @param pl - Profit & loss statement.
 * @param depreciation - Depreciation expense (defaults to 0).
 * @param amortization - Amortization expense (defaults to 0).
 * @returns KPIResult entries: ROE, ROA, ROS, gross/operating margin, EBITDA margin,
 *   current ratio, quick ratio, D/E ratio, and equity ratio.
 */
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
