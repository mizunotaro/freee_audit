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

describe('BaseMarketDataProvider', () => {
  let provider: TestableProvider

  beforeEach(() => {
    provider = new TestableProvider()
  })

  describe('constructor', () => {
    it('sets default config', () => {
      expect(provider['config']).toEqual({
        enabled: true,
        priority: 10,
        timeout: 30000,
        retries: 3,
      })
    })

    it('merges custom config', () => {
      const custom = new TestableProvider({ timeout: 5000, retries: 1 })
      expect(custom['config'].timeout).toBe(5000)
      expect(custom['config'].retries).toBe(1)
      expect(custom['config'].enabled).toBe(true)
    })
  })

  describe('fetchWithTimeout', () => {
    it('fetches and parses JSON', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ data: 'test' }),
        })
      )

      const result = await provider['fetchWithTimeout']<{ data: string }>('http://example.com')
      expect(result).toEqual({ data: 'test' })
    })

    it('throws on non-ok response', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        })
      )

      await expect(provider['fetchWithTimeout']('http://example.com')).rejects.toThrow('HTTP 500')
    })
  })

  describe('retryWithBackoff', () => {
    it('returns result on first attempt', async () => {
      const op = vi.fn().mockResolvedValue('success')
      const result = await provider['retryWithBackoff'](op, 2)
      expect(result).toBe('success')
      expect(op).toHaveBeenCalledTimes(1)
    })

    it('retries on failure and succeeds', async () => {
      vi.useFakeTimers()
      const op = vi.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValueOnce('success')

      const promise = provider['retryWithBackoff'](op, 2)
      await vi.advanceTimersByTimeAsync(3000)
      const result = await promise
      expect(result).toBe('success')
      expect(op).toHaveBeenCalledTimes(2)
      vi.useRealTimers()
    })

    it('throws after all retries exhausted', async () => {
      vi.useFakeTimers()
      const op = vi.fn().mockRejectedValue(new Error('always fail'))

      const promise = provider['retryWithBackoff'](op, 1)
      await vi.advanceTimersByTimeAsync(3000)
      await expect(promise).rejects.toThrow('always fail')
      expect(op).toHaveBeenCalledTimes(2)
      vi.useRealTimers()
    })

    it('throws after all retries exhausted', async () => {
      vi.useFakeTimers()
      const op = vi.fn().mockRejectedValue(new Error('always fail'))

      const promise = provider['retryWithBackoff'](op, 1)
      await vi.advanceTimersByTimeAsync(3000)
      await expect(promise).rejects.toThrow('always fail')
      expect(op).toHaveBeenCalledTimes(2)
      vi.useRealTimers()
    })
  })
})
