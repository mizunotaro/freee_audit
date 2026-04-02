import { describe, it, expect } from 'vitest'
import { calculateCashFlow, calculateFreeCashFlow } from '@/services/cashflow/calculator'
import type { BalanceSheet, ProfitLoss, CashFlowStatement } from '@/types'

function makePL(overrides: Partial<ProfitLoss> = {}): ProfitLoss {
  return {
    fiscalYear: 2024,
    month: 3,
    revenue: [{ code: '400', name: '売上', amount: 10000 }],
    costOfSales: [{ code: '500', name: '売上原価', amount: 4000 }],
    grossProfit: 6000,
    grossProfitMargin: 0.6,
    sgaExpenses: [],
    operatingIncome: 4000,
    operatingMargin: 0.4,
    nonOperatingIncome: [],
    nonOperatingExpenses: [],
    ordinaryIncome: 4000,
    extraordinaryIncome: [],
    extraordinaryLoss: [],
    incomeBeforeTax: 4000,
    incomeTax: 1000,
    netIncome: 3000,
    depreciation: 500,
    ...overrides,
  }
}

function makeBS(overrides: Partial<BalanceSheet> = {}): BalanceSheet {
  return {
    fiscalYear: 2024,
    month: 3,
    assets: {
      current: [
        { code: '100', name: '現金及び預金', amount: 5000 },
        { code: '110', name: '売掛金', amount: 2000 },
        { code: '120', name: '棚卸資産', amount: 1000 },
      ],
      fixed: [{ code: '200', name: '建物', amount: 8000 }],
      total: 16000,
    },
    liabilities: {
      current: [{ code: '300', name: '買掛金', amount: 1500 }],
      fixed: [{ code: '400', name: '長期借入金', amount: 3000 }],
      total: 4500,
    },
    equity: {
      items: [
        { code: '500', name: '資本金', amount: 5000 },
        { code: '510', name: '利益剰余金', amount: 6500 },
      ],
      total: 11500,
    },
    totalAssets: 16000,
    totalLiabilities: 4500,
    totalEquity: 11500,
    ...overrides,
  }
}

describe('calculateCashFlow', () => {
  it('should calculate cash flow with previous BS', function () {
    const pl = makePL()
    const currentBS = makeBS()
    const previousBS = makeBS({
      assets: {
        current: [
          { code: '100', name: '現金及び預金', amount: 4000 },
          { code: '110', name: '売掛金', amount: 1500 },
          { code: '120', name: '棚卸資産', amount: 800 },
        ],
        fixed: [{ code: '200', name: '建物', amount: 7000 }],
        total: 13300,
      },
      liabilities: {
        current: [{ code: '300', name: '買掛金', amount: 1000 }],
        fixed: [{ code: '400', name: '長期借入金', amount: 2500 }],
        total: 3500,
      },
    })

    const cf = calculateCashFlow(pl, currentBS, previousBS)

    expect(cf.fiscalYear).toBe(2024)
    expect(cf.month).toBe(3)
    expect(cf.operatingActivities).toBeDefined()
    expect(cf.investingActivities).toBeDefined()
    expect(cf.financingActivities).toBeDefined()
    expect(cf.netChangeInCash).toBeDefined()
    expect(cf.beginningCash).toBe(4000)
    expect(cf.endingCash).toBe(5000)
  })

  it('should calculate cash flow without previous BS', function () {
    const pl = makePL()
    const currentBS = makeBS()

    const cf = calculateCashFlow(pl, currentBS, null)

    expect(cf.beginningCash).toBe(0)
    expect(cf.endingCash).toBe(5000)
    expect(cf.operatingActivities!.netCashFromOperating).toBeDefined()
  })

  it('should handle zero net income', function () {
    const pl = makePL({ netIncome: 0, depreciation: 0 })
    const currentBS = makeBS()

    const cf = calculateCashFlow(pl, currentBS, null)

    expect(cf.operatingActivities!.netIncome).toBe(0)
  })

  it('should use JGAAP by default', function () {
    const pl = makePL()
    const currentBS = makeBS()

    const cf = calculateCashFlow(pl, currentBS, null)

    expect(cf.operatingActivities).toBeDefined()
  })
})

describe('calculateFreeCashFlow', () => {
  it('should calculate FCF as operating + investing', function () {
    const cf: CashFlowStatement = {
      fiscalYear: 2024,
      month: 3,
      operatingActivities: {
        netIncome: 3000,
        depreciation: 500,
        amortization: 0,
        deferredTaxChange: 0,
        increaseInReceivables: 0,
        decreaseInInventory: 0,
        increaseInPayables: 0,
        otherNonCash: 0,
        netCashFromOperating: 3500,
      },
      investingActivities: {
        purchaseOfFixedAssets: -1000,
        saleOfFixedAssets: 0,
        netCashFromInvesting: -1000,
      },
      financingActivities: {
        proceedsFromBorrowing: 0,
        repaymentOfBorrowing: 500,
        dividendPaid: 0,
        interestPaid: 0,
        netCashFromFinancing: -500,
      },
      netChangeInCash: 2000,
      beginningCash: 3000,
      endingCash: 5000,
    }

    const fcf = calculateFreeCashFlow(cf)

    expect(fcf).toBe(2500)
  })
})
