export interface RateLimitConfig {
  maxRequests: number
  windowMs: number
}

const DEFAULT_LIMITS: Record<string, RateLimitConfig> = {
  auth: { maxRequests: 10, windowMs: 1000 },
  data: { maxRequests: 5, windowMs: 1000 },
  report: { maxRequests: 2, windowMs: 1000 },
}

interface TokenBucket {
  tokens: number
  lastRefill: number
}

export class RateLimiter {
  private buckets: Map<string, TokenBucket> = new Map()
  private limits: Record<string, RateLimitConfig>

  constructor(limits: Record<string, RateLimitConfig> = DEFAULT_LIMITS) {
    this.limits = limits
  }

  async waitForToken(type: string): Promise<void> {
    const config = this.limits[type] || this.limits.data
    const bucket = this.getBucket(type)

    this.refillBucket(bucket, config)

    if (bucket.tokens < 1) {
      const waitTime = this.calculateWaitTime(bucket, config)
      await this.sleep(waitTime)
      this.refillBucket(bucket, config)
    }

    bucket.tokens -= 1
  }

  private getBucket(type: string): TokenBucket {
    if (!this.buckets.has(type)) {
      this.buckets.set(type, {
        tokens: this.limits[type]?.maxRequests || this.limits.data.maxRequests,
        lastRefill: Date.now(),
      })
    }
    return this.buckets.get(type)!
  }

  private refillBucket(bucket: TokenBucket, config: RateLimitConfig): void {
    const now = Date.now()
    const elapsed = now - bucket.lastRefill
    const tokensToAdd = Math.floor((elapsed / config.windowMs) * config.maxRequests)

    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(config.maxRequests, bucket.tokens + tokensToAdd)
      bucket.lastRefill = now
    }
  }

  private calculateWaitTime(bucket: TokenBucket, config: RateLimitConfig): number {
    const tokensNeeded = 1 - bucket.tokens
    return Math.ceil((tokensNeeded / config.maxRequests) * config.windowMs)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  reset(type?: string): void {
    if (type) {
      this.buckets.delete(type)
    } else {
      this.buckets.clear()
    }
  }
}

export const freeeRateLimiter = new RateLimiter()

export class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'
  private failureCount: number = 0
  private lastFailureTime: Date | null = null
  private readonly failureThreshold: number
  private readonly resetTimeoutMs: number

  constructor(failureThreshold: number = 5, resetTimeoutMs: number = 60000) {
    this.failureThreshold = failureThreshold
    this.resetTimeoutMs = resetTimeoutMs
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN'
      } else {
        throw new Error('Circuit breaker is OPEN')
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

  private onSuccess(): void {
    this.failureCount = 0
    this.state = 'CLOSED'
  }

  private onFailure(): void {
    this.failureCount++
    this.lastFailureTime = new Date()
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN'
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return false
    return Date.now() - this.lastFailureTime.getTime() >= this.resetTimeoutMs
  }

  getState(): 'CLOSED' | 'OPEN' | 'HALF_OPEN' {
    return this.state
  }

  reset(): void {
    this.state = 'CLOSED'
    this.failureCount = 0
    this.lastFailureTime = null
  }
}

export const freeeCircuitBreaker = new CircuitBreaker()

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt < maxRetries - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError
}
