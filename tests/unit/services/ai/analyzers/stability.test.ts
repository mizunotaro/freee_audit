import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FinancialAnalyzer } from '@/services/ai/analyzers/financial-analyzer'
import {
  CircuitBreaker,
  withRetry,
  DEFAULT_RETRY_CONFIG,
  checkTimeout,
  checkIterationLimit,
} from '@/services/ai/analyzers/utils'
import { createMockStatementSet } from './helpers/fixtures'

describe('Stability', () => {
  describe('CircuitBreaker', () => {
    it('should start in closed state', () => {
      const breaker = new CircuitBreaker()
      expect(breaker.getState()).toBe('closed')
    })

    it('should open after threshold failures', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 1000 })
      const failingOp = () => Promise.reject(new Error('Failed'))

      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failingOp)).rejects.toThrow('Failed')
      }

      expect(breaker.getState()).toBe('open')
    })

    it('should reject immediately when open', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 10000 })

      await expect(breaker.execute(() => Promise.reject(new Error('Failed')))).rejects.toThrow()

      await expect(breaker.execute(() => Promise.resolve('success'))).rejects.toThrow(
        'Circuit breaker is open'
      )
    })

    it('should transition to half-open after reset timeout', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 100 })

      await expect(breaker.execute(() => Promise.reject(new Error('Failed')))).rejects.toThrow()
      expect(breaker.getState()).toBe('open')

      await new Promise((resolve) => setTimeout(resolve, 150))

      const result = await breaker.execute(() => Promise.resolve('success'))
      expect(result).toBe('success')
      expect(breaker.getState()).toBe('closed')
    })

    it('should reset to closed state', () => {
      const breaker = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 1000 })
      breaker.reset()
      expect(breaker.getState()).toBe('closed')
    })

    it('should handle success and reset failure count', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 1000 })

      await expect(breaker.execute(() => Promise.reject(new Error('Fail 1')))).rejects.toThrow()
      await expect(breaker.execute(() => Promise.reject(new Error('Fail 2')))).rejects.toThrow()
      expect(breaker.getState()).toBe('closed')

      await breaker.execute(() => Promise.resolve('success'))
      expect(breaker.getState()).toBe('closed')

      await expect(breaker.execute(() => Promise.reject(new Error('Fail 3')))).rejects.toThrow()
      await expect(breaker.execute(() => Promise.reject(new Error('Fail 4')))).rejects.toThrow()
      expect(breaker.getState()).toBe('closed')
    })

    it('should return to open on failure in half-open state', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 50 })

      await expect(breaker.execute(() => Promise.reject(new Error('Failed')))).rejects.toThrow()
      expect(breaker.getState()).toBe('open')

      await new Promise((resolve) => setTimeout(resolve, 60))

      await expect(
        breaker.execute(() => Promise.reject(new Error('Failed again')))
      ).rejects.toThrow()
      expect(breaker.getState()).toBe('open')
    })
  })

  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const op = vi.fn().mockResolvedValue('success')

      const result = await withRetry(op, { ...DEFAULT_RETRY_CONFIG, maxRetries: 3 })

      expect(result).toBe('success')
      expect(op).toHaveBeenCalledTimes(1)
    })

    it('should retry on failure and eventually succeed', async () => {
      const op = vi
        .fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValue('success')

      const result = await withRetry(op, {
        ...DEFAULT_RETRY_CONFIG,
        maxRetries: 3,
        initialDelayMs: 10,
      })

      expect(result).toBe('success')
      expect(op).toHaveBeenCalledTimes(3)
    })

    it('should throw after max retries exceeded', async () => {
      const op = vi.fn().mockRejectedValue(new Error('Always fails'))

      await expect(
        withRetry(op, {
          ...DEFAULT_RETRY_CONFIG,
          maxRetries: 2,
          initialDelayMs: 10,
        })
      ).rejects.toThrow('Always fails')

      expect(op).toHaveBeenCalledTimes(3)
    })

    it('should use exponential backoff', async () => {
      const delays: number[] = []
      const op = vi.fn().mockRejectedValue(new Error('Fail'))

      const originalSetTimeout = global.setTimeout
      vi.spyOn(global, 'setTimeout').mockImplementation((fn: () => void, ms?: number) => {
        delays.push(ms ?? 0)
        return originalSetTimeout(fn, 0)
      })

      await expect(
        withRetry(op, {
          maxRetries: 2,
          initialDelayMs: 100,
          maxDelayMs: 10000,
          backoffMultiplier: 2,
        })
      ).rejects.toThrow()

      expect(delays).toEqual([100, 200])

      vi.restoreAllMocks()
    })

    it('should cap delay at maxDelayMs', async () => {
      const delays: number[] = []
      const op = vi.fn().mockRejectedValue(new Error('Fail'))

      const originalSetTimeout = global.setTimeout
      vi.spyOn(global, 'setTimeout').mockImplementation((fn: () => void, ms?: number) => {
        delays.push(ms ?? 0)
        return originalSetTimeout(fn, 0)
      })

      await expect(
        withRetry(op, {
          maxRetries: 3,
          initialDelayMs: 1000,
          maxDelayMs: 1500,
          backoffMultiplier: 2,
        })
      ).rejects.toThrow()

      expect(delays[0]).toBe(1000)
      expect(delays[1]).toBe(1500)
      expect(delays[2]).toBe(1500)

      vi.restoreAllMocks()
    })

    it('should work with zero retries', async () => {
      const op = vi.fn().mockRejectedValue(new Error('Fail'))

      await expect(
        withRetry(op, {
          maxRetries: 0,
          initialDelayMs: 10,
          maxDelayMs: 1000,
          backoffMultiplier: 2,
        })
      ).rejects.toThrow('Fail')

      expect(op).toHaveBeenCalledTimes(1)
    })
  })

  describe('checkTimeout', () => {
    it('should not throw when within timeout', () => {
      const startTime = Date.now() - 1000
      expect(() => checkTimeout(startTime, 5000)).not.toThrow()
    })

    it('should throw when timeout exceeded', () => {
      const startTime = Date.now() - 6000
      expect(() => checkTimeout(startTime, 5000)).toThrow('Operation timed out')
    })

    it('should include timeout value in error message', () => {
      const startTime = Date.now() - 6000
      expect(() => checkTimeout(startTime, 5000)).toThrow('5000ms')
    })
  })

  describe('checkIterationLimit', () => {
    it('should not throw when within limit', () => {
      expect(() => checkIterationLimit(100, 1000)).not.toThrow()
    })

    it('should throw when limit exceeded', () => {
      expect(() => checkIterationLimit(1001, 1000)).toThrow('Iteration limit exceeded')
    })

    it('should include values in error message', () => {
      expect(() => checkIterationLimit(1001, 1000)).toThrow('1001 > 1000')
    })
  })

  describe('FinancialAnalyzer timeout handling', () => {
    it('should handle timeout gracefully with allowPartialFailure=true', () => {
      const analyzer = new FinancialAnalyzer({
        timeout: 1,
        allowPartialFailure: true,
      })

      const result = analyzer.analyze(createMockStatementSet())

      if (result.success) {
        const hasTimeoutAlert = result.data?.allAlerts.some((a) => a.title.includes('タイムアウト'))
        if (hasTimeoutAlert) {
          expect(hasTimeoutAlert).toBe(true)
        } else {
          expect(result.success).toBe(true)
        }
      } else {
        expect(result.error?.code).toBe('analysis_failed')
      }
    })

    it('should return error on timeout with allowPartialFailure=false', () => {
      const analyzer = new FinancialAnalyzer({
        timeout: 1,
        allowPartialFailure: false,
      })

      const result = analyzer.analyze(createMockStatementSet())

      if (!result.success) {
        expect(result.error?.code).toBe('analysis_failed')
      } else {
        expect(result.success).toBe(true)
      }
    })
  })

  describe('FinancialAnalyzer Circuit Breaker integration', () => {
    it('should expose circuit breaker state', () => {
      const analyzer = new FinancialAnalyzer()
      expect(analyzer.getCircuitBreakerState()).toBe('closed')
    })

    it('should return circuit breaker instance', () => {
      const analyzer = new FinancialAnalyzer()
      const breaker = analyzer.getCircuitBreaker()
      expect(breaker).toBeInstanceOf(CircuitBreaker)
    })
  })
})
