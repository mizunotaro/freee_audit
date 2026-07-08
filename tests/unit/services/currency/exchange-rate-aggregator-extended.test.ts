import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ExchangeRateAggregator } from '@/services/currency/exchange-rate-aggregator'
import type {
  ExchangeRate,
  ExchangeRateProvider,
  ExchangeRateSource,
} from '@/services/currency/types'

vi.mock('@/lib/db', () => ({
  prisma: {
    exchangeRate: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/db'

function buildRate(overrides: Partial<ExchangeRate> = {}): ExchangeRate {
  return {
    id: 'rate-x',
    rateDate: new Date('2024-01-15T00:00:00Z'),
    fromCurrency: 'USD',
    toCurrency: 'JPY',
    rate: 148.5,
    source: 'BOJ',
    sourceUrl: null,
    confidence: 1.0,
    isOfficial: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function buildProvider(
  overrides: Partial<ExchangeRateProvider> & { fetchRates: ExchangeRateProvider['fetchRates'] }
): ExchangeRateProvider {
  return {
    source: 'BOJ' as ExchangeRateSource,
    priority: 1,
    confidence: 1.0,
    isAvailable: vi.fn().mockResolvedValue(true),
    ...overrides,
  }
}

describe('ExchangeRateAggregator (extended)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getRate — provider fetch path', () => {
    it('uses a matching rate returned by the provider when DB has none', async () => {
      vi.mocked(prisma.exchangeRate.findFirst).mockResolvedValue(null)
      const providerRate = buildRate({ id: 'provider-rate', rate: 150.25 })
      const provider = buildProvider({
        fetchRates: vi.fn().mockResolvedValue({ success: true, data: [providerRate] }),
      })
      const service = new ExchangeRateAggregator([provider])

      const rate = await service.getRate(new Date('2024-01-15'), 'USD', 'JPY')

      expect(rate.id).toBe('provider-rate')
      expect(rate.rate).toBe(150.25)
      expect(provider.fetchRates).toHaveBeenCalledTimes(1)
    })

    it('keeps searching providers until one returns a match (priority order)', async () => {
      vi.mocked(prisma.exchangeRate.findFirst).mockResolvedValue(null)
      const miss = buildProvider({
        priority: 5,
        fetchRates: vi
          .fn()
          .mockResolvedValue({ success: true, data: [buildRate({ fromCurrency: 'EUR' })] }),
      })
      const hitRate = buildRate({ id: 'hit', rate: 142 })
      const hit = buildProvider({
        priority: 1,
        fetchRates: vi.fn().mockResolvedValue({ success: true, data: [hitRate] }),
      })
      const service = new ExchangeRateAggregator([miss, hit])

      const rate = await service.getRate(new Date('2024-01-15'), 'USD', 'JPY')

      expect(rate.id).toBe('hit')
      expect(hit.fetchRates).toHaveBeenCalledTimes(1)
      expect(miss.fetchRates).not.toHaveBeenCalled()
    })

    it('recurses to the previous business day when no provider matches', async () => {
      const noMatch = buildProvider({
        fetchRates: vi
          .fn()
          .mockResolvedValue({ success: true, data: [buildRate({ fromCurrency: 'EUR' })] }),
      })
      const fallbackRate = buildRate({ id: 'prev-day-rate', rate: 137 })
      vi.mocked(prisma.exchangeRate.findFirst)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(fallbackRate)

      const service = new ExchangeRateAggregator([noMatch])
      const rate = await service.getRate(new Date('2024-01-15'), 'USD', 'JPY')

      expect(rate.id).toBe('prev-day-rate')
      expect(rate.rate).toBe(137)
      expect(noMatch.fetchRates).toHaveBeenCalledTimes(1)
    })
  })

  describe('getLatestRate', () => {
    it('reads the most recent rate from the DB via the previous business day', async () => {
      const latest = buildRate({ id: 'latest', rate: 151.2 })
      vi.mocked(prisma.exchangeRate.findFirst).mockResolvedValueOnce(latest)

      const service = new ExchangeRateAggregator([buildProvider({ fetchRates: vi.fn() })])
      const rate = await service.getLatestRate('USD', 'JPY')

      expect(rate.id).toBe('latest')
      expect(rate.rate).toBe(151.2)
    })
  })
})
