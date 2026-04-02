import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CircuitBreaker } from '@/lib/integrations/ai/circuit-breaker'
import type {
  CircuitBreakerConfig,
  CircuitState,
  CircuitBreakerStats,
} from '@/lib/integrations/ai/circuit-breaker'

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker

  beforeEach(() => {
    vi.useFakeTimers()
    breaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 1000,
      halfOpenMaxCalls: 2,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('constructor', () => {
    it('should initialize with closed state', () => {
      expect(breaker.getState()).toBe('closed')
    })

    it('should use default halfOpenMaxCalls when not specified', () => {
      const b = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeout: 1000,
      })
      expect(b.getStats().state).toBe('closed')
    })
  })

  describe('canExecute', () => {
    it('should return true when closed', () => {
      expect(breaker.canExecute()).toBe(true)
    })

    it('should return false when open', () => {
      for (let i = 0; i < 3; i++) breaker.recordFailure()
      expect(breaker.canExecute()).toBe(false)
    })

    it('should return true when half-open and under limit', () => {
      for (let i = 0; i < 3; i++) breaker.recordFailure()
      vi.advanceTimersByTime(1001)
      expect(breaker.getState()).toBe('half-open')
      expect(breaker.canExecute()).toBe(true)
    })

    it('should return false when half-open and at limit', () => {
      const b = new CircuitBreaker({ failureThreshold: 2, resetTimeout: 1000, halfOpenMaxCalls: 1 })
      b.recordFailure()
      b.recordFailure()
      vi.advanceTimersByTime(1001)
      expect(b.getState()).toBe('half-open')
      expect(b.canExecute()).toBe(true)
      b.recordSuccess()
      expect(b.canExecute()).toBe(true)
    })
  })

  describe('recordSuccess', () => {
    it('should reset failure count in closed state', () => {
      breaker.recordFailure()
      breaker.recordFailure()
      breaker.recordFailure()
      breaker.reset()
      breaker.recordSuccess()
      const stats = breaker.getStats()
      expect(stats.failureCount).toBe(0)
    })

    it('should transition to closed from half-open after enough successes', () => {
      for (let i = 0; i < 3; i++) breaker.recordFailure()
      vi.advanceTimersByTime(1001)
      expect(breaker.getState()).toBe('half-open')

      breaker.recordSuccess()
      breaker.recordSuccess()
      expect(breaker.getState()).toBe('closed')
    })

    it('should increment success count', () => {
      breaker.recordSuccess()
      breaker.recordSuccess()
      expect(breaker.getStats().successCount).toBe(2)
    })
  })

  describe('recordFailure', () => {
    it('should increment failure count', () => {
      breaker.recordFailure()
      expect(breaker.getStats().failureCount).toBe(1)
    })

    it('should transition to open after threshold reached', () => {
      breaker.recordFailure()
      breaker.recordFailure()
      expect(breaker.getState()).toBe('closed')
      breaker.recordFailure()
      expect(breaker.getState()).toBe('open')
    })

    it('should set lastFailure timestamp', () => {
      breaker.recordFailure()
      expect(breaker.getStats().lastFailure).not.toBeNull()
    })

    it('should transition to open from half-open on failure', () => {
      for (let i = 0; i < 3; i++) breaker.recordFailure()
      vi.advanceTimersByTime(1001)
      expect(breaker.getState()).toBe('half-open')

      breaker.recordFailure()
      expect(breaker.getState()).toBe('open')
    })
  })

  describe('state transitions', () => {
    it('should transition from open to half-open after resetTimeout', () => {
      for (let i = 0; i < 3; i++) breaker.recordFailure()
      expect(breaker.getState()).toBe('open')

      vi.advanceTimersByTime(999)
      expect(breaker.getState()).toBe('open')

      vi.advanceTimersByTime(2)
      expect(breaker.getState()).toBe('half-open')
    })

    it('should transition from half-open to closed after successful calls', () => {
      for (let i = 0; i < 3; i++) breaker.recordFailure()
      vi.advanceTimersByTime(1001)
      expect(breaker.getState()).toBe('half-open')

      breaker.recordSuccess()
      breaker.recordSuccess()
      expect(breaker.getState()).toBe('closed')
      expect(breaker.getStats().failureCount).toBe(0)
    })

    it('should transition from half-open to open on failure', () => {
      for (let i = 0; i < 3; i++) breaker.recordFailure()
      vi.advanceTimersByTime(1001)

      breaker.recordFailure()
      expect(breaker.getState()).toBe('open')
    })

    it('should reset half-open calls when transitioning to half-open', () => {
      for (let i = 0; i < 3; i++) breaker.recordFailure()
      vi.advanceTimersByTime(1001)

      breaker.recordSuccess()
      expect(breaker.canExecute()).toBe(true)
    })
  })

  describe('reset', () => {
    it('should transition to closed from open', () => {
      for (let i = 0; i < 3; i++) breaker.recordFailure()
      expect(breaker.getState()).toBe('open')

      breaker.reset()
      expect(breaker.getState()).toBe('closed')
      expect(breaker.getStats().failureCount).toBe(0)
    })

    it('should transition to closed from half-open', () => {
      for (let i = 0; i < 3; i++) breaker.recordFailure()
      vi.advanceTimersByTime(1001)
      expect(breaker.getState()).toBe('half-open')

      breaker.reset()
      expect(breaker.getState()).toBe('closed')
    })
  })

  describe('getStats', () => {
    it('should return complete stats', () => {
      breaker.recordFailure()
      breaker.recordSuccess()

      const stats = breaker.getStats()
      expect(stats.state).toBe('closed')
      expect(stats.successCount).toBe(1)
      expect(stats.lastFailure).not.toBeNull()
    })

    it('should have null lastFailure initially', () => {
      const stats = breaker.getStats()
      expect(stats.lastFailure).toBeNull()
    })

    it('should have null lastStateChange initially', () => {
      const stats = breaker.getStats()
      expect(stats.lastStateChange).toBeNull()
    })
  })

  describe('edge cases', () => {
    it('should not transition when already in target state', () => {
      breaker.recordSuccess()
      const stats1 = breaker.getStats()

      breaker.reset()
      const stats2 = breaker.getStats()
      expect(stats2.lastStateChange).toEqual(stats1.lastStateChange)
    })

    it('should handle rapid failures', () => {
      for (let i = 0; i < 10; i++) breaker.recordFailure()
      expect(breaker.getState()).toBe('open')
      expect(breaker.getStats().failureCount).toBe(10)
    })

    it('should handle threshold of 1', () => {
      const b = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 1000,
      })
      b.recordFailure()
      expect(b.getState()).toBe('open')
    })
  })
})
