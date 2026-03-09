import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CircuitBreaker } from '@/app/api/analysis/utils/circuit-breaker'

describe('Circuit Breaker', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  describe('Closed State', () => {
    it('should execute operation successfully', async () => {
      const circuitBreaker = new CircuitBreaker()
      const operation = vi.fn().mockResolvedValue('success')

      const result = await circuitBreaker.execute(operation)

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should count failures', async () => {
      const circuitBreaker = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeoutMs: 60000,
        halfOpenMaxCalls: 1,
      })
      const operation = vi.fn().mockRejectedValue(new Error('fail'))

      for (let i = 0; i < 2; i++) {
        try {
          await circuitBreaker.execute(operation)
        } catch {
          // Expected error - testing failure counting
        }
      }

      expect(operation).toHaveBeenCalledTimes(2)
    })
  })

  describe('Open State', () => {
    it('should open after threshold failures', async () => {
      const circuitBreaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeoutMs: 60000,
        halfOpenMaxCalls: 1,
      })
      const operation = vi.fn().mockRejectedValue(new Error('fail'))

      for (let i = 0; i < 2; i++) {
        try {
          await circuitBreaker.execute(operation)
        } catch {
          // Expected error - testing open state transition
        }
      }

      await expect(circuitBreaker.execute(operation)).rejects.toThrow('Circuit breaker is open')
      expect(operation).toHaveBeenCalledTimes(2)
    })
  })

  describe('Half-Open State', () => {
    it('should transition to half-open after timeout', async () => {
      const circuitBreaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeoutMs: 1000,
        halfOpenMaxCalls: 1,
      })
      const failOperation = vi.fn().mockRejectedValue(new Error('fail'))
      const successOperation = vi.fn().mockResolvedValue('success')

      try {
        await circuitBreaker.execute(failOperation)
      } catch {
        // Expected error - testing half-open state transition
      }

      await expect(circuitBreaker.execute(failOperation)).rejects.toThrow('Circuit breaker is open')

      vi.advanceTimersByTime(1000)

      const result = await circuitBreaker.execute(successOperation)
      expect(result).toBe('success')
    })
  })
})
