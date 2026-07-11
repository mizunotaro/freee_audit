import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NtaInfoSource } from '@/services/external-info/sources/nta-source'
import { WebSearchInfoSource } from '@/services/external-info/sources/web-search-source'
import { outboundRateLimiters, resetOutboundRateLimiters } from '@/lib/api/outbound-rate-limiter'

describe('external-info sources outbound rate limiting', () => {
  beforeEach(() => {
    resetOutboundRateLimiters()
  })

  afterEach(() => {
    resetOutboundRateLimiters()
  })

  it('NTA source still reports not-implemented under normal load', async () => {
    const source = new NtaInfoSource()
    const result = await source.fetch({ query: '税制改正' })
    expect(result.success).toBe(false)
    if (!result.success && result.error) {
      expect(result.error.code).toBe('nta_fetch_error')
      expect(result.error.message).toContain('not implemented')
    }
  })

  it('NTA source surfaces a rate-limit error once the external-info budget is exhausted', async () => {
    const source = new NtaInfoSource()
    const limiter = outboundRateLimiters.externalInfo()
    for (let i = 0; i < limiter.config.maxRequests; i++) {
      limiter.tryAcquire('nta')
    }

    const result = await source.fetch({ query: '税制改正' })
    expect(result.success).toBe(false)
    if (!result.success && result.error) {
      expect(result.error.code).toBe('nta_fetch_error')
      expect(result.error.message).toContain('rate limit')
    }
  })

  it('WebSearch source surfaces a rate-limit error once the budget is exhausted', async () => {
    const source = new WebSearchInfoSource({ enabled: true })
    const limiter = outboundRateLimiters.externalInfo()
    for (let i = 0; i < limiter.config.maxRequests; i++) {
      limiter.tryAcquire('web_search')
    }

    const result = await source.fetch({ query: 'test' })
    expect(result.success).toBe(false)
    if (!result.success && result.error) {
      expect(result.error.code).toBe('web_search_error')
      expect(result.error.message).toContain('rate limit')
    }
  })
})
