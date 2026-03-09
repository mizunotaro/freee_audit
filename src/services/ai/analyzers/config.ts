import type { RetryConfig, CircuitBreakerConfig } from './utils'
import { DEFAULT_RETRY_CONFIG, DEFAULT_CIRCUIT_BREAKER_CONFIG } from './utils'

/**
 * 設定バージョン
 *
 * @remarks
 * 設定の互換性を管理するためのバージョン番号
 * 設定構造が変更された場合はメジャーバージョンを上げる
 */
export const CONFIG_VERSION = '1.0.0'

/**
 * 財務アナライザー設定
 *
 * @remarks
 * 全てのタイムアウト、リトライ、しきい値を一元管理
 * 環境変数による上書き可能
 */

/**
 * アナライザー設定インターフェース
 */
export interface AnalyzerConfig {
  /**
   * 設定バージョン
   * @default '1.0.0'
   */
  readonly version: string
  /**
   * 分析全体のタイムアウト（ミリ秒）
   * @default 30000
   */
  readonly timeout: number

  /**
   * カテゴリ別分析のタイムアウト（ミリ秒）
   * @default 5000
   */
  readonly categoryTimeout: number

  /**
   * 計算処理の最大反復回数
   * @default 10000
   */
  readonly maxIterations: number

  /**
   * 最大アラート数
   * @default 100
   */
  readonly maxAlerts: number

  /**
   * 最大推奨事項数
   * @default 50
   */
  readonly maxRecommendations: number

  /**
   * 部分的エラーを許容するか
   * @default true
   */
  readonly allowPartialFailure: boolean

  /**
   * 数値計算のイプシロン（浮動小数点誤差許容）
   * @default 0.01
   */
  readonly epsilon: number

  /**
   * キャッシュの最大サイズ
   * @default 100
   */
  readonly cacheMaxSize: number

  /**
   * キャッシュのTTL（ミリ秒）
   * @default 60000
   */
  readonly cacheTtl: number

  /**
   * 最大入力サイズ
   */
  readonly maxInputSize: {
    readonly balanceSheetItems: number
    readonly profitLossItems: number
    readonly recursionDepth: number
  }

  /**
   * リトライ設定
   */
  readonly retry: RetryConfig

  /**
   * Circuit Breaker設定
   */
  readonly circuitBreaker: CircuitBreakerConfig
}

/**
 * デフォルト設定
 */
export const DEFAULT_ANALYZER_CONFIG: AnalyzerConfig = {
  version: CONFIG_VERSION,
  timeout: 30_000,
  categoryTimeout: 5_000,
  maxIterations: 10_000,
  maxAlerts: 100,
  maxRecommendations: 50,
  allowPartialFailure: true,
  epsilon: 0.01,
  cacheMaxSize: 100,
  cacheTtl: 60_000,
  maxInputSize: {
    balanceSheetItems: 1000,
    profitLossItems: 1000,
    recursionDepth: 10,
  },
  retry: DEFAULT_RETRY_CONFIG,
  circuitBreaker: DEFAULT_CIRCUIT_BREAKER_CONFIG,
}

/**
 * 環境変数から設定を読み込み
 *
 * @returns 設定オブジェクト
 */
export function getAnalyzerConfig(): AnalyzerConfig {
  const env = process.env

  return {
    version: CONFIG_VERSION,
    timeout: parseEnvNumber(env.ANALYZER_TIMEOUT, DEFAULT_ANALYZER_CONFIG.timeout),
    categoryTimeout: parseEnvNumber(
      env.ANALYZER_CATEGORY_TIMEOUT,
      DEFAULT_ANALYZER_CONFIG.categoryTimeout
    ),
    maxIterations: parseEnvNumber(
      env.ANALYZER_MAX_ITERATIONS,
      DEFAULT_ANALYZER_CONFIG.maxIterations
    ),
    maxAlerts: parseEnvNumber(env.ANALYZER_MAX_ALERTS, DEFAULT_ANALYZER_CONFIG.maxAlerts),
    maxRecommendations: parseEnvNumber(
      env.ANALYZER_MAX_RECOMMENDATIONS,
      DEFAULT_ANALYZER_CONFIG.maxRecommendations
    ),
    allowPartialFailure: env.ANALYZER_ALLOW_PARTIAL_FAILURE !== 'false',
    epsilon: parseEnvNumber(env.ANALYZER_EPSILON, DEFAULT_ANALYZER_CONFIG.epsilon),
    cacheMaxSize: parseEnvNumber(env.ANALYZER_CACHE_MAX_SIZE, DEFAULT_ANALYZER_CONFIG.cacheMaxSize),
    cacheTtl: parseEnvNumber(env.ANALYZER_CACHE_TTL, DEFAULT_ANALYZER_CONFIG.cacheTtl),
    maxInputSize: {
      balanceSheetItems: parseEnvNumber(
        env.ANALYZER_MAX_BALANCE_SHEET_ITEMS,
        DEFAULT_ANALYZER_CONFIG.maxInputSize.balanceSheetItems
      ),
      profitLossItems: parseEnvNumber(
        env.ANALYZER_MAX_PROFIT_LOSS_ITEMS,
        DEFAULT_ANALYZER_CONFIG.maxInputSize.profitLossItems
      ),
      recursionDepth: parseEnvNumber(
        env.ANALYZER_MAX_RECURSION_DEPTH,
        DEFAULT_ANALYZER_CONFIG.maxInputSize.recursionDepth
      ),
    },
    retry: {
      maxRetries: parseEnvNumber(
        env.ANALYZER_RETRY_MAX_RETRIES,
        DEFAULT_ANALYZER_CONFIG.retry.maxRetries
      ),
      initialDelayMs: parseEnvNumber(
        env.ANALYZER_RETRY_INITIAL_DELAY,
        DEFAULT_ANALYZER_CONFIG.retry.initialDelayMs
      ),
      maxDelayMs: parseEnvNumber(
        env.ANALYZER_RETRY_MAX_DELAY,
        DEFAULT_ANALYZER_CONFIG.retry.maxDelayMs
      ),
      backoffMultiplier: parseEnvNumber(
        env.ANALYZER_RETRY_BACKOFF,
        DEFAULT_ANALYZER_CONFIG.retry.backoffMultiplier
      ),
    },
    circuitBreaker: {
      failureThreshold: parseEnvNumber(
        env.ANALYZER_CB_THRESHOLD,
        DEFAULT_ANALYZER_CONFIG.circuitBreaker.failureThreshold
      ),
      resetTimeoutMs: parseEnvNumber(
        env.ANALYZER_CB_RESET_TIMEOUT,
        DEFAULT_ANALYZER_CONFIG.circuitBreaker.resetTimeoutMs
      ),
    },
  }
}

/**
 * 環境変数を数値としてパース
 */
function parseEnvNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const parsed = parseInt(value, 10)
  return isNaN(parsed) ? fallback : parsed
}

/**
 * 設定をマージ
 *
 * @param base - ベース設定
 * @param override - 上書き設定
 * @returns マージされた設定
 */
export function mergeConfig(
  base: AnalyzerConfig,
  override: Partial<AnalyzerConfig>
): AnalyzerConfig {
  return {
    ...base,
    ...override,
    maxInputSize: {
      ...base.maxInputSize,
      ...override.maxInputSize,
    },
    retry: {
      ...base.retry,
      ...override.retry,
    },
    circuitBreaker: {
      ...base.circuitBreaker,
      ...override.circuitBreaker,
    },
  }
}
