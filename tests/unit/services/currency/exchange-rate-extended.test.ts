import { describe, it, expect, beforeEach } from 'vitest'
import {
  BOJExchangeRateService,
  createExchangeRateService,
} from '@/services/currency/exchange-rate'
import type { ExchangeRateSource } from '@/services/currency/types'

describe('BOJExchangeRateService (extended)', () => {
  let service: BOJExchangeRateService

  beforeEach(() => {
    service = new BOJExchangeRateService()
  })

  describe('getRatesInRange', () => {
    it('returns one rate per business day in a weekday-only range', async () => {
      const rates = await service.getRatesInRange(
        new Date('2024-01-15T00:00:00Z'),
        new Date('2024-01-17T00:00:00Z'),
        'USD',
        'EUR'
      )

      expect(rates).toHaveLength(3)
      rates.forEach((rate) => {
        expect(rate.source).toBe('BOJ')
        expect(rate.rate).toBeGreaterThan(0)
        expect(rate.rate).toBeLessThan(200)
      })
    })

    it('skips weekend days inside the range', async () => {
      const rates = await service.getRatesInRange(
        new Date('2024-01-19T00:00:00Z'),
        new Date('2024-01-22T00:00:00Z'),
        'USD',
        'GBP'
      )

      expect(rates).toHaveLength(2)
    })

    it('returns an empty array when the range contains only weekends', async () => {
      const rates = await service.getRatesInRange(
        new Date('2024-01-20T00:00:00Z'),
        new Date('2024-01-21T00:00:00Z'),
        'USD',
        'EUR'
      )

      expect(rates).toHaveLength(0)
    })
  })

  describe('saveRate', () => {
    it('materializes a persisted rate object with generated id and timestamps', async () => {
      const saved = await service.saveRate({
        rateDate: new Date('2024-01-15T00:00:00Z'),
        fromCurrency: 'JPY',
        toCurrency: 'USD',
        rate: 149.5,
        source: 'BOJ',
        sourceUrl: null,
        confidence: 1.0,
        isOfficial: true,
      })

      expect(saved.id.startsWith('rate-')).toBe(true)
      expect(saved.rate).toBe(149.5)
      expect(saved.fromCurrency).toBe('JPY')
      expect(saved.toCurrency).toBe('USD')
      expect(saved.createdAt).toBeInstanceOf(Date)
      expect(saved.updatedAt).toBeInstanceOf(Date)
    })
  })
})

describe('createExchangeRateService (extended)', () => {
  it.each(['MURC', 'OPEN_EXCHANGE', 'MANUAL'] as ExchangeRateSource[])(
    'throws for unsupported source %s',
    (source) => {
      expect(() => createExchangeRateService(source)).toThrow(
        `${source} exchange rate service not implemented`
      )
    }
  )

  it('returns a BOJ service for the explicit BOJ source', () => {
    expect(createExchangeRateService('BOJ')).toBeInstanceOf(BOJExchangeRateService)
  })
})
