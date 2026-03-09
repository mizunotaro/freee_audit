import { describe, it, expect, vi } from 'vitest'
import { withRetry } from '@/app/api/analysis/utils/retry'

describe('Retry Utility', () => {
  describe('withRetry', () => {
    it('should return result on first successful attempt', async () => {
      const operation = vi.fn().mockResolvedValue('success')

      const result = await withRetry(operation)

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should retry on failure and succeed', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success')

      const result = await withRetry(operation, { maxRetries: 3, initialDelayMs: 10 })

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(3)
    })

    it('should throw after max retries exceeded', async () => {
      const error = new Error('persistent failure')
      const operation = vi.fn().mockRejectedValue(error)

      await expect(withRetry(operation, { maxRetries: 2, initialDelayMs: 10 })).rejects.toThrow(
        'persistent failure'
      )
      expect(operation).toHaveBeenCalledTimes(3)
    })
  })
})
