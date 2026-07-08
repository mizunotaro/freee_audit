import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BaseMarketDataProvider } from '@/services/market-data/base-provider'

class TestableProvider extends BaseMarketDataProvider {
  readonly name = 'jquants' as const
  authenticate = vi.fn()
  testConnection = vi.fn()
  getQuotes = vi.fn()
  getFinancials = vi.fn()
  getCompanyInfo = vi.fn()
  searchCompanies = vi.fn()
}

describe('BaseMarketDataProvider (extended)', () => {
  let provider: TestableProvider

  beforeEach(() => {
    provider = new TestableProvider()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  describe('fetchWithTimeout — abort path', () => {
    it('aborts and rejects when the request exceeds the timeout', async () => {
      vi.useFakeTimers()

      const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal
          if (signal) {
            if (signal.aborted) reject(new Error('aborted'))
            signal.addEventListener('abort', () => reject(new Error('aborted')))
          }
        })
      })
      vi.stubGlobal('fetch', fetchMock)

      const promise = provider['fetchWithTimeout']('http://example.com', {}, 100)
      // Pre-attach the rejection handler BEFORE advancing timers so the abort
      // rejection is never observed as unhandled by vitest's worker pool.
      const assertion = expect(promise).rejects.toThrow('aborted')

      await vi.advanceTimersByTimeAsync(200)
      await assertion

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const passedInit = fetchMock.mock.calls[0][1]
      expect(passedInit?.signal).toBeInstanceOf(AbortSignal)
    })
  })

  describe('retryWithBackoff — error wrapping', () => {
    it('wraps a non-Error rejection into an Error after exhausting retries', async () => {
      const op = vi.fn().mockRejectedValue('boom')

      const promise = provider['retryWithBackoff'](op, 0)
      const assertion = expect(promise).rejects.toThrow('boom')

      await assertion
      expect(op).toHaveBeenCalledTimes(1)
    })
  })
})
