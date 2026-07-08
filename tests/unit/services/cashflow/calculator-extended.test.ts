import { describe, it, expect } from 'vitest'
import { calculateCashFlow } from '@/services/cashflow/calculator'
import type { BalanceSheet, ProfitLoss } from '@/types'

// Minimal PL: netIncome + depreciation only. nonOperatingExpenses carries the
// interest line that the indirect method must reclassify by accounting standard.
function makePL(overrides: Partial<ProfitLoss> = {}): ProfitLoss {
  return {
    fiscalYear: 2024,
    month: 3,
    revenue: [],
    costOfSales: [],
    grossProfit: 0,
    grossProfitMargin: 0,
    sgaExpenses: [],
    operatingIncome: 0,
    operatingMargin: 0,
    nonOperatingIncome: [],
    nonOperatingExpenses: [],
    ordinaryIncome: 0,
    extraordinaryIncome: [],
    extraordinaryLoss: [],
    incomeBeforeTax: 0,
    incomeTax: 0,
    netIncome: 1000,
    depreciation: 0,
    ...overrides,
  }
}

// BS holding only cash: every BS-driven CF delta (receivables, inventory,
// payables, deferred tax, prepaid/accrued, fixed assets, borrowing) is 0,
// so operating CF reduces to netIncome + depreciation + interestAdjustment.
function cashOnlyBS(cash: number): BalanceSheet {
  return {
    fiscalYear: 2024,
    month: 3,
    assets: {
      current: [{ code: '100', name: '現金及び預金', amount: cash }],
      fixed: [],
      total: cash,
    },
    liabilities: { current: [], fixed: [], total: 0 },
    equity: { items: [{ code: '500', name: '資本金', amount: cash }], total: cash },
    totalAssets: cash,
    totalLiabilities: 0,
    totalEquity: cash,
  }
}

const plWithInterest = makePL({
  netIncome: 1000,
  nonOperatingExpenses: [{ code: '810', name: '支払利息', amount: 200 }],
})

describe('calculateCashFlow — interest classification', () => {
  it('JGAAP (default) moves interest out of operating and into financing', () => {
    const cf = calculateCashFlow(plWithInterest, cashOnlyBS(5000), null)

    // interest (200) added back to operating
    expect(cf.operatingActivities!.netCashFromOperating).toBe(1200)
    expect(cf.operatingActivities!.netIncome).toBe(1000)
    // interest shown as a financing outflow
    expect(cf.financingActivities!.interestPaid).toBe(200)
    expect(cf.financingActivities!.netCashFromFinancing).toBe(-200)
    expect(cf.investingActivities!.netCashFromInvesting).toBe(0)
    // beginning 0 (no previous BS), ending = current cash
    expect(cf.beginningCash).toBe(0)
    expect(cf.endingCash).toBe(5000)
  })

  it('USGAAP keeps interest in operating (no financing interestPaid)', () => {
    const cf = calculateCashFlow(plWithInterest, cashOnlyBS(5000), null, { standard: 'USGAAP' })

    expect(cf.operatingActivities!.netCashFromOperating).toBe(1000)
    expect(cf.financingActivities!.interestPaid).toBe(0)
    expect(cf.financingActivities!.netCashFromFinancing).toBe(0)
  })

  it('IFRS classifies interest as financing (same treatment as JGAAP here)', () => {
    const cf = calculateCashFlow(plWithInterest, cashOnlyBS(5000), null, { standard: 'IFRS' })

    expect(cf.operatingActivities!.netCashFromOperating).toBe(1200)
    expect(cf.financingActivities!.interestPaid).toBe(200)
    expect(cf.financingActivities!.netCashFromFinancing).toBe(-200)
  })

  it('interestPaidAsOperating=true overrides the standard toward operating', () => {
    const cf = calculateCashFlow(plWithInterest, cashOnlyBS(5000), null, {
      standard: 'JGAAP',
      interestPaidAsOperating: true,
    })

    expect(cf.operatingActivities!.netCashFromOperating).toBe(1000)
    expect(cf.financingActivities!.interestPaid).toBe(0)
  })

  it('interestPaidAsOperating=false overrides the standard toward financing', () => {
    const cf = calculateCashFlow(plWithInterest, cashOnlyBS(5000), null, {
      standard: 'USGAAP',
      interestPaidAsOperating: false,
    })

    expect(cf.operatingActivities!.netCashFromOperating).toBe(1200)
    expect(cf.financingActivities!.interestPaid).toBe(200)
  })

  it('sums every interest-named expense and ignores unrelated non-operating expenses', () => {
    const pl = makePL({
      netIncome: 1000,
      nonOperatingExpenses: [
        { code: '810', name: '支払利息', amount: 100 },
        { code: '812', name: '社債利息', amount: 50 },
        { code: '813', name: '有価証券売却損', amount: 999 }, // no '利息' → ignored
      ],
    })

    const cf = calculateCashFlow(pl, cashOnlyBS(5000), null) // JGAAP default

    // interestExpense = 100 (支払利息) + 50 (社債利息) = 150
    expect(cf.financingActivities!.interestPaid).toBe(150)
    expect(cf.operatingActivities!.netCashFromOperating).toBe(1150)
  })

  it('does not reclassify interest when there is none', () => {
    const cf = calculateCashFlow(makePL({ netIncome: 1000 }), cashOnlyBS(5000), null)

    expect(cf.operatingActivities!.netCashFromOperating).toBe(1000)
    expect(cf.financingActivities!.interestPaid).toBe(0)
  })
})

describe('calculateCashFlow — depreciation add-back', () => {
  it('adds depreciation back to operating cash flow', () => {
    const cf = calculateCashFlow(
      makePL({ netIncome: 1000, depreciation: 400 }),
      cashOnlyBS(5000),
      null
    )

    // 1000 + 400 depreciation, no interest reclassification (none present)
    expect(cf.operatingActivities!.netCashFromOperating).toBe(1400)
    expect(cf.operatingActivities!.depreciation).toBe(400)
  })

  it('falls back to 0 depreciation when the field is missing', () => {
    const pl = makePL({ netIncome: 1000, depreciation: undefined as unknown as number })
    const cf = calculateCashFlow(pl, cashOnlyBS(5000), null)

    expect(cf.operatingActivities!.depreciation).toBe(0)
    expect(cf.operatingActivities!.netCashFromOperating).toBe(1000)
  })
})

describe('calculateCashFlow — beginning/ending cash', () => {
  it('uses previous BS cash as beginning when a previous BS is supplied', () => {
    const cf = calculateCashFlow(makePL({ netIncome: 0 }), cashOnlyBS(5000), cashOnlyBS(4000))

    expect(cf.beginningCash).toBe(4000)
    expect(cf.endingCash).toBe(5000)
  })

  it('treats a null previous BS as beginning cash 0', () => {
    const cf = calculateCashFlow(makePL({ netIncome: 0 }), cashOnlyBS(5000), null)

    expect(cf.beginningCash).toBe(0)
    expect(cf.endingCash).toBe(5000)
  })
})
