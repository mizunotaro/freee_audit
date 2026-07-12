import { describe, it, expect, expectTypeOf } from 'vitest'
import type {
  PeriodBalanceSheet,
  PeriodProfitLoss,
  PeriodCashFlow,
  PeriodKPIs,
  PeriodData,
  PeriodicSummary,
  PeriodicReportData,
} from '@/types/reports/periodic'

const balanceSheet: PeriodBalanceSheet = {
  totalAssets: 1_000_000,
  currentAssets: 600_000,
  fixedAssets: 400_000,
  totalLiabilities: 500_000,
  currentLiabilities: 300_000,
  fixedLiabilities: 200_000,
  equity: 500_000,
}

const profitLoss: PeriodProfitLoss = {
  revenue: 2_000_000,
  costOfSales: 1_200_000,
  grossProfit: 800_000,
  operatingIncome: 400_000,
  ordinaryIncome: 350_000,
  netIncome: 250_000,
}

const cashFlow: PeriodCashFlow = {
  operatingCF: 300_000,
  investingCF: -150_000,
  financingCF: -50_000,
  freeCashFlow: 150_000,
}

const kpis: PeriodKPIs = {
  roe: 0.5,
  roa: 0.25,
  grossMargin: 0.4,
  operatingMargin: 0.2,
  currentRatio: 2.0,
  debtToEquity: 1.0,
}

describe('periodic report types', () => {
  describe('PeriodBalanceSheet', () => {
    it('exposes the seven monetary buckets', () => {
      expect(balanceSheet.totalAssets).toBe(1_000_000)
      expect(balanceSheet.currentAssets).toBe(600_000)
      expect(balanceSheet.fixedAssets).toBe(400_000)
      expect(balanceSheet.totalLiabilities).toBe(500_000)
      expect(balanceSheet.currentLiabilities).toBe(300_000)
      expect(balanceSheet.fixedLiabilities).toBe(200_000)
      expect(balanceSheet.equity).toBe(500_000)
    })

    it('accepts zero values across every bucket (empty balance sheet)', () => {
      const empty: PeriodBalanceSheet = {
        totalAssets: 0,
        currentAssets: 0,
        fixedAssets: 0,
        totalLiabilities: 0,
        currentLiabilities: 0,
        fixedLiabilities: 0,
        equity: 0,
      }
      expect(Object.values(empty).every((v) => v === 0)).toBe(true)
    })

    it('accepts negative equity / insolvency values', () => {
      const insolvent: PeriodBalanceSheet = {
        totalAssets: 100,
        currentAssets: 100,
        fixedAssets: 0,
        totalLiabilities: 300,
        currentLiabilities: 300,
        fixedLiabilities: 0,
        equity: -200,
      }
      expect(insolvent.equity).toBeLessThan(0)
    })

    it('accepts IEEE-754 extremes (Infinity / NaN / MAX_VALUE) — field type stays plain number', () => {
      const extreme: PeriodBalanceSheet = {
        totalAssets: Number.MAX_VALUE,
        currentAssets: Infinity,
        fixedAssets: -Infinity,
        totalLiabilities: NaN,
        currentLiabilities: Number.MIN_VALUE,
        fixedLiabilities: Number.MAX_SAFE_INTEGER,
        equity: -Number.MAX_VALUE,
      }
      expect(extreme.totalAssets).toBe(Number.MAX_VALUE)
      expect(extreme.currentAssets).toBe(Infinity)
      expect(Number.isNaN(extreme.totalLiabilities)).toBe(true)
      expect(extreme.fixedLiabilities).toBe(Number.MAX_SAFE_INTEGER)
    })

    it('is exactly a flat object of seven numeric fields', () => {
      expectTypeOf<PeriodBalanceSheet>().toEqualTypeOf<{
        totalAssets: number
        currentAssets: number
        fixedAssets: number
        totalLiabilities: number
        currentLiabilities: number
        fixedLiabilities: number
        equity: number
      }>()
    })
  })

  describe('PeriodProfitLoss', () => {
    it('exposes the six P&L line items', () => {
      expect(profitLoss.revenue).toBe(2_000_000)
      expect(profitLoss.costOfSales).toBe(1_200_000)
      expect(profitLoss.grossProfit).toBe(800_000)
      expect(profitLoss.operatingIncome).toBe(400_000)
      expect(profitLoss.ordinaryIncome).toBe(350_000)
      expect(profitLoss.netIncome).toBe(250_000)
    })

    it('accepts a loss-making period with negative bottom lines', () => {
      const loss: PeriodProfitLoss = {
        revenue: 500_000,
        costOfSales: 600_000,
        grossProfit: -100_000,
        operatingIncome: -250_000,
        ordinaryIncome: -300_000,
        netIncome: -350_000,
      }
      expect(loss.grossProfit).toBeLessThan(0)
      expect(loss.netIncome).toBeLessThan(0)
    })

    it('accepts IEEE-754 extremes across every P&L line (Infinity / NaN / MAX_VALUE)', () => {
      const extreme: PeriodProfitLoss = {
        revenue: Number.MAX_VALUE,
        costOfSales: Infinity,
        grossProfit: NaN,
        operatingIncome: -Infinity,
        ordinaryIncome: Number.MAX_SAFE_INTEGER,
        netIncome: -Number.MAX_VALUE,
      }
      expect(extreme.revenue).toBe(Number.MAX_VALUE)
      expect(Number.isNaN(extreme.grossProfit)).toBe(true)
      expect(extreme.netIncome).toBe(-Number.MAX_VALUE)
    })

    it('is exactly a flat object of six numeric fields', () => {
      expectTypeOf<PeriodProfitLoss>().toEqualTypeOf<{
        revenue: number
        costOfSales: number
        grossProfit: number
        operatingIncome: number
        ordinaryIncome: number
        netIncome: number
      }>()
    })
  })

  describe('PeriodCashFlow', () => {
    it('exposes the four cash-flow buckets', () => {
      expect(cashFlow.operatingCF).toBe(300_000)
      expect(cashFlow.investingCF).toBe(-150_000)
      expect(cashFlow.financingCF).toBe(-50_000)
      expect(cashFlow.freeCashFlow).toBe(150_000)
    })

    it('accepts net cash outflow across all buckets', () => {
      const drain: PeriodCashFlow = {
        operatingCF: -10_000,
        investingCF: -200_000,
        financingCF: -50_000,
        freeCashFlow: -210_000,
      }
      expect(drain.operatingCF).toBeLessThan(0)
      expect(drain.freeCashFlow).toBeLessThan(0)
    })

    it('accepts IEEE-754 extremes across every cash-flow bucket (Infinity / NaN / MAX_VALUE)', () => {
      const extreme: PeriodCashFlow = {
        operatingCF: Infinity,
        investingCF: -Infinity,
        financingCF: NaN,
        freeCashFlow: Number.MAX_VALUE,
      }
      expect(extreme.operatingCF).toBe(Infinity)
      expect(Number.isNaN(extreme.financingCF)).toBe(true)
      expect(extreme.freeCashFlow).toBe(Number.MAX_VALUE)
    })

    it('is exactly a flat object of four numeric fields', () => {
      expectTypeOf<PeriodCashFlow>().toEqualTypeOf<{
        operatingCF: number
        investingCF: number
        financingCF: number
        freeCashFlow: number
      }>()
    })
  })

  describe('PeriodKPIs', () => {
    it('exposes the six ratio fields', () => {
      expect(kpis.roe).toBe(0.5)
      expect(kpis.roa).toBe(0.25)
      expect(kpis.grossMargin).toBe(0.4)
      expect(kpis.operatingMargin).toBe(0.2)
      expect(kpis.currentRatio).toBe(2.0)
      expect(kpis.debtToEquity).toBe(1.0)
    })

    it('accepts boundary ratios including zero and heavily leveraged states', () => {
      const boundary: PeriodKPIs = {
        roe: 0,
        roa: 0,
        grossMargin: 0,
        operatingMargin: 0,
        currentRatio: 0,
        debtToEquity: 0,
      }
      const overleveraged: PeriodKPIs = {
        roe: -1.5,
        roa: -0.8,
        grossMargin: 0.95,
        operatingMargin: -0.3,
        currentRatio: 0.2,
        debtToEquity: 5.0,
      }
      expect(boundary.roe).toBe(0)
      expect(overleveraged.debtToEquity).toBeGreaterThan(1)
    })

    it('accepts IEEE-754 extremes across every ratio (Infinity / NaN / MAX_VALUE)', () => {
      const extreme: PeriodKPIs = {
        roe: Infinity,
        roa: -Infinity,
        grossMargin: NaN,
        operatingMargin: Number.MAX_VALUE,
        currentRatio: Number.MIN_VALUE,
        debtToEquity: Number.MAX_SAFE_INTEGER,
      }
      expect(extreme.roe).toBe(Infinity)
      expect(Number.isNaN(extreme.grossMargin)).toBe(true)
      expect(extreme.operatingMargin).toBe(Number.MAX_VALUE)
    })

    it('is exactly a flat object of six numeric fields', () => {
      expectTypeOf<PeriodKPIs>().toEqualTypeOf<{
        roe: number
        roa: number
        grossMargin: number
        operatingMargin: number
        currentRatio: number
        debtToEquity: number
      }>()
    })
  })

  describe('PeriodData', () => {
    const period: PeriodData = {
      label: 'FY2024',
      fiscalYear: 2024,
      startMonth: 4,
      endMonth: 3,
      balanceSheet,
      profitLoss,
      cashFlow,
      kpis,
      endingCash: 750_000,
    }

    it('exposes the period identity and span', () => {
      expect(period.label).toBe('FY2024')
      expect(period.fiscalYear).toBe(2024)
      expect(period.startMonth).toBe(4)
      expect(period.endMonth).toBe(3)
      expect(period.endingCash).toBe(750_000)
    })

    it('nests the four financial sub-objects by reference', () => {
      expect(period.balanceSheet).toBe(balanceSheet)
      expect(period.profitLoss).toBe(profitLoss)
      expect(period.cashFlow).toBe(cashFlow)
      expect(period.kpis).toBe(kpis)
    })

    it('still compiles when each sub-object is built inline', () => {
      const inline: PeriodData = {
        label: 'Q1',
        fiscalYear: 2024,
        startMonth: 4,
        endMonth: 6,
        endingCash: 0,
        balanceSheet: {
          totalAssets: 0,
          currentAssets: 0,
          fixedAssets: 0,
          totalLiabilities: 0,
          currentLiabilities: 0,
          fixedLiabilities: 0,
          equity: 0,
        },
        profitLoss: {
          revenue: 0,
          costOfSales: 0,
          grossProfit: 0,
          operatingIncome: 0,
          ordinaryIncome: 0,
          netIncome: 0,
        },
        cashFlow: {
          operatingCF: 0,
          investingCF: 0,
          financingCF: 0,
          freeCashFlow: 0,
        },
        kpis: {
          roe: 0,
          roa: 0,
          grossMargin: 0,
          operatingMargin: 0,
          currentRatio: 0,
          debtToEquity: 0,
        },
      }
      expect(inline.label).toBe('Q1')
    })

    it('enforces required fields — a partial period is rejected at the type level', () => {
      // Missing label + the four financial sub-objects: not assignable to PeriodData.
      expectTypeOf<{
        fiscalYear: number
        startMonth: number
        endMonth: number
      }>().not.toMatchTypeOf<PeriodData>()
    })

    it('declares the nested sub-object types verbatim', () => {
      expectTypeOf<PeriodData['balanceSheet']>().toEqualTypeOf<PeriodBalanceSheet>()
      expectTypeOf<PeriodData['profitLoss']>().toEqualTypeOf<PeriodProfitLoss>()
      expectTypeOf<PeriodData['cashFlow']>().toEqualTypeOf<PeriodCashFlow>()
      expectTypeOf<PeriodData['kpis']>().toEqualTypeOf<PeriodKPIs>()
      expectTypeOf<PeriodData['label']>().toEqualTypeOf<string>()
      expectTypeOf<PeriodData['endingCash']>().toEqualTypeOf<number>()
    })
  })

  describe('PeriodicSummary', () => {
    const summary: PeriodicSummary = {
      revenueGrowth: 0.12,
      profitGrowth: 0.08,
      cashChange: 50_000,
      avgROE: 0.45,
      avgROA: 0.22,
      trendAnalysis: '上昇傾向',
    }

    it('exposes the aggregate growth, average ratios, and trend text', () => {
      expect(summary.revenueGrowth).toBe(0.12)
      expect(summary.profitGrowth).toBe(0.08)
      expect(summary.cashChange).toBe(50_000)
      expect(summary.avgROE).toBe(0.45)
      expect(summary.avgROA).toBe(0.22)
      expect(summary.trendAnalysis).toBe('上昇傾向')
    })

    it('allows null growth for the first period (no prior to compare) — safe degradation', () => {
      const firstPeriod: PeriodicSummary = {
        revenueGrowth: null,
        profitGrowth: null,
        cashChange: 0,
        avgROE: 0,
        avgROA: 0,
        trendAnalysis: 'データ不足',
      }
      expect(firstPeriod.revenueGrowth).toBeNull()
      expect(firstPeriod.profitGrowth).toBeNull()
    })

    it('allows mixed null / numeric growth (e.g. profit first recognized)', () => {
      const mixed: PeriodicSummary = {
        revenueGrowth: 0.05,
        profitGrowth: null,
        cashChange: -10_000,
        avgROE: 0,
        avgROA: 0,
        trendAnalysis: '横ばい',
      }
      expect(mixed.profitGrowth).toBeNull()
      expect(mixed.revenueGrowth).toBe(0.05)
    })

    it('types the growth fields as nullable numbers and the rest as required scalars', () => {
      expectTypeOf<PeriodicSummary['revenueGrowth']>().toEqualTypeOf<number | null>()
      expectTypeOf<PeriodicSummary['profitGrowth']>().toEqualTypeOf<number | null>()
      expectTypeOf<PeriodicSummary['cashChange']>().toEqualTypeOf<number>()
      expectTypeOf<PeriodicSummary['avgROE']>().toEqualTypeOf<number>()
      expectTypeOf<PeriodicSummary['avgROA']>().toEqualTypeOf<number>()
      expectTypeOf<PeriodicSummary['trendAnalysis']>().toEqualTypeOf<string>()
    })
  })

  describe('PeriodicReportData', () => {
    const period: PeriodData = {
      label: 'FY2024',
      fiscalYear: 2024,
      startMonth: 4,
      endMonth: 3,
      balanceSheet,
      profitLoss,
      cashFlow,
      kpis,
      endingCash: 750_000,
    }
    const summary: PeriodicSummary = {
      revenueGrowth: 0.12,
      profitGrowth: 0.08,
      cashChange: 50_000,
      avgROE: 0.45,
      avgROA: 0.22,
      trendAnalysis: '上昇傾向',
    }
    const report: PeriodicReportData = { periods: [period], summary }

    it('bundles the period series and the summary', () => {
      expect(report.periods).toHaveLength(1)
      expect(report.periods[0].label).toBe('FY2024')
      expect(report.summary).toBe(summary)
    })

    it('accepts an empty period list (no data yet) — safe degradation', () => {
      const empty: PeriodicReportData = {
        periods: [],
        summary: {
          revenueGrowth: null,
          profitGrowth: null,
          cashChange: 0,
          avgROE: 0,
          avgROA: 0,
          trendAnalysis: 'データなし',
        },
      }
      expect(empty.periods).toHaveLength(0)
    })

    it('accepts a multi-period series preserving insertion order', () => {
      const multi: PeriodicReportData = {
        periods: [
          { ...period, label: 'FY2022', fiscalYear: 2022 },
          { ...period, label: 'FY2023', fiscalYear: 2023 },
          { ...period, label: 'FY2024', fiscalYear: 2024 },
        ],
        summary,
      }
      expect(multi.periods.map((p) => p.label)).toEqual(['FY2022', 'FY2023', 'FY2024'])
    })

    it('declares periods as a PeriodData array and summary verbatim', () => {
      expectTypeOf<PeriodicReportData['periods']>().toEqualTypeOf<PeriodData[]>()
      expectTypeOf<PeriodicReportData['summary']>().toEqualTypeOf<PeriodicSummary>()
    })
  })

  describe('module surface', () => {
    it('resolves as a type-only module with no runtime exports', async () => {
      const mod = await import('@/types/reports/periodic')
      expect(mod).toBeDefined()
      expect(Object.keys(mod)).toHaveLength(0)
    })

    it('exposes all seven interfaces as resolvable type contracts', () => {
      expectTypeOf<PeriodBalanceSheet>().not.toBeAny()
      expectTypeOf<PeriodProfitLoss>().not.toBeAny()
      expectTypeOf<PeriodCashFlow>().not.toBeAny()
      expectTypeOf<PeriodKPIs>().not.toBeAny()
      expectTypeOf<PeriodData>().not.toBeAny()
      expectTypeOf<PeriodicSummary>().not.toBeAny()
      expectTypeOf<PeriodicReportData>().not.toBeAny()
    })
  })
})
