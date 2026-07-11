import { describe, it, expect, beforeEach } from 'vitest'
import { calculateExtendedKPIs, type KPIAdvice } from '@/services/analytics/financial-kpi'
import { kpiCache } from '@/lib/cache'
import type { BalanceSheet, ProfitLoss, CashFlowStatement } from '@/types'

type ExtendedOptions = Parameters<typeof calculateExtendedKPIs>[4]

function basePL(overrides: Partial<ProfitLoss> = {}): ProfitLoss {
  return {
    fiscalYear: 2024,
    month: 12,
    revenue: [{ code: 'R001', name: '売上高', amount: 10000000 }],
    costOfSales: [{ code: 'C001', name: '売上原価', amount: 6000000 }],
    grossProfit: 4000000,
    grossProfitMargin: 40,
    sgaExpenses: [],
    operatingIncome: 2000000,
    operatingMargin: 20,
    nonOperatingIncome: [],
    nonOperatingExpenses: [],
    ordinaryIncome: 2000000,
    extraordinaryIncome: [],
    extraordinaryLoss: [],
    incomeBeforeTax: 2000000,
    incomeTax: 600000,
    netIncome: 1400000,
    depreciation: 300000,
    ...overrides,
  }
}

function baseCF(): CashFlowStatement {
  return {
    fiscalYear: 2024,
    month: 12,
    operating: { items: [], netCashFromOperating: 2000000 },
    investing: { items: [], netCashFromInvesting: 0 },
    financing: { items: [], netCashFromFinancing: 0 },
    netChangeInCash: 2000000,
    beginningCash: 3000000,
    endingCash: 5000000,
  }
}

// Balanced, low-debt sheet with ample cash -> no runway/D/E/DSCR advice.
function baseBS(): BalanceSheet {
  return {
    fiscalYear: 2024,
    month: 12,
    assets: {
      current: [{ code: '1000', name: '現金', amount: 15000000 }],
      fixed: [],
      total: 15000000,
    },
    liabilities: {
      current: [{ code: '3000', name: '買掛金', amount: 2000000 }],
      fixed: [{ code: '4000', name: '長期負債', amount: 1000000 }],
      total: 3000000,
    },
    equity: {
      items: [{ code: '5000', name: '資本金', amount: 12000000 }],
      total: 12000000,
    },
    totalAssets: 15000000,
    totalLiabilities: 3000000,
    totalEquity: 12000000,
  }
}

function prevPL(revenue: number, netIncome = 1000000): ProfitLoss {
  return basePL({
    fiscalYear: 2023,
    revenue: [{ code: 'R001', name: '売上高', amount: revenue }],
    netIncome,
  })
}

function adviceFor(
  bs: BalanceSheet,
  pl: ProfitLoss,
  previousPL: ProfitLoss | undefined,
  options: ExtendedOptions
): KPIAdvice[] {
  return calculateExtendedKPIs(bs, pl, baseCF(), previousPL, options).advice
}

describe('analytics/financial-kpi — generateKPIAdvice thresholds', () => {
  beforeEach(() => kpiCache.clear())

  it('emits no advice for a healthy baseline (all metrics in safe territory)', () => {
    const advice = adviceFor(baseBS(), basePL(), prevPL(8000000), undefined)
    expect(advice).toEqual([])
  })

  describe('Runway', () => {
    function lossBS(cash: number): BalanceSheet {
      return {
        fiscalYear: 2024,
        month: 12,
        assets: { current: [{ code: '1000', name: '現金', amount: cash }], fixed: [], total: cash },
        liabilities: { current: [], fixed: [], total: 0 },
        equity: { items: [{ code: '5000', name: '資本金', amount: cash }], total: cash },
        totalAssets: cash,
        totalLiabilities: 0,
        totalEquity: cash,
      }
    }

    it('is critical when runway is under 6 months', () => {
      // burnRate = abs(netIncome) = 1,000,000; cash 5,000,000 -> runway 5
      const advice = adviceFor(
        lossBS(5000000),
        basePL({ netIncome: -1000000 }),
        prevPL(8000000),
        undefined
      )
      const runway = advice.find((a) => a.kpiName === 'Runway')
      expect(runway).toBeDefined()
      expect(runway?.status).toBe('critical')
      expect(runway?.actionItems.length).toBeGreaterThan(0)
    })

    it('is warning when runway is between 6 and 11 months', () => {
      const advice = adviceFor(
        lossBS(7000000),
        basePL({ netIncome: -1000000 }),
        prevPL(8000000),
        undefined
      )
      const runway = advice.find((a) => a.kpiName === 'Runway')
      expect(runway).toBeDefined()
      expect(runway?.status).toBe('warning')
    })

    it('is absent when runway reaches 12 months or more', () => {
      const advice = adviceFor(
        lossBS(15000000),
        basePL({ netIncome: -1000000 }),
        prevPL(8000000),
        undefined
      )
      expect(advice.find((a) => a.kpiName === 'Runway')).toBeUndefined()
    })
  })

  describe('LTV/CAC ratio', () => {
    // revenue 10,000,000 / totalCustomers 100 -> avgRev 100,000; churn 5% -> ltv 2,000,000
    it('is critical when the ratio is below 3', () => {
      const advice = adviceFor(baseBS(), basePL(), prevPL(8000000), {
        marketingSpend: 10000000,
        newCustomers: 10,
        totalCustomers: 100,
        churnedCustomers: 5,
      })
      const ltvCac = advice.find((a) => a.kpiName === 'LTV/CAC比率')
      expect(ltvCac).toBeDefined()
      expect(ltvCac?.status).toBe('critical')
    })

    it('is warning when the ratio is between 3 and 5', () => {
      const advice = adviceFor(baseBS(), basePL(), prevPL(8000000), {
        marketingSpend: 5000000,
        newCustomers: 10,
        totalCustomers: 100,
        churnedCustomers: 5,
      })
      const ltvCac = advice.find((a) => a.kpiName === 'LTV/CAC比率')
      expect(ltvCac).toBeDefined()
      expect(ltvCac?.status).toBe('warning')
    })

    it('is absent when the ratio reaches 5 or more', () => {
      const advice = adviceFor(baseBS(), basePL(), prevPL(8000000), {
        marketingSpend: 4000000,
        newCustomers: 10,
        totalCustomers: 100,
        churnedCustomers: 5,
      })
      expect(advice.find((a) => a.kpiName === 'LTV/CAC比率')).toBeUndefined()
    })
  })

  describe('Rule of 40', () => {
    // previousPL revenue equals current -> growth 0; ruleOf40 = 0 + grossMargin
    it('is critical when Rule of 40 is below 20', () => {
      const advice = adviceFor(
        baseBS(),
        basePL({ grossProfitMargin: 15 }),
        prevPL(10000000),
        undefined
      )
      const ruleOf40 = advice.find((a) => a.kpiName === 'Rule of 40')
      expect(ruleOf40).toBeDefined()
      expect(ruleOf40?.status).toBe('critical')
    })

    it('is warning when Rule of 40 is between 20 and 40', () => {
      const advice = adviceFor(
        baseBS(),
        basePL({ grossProfitMargin: 30 }),
        prevPL(10000000),
        undefined
      )
      const ruleOf40 = advice.find((a) => a.kpiName === 'Rule of 40')
      expect(ruleOf40).toBeDefined()
      expect(ruleOf40?.status).toBe('warning')
    })

    it('is absent when Rule of 40 reaches 40 or more', () => {
      const advice = adviceFor(
        baseBS(),
        basePL({ grossProfitMargin: 40 }),
        prevPL(10000000),
        undefined
      )
      expect(advice.find((a) => a.kpiName === 'Rule of 40')).toBeUndefined()
    })
  })

  describe('Growth rate', () => {
    it('is critical when revenue growth is below 10%', () => {
      const advice = adviceFor(baseBS(), basePL(), prevPL(10000000), undefined)
      const growth = advice.find((a) => a.kpiName === '成長率')
      expect(growth).toBeDefined()
      expect(growth?.status).toBe('critical')
    })

    it('is warning when revenue growth is between 10% and 20%', () => {
      const advice = adviceFor(baseBS(), basePL(), prevPL(9000000), undefined)
      const growth = advice.find((a) => a.kpiName === '成長率')
      expect(growth).toBeDefined()
      expect(growth?.status).toBe('warning')
    })

    it('is absent when revenue growth reaches 20% or more', () => {
      const advice = adviceFor(baseBS(), basePL(), prevPL(8000000), undefined)
      expect(advice.find((a) => a.kpiName === '成長率')).toBeUndefined()
    })
  })

  describe('DSCR', () => {
    // ebitda = operatingIncome 2,000,000 + depreciation 300,000 = 2,300,000
    it('is critical when DSCR is below 1.0', () => {
      const advice = adviceFor(baseBS(), basePL(), prevPL(8000000), {
        interestExpense: 2000000,
        principalPayments: 1000000,
      })
      const dscr = advice.find((a) => a.kpiName === 'DSCR')
      expect(dscr).toBeDefined()
      expect(dscr?.status).toBe('critical')
    })

    it('is warning when DSCR is between 1.0 and 1.2', () => {
      const advice = adviceFor(baseBS(), basePL(), prevPL(8000000), {
        interestExpense: 1000000,
        principalPayments: 1000000,
      })
      const dscr = advice.find((a) => a.kpiName === 'DSCR')
      expect(dscr).toBeDefined()
      expect(dscr?.status).toBe('warning')
    })

    it('is absent when DSCR reaches 1.2 or more', () => {
      const advice = adviceFor(baseBS(), basePL(), prevPL(8000000), {
        interestExpense: 500000,
        principalPayments: 500000,
      })
      expect(advice.find((a) => a.kpiName === 'DSCR')).toBeUndefined()
    })
  })

  describe('Debt-to-equity ratio', () => {
    function leveredBS(totalDebt: number, equity: number): BalanceSheet {
      return {
        fiscalYear: 2024,
        month: 12,
        assets: {
          current: [{ code: '1000', name: '現金', amount: totalDebt + equity }],
          fixed: [],
          total: totalDebt + equity,
        },
        liabilities: {
          // '長期負債' avoids the 借入 token so principal payments stay 0 (DSCR stays clear)
          current: [{ code: '3000', name: '流動負債', amount: Math.floor(totalDebt / 2) }],
          fixed: [
            { code: '4000', name: '長期負債', amount: totalDebt - Math.floor(totalDebt / 2) },
          ],
          total: totalDebt,
        },
        equity: { items: [{ code: '5000', name: '資本金', amount: equity }], total: equity },
        totalAssets: totalDebt + equity,
        totalLiabilities: totalDebt,
        totalEquity: equity,
      }
    }

    it('is critical when D/E exceeds 3.0', () => {
      const advice = adviceFor(leveredBS(15000000, 4000000), basePL(), prevPL(8000000), undefined)
      const de = advice.find((a) => a.kpiName === 'D/E比率')
      expect(de).toBeDefined()
      expect(de?.status).toBe('critical')
    })

    it('is warning when D/E is between 2.0 and 3.0', () => {
      const advice = adviceFor(leveredBS(10000000, 4000000), basePL(), prevPL(8000000), undefined)
      const de = advice.find((a) => a.kpiName === 'D/E比率')
      expect(de).toBeDefined()
      expect(de?.status).toBe('warning')
    })

    it('is absent when D/E is 2.0 or below', () => {
      const advice = adviceFor(leveredBS(8000000, 5000000), basePL(), prevPL(8000000), undefined)
      expect(advice.find((a) => a.kpiName === 'D/E比率')).toBeUndefined()
    })
  })

  describe('Gross profit margin', () => {
    it('is critical when gross margin is below 20%', () => {
      const advice = adviceFor(
        baseBS(),
        basePL({ grossProfitMargin: 15 }),
        prevPL(8000000),
        undefined
      )
      const gross = advice.find((a) => a.kpiName === '売上総利益率')
      expect(gross).toBeDefined()
      expect(gross?.status).toBe('critical')
    })

    it('is warning when gross margin is between 20% and 30%', () => {
      const advice = adviceFor(
        baseBS(),
        basePL({ grossProfitMargin: 25 }),
        prevPL(8000000),
        undefined
      )
      const gross = advice.find((a) => a.kpiName === '売上総利益率')
      expect(gross).toBeDefined()
      expect(gross?.status).toBe('warning')
    })

    it('is absent when gross margin reaches 30% or more', () => {
      const advice = adviceFor(
        baseBS(),
        basePL({ grossProfitMargin: 40 }),
        prevPL(8000000),
        undefined
      )
      expect(advice.find((a) => a.kpiName === '売上総利益率')).toBeUndefined()
    })
  })
})
