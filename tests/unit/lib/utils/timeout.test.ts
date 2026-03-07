import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchWithTimeout, TimeoutError, API_TIMEOUTS } from '@/lib/utils/timeout'

describe('Timeout Utility', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('TimeoutError', () => {
    it('should create error with timeout value', () => {
      const error = new TimeoutError(5000)
      expect(error.name).toBe('TimeoutError')
      expect(error.timeoutMs).toBe(5000)
      expect(error.message).toBe('Request timed out after 5000ms')
    })

    it('should include URL in message when provided', () => {
      const error = new TimeoutError(3000, 'https://api.example.com/endpoint')
      expect(error.message).toBe(
        'Request timed out after 3000ms (https://api.example.com/endpoint)'
      )
    })

    it('should be instance of Error', () => {
      const error = new TimeoutError(1000)
      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(TimeoutError)
    })
  })

  describe('fetchWithTimeout', () => {
    it('should resolve when fetch completes before timeout', async () => {
      const mockResponse = new Response(JSON.stringify({ data: 'test' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })

      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(mockResponse)

      const promise = fetchWithTimeout('https://api.example.com/test', {}, 5000)

      await vi.runAllTimersAsync()
      const response = await promise

      expect(response.ok).toBe(true)
      expect(fetchSpy).toHaveBeenCalledWith('https://api.example.com/test', {
        signal: expect.any(AbortSignal),
      })
    })

    it('should throw TimeoutError when fetch exceeds timeout', async () => {
      const abortError = new Error('The operation was aborted')
      abortError.name = 'AbortError'

      vi.spyOn(global, 'fetch').mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            setTimeout(() => reject(abortError), 10000)
          })
      )

      const promise = fetchWithTimeout('https://api.example.com/slow', {}, 1000)
      const errorPromise = promise.catch((e) => e)

      vi.advanceTimersByTime(1001)
      await vi.runAllTimersAsync()

      const error = await errorPromise
      expect(error).toBeInstanceOf(TimeoutError)
      expect(error.message).toContain('1000ms')
    })

    it('should pass through other fetch options', async () => {
      const mockResponse = new Response('{}')
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(mockResponse)

      const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' }),
      }

      const promise = fetchWithTimeout('https://api.example.com/test', options, 5000)
      await vi.runAllTimersAsync()
      await promise

      expect(fetchSpy).toHaveBeenCalledWith('https://api.example.com/test', {
        ...options,
        signal: expect.any(AbortSignal),
      })
    })

    it('should clear timeout on successful response', async () => {
      const mockResponse = new Response('{}')
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(mockResponse)

      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')

      const promise = fetchWithTimeout('https://api.example.com/test', {}, 5000)
      await vi.runAllTimersAsync()
      await promise

      expect(clearTimeoutSpy).toHaveBeenCalled()
    })

    it('should clear timeout on fetch error', async () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')
      vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'))

      const promise = fetchWithTimeout('https://api.example.com/test', {}, 5000)
      const errorPromise = promise.catch((e) => e)

      await vi.runAllTimersAsync()
      const error = await errorPromise

      expect(error).toBeInstanceOf(Error)
      expect(error.message).toBe('Network error')
      expect(clearTimeoutSpy).toHaveBeenCalled()
    })

    it('should rethrow non-timeout errors', async () => {
      const networkError = new Error('Network error')
      vi.spyOn(global, 'fetch').mockRejectedValueOnce(networkError)

      const promise = fetchWithTimeout('https://api.example.com/test', {}, 5000)
      const errorPromise = promise.catch((e) => e)

      await vi.runAllTimersAsync()
      const error = await errorPromise

      expect(error).toBeInstanceOf(Error)
      expect(error.message).toBe('Network error')
      expect(error).not.toBeInstanceOf(TimeoutError)
    })
  })

  describe('API_TIMEOUTS constants', () => {
    it('should have correct timeout values', () => {
      expect(API_TIMEOUTS.FREEE_API).toBe(30000)
      expect(API_TIMEOUTS.AI_API).toBe(60000)
      expect(API_TIMEOUTS.SLACK_API).toBe(10000)
    })
  })
})
