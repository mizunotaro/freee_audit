import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ExchangeRateAggregator } from '@/services/currency/exchange-rate-aggregator'

vi.mock('@/services/currency/providers/boj-rate-provider', () => ({
  BOJRateProvider: vi.fn().mockImplementation(function (this: any) {
    this.priority = 1
    this.fetchRates = vi.fn().mockResolvedValue({ success: false, data: [] })
  }),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    exchangeRate: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}))

describe('ExchangeRateAggregator', () => {
  let service: ExchangeRateAggregator

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ExchangeRateAggregator()
  })

  describe('getRate', () => {
    it('should return cached rate from DB', async function () {
      const { prisma } = await import('@/lib/db')

      vi.mocked(prisma.exchangeRate.findFirst).mockResolvedValue({
        id: 'rate-1',
        rateDate: new Date('2024-01-15'),
        fromCurrency: 'USD',
        toCurrency: 'JPY',
        rate: 148.5,
        source: 'BOJ',
        sourceUrl: null,
        confidence: 1.0,
        isOfficial: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const rate = await service.getRate(new Date('2024-01-15'), 'USD', 'JPY')

      expect(rate.rate).toBe(148.5)
      expect(rate.fromCurrency).toBe('USD')
    })

    it('should search non-BOJ rates when BOJ not found', async function () {
      const { prisma } = await import('@/lib/db')

      vi.mocked(prisma.exchangeRate.findFirst)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'rate-2',
          rateDate: new Date('2024-01-15'),
          fromCurrency: 'USD',
          toCurrency: 'JPY',
          rate: 149.0,
          source: 'ECB',
          sourceUrl: null,
          confidence: 0.9,
          isOfficial: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        })

      const rate = await service.getRate(new Date('2024-01-15'), 'USD', 'JPY')

      expect(rate.rate).toBe(149.0)
    })
  })

  describe('getMonthlyRates', () => {
    it('should return rates for a month', async function () {
      const { prisma } = await import('@/lib/db')

      vi.mocked(prisma.exchangeRate.findMany).mockResolvedValue([
        {
          id: 'r1',
          rateDate: new Date('2024-01-15'),
          fromCurrency: 'USD',
          toCurrency: 'JPY',
          rate: 148.0,
          source: 'BOJ',
          sourceUrl: null,
          confidence: 1.0,
          isOfficial: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])

      const rates = await service.getMonthlyRates(2024, 1)

      expect(rates).toHaveLength(1)
    })
  })

  describe('getRatesInRange', () => {
    it('should return rates in date range', async function () {
      const { prisma } = await import('@/lib/db')

      vi.mocked(prisma.exchangeRate.findMany).mockResolvedValue([
        {
          id: 'r1',
          rateDate: new Date('2024-01-10'),
          fromCurrency: 'USD',
          toCurrency: 'JPY',
          rate: 147.0,
          source: 'BOJ',
          sourceUrl: null,
          confidence: 1.0,
          isOfficial: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'r2',
          rateDate: new Date('2024-01-20'),
          fromCurrency: 'USD',
          toCurrency: 'JPY',
          rate: 148.0,
          source: 'BOJ',
          sourceUrl: null,
          confidence: 1.0,
          isOfficial: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])

      const rates = await service.getRatesInRange(
        new Date('2024-01-01'),
        new Date('2024-01-31'),
        'USD',
        'EUR'
      )

      expect(rates).toHaveLength(2)
    })
  })

  describe('saveRate', () => {
    it('should save a new rate', async function () {
      const { prisma } = await import('@/lib/db')

      vi.mocked(prisma.exchangeRate.create).mockResolvedValue({
        id: 'new-rate',
        rateDate: new Date('2024-01-15'),
        fromCurrency: 'USD',
        toCurrency: 'JPY',
        rate: 148.5,
        source: 'BOJ',
        sourceUrl: null,
        confidence: 1.0,
        isOfficial: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const saved = await service.saveRate({
        rateDate: new Date('2024-01-15'),
        fromCurrency: 'USD',
        toCurrency: 'JPY',
        rate: 148.5,
        source: 'BOJ',
        sourceUrl: null,
        confidence: 1.0,
        isOfficial: true,
      })

      expect(saved.rate).toBe(148.5)
    })
  })
})
