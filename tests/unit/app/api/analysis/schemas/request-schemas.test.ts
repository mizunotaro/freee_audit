import { z } from 'zod'
import {
  BalanceSheetItemSchema,
  BalanceSheetSchema,
  ProfitLossItemSchema,
  ProfitLossSchema,
  CashFlowStatementSchema,
  AnalysisOptionsSchema,
  BenchmarkOptionsSchema,
  AnalysisRequestSchema,
  RatioCategorySchema,
  RatioAnalysisRequestSchema,
  BenchmarkRequestSchema,
  ReportTypeSchema,
  ReportFormatSchema,
  ReportOptionsSchema,
  ReportRequestSchema,
} from '@/app/api/analysis/schemas/request-schemas'

const accepts = (schema: z.ZodTypeAny, value: unknown) =>
  expect(schema.safeParse(value).success).toBe(true)
const rejects = (schema: z.ZodTypeAny, value: unknown) =>
  expect(schema.safeParse(value).success).toBe(false)

const balanceSheetItem = {
  code: '1000',
  name: '現金及び預金',
  amount: 1000,
}

const balanceSheet = {
  fiscalYear: 2024,
  month: 12,
  assets: {
    current: [{ code: '1000', name: '流動資産', amount: 1000 }],
    fixed: [{ code: '1500', name: '固定資産', amount: 5000 }],
    total: 6000,
  },
  liabilities: {
    current: [{ code: '2000', name: '流動負債', amount: 500 }],
    fixed: [{ code: '2500', name: '固定負債', amount: 1000 }],
    total: 1500,
  },
  equity: {
    items: [{ code: '3000', name: '純資産', amount: 4500 }],
    total: 4500,
  },
  totalAssets: 6000,
  totalLiabilities: 1500,
  totalEquity: 4500,
}

const profitLossItem = {
  code: '4000',
  name: '売上高',
  amount: 10000,
}

const profitLoss = {
  fiscalYear: 2024,
  month: 12,
  revenue: [{ code: '4000', name: '売上高', amount: 10000 }],
  costOfSales: [{ code: '5000', name: '売上原価', amount: 6000 }],
  grossProfit: 4000,
  grossProfitMargin: 40,
  sgaExpenses: [{ code: '6000', name: '販売一般費', amount: 1000 }],
  operatingIncome: 3000,
  operatingMargin: 30,
  nonOperatingIncome: [{ code: '7100', name: '営業外収益', amount: 100 }],
  nonOperatingExpenses: [{ code: '7200', name: '営業外費用', amount: 50 }],
  ordinaryIncome: 3050,
  extraordinaryIncome: [{ code: '8100', name: '特別利益', amount: 200 }],
  extraordinaryLoss: [{ code: '8200', name: '特別損失', amount: 100 }],
  incomeBeforeTax: 3150,
  incomeTax: 800,
  netIncome: 2350,
  depreciation: 500,
}

const cashFlow = {
  netChangeInCash: 1000,
  beginningCash: 5000,
  endingCash: 6000,
}

describe('request-schemas', () => {
  describe('BalanceSheetItemSchema', () => {
    it('accepts a minimal valid item', () => {
      accepts(BalanceSheetItemSchema, balanceSheetItem)
    })

    it('accepts an item with previousAmount', () => {
      accepts(BalanceSheetItemSchema, { ...balanceSheetItem, previousAmount: 900 })
    })

    it('accepts recursively nested children', () => {
      accepts(BalanceSheetItemSchema, {
        ...balanceSheetItem,
        children: [
          {
            code: '1010',
            name: '子科目',
            amount: 600,
            children: [{ code: '1011', name: '孫科目', amount: 200 }],
          },
        ],
      })
    })

    it('rejects empty code (min 1)', () => {
      rejects(BalanceSheetItemSchema, { ...balanceSheetItem, code: '' })
    })

    it('rejects code over 50 chars (max 50)', () => {
      rejects(BalanceSheetItemSchema, { ...balanceSheetItem, code: 'a'.repeat(51) })
      accepts(BalanceSheetItemSchema, { ...balanceSheetItem, code: 'a'.repeat(50) })
    })

    it('rejects empty name (min 1)', () => {
      rejects(BalanceSheetItemSchema, { ...balanceSheetItem, name: '' })
    })

    it('rejects name over 200 chars (max 200)', () => {
      rejects(BalanceSheetItemSchema, { ...balanceSheetItem, name: 'a'.repeat(201) })
    })

    it('rejects non-finite amount (NaN / Infinity)', () => {
      rejects(BalanceSheetItemSchema, { ...balanceSheetItem, amount: NaN })
      rejects(BalanceSheetItemSchema, { ...balanceSheetItem, amount: Infinity })
      rejects(BalanceSheetItemSchema, { ...balanceSheetItem, amount: -Infinity })
    })

    it('accepts negative amount (no sign constraint)', () => {
      accepts(BalanceSheetItemSchema, { ...balanceSheetItem, amount: -250 })
    })

    it('rejects non-finite previousAmount', () => {
      rejects(BalanceSheetItemSchema, { ...balanceSheetItem, previousAmount: Infinity })
    })

    it('rejects missing required field', () => {
      rejects(BalanceSheetItemSchema, { code: '1000', name: '現金' })
      rejects(BalanceSheetItemSchema, { name: '現金', amount: 1000 })
    })

    it('rejects wrong types', () => {
      rejects(BalanceSheetItemSchema, { ...balanceSheetItem, amount: '1000' })
      rejects(BalanceSheetItemSchema, null)
      rejects(BalanceSheetItemSchema, undefined)
      rejects(BalanceSheetItemSchema, 'string')
    })

    it('rejects children that are not an array', () => {
      rejects(BalanceSheetItemSchema, {
        ...balanceSheetItem,
        children: { code: '1', name: 'x', amount: 1 },
      })
    })
  })

  describe('BalanceSheetSchema', () => {
    it('accepts a valid balance sheet', () => {
      accepts(BalanceSheetSchema, balanceSheet)
    })

    it('accepts boundary fiscalYear 1900 and 2100', () => {
      accepts(BalanceSheetSchema, { ...balanceSheet, fiscalYear: 1900 })
      accepts(BalanceSheetSchema, { ...balanceSheet, fiscalYear: 2100 })
    })

    it('rejects fiscalYear outside 1900-2100 and non-integers', () => {
      rejects(BalanceSheetSchema, { ...balanceSheet, fiscalYear: 1899 })
      rejects(BalanceSheetSchema, { ...balanceSheet, fiscalYear: 2101 })
      rejects(BalanceSheetSchema, { ...balanceSheet, fiscalYear: 2024.5 })
    })

    it('accepts boundary month 1 and 12, rejects 0 and 13', () => {
      accepts(BalanceSheetSchema, { ...balanceSheet, month: 1 })
      accepts(BalanceSheetSchema, { ...balanceSheet, month: 12 })
      rejects(BalanceSheetSchema, { ...balanceSheet, month: 0 })
      rejects(BalanceSheetSchema, { ...balanceSheet, month: 13 })
      rejects(BalanceSheetSchema, { ...balanceSheet, month: 6.5 })
    })

    it('rejects negative assets/liabilities totals (nonnegative)', () => {
      rejects(BalanceSheetSchema, {
        ...balanceSheet,
        assets: { ...balanceSheet.assets, total: -1 },
      })
      rejects(BalanceSheetSchema, {
        ...balanceSheet,
        liabilities: { ...balanceSheet.liabilities, total: -1 },
      })
    })

    it('accepts zero assets/liabilities totals', () => {
      accepts(BalanceSheetSchema, {
        ...balanceSheet,
        assets: { ...balanceSheet.assets, total: 0 },
        liabilities: { ...balanceSheet.liabilities, total: 0 },
      })
    })

    it('rejects totalAssets <= 0 (must be positive)', () => {
      rejects(BalanceSheetSchema, { ...balanceSheet, totalAssets: 0 })
      rejects(BalanceSheetSchema, { ...balanceSheet, totalAssets: -10 })
    })

    it('rejects negative totalLiabilities but allows zero', () => {
      rejects(BalanceSheetSchema, { ...balanceSheet, totalLiabilities: -1 })
      accepts(BalanceSheetSchema, { ...balanceSheet, totalLiabilities: 0 })
    })

    it('allows negative totalEquity (deficit is finite, not sign-bounded)', () => {
      accepts(BalanceSheetSchema, { ...balanceSheet, totalEquity: -500 })
    })

    it('rejects non-finite totals', () => {
      rejects(BalanceSheetSchema, { ...balanceSheet, totalAssets: Infinity })
      rejects(BalanceSheetSchema, { ...balanceSheet, totalEquity: NaN })
    })

    it('rejects when a required nested section is missing', () => {
      const { equity, ...withoutEquity } = balanceSheet
      void equity
      rejects(BalanceSheetSchema, withoutEquity)
    })

    it('strips unknown keys (non-strict object)', () => {
      const result = BalanceSheetSchema.safeParse({ ...balanceSheet, extra: 'ignored' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).not.toHaveProperty('extra')
      }
    })
  })

  describe('ProfitLossItemSchema', () => {
    it('accepts a minimal valid item', () => {
      accepts(ProfitLossItemSchema, profitLossItem)
    })

    it('accepts an item with all optional fields', () => {
      accepts(ProfitLossItemSchema, {
        ...profitLossItem,
        previousAmount: 9000,
        percentage: 42.5,
        category: 'revenue',
      })
    })

    it('rejects percentage outside 0-100', () => {
      rejects(ProfitLossItemSchema, { ...profitLossItem, percentage: -1 })
      rejects(ProfitLossItemSchema, { ...profitLossItem, percentage: 101 })
      accepts(ProfitLossItemSchema, { ...profitLossItem, percentage: 0 })
      accepts(ProfitLossItemSchema, { ...profitLossItem, percentage: 100 })
    })

    it('rejects category over 100 chars', () => {
      rejects(ProfitLossItemSchema, { ...profitLossItem, category: 'a'.repeat(101) })
    })

    it('rejects non-finite amount', () => {
      rejects(ProfitLossItemSchema, { ...profitLossItem, amount: Infinity })
      rejects(ProfitLossItemSchema, { ...profitLossItem, amount: NaN })
    })

    it('rejects empty code / name', () => {
      rejects(ProfitLossItemSchema, { ...profitLossItem, code: '' })
      rejects(ProfitLossItemSchema, { ...profitLossItem, name: '' })
    })
  })

  describe('ProfitLossSchema', () => {
    it('accepts a valid profit & loss', () => {
      accepts(ProfitLossSchema, profitLoss)
    })

    it('rejects fiscalYear / month out of range', () => {
      rejects(ProfitLossSchema, { ...profitLoss, fiscalYear: 1899 })
      rejects(ProfitLossSchema, { ...profitLoss, month: 13 })
    })

    it('rejects non-finite scalar fields', () => {
      rejects(ProfitLossSchema, { ...profitLoss, grossProfit: Infinity })
      rejects(ProfitLossSchema, { ...profitLoss, netIncome: NaN })
    })

    it('rejects when a required section is missing', () => {
      const { operatingIncome, ...rest } = profitLoss
      void operatingIncome
      rejects(ProfitLossSchema, rest)
    })

    it('rejects when an array field is the wrong type', () => {
      rejects(ProfitLossSchema, { ...profitLoss, revenue: { code: '1', name: 'x', amount: 1 } })
    })
  })

  describe('CashFlowStatementSchema', () => {
    it('accepts a minimal statement (only required scalar totals)', () => {
      accepts(CashFlowStatementSchema, cashFlow)
    })

    it('accepts a full statement with summary + detailed activities and dates', () => {
      accepts(CashFlowStatementSchema, {
        ...cashFlow,
        operating: {
          items: [{ name: '営業CF', amount: 1000 }],
          netCashFromOperating: 1000,
        },
        investing: {
          items: [{ name: '投資CF', amount: -500 }],
          netCashFromInvesting: -500,
        },
        financing: {
          items: [{ name: '財務CF', amount: 500 }],
          netCashFromFinancing: 500,
        },
        operatingActivities: {
          netIncome: 2350,
          depreciation: 500,
          amortization: 0,
          deferredTaxChange: 10,
          increaseInReceivables: -20,
          decreaseInInventory: -30,
          increaseInPayables: 40,
          otherNonCash: 0,
          netCashFromOperating: 1000,
        },
        investingActivities: {
          purchaseOfFixedAssets: -600,
          saleOfFixedAssets: 100,
          netCashFromInvesting: -500,
        },
        financingActivities: {
          proceedsFromBorrowing: 800,
          repaymentOfBorrowing: -200,
          dividendPaid: -100,
          interestPaid: -0,
          netCashFromFinancing: 500,
        },
        fiscalYear: 2024,
        month: 12,
        periodStart: new Date('2024-01-01T00:00:00.000Z'),
        periodEnd: new Date('2024-12-31T00:00:00.000Z'),
      })
    })

    it('rejects periodStart given as a string (must be a Date instance)', () => {
      rejects(CashFlowStatementSchema, { ...cashFlow, periodStart: '2024-01-01' })
    })

    it('rejects non-finite required totals', () => {
      rejects(CashFlowStatementSchema, { ...cashFlow, netChangeInCash: Infinity })
      rejects(CashFlowStatementSchema, { ...cashFlow, beginningCash: NaN })
    })

    it('rejects missing required total', () => {
      const { endingCash, ...rest } = cashFlow
      void endingCash
      rejects(CashFlowStatementSchema, rest)
    })

    it('rejects malformed activity section (non-finite member)', () => {
      rejects(CashFlowStatementSchema, {
        ...cashFlow,
        operatingActivities: {
          netIncome: NaN,
          depreciation: 0,
          amortization: 0,
          deferredTaxChange: 0,
          increaseInReceivables: 0,
          decreaseInInventory: 0,
          increaseInPayables: 0,
          otherNonCash: 0,
          netCashFromOperating: 0,
        },
      })
    })

    it('rejects malformed summary section item (wrong field type)', () => {
      rejects(CashFlowStatementSchema, {
        ...cashFlow,
        investing: { items: [{ name: 'x', amount: 'bad' }], netCashFromInvesting: 0 },
      })
    })

    it('rejects fiscalYear/month out of range', () => {
      rejects(CashFlowStatementSchema, { ...cashFlow, fiscalYear: 1800 })
      rejects(CashFlowStatementSchema, { ...cashFlow, month: 13 })
    })
  })

  describe('AnalysisOptionsSchema', () => {
    it('accepts an empty object (all optional)', () => {
      accepts(AnalysisOptionsSchema, {})
    })

    it('accepts a fully-populated options object', () => {
      accepts(AnalysisOptionsSchema, {
        category: 'comprehensive',
        includeAlerts: true,
        includeRecommendations: false,
        includeBenchmark: true,
        language: 'ja',
        depth: 'detailed',
      })
    })

    it('accepts every defined category enum value', () => {
      for (const category of [
        'liquidity',
        'safety',
        'profitability',
        'efficiency',
        'growth',
        'cashflow',
        'comprehensive',
      ]) {
        accepts(AnalysisOptionsSchema, { category })
      }
    })

    it('rejects an unknown category', () => {
      rejects(AnalysisOptionsSchema, { category: 'unknown' })
    })

    it('accepts ja/en and rejects other languages', () => {
      accepts(AnalysisOptionsSchema, { language: 'ja' })
      accepts(AnalysisOptionsSchema, { language: 'en' })
      rejects(AnalysisOptionsSchema, { language: 'fr' })
    })

    it('accepts every depth and rejects unknown depth', () => {
      for (const depth of ['brief', 'standard', 'detailed', 'comprehensive']) {
        accepts(AnalysisOptionsSchema, { depth })
      }
      rejects(AnalysisOptionsSchema, { depth: 'super' })
    })

    it('rejects non-boolean flags', () => {
      rejects(AnalysisOptionsSchema, { includeAlerts: 'yes' })
      rejects(AnalysisOptionsSchema, { includeBenchmark: 1 })
    })
  })

  describe('BenchmarkOptionsSchema', () => {
    it('accepts an empty object', () => {
      accepts(BenchmarkOptionsSchema, {})
    })

    it('accepts a fully-populated options object', () => {
      accepts(BenchmarkOptionsSchema, {
        sector: 'manufacturing',
        companySize: 'medium',
        employeeCount: 50,
        annualRevenue: 1_000_000,
      })
    })

    it('accepts every sector and rejects an unknown one', () => {
      for (const sector of [
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
      ]) {
        accepts(BenchmarkOptionsSchema, { sector })
      }
      rejects(BenchmarkOptionsSchema, { sector: 'banking' })
    })

    it('accepts every companySize and rejects an unknown one', () => {
      for (const companySize of ['micro', 'small', 'medium', 'large']) {
        accepts(BenchmarkOptionsSchema, { companySize })
      }
      rejects(BenchmarkOptionsSchema, { companySize: 'huge' })
    })

    it('rejects negative or non-integer employeeCount', () => {
      rejects(BenchmarkOptionsSchema, { employeeCount: -1 })
      rejects(BenchmarkOptionsSchema, { employeeCount: 1.5 })
      accepts(BenchmarkOptionsSchema, { employeeCount: 0 })
    })

    it('rejects negative annualRevenue, accepts zero', () => {
      rejects(BenchmarkOptionsSchema, { annualRevenue: -100 })
      accepts(BenchmarkOptionsSchema, { annualRevenue: 0 })
    })
  })

  describe('AnalysisRequestSchema', () => {
    it('accepts a minimal request (BS + PL only)', () => {
      accepts(AnalysisRequestSchema, { balanceSheet, profitLoss })
    })

    it('accepts a fully-populated request', () => {
      accepts(AnalysisRequestSchema, {
        balanceSheet,
        profitLoss,
        cashFlow,
        previousBalanceSheet: balanceSheet,
        previousProfitLoss: profitLoss,
        options: { category: 'comprehensive', language: 'en' },
        benchmarkOptions: { sector: 'technology' },
      })
    })

    it('rejects when balanceSheet is missing', () => {
      rejects(AnalysisRequestSchema, { profitLoss })
    })

    it('rejects when profitLoss is missing', () => {
      rejects(AnalysisRequestSchema, { balanceSheet })
    })

    it('rejects an invalid nested balanceSheet', () => {
      rejects(AnalysisRequestSchema, {
        balanceSheet: { ...balanceSheet, fiscalYear: 1800 },
        profitLoss,
      })
    })

    it('rejects an invalid nested options.category (propagated failure)', () => {
      rejects(AnalysisRequestSchema, { balanceSheet, profitLoss, options: { category: 'bogus' } })
    })

    it('rejects an invalid nested benchmarkOptions.sector', () => {
      rejects(AnalysisRequestSchema, {
        balanceSheet,
        profitLoss,
        benchmarkOptions: { sector: 'banking' },
      })
    })
  })

  describe('RatioCategorySchema', () => {
    it('accepts each ratio category', () => {
      for (const category of ['liquidity', 'safety', 'profitability', 'efficiency', 'growth']) {
        accepts(RatioCategorySchema, category)
      }
    })

    it('rejects "comprehensive" (not a ratio category) and unknown values', () => {
      rejects(RatioCategorySchema, 'comprehensive')
      rejects(RatioCategorySchema, 'cashflow')
      rejects(RatioCategorySchema, 'nope')
      rejects(RatioCategorySchema, '')
    })
  })

  describe('RatioAnalysisRequestSchema', () => {
    it('accepts a minimal request (BS + PL only)', () => {
      accepts(RatioAnalysisRequestSchema, { balanceSheet, profitLoss })
    })

    it('accepts a request with a categories array', () => {
      accepts(RatioAnalysisRequestSchema, {
        balanceSheet,
        profitLoss,
        categories: ['liquidity', 'growth'],
      })
    })

    it('rejects an invalid category inside the array', () => {
      rejects(RatioAnalysisRequestSchema, {
        balanceSheet,
        profitLoss,
        categories: ['liquidity', 'comprehensive'],
      })
    })

    it('rejects a non-array categories value', () => {
      rejects(RatioAnalysisRequestSchema, { balanceSheet, profitLoss, categories: 'liquidity' })
    })

    it('rejects when balanceSheet is missing', () => {
      rejects(RatioAnalysisRequestSchema, { profitLoss })
    })
  })

  describe('BenchmarkRequestSchema', () => {
    it('accepts an empty ratios record', () => {
      accepts(BenchmarkRequestSchema, { ratios: {} })
    })

    it('accepts a populated ratios record plus options', () => {
      accepts(BenchmarkRequestSchema, {
        ratios: { currentRatio: 2.5, debtToEquity: 0.3 },
        sector: 'retail',
        companySize: 'small',
        employeeCount: 10,
        annualRevenue: 500_000,
      })
    })

    it('rejects non-finite ratio values', () => {
      rejects(BenchmarkRequestSchema, { ratios: { currentRatio: Infinity } })
      rejects(BenchmarkRequestSchema, { ratios: { currentRatio: NaN } })
    })

    it('rejects a non-numeric ratio value', () => {
      rejects(BenchmarkRequestSchema, { ratios: { currentRatio: 'high' } })
    })

    it('rejects an unknown sector', () => {
      rejects(BenchmarkRequestSchema, { ratios: {}, sector: 'banking' })
    })

    it('rejects negative employeeCount', () => {
      rejects(BenchmarkRequestSchema, { ratios: {}, employeeCount: -3 })
    })

    it('rejects negative annualRevenue', () => {
      rejects(BenchmarkRequestSchema, { ratios: {}, annualRevenue: -10 })
    })

    it('rejects when ratios is missing', () => {
      rejects(BenchmarkRequestSchema, {})
    })
  })

  describe('ReportTypeSchema', () => {
    it('accepts each report type', () => {
      for (const reportType of ['summary', 'detailed', 'investor', 'management', 'compliance']) {
        accepts(ReportTypeSchema, reportType)
      }
    })

    it('rejects unknown values', () => {
      rejects(ReportTypeSchema, 'executive')
      rejects(ReportTypeSchema, '')
    })
  })

  describe('ReportFormatSchema', () => {
    it('accepts each format', () => {
      for (const format of ['json', 'markdown', 'html']) {
        accepts(ReportFormatSchema, format)
      }
    })

    it('rejects unknown values', () => {
      rejects(ReportFormatSchema, 'pdf')
      rejects(ReportFormatSchema, '')
    })
  })

  describe('ReportOptionsSchema', () => {
    it('accepts an empty object', () => {
      accepts(ReportOptionsSchema, {})
    })

    it('accepts a fully-populated options object', () => {
      accepts(ReportOptionsSchema, {
        sector: 'service',
        companyName: 'Acme Corp',
        fiscalYear: 2024,
        includeCharts: true,
      })
    })

    it('rejects empty companyName (min 1) and over-200 (max 200)', () => {
      rejects(ReportOptionsSchema, { companyName: '' })
      rejects(ReportOptionsSchema, { companyName: 'a'.repeat(201) })
      accepts(ReportOptionsSchema, { companyName: 'a'.repeat(200) })
    })

    it('rejects fiscalYear out of range', () => {
      rejects(ReportOptionsSchema, { fiscalYear: 1899 })
      rejects(ReportOptionsSchema, { fiscalYear: 2101 })
      rejects(ReportOptionsSchema, { fiscalYear: 2024.5 })
    })

    it('rejects an unknown sector', () => {
      rejects(ReportOptionsSchema, { sector: 'banking' })
    })

    it('rejects non-boolean includeCharts', () => {
      rejects(ReportOptionsSchema, { includeCharts: 'yes' })
    })
  })

  describe('ReportRequestSchema', () => {
    it('accepts a minimal request (BS + PL + reportType)', () => {
      accepts(ReportRequestSchema, { balanceSheet, profitLoss, reportType: 'summary' })
    })

    it('accepts a fully-populated request', () => {
      accepts(ReportRequestSchema, {
        balanceSheet,
        profitLoss,
        cashFlow,
        previousBalanceSheet: balanceSheet,
        previousProfitLoss: profitLoss,
        reportType: 'investor',
        format: 'html',
        options: { companyName: 'Acme', fiscalYear: 2024, includeCharts: true },
      })
    })

    it('rejects when reportType is missing', () => {
      rejects(ReportRequestSchema, { balanceSheet, profitLoss })
    })

    it('rejects an unknown reportType', () => {
      rejects(ReportRequestSchema, { balanceSheet, profitLoss, reportType: 'executive' })
    })

    it('rejects an unknown format', () => {
      rejects(ReportRequestSchema, {
        balanceSheet,
        profitLoss,
        reportType: 'summary',
        format: 'pdf',
      })
    })

    it('rejects an invalid nested option (propagated failure)', () => {
      rejects(ReportRequestSchema, {
        balanceSheet,
        profitLoss,
        reportType: 'summary',
        options: { companyName: '' },
      })
    })

    it('rejects when balanceSheet is missing', () => {
      rejects(ReportRequestSchema, { profitLoss, reportType: 'summary' })
    })
  })
})
