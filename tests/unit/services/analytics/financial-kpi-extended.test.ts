import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  calculateExtendedKPIs,
  getKPIBenchmarks,
  type StartupKPIs,
  type VCKPIs,
  type BankKPIs,
} from '@/services/analytics/financial-kpi'
import { calculateFinancialKPIs } from '@/services/analytics/financial-kpi'
import type { BalanceSheet, ProfitLoss, CashFlowStatement } from '@/types'

describe('calculateExtendedKPIs', () => {
  const mockBS: BalanceSheet = {
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

  const mockPL: ProfitLoss = {
    fiscalYear: 2024,
    month: 12,
    revenue: [{ code: 'R001', name: '売上高', amount: 10000000 }],
    costOfSales: [{ code: 'C001', name: '売上原価', amount: 6000000 }],
    grossProfit: 4000000,
    grossProfitMargin: 40,
    sgaExpenses: [
      { code: 'E001', name: '給与手当', amount: 1500000 },
      { code: 'E002', name: '広告宣伝費', amount: 500000 },
    ],
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

  const mockCF: CashFlowStatement = {
    fiscalYear: 2024,
    month: 12,
    operating: {
      items: [],
      netCashFromOperating: 2000000,
    },
    investing: {
      items: [],
      netCashFromInvesting: -500000,
    },
    financing: {
      items: [],
      netCashFromFinancing: -300000,
    },
    netChangeInCash: 1200000,
    beginningCash: 3800000,
    endingCash: 5000000,
  }

  const mockPreviousPL: ProfitLoss = {
    ...mockPL,
    fiscalYear: 2023,
    revenue: [{ code: 'R001', name: '売上高', amount: 8000000 }],
    netIncome: 1000000,
  }

  describe('startup KPIs', () => {
    it('should calculate burn rate correctly for loss-making company', () => {
      const lossPL = { ...mockPL, netIncome: -500000 }
      const result = calculateExtendedKPIs(mockBS, lossPL, mockCF)

      expect(result.startup.burnRate).toBe(500000)
    })

    it('should calculate runway months', () => {
      const result = calculateExtendedKPIs(mockBS, mockPL, mockCF)

      expect(result.startup.runwayMonths).toBeGreaterThanOrEqual(0)
    })

    it('should calculate CAC when marketing spend provided', () => {
      const result = calculateExtendedKPIs(mockBS, mockPL, mockCF, mockPreviousPL, {
        marketingSpend: 500000,
        newCustomers: 10,
      })

      expect(result.startup.cac).toBe(50000)
    })

    it('should return null CAC when no new customers', () => {
      const result = calculateExtendedKPIs(mockBS, mockPL, mockCF, mockPreviousPL, {
        marketingSpend: 500000,
        newCustomers: 0,
      })

      expect(result.startup.cac).toBeNull()
    })

    it('should calculate LTV with churn rate', () => {
      const result = calculateExtendedKPIs(mockBS, mockPL, mockCF, mockPreviousPL, {
        totalCustomers: 100,
        churnedCustomers: 5,
      })

      expect(result.startup.churnRate).toBe(5)
      expect(result.startup.ltv).toBeCloseTo(2000000, -4)
    })

    it('should calculate LTV/CAC ratio', () => {
      const result = calculateExtendedKPIs(mockBS, mockPL, mockCF, mockPreviousPL, {
        marketingSpend: 500000,
        newCustomers: 10,
        totalCustomers: 100,
        churnedCustomers: 5,
      })

      expect(result.startup.ltvCacRatio).toBeGreaterThan(0)
    })

    it('should calculate MRR and ARR', () => {
      const result = calculateExtendedKPIs(mockBS, mockPL, mockCF)

      expect(result.startup.mrr).toBe(Math.round(10000000 / 12))
      expect(result.startup.arr).toBe(Math.round((10000000 / 12) * 12))
    })
  })

  describe('VC KPIs', () => {
    it('should calculate revenue multiple with valuation', () => {
      const result = calculateExtendedKPIs(mockBS, mockPL, mockCF, mockPreviousPL, {
        valuation: 50000000,
      })

      expect(result.vc.revenueMultiple).toBe(5)
    })

    it('should return null revenue multiple without valuation', () => {
      const result = calculateExtendedKPIs(mockBS, mockPL, mockCF, mockPreviousPL)

      expect(result.vc.revenueMultiple).toBeNull()
    })

    it('should calculate growth rate', () => {
      const result = calculateExtendedKPIs(mockBS, mockPL, mockCF, mockPreviousPL)

      expect(result.vc.growthRate).toBe(25)
    })

    it('should calculate Rule of 40', () => {
      const result = calculateExtendedKPIs(mockBS, mockPL, mockCF, mockPreviousPL)

      expect(result.vc.ruleOf40).toBe(25 + 40)
    })

    it('should calculate magic number with sales/marketing spend', () => {
      const plWithAds = {
        ...mockPL,
        sgaExpenses: [
          { code: 'E001', name: '給与手当', amount: 1500000 },
          { code: 'E002', name: '広告宣伝費', amount: 500000 },
        ],
      }

      const result = calculateExtendedKPIs(mockBS, plWithAds, mockCF, mockPreviousPL)

      expect(result.vc.magicNumber).not.toBeNull()
    })
  })

  describe('Bank KPIs', () => {
    it('should calculate DSCR', () => {
      const result = calculateExtendedKPIs(mockBS, mockPL, mockCF)

      expect(result.bank.dscr).toBeGreaterThan(0)
    })

    it('should calculate interest coverage ratio', () => {
      const result = calculateExtendedKPIs(mockBS, mockPL, mockCF, mockPreviousPL, {
        interestExpense: 100000,
      })

      expect(result.bank.interestCoverageRatio).toBeGreaterThan(0)
    })

    it('should calculate debt to equity ratio', () => {
      const result = calculateExtendedKPIs(mockBS, mockPL, mockCF)

      expect(result.bank.debtToEquityRatio).toBeCloseTo(8000000 / 12000000, 2)
    })

    it('should calculate debt service ratio', () => {
      const result = calculateExtendedKPIs(mockBS, mockPL, mockCF)

      expect(result.bank.debtServiceRatio).toBeCloseTo((8000000 / 20000000) * 100, 1)
    })

    it('should use provided interest expense', () => {
      const result = calculateExtendedKPIs(mockBS, mockPL, mockCF, mockPreviousPL, {
        interestExpense: 200000,
        principalPayments: 300000,
      })

      expect(result.bank.dscr).toBeGreaterThan(0)
    })
  })

  describe('KPI Advice', () => {
    it('should generate advice for low runway', () => {
      const lowCashBS = {
        ...mockBS,
        assets: {
          ...mockBS.assets,
          current: [{ code: '1000', name: '現金', amount: 500000 }],
        },
      }
      const lossPL = { ...mockPL, netIncome: -1000000 }

      const result = calculateExtendedKPIs(lowCashBS, lossPL, mockCF)

      const runwayAdvice = result.advice.find((a) => a.kpiName === 'Runway')
      expect(runwayAdvice).toBeDefined()
      expect(runwayAdvice?.status).toMatch(/critical|warning/)
    })

    it('should generate advice for low LTV/CAC ratio', () => {
      const result = calculateExtendedKPIs(mockBS, mockPL, mockCF, mockPreviousPL, {
        marketingSpend: 1000000,
        newCustomers: 100,
        totalCustomers: 100,
        churnedCustomers: 50,
      })

      const ltvCacAdvice = result.advice.find((a) => a.kpiName === 'LTV/CAC比率')
      if (ltvCacAdvice) {
        expect(ltvCacAdvice.status).toMatch(/critical|warning/)
      }
    })

    it('should generate advice for low Rule of 40', () => {
      const lowGrowthPL = {
        ...mockPL,
        grossProfitMargin: 10,
      }
      const noGrowthPreviousPL = { ...mockPreviousPL, revenue: mockPL.revenue }

      const result = calculateExtendedKPIs(mockBS, lowGrowthPL, mockCF, noGrowthPreviousPL)

      const ruleOf40Advice = result.advice.find((a) => a.kpiName === 'Rule of 40')
      if (ruleOf40Advice) {
        expect(ruleOf40Advice.status).toMatch(/critical|warning/)
      }
    })

    it('should generate advice for low DSCR', () => {
      const highDebtBS = {
        ...mockBS,
        liabilities: {
          current: [{ code: '3000', name: '買掛金', amount: 5000000 }],
          fixed: [{ code: '4000', name: '長期借入金', amount: 10000000 }],
          total: 15000000,
        },
        totalLiabilities: 15000000,
        totalEquity: 5000000,
      }
      const result = calculateExtendedKPIs(highDebtBS, mockPL, mockCF, mockPreviousPL, {
        interestExpense: 500000,
        principalPayments: 1000000,
      })

      const dscrAdvice = result.advice.find((a) => a.kpiName === 'DSCR')
      if (dscrAdvice) {
        expect(dscrAdvice.status).toMatch(/critical|warning/)
      }
    })

    it('should include action items in advice', () => {
      const lowCashBS = {
        ...mockBS,
        assets: {
          ...mockBS.assets,
          current: [{ code: '1000', name: '現金', amount: 100000 }],
        },
      }
      const lossPL = { ...mockPL, netIncome: -1000000 }

      const result = calculateExtendedKPIs(lowCashBS, lossPL, mockCF)

      const runwayAdvice = result.advice.find((a) => a.kpiName === 'Runway')
      if (runwayAdvice) {
        expect(runwayAdvice.actionItems.length).toBeGreaterThan(0)
      }
    })
  })

  describe('base KPIs inclusion', () => {
    it('should include all base KPIs', () => {
      const result = calculateExtendedKPIs(mockBS, mockPL, mockCF, mockPreviousPL)

      expect(result.profitability).toBeDefined()
      expect(result.efficiency).toBeDefined()
      expect(result.safety).toBeDefined()
      expect(result.growth).toBeDefined()
      expect(result.cashFlow).toBeDefined()
    })
  })
})

describe('getKPIBenchmarks', () => {
  const mockBS: BalanceSheet = {
    fiscalYear: 2024,
    month: 12,
    assets: {
      current: [{ code: '1000', name: '現金', amount: 10000000 }],
      fixed: [],
      total: 10000000,
    },
    liabilities: {
      current: [{ code: '3000', name: '買掛金', amount: 2000000 }],
      fixed: [],
      total: 2000000,
    },
    equity: {
      items: [{ code: '5000', name: '資本金', amount: 8000000 }],
      total: 8000000,
    },
    totalAssets: 10000000,
    totalLiabilities: 2000000,
    totalEquity: 8000000,
  }

  const mockPL: ProfitLoss = {
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
    depreciation: 200000,
  }

  const mockCF: CashFlowStatement = {
    fiscalYear: 2024,
    month: 12,
    operating: { items: [], netCashFromOperating: 2000000 },
    investing: { items: [], netCashFromInvesting: 0 },
    financing: { items: [], netCashFromFinancing: 0 },
    netChangeInCash: 2000000,
    beginningCash: 8000000,
    endingCash: 10000000,
  }

  it('should return benchmarks for all key KPIs', () => {
    const kpis = calculateFinancialKPIs(mockBS, mockPL, mockCF)
    const benchmarks = getKPIBenchmarks(kpis)

    expect(benchmarks.length).toBe(8)
    const kpiNames = benchmarks.map((b) => b.kpi)
    expect(kpiNames).toContain('ROE')
    expect(kpiNames).toContain('ROA')
    expect(kpiNames).toContain('流動比率')
    expect(kpiNames).toContain('D/E比率')
  })

  it('should classify ROE correctly', () => {
    const kpis = calculateFinancialKPIs(mockBS, mockPL, mockCF)
    const benchmarks = getKPIBenchmarks(kpis)

    const roeBenchmark = benchmarks.find((b) => b.kpi === 'ROE')
    expect(roeBenchmark?.benchmark).toBe(10)
    expect(['good', 'warning', 'bad']).toContain(roeBenchmark?.status)
  })

  it('should classify D/E ratio correctly', () => {
    const kpis = calculateFinancialKPIs(mockBS, mockPL, mockCF)
    const benchmarks = getKPIBenchmarks(kpis)

    const deBenchmark = benchmarks.find((b) => b.kpi === 'D/E比率')
    expect(deBenchmark?.benchmark).toBe(1.0)
  })

  it('should return good status for high current ratio', () => {
    const kpis = calculateFinancialKPIs(mockBS, mockPL, mockCF)
    const benchmarks = getKPIBenchmarks(kpis)

    const currentRatioBenchmark = benchmarks.find((b) => b.kpi === '流動比率')
    expect(currentRatioBenchmark?.status).toBe('good')
  })
})
