import { describe, it, expect, beforeEach } from 'vitest'
import {
  INDUSTRY_BENCHMARKS,
  calculateFinancialKPIs,
  calculateExtendedKPIs,
  getKPIBenchmarks,
} from '@/services/analytics/financial-kpi'
import { kpiCache } from '@/lib/cache'
import type {
  BalanceSheet,
  ProfitLoss,
  CashFlowStatement,
  FinancialKPIs,
  IndustrySector,
} from '@/types'

function buildKPIs(overrides: {
  roe?: number
  roa?: number
  grossProfitMargin?: number
  operatingMargin?: number
  ebitdaMargin?: number
  currentRatio?: number
  debtToEquity?: number
  equityRatio?: number
}): FinancialKPIs {
  return {
    fiscalYear: 2024,
    month: 12,
    profitability: {
      roe: overrides.roe ?? 0,
      roa: overrides.roa ?? 0,
      grossProfitMargin: overrides.grossProfitMargin ?? 0,
      operatingMargin: overrides.operatingMargin ?? 0,
      ros: 0,
      ebitdaMargin: overrides.ebitdaMargin ?? 0,
    },
    efficiency: {
      assetTurnover: 0,
      inventoryTurnover: 0,
      receivablesTurnover: 0,
      payablesTurnover: 0,
    },
    safety: {
      currentRatio: overrides.currentRatio ?? 0,
      quickRatio: 0,
      debtToEquity: overrides.debtToEquity ?? 0,
      equityRatio: overrides.equityRatio ?? 0,
    },
    growth: { revenueGrowth: 0, profitGrowth: 0 },
    cashFlow: { fcf: 0, fcfMargin: 0 },
  }
}

function makeCF(netChange = 2000000): CashFlowStatement {
  return {
    fiscalYear: 2024,
    month: 12,
    operating: { items: [], netCashFromOperating: 2000000 },
    investing: { items: [], netCashFromInvesting: 0 },
    financing: { items: [], netCashFromFinancing: 0 },
    netChangeInCash: netChange,
    beginningCash: 3000000,
    endingCash: 5000000,
  }
}

function makePL(opts: { grossProfitMargin?: number; netIncome?: number }): ProfitLoss {
  return {
    fiscalYear: 2024,
    month: 12,
    revenue: [{ code: 'R001', name: '売上高', amount: 10000000 }],
    costOfSales: [{ code: 'C001', name: '売上原価', amount: 6000000 }],
    grossProfit: 4000000,
    grossProfitMargin: opts.grossProfitMargin ?? 40,
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
    netIncome: opts.netIncome ?? 1400000,
    depreciation: 300000,
  }
}

const SECTORS: IndustrySector[] = [
  'manufacturing',
  'retail',
  'service',
  'technology',
  'finance',
  'real_estate',
  'construction',
  'other',
]

describe('analytics/financial-kpi — INDUSTRY_BENCHMARKS', () => {
  beforeEach(() => kpiCache.clear())

  it('has an entry for every IndustrySector', () => {
    for (const sector of SECTORS) {
      expect(INDUSTRY_BENCHMARKS[sector]).toBeDefined()
      expect(INDUSTRY_BENCHMARKS[sector].sector).toBe(sector)
    }
  })

  it('keeps min <= median <= max for every metric of every sector', () => {
    const metrics = [
      'grossProfitMargin',
      'operatingMargin',
      'currentRatio',
      'debtToEquity',
      'inventoryTurnover',
    ] as const

    for (const sector of SECTORS) {
      const bench = INDUSTRY_BENCHMARKS[sector]
      for (const metric of metrics) {
        const range = bench[metric]
        expect(range.min).toBeLessThanOrEqual(range.median)
        expect(range.median).toBeLessThanOrEqual(range.max)
      }
    }
  })

  it('zeros out inventoryTurnover for sectors that do not hold inventory', () => {
    for (const sector of ['service', 'technology', 'finance'] as IndustrySector[]) {
      const range = INDUSTRY_BENCHMARKS[sector].inventoryTurnover
      expect(range).toEqual({ min: 0, median: 0, max: 0 })
    }
  })
})

describe('analytics/financial-kpi — getKPIBenchmarks status branches', () => {
  it('marks every KPI "good" when all metrics clear the good threshold', () => {
    const benchmarks = getKPIBenchmarks(
      buildKPIs({
        roe: 12,
        roa: 6,
        grossProfitMargin: 35,
        operatingMargin: 12,
        ebitdaMargin: 18,
        currentRatio: 160,
        debtToEquity: 0.8,
        equityRatio: 40,
      })
    )

    expect(benchmarks).toHaveLength(8)
    for (const benchmark of benchmarks) {
      expect(benchmark.status).toBe('good')
      expect(typeof benchmark.description).toBe('string')
    }
  })

  it('marks every KPI "warning" when all metrics land in the warning band', () => {
    const benchmarks = getKPIBenchmarks(
      buildKPIs({
        roe: 7,
        roa: 3,
        grossProfitMargin: 25,
        operatingMargin: 7,
        ebitdaMargin: 12,
        currentRatio: 120,
        debtToEquity: 1.5,
        equityRatio: 25,
      })
    )

    const byKpi = new Map(benchmarks.map((b) => [b.kpi, b.status]))
    expect(byKpi.get('ROE')).toBe('warning')
    expect(byKpi.get('ROA')).toBe('warning')
    expect(byKpi.get('売上総利益率')).toBe('warning')
    expect(byKpi.get('営業利益率')).toBe('warning')
    expect(byKpi.get('EBITDAマージン')).toBe('warning')
    expect(byKpi.get('流動比率')).toBe('warning')
    expect(byKpi.get('D/E比率')).toBe('warning')
    expect(byKpi.get('自己資本比率')).toBe('warning')
  })

  it('marks every KPI "bad" when all metrics fall below the warning threshold', () => {
    const benchmarks = getKPIBenchmarks(
      buildKPIs({
        roe: 3,
        roa: 1,
        grossProfitMargin: 15,
        operatingMargin: 3,
        ebitdaMargin: 5,
        currentRatio: 80,
        debtToEquity: 3,
        equityRatio: 15,
      })
    )

    for (const benchmark of benchmarks) {
      expect(benchmark.status).toBe('bad')
    }
  })

  it('carries the documented benchmark targets for ROE and D/E', () => {
    const benchmarks = getKPIBenchmarks(buildKPIs({}))
    const byKpi = new Map(benchmarks.map((b) => [b.kpi, b]))

    expect(byKpi.get('ROE')?.benchmark).toBe(10)
    expect(byKpi.get('D/E比率')?.benchmark).toBe(1.0)
    expect(byKpi.get('流動比率')?.benchmark).toBe(150)
  })
})

describe('analytics/financial-kpi — benchmark comparison percentile branches', () => {
  beforeEach(() => kpiCache.clear())

  function grossProfitComparison(margin: number, netIncome: number) {
    const bs: BalanceSheet = {
      fiscalYear: 2024,
      month: 12,
      assets: {
        current: [{ code: '1000', name: '現金', amount: 5000000 }],
        fixed: [],
        total: 5000000,
      },
      liabilities: {
        current: [{ code: '3000', name: '買掛金', amount: 2000000 }],
        fixed: [],
        total: 2000000,
      },
      equity: { items: [{ code: '5000', name: '資本金', amount: 3000000 }], total: 3000000 },
      totalAssets: 5000000,
      totalLiabilities: 2000000,
      totalEquity: 3000000,
    }
    const kpis = calculateFinancialKPIs(
      bs,
      makePL({ grossProfitMargin: margin, netIncome }),
      makeCF(),
      undefined,
      {
        sector: 'manufacturing',
      }
    )
    return kpis.benchmark?.comparison.find((c) => c.metric === '売上総利益率')
  }

  // manufacturing grossProfitMargin range: min 15 / median 25 / max 40
  it('is below_range with percentile 0 when the value undershoots the min', () => {
    const comparison = grossProfitComparison(10, 1000000)
    expect(comparison?.status).toBe('below_range')
    expect(comparison?.percentile).toBe(0)
  })

  it('is below_median with the linearly interpolated percentile between min and median', () => {
    const comparison = grossProfitComparison(20, 1100000)
    expect(comparison?.status).toBe('below_median')
    expect(comparison?.percentile).toBe(25)
  })

  it('is above_median with the interpolated percentile between median and max', () => {
    const comparison = grossProfitComparison(30, 1200000)
    expect(comparison?.status).toBe('above_median')
    expect(comparison?.percentile).toBe(67)
  })

  it('is above_range with percentile 100 when the value exceeds the max', () => {
    const comparison = grossProfitComparison(50, 1300000)
    expect(comparison?.status).toBe('above_range')
    expect(comparison?.percentile).toBe(100)
  })
})

describe('analytics/financial-kpi — efficiency sector + name-matching branches', () => {
  beforeEach(() => kpiCache.clear())

  function bsWithInventory(): BalanceSheet {
    return {
      fiscalYear: 2024,
      month: 12,
      assets: {
        current: [
          { code: '1000', name: '現金', amount: 5000000 },
          { code: '1200', name: '棚卸資産', amount: 2000000 },
        ],
        fixed: [],
        total: 7000000,
      },
      liabilities: {
        current: [{ code: '3000', name: '買掛金', amount: 2000000 }],
        fixed: [],
        total: 2000000,
      },
      equity: { items: [{ code: '5000', name: '資本金', amount: 5000000 }], total: 5000000 },
      totalAssets: 7000000,
      totalLiabilities: 2000000,
      totalEquity: 5000000,
    }
  }

  it('forces inventoryTurnover to 0 for inventory-less sectors even when inventory is present', () => {
    const kpis = calculateFinancialKPIs(bsWithInventory(), makePL({}), makeCF(), undefined, {
      sector: 'service',
    })
    expect(kpis.efficiency.inventoryTurnover).toBe(0)
  })

  it('computes inventoryTurnover from cost of sales over inventory for inventory-bearing sectors', () => {
    const kpis = calculateFinancialKPIs(bsWithInventory(), makePL({}), makeCF(), undefined, {
      sector: 'retail',
    })
    expect(kpis.efficiency.inventoryTurnover).toBe(3)
  })

  it('matches inventory/receivables/payables via 商品/受取手形/支払手形 name tokens', () => {
    const bs: BalanceSheet = {
      fiscalYear: 2024,
      month: 12,
      assets: {
        current: [
          { code: '1000', name: '現金', amount: 4000000 },
          { code: '1100', name: '受取手形', amount: 2000000 },
          { code: '1200', name: '商品', amount: 2000000 },
        ],
        fixed: [],
        total: 8000000,
      },
      liabilities: {
        current: [{ code: '3000', name: '支払手形', amount: 3000000 }],
        fixed: [],
        total: 3000000,
      },
      equity: { items: [{ code: '5000', name: '資本金', amount: 5000000 }], total: 5000000 },
      totalAssets: 8000000,
      totalLiabilities: 3000000,
      totalEquity: 5000000,
    }
    const kpis = calculateFinancialKPIs(bs, makePL({}), makeCF(), undefined, { sector: 'retail' })

    expect(kpis.efficiency.inventoryTurnover).toBe(3)
    expect(kpis.efficiency.receivablesTurnover).toBe(5)
    expect(kpis.efficiency.payablesTurnover).toBe(2)
  })
})

describe('analytics/financial-kpi — growth without prior period + NRR + caching', () => {
  beforeEach(() => kpiCache.clear())

  it('reports zero growth when no previous-period P&L is supplied', () => {
    const bs: BalanceSheet = {
      fiscalYear: 2024,
      month: 12,
      assets: {
        current: [{ code: '1000', name: '現金', amount: 5000000 }],
        fixed: [],
        total: 5000000,
      },
      liabilities: {
        current: [{ code: '3000', name: '買掛金', amount: 2000000 }],
        fixed: [],
        total: 2000000,
      },
      equity: { items: [{ code: '5000', name: '資本金', amount: 3000000 }], total: 3000000 },
      totalAssets: 5000000,
      totalLiabilities: 2000000,
      totalEquity: 3000000,
    }
    const kpis = calculateFinancialKPIs(bs, makePL({}), makeCF())
    expect(kpis.growth.revenueGrowth).toBe(0)
    expect(kpis.growth.profitGrowth).toBe(0)
  })

  it('derives the VC net revenue retention from AR revenue and the prior period', () => {
    const bs: BalanceSheet = {
      fiscalYear: 2024,
      month: 12,
      assets: {
        current: [{ code: '1000', name: '現金', amount: 5000000 }],
        fixed: [],
        total: 5000000,
      },
      liabilities: {
        current: [{ code: '3000', name: '買掛金', amount: 2000000 }],
        fixed: [],
        total: 2000000,
      },
      equity: { items: [{ code: '5000', name: '資本金', amount: 3000000 }], total: 3000000 },
      totalAssets: 5000000,
      totalLiabilities: 2000000,
      totalEquity: 3000000,
    }
    const previousPL = makePL({})
    previousPL.fiscalYear = 2023
    previousPL.revenue = [{ code: 'R001', name: '売上高', amount: 8000000 }]

    const result = calculateExtendedKPIs(bs, makePL({}), makeCF(), previousPL, {
      arRevenue: 11000000,
    })

    // nrr = ((2 * arRevenue - revenue) / previousRevenue) * 100
    expect(result.vc.nrr).toBe(150)
  })

  it('memoizes: repeated calls with identical inputs return the very same object', () => {
    const bs: BalanceSheet = {
      fiscalYear: 2024,
      month: 12,
      assets: {
        current: [{ code: '1000', name: '現金', amount: 5000000 }],
        fixed: [],
        total: 5000000,
      },
      liabilities: {
        current: [{ code: '3000', name: '買掛金', amount: 2000000 }],
        fixed: [],
        total: 2000000,
      },
      equity: { items: [{ code: '5000', name: '資本金', amount: 3000000 }], total: 3000000 },
      totalAssets: 5000000,
      totalLiabilities: 2000000,
      totalEquity: 3000000,
    }

    const first = calculateFinancialKPIs(bs, makePL({ netIncome: 7777771 }), makeCF())
    const second = calculateFinancialKPIs(bs, makePL({ netIncome: 7777771 }), makeCF())
    expect(Object.is(first, second)).toBe(true)

    const otherSector = calculateFinancialKPIs(
      bs,
      makePL({ netIncome: 7777771 }),
      makeCF(),
      undefined,
      {
        sector: 'manufacturing',
      }
    )
    expect(Object.is(first, otherSector)).toBe(false)
  })
})
