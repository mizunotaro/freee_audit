import type { BalanceSheet, ProfitLoss } from '@/types'
import type { KeyMetric, AlertItem } from '../types'
import type { CategoryAnalysisResult, MetricThresholds } from './base'
import { ANALYSIS_THRESHOLDS } from '../types'
import { extractTotalAssets, extractTotalEquity, extractTotalLiabilities } from '../utils'
import { BaseCategoryAnalyzer } from './base'

const DEBT_RATIO_THRESHOLDS: MetricThresholds = {
  excellent: 50,
  good: 70,
  fair: 80,
  poor: 90,
}

export class SafetyAnalyzer extends BaseCategoryAnalyzer {
  readonly category = 'safety' as const

  analyze(
    bs: BalanceSheet,
    _pl: ProfitLoss,
    prevBS?: BalanceSheet,
    _prevPL?: ProfitLoss
  ): CategoryAnalysisResult {
    this.logger.debug('Starting safety analysis', { module: 'SafetyAnalyzer' })

    const totalAssets = extractTotalAssets(bs)
    const totalEquity = extractTotalEquity(bs)
    const totalLiabilities = extractTotalLiabilities(bs)

    const equityRatio = this.safeDivide(totalEquity, totalAssets, 0) * 100
    const debtToEquity = this.safeDivide(totalLiabilities, totalEquity, 0)
    const debtRatio = this.safeDivide(totalLiabilities, totalAssets, 0) * 100

    const prevEquityRatio = prevBS
      ? this.safeDivide(extractTotalEquity(prevBS), extractTotalAssets(prevBS), 0) * 100
      : undefined

    const metrics: KeyMetric[] = [
      this.createMetric(
        '自己資本比率',
        equityRatio,
        '%',
        'percentage',
        this.evaluateMetric(equityRatio, ANALYSIS_THRESHOLDS.equityRatio, true),
        prevEquityRatio ? this.determineTrend(equityRatio, prevEquityRatio) : undefined
      ),
      this.createMetric(
        '負債比率（D/Eレシオ）',
        debtToEquity,
        '倍',
        'ratio',
        this.evaluateMetricReverse(debtToEquity, ANALYSIS_THRESHOLDS.debtToEquity)
      ),
      this.createMetric(
        '負債比率',
        debtRatio,
        '%',
        'percentage',
        this.evaluateMetricReverse(debtRatio, DEBT_RATIO_THRESHOLDS)
      ),
    ]

    const alerts = this.generateAlerts(equityRatio, totalEquity)

    this.logger.debug('Safety analysis completed', { module: 'SafetyAnalyzer' })

    return {
      score: this.calculateScore(metrics),
      metrics,
      alerts,
    }
  }

  private generateAlerts(equityRatio: number, totalEquity: number): AlertItem[] {
    const alerts: AlertItem[] = []

    if (totalEquity < 0) {
      alerts.push(
        this.createAlert(
          'critical',
          '債務超過',
          '純資産がマイナスであり、債務超過の状態です。',
          'equityRatio',
          equityRatio,
          undefined,
          '資本政策の見直し、増資、資産売却など、早急な改善策が必要です。'
        )
      )
    } else if (equityRatio < ANALYSIS_THRESHOLDS.equityRatio.poor) {
      alerts.push(
        this.createAlert(
          'critical',
          '自己資本比率が危険水準',
          `自己資本比率が${equityRatio.toFixed(1)}%と極めて低く、財務の安定性に懸念があります。`,
          'equityRatio',
          equityRatio,
          ANALYSIS_THRESHOLDS.equityRatio.poor,
          '利益の内部留保による自己資本の積み増し、増資の検討、または借入金の返済優先などを検討してください。'
        )
      )
    } else if (equityRatio < ANALYSIS_THRESHOLDS.equityRatio.fair) {
      alerts.push(
        this.createAlert(
          'medium',
          '自己資本比率が低め',
          `自己資本比率が${equityRatio.toFixed(1)}%と、目安（${ANALYSIS_THRESHOLDS.equityRatio.fair}%以上）を下回っています。`,
          'equityRatio',
          equityRatio,
          ANALYSIS_THRESHOLDS.equityRatio.fair,
          '収益力向上による内部留保の増加や、借入金の計画的な返済を検討してください。'
        )
      )
    }

    return alerts
  }
}
