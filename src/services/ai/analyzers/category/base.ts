import type { BalanceSheet, ProfitLoss } from '@/types'
import type { KeyMetric, AlertItem, AnalysisCategory } from '../types'
import type { AnalyzerConfig } from '../config'
import type { Logger, TimeProvider } from '../utils'
import { IdGenerator } from '../types'
import { STATUS_SCORES } from '../constants'
import { safeDivide, determineTrend } from '../utils'

export type MetricStatus = 'excellent' | 'good' | 'fair' | 'poor' | 'critical'

export interface MetricThresholds {
  excellent: number
  good: number
  fair: number
  poor: number
}

export interface CategoryAnalysisResult {
  score: number
  metrics: KeyMetric[]
  alerts: AlertItem[]
}

export abstract class BaseCategoryAnalyzer {
  constructor(
    protected readonly config: AnalyzerConfig,
    protected readonly idGenerator: IdGenerator,
    protected readonly logger: Logger,
    protected readonly timeProvider: TimeProvider
  ) {}

  abstract readonly category: AnalysisCategory

  abstract analyze(
    bs: BalanceSheet,
    pl: ProfitLoss,
    prevBS?: BalanceSheet,
    prevPL?: ProfitLoss
  ): CategoryAnalysisResult

  protected evaluateMetric(
    value: number,
    thresholds: MetricThresholds,
    higherIsBetter: boolean = true
  ): MetricStatus {
    if (higherIsBetter) {
      if (value >= thresholds.excellent) return 'excellent'
      if (value >= thresholds.good) return 'good'
      if (value >= thresholds.fair) return 'fair'
      if (value >= thresholds.poor) return 'poor'
      return 'critical'
    } else {
      if (value <= thresholds.excellent) return 'excellent'
      if (value <= thresholds.good) return 'good'
      if (value <= thresholds.fair) return 'fair'
      if (value <= thresholds.poor) return 'poor'
      return 'critical'
    }
  }

  protected evaluateMetricReverse(value: number, thresholds: MetricThresholds): MetricStatus {
    return this.evaluateMetric(value, thresholds, false)
  }

  protected calculateScore(metrics: KeyMetric[]): number {
    if (metrics.length === 0) return 50

    const totalScore = metrics.reduce((sum, m) => sum + (STATUS_SCORES[m.status] ?? 50), 0)
    return Math.round(totalScore / metrics.length)
  }

  protected createMetric(
    name: string,
    value: number,
    unit: string,
    format: KeyMetric['format'],
    status: MetricStatus,
    trend?: KeyMetric['trend']
  ): KeyMetric {
    return { name, value, unit, format, status, trend }
  }

  protected createAlert(
    severity: AlertItem['severity'],
    title: string,
    description: string,
    metric: string,
    currentValue: number,
    threshold?: number,
    recommendation?: string
  ): AlertItem {
    return {
      id: this.idGenerator.generateAlertId(),
      category: this.category,
      severity,
      title,
      description,
      metric,
      currentValue,
      threshold,
      recommendation: recommendation ?? '',
    }
  }

  protected safeDivide = safeDivide
  protected determineTrend = determineTrend
}
