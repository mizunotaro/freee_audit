import type { BalanceSheet, ProfitLoss, CashFlowStatement } from '@/types'
import type { AnalysisCategory } from '@/services/ai/analyzers/types'
import type { IndustrySector, CompanySize } from '@/services/benchmark/types'

export interface AnalysisRequest {
  readonly balanceSheet: BalanceSheet
  readonly profitLoss: ProfitLoss
  readonly cashFlow?: CashFlowStatement
  readonly previousBalanceSheet?: BalanceSheet
  readonly previousProfitLoss?: ProfitLoss
  readonly options?: {
    readonly category?: AnalysisCategory
    readonly includeAlerts?: boolean
    readonly includeRecommendations?: boolean
    readonly includeBenchmark?: boolean
    readonly language?: 'ja' | 'en'
    readonly depth?: 'brief' | 'standard' | 'detailed' | 'comprehensive'
  }
  readonly benchmarkOptions?: {
    readonly sector?: IndustrySector
    readonly companySize?: CompanySize
    readonly employeeCount?: number
    readonly annualRevenue?: number
  }
}

export interface RatioAnalysisRequest {
  readonly balanceSheet: BalanceSheet
  readonly profitLoss: ProfitLoss
  readonly previousBalanceSheet?: BalanceSheet
  readonly previousProfitLoss?: ProfitLoss
  readonly categories?: readonly (
    | 'liquidity'
    | 'safety'
    | 'profitability'
    | 'efficiency'
    | 'growth'
  )[]
}

export interface BenchmarkRequest {
  readonly ratios: Record<string, number>
  readonly sector?: IndustrySector
  readonly companySize?: CompanySize
  readonly employeeCount?: number
  readonly annualRevenue?: number
}

export interface ReportRequest {
  readonly balanceSheet: BalanceSheet
  readonly profitLoss: ProfitLoss
  readonly cashFlow?: CashFlowStatement
  readonly previousBalanceSheet?: BalanceSheet
  readonly previousProfitLoss?: ProfitLoss
  readonly reportType: 'summary' | 'detailed' | 'investor' | 'management' | 'compliance'
  readonly format?: 'json' | 'markdown' | 'html'
  readonly options?: {
    readonly sector?: IndustrySector
    readonly companyName?: string
    readonly fiscalYear?: number
    readonly includeCharts?: boolean
  }
}

export interface AnalysisResponse<T> {
  readonly success: boolean
  readonly data?: T
  readonly error?: {
    readonly code: string
    readonly message: string
    readonly details?: Record<string, unknown>
  }
  readonly metadata?: {
    readonly processingTimeMs: number
    readonly cached: boolean
  }
}
