import type { BalanceSheet, ProfitLoss, CashFlowStatement } from '@/types'
import type { AnalysisCategory } from '@/services/ai/analyzers/types'
import type { IndustrySector, CompanySize } from '@/services/benchmark/types'

export interface AnalysisOptions {
  readonly category?: AnalysisCategory
  readonly includeAlerts?: boolean
  readonly includeRecommendations?: boolean
  readonly includeBenchmark?: boolean
  readonly language?: 'ja' | 'en'
  readonly depth?: 'brief' | 'standard' | 'detailed' | 'comprehensive'
}

export interface BenchmarkOptions {
  readonly sector?: IndustrySector
  readonly companySize?: CompanySize
  readonly employeeCount?: number
  readonly annualRevenue?: number
}

export interface ReportOptions {
  readonly sector?: IndustrySector
  readonly companyName?: string
  readonly fiscalYear?: number
  readonly includeCharts?: boolean
}

export interface AnalysisRequest {
  readonly balanceSheet: BalanceSheet
  readonly profitLoss: ProfitLoss
  readonly cashFlow?: CashFlowStatement
  readonly previousBalanceSheet?: BalanceSheet
  readonly previousProfitLoss?: ProfitLoss
  readonly options?: AnalysisOptions
  readonly benchmarkOptions?: BenchmarkOptions
}

export interface RatioAnalysisRequest {
  readonly balanceSheet: BalanceSheet
  readonly profitLoss: ProfitLoss
  readonly previousBalanceSheet?: BalanceSheet
  readonly previousProfitLoss?: ProfitLoss
  readonly categories?: readonly RatioCategory[]
}

export type RatioCategory = 'liquidity' | 'safety' | 'profitability' | 'efficiency' | 'growth'

export interface BenchmarkRequest {
  readonly ratios: Record<string, number>
  readonly sector?: IndustrySector
  readonly companySize?: CompanySize
  readonly employeeCount?: number
  readonly annualRevenue?: number
}

export type ReportType = 'summary' | 'detailed' | 'investor' | 'management' | 'compliance'
export type ReportFormat = 'json' | 'markdown' | 'html'

export interface ReportRequest {
  readonly balanceSheet: BalanceSheet
  readonly profitLoss: ProfitLoss
  readonly cashFlow?: CashFlowStatement
  readonly previousBalanceSheet?: BalanceSheet
  readonly previousProfitLoss?: ProfitLoss
  readonly reportType: ReportType
  readonly format?: ReportFormat
  readonly options?: ReportOptions
}
