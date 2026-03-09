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
import { getStatusFromScore, DefaultIdGenerator, DeterministicIdGenerator } from './types'
import {
  checkTimeout,
  CircuitBreaker,
  TimeProvider,
  SystemTimeProvider,
  MockTimeProvider,
  Logger,
  NoOpLogger,
  AnalysisCache,
  classifyFinancialHealth,
} from './utils'
import { validateFinancialStatementSet, normalizeStatements } from './validators'
import { getAnalyzerConfig, type AnalyzerConfig } from './config'
import {
  CATEGORY_WEIGHTS,
  CATEGORY_NAMES_JA,
  STATUS_DESCRIPTIONS_JA,
  PRIORITY_ORDER,
} from './constants'
import {
  BaseCategoryAnalyzer,
  LiquidityAnalyzer,
  SafetyAnalyzer,
  ProfitabilityAnalyzer,
  EfficiencyAnalyzer,
  GrowthAnalyzer,
  CashflowAnalyzer,
} from './category'

export class FinancialAnalyzer {
  private readonly config: AnalyzerConfig
  private readonly circuitBreaker: CircuitBreaker
  private readonly idGenerator: IdGenerator
  private readonly timeProvider: TimeProvider
  private readonly logger: Logger
  private readonly categoryCache: AnalysisCache<CategoryAnalysis>
  private readonly categoryAnalyzers: Map<AnalysisCategory, BaseCategoryAnalyzer>
  private cleanupCallbacks: Array<() => void> = []

  constructor(config?: Partial<AnalyzerConfig>) {
    this.config = config ? { ...getAnalyzerConfig(), ...config } : getAnalyzerConfig()
    this.circuitBreaker = new CircuitBreaker(this.config.circuitBreaker)
    this.idGenerator = new DefaultIdGenerator()
    this.timeProvider = new SystemTimeProvider()
    this.logger = new NoOpLogger()
    this.categoryCache = new AnalysisCache<CategoryAnalysis>(
      this.config.cacheMaxSize,
      this.config.cacheTtl
    )
    this.categoryAnalyzers = this.createCategoryAnalyzers()
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

  async analyzeWithCircuitBreaker(
    statements: FinancialStatementSet,
    options: AnalysisOptions = {}
  ): Promise<FinancialAnalysisResult> {
    return this.circuitBreaker.execute(() => this.analyzeAsync(statements, options))
  }

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

  private createCategoryAnalyzers(): Map<AnalysisCategory, BaseCategoryAnalyzer> {
    const analyzers = new Map<AnalysisCategory, BaseCategoryAnalyzer>()

    analyzers.set(
      'liquidity',
      new LiquidityAnalyzer(this.config, this.idGenerator, this.logger, this.timeProvider)
    )
    analyzers.set(
      'safety',
      new SafetyAnalyzer(this.config, this.idGenerator, this.logger, this.timeProvider)
    )
    analyzers.set(
      'profitability',
      new ProfitabilityAnalyzer(this.config, this.idGenerator, this.logger, this.timeProvider)
    )
    analyzers.set(
      'efficiency',
      new EfficiencyAnalyzer(this.config, this.idGenerator, this.logger, this.timeProvider)
    )
    analyzers.set(
      'growth',
      new GrowthAnalyzer(this.config, this.idGenerator, this.logger, this.timeProvider)
    )
    analyzers.set(
      'cashflow',
      new CashflowAnalyzer(this.config, this.idGenerator, this.logger, this.timeProvider)
    )

    return analyzers
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

  private async analyzeAllCategoriesAsync(
    bs: BalanceSheet,
    pl: ProfitLoss,
    prevBS?: BalanceSheet,
    prevPL?: ProfitLoss,
    context?: AnalysisContext
  ): Promise<CategoryAnalysis[]> {
    const requestedCategory = context?.options.category
    const categories: AnalysisCategory[] = requestedCategory
      ? [requestedCategory]
      : ['liquidity', 'safety', 'profitability', 'efficiency', 'growth']

    const analysisPromises = categories.map(async (category) => {
      checkTimeout(context?.startTime ?? Date.now(), this.config.categoryTimeout)
      return this.analyzeCategory(category, bs, pl, prevBS, prevPL)
    })

    return Promise.all(analysisPromises)
  }

  async analyzeAsync(
    statements: FinancialStatementSet,
    options: AnalysisOptions = {}
  ): Promise<FinancialAnalysisResult> {
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

      const categoryAnalyses = await this.analyzeAllCategoriesAsync(
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

  private analyzeCategory(
    category: AnalysisCategory,
    bs: BalanceSheet,
    pl: ProfitLoss,
    prevBS?: BalanceSheet,
    prevPL?: ProfitLoss,
    completedCategories?: ReadonlyMap<AnalysisCategory, CategoryAnalysis>
  ): CategoryAnalysis {
    const cacheKey = this.generateCacheKey(category, bs, pl, prevBS, prevPL)

    const cached = this.categoryCache.get(cacheKey)
    if (cached) {
      return cached
    }

    const result = this.performCategoryAnalysis(
      category,
      bs,
      pl,
      prevBS,
      prevPL,
      completedCategories
    )

    this.categoryCache.set(cacheKey, result)

    return result
  }

  private performCategoryAnalysis(
    category: AnalysisCategory,
    bs: BalanceSheet,
    pl: ProfitLoss,
    prevBS?: BalanceSheet,
    prevPL?: ProfitLoss,
    completedCategories?: ReadonlyMap<AnalysisCategory, CategoryAnalysis>
  ): CategoryAnalysis {
    let score: number
    let metrics: KeyMetric[]
    let alerts: AlertItem[]

    if (category === 'comprehensive') {
      const comprehensive = this.analyzeComprehensive(bs, pl, prevBS, prevPL, completedCategories)
      score = comprehensive.score
      metrics = comprehensive.metrics
      alerts = comprehensive.alerts
    } else {
      const analyzer = this.categoryAnalyzers.get(category)
      if (analyzer) {
        const result = analyzer.analyze(bs, pl, prevBS, prevPL)
        score = result.score
        metrics = result.metrics
        alerts = result.alerts
      } else {
        score = 50
        metrics = []
        alerts = []
      }
    }

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

  private generateCacheKey(
    category: AnalysisCategory,
    bs: BalanceSheet,
    pl: ProfitLoss,
    prevBS?: BalanceSheet,
    prevPL?: ProfitLoss
  ): string {
    const bsHash = this.hashFinancialData(bs)
    const plHash = this.hashFinancialData(pl)
    const prevBsHash = prevBS ? this.hashFinancialData(prevBS) : 'none'
    const prevPlHash = prevPL ? this.hashFinancialData(prevPL) : 'none'

    return `${category}:${bsHash}:${plHash}:${prevBsHash}:${prevPlHash}`
  }

  private hashFinancialData(data: unknown): string {
    return JSON.stringify(data).slice(0, 64)
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

    const liquidityAnalyzer = this.categoryAnalyzers.get('liquidity')
    const safetyAnalyzer = this.categoryAnalyzers.get('safety')
    const profitabilityAnalyzer = this.categoryAnalyzers.get('profitability')
    const efficiencyAnalyzer = this.categoryAnalyzers.get('efficiency')
    const growthAnalyzer = this.categoryAnalyzers.get('growth')

    const liquidity = liquidityAnalyzer?.analyze(bs, pl, prevBS) ?? {
      score: 50,
      metrics: [],
      alerts: [],
    }
    const safety = safetyAnalyzer?.analyze(bs, pl, prevBS) ?? { score: 50, metrics: [], alerts: [] }
    const profitability = profitabilityAnalyzer?.analyze(bs, pl, prevBS, prevPL) ?? {
      score: 50,
      metrics: [],
      alerts: [],
    }
    const efficiency = efficiencyAnalyzer?.analyze(bs, pl, prevBS) ?? {
      score: 50,
      metrics: [],
      alerts: [],
    }
    const growth = growthAnalyzer?.analyze(bs, pl, prevBS, prevPL) ?? {
      score: 50,
      metrics: [],
      alerts: [],
    }

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

export function createFinancialAnalyzer(config?: Partial<AnalyzerConfig>): FinancialAnalyzer {
  return new FinancialAnalyzer(config)
}

export function analyzeFinancials(
  statements: FinancialStatementSet,
  options?: AnalysisOptions
): FinancialAnalysisResult {
  const analyzer = new FinancialAnalyzer()
  return analyzer.analyze(statements, options)
}
