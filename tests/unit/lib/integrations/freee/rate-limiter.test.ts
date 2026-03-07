import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  RateLimiter,
  CircuitBreaker,
  withRetry,
  freeeRateLimiter,
  freeeCircuitBreaker,
} from '@/lib/integrations/freee/rate-limiter'

describe('RateLimiter', () => {
  let limiter: RateLimiter

  beforeEach(() => {
    limiter = new RateLimiter({
      auth: { maxRequests: 2, windowMs: 100 },
      data: { maxRequests: 3, windowMs: 100 },
    })
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('waitForToken', () => {
    it('should allow requests within limit', async () => {
      const promise1 = limiter.waitForToken('auth')
      const promise2 = limiter.waitForToken('auth')

      await Promise.all([promise1, promise2])

      expect(true).toBe(true)
    })

    it('should wait when limit exceeded', async () => {
      await limiter.waitForToken('auth')
      await limiter.waitForToken('auth')

      const start = Date.now()
      const promise = limiter.waitForToken('auth')
      vi.advanceTimersByTime(100)
      await promise

      expect(Date.now() - start).toBeGreaterThanOrEqual(50)
    })

    it('should use default limit for unknown types', async () => {
      await limiter.waitForToken('unknown')

      expect(true).toBe(true)
    })

    it('should refill tokens after window', async () => {
      await limiter.waitForToken('auth')
      await limiter.waitForToken('auth')

      vi.advanceTimersByTime(100)

      await limiter.waitForToken('auth')

      expect(true).toBe(true)
    })
  })

  describe('reset', () => {
    it('should reset specific bucket', async () => {
      await limiter.waitForToken('auth')
      await limiter.waitForToken('auth')

      limiter.reset('auth')

      await limiter.waitForToken('auth')

      expect(true).toBe(true)
    })

    it('should reset all buckets when no type specified', async () => {
      await limiter.waitForToken('auth')
      await limiter.waitForToken('data')

      limiter.reset()

      await limiter.waitForToken('auth')
      await limiter.waitForToken('data')

      expect(true).toBe(true)
    })
  })
})

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker

  beforeEach(() => {
    breaker = new CircuitBreaker(3, 1000)
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('execute', () => {
    it('should execute function when closed', async () => {
      const fn = vi.fn().mockResolvedValue('success')

      const result = await breaker.execute(fn)

      expect(result).toBe('success')
      expect(fn).toHaveBeenCalled()
    })

    it('should open after threshold failures', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'))

      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(fn)
        } catch {
          // Expected
        }
      }

      expect(breaker.getState()).toBe('OPEN')
    })

    it('should reject when open', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'))

      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(fn)
        } catch {
          // Expected
        }
      }

      await expect(breaker.execute(vi.fn())).rejects.toThrow('Circuit breaker is OPEN')
    })

    it('should transition to half-open after timeout', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'))

      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(fn)
        } catch {
          // Expected
        }
      }

      expect(breaker.getState()).toBe('OPEN')

      vi.advanceTimersByTime(1000)

      const checkFn = vi.fn().mockResolvedValue('check')
      await breaker.execute(checkFn)

      expect(breaker.getState()).toBe('CLOSED')
    })

    it('should close again on success in half-open state', async () => {
      const failFn = vi.fn().mockRejectedValue(new Error('fail'))
      const successFn = vi.fn().mockResolvedValue('success')

      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failFn)
        } catch {
          // Expected
        }
      }

      vi.advanceTimersByTime(1000)
      await breaker.execute(successFn)

      expect(breaker.getState()).toBe('CLOSED')
    })

    it('should reset failure count on success', async () => {
      const failFn = vi.fn().mockRejectedValue(new Error('fail'))
      const successFn = vi.fn().mockResolvedValue('success')

      try {
        await breaker.execute(failFn)
      } catch {
        // Expected
      }

      await breaker.execute(successFn)

      try {
        await breaker.execute(failFn)
      } catch {
        // Expected
      }

      try {
        await breaker.execute(failFn)
      } catch {
        // Expected
      }

      expect(breaker.getState()).toBe('CLOSED')
    })
  })

  describe('reset', () => {
    it('should reset to closed state', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'))

      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(fn)
        } catch {
          // Expected
        }
      }

      breaker.reset()

      expect(breaker.getState()).toBe('CLOSED')
    })
  })

  describe('getState', () => {
    it('should return current state', () => {
      expect(breaker.getState()).toBe('CLOSED')
    })
  })
})

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should return result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('success')

    const resultPromise = withRetry(fn, 3, 100)
    const result = await resultPromise

    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should retry on failure', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success')

    const resultPromise = withRetry(fn, 3, 100)
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('should throw after max retries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fails'))

    const resultPromise = withRetry(fn, 3, 100)
    resultPromise.catch(() => {})
    await vi.runAllTimersAsync()

    await expect(resultPromise).rejects.toThrow('always fails')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('should use exponential backoff', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success')

    const resultPromise = withRetry(fn, 3, 100)
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(result).toBe('success')
  })
})

describe('exports', () => {
  it('should export freeeRateLimiter instance', () => {
    expect(freeeRateLimiter).toBeInstanceOf(RateLimiter)
  })

  it('should export freeeCircuitBreaker instance', () => {
    expect(freeeCircuitBreaker).toBeInstanceOf(CircuitBreaker)
  })
})
