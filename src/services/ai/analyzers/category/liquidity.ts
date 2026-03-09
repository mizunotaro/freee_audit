import type { BalanceSheet, ProfitLoss } from '@/types'
import type { KeyMetric, AlertItem } from '../types'
import type { CategoryAnalysisResult, MetricThresholds } from './base'
import { ANALYSIS_THRESHOLDS } from '../types'
import {
  extractCurrentAssets,
  extractCurrentLiabilities,
  extractInventory,
  extractCashAndEquivalents,
} from '../utils'
import { BaseCategoryAnalyzer } from './base'

const CASH_RATIO_THRESHOLDS: MetricThresholds = {
  excellent: 50,
  good: 30,
  fair: 15,
  poor: 5,
}

export class LiquidityAnalyzer extends BaseCategoryAnalyzer {
  readonly category = 'liquidity' as const

  analyze(
    bs: BalanceSheet,
    _pl: ProfitLoss,
    prevBS?: BalanceSheet,
    _prevPL?: ProfitLoss
  ): CategoryAnalysisResult {
    this.logger.debug('Starting liquidity analysis', { module: 'LiquidityAnalyzer' })

    const currentAssets = extractCurrentAssets(bs)
    const currentLiabilities = extractCurrentLiabilities(bs)
    const inventory = extractInventory(bs)
    const cash = extractCashAndEquivalents(bs)

    const currentRatio = this.safeDivide(currentAssets, currentLiabilities, 0) * 100
    const quickRatio = this.safeDivide(currentAssets - inventory, currentLiabilities, 0) * 100
    const cashRatio = this.safeDivide(cash, currentLiabilities, 0) * 100

    const prevCurrentRatio = prevBS
      ? this.safeDivide(extractCurrentAssets(prevBS), extractCurrentLiabilities(prevBS), 0) * 100
      : undefined

    const metrics: KeyMetric[] = [
      this.createMetric(
        '流動比率',
        currentRatio,
        '%',
        'percentage',
        this.evaluateMetric(currentRatio, ANALYSIS_THRESHOLDS.currentRatio),
        prevCurrentRatio ? this.determineTrend(currentRatio, prevCurrentRatio) : undefined
      ),
      this.createMetric(
        '当座比率',
        quickRatio,
        '%',
        'percentage',
        this.evaluateMetric(quickRatio, ANALYSIS_THRESHOLDS.quickRatio)
      ),
      this.createMetric(
        'キャッシュ比率',
        cashRatio,
        '%',
        'percentage',
        this.evaluateMetric(cashRatio, CASH_RATIO_THRESHOLDS)
      ),
    ]

    const alerts = this.generateAlerts(currentRatio)

    this.logger.debug('Liquidity analysis completed', {
      module: 'LiquidityAnalyzer',
    })

    return {
      score: this.calculateScore(metrics),
      metrics,
      alerts,
    }
  }

  private generateAlerts(currentRatio: number): AlertItem[] {
    const alerts: AlertItem[] = []

    if (currentRatio < ANALYSIS_THRESHOLDS.currentRatio.poor) {
      alerts.push(
        this.createAlert(
          'critical',
          '流動比率が著しく低い',
          `流動比率が${currentRatio.toFixed(1)}%と、基準値（${ANALYSIS_THRESHOLDS.currentRatio.poor}%以上）を大幅に下回っています。`,
          'currentRatio',
          currentRatio,
          ANALYSIS_THRESHOLDS.currentRatio.poor,
          '短期的な資金繰り改善策を検討してください。売掛金の回収促進や在庫の圧縮、借入期間の見直しなど。'
        )
      )
    } else if (currentRatio < ANALYSIS_THRESHOLDS.currentRatio.fair) {
      alerts.push(
        this.createAlert(
          'medium',
          '流動比率が低め',
          `流動比率が${currentRatio.toFixed(1)}%と、安全性の目安（${ANALYSIS_THRESHOLDS.currentRatio.fair}%以上）を下回っています。`,
          'currentRatio',
          currentRatio,
          ANALYSIS_THRESHOLDS.currentRatio.fair,
          '運転資金の管理状況を確認し、必要に応じて改善策を検討してください。'
        )
      )
    }

    return alerts
  }
}
