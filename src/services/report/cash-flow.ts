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

export function calculateInvestingCF(inputs: CashFlowInputs): number {
  return -inputs.fixedAssetPurchases + inputs.fixedAssetSales
}

export function calculateFinancingCF(inputs: CashFlowInputs): number {
  return inputs.borrowingProceeds - inputs.borrowingRepayments - inputs.dividendsPaid
}

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

export function calculateGrossProfit(revenue: number, costOfSales: number): number {
  return revenue - costOfSales
}

export function calculateOperatingIncome(grossProfit: number, operatingExpenses: number): number {
  return grossProfit - operatingExpenses
}

export function calculateNetIncome(
  operatingIncome: number,
  nonOperatingIncome: number,
  nonOperatingExpenses: number,
  incomeTax: number
): number {
  return operatingIncome + nonOperatingIncome - nonOperatingExpenses - incomeTax
}

export function aggregateByCategory(items: ProfitLossItem[]): Map<string, number> {
  const result = new Map<string, number>()

  for (const item of items) {
    const category = item.category ?? 'default'
    const current = result.get(category) || 0
    result.set(category, current + item.amount)
  }

  return result
}

export function calculateYoYGrowth(currentValue: number, previousValue: number): number {
  if (previousValue === 0) return currentValue > 0 ? 100 : 0
  return ((currentValue - previousValue) / Math.abs(previousValue)) * 100
}

export function calculateMoMGrowth(currentValue: number, previousValue: number): number {
  if (previousValue === 0) return currentValue > 0 ? 100 : 0
  return ((currentValue - previousValue) / Math.abs(previousValue)) * 100
}
