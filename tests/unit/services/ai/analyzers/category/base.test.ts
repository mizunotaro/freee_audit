import { describe, it, expect, beforeEach } from 'vitest'
import {
  BaseCategoryAnalyzer,
  type MetricThresholds,
  type MetricStatus,
} from '@/services/ai/analyzers/category/base'
import { DEFAULT_ANALYZER_CONFIG } from '@/services/ai/analyzers/config'
import { DeterministicIdGenerator } from '@/services/ai/analyzers/types'
import { NoOpLogger, MockTimeProvider } from '@/services/ai/analyzers/utils'
import type { BalanceSheet, ProfitLoss } from '@/types'
import type { KeyMetric } from '@/services/ai/analyzers/types'

class TestAnalyzer extends BaseCategoryAnalyzer {
  readonly category = 'liquidity' as const

  analyze(
    _bs: BalanceSheet,
    _pl: ProfitLoss,
    _prevBS?: BalanceSheet,
    _prevPL?: ProfitLoss
  ): { score: number; metrics: KeyMetric[]; alerts: never[] } {
    return { score: 50, metrics: [], alerts: [] }
  }

  testEvaluateMetric(
    value: number,
    thresholds: MetricThresholds,
    higherIsBetter?: boolean
  ): MetricStatus {
    return this.evaluateMetric(value, thresholds, higherIsBetter)
  }

  testEvaluateMetricReverse(value: number, thresholds: MetricThresholds): MetricStatus {
    return this.evaluateMetricReverse(value, thresholds)
  }

  testCalculateScore(metrics: KeyMetric[]): number {
    return this.calculateScore(metrics)
  }

  testCreateMetric(
    name: string,
    value: number,
    unit: string,
    format: KeyMetric['format'],
    status: MetricStatus,
    trend?: KeyMetric['trend']
  ): KeyMetric {
    return this.createMetric(name, value, unit, format, status, trend)
  }

  testCreateAlert(
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info',
    title: string,
    description: string,
    metric: string,
    currentValue: number,
    threshold?: number,
    recommendation?: string
  ) {
    return this.createAlert(
      severity,
      title,
      description,
      metric,
      currentValue,
      threshold,
      recommendation
    )
  }
}

describe('BaseCategoryAnalyzer', () => {
  let analyzer: TestAnalyzer

  const thresholds: MetricThresholds = {
    excellent: 200,
    good: 150,
    fair: 100,
    poor: 80,
  }

  const reverseThresholds: MetricThresholds = {
    excellent: 0.5,
    good: 1.0,
    fair: 2.0,
    poor: 3.0,
  }

  beforeEach(() => {
    analyzer = new TestAnalyzer(
      DEFAULT_ANALYZER_CONFIG,
      new DeterministicIdGenerator(),
      new NoOpLogger(),
      new MockTimeProvider(new Date('2024-01-01'))
    )
  })

  describe('evaluateMetric (higher is better)', () => {
    it('should return excellent for value >= excellent threshold', () => {
      expect(analyzer.testEvaluateMetric(250, thresholds)).toBe('excellent')
    })

    it('should return good for value >= good threshold', () => {
      expect(analyzer.testEvaluateMetric(175, thresholds)).toBe('good')
    })

    it('should return fair for value >= fair threshold', () => {
      expect(analyzer.testEvaluateMetric(120, thresholds)).toBe('fair')
    })

    it('should return poor for value >= poor threshold', () => {
      expect(analyzer.testEvaluateMetric(90, thresholds)).toBe('poor')
    })

    it('should return critical for value < poor threshold', () => {
      expect(analyzer.testEvaluateMetric(50, thresholds)).toBe('critical')
    })
  })

  describe('evaluateMetric (lower is better)', () => {
    it('should return excellent for value <= excellent threshold', () => {
      expect(analyzer.testEvaluateMetric(0.3, reverseThresholds, false)).toBe('excellent')
    })

    it('should return good for value <= good threshold', () => {
      expect(analyzer.testEvaluateMetric(0.8, reverseThresholds, false)).toBe('good')
    })

    it('should return fair for value <= fair threshold', () => {
      expect(analyzer.testEvaluateMetric(1.5, reverseThresholds, false)).toBe('fair')
    })

    it('should return poor for value <= poor threshold', () => {
      expect(analyzer.testEvaluateMetric(2.5, reverseThresholds, false)).toBe('poor')
    })

    it('should return critical for value > poor threshold', () => {
      expect(analyzer.testEvaluateMetric(5.0, reverseThresholds, false)).toBe('critical')
    })
  })

  describe('evaluateMetricReverse', () => {
    it('should behave same as evaluateMetric with higherIsBetter=false', () => {
      expect(analyzer.testEvaluateMetricReverse(0.3, reverseThresholds)).toBe(
        analyzer.testEvaluateMetric(0.3, reverseThresholds, false)
      )
      expect(analyzer.testEvaluateMetricReverse(5.0, reverseThresholds)).toBe(
        analyzer.testEvaluateMetric(5.0, reverseThresholds, false)
      )
    })
  })

  describe('calculateScore', () => {
    it('should return 50 for empty metrics', () => {
      expect(analyzer.testCalculateScore([])).toBe(50)
    })

    it('should calculate average score from metrics', () => {
      const metrics: KeyMetric[] = [
        analyzer.testCreateMetric('test1', 100, '%', 'percentage', 'excellent'),
        analyzer.testCreateMetric('test2', 100, '%', 'percentage', 'excellent'),
      ]
      expect(analyzer.testCalculateScore(metrics)).toBe(100)
    })

    it('should handle mixed statuses', () => {
      const metrics: KeyMetric[] = [
        analyzer.testCreateMetric('test1', 100, '%', 'percentage', 'excellent'),
        analyzer.testCreateMetric('test2', 100, '%', 'percentage', 'good'),
      ]
      expect(analyzer.testCalculateScore(metrics)).toBe(88)
    })
  })

  describe('createMetric', () => {
    it('should create metric with all fields', () => {
      const metric = analyzer.testCreateMetric(
        '流動比率',
        150,
        '%',
        'percentage',
        'good',
        'improving'
      )

      expect(metric.name).toBe('流動比率')
      expect(metric.value).toBe(150)
      expect(metric.unit).toBe('%')
      expect(metric.format).toBe('percentage')
      expect(metric.status).toBe('good')
      expect(metric.trend).toBe('improving')
    })

    it('should create metric without trend', () => {
      const metric = analyzer.testCreateMetric('流動比率', 150, '%', 'percentage', 'good')

      expect(metric.trend).toBeUndefined()
    })
  })

  describe('createAlert', () => {
    it('should create alert with all fields', () => {
      const alert = analyzer.testCreateAlert(
        'critical',
        '流動比率が低い',
        '流動比率が80%を下回っています',
        'currentRatio',
        75,
        80,
        '資金繰りの改善が必要です'
      )

      expect(alert.id).toBe('alert_deterministic_1')
      expect(alert.category).toBe('liquidity')
      expect(alert.severity).toBe('critical')
      expect(alert.title).toBe('流動比率が低い')
      expect(alert.description).toBe('流動比率が80%を下回っています')
      expect(alert.metric).toBe('currentRatio')
      expect(alert.currentValue).toBe(75)
      expect(alert.threshold).toBe(80)
      expect(alert.recommendation).toBe('資金繰りの改善が必要です')
    })

    it('should create alert without recommendation', () => {
      const alert = analyzer.testCreateAlert('medium', '警告', '説明', 'metric', 50)

      expect(alert.recommendation).toBe('')
    })
  })

  describe('safeDivide', () => {
    it('should divide correctly', () => {
      expect(analyzer['safeDivide'](10, 2, 0)).toBe(5)
    })

    it('should return fallback for zero denominator', () => {
      expect(analyzer['safeDivide'](10, 0, 999)).toBe(999)
    })
  })

  describe('determineTrend', () => {
    it('should return improving for positive change', () => {
      expect(analyzer['determineTrend'](110, 100)).toBe('improving')
    })

    it('should return declining for negative change', () => {
      expect(analyzer['determineTrend'](90, 100)).toBe('declining')
    })

    it('should return stable for small change', () => {
      expect(analyzer['determineTrend'](103, 100)).toBe('stable')
    })

    it('should return stable for zero previous', () => {
      expect(analyzer['determineTrend'](100, 0)).toBe('stable')
    })
  })
})
