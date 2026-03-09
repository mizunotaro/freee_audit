import { CIRCUIT_BREAKER_CONFIG } from '../config/constants'
import { createCircuitBreakerError } from '../types/app-error'

type CircuitState = 'closed' | 'open' | 'half-open'

export interface CircuitBreakerConfig {
  failureThreshold: number
  resetTimeoutMs: number
  halfOpenMaxCalls: number
}

/**
 * Circuit Breakerパターンの実装
 *
 * 連続する失敗を検知して一時的にサービスを停止し、
 * システムの安定性を保つためのパターン
 *
 * @example
 * ```typescript
 * const breaker = new CircuitBreaker()
 *
 * const result = await breaker.execute(async () => {
 *   return await externalService.call()
 * })
 * ```
 */
export class CircuitBreaker {
  private failureCount: number = 0
  private state: CircuitState = 'closed'
  private lastFailureTime: number = 0
  private halfOpenCalls: number = 0

  constructor(private readonly config: CircuitBreakerConfig = CIRCUIT_BREAKER_CONFIG) {}

  /**
   * 操作を実行し、Circuit Breakerの状態を管理
   *
   * @param operation - 実行する非同期操作
   * @returns 操作の結果
   * @throws Circuit Breakerがopenの場合、CircuitBreakerErrorをスロー
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.state = 'half-open'
        this.halfOpenCalls = 0
      } else {
        throw createCircuitBreakerError()
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
    if (this.state === 'half-open') {
      this.state = 'closed'
    }
  }

  private onFailure(): void {
    this.failureCount++
    this.lastFailureTime = Date.now()

    if (this.state === 'half-open') {
      this.halfOpenCalls++
      if (this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
        this.state = 'open'
      }
    } else if (this.failureCount >= this.config.failureThreshold) {
      this.state = 'open'
    }
  }

  private shouldAttemptReset(): boolean {
    return Date.now() - this.lastFailureTime >= this.config.resetTimeoutMs
  }

  getState(): CircuitState {
    return this.state
  }

  getFailureCount(): number {
    return this.failureCount
  }

  reset(): void {
    this.failureCount = 0
    this.state = 'closed'
    this.lastFailureTime = 0
    this.halfOpenCalls = 0
  }
}
