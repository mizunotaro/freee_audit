import { describe, it, expect } from 'vitest'
import type {
  AnalysisOptions,
  BenchmarkOptions,
  ReportOptions,
  AnalysisRequest,
  RatioAnalysisRequest,
  RatioCategory,
  BenchmarkRequest,
  ReportType,
  ReportFormat,
  ReportRequest,
} from '@/app/api/analysis/types/input'
import type { BalanceSheet, ProfitLoss, CashFlowStatement } from '@/types'
import type { AnalysisCategory } from '@/services/ai/analyzers/types'
import type { IndustrySector, CompanySize } from '@/services/benchmark/types'

const ANALYSIS_CATEGORIES: readonly AnalysisCategory[] = [
  'liquidity',
  'safety',
  'profitability',
  'efficiency',
  'growth',
  'cashflow',
  'comprehensive',
]

const RATIO_CATEGORIES: readonly RatioCategory[] = [
  'liquidity',
  'safety',
  'profitability',
  'efficiency',
  'growth',
]

const REPORT_TYPES: readonly ReportType[] = [
  'summary',
  'detailed',
  'investor',
  'management',
  'compliance',
]

const REPORT_FORMATS: readonly ReportFormat[] = ['json', 'markdown', 'html']

const INDUSTRY_SECTORS: readonly IndustrySector[] = [
  'manufacturing',
  'retail',
  'service',
  'technology',
  'finance',
  'real_estate',
  'construction',
  'healthcare',
  'education',
  'other',
]

const COMPANY_SIZES: readonly CompanySize[] = ['micro', 'small', 'medium', 'large']

const DEPTHS = ['brief', 'standard', 'detailed', 'comprehensive'] as const
const LANGUAGES = ['ja', 'en'] as const

function makeBalanceSheet(overrides: Partial<BalanceSheet> = {}): BalanceSheet {
  return {
    fiscalYear: 2024,
    month: 3,
    assets: { current: [], fixed: [], total: 1000 },
    liabilities: { current: [], fixed: [], total: 400 },
    equity: { items: [], total: 600 },
    totalAssets: 1000,
    totalLiabilities: 400,
    totalEquity: 600,
    ...overrides,
  }
}

function makeProfitLoss(overrides: Partial<ProfitLoss> = {}): ProfitLoss {
  return {
    fiscalYear: 2024,
    month: 3,
    revenue: [],
    costOfSales: [],
    grossProfit: 500,
    grossProfitMargin: 0.5,
    sgaExpenses: [],
    operatingIncome: 200,
    operatingMargin: 0.2,
    nonOperatingIncome: [],
    nonOperatingExpenses: [],
    ordinaryIncome: 200,
    extraordinaryIncome: [],
    extraordinaryLoss: [],
    incomeBeforeTax: 200,
    incomeTax: 60,
    netIncome: 140,
    depreciation: 30,
    ...overrides,
  }
}

function makeCashFlow(overrides: Partial<CashFlowStatement> = {}): CashFlowStatement {
  return {
    netChangeInCash: 100,
    beginningCash: 500,
    endingCash: 600,
    ...overrides,
  }
}

describe('src/app/api/analysis/types/input', () => {
  describe('module resolution', () => {
    it('should be importable as an ESM module (type-only module exports an empty namespace)', async () => {
      const mod = await import('@/app/api/analysis/types/input')
      expect(mod).toBeDefined()
      expect(typeof mod).toBe('object')
    })
  })

  describe('RatioCategory', () => {
    it('should expose exactly the five category members at runtime', () => {
      expect(RATIO_CATEGORIES).toHaveLength(5)
      expect(new Set(RATIO_CATEGORIES).size).toBe(5)
      expect(RATIO_CATEGORIES).toEqual([
        'liquidity',
        'safety',
        'profitability',
        'efficiency',
        'growth',
      ])
    })

    it('should type the alias as exactly those five literals', () => {
      expectTypeOf<RatioCategory>().toEqualTypeOf<
        'liquidity' | 'safety' | 'profitability' | 'efficiency' | 'growth'
      >()
    })

    it('should be a closed union — arbitrary string is not assignable', () => {
      expectTypeOf<string>().not.toMatchTypeOf<RatioCategory>()
    })

    it('should exclude AnalysisCategory members that are not ratio categories (cashflow, comprehensive)', () => {
      expectTypeOf<'cashflow'>().not.toMatchTypeOf<RatioCategory>()
      expectTypeOf<'comprehensive'>().not.toMatchTypeOf<RatioCategory>()
    })

    it('should accept each member as a valid RatioCategory', () => {
      for (const cat of RATIO_CATEGORIES) {
        const c: RatioCategory = cat
        expect(RATIO_CATEGORIES).toContain(c)
      }
    })
  })

  describe('ReportType', () => {
    it('should expose exactly the five report-type members at runtime', () => {
      expect(REPORT_TYPES).toHaveLength(5)
      expect(new Set(REPORT_TYPES).size).toBe(5)
      expect(REPORT_TYPES).toEqual(['summary', 'detailed', 'investor', 'management', 'compliance'])
    })

    it('should type the alias as exactly those five literals', () => {
      expectTypeOf<ReportType>().toEqualTypeOf<
        'summary' | 'detailed' | 'investor' | 'management' | 'compliance'
      >()
    })

    it('should be a closed union — arbitrary string is not assignable', () => {
      expectTypeOf<string>().not.toMatchTypeOf<ReportType>()
    })

    it('should reject out-of-union report types (executive, board)', () => {
      expectTypeOf<'executive'>().not.toMatchTypeOf<ReportType>()
      expectTypeOf<'board'>().not.toMatchTypeOf<ReportType>()
    })

    it('should accept each member as a valid ReportType', () => {
      for (const rt of REPORT_TYPES) {
        const t: ReportType = rt
        expect(REPORT_TYPES).toContain(t)
      }
    })
  })

  describe('ReportFormat', () => {
    it('should expose exactly the three format members at runtime', () => {
      expect(REPORT_FORMATS).toHaveLength(3)
      expect(new Set(REPORT_FORMATS).size).toBe(3)
      expect(REPORT_FORMATS).toEqual(['json', 'markdown', 'html'])
    })

    it('should type the alias as exactly those three literals', () => {
      expectTypeOf<ReportFormat>().toEqualTypeOf<'json' | 'markdown' | 'html'>()
    })

    it('should be a closed union — arbitrary string is not assignable', () => {
      expectTypeOf<string>().not.toMatchTypeOf<ReportFormat>()
    })

    it('should reject out-of-union formats (pdf, csv, xml)', () => {
      expectTypeOf<'pdf'>().not.toMatchTypeOf<ReportFormat>()
      expectTypeOf<'csv'>().not.toMatchTypeOf<ReportFormat>()
      expectTypeOf<'xml'>().not.toMatchTypeOf<ReportFormat>()
    })

    it('should accept each member as a valid ReportFormat', () => {
      for (const fmt of REPORT_FORMATS) {
        const f: ReportFormat = fmt
        expect(REPORT_FORMATS).toContain(f)
      }
    })
  })

  describe('AnalysisOptions', () => {
    it('should construct a fully-populated options object at runtime', () => {
      const opts: AnalysisOptions = {
        category: 'liquidity',
        includeAlerts: true,
        includeRecommendations: false,
        includeBenchmark: true,
        language: 'ja',
        depth: 'standard',
      }

      expect(opts.category).toBe('liquidity')
      expect(opts.includeAlerts).toBe(true)
      expect(opts.includeRecommendations).toBe(false)
      expect(opts.includeBenchmark).toBe(true)
      expect(opts.language).toBe('ja')
      expect(opts.depth).toBe('standard')
    })

    it('should serialize to exactly the expected key set when fully populated', () => {
      const opts: AnalysisOptions = {
        category: 'safety',
        includeAlerts: true,
        includeRecommendations: true,
        includeBenchmark: false,
        language: 'en',
        depth: 'brief',
      }

      expect(Object.keys(opts).sort()).toEqual([
        'category',
        'depth',
        'includeAlerts',
        'includeBenchmark',
        'includeRecommendations',
        'language',
      ])
    })

    it('should be minimal-constructible with an empty object (every field optional)', () => {
      const opts: AnalysisOptions = {}

      expect(opts.category).toBeUndefined()
      expect(opts.includeAlerts).toBeUndefined()
      expect(opts.includeRecommendations).toBeUndefined()
      expect(opts.includeBenchmark).toBeUndefined()
      expect(opts.language).toBeUndefined()
      expect(opts.depth).toBeUndefined()
      expect(Object.keys(opts)).toHaveLength(0)
    })

    it('should type every field as optional (T | undefined)', () => {
      expectTypeOf<AnalysisOptions['category']>().toEqualTypeOf<AnalysisCategory | undefined>()
      expectTypeOf<AnalysisOptions['includeAlerts']>().toEqualTypeOf<boolean | undefined>()
      expectTypeOf<AnalysisOptions['includeRecommendations']>().toEqualTypeOf<boolean | undefined>()
      expectTypeOf<AnalysisOptions['includeBenchmark']>().toEqualTypeOf<boolean | undefined>()
      expectTypeOf<AnalysisOptions['language']>().toEqualTypeOf<'ja' | 'en' | undefined>()
      expectTypeOf<AnalysisOptions['depth']>().toEqualTypeOf<
        'brief' | 'standard' | 'detailed' | 'comprehensive' | undefined
      >()
    })

    it('should accept every AnalysisCategory value for the category field', () => {
      for (const cat of ANALYSIS_CATEGORIES) {
        const opts: AnalysisOptions = { category: cat }
        expect(ANALYSIS_CATEGORIES).toContain(opts.category)
      }
    })

    it('should accept every depth literal', () => {
      for (const depth of DEPTHS) {
        const opts: AnalysisOptions = { depth }
        expect(DEPTHS).toContain(opts.depth)
      }
    })

    it('should accept every language literal', () => {
      for (const language of LANGUAGES) {
        const opts: AnalysisOptions = { language }
        expect(LANGUAGES).toContain(opts.language)
      }
    })

    it('should accept both polarities for each boolean flag', () => {
      const on: AnalysisOptions = {
        includeAlerts: true,
        includeRecommendations: true,
        includeBenchmark: true,
      }
      const off: AnalysisOptions = {
        includeAlerts: false,
        includeRecommendations: false,
        includeBenchmark: false,
      }

      expect(on.includeAlerts).toBe(true)
      expect(on.includeRecommendations).toBe(true)
      expect(on.includeBenchmark).toBe(true)
      expect(off.includeAlerts).toBe(false)
      expect(off.includeRecommendations).toBe(false)
      expect(off.includeBenchmark).toBe(false)
    })

    it('should fail-safe at compile time: an out-of-union category is rejected', () => {
      type BadCategory = { category: 'inventory' }
      expectTypeOf<BadCategory>().not.toMatchTypeOf<AnalysisOptions>()
    })

    it('should enforce immutability: readonly fields cannot be reassigned', () => {
      const opts: AnalysisOptions = { includeAlerts: true, category: 'liquidity' }
      const tryMutate = () => {
        // @ts-expect-error category is readonly (TS2540)
        opts.category = 'safety'
        // @ts-expect-error includeAlerts is readonly (TS2540)
        opts.includeAlerts = false
        // @ts-expect-error includeRecommendations is readonly (TS2540)
        opts.includeRecommendations = true
        // @ts-expect-error includeBenchmark is readonly (TS2540)
        opts.includeBenchmark = true
        // @ts-expect-error language is readonly (TS2540)
        opts.language = 'en'
        // @ts-expect-error depth is readonly (TS2540)
        opts.depth = 'brief'
      }

      expect(typeof tryMutate).toBe('function')
      expect(opts.includeAlerts).toBe(true)
      expect(opts.category).toBe('liquidity')
    })
  })

  describe('BenchmarkOptions', () => {
    it('should construct a fully-populated options object at runtime', () => {
      const opts: BenchmarkOptions = {
        sector: 'manufacturing',
        companySize: 'medium',
        employeeCount: 250,
        annualRevenue: 1_000_000,
      }

      expect(opts.sector).toBe('manufacturing')
      expect(opts.companySize).toBe('medium')
      expect(opts.employeeCount).toBe(250)
      expect(opts.annualRevenue).toBe(1_000_000)
    })

    it('should serialize to exactly the expected key set when fully populated', () => {
      const opts: BenchmarkOptions = {
        sector: 'retail',
        companySize: 'small',
        employeeCount: 10,
        annualRevenue: 50_000,
      }

      expect(Object.keys(opts).sort()).toEqual([
        'annualRevenue',
        'companySize',
        'employeeCount',
        'sector',
      ])
    })

    it('should be minimal-constructible with an empty object (every field optional)', () => {
      const opts: BenchmarkOptions = {}

      expect(opts.sector).toBeUndefined()
      expect(opts.companySize).toBeUndefined()
      expect(opts.employeeCount).toBeUndefined()
      expect(opts.annualRevenue).toBeUndefined()
      expect(Object.keys(opts)).toHaveLength(0)
    })

    it('should type every field as optional (T | undefined)', () => {
      expectTypeOf<BenchmarkOptions['sector']>().toEqualTypeOf<IndustrySector | undefined>()
      expectTypeOf<BenchmarkOptions['companySize']>().toEqualTypeOf<CompanySize | undefined>()
      expectTypeOf<BenchmarkOptions['employeeCount']>().toEqualTypeOf<number | undefined>()
      expectTypeOf<BenchmarkOptions['annualRevenue']>().toEqualTypeOf<number | undefined>()
    })

    it('should accept every IndustrySector value for the sector field', () => {
      for (const sector of INDUSTRY_SECTORS) {
        const opts: BenchmarkOptions = { sector }
        expect(INDUSTRY_SECTORS).toContain(opts.sector)
      }
    })

    it('should accept every CompanySize value for the companySize field', () => {
      for (const size of COMPANY_SIZES) {
        const opts: BenchmarkOptions = { companySize: size }
        expect(COMPANY_SIZES).toContain(opts.companySize)
      }
    })

    it('should accept boundary values for employeeCount and annualRevenue', () => {
      const zero: BenchmarkOptions = { employeeCount: 0, annualRevenue: 0 }
      const negative: BenchmarkOptions = { employeeCount: -1, annualRevenue: -1 }
      const max: BenchmarkOptions = {
        employeeCount: Number.MAX_SAFE_INTEGER,
        annualRevenue: Number.MAX_SAFE_INTEGER,
      }

      expect(zero.employeeCount).toBe(0)
      expect(zero.annualRevenue).toBe(0)
      expect(negative.employeeCount).toBe(-1)
      expect(negative.annualRevenue).toBe(-1)
      expect(max.employeeCount).toBe(Number.MAX_SAFE_INTEGER)
      expect(max.annualRevenue).toBe(Number.MAX_SAFE_INTEGER)
    })

    it('should enforce immutability: readonly fields cannot be reassigned', () => {
      const opts: BenchmarkOptions = { sector: 'manufacturing', companySize: 'medium' }
      const tryMutate = () => {
        // @ts-expect-error sector is readonly (TS2540)
        opts.sector = 'retail'
        // @ts-expect-error companySize is readonly (TS2540)
        opts.companySize = 'large'
        // @ts-expect-error employeeCount is readonly (TS2540)
        opts.employeeCount = 1
        // @ts-expect-error annualRevenue is readonly (TS2540)
        opts.annualRevenue = 2
      }

      expect(typeof tryMutate).toBe('function')
      expect(opts.sector).toBe('manufacturing')
      expect(opts.companySize).toBe('medium')
    })
  })

  describe('ReportOptions', () => {
    it('should construct a fully-populated options object at runtime', () => {
      const opts: ReportOptions = {
        sector: 'technology',
        companyName: 'Acme',
        fiscalYear: 2024,
        includeCharts: true,
      }

      expect(opts.sector).toBe('technology')
      expect(opts.companyName).toBe('Acme')
      expect(opts.fiscalYear).toBe(2024)
      expect(opts.includeCharts).toBe(true)
    })

    it('should serialize to exactly the expected key set when fully populated', () => {
      const opts: ReportOptions = {
        sector: 'finance',
        companyName: 'Globex',
        fiscalYear: 2025,
        includeCharts: false,
      }

      expect(Object.keys(opts).sort()).toEqual([
        'companyName',
        'fiscalYear',
        'includeCharts',
        'sector',
      ])
    })

    it('should be minimal-constructible with an empty object (every field optional)', () => {
      const opts: ReportOptions = {}

      expect(opts.sector).toBeUndefined()
      expect(opts.companyName).toBeUndefined()
      expect(opts.fiscalYear).toBeUndefined()
      expect(opts.includeCharts).toBeUndefined()
      expect(Object.keys(opts)).toHaveLength(0)
    })

    it('should type every field as optional (T | undefined)', () => {
      expectTypeOf<ReportOptions['sector']>().toEqualTypeOf<IndustrySector | undefined>()
      expectTypeOf<ReportOptions['companyName']>().toEqualTypeOf<string | undefined>()
      expectTypeOf<ReportOptions['fiscalYear']>().toEqualTypeOf<number | undefined>()
      expectTypeOf<ReportOptions['includeCharts']>().toEqualTypeOf<boolean | undefined>()
    })

    it('should accept every IndustrySector value for the sector field', () => {
      for (const sector of INDUSTRY_SECTORS) {
        const opts: ReportOptions = { sector }
        expect(INDUSTRY_SECTORS).toContain(opts.sector)
      }
    })

    it('should accept an empty string for companyName as a boundary input', () => {
      const opts: ReportOptions = { companyName: '' }
      expect(opts.companyName).toBe('')
    })

    it('should accept boundary values for fiscalYear', () => {
      const zero: ReportOptions = { fiscalYear: 0 }
      const negative: ReportOptions = { fiscalYear: -1 }
      const max: ReportOptions = { fiscalYear: Number.MAX_SAFE_INTEGER }

      expect(zero.fiscalYear).toBe(0)
      expect(negative.fiscalYear).toBe(-1)
      expect(max.fiscalYear).toBe(Number.MAX_SAFE_INTEGER)
    })

    it('should accept both polarities for includeCharts', () => {
      const on: ReportOptions = { includeCharts: true }
      const off: ReportOptions = { includeCharts: false }
      expect(on.includeCharts).toBe(true)
      expect(off.includeCharts).toBe(false)
    })

    it('should enforce immutability: readonly fields cannot be reassigned', () => {
      const opts: ReportOptions = { companyName: 'Acme', fiscalYear: 2024 }
      const tryMutate = () => {
        // @ts-expect-error sector is readonly (TS2540)
        opts.sector = 'retail'
        // @ts-expect-error companyName is readonly (TS2540)
        opts.companyName = 'Other'
        // @ts-expect-error fiscalYear is readonly (TS2540)
        opts.fiscalYear = 2025
        // @ts-expect-error includeCharts is readonly (TS2540)
        opts.includeCharts = false
      }

      expect(typeof tryMutate).toBe('function')
      expect(opts.companyName).toBe('Acme')
      expect(opts.fiscalYear).toBe(2024)
    })
  })

  describe('AnalysisRequest', () => {
    it('should construct a fully-populated request at runtime', () => {
      const req: AnalysisRequest = {
        balanceSheet: makeBalanceSheet(),
        profitLoss: makeProfitLoss(),
        cashFlow: makeCashFlow(),
        previousBalanceSheet: makeBalanceSheet({ fiscalYear: 2023 }),
        previousProfitLoss: makeProfitLoss({ fiscalYear: 2023 }),
        options: { category: 'liquidity', depth: 'detailed' },
        benchmarkOptions: { sector: 'manufacturing', companySize: 'medium' },
      }

      expect(req.balanceSheet.fiscalYear).toBe(2024)
      expect(req.profitLoss.fiscalYear).toBe(2024)
      expect(req.cashFlow?.endingCash).toBe(600)
      expect(req.previousBalanceSheet?.fiscalYear).toBe(2023)
      expect(req.previousProfitLoss?.fiscalYear).toBe(2023)
      expect(req.options?.category).toBe('liquidity')
      expect(req.benchmarkOptions?.sector).toBe('manufacturing')
    })

    it('should serialize to exactly the expected key set when fully populated', () => {
      const req: AnalysisRequest = {
        balanceSheet: makeBalanceSheet(),
        profitLoss: makeProfitLoss(),
        cashFlow: makeCashFlow(),
        previousBalanceSheet: makeBalanceSheet(),
        previousProfitLoss: makeProfitLoss(),
        options: {},
        benchmarkOptions: {},
      }

      expect(Object.keys(req).sort()).toEqual([
        'balanceSheet',
        'benchmarkOptions',
        'cashFlow',
        'options',
        'previousBalanceSheet',
        'previousProfitLoss',
        'profitLoss',
      ])
    })

    it('should be minimal-constructible with only the required pair', () => {
      const req: AnalysisRequest = {
        balanceSheet: makeBalanceSheet(),
        profitLoss: makeProfitLoss(),
      }

      expect(req.cashFlow).toBeUndefined()
      expect(req.previousBalanceSheet).toBeUndefined()
      expect(req.previousProfitLoss).toBeUndefined()
      expect(req.options).toBeUndefined()
      expect(req.benchmarkOptions).toBeUndefined()
      expect(Object.keys(req).sort()).toEqual(['balanceSheet', 'profitLoss'])
    })

    it('should type required vs optional fields correctly', () => {
      expectTypeOf<AnalysisRequest['balanceSheet']>().toEqualTypeOf<BalanceSheet>()
      expectTypeOf<AnalysisRequest['profitLoss']>().toEqualTypeOf<ProfitLoss>()
      expectTypeOf<AnalysisRequest['cashFlow']>().toEqualTypeOf<CashFlowStatement | undefined>()
      expectTypeOf<AnalysisRequest['previousBalanceSheet']>().toEqualTypeOf<
        BalanceSheet | undefined
      >()
      expectTypeOf<AnalysisRequest['previousProfitLoss']>().toEqualTypeOf<ProfitLoss | undefined>()
      expectTypeOf<AnalysisRequest['options']>().toEqualTypeOf<AnalysisOptions | undefined>()
      expectTypeOf<AnalysisRequest['benchmarkOptions']>().toEqualTypeOf<
        BenchmarkOptions | undefined
      >()
    })

    it('should carry balanceSheet and profitLoss by identity', () => {
      const bs = makeBalanceSheet()
      const pl = makeProfitLoss()
      const req: AnalysisRequest = { balanceSheet: bs, profitLoss: pl }

      expect(req.balanceSheet).toBe(bs)
      expect(req.profitLoss).toBe(pl)
    })

    it('should carry nested options and benchmarkOptions by identity', () => {
      const options: AnalysisOptions = { category: 'safety', includeAlerts: true }
      const benchmarkOptions: BenchmarkOptions = { sector: 'retail' }
      const req: AnalysisRequest = {
        balanceSheet: makeBalanceSheet(),
        profitLoss: makeProfitLoss(),
        options,
        benchmarkOptions,
      }

      expect(req.options).toBe(options)
      expect(req.benchmarkOptions).toBe(benchmarkOptions)
    })

    it('should fail-safe at compile time: missing balanceSheet does not satisfy AnalysisRequest', () => {
      type NoBS = { profitLoss: ProfitLoss }
      expectTypeOf<NoBS>().not.toMatchTypeOf<AnalysisRequest>()
    })

    it('should fail-safe at compile time: missing profitLoss does not satisfy AnalysisRequest', () => {
      type NoPL = { balanceSheet: BalanceSheet }
      expectTypeOf<NoPL>().not.toMatchTypeOf<AnalysisRequest>()
    })

    it('should enforce immutability: readonly fields cannot be reassigned', () => {
      const req: AnalysisRequest = {
        balanceSheet: makeBalanceSheet(),
        profitLoss: makeProfitLoss(),
      }
      const tryMutate = () => {
        // @ts-expect-error balanceSheet is readonly (TS2540)
        req.balanceSheet = makeBalanceSheet()
        // @ts-expect-error profitLoss is readonly (TS2540)
        req.profitLoss = makeProfitLoss()
        // @ts-expect-error cashFlow is readonly (TS2540)
        req.cashFlow = makeCashFlow()
        // @ts-expect-error previousBalanceSheet is readonly (TS2540)
        req.previousBalanceSheet = makeBalanceSheet()
        // @ts-expect-error previousProfitLoss is readonly (TS2540)
        req.previousProfitLoss = makeProfitLoss()
        // @ts-expect-error options is readonly (TS2540)
        req.options = {}
        // @ts-expect-error benchmarkOptions is readonly (TS2540)
        req.benchmarkOptions = {}
      }

      expect(typeof tryMutate).toBe('function')
      expect(req.balanceSheet.fiscalYear).toBe(2024)
    })
  })

  describe('RatioAnalysisRequest', () => {
    it('should construct a fully-populated request at runtime', () => {
      const req: RatioAnalysisRequest = {
        balanceSheet: makeBalanceSheet(),
        profitLoss: makeProfitLoss(),
        previousBalanceSheet: makeBalanceSheet({ fiscalYear: 2023 }),
        previousProfitLoss: makeProfitLoss({ fiscalYear: 2023 }),
        categories: ['liquidity', 'safety', 'profitability'],
      }

      expect(req.balanceSheet.fiscalYear).toBe(2024)
      expect(req.profitLoss.fiscalYear).toBe(2024)
      expect(req.previousBalanceSheet?.fiscalYear).toBe(2023)
      expect(req.previousProfitLoss?.fiscalYear).toBe(2023)
      expect(req.categories).toEqual(['liquidity', 'safety', 'profitability'])
    })

    it('should serialize to exactly the expected key set when fully populated', () => {
      const req: RatioAnalysisRequest = {
        balanceSheet: makeBalanceSheet(),
        profitLoss: makeProfitLoss(),
        previousBalanceSheet: makeBalanceSheet(),
        previousProfitLoss: makeProfitLoss(),
        categories: ['growth'],
      }

      expect(Object.keys(req).sort()).toEqual([
        'balanceSheet',
        'categories',
        'previousBalanceSheet',
        'previousProfitLoss',
        'profitLoss',
      ])
    })

    it('should be minimal-constructible with only the required pair', () => {
      const req: RatioAnalysisRequest = {
        balanceSheet: makeBalanceSheet(),
        profitLoss: makeProfitLoss(),
      }

      expect(req.previousBalanceSheet).toBeUndefined()
      expect(req.previousProfitLoss).toBeUndefined()
      expect(req.categories).toBeUndefined()
      expect(Object.keys(req).sort()).toEqual(['balanceSheet', 'profitLoss'])
    })

    it('should type required vs optional fields correctly', () => {
      expectTypeOf<RatioAnalysisRequest['balanceSheet']>().toEqualTypeOf<BalanceSheet>()
      expectTypeOf<RatioAnalysisRequest['profitLoss']>().toEqualTypeOf<ProfitLoss>()
      expectTypeOf<RatioAnalysisRequest['previousBalanceSheet']>().toEqualTypeOf<
        BalanceSheet | undefined
      >()
      expectTypeOf<RatioAnalysisRequest['previousProfitLoss']>().toEqualTypeOf<
        ProfitLoss | undefined
      >()
      expectTypeOf<RatioAnalysisRequest['categories']>().toEqualTypeOf<
        readonly RatioCategory[] | undefined
      >()
    })

    it('should accept a readonly array of RatioCategory for categories', () => {
      const cats: readonly RatioCategory[] = ['liquidity', 'efficiency']
      const req: RatioAnalysisRequest = {
        balanceSheet: makeBalanceSheet(),
        profitLoss: makeProfitLoss(),
        categories: cats,
      }

      expect(req.categories).toBe(cats)
      expect(req.categories).toEqual(['liquidity', 'efficiency'])
    })

    it('should accept an empty categories array as a boundary input', () => {
      const req: RatioAnalysisRequest = {
        balanceSheet: makeBalanceSheet(),
        profitLoss: makeProfitLoss(),
        categories: [],
      }

      expect(req.categories).toHaveLength(0)
    })

    it('should fail-safe at compile time: missing balanceSheet does not satisfy RatioAnalysisRequest', () => {
      type NoBS = { profitLoss: ProfitLoss }
      expectTypeOf<NoBS>().not.toMatchTypeOf<RatioAnalysisRequest>()
    })

    it('should fail-safe at compile time: missing profitLoss does not satisfy RatioAnalysisRequest', () => {
      type NoPL = { balanceSheet: BalanceSheet }
      expectTypeOf<NoPL>().not.toMatchTypeOf<RatioAnalysisRequest>()
    })

    it('should enforce immutability: readonly fields cannot be reassigned', () => {
      const req: RatioAnalysisRequest = {
        balanceSheet: makeBalanceSheet(),
        profitLoss: makeProfitLoss(),
        categories: ['liquidity'],
      }
      const tryMutate = () => {
        // @ts-expect-error balanceSheet is readonly (TS2540)
        req.balanceSheet = makeBalanceSheet()
        // @ts-expect-error profitLoss is readonly (TS2540)
        req.profitLoss = makeProfitLoss()
        // @ts-expect-error previousBalanceSheet is readonly (TS2540)
        req.previousBalanceSheet = makeBalanceSheet()
        // @ts-expect-error previousProfitLoss is readonly (TS2540)
        req.previousProfitLoss = makeProfitLoss()
        // @ts-expect-error categories is readonly (TS2540)
        req.categories = ['growth']
      }

      expect(typeof tryMutate).toBe('function')
      expect(req.categories).toEqual(['liquidity'])
    })
  })

  describe('BenchmarkRequest', () => {
    it('should construct a fully-populated request at runtime', () => {
      const req: BenchmarkRequest = {
        ratios: { current_ratio: 1.5, debt_ratio: 0.4 },
        sector: 'manufacturing',
        companySize: 'medium',
        employeeCount: 250,
        annualRevenue: 1_000_000,
      }

      expect(req.ratios.current_ratio).toBe(1.5)
      expect(req.ratios.debt_ratio).toBe(0.4)
      expect(req.sector).toBe('manufacturing')
      expect(req.companySize).toBe('medium')
      expect(req.employeeCount).toBe(250)
      expect(req.annualRevenue).toBe(1_000_000)
    })

    it('should serialize to exactly the expected key set when fully populated', () => {
      const req: BenchmarkRequest = {
        ratios: { a: 1 },
        sector: 'retail',
        companySize: 'small',
        employeeCount: 10,
        annualRevenue: 50_000,
      }

      expect(Object.keys(req).sort()).toEqual([
        'annualRevenue',
        'companySize',
        'employeeCount',
        'ratios',
        'sector',
      ])
    })

    it('should be minimal-constructible with only the required ratios field', () => {
      const req: BenchmarkRequest = { ratios: {} }

      expect(req.sector).toBeUndefined()
      expect(req.companySize).toBeUndefined()
      expect(req.employeeCount).toBeUndefined()
      expect(req.annualRevenue).toBeUndefined()
      expect(Object.keys(req)).toEqual(['ratios'])
    })

    it('should type required vs optional fields correctly', () => {
      expectTypeOf<BenchmarkRequest['ratios']>().toEqualTypeOf<Record<string, number>>()
      expectTypeOf<BenchmarkRequest['sector']>().toEqualTypeOf<IndustrySector | undefined>()
      expectTypeOf<BenchmarkRequest['companySize']>().toEqualTypeOf<CompanySize | undefined>()
      expectTypeOf<BenchmarkRequest['employeeCount']>().toEqualTypeOf<number | undefined>()
      expectTypeOf<BenchmarkRequest['annualRevenue']>().toEqualTypeOf<number | undefined>()
    })

    it('should accept an empty ratios record as a boundary input', () => {
      const req: BenchmarkRequest = { ratios: {} }
      expect(Object.keys(req.ratios)).toHaveLength(0)
    })

    it('should accept boundary ratio values (zero, negative, max)', () => {
      const req: BenchmarkRequest = {
        ratios: {
          zero: 0,
          negative: -1.5,
          max: Number.MAX_SAFE_INTEGER,
          fractional: 0.0001,
        },
      }

      expect(req.ratios.zero).toBe(0)
      expect(req.ratios.negative).toBe(-1.5)
      expect(req.ratios.max).toBe(Number.MAX_SAFE_INTEGER)
      expect(req.ratios.fractional).toBe(0.0001)
    })

    it('should accept boundary values for employeeCount and annualRevenue', () => {
      const req: BenchmarkRequest = {
        ratios: { a: 1 },
        employeeCount: 0,
        annualRevenue: Number.MAX_SAFE_INTEGER,
      }

      expect(req.employeeCount).toBe(0)
      expect(req.annualRevenue).toBe(Number.MAX_SAFE_INTEGER)
    })

    it('should carry the ratios record by identity', () => {
      const ratios: Record<string, number> = { current_ratio: 2.1 }
      const req: BenchmarkRequest = { ratios }

      expect(req.ratios).toBe(ratios)
    })

    it('should fail-safe at compile time: missing ratios does not satisfy BenchmarkRequest', () => {
      type NoRatios = { sector: IndustrySector; companySize: CompanySize }
      expectTypeOf<NoRatios>().not.toMatchTypeOf<BenchmarkRequest>()
    })

    it('should enforce immutability: readonly fields cannot be reassigned', () => {
      const req: BenchmarkRequest = { ratios: { a: 1 }, sector: 'manufacturing' }
      const tryMutate = () => {
        // @ts-expect-error ratios is readonly (TS2540)
        req.ratios = { b: 2 }
        // @ts-expect-error sector is readonly (TS2540)
        req.sector = 'retail'
        // @ts-expect-error companySize is readonly (TS2540)
        req.companySize = 'large'
        // @ts-expect-error employeeCount is readonly (TS2540)
        req.employeeCount = 1
        // @ts-expect-error annualRevenue is readonly (TS2540)
        req.annualRevenue = 2
      }

      expect(typeof tryMutate).toBe('function')
      expect(req.sector).toBe('manufacturing')
    })
  })

  describe('ReportRequest', () => {
    it('should construct a fully-populated request at runtime', () => {
      const req: ReportRequest = {
        balanceSheet: makeBalanceSheet(),
        profitLoss: makeProfitLoss(),
        cashFlow: makeCashFlow(),
        previousBalanceSheet: makeBalanceSheet({ fiscalYear: 2023 }),
        previousProfitLoss: makeProfitLoss({ fiscalYear: 2023 }),
        reportType: 'investor',
        format: 'html',
        options: { sector: 'technology', includeCharts: true },
      }

      expect(req.balanceSheet.fiscalYear).toBe(2024)
      expect(req.profitLoss.fiscalYear).toBe(2024)
      expect(req.cashFlow?.endingCash).toBe(600)
      expect(req.previousBalanceSheet?.fiscalYear).toBe(2023)
      expect(req.previousProfitLoss?.fiscalYear).toBe(2023)
      expect(req.reportType).toBe('investor')
      expect(req.format).toBe('html')
      expect(req.options?.sector).toBe('technology')
    })

    it('should serialize to exactly the expected key set when fully populated', () => {
      const req: ReportRequest = {
        balanceSheet: makeBalanceSheet(),
        profitLoss: makeProfitLoss(),
        cashFlow: makeCashFlow(),
        previousBalanceSheet: makeBalanceSheet(),
        previousProfitLoss: makeProfitLoss(),
        reportType: 'management',
        format: 'markdown',
        options: {},
      }

      expect(Object.keys(req).sort()).toEqual([
        'balanceSheet',
        'cashFlow',
        'format',
        'options',
        'previousBalanceSheet',
        'previousProfitLoss',
        'profitLoss',
        'reportType',
      ])
    })

    it('should be minimal-constructible with only the required trio', () => {
      const req: ReportRequest = {
        balanceSheet: makeBalanceSheet(),
        profitLoss: makeProfitLoss(),
        reportType: 'summary',
      }

      expect(req.cashFlow).toBeUndefined()
      expect(req.previousBalanceSheet).toBeUndefined()
      expect(req.previousProfitLoss).toBeUndefined()
      expect(req.format).toBeUndefined()
      expect(req.options).toBeUndefined()
      expect(Object.keys(req).sort()).toEqual(['balanceSheet', 'profitLoss', 'reportType'])
    })

    it('should type required vs optional fields correctly', () => {
      expectTypeOf<ReportRequest['balanceSheet']>().toEqualTypeOf<BalanceSheet>()
      expectTypeOf<ReportRequest['profitLoss']>().toEqualTypeOf<ProfitLoss>()
      expectTypeOf<ReportRequest['cashFlow']>().toEqualTypeOf<CashFlowStatement | undefined>()
      expectTypeOf<ReportRequest['previousBalanceSheet']>().toEqualTypeOf<
        BalanceSheet | undefined
      >()
      expectTypeOf<ReportRequest['previousProfitLoss']>().toEqualTypeOf<ProfitLoss | undefined>()
      expectTypeOf<ReportRequest['reportType']>().toEqualTypeOf<ReportType>()
      expectTypeOf<ReportRequest['format']>().toEqualTypeOf<ReportFormat | undefined>()
      expectTypeOf<ReportRequest['options']>().toEqualTypeOf<ReportOptions | undefined>()
    })

    it('should accept every ReportType value for the reportType field', () => {
      for (const rt of REPORT_TYPES) {
        const req: ReportRequest = {
          balanceSheet: makeBalanceSheet(),
          profitLoss: makeProfitLoss(),
          reportType: rt,
        }
        expect(REPORT_TYPES).toContain(req.reportType)
      }
    })

    it('should accept every ReportFormat value for the format field', () => {
      for (const fmt of REPORT_FORMATS) {
        const req: ReportRequest = {
          balanceSheet: makeBalanceSheet(),
          profitLoss: makeProfitLoss(),
          reportType: 'summary',
          format: fmt,
        }
        expect(REPORT_FORMATS).toContain(req.format)
      }
    })

    it('should carry reportType and nested options by identity', () => {
      const options: ReportOptions = { companyName: 'Acme', fiscalYear: 2024 }
      const req: ReportRequest = {
        balanceSheet: makeBalanceSheet(),
        profitLoss: makeProfitLoss(),
        reportType: 'detailed',
        options,
      }

      expect(req.options).toBe(options)
    })

    it('should fail-safe at compile time: missing reportType does not satisfy ReportRequest', () => {
      type NoReportType = { balanceSheet: BalanceSheet; profitLoss: ProfitLoss }
      expectTypeOf<NoReportType>().not.toMatchTypeOf<ReportRequest>()
    })

    it('should fail-safe at compile time: missing balanceSheet does not satisfy ReportRequest', () => {
      type NoBS = { profitLoss: ProfitLoss; reportType: ReportType }
      expectTypeOf<NoBS>().not.toMatchTypeOf<ReportRequest>()
    })

    it('should enforce immutability: readonly fields cannot be reassigned', () => {
      const req: ReportRequest = {
        balanceSheet: makeBalanceSheet(),
        profitLoss: makeProfitLoss(),
        reportType: 'summary',
      }
      const tryMutate = () => {
        // @ts-expect-error balanceSheet is readonly (TS2540)
        req.balanceSheet = makeBalanceSheet()
        // @ts-expect-error profitLoss is readonly (TS2540)
        req.profitLoss = makeProfitLoss()
        // @ts-expect-error cashFlow is readonly (TS2540)
        req.cashFlow = makeCashFlow()
        // @ts-expect-error previousBalanceSheet is readonly (TS2540)
        req.previousBalanceSheet = makeBalanceSheet()
        // @ts-expect-error previousProfitLoss is readonly (TS2540)
        req.previousProfitLoss = makeProfitLoss()
        // @ts-expect-error reportType is readonly (TS2540)
        req.reportType = 'detailed'
        // @ts-expect-error format is readonly (TS2540)
        req.format = 'html'
        // @ts-expect-error options is readonly (TS2540)
        req.options = {}
      }

      expect(typeof tryMutate).toBe('function')
      expect(req.reportType).toBe('summary')
    })
  })
})
