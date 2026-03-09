import type { BalanceSheet, ProfitLoss } from '@/types'
import type {
  FinancialStatementSet,
  AnalysisOptions,
  FinancialAnalysisResult,
  CategoryAnalysis,
  AlertItem,
  RecommendationItem,
  KeyMetric,
  AnalysisCategory,
  AnalysisContext,
  IdGenerator,
} from './types'
import {
  ANALYSIS_THRESHOLDS,
  getStatusFromScore,
  DefaultIdGenerator,
  DeterministicIdGenerator,
} from './types'
import {
  safeDivide,
  extractTotalAssets,
  extractTotalEquity,
  extractTotalLiabilities,
  extractCurrentAssets,
  extractCurrentLiabilities,
  extractInventory,
  extractCashAndEquivalents,
  extractRevenue,
  extractGrossProfit,
  extractOperatingIncome,
  extractNetIncome,
  calculateAverageTotalAssets,
  calculateAverageEquity,
  determineTrend,
  classifyFinancialHealth,
  calculateSafeGrowthRate,
  checkTimeout,
  CircuitBreaker,
  TimeProvider,
  SystemTimeProvider,
  MockTimeProvider,
  Logger,
  NoOpLogger,
} from './utils'
import { validateFinancialStatementSet, normalizeStatements } from './validators'
import { getAnalyzerConfig, type AnalyzerConfig } from './config'
import {
  GROWTH_THRESHOLDS,
  CATEGORY_WEIGHTS,
  STATUS_SCORES,
  CATEGORY_NAMES_JA,
  STATUS_DESCRIPTIONS_JA,
  PRIORITY_ORDER,
} from './constants'

/**
 * 財務分析を行うクラス
 *
 * @remarks
 * 財務諸表データを分析し、包括的な財務分析結果を生成します。
 * 流動性、安全性、収益性、効率性、成長性の5つのカテゴリで分析を行います。
 *
 * @example
 * ```typescript
 * const analyzer = new FinancialAnalyzer()
 * const result = analyzer.analyze({
 *   balanceSheet: bs,
 *   profitLoss: pl,
 *   previousBalanceSheet: prevBS,
 *   previousProfitLoss: prevPL
 * })
 * ```
 */
export class FinancialAnalyzer {
  private readonly config: AnalyzerConfig
  private readonly circuitBreaker: CircuitBreaker
  private readonly idGenerator: IdGenerator
  private readonly timeProvider: TimeProvider
  private readonly logger: Logger
  private cleanupCallbacks: Array<() => void> = []

  constructor(config?: Partial<AnalyzerConfig>) {
    this.config = config ? { ...getAnalyzerConfig(), ...config } : getAnalyzerConfig()
    this.circuitBreaker = new CircuitBreaker(this.config.circuitBreaker)
    this.idGenerator = new DefaultIdGenerator()
    this.timeProvider = new SystemTimeProvider()
    this.logger = new NoOpLogger()
  }

  static create(options?: {
    config?: Partial<AnalyzerConfig>
    idGenerator?: IdGenerator
    timeProvider?: TimeProvider
    logger?: Logger
    deterministic?: boolean
    fixedTimestamp?: Date
  }): FinancialAnalyzer {
    const analyzer = new FinancialAnalyzer(options?.config)

    if (options?.deterministic) {
      const deterministicConfig: Partial<AnalyzerConfig> = {
        ...options?.config,
      }
      const analyzer = new FinancialAnalyzer(deterministicConfig)
      Object.defineProperty(analyzer, 'idGenerator', {
        value: new DeterministicIdGenerator(),
        writable: false,
      })
      Object.defineProperty(analyzer, 'timeProvider', {
        value: new MockTimeProvider(options.fixedTimestamp ?? new Date(0)),
        writable: false,
      })
      return analyzer
    }

    if (options?.idGenerator) {
      Object.defineProperty(analyzer, 'idGenerator', {
        value: options.idGenerator,
        writable: false,
      })
    }
    if (options?.timeProvider) {
      Object.defineProperty(analyzer, 'timeProvider', {
        value: options.timeProvider,
        writable: false,
      })
    }
    if (options?.logger) {
      Object.defineProperty(analyzer, 'logger', {
        value: options.logger,
        writable: false,
      })
    }

    return analyzer
  }

  getCircuitBreaker(): CircuitBreaker {
    return this.circuitBreaker
  }

  getCircuitBreakerState() {
    return this.circuitBreaker.getState()
  }

  private registerCleanup(callback: () => void): void {
    this.cleanupCallbacks.push(callback)
  }

  private runCleanup(): void {
    for (const callback of this.cleanupCallbacks) {
      try {
        callback()
      } catch {
        // Ignore cleanup errors
      }
    }
    this.cleanupCallbacks = []
  }

  /**
   * 財務諸表を分析し、包括的な分析結果を返す
   *
   * @param statements - 分析対象の財務諸表セット
   * @param options - 分析オプション
   * @returns 分析結果（成功/失敗）
   *
   * @example
   * ```typescript
   * const result = analyzer.analyze(statements, {
   *   deterministic: true,
   *   includeAlerts: true
   * })
   * ```
   */
  analyze(
    statements: FinancialStatementSet,
    options: AnalysisOptions = {}
  ): FinancialAnalysisResult {
    const startTime = Date.now()

    try {
      checkTimeout(startTime, this.config.timeout)

      const validationResult = validateFinancialStatementSet(statements)
      if (!validationResult.success) {
        return {
          success: false,
          error: validationResult.error,
        }
      }

      const normalized = normalizeStatements(statements)
      const { balanceSheet, profitLoss, previousBalanceSheet, previousProfitLoss } = normalized

      const context: AnalysisContext = {
        balanceSheet,
        profitLoss,
        previousBalanceSheet,
        previousProfitLoss,
        options,
        config: this.config,
        startTime,
      }

      const categoryAnalyses = this.analyzeAllCategories(
        balanceSheet,
        profitLoss,
        previousBalanceSheet,
        previousProfitLoss,
        context
      )

      checkTimeout(startTime, this.config.timeout)

      const overallScore = this.calculateOverallScore(categoryAnalyses)
      const overallStatus = getStatusFromScore(overallScore)

      const allAlerts = categoryAnalyses.flatMap((c) => c.alerts)
      const topRecommendations = this.prioritizeRecommendations(
        categoryAnalyses.flatMap((c) => c.recommendations)
      )

      const keyMetrics = this.extractKeyMetricsFromCategories(categoryAnalyses)

      const executiveSummary = this.generateExecutiveSummary(
        overallScore,
        overallStatus,
        categoryAnalyses,
        classifyFinancialHealth(balanceSheet, profitLoss)
      )

      const analyzedAt = this.timeProvider.now()

      return {
        success: true,
        data: {
          overallScore,
          overallStatus,
          executiveSummary,
          categoryAnalyses,
          allAlerts,
          topRecommendations: topRecommendations.slice(0, this.config.maxRecommendations),
          keyMetrics,
          processingTimeMs: this.timeProvider.timestamp() - startTime,
          analyzedAt,
        },
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('timed out')) {
        if (this.config.allowPartialFailure) {
          return this.createPartialFailureResult(error, startTime)
        }
      }
      return {
        success: false,
        error: {
          code: 'analysis_failed',
          message: error instanceof Error ? error.message : 'Unknown error during analysis',
        },
      }
    } finally {
      this.runCleanup()
    }
  }

  /**
   * Circuit Breakerを通じて財務諸表を分析（非同期版）
   *
   * @param statements - 分析対象の財務諸表セット
   * @param options - 分析オプション
   * @returns 分析結果（成功/失敗）
   */
  async analyzeWithCircuitBreaker(
    statements: FinancialStatementSet,
    options: AnalysisOptions = {}
  ): Promise<FinancialAnalysisResult> {
    return this.circuitBreaker.execute(() => Promise.resolve(this.analyze(statements, options)))
  }

  /**
   * 部分的な失敗時の結果を生成
   */
  private createPartialFailureResult(error: Error, startTime: number): FinancialAnalysisResult {
    return {
      success: true,
      data: {
        overallScore: 50,
        overallStatus: 'fair',
        executiveSummary: `分析がタイムアウトしました: ${error.message}`,
        categoryAnalyses: [],
        allAlerts: [
          {
            id: this.idGenerator.generateAlertId(),
            category: 'comprehensive',
            severity: 'high',
            title: '分析タイムアウト',
            description: error.message,
            metric: 'timeout',
            currentValue: this.timeProvider.timestamp() - startTime,
            recommendation: 'データ量を減らすか、タイムアウト設定を増やしてください。',
          },
        ],
        topRecommendations: [],
        keyMetrics: [],
        processingTimeMs: this.timeProvider.timestamp() - startTime,
        analyzedAt: this.timeProvider.now(),
      },
    }
  }

  private analyzeAllCategories(
    bs: BalanceSheet,
    pl: ProfitLoss,
    prevBS?: BalanceSheet,
    prevPL?: ProfitLoss,
    context?: AnalysisContext
  ): CategoryAnalysis[] {
    const requestedCategory = context?.options.category
    const categories: AnalysisCategory[] = requestedCategory
      ? [requestedCategory]
      : ['liquidity', 'safety', 'profitability', 'efficiency', 'growth']

    const completedCategories = new Map<AnalysisCategory, CategoryAnalysis>()

    return categories.map((category) => {
      checkTimeout(context?.startTime ?? Date.now(), this.config.categoryTimeout)

      const result = this.analyzeCategory(category, bs, pl, prevBS, prevPL, completedCategories)
      completedCategories.set(category, result)
      return result
    })
  }

  private analyzeCategory(
    category: AnalysisCategory,
    bs: BalanceSheet,
    pl: ProfitLoss,
    prevBS?: BalanceSheet,
    prevPL?: ProfitLoss,
    completedCategories?: ReadonlyMap<AnalysisCategory, CategoryAnalysis>
  ): CategoryAnalysis {
    const analyzers: Record<
      AnalysisCategory,
      () => { score: number; metrics: KeyMetric[]; alerts: AlertItem[] }
    > = {
      liquidity: () => this.analyzeLiquidity(bs, pl, prevBS),
      safety: () => this.analyzeSafety(bs, pl, prevBS),
      profitability: () => this.analyzeProfitability(bs, pl, prevBS, prevPL),
      efficiency: () => this.analyzeEfficiency(bs, pl, prevBS),
      growth: () => this.analyzeGrowth(bs, pl, prevBS, prevPL),
      cashflow: () => this.analyzeCashflow(bs, pl, prevBS),
      comprehensive: () => this.analyzeComprehensive(bs, pl, prevBS, prevPL, completedCategories),
    }

    const analyzer = analyzers[category]
    const { score, metrics, alerts } = analyzer()

    const limitedAlerts = alerts.slice(0, this.config.maxAlerts)
    const recommendations = this.generateRecommendations(category, limitedAlerts, metrics)

    return {
      category,
      score,
      status: getStatusFromScore(score),
      summary: this.generateCategorySummary(category, score, metrics),
      trends: [],
      alerts: limitedAlerts,
      recommendations,
      metrics,
    }
  }

  private analyzeLiquidity(
    bs: BalanceSheet,
    _pl: ProfitLoss,
    prevBS?: BalanceSheet
  ): { score: number; metrics: KeyMetric[]; alerts: AlertItem[] } {
    const currentAssets = extractCurrentAssets(bs)
    const currentLiabilities = extractCurrentLiabilities(bs)
    const inventory = extractInventory(bs)
    const cash = extractCashAndEquivalents(bs)

    const currentRatio = safeDivide(currentAssets, currentLiabilities, 0) * 100
    const quickRatio = safeDivide(currentAssets - inventory, currentLiabilities, 0) * 100
    const cashRatio = safeDivide(cash, currentLiabilities, 0) * 100

    const prevCurrentRatio = prevBS
      ? safeDivide(extractCurrentAssets(prevBS), extractCurrentLiabilities(prevBS), 0) * 100
      : undefined

    const metrics: KeyMetric[] = [
      {
        name: '流動比率',
        value: currentRatio,
        unit: '%',
        format: 'percentage',
        status: this.evaluateMetric(currentRatio, ANALYSIS_THRESHOLDS.currentRatio),
        trend: prevCurrentRatio ? determineTrend(currentRatio, prevCurrentRatio) : undefined,
      },
      {
        name: '当座比率',
        value: quickRatio,
        unit: '%',
        format: 'percentage',
        status: this.evaluateMetric(quickRatio, ANALYSIS_THRESHOLDS.quickRatio),
      },
      {
        name: 'キャッシュ比率',
        value: cashRatio,
        unit: '%',
        format: 'percentage',
        status: this.evaluateMetric(cashRatio, { excellent: 50, good: 30, fair: 15, poor: 5 }),
      },
    ]

    const alerts: AlertItem[] = []

    if (currentRatio < ANALYSIS_THRESHOLDS.currentRatio.poor) {
      alerts.push({
        id: this.idGenerator.generateAlertId(),
        category: 'liquidity',
        severity: 'critical',
        title: '流動比率が著しく低い',
        description: `流動比率が${currentRatio.toFixed(1)}%と、基準値（${ANALYSIS_THRESHOLDS.currentRatio.poor}%以上）を大幅に下回っています。`,
        metric: 'currentRatio',
        currentValue: currentRatio,
        threshold: ANALYSIS_THRESHOLDS.currentRatio.poor,
        recommendation:
          '短期的な資金繰り改善策を検討してください。売掛金の回収促進や在庫の圧縮、借入期間の見直しなど。',
      })
    } else if (currentRatio < ANALYSIS_THRESHOLDS.currentRatio.fair) {
      alerts.push({
        id: this.idGenerator.generateAlertId(),
        category: 'liquidity',
        severity: 'medium',
        title: '流動比率が低め',
        description: `流動比率が${currentRatio.toFixed(1)}%と、安全性の目安（${ANALYSIS_THRESHOLDS.currentRatio.fair}%以上）を下回っています。`,
        metric: 'currentRatio',
        currentValue: currentRatio,
        threshold: ANALYSIS_THRESHOLDS.currentRatio.fair,
        recommendation: '運転資金の管理状況を確認し、必要に応じて改善策を検討してください。',
      })
    }

    const score = this.calculateCategoryScore(metrics)

    return { score, metrics, alerts }
  }

  private analyzeSafety(
    bs: BalanceSheet,
    _pl: ProfitLoss,
    prevBS?: BalanceSheet
  ): { score: number; metrics: KeyMetric[]; alerts: AlertItem[] } {
    const totalAssets = extractTotalAssets(bs)
    const totalEquity = extractTotalEquity(bs)
    const totalLiabilities = extractTotalLiabilities(bs)

    const equityRatio = safeDivide(totalEquity, totalAssets, 0) * 100
    const debtToEquity = safeDivide(totalLiabilities, totalEquity, 0)
    const debtRatio = safeDivide(totalLiabilities, totalAssets, 0) * 100

    const prevEquityRatio = prevBS
      ? safeDivide(extractTotalEquity(prevBS), extractTotalAssets(prevBS), 0) * 100
      : undefined

    const metrics: KeyMetric[] = [
      {
        name: '自己資本比率',
        value: equityRatio,
        unit: '%',
        format: 'percentage',
        status: this.evaluateMetric(equityRatio, ANALYSIS_THRESHOLDS.equityRatio, true),
        trend: prevEquityRatio ? determineTrend(equityRatio, prevEquityRatio) : undefined,
      },
      {
        name: '負債比率（D/Eレシオ）',
        value: debtToEquity,
        unit: '倍',
        format: 'ratio',
        status: this.evaluateMetricReverse(debtToEquity, ANALYSIS_THRESHOLDS.debtToEquity),
      },
      {
        name: '負債比率',
        value: debtRatio,
        unit: '%',
        format: 'percentage',
        status: this.evaluateMetricReverse(debtRatio, {
          excellent: 50,
          good: 70,
          fair: 80,
          poor: 90,
        }),
      },
    ]

    const alerts: AlertItem[] = []

    if (equityRatio < ANALYSIS_THRESHOLDS.equityRatio.poor) {
      alerts.push({
        id: this.idGenerator.generateAlertId(),
        category: 'safety',
        severity: 'critical',
        title: '自己資本比率が危険水準',
        description: `自己資本比率が${equityRatio.toFixed(1)}%と極めて低く、財務の安定性に懸念があります。`,
        metric: 'equityRatio',
        currentValue: equityRatio,
        threshold: ANALYSIS_THRESHOLDS.equityRatio.poor,
        recommendation:
          '利益の内部留保による自己資本の積み増し、増資の検討、または借入金の返済優先などを検討してください。',
      })
    } else if (equityRatio < ANALYSIS_THRESHOLDS.equityRatio.fair) {
      alerts.push({
        id: this.idGenerator.generateAlertId(),
        category: 'safety',
        severity: 'medium',
        title: '自己資本比率が低め',
        description: `自己資本比率が${equityRatio.toFixed(1)}%と、目安（${ANALYSIS_THRESHOLDS.equityRatio.fair}%以上）を下回っています。`,
        metric: 'equityRatio',
        currentValue: equityRatio,
        threshold: ANALYSIS_THRESHOLDS.equityRatio.fair,
        recommendation:
          '収益力向上による内部留保の増加や、借入金の計画的な返済を検討してください。',
      })
    }

    if (totalEquity < 0) {
      alerts.push({
        id: this.idGenerator.generateAlertId(),
        category: 'safety',
        severity: 'critical',
        title: '債務超過',
        description: '純資産がマイナスであり、債務超過の状態です。',
        metric: 'equityRatio',
        currentValue: equityRatio,
        recommendation: '資本政策の見直し、増資、資産売却など、早急な改善策が必要です。',
      })
    }

    const score = this.calculateCategoryScore(metrics)

    return { score, metrics, alerts }
  }

  private analyzeProfitability(
    bs: BalanceSheet,
    pl: ProfitLoss,
    prevBS?: BalanceSheet,
    prevPL?: ProfitLoss
  ): { score: number; metrics: KeyMetric[]; alerts: AlertItem[] } {
    const revenue = extractRevenue(pl)
    const grossProfit = extractGrossProfit(pl)
    const operatingIncome = extractOperatingIncome(pl)
    const netIncome = extractNetIncome(pl)
    const avgAssets = calculateAverageTotalAssets(bs, prevBS)
    const avgEquity = calculateAverageEquity(bs, prevBS)

    const grossMargin = safeDivide(grossProfit, revenue, 0) * 100
    const operatingMargin = safeDivide(operatingIncome, revenue, 0) * 100
    const netMargin = safeDivide(netIncome, revenue, 0) * 100
    const roa = safeDivide(netIncome, avgAssets, 0) * 100
    const roe = safeDivide(netIncome, avgEquity, 0) * 100

    const prevGrossMargin =
      prevPL && revenue > 0
        ? safeDivide(extractGrossProfit(prevPL), extractRevenue(prevPL), 0) * 100
        : undefined

    const metrics: KeyMetric[] = [
      {
        name: '売上総利益率',
        value: grossMargin,
        unit: '%',
        format: 'percentage',
        status: this.evaluateMetric(grossMargin, ANALYSIS_THRESHOLDS.grossMargin),
        trend: prevGrossMargin ? determineTrend(grossMargin, prevGrossMargin) : undefined,
      },
      {
        name: '営業利益率',
        value: operatingMargin,
        unit: '%',
        format: 'percentage',
        status: this.evaluateMetric(operatingMargin, ANALYSIS_THRESHOLDS.operatingMargin),
      },
      {
        name: '当期純利益率',
        value: netMargin,
        unit: '%',
        format: 'percentage',
        status: this.evaluateMetric(netMargin, ANALYSIS_THRESHOLDS.netMargin),
      },
      {
        name: 'ROA（総資産利益率）',
        value: roa,
        unit: '%',
        format: 'percentage',
        status: this.evaluateMetric(roa, ANALYSIS_THRESHOLDS.roa),
      },
      {
        name: 'ROE（自己資本利益率）',
        value: roe,
        unit: '%',
        format: 'percentage',
        status: this.evaluateMetric(roe, ANALYSIS_THRESHOLDS.roe),
      },
    ]

    const alerts: AlertItem[] = []

    if (netIncome < 0) {
      alerts.push({
        id: this.idGenerator.generateAlertId(),
        category: 'profitability',
        severity: 'high',
        title: '当期赤字',
        description: `当期純利益が${netIncome.toLocaleString()}円の赤字です。`,
        metric: 'netMargin',
        currentValue: netMargin,
        recommendation: '収益構造の見直し、コスト削減、または収益源の多角化を検討してください。',
      })
    }

    if (operatingMargin < ANALYSIS_THRESHOLDS.operatingMargin.poor && operatingMargin > 0) {
      alerts.push({
        id: this.idGenerator.generateAlertId(),
        category: 'profitability',
        severity: 'medium',
        title: '営業利益率が低い',
        description: `営業利益率が${operatingMargin.toFixed(1)}%と低水準です。`,
        metric: 'operatingMargin',
        currentValue: operatingMargin,
        threshold: ANALYSIS_THRESHOLDS.operatingMargin.poor,
        recommendation:
          'コスト構造の分析と効率化、または付加価値の向上による価格転嫁を検討してください。',
      })
    }

    const score = this.calculateCategoryScore(metrics)

    return { score, metrics, alerts }
  }

  private analyzeEfficiency(
    bs: BalanceSheet,
    pl: ProfitLoss,
    prevBS?: BalanceSheet
  ): { score: number; metrics: KeyMetric[]; alerts: AlertItem[] } {
    const revenue = extractRevenue(pl)
    const avgAssets = calculateAverageTotalAssets(bs, prevBS)

    const assetTurnover = safeDivide(revenue, avgAssets, 0)

    const metrics: KeyMetric[] = [
      {
        name: '総資産回転率',
        value: assetTurnover,
        unit: '回',
        format: 'ratio',
        status: this.evaluateMetric(assetTurnover, ANALYSIS_THRESHOLDS.assetTurnover),
      },
    ]

    const alerts: AlertItem[] = []

    if (assetTurnover < ANALYSIS_THRESHOLDS.assetTurnover.poor) {
      alerts.push({
        id: this.idGenerator.generateAlertId(),
        category: 'efficiency',
        severity: 'low',
        title: '資産効率が低い',
        description: `総資産回転率が${assetTurnover.toFixed(2)}回と低水準です。`,
        metric: 'assetTurnover',
        currentValue: assetTurnover,
        threshold: ANALYSIS_THRESHOLDS.assetTurnover.poor,
        recommendation: '遊休資産の活用または売却、売上増加のための戦略見直しを検討してください。',
      })
    }

    const score = this.calculateCategoryScore(metrics)

    return { score, metrics, alerts }
  }

  private analyzeGrowth(
    bs: BalanceSheet,
    pl: ProfitLoss,
    prevBS?: BalanceSheet,
    prevPL?: ProfitLoss
  ): { score: number; metrics: KeyMetric[]; alerts: AlertItem[] } {
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
      {
        name: '売上成長率',
        value: revenueGrowth ?? 0,
        unit: '%',
        format: 'percentage',
        status: revenueGrowth !== null ? this.evaluateGrowth(revenueGrowth) : 'fair',
      },
      {
        name: '純利益成長率',
        value: netIncomeGrowth ?? 0,
        unit: '%',
        format: 'percentage',
        status: netIncomeGrowth !== null ? this.evaluateGrowth(netIncomeGrowth) : 'fair',
      },
      {
        name: '自己資本成長率',
        value: equityGrowth ?? 0,
        unit: '%',
        format: 'percentage',
        status: equityGrowth !== null ? this.evaluateGrowth(equityGrowth) : 'fair',
      },
    ]

    const alerts: AlertItem[] = []

    if (revenueGrowth !== null && revenueGrowth < GROWTH_THRESHOLDS.poor) {
      alerts.push({
        id: this.idGenerator.generateAlertId(),
        category: 'growth',
        severity: 'high',
        title: '売上大幅減少',
        description: `売上が前期比${revenueGrowth.toFixed(1)}%減少しています。`,
        metric: 'revenueGrowth',
        currentValue: revenueGrowth,
        recommendation:
          '売上減少の要因を分析し、市場環境の変化や競合状況を踏まえた対策を検討してください。',
      })
    }

    const score = this.calculateCategoryScore(metrics)

    return { score, metrics, alerts }
  }

  private analyzeCashflow(
    bs: BalanceSheet,
    pl: ProfitLoss,
    _prevBS?: BalanceSheet
  ): { score: number; metrics: KeyMetric[]; alerts: AlertItem[] } {
    const netIncome = extractNetIncome(pl)
    const depreciation = pl.depreciation ?? 0
    const operatingCashFlow = netIncome + depreciation

    const revenue = extractRevenue(pl)
    const ocfMargin = safeDivide(operatingCashFlow, revenue, 0) * 100

    const metrics: KeyMetric[] = [
      {
        name: '営業CF',
        value: operatingCashFlow,
        unit: '円',
        format: 'currency',
        status: operatingCashFlow > 0 ? 'good' : operatingCashFlow === 0 ? 'fair' : 'poor',
      },
      {
        name: '営業CFマージン',
        value: ocfMargin,
        unit: '%',
        format: 'percentage',
        status: this.evaluateMetric(ocfMargin, { excellent: 20, good: 10, fair: 5, poor: 0 }),
      },
    ]

    const alerts: AlertItem[] = []

    if (operatingCashFlow < 0) {
      alerts.push({
        id: this.idGenerator.generateAlertId(),
        category: 'cashflow',
        severity: 'high',
        title: '営業キャッシュフローがマイナス',
        description: `営業キャッシュフローが${operatingCashFlow.toLocaleString()}円のマイナスです。`,
        metric: 'operatingCashFlow',
        currentValue: operatingCashFlow,
        recommendation: '資金繰りの改善策を検討してください。売掛金回収の促進や在庫削減など。',
      })
    }

    const score = this.calculateCategoryScore(metrics)

    return { score, metrics, alerts }
  }

  private analyzeComprehensive(
    bs: BalanceSheet,
    pl: ProfitLoss,
    prevBS?: BalanceSheet,
    prevPL?: ProfitLoss,
    completedCategories?: ReadonlyMap<AnalysisCategory, CategoryAnalysis>
  ): { score: number; metrics: KeyMetric[]; alerts: AlertItem[] } {
    if (completedCategories && completedCategories.size > 0) {
      const liquidity = completedCategories.get('liquidity')
      const safety = completedCategories.get('safety')
      const profitability = completedCategories.get('profitability')
      const efficiency = completedCategories.get('efficiency')
      const growth = completedCategories.get('growth')

      const scores = [liquidity, safety, profitability, efficiency, growth]
        .filter((c): c is CategoryAnalysis => c !== undefined)
        .map((c) => c.score)

      const overallScore =
        scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 50

      const allMetrics = [
        liquidity?.metrics[0],
        safety?.metrics[0],
        profitability?.metrics[0],
      ].filter((m): m is KeyMetric => m !== undefined)

      return {
        score: overallScore,
        metrics: allMetrics,
        alerts: [],
      }
    }

    const liquidity = this.analyzeLiquidity(bs, pl, prevBS)
    const safety = this.analyzeSafety(bs, pl, prevBS)
    const profitability = this.analyzeProfitability(bs, pl, prevBS, prevPL)
    const efficiency = this.analyzeEfficiency(bs, pl, prevBS)
    const growth = this.analyzeGrowth(bs, pl, prevBS, prevPL)

    const scores = [
      liquidity.score,
      safety.score,
      profitability.score,
      efficiency.score,
      growth.score,
    ]
    const overallScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)

    const allMetrics = [liquidity.metrics[0], safety.metrics[0], profitability.metrics[0]].filter(
      (m): m is KeyMetric => m !== undefined
    )

    return {
      score: overallScore,
      metrics: allMetrics,
      alerts: [],
    }
  }

  private evaluateMetric(
    value: number,
    thresholds: { excellent: number; good: number; fair: number; poor: number },
    higherIsBetter: boolean = true
  ): 'excellent' | 'good' | 'fair' | 'poor' | 'critical' {
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

  private evaluateMetricReverse(
    value: number,
    thresholds: { excellent: number; good: number; fair: number; poor: number }
  ): 'excellent' | 'good' | 'fair' | 'poor' | 'critical' {
    if (value <= thresholds.excellent) return 'excellent'
    if (value <= thresholds.good) return 'good'
    if (value <= thresholds.fair) return 'fair'
    if (value <= thresholds.poor) return 'poor'
    return 'critical'
  }

  /**
   * 成長率を評価
   *
   * @param value - 成長率（%）
   * @returns ステータス
   */
  private evaluateGrowth(value: number): 'excellent' | 'good' | 'fair' | 'poor' | 'critical' {
    if (value >= GROWTH_THRESHOLDS.excellent) return 'excellent'
    if (value >= GROWTH_THRESHOLDS.good) return 'good'
    if (value >= GROWTH_THRESHOLDS.fair) return 'fair'
    if (value >= GROWTH_THRESHOLDS.poor) return 'poor'
    return 'critical'
  }

  private calculateCategoryScore(metrics: KeyMetric[]): number {
    if (metrics.length === 0) return 50

    const totalScore = metrics.reduce((sum, m) => sum + (STATUS_SCORES[m.status] ?? 50), 0)
    return Math.round(totalScore / metrics.length)
  }

  private calculateOverallScore(categories: CategoryAnalysis[]): number {
    if (categories.length === 0) return 50

    let totalWeight = 0
    let weightedSum = 0

    for (const category of categories) {
      const weight = CATEGORY_WEIGHTS[category.category] ?? 1.0
      totalWeight += weight
      weightedSum += category.score * weight
    }

    return Math.round(weightedSum / totalWeight)
  }

  private prioritizeRecommendations(recommendations: RecommendationItem[]): RecommendationItem[] {
    return [...recommendations].sort(
      (a, b) => (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1)
    )
  }

  private generateRecommendations(
    category: AnalysisCategory,
    alerts: AlertItem[],
    _metrics: KeyMetric[]
  ): RecommendationItem[] {
    return alerts.map((alert) => ({
      id: this.idGenerator.generateRecommendationId(),
      priority: this.alertSeverityToPriority(alert.severity),
      category,
      title: alert.title,
      description: alert.description,
      expectedImpact: '財務健全性の改善が期待されます',
      timeframe:
        alert.severity === 'critical'
          ? 'immediate'
          : alert.severity === 'high'
            ? 'short_term'
            : 'medium_term',
      relatedAlerts: [alert.id],
    }))
  }

  private alertSeverityToPriority(
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  ): 'high' | 'medium' | 'low' {
    if (severity === 'critical' || severity === 'high') return 'high'
    if (severity === 'medium') return 'medium'
    return 'low'
  }

  /**
   * カテゴリ分析結果から主要な指標を抽出
   *
   * @remarks
   * 既に計算済みのカテゴリ分析結果を再利用し、重複計算を回避します。
   */
  private extractKeyMetricsFromCategories(categories: CategoryAnalysis[]): KeyMetric[] {
    const liquidity = categories.find((c) => c.category === 'liquidity')
    const safety = categories.find((c) => c.category === 'safety')
    const profitability = categories.find((c) => c.category === 'profitability')

    return [
      liquidity?.metrics[0],
      safety?.metrics[0],
      profitability?.metrics[4],
      profitability?.metrics[1],
    ].filter((m): m is KeyMetric => m !== undefined)
  }

  private generateCategorySummary(
    category: AnalysisCategory,
    score: number,
    metrics: KeyMetric[]
  ): string {
    const status = getStatusFromScore(score)
    const statusDescription = STATUS_DESCRIPTIONS_JA[status] ?? '不明'

    const mainMetric = metrics[0]
    const metricInfo = mainMetric
      ? `${mainMetric.name}: ${mainMetric.value.toFixed(1)}${mainMetric.unit}`
      : ''

    return `${CATEGORY_NAMES_JA[category] ?? category}分析: ${statusDescription}（スコア: ${score}点）${metricInfo ? `。${metricInfo}` : ''}`
  }

  private generateExecutiveSummary(
    score: number,
    status: string,
    categories: CategoryAnalysis[],
    health: { type: string; description: string }
  ): string {
    const statusDescription =
      STATUS_DESCRIPTIONS_JA[status as keyof typeof STATUS_DESCRIPTIONS_JA] ?? '不明'

    const criticalAlerts = categories.flatMap((c) =>
      c.alerts.filter((a) => a.severity === 'critical')
    )
    const highAlerts = categories.flatMap((c) => c.alerts.filter((a) => a.severity === 'high'))

    let summary = `【総合評価】${statusDescription}（スコア: ${score}点）\n\n`
    summary += `${health.description}\n\n`

    if (criticalAlerts.length > 0) {
      summary += `【緊急の課題】\n${criticalAlerts.map((a) => `・${a.title}`).join('\n')}\n\n`
    }

    if (highAlerts.length > 0) {
      summary += `【重要な課題】\n${highAlerts
        .slice(0, 3)
        .map((a) => `・${a.title}`)
        .join('\n')}\n\n`
    }

    const strongCategories = categories.filter((c) => c.score >= 70)
    if (strongCategories.length > 0) {
      summary += `【強み】\n${strongCategories.map((c) => `・${CATEGORY_NAMES_JA[c.category] ?? c.category}`).join('\n')}`
    }

    return summary
  }
}

/**
 * 財務アナライザーのインスタンスを作成
 *
 * @param config - オプションの設定上書き
 * @returns FinancialAnalyzerのインスタンス
 */
export function createFinancialAnalyzer(config?: Partial<AnalyzerConfig>): FinancialAnalyzer {
  return new FinancialAnalyzer(config)
}

/**
 * 財務諸表を分析する便利関数
 *
 * @param statements - 分析対象の財務諸表セット
 * @param options - 分析オプション
 * @returns 分析結果
 *
 * @example
 * ```typescript
 * const result = analyzeFinancials({
 *   balanceSheet: bs,
 *   profitLoss: pl
 * })
 *
 * if (result.success) {
 *   console.log(result.data.overallScore)
 * }
 * ```
 */
export function analyzeFinancials(
  statements: FinancialStatementSet,
  options?: AnalysisOptions
): FinancialAnalysisResult {
  const analyzer = new FinancialAnalyzer()
  return analyzer.analyze(statements, options)
}
