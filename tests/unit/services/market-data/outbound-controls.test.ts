import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { BaseMarketDataProvider } from '@/services/market-data/base-provider'
import {
  OutboundRateLimitError,
  outboundRateLimiters,
  resetOutboundRateLimiters,
} from '@/lib/api/outbound-rate-limiter'

class TestableProvider extends BaseMarketDataProvider {
  readonly name = 'jquants' as const
  authenticate = vi.fn()
  testConnection = vi.fn()
  getQuotes = vi.fn()
  getFinancials = vi.fn()
  getCompanyInfo = vi.fn()
  searchCompanies = vi.fn()
}

describe('BaseMarketDataProvider outbound controls', () => {
  let provider: TestableProvider

  beforeEach(() => {
    resetOutboundRateLimiters()
    provider = new TestableProvider()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    resetOutboundRateLimiters()
  })

  it('sends a descriptive User-Agent header on outbound fetches', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await provider['fetchWithTimeout']('https://api.example.com/resource', {
      headers: { 'Content-Type': 'application/json' },
    })

    const init = fetchMock.mock.calls[0][1] as RequestInit
    const headers = init.headers as Record<string, string>
    const uaKey = Object.keys(headers).find((k) => k.toLowerCase() === 'user-agent')
    expect(uaKey).toBeDefined()
    expect(headers[uaKey!]).toContain('freee_audit')
    expect(headers['Content-Type']).toBe('application/json')
  })

  it('throws OutboundRateLimitError and skips fetch once the market-data limit is exceeded', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const limiter = outboundRateLimiters.marketData()
    for (let i = 0; i < limiter.config.maxRequests; i++) {
      const r = limiter.tryAcquire('api.example.com')
      expect(r.success && r.data.allowed).toBe(true)
    }

    await expect(
      provider['fetchWithTimeout']('https://api.example.com/resource')
    ).rejects.toBeInstanceOf(OutboundRateLimitError)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
