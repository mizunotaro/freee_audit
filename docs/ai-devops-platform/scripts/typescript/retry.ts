/**
 * Exponential Backoff Retry Utility for AI-DevOps-Platform
 * Provides robust retry mechanism with configurable backoff
 *
 * @see docs/ai/QUALITY_STANDARDS.md - Quality Gate 1: Stability
 */

import { Result, AppError, ErrorCodes, createError, timeoutError } from './result'

export interface RetryConfig {
  maxAttempts: number
  initialDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
  jitter: boolean
  timeoutMs: number
  retryableErrors: string[]
  onRetry?: (attempt: number, error: AppError, delayMs: number) => void
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitter: true,
  timeoutMs: 120000,
  retryableErrors: [
    ErrorCodes.NETWORK_ERROR,
    ErrorCodes.TIMEOUT_ERROR,
    ErrorCodes.RATE_LIMIT_ERROR,
    ErrorCodes.EXTERNAL_SERVICE_ERROR,
  ],
}

export interface RetryState {
  attempt: number
  totalDelayMs: number
  lastError: AppError | null
  startTime: number
}

export function calculateDelay(attempt: number, config: RetryConfig): number {
  const baseDelay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1)
  const cappedDelay = Math.min(baseDelay, config.maxDelayMs)

  if (config.jitter) {
    const jitterRange = cappedDelay * 0.3
    const jitter = Math.random() * jitterRange - jitterRange / 2
    return Math.max(0, Math.floor(cappedDelay + jitter))
  }

  return Math.floor(cappedDelay)
}

export function isRetryableError(error: AppError, config: RetryConfig): boolean {
  if (config.retryableErrors.includes(error.code)) {
    return true
  }

  if (error.code === ErrorCodes.RATE_LIMIT_ERROR && error.details?.retryAfter) {
    return true
  }

  return false
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation = 'Operation'
): Promise<T> {
  let timeoutId: NodeJS.Timeout | null = null

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(timeoutError(timeoutMs))
    }, timeoutMs)
  })

  try {
    const result = await Promise.race([promise, timeoutPromise])
    if (timeoutId) clearTimeout(timeoutId)
    return result
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId)
    throw error
  }
}

export async function retry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const fullConfig: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config }
  const state: RetryState = {
    attempt: 0,
    totalDelayMs: 0,
    lastError: null,
    startTime: Date.now(),
  }

  while (state.attempt < fullConfig.maxAttempts) {
    state.attempt++

    try {
      const result = await withTimeout(fn(), fullConfig.timeoutMs, `Attempt ${state.attempt}`)
      return result
    } catch (error) {
      const appError = AppError.fromUnknown(error)
      state.lastError = appError

      if (state.attempt >= fullConfig.maxAttempts) {
        throw appError
      }

      if (!isRetryableError(appError, fullConfig)) {
        throw appError
      }

      let delayMs = calculateDelay(state.attempt, fullConfig)

      if (appError.code === ErrorCodes.RATE_LIMIT_ERROR && appError.details?.retryAfter) {
        delayMs = Math.max(delayMs, appError.details.retryAfter as number)
      }

      state.totalDelayMs += delayMs

      if (fullConfig.onRetry) {
        fullConfig.onRetry(state.attempt, appError, delayMs)
      }

      await sleep(delayMs)
    }
  }

  throw state.lastError || createError(ErrorCodes.INTERNAL_ERROR, 'Retry failed without error')
}

export async function retryWithResult<T>(
  fn: () => Promise<Result<T, AppError>>,
  config: Partial<RetryConfig> = {}
): Promise<Result<T, AppError>> {
  const fullConfig: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config }
  const state: RetryState = {
    attempt: 0,
    totalDelayMs: 0,
    lastError: null,
    startTime: Date.now(),
  }

  while (state.attempt < fullConfig.maxAttempts) {
    state.attempt++

    try {
      const result = await withTimeout(fn(), fullConfig.timeoutMs, `Attempt ${state.attempt}`)

      if (result.success) {
        return result
      }

      state.lastError = result.error

      if (state.attempt >= fullConfig.maxAttempts) {
        return result
      }

      if (!isRetryableError(result.error, fullConfig)) {
        return result
      }

      let delayMs = calculateDelay(state.attempt, fullConfig)

      if (result.error.code === ErrorCodes.RATE_LIMIT_ERROR && result.error.details?.retryAfter) {
        delayMs = Math.max(delayMs, result.error.details.retryAfter as number)
      }

      state.totalDelayMs += delayMs

      if (fullConfig.onRetry) {
        fullConfig.onRetry(state.attempt, result.error, delayMs)
      }

      await sleep(delayMs)
    } catch (error) {
      const appError = AppError.fromUnknown(error)
      state.lastError = appError

      if (state.attempt >= fullConfig.maxAttempts) {
        return Result.err(appError)
      }

      if (!isRetryableError(appError, fullConfig)) {
        return Result.err(appError)
      }

      const delayMs = calculateDelay(state.attempt, fullConfig)
      state.totalDelayMs += delayMs

      if (fullConfig.onRetry) {
        fullConfig.onRetry(state.attempt, appError, delayMs)
      }

      await sleep(delayMs)
    }
  }

  return Result.err(
    state.lastError || createError(ErrorCodes.INTERNAL_ERROR, 'Retry failed without error')
  )
}

export interface CircuitBreakerState {
  status: 'closed' | 'open' | 'half-open'
  failureCount: number
  lastFailureTime: number | null
  successCount: number
}

export interface CircuitBreakerConfig {
  failureThreshold: number
  successThreshold: number
  resetTimeoutMs: number
  onStateChange?: (oldState: string, newState: string) => void
}

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 3,
  resetTimeoutMs: 60000,
}

export class CircuitBreaker {
  private state: CircuitBreakerState = {
    status: 'closed',
    failureCount: 0,
    lastFailureTime: null,
    successCount: 0,
  }

  constructor(private config: CircuitBreakerConfig = DEFAULT_CIRCUIT_BREAKER_CONFIG) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state.status === 'open') {
      if (this.shouldAttemptReset()) {
        this.transitionTo('half-open')
      } else {
        throw createError(ErrorCodes.EXTERNAL_SERVICE_ERROR, 'Circuit breaker is open', {
          state: this.state,
        })
      }
    }

    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.state.lastFailureTime) return false
    return Date.now() - this.state.lastFailureTime >= this.config.resetTimeoutMs
  }

  private onSuccess(): void {
    this.state.failureCount = 0

    if (this.state.status === 'half-open') {
      this.state.successCount++
      if (this.state.successCount >= this.config.successThreshold) {
        this.transitionTo('closed')
      }
    }
  }

  private onFailure(): void {
    this.state.failureCount++
    this.state.lastFailureTime = Date.now()
    this.state.successCount = 0

    if (this.state.status === 'half-open') {
      this.transitionTo('open')
    } else if (this.state.failureCount >= this.config.failureThreshold) {
      this.transitionTo('open')
    }
  }

  private transitionTo(newStatus: 'closed' | 'open' | 'half-open'): void {
    const oldStatus = this.state.status
    this.state.status = newStatus

    if (newStatus === 'closed') {
      this.state.failureCount = 0
      this.state.successCount = 0
      this.state.lastFailureTime = null
    }

    if (this.config.onStateChange) {
      this.config.onStateChange(oldStatus, newStatus)
    }
  }

  getState(): CircuitBreakerState {
    return { ...this.state }
  }
}

export function createRetryWithCircuitBreaker(
  circuitBreakerConfig?: CircuitBreakerConfig,
  retryConfig?: Partial<RetryConfig>
) {
  const circuitBreaker = new CircuitBreaker(circuitBreakerConfig)

  return <T>(fn: () => Promise<T>): Promise<T> => {
    return circuitBreaker.execute(() => retry(fn, retryConfig))
  }
}
