import type { BalanceSheet, ProfitLoss } from '@/types'
import type { KeyMetric, AlertItem } from '../types'
import type { CategoryAnalysisResult } from './base'
import { ANALYSIS_THRESHOLDS } from '../types'
import {
  extractRevenue,
  extractGrossProfit,
  extractOperatingIncome,
  extractNetIncome,
  calculateAverageTotalAssets,
  calculateAverageEquity,
} from '../utils'
import { BaseCategoryAnalyzer } from './base'

export class ProfitabilityAnalyzer extends BaseCategoryAnalyzer {
  readonly category = 'profitability' as const

  analyze(
    bs: BalanceSheet,
    pl: ProfitLoss,
    prevBS?: BalanceSheet,
    prevPL?: ProfitLoss
  ): CategoryAnalysisResult {
    this.logger.debug('Starting profitability analysis', { module: 'ProfitabilityAnalyzer' })

    const revenue = extractRevenue(pl)
    const grossProfit = extractGrossProfit(pl)
    const operatingIncome = extractOperatingIncome(pl)
    const netIncome = extractNetIncome(pl)
    const avgAssets = calculateAverageTotalAssets(bs, prevBS)
    const avgEquity = calculateAverageEquity(bs, prevBS)

    const grossMargin = this.safeDivide(grossProfit, revenue, 0) * 100
    const operatingMargin = this.safeDivide(operatingIncome, revenue, 0) * 100
    const netMargin = this.safeDivide(netIncome, revenue, 0) * 100
    const roa = this.safeDivide(netIncome, avgAssets, 0) * 100
    const roe = this.safeDivide(netIncome, avgEquity, 0) * 100

    const prevGrossMargin =
      prevPL && revenue > 0
        ? this.safeDivide(extractGrossProfit(prevPL), extractRevenue(prevPL), 0) * 100
        : undefined

    const metrics: KeyMetric[] = [
      this.createMetric(
        '売上総利益率',
        grossMargin,
        '%',
        'percentage',
        this.evaluateMetric(grossMargin, ANALYSIS_THRESHOLDS.grossMargin),
        prevGrossMargin ? this.determineTrend(grossMargin, prevGrossMargin) : undefined
      ),
      this.createMetric(
        '営業利益率',
        operatingMargin,
        '%',
        'percentage',
        this.evaluateMetric(operatingMargin, ANALYSIS_THRESHOLDS.operatingMargin)
      ),
      this.createMetric(
        '当期純利益率',
        netMargin,
        '%',
        'percentage',
        this.evaluateMetric(netMargin, ANALYSIS_THRESHOLDS.netMargin)
      ),
      this.createMetric(
        'ROA（総資産利益率）',
        roa,
        '%',
        'percentage',
        this.evaluateMetric(roa, ANALYSIS_THRESHOLDS.roa)
      ),
      this.createMetric(
        'ROE（自己資本利益率）',
        roe,
        '%',
        'percentage',
        this.evaluateMetric(roe, ANALYSIS_THRESHOLDS.roe)
      ),
    ]

    const alerts = this.generateAlerts(netIncome, operatingMargin)

    this.logger.debug('Profitability analysis completed', { module: 'ProfitabilityAnalyzer' })

    return {
      score: this.calculateScore(metrics),
      metrics,
      alerts,
    }
  }

  private generateAlerts(netIncome: number, operatingMargin: number): AlertItem[] {
    const alerts: AlertItem[] = []

    if (netIncome < 0) {
      alerts.push(
        this.createAlert(
          'high',
          '当期赤字',
          `当期純利益が${netIncome.toLocaleString()}円の赤字です。`,
          'netMargin',
          this.safeDivide(netIncome, 1, 0),
          undefined,
          '収益構造の見直し、コスト削減、または収益源の多角化を検討してください。'
        )
      )
    }

    if (operatingMargin < ANALYSIS_THRESHOLDS.operatingMargin.poor && operatingMargin > 0) {
      alerts.push(
        this.createAlert(
          'medium',
          '営業利益率が低い',
          `営業利益率が${operatingMargin.toFixed(1)}%と低水準です。`,
          'operatingMargin',
          operatingMargin,
          ANALYSIS_THRESHOLDS.operatingMargin.poor,
          'コスト構造の分析と効率化、または付加価値の向上による価格転嫁を検討してください。'
        )
      )
    }

    return alerts
  }
}
