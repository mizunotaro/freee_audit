import type { CashFlowStatement, ProfitLossItem } from '@/types'

export interface CashFlowInputs {
  netIncome: number
  depreciation: number
  amortization: number
  accountsReceivableChange: number
  inventoryChange: number
  accountsPayableChange: number
  otherOperatingAdjustments: number
  fixedAssetPurchases: number
  fixedAssetSales: number
  borrowingProceeds: number
  borrowingRepayments: number
  dividendsPaid: number
  beginningCash: number
}

/**
 * Calculates net operating cash flow by adjusting net income for non-cash items
 * (depreciation, amortization) and working-capital changes.
 *
 * @param inputs - Cash flow input components.
 * @returns Net cash from operating activities.
 */
export function calculateOperatingCF(inputs: CashFlowInputs): number {
  let cf = inputs.netIncome

  cf += inputs.depreciation
  cf += inputs.amortization
  cf -= inputs.accountsReceivableChange
  cf -= inputs.inventoryChange
  cf += inputs.accountsPayableChange
  cf += inputs.otherOperatingAdjustments

  return cf
}

/**
 * Calculates net investing cash flow (fixed-asset sale proceeds less purchases).
 *
 * @param inputs - Cash flow input components.
 * @returns Net cash from investing activities.
 */
export function calculateInvestingCF(inputs: CashFlowInputs): number {
  return -inputs.fixedAssetPurchases + inputs.fixedAssetSales
}

/**
 * Calculates net financing cash flow (borrowing proceeds less repayments and dividends).
 *
 * @param inputs - Cash flow input components.
 * @returns Net cash from financing activities.
 */
export function calculateFinancingCF(inputs: CashFlowInputs): number {
  return inputs.borrowingProceeds - inputs.borrowingRepayments - inputs.dividendsPaid
}

/**
 * Builds a full indirect-method cash flow statement from operating/investing/financing
 * components, including categorized line items and beginning/ending cash.
 *
 * @param inputs - Cash flow input components.
 * @returns CashFlowStatement with line items and the net change in cash.
 */
export function calculateCashFlowStatement(inputs: CashFlowInputs): CashFlowStatement {
  const operatingCash = calculateOperatingCF(inputs)
  const investingCash = calculateInvestingCF(inputs)
  const financingCash = calculateFinancingCF(inputs)
  const netChange = operatingCash + investingCash + financingCash

  return {
    operating: {
      items: [
        { name: '当期純利益', amount: inputs.netIncome },
        { name: '減価償却費', amount: inputs.depreciation },
        { name: 'のれん償却', amount: inputs.amortization },
        { name: '売掛金の増減', amount: -inputs.accountsReceivableChange },
        { name: '棚卸資産の増減', amount: -inputs.inventoryChange },
        { name: '買掛金の増減', amount: inputs.accountsPayableChange },
        { name: 'その他', amount: inputs.otherOperatingAdjustments },
      ],
      netCashFromOperating: operatingCash,
    },
    investing: {
      items: [
        { name: '固定資産の取得', amount: -inputs.fixedAssetPurchases },
        { name: '固定資産の売却', amount: inputs.fixedAssetSales },
      ],
      netCashFromInvesting: investingCash,
    },
    financing: {
      items: [
        { name: '借入金の増加', amount: inputs.borrowingProceeds },
        { name: '借入金の返済', amount: -inputs.borrowingRepayments },
        { name: '配当金の支払', amount: -inputs.dividendsPaid },
      ],
      netCashFromFinancing: financingCash,
    },
    netChangeInCash: netChange,
    beginningCash: inputs.beginningCash,
    endingCash: inputs.beginningCash + netChange,
    periodStart: new Date(),
    periodEnd: new Date(),
  }
}

/**
 * Calculates gross profit (revenue less cost of sales).
 *
 * @param revenue - Total revenue.
 * @param costOfSales - Cost of sales.
 * @returns Gross profit.
 */
export function calculateGrossProfit(revenue: number, costOfSales: number): number {
  return revenue - costOfSales
}

/**
 * Calculates operating income (gross profit less operating expenses).
 *
 * @param grossProfit - Gross profit.
 * @param operatingExpenses - Selling, general & administrative expenses.
 * @returns Operating income.
 */
export function calculateOperatingIncome(grossProfit: number, operatingExpenses: number): number {
  return grossProfit - operatingExpenses
}

/**
 * Calculates net income: operating income plus non-operating income, less
 * non-operating expenses and income tax.
 *
 * @param operatingIncome - Operating income.
 * @param nonOperatingIncome - Non-operating income.
 * @param nonOperatingExpenses - Non-operating expenses.
 * @param incomeTax - Income tax expense.
 * @returns Net income.
 */
export function calculateNetIncome(
  operatingIncome: number,
  nonOperatingIncome: number,
  nonOperatingExpenses: number,
  incomeTax: number
): number {
  return operatingIncome + nonOperatingIncome - nonOperatingExpenses - incomeTax
}

/**
 * Sums ProfitLossItem amounts grouped by their `category` (items without a category
 * fall under 'default').
 *
 * @param items - Profit & loss line items.
 * @returns Map of category to total amount.
 */
export function aggregateByCategory(items: ProfitLossItem[]): Map<string, number> {
  const result = new Map<string, number>()

  for (const item of items) {
    const category = item.category ?? 'default'
    const current = result.get(category) || 0
    result.set(category, current + item.amount)
  }

  return result
}

/**
 * Calculates year-over-year growth as a percentage. Returns 100 when the previous
 * value is 0 and the current is positive, otherwise 0 when the previous value is 0.
 *
 * @param currentValue - Current-period value.
 * @param previousValue - Prior-period value.
 * @returns Growth rate in percent.
 */
export function calculateYoYGrowth(currentValue: number, previousValue: number): number {
  if (previousValue === 0) return currentValue > 0 ? 100 : 0
  return ((currentValue - previousValue) / Math.abs(previousValue)) * 100
}

/**
 * Calculates month-over-month growth as a percentage. Returns 100 when the previous
 * value is 0 and the current is positive, otherwise 0 when the previous value is 0.
 *
 * @param currentValue - Current-period value.
 * @param previousValue - Prior-period value.
 * @returns Growth rate in percent.
 */
export function calculateMoMGrowth(currentValue: number, previousValue: number): number {
  if (previousValue === 0) return currentValue > 0 ? 100 : 0
  return ((currentValue - previousValue) / Math.abs(previousValue)) * 100
}
