export type CircuitState = 'closed' | 'open' | 'half-open'

export interface CircuitBreakerConfig {
  failureThreshold: number
  resetTimeout: number
  halfOpenMaxCalls?: number
}

export interface CircuitBreakerStats {
  state: CircuitState
  failureCount: number
  successCount: number
  lastFailure: Date | null
  lastStateChange: Date | null
}

export class CircuitBreaker {
  private state: CircuitState = 'closed'
  private failureCount: number = 0
  private successCount: number = 0
  private lastFailure: Date | null = null
  private lastStateChange: Date | null = null
  private halfOpenCalls: number = 0
  private readonly config: Required<CircuitBreakerConfig>

  constructor(config: CircuitBreakerConfig) {
    this.config = {
      failureThreshold: config.failureThreshold,
      resetTimeout: config.resetTimeout,
      halfOpenMaxCalls: config.halfOpenMaxCalls ?? 1,
    }
  }

  getState(): CircuitState {
    this.checkReset()
    return this.state
  }

  getStats(): CircuitBreakerStats {
    return {
      state: this.getState(),
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailure: this.lastFailure,
      lastStateChange: this.lastStateChange,
    }
  }

  canExecute(): boolean {
    this.checkReset()

    if (this.state === 'closed') {
      return true
    }

    if (this.state === 'half-open') {
      return this.halfOpenCalls < this.config.halfOpenMaxCalls
    }

    return false
  }

  recordSuccess(): void {
    this.successCount++

    if (this.state === 'half-open') {
      this.halfOpenCalls++
      if (this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
        this.transitionTo('closed')
      }
    } else if (this.state === 'closed') {
      this.failureCount = 0
    }
  }

  recordFailure(): void {
    this.failureCount++
    this.lastFailure = new Date()

    if (this.state === 'half-open') {
      this.transitionTo('open')
    } else if (this.state === 'closed') {
      if (this.failureCount >= this.config.failureThreshold) {
        this.transitionTo('open')
      }
    }
  }

  reset(): void {
    this.transitionTo('closed')
  }

  private checkReset(): void {
    if (this.state === 'open' && this.lastFailure) {
      const elapsed = Date.now() - this.lastFailure.getTime()
      if (elapsed >= this.config.resetTimeout) {
        this.transitionTo('half-open')
      }
    }
  }

  private transitionTo(newState: CircuitState): void {
    if (this.state === newState) return

    this.state = newState
    this.lastStateChange = new Date()

    if (newState === 'closed') {
      this.failureCount = 0
      this.halfOpenCalls = 0
    } else if (newState === 'half-open') {
      this.halfOpenCalls = 0
    }
  }
}
