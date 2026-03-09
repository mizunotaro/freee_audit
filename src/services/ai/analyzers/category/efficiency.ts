import type { BalanceSheet, ProfitLoss } from '@/types'
import type { KeyMetric, AlertItem } from '../types'
import type { CategoryAnalysisResult } from './base'
import { ANALYSIS_THRESHOLDS } from '../types'
import { extractRevenue, calculateAverageTotalAssets } from '../utils'
import { BaseCategoryAnalyzer } from './base'

export class EfficiencyAnalyzer extends BaseCategoryAnalyzer {
  readonly category = 'efficiency' as const

  analyze(
    bs: BalanceSheet,
    pl: ProfitLoss,
    prevBS?: BalanceSheet,
    _prevPL?: ProfitLoss
  ): CategoryAnalysisResult {
    this.logger.debug('Starting efficiency analysis', { module: 'EfficiencyAnalyzer' })

    const revenue = extractRevenue(pl)
    const avgAssets = calculateAverageTotalAssets(bs, prevBS)

    const assetTurnover = this.safeDivide(revenue, avgAssets, 0)

    const metrics: KeyMetric[] = [
      this.createMetric(
        '総資産回転率',
        assetTurnover,
        '回',
        'ratio',
        this.evaluateMetric(assetTurnover, ANALYSIS_THRESHOLDS.assetTurnover)
      ),
    ]

    const alerts = this.generateAlerts(assetTurnover)

    this.logger.debug('Efficiency analysis completed', { module: 'EfficiencyAnalyzer' })

    return {
      score: this.calculateScore(metrics),
      metrics,
      alerts,
    }
  }

  private generateAlerts(assetTurnover: number): AlertItem[] {
    const alerts: AlertItem[] = []

    if (assetTurnover < ANALYSIS_THRESHOLDS.assetTurnover.poor) {
      alerts.push(
        this.createAlert(
          'low',
          '資産効率が低い',
          `総資産回転率が${assetTurnover.toFixed(2)}回と低水準です。`,
          'assetTurnover',
          assetTurnover,
          ANALYSIS_THRESHOLDS.assetTurnover.poor,
          '遊休資産の活用または売却、売上増加のための戦略見直しを検討してください。'
        )
      )
    }

    return alerts
  }
}
