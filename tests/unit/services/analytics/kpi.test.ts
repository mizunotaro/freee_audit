import { describe, it, expect } from 'vitest'
import {
  calculateROE,
  calculateROA,
  calculateROS,
  calculateGrossMargin,
  calculateOperatingMargin,
  calculateEBITDA,
  calculateEBITDAMargin,
  calculateCurrentRatio,
  calculateQuickRatio,
  calculateDERatio,
  calculateEquityRatio,
  calculateRunway,
  calculateRunwayKPI,
  calculateAllKPIs,
} from '@/services/analytics/kpi'
import type { BalanceSheet, ProfitLoss } from '@/types'

const bs: BalanceSheet = {
  fiscalYear: 2024,
  month: 12,
  assets: {
    current: [
      { code: '1000', name: '現金', amount: 5000000 },
      { code: '1100', name: '売掛金', amount: 3000000 },
      { code: '1200', name: '棚卸資産', amount: 2000000 },
    ],
    fixed: [{ code: '2000', name: '建物', amount: 10000000 }],
    total: 20000000,
  },
  liabilities: {
    current: [
      { code: '3000', name: '買掛金', amount: 2000000 },
      { code: '3100', name: '未払金', amount: 1000000 },
    ],
    fixed: [{ code: '4000', name: '長期借入金', amount: 5000000 }],
    total: 8000000,
  },
  equity: {
    items: [
      { code: '5000', name: '資本金', amount: 5000000 },
      { code: '5100', name: '利益剰余金', amount: 7000000 },
    ],
    total: 12000000,
  },
  totalAssets: 20000000,
  totalLiabilities: 8000000,
  totalEquity: 12000000,
}

const pl: ProfitLoss = {
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
}

describe('analytics/kpi', () => {
  describe('calculateROE', () => {
    it('computes ROE as a percentage of net income over equity', () => {
      const result = calculateROE(1400000, 12000000)

      expect(result.name).toBe('ROE')
      expect(result.value).toBeCloseTo((1400000 / 12000000) * 100, 5)
      expect(result.unit).toBe('%')
      expect(result.format).toBe('percentage')
    })

    it('returns 0 when equity is 0 to avoid division by zero', () => {
      expect(calculateROE(1000, 0).value).toBe(0)
    })
  })

  describe('calculateROA', () => {
    it('computes ROA as a percentage of net income over total assets', () => {
      const result = calculateROA(1400000, 20000000)

      expect(result.name).toBe('ROA')
      expect(result.value).toBeCloseTo((1400000 / 20000000) * 100, 5)
    })

    it('returns 0 when total assets is 0', () => {
      expect(calculateROA(1000, 0).value).toBe(0)
    })
  })

  describe('calculateROS', () => {
    it('computes ROS as a percentage of operating income over revenue', () => {
      const result = calculateROS(2000000, 10000000)

      expect(result.name).toBe('ROS')
      expect(result.value).toBeCloseTo((2000000 / 10000000) * 100, 5)
    })

    it('returns 0 when revenue is 0', () => {
      expect(calculateROS(500, 0).value).toBe(0)
    })
  })

  describe('calculateGrossMargin', () => {
    it('computes gross margin as a percentage of gross profit over revenue', () => {
      const result = calculateGrossMargin(4000000, 10000000)

      expect(result.name).toBe('GrossMargin')
      expect(result.value).toBeCloseTo((4000000 / 10000000) * 100, 5)
    })

    it('returns 0 when revenue is 0', () => {
      expect(calculateGrossMargin(1000, 0).value).toBe(0)
    })
  })

  describe('calculateOperatingMargin', () => {
    it('computes operating margin as a percentage of operating income over revenue', () => {
      const result = calculateOperatingMargin(2000000, 10000000)

      expect(result.name).toBe('OperatingMargin')
      expect(result.value).toBeCloseTo((2000000 / 10000000) * 100, 5)
    })

    it('returns 0 when revenue is 0', () => {
      expect(calculateOperatingMargin(500, 0).value).toBe(0)
    })
  })

  describe('calculateEBITDA', () => {
    it('sums operating income, depreciation and amortization', () => {
      expect(calculateEBITDA(2000000, 300000, 100000)).toBe(2400000)
    })

    it('returns operating income when depreciation and amortization are 0', () => {
      expect(calculateEBITDA(1500000, 0, 0)).toBe(1500000)
    })

    it('handles negative operating income (loss)', () => {
      expect(calculateEBITDA(-500000, 200000, 0)).toBe(-300000)
    })
  })

  describe('calculateEBITDAMargin', () => {
    it('computes EBITDA margin as a percentage of EBITDA over revenue', () => {
      const result = calculateEBITDAMargin(2400000, 10000000)

      expect(result.name).toBe('EBITDAMargin')
      expect(result.value).toBeCloseTo((2400000 / 10000000) * 100, 5)
    })

    it('returns 0 when revenue is 0', () => {
      expect(calculateEBITDAMargin(2400000, 0).value).toBe(0)
    })
  })

  describe('calculateCurrentRatio', () => {
    it('computes current ratio as a percentage of current assets over current liabilities', () => {
      const result = calculateCurrentRatio(5000000, 3000000)

      expect(result.name).toBe('CurrentRatio')
      expect(result.value).toBeCloseTo((5000000 / 3000000) * 100, 5)
    })

    it('returns 0 when current liabilities is 0', () => {
      expect(calculateCurrentRatio(1000, 0).value).toBe(0)
    })
  })

  describe('calculateQuickRatio', () => {
    it('computes quick ratio excluding inventory from current assets', () => {
      const result = calculateQuickRatio(5000000, 2000000, 3000000)

      expect(result.name).toBe('QuickRatio')
      expect(result.value).toBeCloseTo(((5000000 - 2000000) / 3000000) * 100, 5)
    })

    it('returns 0 when current liabilities is 0', () => {
      expect(calculateQuickRatio(1000, 500, 0).value).toBe(0)
    })
  })

  describe('calculateDERatio', () => {
    it('computes D/E ratio as total liabilities over equity (ratio format)', () => {
      const result = calculateDERatio(8000000, 12000000)

      expect(result.name).toBe('DERatio')
      expect(result.value).toBeCloseTo(8000000 / 12000000, 5)
      expect(result.unit).toBe('')
      expect(result.format).toBe('ratio')
    })

    it('returns 0 when equity is 0', () => {
      expect(calculateDERatio(8000000, 0).value).toBe(0)
    })
  })

  describe('calculateEquityRatio', () => {
    it('computes equity ratio as a percentage of equity over total assets', () => {
      const result = calculateEquityRatio(12000000, 20000000)

      expect(result.name).toBe('EquityRatio')
      expect(result.value).toBeCloseTo((12000000 / 20000000) * 100, 5)
    })

    it('returns 0 when total assets is 0', () => {
      expect(calculateEquityRatio(1000, 0).value).toBe(0)
    })
  })

  describe('calculateRunway', () => {
    it('computes burn rate and finite runway when expenses exceed revenue', () => {
      const runway = calculateRunway(1000000, 100000, 300000)

      expect(runway.monthlyBurnRate).toBe(200000)
      expect(runway.runwayMonths).toBe(Math.floor(1000000 / 200000))
      expect(runway.currentCash).toBe(1000000)
      expect(runway.zeroCashDate).toBeInstanceOf(Date)
    })

    it('returns Infinity runway when there is no cash burn', () => {
      const runway = calculateRunway(1000000, 300000, 300000)

      expect(runway.monthlyBurnRate).toBe(0)
      expect(runway.runwayMonths).toBe(Infinity)
      expect(runway.zeroCashDate).toBeInstanceOf(Date)
    })

    it('derives optimistic and pessimistic scenarios from the base burn rate', () => {
      const runway = calculateRunway(1000000, 100000, 300000)
      const burn = 200000

      expect(runway.scenarios.realistic.burnRate).toBe(burn)
      expect(runway.scenarios.realistic.runwayMonths).toBe(Math.floor(1000000 / burn))
      expect(runway.scenarios.optimistic.burnRate).toBeCloseTo(burn * 0.8, 5)
      expect(runway.scenarios.optimistic.runwayMonths).toBe(Math.floor(1000000 / (burn * 0.8)))
      expect(runway.scenarios.pessimistic.burnRate).toBeCloseTo(burn * 1.2, 5)
      expect(runway.scenarios.pessimistic.runwayMonths).toBe(Math.floor(1000000 / (burn * 1.2)))
    })

    it('uses Infinity runway for all scenarios when there is no burn', () => {
      const runway = calculateRunway(500000, 200000, 200000)

      expect(runway.scenarios.realistic.runwayMonths).toBe(Infinity)
      expect(runway.scenarios.optimistic.runwayMonths).toBe(Infinity)
      expect(runway.scenarios.pessimistic.runwayMonths).toBe(Infinity)
    })
  })

  describe('calculateRunwayKPI', () => {
    it('exposes the runway months as a KPI result', () => {
      const runway = calculateRunway(1000000, 100000, 300000)
      const kpi = calculateRunwayKPI(runway)

      expect(kpi.name).toBe('Runway')
      expect(kpi.value).toBe(runway.runwayMonths)
      expect(kpi.unit).toBe('ヶ月')
      expect(kpi.format).toBe('months')
    })

    it('caps an infinite runway at 999 in the KPI value', () => {
      const runway = calculateRunway(1000000, 300000, 300000)
      const kpi = calculateRunwayKPI(runway)

      expect(kpi.value).toBe(999)
    })
  })

  describe('calculateAllKPIs', () => {
    it('returns all 10 core KPIs derived from a balance sheet and P&L', () => {
      const kpis = calculateAllKPIs(bs, pl, 300000, 0)

      expect(kpis).toHaveLength(10)
      const names = kpis.map((k) => k.name)
      expect(names).toEqual([
        'ROE',
        'ROA',
        'ROS',
        'GrossMargin',
        'OperatingMargin',
        'EBITDAMargin',
        'CurrentRatio',
        'QuickRatio',
        'DERatio',
        'EquityRatio',
      ])
    })

    it('includes the EBITDA margin derived from operating income plus depreciation', () => {
      const ebitdaMargin = calculateAllKPIs(bs, pl, 300000, 0).find(
        (k) => k.name === 'EBITDAMargin'
      )

      expect(ebitdaMargin?.value).toBeCloseTo(((2000000 + 300000) / 10000000) * 100, 5)
    })

    it('defaults depreciation and amortization to 0', () => {
      const kpis = calculateAllKPIs(bs, pl)
      const ebitdaMargin = kpis.find((k) => k.name === 'EBITDAMargin')

      expect(ebitdaMargin?.value).toBeCloseTo((2000000 / 10000000) * 100, 5)
    })

    it('matches the standalone ROE calculation for the same inputs', () => {
      const roeFromAll = calculateAllKPIs(bs, pl, 300000, 0).find((k) => k.name === 'ROE')

      expect(roeFromAll?.value).toBe(calculateROE(pl.netIncome, bs.totalEquity).value)
    })
  })
})
