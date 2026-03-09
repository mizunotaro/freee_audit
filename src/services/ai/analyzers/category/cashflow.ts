import type { BalanceSheet, ProfitLoss } from '@/types'
import type { KeyMetric, AlertItem } from '../types'
import type { CategoryAnalysisResult, MetricStatus, MetricThresholds } from './base'
import { extractRevenue, extractNetIncome } from '../utils'
import { BaseCategoryAnalyzer } from './base'

const OCF_MARGIN_THRESHOLDS: MetricThresholds = {
  excellent: 20,
  good: 10,
  fair: 5,
  poor: 0,
}

export class CashflowAnalyzer extends BaseCategoryAnalyzer {
  readonly category = 'cashflow' as const

  analyze(
    bs: BalanceSheet,
    pl: ProfitLoss,
    _prevBS?: BalanceSheet,
    _prevPL?: ProfitLoss
  ): CategoryAnalysisResult {
    this.logger.debug('Starting cashflow analysis', { module: 'CashflowAnalyzer' })

    const netIncome = extractNetIncome(pl)
    const depreciation = pl.depreciation ?? 0
    const operatingCashFlow = netIncome + depreciation

    const revenue = extractRevenue(pl)
    const ocfMargin = this.safeDivide(operatingCashFlow, revenue, 0) * 100

    const metrics: KeyMetric[] = [
      this.createMetric(
        '営業CF',
        operatingCashFlow,
        '円',
        'currency',
        this.evaluateOperatingCashFlow(operatingCashFlow)
      ),
      this.createMetric(
        '営業CFマージン',
        ocfMargin,
        '%',
        'percentage',
        this.evaluateMetric(ocfMargin, OCF_MARGIN_THRESHOLDS)
      ),
    ]

    const alerts = this.generateAlerts(operatingCashFlow)

    this.logger.debug('Cashflow analysis completed', { module: 'CashflowAnalyzer' })

    return {
      score: this.calculateScore(metrics),
      metrics,
      alerts,
    }
  }

  private evaluateOperatingCashFlow(value: number): MetricStatus {
    if (value > 0) return 'good'
    if (value === 0) return 'fair'
    return 'poor'
  }

  private generateAlerts(operatingCashFlow: number): AlertItem[] {
    const alerts: AlertItem[] = []

    if (operatingCashFlow < 0) {
      alerts.push(
        this.createAlert(
          'high',
          '営業キャッシュフローがマイナス',
          `営業キャッシュフローが${operatingCashFlow.toLocaleString()}円のマイナスです。`,
          'operatingCashFlow',
          operatingCashFlow,
          undefined,
          '資金繰りの改善策を検討してください。売掛金回収の促進や在庫削減など。'
        )
      )
    }

    return alerts
  }
}
