import type { BalanceSheet, ProfitLoss } from '@/types'
import type { RatioAnalysisResult, RatioGroup, CalculatedRatio, RatioStatus } from './ratios/types'
import {
  calculateLiquidityRatios,
  calculateSafetyRatios,
  calculateProfitabilityRatios,
  calculateEfficiencyRatios,
  calculateGrowthRatios,
} from './ratios'

/**
 * 財務比率分析のオプション
 */
export interface AnalyzeOptions {
  /** 貸借対照表データ（必須） */
  readonly bs: BalanceSheet
  /** 損益計算書データ（必須） */
  readonly pl: ProfitLoss
  /** 前期貸借対照表（トレンド分析用、オプション） */
  readonly prevBS?: BalanceSheet
  /** 前期損益計算書（成長率計算用、オプション） */
  readonly prevPL?: ProfitLoss
}

/**
 * 財務比率を分析し、29種類の指標を計算するアナライザー
 *
 * 5つのカテゴリ（流動性、安全性、収益性、効率性、成長性）にわたる
 * 財務比率を計算し、ステータス判定とトレンド分析を行います。
 *
 * @example
 * ```typescript
 * const analyzer = new RatioAnalyzer()
 * const result = analyzer.analyze({ bs, pl, prevBS, prevPL })
 * if (result.success) {
 *   console.log(result.data.summary.overallScore)
 *   console.log(result.data.groups)
 * }
 * ```
 */
export class RatioAnalyzer {
  /**
   * 財務比率を分析し、結果を返す
   *
   * @param options - 分析オプション
   * @param options.bs - 貸借対照表データ（必須）
   * @param options.pl - 損益計算書データ（必須）
   * @param options.prevBS - 前期貸借対照表（トレンド分析用、オプション）
   * @param options.prevPL - 前期損益計算書（成長率計算用、オプション）
   * @returns 分析結果またはエラー
   *
   * @example
   * ```typescript
   * const analyzer = new RatioAnalyzer()
   * const result = analyzer.analyze({
   *   bs: balanceSheet,
   *   pl: profitLoss,
   *   prevBS: previousBalanceSheet,
   *   prevPL: previousProfitLoss
   * })
   *
   * if (result.success) {
   *   console.log('Overall Score:', result.data.summary.overallScore)
   *   console.log('Total Ratios:', result.data.summary.totalRatios)
   * } else {
   *   console.error('Error:', result.error.message)
   * }
   * ```
   */
  analyze(options: AnalyzeOptions): RatioAnalysisResult {
    const startTime = Date.now()

    // 入力バリデーション
    if (!options.bs) {
      console.error('[RatioAnalyzer] Validation failed: BalanceSheet is required')
      return {
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'BalanceSheet is required',
        },
      }
    }

    if (!options.pl) {
      console.error('[RatioAnalyzer] Validation failed: ProfitLoss is required')
      return {
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'ProfitLoss is required',
        },
      }
    }

    // 基本的なデータ整合性チェック
    if (options.bs.totalAssets <= 0) {
      console.error('[RatioAnalyzer] Validation failed: totalAssets must be positive')
      return {
        success: false,
        error: {
          code: 'INVALID_DATA',
          message: 'totalAssets must be positive',
        },
      }
    }

    console.log('[RatioAnalyzer] Analysis started', {
      fiscalYear: options.bs.fiscalYear,
      month: options.bs.month,
      hasPreviousData: !!(options.prevBS && options.prevPL),
      totalAssets: options.bs.totalAssets,
    })

    try {
      const { bs, pl, prevBS, prevPL } = options

      const liquidityRatios = calculateLiquidityRatios(bs, pl, prevBS)
      const safetyRatios = calculateSafetyRatios(bs, pl, prevBS)
      const profitabilityRatios = calculateProfitabilityRatios(bs, pl, prevBS, prevPL)
      const efficiencyRatios = calculateEfficiencyRatios(bs, pl, prevBS)
      const growthRatios = calculateGrowthRatios(bs, pl, prevBS, prevPL)

      const groups: RatioGroup[] = [
        this.createGroup('liquidity', '流動性', liquidityRatios),
        this.createGroup('safety', '安全性', safetyRatios),
        this.createGroup('profitability', '収益性', profitabilityRatios),
        this.createGroup('efficiency', '効率性', efficiencyRatios),
        this.createGroup('growth', '成長性', growthRatios),
      ]

      const allRatios = [
        ...liquidityRatios,
        ...safetyRatios,
        ...profitabilityRatios,
        ...efficiencyRatios,
        ...growthRatios,
      ]

      const summary = this.calculateSummary(allRatios)
      const duration = Date.now() - startTime

      console.log('[RatioAnalyzer] Analysis completed', {
        duration: `${duration}ms`,
        totalRatios: allRatios.length,
        overallScore: summary.overallScore,
        excellentCount: summary.excellentCount,
        goodCount: summary.goodCount,
        fairCount: summary.fairCount,
        poorCount: summary.poorCount,
        criticalCount: summary.criticalCount,
      })

      return {
        success: true,
        data: {
          groups,
          allRatios,
          summary,
          calculatedAt: new Date(),
        },
      }
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      console.error('[RatioAnalyzer] Analysis failed', {
        duration: `${duration}ms`,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      })

      return {
        success: false,
        error: {
          code: 'RATIO_ANALYSIS_FAILED',
          message: errorMessage,
        },
      }
    }
  }

  /**
   * カテゴリ別の比率グループを作成する
   *
   * @param category - カテゴリID
   * @param categoryName - カテゴリ名
   * @param ratios - 計算された比率配列
   * @returns 比率グループ
   */
  private createGroup(
    category: string,
    categoryName: string,
    ratios: CalculatedRatio[]
  ): RatioGroup {
    const averageScore = this.calculateAverageScore(ratios)
    const overallStatus = this.getOverallStatus(averageScore)

    return {
      category: category as RatioGroup['category'],
      categoryName,
      ratios,
      averageScore,
      overallStatus,
    }
  }

  /**
   * 比率配列の平均スコアを計算する
   *
   * @param ratios - 計算された比率配列
   * @returns 平均スコア（0-100）
   */
  private calculateAverageScore(ratios: CalculatedRatio[]): number {
    if (ratios.length === 0) return 50

    const statusScores: Record<RatioStatus, number> = {
      excellent: 100,
      good: 75,
      fair: 50,
      poor: 25,
      critical: 0,
    }

    const totalScore = ratios.reduce((sum, r) => sum + (statusScores[r.status] ?? 50), 0)
    return Math.round(totalScore / ratios.length)
  }

  /**
   * スコアに基づいて全体的なステータスを判定する
   *
   * @param score - スコア（0-100）
   * @returns ステータス
   */
  private getOverallStatus(score: number): RatioStatus {
    if (score >= 80) return 'excellent'
    if (score >= 60) return 'good'
    if (score >= 40) return 'fair'
    if (score >= 20) return 'poor'
    return 'critical'
  }

  /**
   * 全比率のサマリー統計を計算する
   *
   * @param ratios - 計算された全比率配列
   * @returns サマリー統計
   */
  private calculateSummary(ratios: CalculatedRatio[]) {
    const statusCounts = {
      excellent: 0,
      good: 0,
      fair: 0,
      poor: 0,
      critical: 0,
    }

    for (const ratio of ratios) {
      statusCounts[ratio.status]++
    }

    const overallScore = this.calculateAverageScore(ratios)

    return {
      totalRatios: ratios.length,
      excellentCount: statusCounts.excellent,
      goodCount: statusCounts.good,
      fairCount: statusCounts.fair,
      poorCount: statusCounts.poor,
      criticalCount: statusCounts.critical,
      overallScore,
    }
  }
}

/**
 * RatioAnalyzerのインスタンスを作成する
 *
 * @returns RatioAnalyzerインスタンス
 *
 * @example
 * ```typescript
 * const analyzer = createRatioAnalyzer()
 * const result = analyzer.analyze({ bs, pl })
 * ```
 */
export function createRatioAnalyzer(): RatioAnalyzer {
  return new RatioAnalyzer()
}

/**
 * 財務比率を分析する便利関数
 *
 * @param options - 分析オプション
 * @returns 分析結果またはエラー
 *
 * @example
 * ```typescript
 * const result = analyzeRatios({
 *   bs: balanceSheet,
 *   pl: profitLoss,
 *   prevBS: previousBalanceSheet,
 *   prevPL: previousProfitLoss
 * })
 *
 * if (result.success) {
 *   console.log(result.data.summary)
 * }
 * ```
 */
export function analyzeRatios(options: AnalyzeOptions): RatioAnalysisResult {
  const analyzer = new RatioAnalyzer()
  return analyzer.analyze(options)
}
