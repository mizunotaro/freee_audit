import { z } from 'zod'
import type { BalanceSheetItem } from '@/types'

export const BalanceSheetItemSchema: z.ZodType<BalanceSheetItem> = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  amount: z.number().finite(),
  previousAmount: z.number().finite().optional(),
  children: z.lazy((): z.ZodType<BalanceSheetItem[]> => z.array(BalanceSheetItemSchema)).optional(),
})

export const BalanceSheetSchema = z.object({
  fiscalYear: z.number().int().min(1900).max(2100),
  month: z.number().int().min(1).max(12),
  assets: z.object({
    current: z.array(BalanceSheetItemSchema),
    fixed: z.array(BalanceSheetItemSchema),
    total: z.number().finite().nonnegative(),
  }),
  liabilities: z.object({
    current: z.array(BalanceSheetItemSchema),
    fixed: z.array(BalanceSheetItemSchema),
    total: z.number().finite().nonnegative(),
  }),
  equity: z.object({
    items: z.array(BalanceSheetItemSchema),
    total: z.number().finite(),
  }),
  totalAssets: z.number().finite().positive(),
  totalLiabilities: z.number().finite().nonnegative(),
  totalEquity: z.number().finite(),
})

export const ProfitLossItemSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  amount: z.number().finite(),
  previousAmount: z.number().finite().optional(),
  percentage: z.number().finite().min(0).max(100).optional(),
  category: z.string().max(100).optional(),
})

export const ProfitLossSchema = z.object({
  fiscalYear: z.number().int().min(1900).max(2100),
  month: z.number().int().min(1).max(12),
  revenue: z.array(ProfitLossItemSchema),
  costOfSales: z.array(ProfitLossItemSchema),
  grossProfit: z.number().finite(),
  grossProfitMargin: z.number().finite(),
  sgaExpenses: z.array(ProfitLossItemSchema),
  operatingIncome: z.number().finite(),
  operatingMargin: z.number().finite(),
  nonOperatingIncome: z.array(ProfitLossItemSchema),
  nonOperatingExpenses: z.array(ProfitLossItemSchema),
  ordinaryIncome: z.number().finite(),
  extraordinaryIncome: z.array(ProfitLossItemSchema),
  extraordinaryLoss: z.array(ProfitLossItemSchema),
  incomeBeforeTax: z.number().finite(),
  incomeTax: z.number().finite(),
  netIncome: z.number().finite(),
  depreciation: z.number().finite(),
})

export const CashFlowStatementSchema = z.object({
  fiscalYear: z.number().int().min(1900).max(2100).optional(),
  month: z.number().int().min(1).max(12).optional(),
  operating: z
    .object({
      items: z.array(z.object({ name: z.string(), amount: z.number().finite() })),
      netCashFromOperating: z.number().finite(),
    })
    .optional(),
  investing: z
    .object({
      items: z.array(z.object({ name: z.string(), amount: z.number().finite() })),
      netCashFromInvesting: z.number().finite(),
    })
    .optional(),
  financing: z
    .object({
      items: z.array(z.object({ name: z.string(), amount: z.number().finite() })),
      netCashFromFinancing: z.number().finite(),
    })
    .optional(),
  operatingActivities: z
    .object({
      netIncome: z.number().finite(),
      depreciation: z.number().finite(),
      amortization: z.number().finite(),
      deferredTaxChange: z.number().finite(),
      increaseInReceivables: z.number().finite(),
      decreaseInInventory: z.number().finite(),
      increaseInPayables: z.number().finite(),
      otherNonCash: z.number().finite(),
      netCashFromOperating: z.number().finite(),
    })
    .optional(),
  investingActivities: z
    .object({
      purchaseOfFixedAssets: z.number().finite(),
      saleOfFixedAssets: z.number().finite(),
      netCashFromInvesting: z.number().finite(),
    })
    .optional(),
  financingActivities: z
    .object({
      proceedsFromBorrowing: z.number().finite(),
      repaymentOfBorrowing: z.number().finite(),
      dividendPaid: z.number().finite(),
      interestPaid: z.number().finite(),
      netCashFromFinancing: z.number().finite(),
    })
    .optional(),
  netChangeInCash: z.number().finite(),
  beginningCash: z.number().finite(),
  endingCash: z.number().finite(),
  periodStart: z.date().optional(),
  periodEnd: z.date().optional(),
})

export const AnalysisOptionsSchema = z.object({
  category: z
    .enum([
      'liquidity',
      'safety',
      'profitability',
      'efficiency',
      'growth',
      'cashflow',
      'comprehensive',
    ])
    .optional(),
  includeAlerts: z.boolean().optional(),
  includeRecommendations: z.boolean().optional(),
  includeBenchmark: z.boolean().optional(),
  language: z.enum(['ja', 'en']).optional(),
  depth: z.enum(['brief', 'standard', 'detailed', 'comprehensive']).optional(),
})

export const BenchmarkOptionsSchema = z.object({
  sector: z
    .enum([
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
    ])
    .optional(),
  companySize: z.enum(['micro', 'small', 'medium', 'large']).optional(),
  employeeCount: z.number().int().nonnegative().optional(),
  annualRevenue: z.number().nonnegative().optional(),
})

export const AnalysisRequestSchema = z.object({
  balanceSheet: BalanceSheetSchema,
  profitLoss: ProfitLossSchema,
  cashFlow: CashFlowStatementSchema.optional(),
  previousBalanceSheet: BalanceSheetSchema.optional(),
  previousProfitLoss: ProfitLossSchema.optional(),
  options: AnalysisOptionsSchema.optional(),
  benchmarkOptions: BenchmarkOptionsSchema.optional(),
})

export const RatioCategorySchema = z.enum([
  'liquidity',
  'safety',
  'profitability',
  'efficiency',
  'growth',
])

export const RatioAnalysisRequestSchema = z.object({
  balanceSheet: BalanceSheetSchema,
  profitLoss: ProfitLossSchema,
  previousBalanceSheet: BalanceSheetSchema.optional(),
  previousProfitLoss: ProfitLossSchema.optional(),
  categories: z.array(RatioCategorySchema).optional(),
})

export const BenchmarkRequestSchema = z.object({
  ratios: z.record(z.string(), z.number().finite()),
  sector: z
    .enum([
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
    ])
    .optional(),
  companySize: z.enum(['micro', 'small', 'medium', 'large']).optional(),
  employeeCount: z.number().int().nonnegative().optional(),
  annualRevenue: z.number().nonnegative().optional(),
})

export const ReportTypeSchema = z.enum([
  'summary',
  'detailed',
  'investor',
  'management',
  'compliance',
])
export const ReportFormatSchema = z.enum(['json', 'markdown', 'html'])

export const ReportOptionsSchema = z.object({
  sector: z
    .enum([
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
    ])
    .optional(),
  companyName: z.string().min(1).max(200).optional(),
  fiscalYear: z.number().int().min(1900).max(2100).optional(),
  includeCharts: z.boolean().optional(),
})

export const ReportRequestSchema = z.object({
  balanceSheet: BalanceSheetSchema,
  profitLoss: ProfitLossSchema,
  cashFlow: CashFlowStatementSchema.optional(),
  previousBalanceSheet: BalanceSheetSchema.optional(),
  previousProfitLoss: ProfitLossSchema.optional(),
  reportType: ReportTypeSchema,
  format: ReportFormatSchema.optional(),
  options: ReportOptionsSchema.optional(),
})

export type AnalysisRequestInput = z.infer<typeof AnalysisRequestSchema>
export type RatioAnalysisRequestInput = z.infer<typeof RatioAnalysisRequestSchema>
export type BenchmarkRequestInput = z.infer<typeof BenchmarkRequestSchema>
export type ReportRequestInput = z.infer<typeof ReportRequestSchema>
