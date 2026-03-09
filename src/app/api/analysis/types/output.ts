import type { FinancialAnalysisResult } from '@/services/ai/analyzers/types'
import type { RatioAnalysisResult } from '@/services/ai/analyzers/ratios/types'
import type { BenchmarkResult } from '@/services/benchmark/types'
import type { ReportType, ReportFormat } from './input'

export interface FinancialAnalysisOutput {
  readonly overallScore: number
  readonly overallStatus: AnalysisStatus
  readonly executiveSummary: string
  readonly categoryAnalyses: readonly CategoryAnalysisOutput[]
  readonly allAlerts: readonly AlertOutput[]
  readonly topRecommendations: readonly RecommendationOutput[]
  readonly keyMetrics: readonly KeyMetricOutput[]
  readonly benchmark?: BenchmarkOutput
  readonly processingTimeMs: number
  readonly analyzedAt: string
}

export type AnalysisStatus = 'excellent' | 'good' | 'fair' | 'poor' | 'critical'

export interface CategoryAnalysisOutput {
  readonly category: string
  readonly score: number
  readonly status: AnalysisStatus
  readonly summary: string
  readonly trends: readonly TrendOutput[]
  readonly alerts: readonly AlertOutput[]
  readonly recommendations: readonly RecommendationOutput[]
}

export interface TrendOutput {
  readonly metric: string
  readonly direction: 'improving' | 'stable' | 'declining' | 'volatile'
  readonly changePercent?: number
  readonly insight: string
}

export interface AlertOutput {
  readonly id: string
  readonly category: string
  readonly severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  readonly title: string
  readonly description: string
  readonly metric: string
  readonly currentValue: number
  readonly threshold?: number
  readonly recommendation: string
}

export interface RecommendationOutput {
  readonly id: string
  readonly priority: 'high' | 'medium' | 'low'
  readonly category: string
  readonly title: string
  readonly description: string
  readonly expectedImpact: string
  readonly timeframe: 'immediate' | 'short_term' | 'medium_term' | 'long_term'
}

export interface KeyMetricOutput {
  readonly name: string
  readonly value: number
  readonly unit: string
  readonly format: 'number' | 'percentage' | 'currency' | 'ratio' | 'days'
  readonly status: AnalysisStatus
  readonly trend?: 'improving' | 'stable' | 'declining' | 'volatile'
}

export interface RatioAnalysisOutput {
  readonly groups: readonly RatioGroupOutput[]
  readonly allRatios: readonly CalculatedRatioOutput[]
  readonly summary: RatioSummaryOutput
  readonly calculatedAt: string
}

export interface RatioGroupOutput {
  readonly category: string
  readonly categoryName: string
  readonly ratios: readonly CalculatedRatioOutput[]
  readonly averageScore: number
  readonly overallStatus: AnalysisStatus
}

export interface CalculatedRatioOutput {
  readonly definition: {
    readonly id: string
    readonly name: string
    readonly nameEn: string
    readonly category: string
    readonly formula: string
    readonly description: string
    readonly unit: 'ratio' | 'percentage' | 'days' | 'times' | 'number'
  }
  readonly value: number
  readonly formattedValue: string
  readonly status: AnalysisStatus
  readonly trend?: {
    readonly direction: 'improving' | 'stable' | 'declining'
    readonly previousValue?: number
    readonly changePercent?: number
  }
}

export interface RatioSummaryOutput {
  readonly totalRatios: number
  readonly excellentCount: number
  readonly goodCount: number
  readonly fairCount: number
  readonly poorCount: number
  readonly criticalCount: number
  readonly overallScore: number
}

export interface BenchmarkOutput {
  readonly industryComparisons: readonly BenchmarkComparisonOutput[]
  readonly sizeComparisons: readonly BenchmarkComparisonOutput[]
  readonly overallPercentile: number
  readonly strengths: readonly string[]
  readonly weaknesses: readonly string[]
}

export interface BenchmarkComparisonOutput {
  readonly metricId: string
  readonly metricName: string
  readonly companyValue: number
  readonly benchmark: {
    readonly min: number
    readonly q1: number
    readonly median: number
    readonly q3: number
    readonly max: number
  }
  readonly percentile: number
  readonly status: 'above_median' | 'at_median' | 'below_median'
  readonly deviation: number
}

export interface ReportOutput {
  readonly format: ReportFormat
  readonly content: string
  readonly reportType: ReportType
  readonly metadata: ReportMetadata
}

export interface ReportMetadata {
  readonly companyName: string
  readonly fiscalYear: number
  readonly generatedAt: string
  readonly version: string
}

export type AnalysisOutput =
  | FinancialAnalysisOutput
  | RatioAnalysisOutput
  | BenchmarkOutput
  | ReportOutput

export function transformFinancialAnalysisResult(
  result: FinancialAnalysisResult
): FinancialAnalysisOutput | null {
  if (!result.success || !result.data) return null

  return {
    ...result.data,
    analyzedAt: result.data.analyzedAt.toISOString(),
  }
}

export function transformRatioAnalysisResult(
  result: RatioAnalysisResult
): RatioAnalysisOutput | null {
  if (!result.success || !result.data) return null

  return {
    ...result.data,
    calculatedAt: result.data.calculatedAt.toISOString(),
  }
}

export function transformBenchmarkResult(result: BenchmarkResult): BenchmarkOutput | null {
  if (!result.success || !result.data) return null

  return result.data
}
