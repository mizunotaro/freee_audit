import type { BalanceSheet, ProfitLoss, CashFlowStatement } from '@/types'
import type { PersonaType } from '@/lib/ai/personas/types'
import type { AnalyzerConfig } from './config'

export type AnalysisCategory =
  | 'liquidity'
  | 'safety'
  | 'profitability'
  | 'efficiency'
  | 'growth'
  | 'cashflow'
  | 'comprehensive'

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'

export type TrendDirection = 'improving' | 'stable' | 'declining' | 'volatile'

export interface FinancialStatementSet {
  readonly balanceSheet: BalanceSheet
  readonly profitLoss: ProfitLoss
  readonly cashFlow?: CashFlowStatement
  readonly previousBalanceSheet?: BalanceSheet
  readonly previousProfitLoss?: ProfitLoss
}

export interface AnalysisOptions {
  readonly category?: AnalysisCategory
  readonly includeAlerts?: boolean
  readonly includeRecommendations?: boolean
  readonly includeBenchmark?: boolean
  readonly language?: 'ja' | 'en'
  readonly depth?: 'brief' | 'standard' | 'detailed' | 'comprehensive'
  readonly personas?: readonly PersonaType[]
  readonly deterministic?: boolean
  readonly fixedTimestamp?: Date
}

export interface AnalysisContext {
  readonly balanceSheet: BalanceSheet
  readonly profitLoss: ProfitLoss
  readonly previousBalanceSheet?: BalanceSheet
  readonly previousProfitLoss?: ProfitLoss
  readonly options: AnalysisOptions
  readonly config: AnalyzerConfig
  readonly startTime: number
}

export interface CategoryAnalysisContext extends AnalysisContext {
  readonly category: AnalysisCategory
  readonly completedCategories: ReadonlyMap<AnalysisCategory, CategoryAnalysis>
}

export interface AlertItem {
  readonly id: string
  readonly category: AnalysisCategory
  readonly severity: AlertSeverity
  readonly title: string
  readonly description: string
  readonly metric: string
  readonly currentValue: number
  readonly threshold?: number
  readonly recommendation: string
  readonly relatedItems?: readonly string[]
}

export interface RecommendationItem {
  readonly id: string
  readonly priority: 'high' | 'medium' | 'low'
  readonly category: AnalysisCategory
  readonly title: string
  readonly description: string
  readonly expectedImpact: string
  readonly timeframe: 'immediate' | 'short_term' | 'medium_term' | 'long_term'
  readonly relatedAlerts?: readonly string[]
}

export interface TrendAnalysis {
  readonly metric: string
  readonly direction: TrendDirection
  readonly changePercent?: number
  readonly periodComparison?: {
    readonly current: number
    readonly previous: number
    readonly change: number
  }
  readonly insight: string
}

export interface CategoryAnalysis {
  readonly category: AnalysisCategory
  readonly score: number
  readonly status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical'
  readonly summary: string
  readonly trends: readonly TrendAnalysis[]
  readonly alerts: readonly AlertItem[]
  readonly recommendations: readonly RecommendationItem[]
  readonly metrics: readonly KeyMetric[]
}

export interface FinancialAnalysisResult {
  readonly success: boolean
  readonly data?: {
    readonly overallScore: number
    readonly overallStatus: 'excellent' | 'good' | 'fair' | 'poor' | 'critical'
    readonly executiveSummary: string
    readonly categoryAnalyses: readonly CategoryAnalysis[]
    readonly allAlerts: readonly AlertItem[]
    readonly topRecommendations: readonly RecommendationItem[]
    readonly keyMetrics: readonly KeyMetric[]
    readonly processingTimeMs: number
    readonly analyzedAt: Date
  }
  readonly error?: {
    readonly code: string
    readonly message: string
    readonly details?: Record<string, unknown>
  }
}

export interface KeyMetric {
  readonly name: string
  readonly value: number
  readonly unit: string
  readonly format: 'number' | 'percentage' | 'currency' | 'ratio' | 'days'
  readonly status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical'
  readonly trend?: TrendDirection
  readonly benchmark?: {
    readonly industry: number
    readonly percentile: number
  }
}

export type AnalyzerResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } }

export const ANALYSIS_THRESHOLDS = {
  currentRatio: { excellent: 200, good: 150, fair: 100, poor: 80 },
  quickRatio: { excellent: 150, good: 100, fair: 80, poor: 50 },
  debtToEquity: { excellent: 0.5, good: 1.0, fair: 2.0, poor: 3.0 },
  equityRatio: { excellent: 50, good: 30, fair: 20, poor: 10 },
  grossMargin: { excellent: 40, good: 30, fair: 20, poor: 10 },
  operatingMargin: { excellent: 15, good: 10, fair: 5, poor: 2 },
  netMargin: { excellent: 10, good: 7, fair: 4, poor: 1 },
  roe: { excellent: 15, good: 10, fair: 5, poor: 0 },
  roa: { excellent: 10, good: 6, fair: 3, poor: 1 },
  assetTurnover: { excellent: 2.0, good: 1.5, fair: 1.0, poor: 0.5 },
  inventoryTurnover: { excellent: 12, good: 8, fair: 4, poor: 2 },
  receivablesTurnover: { excellent: 12, good: 8, fair: 6, poor: 4 },
} as const

export function getStatusFromScore(
  score: number
): 'excellent' | 'good' | 'fair' | 'poor' | 'critical' {
  if (score >= 80) return 'excellent'
  if (score >= 60) return 'good'
  if (score >= 40) return 'fair'
  if (score >= 20) return 'poor'
  return 'critical'
}

/**
 * ID生成インターフェース
 *
 * @remarks
 * テスト時の決定論的実行のために注入可能
 */
export interface IdGenerator {
  generateAlertId(): string
  generateRecommendationId(): string
}

/**
 * デフォルトID生成器
 *
 * @remarks
 * タイムスタンプとランダム値を使用（非決定的）
 */
export class DefaultIdGenerator implements IdGenerator {
  generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  }

  generateRecommendationId(): string {
    return `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  }
}

/**
 * 決定論的ID生成器
 *
 * @remarks
 * テスト用に決定論的なIDを生成
 */
export class DeterministicIdGenerator implements IdGenerator {
  private alertCounter = 0
  private recCounter = 0

  generateAlertId(): string {
    return `alert_deterministic_${++this.alertCounter}`
  }

  generateRecommendationId(): string {
    return `rec_deterministic_${++this.recCounter}`
  }
}

/**
 * ログコンテキスト
 *
 * @remarks
 * 構造化ログに含めるコンテキスト情報
 */
export interface LogContext {
  requestId?: string
  userId?: string
  companyId?: string
  module: string
  version: string
}

/**
 * ログエントリ
 *
 * @remarks
 * 構造化ログのフォーマット
 */
export interface LogEntry {
  timestamp: string
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  context: LogContext
}
