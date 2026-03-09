import type { BalanceSheet, ProfitLoss } from '@/types'
import type { KeyMetric, AlertItem } from '../types'
import type { CategoryAnalysisResult, MetricStatus } from './base'
import { GROWTH_THRESHOLDS } from '../constants'
import {
  extractRevenue,
  extractNetIncome,
  extractTotalEquity,
  calculateSafeGrowthRate,
} from '../utils'
import { BaseCategoryAnalyzer } from './base'

export class GrowthAnalyzer extends BaseCategoryAnalyzer {
  readonly category = 'growth' as const

  analyze(
    bs: BalanceSheet,
    pl: ProfitLoss,
    prevBS?: BalanceSheet,
    prevPL?: ProfitLoss
  ): CategoryAnalysisResult {
    this.logger.debug('Starting growth analysis', { module: 'GrowthAnalyzer' })

    const revenue = extractRevenue(pl)
    const netIncome = extractNetIncome(pl)
    const totalEquity = extractTotalEquity(bs)

    const prevRevenue = prevPL ? extractRevenue(prevPL) : undefined
    const prevNetIncome = prevPL ? extractNetIncome(prevPL) : undefined
    const prevEquity = prevBS ? extractTotalEquity(prevBS) : undefined

    const revenueGrowth =
      prevRevenue !== undefined ? calculateSafeGrowthRate(revenue, prevRevenue) : null
    const netIncomeGrowth =
      prevNetIncome !== undefined ? calculateSafeGrowthRate(netIncome, prevNetIncome) : null
    const equityGrowth =
      prevEquity !== undefined ? calculateSafeGrowthRate(totalEquity, prevEquity) : null

    const metrics: KeyMetric[] = [
      this.createMetric(
        '売上成長率',
        revenueGrowth ?? 0,
        '%',
        'percentage',
        revenueGrowth !== null ? this.evaluateGrowth(revenueGrowth) : 'fair'
      ),
      this.createMetric(
        '純利益成長率',
        netIncomeGrowth ?? 0,
        '%',
        'percentage',
        netIncomeGrowth !== null ? this.evaluateGrowth(netIncomeGrowth) : 'fair'
      ),
      this.createMetric(
        '自己資本成長率',
        equityGrowth ?? 0,
        '%',
        'percentage',
        equityGrowth !== null ? this.evaluateGrowth(equityGrowth) : 'fair'
      ),
    ]

    const alerts = this.generateAlerts(revenueGrowth)

    this.logger.debug('Growth analysis completed', { module: 'GrowthAnalyzer' })

    return {
      score: this.calculateScore(metrics),
      metrics,
      alerts,
    }
  }

  private evaluateGrowth(value: number): MetricStatus {
    if (value >= GROWTH_THRESHOLDS.excellent) return 'excellent'
    if (value >= GROWTH_THRESHOLDS.good) return 'good'
    if (value >= GROWTH_THRESHOLDS.fair) return 'fair'
    if (value >= GROWTH_THRESHOLDS.poor) return 'poor'
    return 'critical'
  }

  private generateAlerts(revenueGrowth: number | null): AlertItem[] {
    const alerts: AlertItem[] = []

    if (revenueGrowth !== null && revenueGrowth < GROWTH_THRESHOLDS.poor) {
      alerts.push(
        this.createAlert(
          'high',
          '売上大幅減少',
          `売上が前期比${revenueGrowth.toFixed(1)}%減少しています。`,
          'revenueGrowth',
          revenueGrowth,
          GROWTH_THRESHOLDS.poor,
          '売上減少の要因を分析し、市場環境の変化や競合状況を踏まえた対策を検討してください。'
        )
      )
    }

    return alerts
  }
}
