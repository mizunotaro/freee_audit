import type { BalanceSheet, ProfitLoss } from '@/types'
import type { TrendDirection, LogContext, LogEntry } from './types'

export function isSafeNumber(value: unknown): value is number {
  return typeof value === 'number' && isFinite(value) && !isNaN(value)
}

export function toSafeNumber(
  value: unknown,
  fallback: number = 0,
  options: {
    min?: number
    max?: number
    allowNegative?: boolean
  } = {}
): number {
  const { min = -Infinity, max = Infinity, allowNegative = true } = options

  let result: number

  if (typeof value === 'number') {
    if (!isFinite(value) || isNaN(value)) {
      return fallback
    }
    result = value
  } else if (typeof value === 'string') {
    const normalized = value
      .replace(/[,，]/g, '')
      .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
    const parsed = parseFloat(normalized)
    if (!isFinite(parsed) || isNaN(parsed)) {
      return fallback
    }
    result = parsed
  } else if (value === null || value === undefined) {
    return fallback
  } else {
    return fallback
  }

  if (!allowNegative && result < 0) {
    return fallback
  }

  return Math.max(min, Math.min(max, result))
}

export function safeDivide(
  numerator: number,
  denominator: number,
  fallbackOrOptions?:
    | number
    | {
        fallback?: number
        epsilon?: number
        percentage?: boolean
      }
): number {
  let fallback = 0
  let epsilon = 0
  let percentage = false

  if (typeof fallbackOrOptions === 'number') {
    fallback = fallbackOrOptions
  } else if (fallbackOrOptions && typeof fallbackOrOptions === 'object') {
    fallback = fallbackOrOptions.fallback ?? 0
    epsilon = fallbackOrOptions.epsilon ?? 0
    percentage = fallbackOrOptions.percentage ?? false
  }

  if (!isSafeNumber(numerator) || !isSafeNumber(denominator)) {
    return fallback
  }

  if (Math.abs(denominator) <= epsilon) {
    return fallback
  }

  const result = numerator / denominator

  if (!isSafeNumber(result)) {
    return fallback
  }

  return percentage ? result * 100 : result
}

export function calculateSafeGrowthRate(current: number, previous: number): number | null {
  if (!isSafeNumber(current) || !isSafeNumber(previous)) {
    return null
  }

  if (current === 0 && previous === 0) {
    return null
  }

  if (previous === 0) {
    return current > 0 ? 100 : current < 0 ? -100 : null
  }

  const growth = ((current - previous) / Math.abs(previous)) * 100

  if (!isSafeNumber(growth)) {
    return null
  }

  return growth
}

export function approximatelyEqual(a: number, b: number, epsilon: number = 0.01): boolean {
  if (!isSafeNumber(a) || !isSafeNumber(b)) {
    return false
  }
  return Math.abs(a - b) <= epsilon
}

export function clamp(value: number, min: number, max: number): number {
  if (!isSafeNumber(value)) return min
  return Math.max(min, Math.min(max, value))
}

export function checkTimeout(startTime: number, timeoutMs: number): void {
  if (Date.now() - startTime > timeoutMs) {
    throw new Error(`Operation timed out after ${timeoutMs}ms`)
  }
}

export function checkIterationLimit(iteration: number, maxIterations: number): void {
  if (iteration > maxIterations) {
    throw new Error(`Iteration limit exceeded: ${iteration} > ${maxIterations}`)
  }
}

export function calculateGrowthRate(current: number, previous: number): number | null {
  if (previous === 0) {
    return current > 0 ? Infinity : current < 0 ? -Infinity : null
  }
  return ((current - previous) / Math.abs(previous)) * 100
}

export function formatCurrency(
  amount: number,
  unit: 'yen' | 'thousand' | 'million' = 'yen'
): string {
  const divisors = { yen: 1, thousand: 1000, million: 1000000 }
  const divisor = divisors[unit]
  const formatted = Math.round(amount / divisor).toLocaleString('ja-JP')
  const suffixes = { yen: '円', thousand: '千円', million: '百万円' }
  return `${formatted}${suffixes[unit]}`
}

export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`
}

export function formatRatio(value: number, decimals: number = 2): string {
  return value.toFixed(decimals)
}

export function formatDays(value: number): string {
  return `${Math.round(value)}日`
}

export function determineTrend(
  current: number,
  previous: number,
  threshold: number = 5
): TrendDirection {
  if (previous === 0) return 'stable'

  const changePercent = ((current - previous) / Math.abs(previous)) * 100

  if (Math.abs(changePercent) < threshold) return 'stable'
  return changePercent > 0 ? 'improving' : 'declining'
}

export function determineTrendFromSeries(values: readonly number[]): TrendDirection {
  if (values.length < 2) return 'stable'

  const changes: number[] = []
  for (let i = 1; i < values.length; i++) {
    if (values[i - 1] !== 0) {
      changes.push(((values[i] - values[i - 1]) / Math.abs(values[i - 1])) * 100)
    }
  }

  if (changes.length === 0) return 'stable'

  const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length
  const variance = changes.reduce((sum, c) => sum + Math.pow(c - avgChange, 2), 0) / changes.length

  if (variance > 100) return 'volatile'
  if (Math.abs(avgChange) < 5) return 'stable'
  return avgChange > 0 ? 'improving' : 'declining'
}

export function extractTotalAssets(bs: BalanceSheet): number {
  return bs.totalAssets ?? 0
}

export function extractTotalLiabilities(bs: BalanceSheet): number {
  return bs.totalLiabilities ?? 0
}

export function extractTotalEquity(bs: BalanceSheet): number {
  return bs.totalEquity ?? 0
}

export function extractCurrentAssets(bs: BalanceSheet): number {
  return bs.assets.current.reduce((sum, item) => sum + (item.amount ?? 0), 0)
}

export function extractCurrentLiabilities(bs: BalanceSheet): number {
  return bs.liabilities.current.reduce((sum, item) => sum + (item.amount ?? 0), 0)
}

export function extractInventory(bs: BalanceSheet): number {
  const inventoryItem = bs.assets.current.find(
    (item) => item.name.includes('棚卸') || item.name.includes('在庫') || item.code === '1005'
  )
  return inventoryItem?.amount ?? 0
}

export function extractCashAndEquivalents(bs: BalanceSheet): number {
  const cashItems = bs.assets.current.filter(
    (item) =>
      item.name.includes('現金') ||
      item.name.includes('預金') ||
      item.code === '1001' ||
      item.code === '1002'
  )
  return cashItems.reduce((sum, item) => sum + (item.amount ?? 0), 0)
}

export function extractRetainedEarnings(bs: BalanceSheet): number {
  const retainedItem = bs.equity.items.find(
    (item) => item.name.includes('利益剰余') || item.name.includes('繰越') || item.code === '3300'
  )
  return retainedItem?.amount ?? 0
}

export function extractRevenue(pl: ProfitLoss): number {
  return pl.revenue.reduce((sum, item) => sum + (item.amount ?? 0), 0)
}

export function extractCostOfSales(pl: ProfitLoss): number {
  return pl.costOfSales.reduce((sum, item) => sum + (item.amount ?? 0), 0)
}

export function extractGrossProfit(pl: ProfitLoss): number {
  return pl.grossProfit ?? 0
}

export function extractOperatingIncome(pl: ProfitLoss): number {
  return pl.operatingIncome ?? 0
}

export function extractNetIncome(pl: ProfitLoss): number {
  return pl.netIncome ?? 0
}

export function extractDepreciation(pl: ProfitLoss): number {
  return pl.depreciation ?? 0
}

export function extractInterestExpense(pl: ProfitLoss): number {
  const interestItem = pl.nonOperatingExpenses.find(
    (item) => item.name.includes('支払利息') || item.name.includes('利息')
  )
  return interestItem?.amount ?? 0
}

export function calculateAverageTotalAssets(
  currentBS: BalanceSheet,
  previousBS?: BalanceSheet
): number {
  const current = extractTotalAssets(currentBS)
  if (!previousBS) return current
  const previous = extractTotalAssets(previousBS)
  return (current + previous) / 2
}

export function calculateAverageEquity(currentBS: BalanceSheet, previousBS?: BalanceSheet): number {
  const current = extractTotalEquity(currentBS)
  if (!previousBS) return current
  const previous = extractTotalEquity(previousBS)
  return (current + previous) / 2
}

export function generateAlertId(): string {
  return `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function generateRecommendationId(): string {
  return `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function classifyFinancialHealth(
  bs: BalanceSheet,
  pl: ProfitLoss
): { type: string; description: string } {
  const equity = extractTotalEquity(bs)
  const revenue = extractRevenue(pl)
  const netIncome = extractNetIncome(pl)

  if (equity < 0) {
    return { type: 'insolvent', description: '債務超過の状態です' }
  }

  if (netIncome < 0 && revenue > 0) {
    return { type: 'loss_making', description: '赤字経営の状態です' }
  }

  if (revenue === 0) {
    return { type: 'pre_revenue', description: '売上が計上されていません' }
  }

  const equityRatio = safeDivide(equity, bs.totalAssets, 0) * 100

  if (equityRatio > 50 && netIncome > 0) {
    return { type: 'healthy', description: '財務状況は健全です' }
  }

  if (equityRatio > 30) {
    return { type: 'stable', description: '財務状況は安定しています' }
  }

  return { type: 'leveraged', description: '財務レバレッジが高めです' }
}

export interface RetryConfig {
  maxRetries: number
  initialDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: Error | undefined
  let delay = config.initialDelayMs

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (attempt < config.maxRetries) {
        await sleep(delay)
        delay = Math.min(delay * config.backoffMultiplier, config.maxDelayMs)
      }
    }
  }

  throw lastError
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export interface CircuitBreakerConfig {
  failureThreshold: number
  resetTimeoutMs: number
}

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 30000,
}

export type CircuitState = 'closed' | 'open' | 'half-open'

export class CircuitBreaker {
  private state: CircuitState = 'closed'
  private failureCount: number = 0
  private lastFailureTime: number = 0

  constructor(private config: CircuitBreakerConfig = DEFAULT_CIRCUIT_BREAKER_CONFIG) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime >= this.config.resetTimeoutMs) {
        this.state = 'half-open'
      } else {
        throw new Error('Circuit breaker is open')
      }
    }

    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess(): void {
    this.failureCount = 0
    this.state = 'closed'
  }

  private onFailure(): void {
    this.failureCount++
    this.lastFailureTime = Date.now()
    if (this.failureCount >= this.config.failureThreshold) {
      this.state = 'open'
    }
  }

  getState(): CircuitState {
    return this.state
  }

  reset(): void {
    this.state = 'closed'
    this.failureCount = 0
    this.lastFailureTime = 0
  }
}

/**
 * 時間プロバイダーインターフェース
 *
 * @remarks
 * テスト時の決定論的実行のために注入可能
 */
export interface TimeProvider {
  now(): Date
  timestamp(): number
}

/**
 * システム時間プロバイダー
 *
 * @remarks
 * 実際のシステム時間を使用（非決定的）
 */
export class SystemTimeProvider implements TimeProvider {
  now(): Date {
    return new Date()
  }

  timestamp(): number {
    return Date.now()
  }
}

/**
 * モック時間プロバイダー
 *
 * @remarks
 * 固定時間を返す（決定的、テスト用）
 */
export class MockTimeProvider implements TimeProvider {
  constructor(private fixedTime: Date) {}

  now(): Date {
    return this.fixedTime
  }

  timestamp(): number {
    return this.fixedTime.getTime()
  }
}

/**
 * ロガーインターフェース
 *
 * @remarks
 * 構造化ログ出力のために注入可能
 */
export interface Logger {
  debug(message: string, context?: Partial<LogContext>): void
  info(message: string, context?: Partial<LogContext>): void
  warn(message: string, context?: Partial<LogContext>): void
  error(message: string, context?: Partial<LogContext>): void
}

/**
 * コンソールロガー
 *
 * @remarks
 * JSON形式で構造化ログを出力
 */
export class ConsoleLogger implements Logger {
  constructor(private baseContext: LogContext) {}

  debug(message: string, context?: Partial<LogContext>): void {
    this.log('debug', message, context)
  }

  info(message: string, context?: Partial<LogContext>): void {
    this.log('info', message, context)
  }

  warn(message: string, context?: Partial<LogContext>): void {
    this.log('warn', message, context)
  }

  error(message: string, context?: Partial<LogContext>): void {
    this.log('error', message, context)
  }

  private log(level: LogEntry['level'], message: string, context?: Partial<LogContext>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: { ...this.baseContext, ...context },
    }
    console.log(JSON.stringify(entry))
  }
}

/**
 * No-opロガー
 *
 * @remarks
 * ログ出力を無効化（本番環境での無駄なログ回避やテスト用）
 */
export class NoOpLogger implements Logger {
  debug(_message: string, _context?: Partial<LogContext>): void {}
  info(_message: string, _context?: Partial<LogContext>): void {}
  warn(_message: string, _context?: Partial<LogContext>): void {}
  error(_message: string, _context?: Partial<LogContext>): void {}
}

export interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

export class AnalysisCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map()

  constructor(
    private maxSize: number = 100,
    private defaultTtl: number = 60000
  ) {}

  get(key: string): T | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return undefined
    }

    return entry.data
  }

  set(key: string, data: T, ttl?: number): void {
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey) {
        this.cache.delete(oldestKey)
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl ?? this.defaultTtl,
    })
  }

  invalidate(pattern?: RegExp): void {
    if (!pattern) {
      this.cache.clear()
      return
    }

    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key)
      }
    }
  }

  size(): number {
    return this.cache.size
  }
}

export async function processParallel<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number = 5
): Promise<R[]> {
  const results: R[] = []

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency)
    const batchResults = await Promise.all(batch.map(processor))
    results.push(...batchResults)
  }

  return results
}
