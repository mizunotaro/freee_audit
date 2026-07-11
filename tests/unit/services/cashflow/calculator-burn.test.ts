import { describe, it, expect } from 'vitest'
import { calculateFreeCashFlow, deriveBurnRunRate } from '@/services/cashflow/calculator'
import type { CashFlowStatement } from '@/types'

function cf(
  month: number,
  fields: {
    netIncome?: number
    depreciation?: number
    amortization?: number
    deferredTaxChange?: number
    increaseInReceivables?: number
    decreaseInInventory?: number
    increaseInPayables?: number
    otherNonCash?: number
  }
): CashFlowStatement {
  const op = {
    netIncome: fields.netIncome ?? 0,
    depreciation: fields.depreciation ?? 0,
    amortization: fields.amortization ?? 0,
    deferredTaxChange: fields.deferredTaxChange ?? 0,
    increaseInReceivables: fields.increaseInReceivables ?? 0,
    decreaseInInventory: fields.decreaseInInventory ?? 0,
    increaseInPayables: fields.increaseInPayables ?? 0,
    otherNonCash: fields.otherNonCash ?? 0,
  }
  const netCashFromOperating =
    op.netIncome +
    op.depreciation +
    op.amortization +
    op.deferredTaxChange +
    op.increaseInReceivables +
    op.decreaseInInventory +
    op.increaseInPayables +
    op.otherNonCash
  return {
    fiscalYear: 2024,
    month,
    operatingActivities: { ...op, netCashFromOperating },
    investingActivities: {
      purchaseOfFixedAssets: 0,
      saleOfFixedAssets: 0,
      netCashFromInvesting: 0,
    },
    financingActivities: {
      proceedsFromBorrowing: 0,
      repaymentOfBorrowing: 0,
      dividendPaid: 0,
      interestPaid: 0,
      netCashFromFinancing: 0,
    },
    netChangeInCash: netCashFromOperating,
    beginningCash: 0,
    endingCash: netCashFromOperating,
  }
}

describe('deriveBurnRunRate', () => {
  it('partitions operating components by sign into inflow/outflow', () => {
    // netIncome +500 (inflow), depreciation +200 (inflow), increaseInReceivables -150 (outflow)
    const rate = deriveBurnRunRate([
      cf(1, { netIncome: 500, depreciation: 200, increaseInReceivables: -150 }),
    ])
    expect(rate.dataPoints).toBe(1)
    const m = rate.monthly[0]
    // inflow = 500 + 200 = 700; outflow = 150; net = 550
    expect(m.operatingNet).toBe(550)
    expect(m.grossBurn).toBe(150)
    expect(m.netBurn).toBe(0) // net positive → not burning
  })

  it('net burn is max(0, -net) — zero when cash-positive, |net| when burning', () => {
    const rate = deriveBurnRunRate([
      cf(1, { netIncome: 100 }), // net +100 → burn 0
      cf(2, { netIncome: -300, depreciation: 50 }), // net -250 → burn 250
    ])
    expect(rate.monthly[0].netBurn).toBe(0)
    expect(rate.monthly[1].netBurn).toBe(250)
    expect(rate.monthly[1].grossBurn).toBe(300) // only the -300 is outflow; +50 dep is inflow
  })

  it('sign-split reconciles exactly to netCashFromOperating', () => {
    const stmt = cf(3, {
      netIncome: -400,
      depreciation: 120,
      amortization: 30,
      deferredTaxChange: -45,
      increaseInReceivables: -60,
      decreaseInInventory: 25,
      increaseInPayables: 80,
      otherNonCash: -15,
    })
    const rate = deriveBurnRunRate([stmt])
    const m = rate.monthly[0]
    // inflow − outflow must equal the reported net operating CF.
    const reported = stmt.operatingActivities!.netCashFromOperating
    const reconstructed = Math.max(0, m.grossBurn + m.operatingNet) - m.grossBurn // inflow − outflow
    expect(m.operatingNet).toBe(reconstructed)
    expect(m.operatingNet).toBe(reported)
  })

  it('averages across months', () => {
    const rate = deriveBurnRunRate([cf(1, { netIncome: -1000 }), cf(2, { netIncome: -2000 })])
    expect(rate.dataPoints).toBe(2)
    expect(rate.avgGrossBurn).toBe(1500) // mean(1000, 2000)
    expect(rate.avgNetBurn).toBe(1500)
    expect(rate.avgInflow).toBe(0)
  })

  it('handles empty input without throwing (returns zeros, 0 points)', () => {
    const rate = deriveBurnRunRate([])
    expect(rate.dataPoints).toBe(0)
    expect(rate.avgNetBurn).toBe(0)
    expect(rate.monthly).toEqual([])
  })

  it('falls back to reported net when no operatingActivities breakdown', () => {
    const stmt: CashFlowStatement = {
      fiscalYear: 2024,
      month: 1,
      operating: { items: [], netCashFromOperating: -500 },
      netChangeInCash: -500,
      beginningCash: 0,
      endingCash: -500,
    }
    const rate = deriveBurnRunRate([stmt])
    expect(rate.monthly[0].operatingNet).toBe(-500)
    expect(rate.monthly[0].netBurn).toBe(500)
    expect(rate.monthly[0].grossBurn).toBe(0) // can't split without breakdown
  })
})

describe('calculateFreeCashFlow (regression)', () => {
  it('operating + investing', () => {
    const stmt = cf(1, { netIncome: 800 })
    stmt.investingActivities!.netCashFromInvesting = -300
    expect(calculateFreeCashFlow(stmt)).toBe(500)
  })
})
