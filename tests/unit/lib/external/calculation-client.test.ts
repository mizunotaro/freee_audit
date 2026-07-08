import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { CalculationServiceClient } from '@/lib/external/calculation-client'
import { calculateCashFlow } from '@/services/cashflow/calculator'
import {
  createBalanceSheet,
  createProfitLoss,
  createCashFlowStatement,
} from '../../../factories/financial'

vi.mock('@/services/cashflow/calculator', () => ({
  calculateCashFlow: vi.fn(),
}))

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('CalculationServiceClient', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    fetchSpy = vi.spyOn(global, 'fetch')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function makeClient(retries = 1): CalculationServiceClient {
    return new CalculationServiceClient({
      pythonServiceUrl: 'http://py',
      rServiceUrl: 'http://r',
      timeout: 1000,
      retries,
    })
  }

  describe('calculateCashFlow', () => {
    it('returns the python cash_flow result on success', async () => {
      const cf = createCashFlowStatement({ fiscalYear: 2024 })
      fetchSpy.mockResolvedValueOnce(jsonResponse({ cash_flow: cf }))
      const client = makeClient()
      const pl = createProfitLoss()
      const bs = createBalanceSheet()

      const result = await client.calculateCashFlow(pl, bs, null, 'JGAAP')

      expect(result.success).toBe(true)
      expect(result.data).toEqual(cf)
      expect(result.metadata).toEqual(
        expect.objectContaining({ service: 'python', precision: 'decimal' })
      )
      expect(result.metadata.duration).toBeGreaterThanOrEqual(0)
      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(fetchSpy.mock.calls[0][0]).toBe('http://py/api/v1/cashflow/calculate')
    })

    it('falls back to the TypeScript implementation when the service is unreachable', async () => {
      const fallback = createCashFlowStatement({ fiscalYear: 2023 })
      vi.mocked(calculateCashFlow).mockReturnValueOnce(fallback)
      fetchSpy.mockRejectedValueOnce(new TypeError('fetch failed'))
      const client = makeClient()
      const pl = createProfitLoss()
      const bs = createBalanceSheet()
      const prev = createBalanceSheet()
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

      const result = await client.calculateCashFlow(pl, bs, prev, 'USGAAP')

      expect(calculateCashFlow).toHaveBeenCalledWith(pl, bs, prev, { standard: 'USGAAP' })
      expect(warnSpy).toHaveBeenCalledTimes(1)
      expect(result.success).toBe(true)
      expect(result.data).toEqual(fallback)
      expect(result.error).toEqual(
        expect.objectContaining({ code: 'FALLBACK_USED', message: expect.any(String) })
      )
      expect(result.metadata).toEqual({
        service: 'typescript-fallback',
        duration: 0,
        precision: 'float64',
      })
    })

    it('falls back to TypeScript on a persistent 4xx client error', async () => {
      const fallback = createCashFlowStatement()
      vi.mocked(calculateCashFlow).mockReturnValueOnce(fallback)
      fetchSpy.mockResolvedValue(jsonResponse({ message: 'bad request' }, 400))
      const client = makeClient(2)
      const pl = createProfitLoss()
      const bs = createBalanceSheet()
      vi.spyOn(console, 'warn').mockImplementation(() => undefined)

      const result = await client.calculateCashFlow(pl, bs, null)

      expect(fetchSpy).toHaveBeenCalledTimes(2)
      expect(result.success).toBe(true)
      expect(result.error?.code).toBe('FALLBACK_USED')
    })

    it('retries on 5xx before falling back', async () => {
      const fallback = createCashFlowStatement()
      vi.mocked(calculateCashFlow).mockReturnValueOnce(fallback)
      fetchSpy.mockResolvedValue(jsonResponse('error', 500))
      const client = makeClient(2)
      const pl = createProfitLoss()
      const bs = createBalanceSheet()
      vi.spyOn(console, 'warn').mockImplementation(() => undefined)

      const result = await client.calculateCashFlow(pl, bs, null)

      expect(fetchSpy).toHaveBeenCalledTimes(2)
      expect(result.success).toBe(true)
      expect(result.error?.code).toBe('FALLBACK_USED')
    })
  })

  describe('analyzeStatistics', () => {
    it('routes each analysis type to its R endpoint and returns the payload', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ statistic: 'shapiro', p: 0.4 }))
      const client = makeClient()

      const result = await client.analyzeStatistics([1, 2, 3], 'normality')

      expect(fetchSpy.mock.calls[0][0]).toBe('http://r/api/v1/tests/normality')
      expect(result.success).toBe(true)
      expect(result.data).toEqual({ statistic: 'shapiro', p: 0.4 })
      expect(result.metadata).toEqual(expect.objectContaining({ service: 'r', precision: 'high' }))
    })

    it('selects the trend endpoint', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ slope: 1 }))
      const client = makeClient()

      await client.analyzeStatistics([1, 2, 3], 'trend')

      expect(fetchSpy.mock.calls[0][0]).toBe('http://r/api/v1/analysis/trend')
    })

    it('selects the forecast endpoint', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ forecast: [] }))
      const client = makeClient()

      await client.analyzeStatistics([1, 2, 3], 'forecast')

      expect(fetchSpy.mock.calls[0][0]).toBe('http://r/api/v1/forecast/arima')
    })

    it('reports a structured failure when R is unavailable', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('network down'))
      const client = makeClient()

      const result = await client.analyzeStatistics([1, 2, 3], 'trend')

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('SERVICE_UNAVAILABLE')
      expect(result.error?.message).toBe('R statistical service is unavailable')
      expect(result.metadata).toEqual(expect.objectContaining({ service: 'r', precision: 'none' }))
    })
  })

  describe('calculateFinancialRatios', () => {
    it('posts bs, pl and industry_code to the ratios endpoint', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ currentRatio: 2.1 }))
      const client = makeClient()
      const bs = createBalanceSheet()
      const pl = createProfitLoss()

      const result = await client.calculateFinancialRatios(bs, pl, 'F001')

      expect(fetchSpy.mock.calls[0][0]).toBe('http://r/api/v1/ratios')
      const init = fetchSpy.mock.calls[0][1] as RequestInit
      expect(JSON.parse(init.body as string)).toEqual({ bs, pl, industry_code: 'F001' })
      expect(result.success).toBe(true)
      expect(result.data).toEqual({ currentRatio: 2.1 })
    })

    it('omits industry_code when not provided', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({}))
      const client = makeClient()

      await client.calculateFinancialRatios(createBalanceSheet(), createProfitLoss())

      const init = fetchSpy.mock.calls[0][1] as RequestInit
      expect(JSON.parse(init.body as string)).toEqual({
        bs: expect.any(Object),
        pl: expect.any(Object),
        industry_code: undefined,
      })
    })

    it('reports a structured failure when R is unavailable', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('down'))
      const client = makeClient()

      const result = await client.calculateFinancialRatios(createBalanceSheet(), createProfitLoss())

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('SERVICE_UNAVAILABLE')
      expect(result.error?.message).toBe('R service is unavailable')
    })
  })

  describe('calculateAltmanZScore', () => {
    it('returns the z-score payload', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ z_score: 3.2, interpretation: 'safe' }))
      const client = makeClient()

      const result = await client.calculateAltmanZScore(createBalanceSheet(), createProfitLoss())

      expect(fetchSpy.mock.calls[0][0]).toBe('http://r/api/v1/zscore')
      expect(result.success).toBe(true)
      expect(result.data).toEqual({ z_score: 3.2, interpretation: 'safe' })
    })

    it('reports a structured failure when R is unavailable', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('down'))
      const client = makeClient()

      const result = await client.calculateAltmanZScore(createBalanceSheet(), createProfitLoss())

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('SERVICE_UNAVAILABLE')
    })
  })

  describe('healthCheck', () => {
    it('reports both services healthy when both respond ok', async () => {
      fetchSpy.mockImplementation(async (input: string | URL | Request) => {
        const url = typeof input === 'string' ? input : input.toString()
        return jsonResponse({ ok: true }, url.endsWith('/health') ? 200 : 404)
      })
      const client = makeClient()

      const result = await client.healthCheck()

      expect(result).toEqual({ python: true, r: true })
    })

    it('reports a service unhealthy when its health probe fails', async () => {
      fetchSpy.mockImplementation(async (input: string | URL | Request) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.startsWith('http://r')) throw new Error('r down')
        return jsonResponse({ ok: true }, 200)
      })
      const client = makeClient()

      const result = await client.healthCheck()

      expect(result).toEqual({ python: true, r: false })
    })

    it('reports both unhealthy when both probes fail', async () => {
      fetchSpy.mockRejectedValue(new Error('down'))
      const client = makeClient()

      const result = await client.healthCheck()

      expect(result).toEqual({ python: false, r: false })
    })
  })
})
