import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  sleep,
  withRetry,
  createAppError,
  sanitizeInput,
  sanitizeForLog,
  FetchError,
  DEFAULT_RETRY_CONFIG,
} from '@/lib/journal-proposal/utils'
import { JOURNAL_PROPOSAL_CONFIG } from '@/config/journal-proposal'

describe('journal-proposal utils', () => {
  describe('sleep', () => {
    it('should resolve after specified milliseconds', async () => {
      const start = Date.now()
      await sleep(100)
      const elapsed = Date.now() - start
      expect(elapsed).toBeGreaterThanOrEqual(90)
    })
  })

  describe('createAppError', () => {
    it('should create an AppError with all fields', () => {
      const cause = new Error('original error')
      const error = createAppError('TEST_ERROR', 'Test message', { key: 'value' }, cause)

      expect(error.code).toBe('TEST_ERROR')
      expect(error.message).toBe('Test message')
      expect(error.details).toEqual({ key: 'value' })
      expect(error.cause).toBe(cause)
    })

    it('should create an AppError with minimal fields', () => {
      const error = createAppError('TEST_ERROR', 'Test message')

      expect(error.code).toBe('TEST_ERROR')
      expect(error.message).toBe('Test message')
      expect(error.details).toBeUndefined()
      expect(error.cause).toBeUndefined()
    })
  })

  describe('sanitizeInput', () => {
    it('should remove control characters', () => {
      const input = 'Hello\x00World\x1F'
      const result = sanitizeInput(input)
      expect(result).toBe('HelloWorld')
    })

    it('should trim whitespace', () => {
      const input = '  hello world  '
      const result = sanitizeInput(input)
      expect(result).toBe('hello world')
    })

    it('should truncate to maxLength', () => {
      const input = 'a'.repeat(100)
      const result = sanitizeInput(input, 50)
      expect(result.length).toBe(50)
    })

    it('should use default maxLength of 10000', () => {
      const input = 'a'.repeat(15000)
      const result = sanitizeInput(input)
      expect(result.length).toBe(10000)
    })
  })

  describe('sanitizeForLog', () => {
    it('should redact sensitive keys', () => {
      const input = {
        password: 'secret123',
        apiKey: 'key123',
        token: 'token123',
        normalField: 'visible',
      }
      const result = sanitizeForLog(input)

      expect(result.password).toBe('[REDACTED]')
      expect(result.apiKey).toBe('[REDACTED]')
      expect(result.token).toBe('[REDACTED]')
      expect(result.normalField).toBe('visible')
    })

    it('should handle nested objects', () => {
      const input = {
        user: {
          name: 'John',
          credential: 'secret',
        },
      }
      const result = sanitizeForLog(input) as { user: Record<string, unknown> }

      expect(result.user.name).toBe('John')
      expect(result.user.credential).toBe('[REDACTED]')
    })

    it('should be case-insensitive for sensitive keys', () => {
      const input = {
        PASSWORD: 'secret',
        ApiKey: 'key',
        Authorization: 'bearer token',
      }
      const result = sanitizeForLog(input)

      expect(result.PASSWORD).toBe('[REDACTED]')
      expect(result.ApiKey).toBe('[REDACTED]')
      expect(result.Authorization).toBe('[REDACTED]')
    })
  })

  describe('withRetry', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should succeed on first attempt', async () => {
      const operation = vi.fn().mockResolvedValue('success')
      const result = await withRetry(operation)

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should retry on failure', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success')

      const resultPromise = withRetry(operation, {
        maxRetries: 3,
        initialDelayMs: 100,
        maxDelayMs: 1000,
        backoffMultiplier: 2,
      })

      await vi.runAllTimersAsync()
      const result = await resultPromise

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(3)
    })

    it('should throw after max retries', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('always fails'))

      const resultPromise = withRetry(operation, {
        maxRetries: 2,
        initialDelayMs: 10,
        maxDelayMs: 100,
        backoffMultiplier: 2,
      })

      resultPromise.catch(() => {})

      await vi.runAllTimersAsync()

      await expect(resultPromise).rejects.toThrow('always fails')
      expect(operation).toHaveBeenCalledTimes(3)
    })
  })

  describe('FetchError', () => {
    it('should create a FetchError with code', () => {
      const error = new FetchError('Timeout', 'TIMEOUT')

      expect(error.message).toBe('Timeout')
      expect(error.code).toBe('TIMEOUT')
      expect(error.name).toBe('FetchError')
    })

    it('should create a FetchError with all fields', () => {
      const cause = new Error('original')
      const error = new FetchError('Server error', 'SERVER', 500, cause)

      expect(error.statusCode).toBe(500)
      expect(error.cause).toBe(cause)
    })
  })

  describe('DEFAULT_RETRY_CONFIG', () => {
    it('should match JOURNAL_PROPOSAL_CONFIG', () => {
      expect(DEFAULT_RETRY_CONFIG.maxRetries).toBe(JOURNAL_PROPOSAL_CONFIG.api.maxRetries)
      expect(DEFAULT_RETRY_CONFIG.initialDelayMs).toBe(JOURNAL_PROPOSAL_CONFIG.api.initialDelayMs)
      expect(DEFAULT_RETRY_CONFIG.maxDelayMs).toBe(JOURNAL_PROPOSAL_CONFIG.api.maxDelayMs)
      expect(DEFAULT_RETRY_CONFIG.backoffMultiplier).toBe(
        JOURNAL_PROPOSAL_CONFIG.api.backoffMultiplier
      )
    })
  })
})
