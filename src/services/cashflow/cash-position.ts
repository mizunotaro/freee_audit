import type { CashPosition, CashPositionMonthly, CashFlowStatement } from '@/types'
import { sumValues } from '@/lib/utils'

export function generateCashPosition(
  monthlyCashFlows: CashFlowStatement[],
  beginningCash: number
): CashPosition {
  const months: CashPositionMonthly[] = []
  let currentCash = beginningCash

  const sortedCFs = [...monthlyCashFlows].sort((a, b) => (a.month || 0) - (b.month || 0))

  for (const cf of sortedCFs) {
    const operatingNet = cf.operatingActivities?.netCashFromOperating ?? 0
    const investingNet = cf.investingActivities?.netCashFromInvesting ?? 0
    const financingNet = cf.financingActivities?.netCashFromFinancing ?? 0

    const monthData: CashPositionMonthly = {
      month: cf.month || 0,
      beginningCash: currentCash,
      operatingInflow: calculateOperatingInflow(cf),
      operatingOutflow: calculateOperatingOutflow(cf),
      operatingNet,
      investingNet,
      financingNet,
      netChange: operatingNet + investingNet + financingNet,
      endingCash: currentCash + operatingNet + investingNet + financingNet,
    }

    months.push(monthData)
    currentCash = monthData.endingCash
  }

  const annualTotal = {
    operatingNet: sumValues(months.map((m) => m.operatingNet)),
    investingNet: sumValues(months.map((m) => m.investingNet)),
    financingNet: sumValues(months.map((m) => m.financingNet)),
    netChange: sumValues(months.map((m) => m.netChange)),
  }

  return {
    fiscalYear: sortedCFs[0]?.fiscalYear || 0,
    months,
    annualTotal,
  }
}

function calculateOperatingInflow(cf: CashFlowStatement): number {
  const op = cf.operatingActivities
  if (!op) return 0
  let inflow = 0

  if (op.netIncome > 0) inflow += op.netIncome
  inflow += op.depreciation
  if (op.increaseInReceivables > 0) inflow += op.increaseInReceivables
  if (op.decreaseInInventory > 0) inflow += op.decreaseInInventory
  if (op.increaseInPayables > 0) inflow += op.increaseInPayables
  if (op.otherNonCash > 0) inflow += op.otherNonCash

  return inflow
}

function calculateOperatingOutflow(cf: CashFlowStatement): number {
  const op = cf.operatingActivities
  if (!op) return 0
  let outflow = 0

  if (op.netIncome < 0) outflow += Math.abs(op.netIncome)
  if (op.increaseInReceivables < 0) outflow += Math.abs(op.increaseInReceivables)
  if (op.decreaseInInventory < 0) outflow += Math.abs(op.decreaseInInventory)
  if (op.increaseInPayables < 0) outflow += Math.abs(op.increaseInPayables)
  if (op.otherNonCash < 0) outflow += Math.abs(op.otherNonCash)

  return -outflow
}

export interface CashPositionDetail {
  category: string
  items: {
    name: string
    months: number[]
    annual: number
  }[]
  categoryTotal: number[]
  categoryAnnual: number
}

export function generateDetailedCashPosition(
  monthlyCashFlows: CashFlowStatement[],
  _beginningCash: number
): CashPositionDetail[] {
  const details: CashPositionDetail[] = []
  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

  const operatingDetail: CashPositionDetail = {
    category: '営業収支',
    items: [
      {
        name: '売上入金',
        months: months.map((m) => {
          const cf = monthlyCashFlows.find((c) => c.month === m)
          return cf ? Math.max(0, (cf.operatingActivities?.netIncome ?? 0) * 1.2) : 0
        }),
        annual: 0,
      },
      {
        name: 'その他営業収入',
        months: months.map((m) => {
          const cf = monthlyCashFlows.find((c) => c.month === m)
          return cf ? Math.max(0, cf.operatingActivities?.otherNonCash ?? 0) : 0
        }),
        annual: 0,
      },
      {
        name: '仕入支払',
        months: months.map((m) => {
          const cf = monthlyCashFlows.find((c) => c.month === m)
          return cf ? -Math.abs((cf.operatingActivities?.increaseInPayables ?? 0) * 0.8) : 0
        }),
        annual: 0,
      },
      {
        name: '人件費支払',
        months: months.map((m) => {
          const cf = monthlyCashFlows.find((c) => c.month === m)
          return cf ? -Math.abs((cf.operatingActivities?.netIncome ?? 0) * 0.3) : 0
        }),
        annual: 0,
      },
      {
        name: 'その他経費支払',
        months: months.map((m) => {
          const cf = monthlyCashFlows.find((c) => c.month === m)
          return cf ? -Math.abs((cf.operatingActivities?.netIncome ?? 0) * 0.1) : 0
        }),
        annual: 0,
      },
    ],
    categoryTotal: [],
    categoryAnnual: 0,
  }

  operatingDetail.items.forEach((item) => {
    item.annual = sumValues(item.months)
  })
  operatingDetail.categoryTotal = months.map((_, idx) =>
    sumValues(operatingDetail.items.map((item) => item.months[idx]))
  )
  operatingDetail.categoryAnnual = sumValues(operatingDetail.categoryTotal)

  details.push(operatingDetail)

  const investingDetail: CashPositionDetail = {
    category: '投資収支',
    items: [
      {
        name: '設備投資',
        months: months.map((m) => {
          const cf = monthlyCashFlows.find((c) => c.month === m)
          return cf ? (cf.investingActivities?.purchaseOfFixedAssets ?? 0) : 0
        }),
        annual: 0,
      },
      {
        name: '固定資産売却',
        months: months.map((m) => {
          const cf = monthlyCashFlows.find((c) => c.month === m)
          return cf ? (cf.investingActivities?.saleOfFixedAssets ?? 0) : 0
        }),
        annual: 0,
      },
    ],
    categoryTotal: [],
    categoryAnnual: 0,
  }

  investingDetail.items.forEach((item) => {
    item.annual = sumValues(item.months)
  })
  investingDetail.categoryTotal = months.map((_, idx) =>
    sumValues(investingDetail.items.map((item) => item.months[idx]))
  )
  investingDetail.categoryAnnual = sumValues(investingDetail.categoryTotal)

  details.push(investingDetail)

  const financingDetail: CashPositionDetail = {
    category: '財務収支',
    items: [
      {
        name: '借入金受入',
        months: months.map((m) => {
          const cf = monthlyCashFlows.find((c) => c.month === m)
          return cf ? (cf.financingActivities?.proceedsFromBorrowing ?? 0) : 0
        }),
        annual: 0,
      },
      {
        name: '借入金返済',
        months: months.map((m) => {
          const cf = monthlyCashFlows.find((c) => c.month === m)
          return cf ? -(cf.financingActivities?.repaymentOfBorrowing ?? 0) : 0
        }),
        annual: 0,
      },
      {
        name: '配当支払',
        months: months.map((m) => {
          const cf = monthlyCashFlows.find((c) => c.month === m)
          return cf ? -(cf.financingActivities?.dividendPaid ?? 0) : 0
        }),
        annual: 0,
      },
    ],
    categoryTotal: [],
    categoryAnnual: 0,
  }

  financingDetail.items.forEach((item) => {
    item.annual = sumValues(item.months)
  })
  financingDetail.categoryTotal = months.map((_, idx) =>
    sumValues(financingDetail.items.map((item) => item.months[idx]))
  )
  financingDetail.categoryAnnual = sumValues(financingDetail.categoryTotal)

  details.push(financingDetail)

  return details
}
