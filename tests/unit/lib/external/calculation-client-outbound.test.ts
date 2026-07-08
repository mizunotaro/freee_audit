import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { CalculationServiceClient } from '@/lib/external/calculation-client'
import { resetOutboundRateLimiters } from '@/lib/api/outbound-rate-limiter'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function makeClient(): CalculationServiceClient {
  return new CalculationServiceClient({
    pythonServiceUrl: 'http://py',
    rServiceUrl: 'http://r',
    timeout: 1000,
    retries: 1,
  })
}

function userAgentFromInit(init: RequestInit | undefined): string | undefined {
  if (!init || !init.headers) return undefined
  const headers = init.headers as Record<string, string>
  const key = Object.keys(headers).find((k) => k.toLowerCase() === 'user-agent')
  return key ? headers[key] : undefined
}

describe('CalculationServiceClient outbound controls', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    resetOutboundRateLimiters()
    fetchSpy = vi.spyOn(global, 'fetch')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    resetOutboundRateLimiters()
  })

  it('sends a descriptive User-Agent header on data calls to the internal service', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ statistic: 'shapiro' }))
    const client = makeClient()

    await client.analyzeStatistics([1, 2, 3], 'normality')

    expect(userAgentFromInit(fetchSpy.mock.calls[0][1] as RequestInit)).toContain('freee_audit')
  })

  it('sends a User-Agent on health probes', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ ok: true }, 200))
    const client = makeClient()

    await client.healthCheck()

    expect(fetchSpy.mock.calls.length).toBeGreaterThan(0)
    for (const call of fetchSpy.mock.calls) {
      expect(userAgentFromInit(call[1] as RequestInit)).toContain('freee_audit')
    }
  })
})
