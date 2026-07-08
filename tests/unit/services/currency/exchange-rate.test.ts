import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  BOJExchangeRateService,
  createExchangeRateService,
} from '@/services/currency/exchange-rate'
import { exchangeRateCache } from '@/lib/cache'

describe('BOJExchangeRateService', () => {
  let service: BOJExchangeRateService

  beforeEach(() => {
    service = new BOJExchangeRateService()
    vi.clearAllMocks()
  })

  describe('getRate', () => {
    it('should return exchange rate for valid date', async () => {
      const date = new Date('2024-01-15')
      const rate = await service.getRate(date, 'JPY', 'USD')

      expect(rate.rateDate).toBeInstanceOf(Date)
      expect(rate.fromCurrency).toBe('JPY')
      expect(rate.toCurrency).toBe('USD')
      expect(rate.rate).toBeGreaterThan(0)
      expect(rate.rate).toBeLessThan(200)
      expect(rate.source).toBe('BOJ')
    })

    it('should return cached rate on subsequent calls', async () => {
      // exchangeRateCache is a module-level singleton; clear it so the first
      // call below is a guaranteed cache miss regardless of test run order.
      exchangeRateCache.clear()
      // getRate stamps createdAt/updatedAt via new Date() on every call (cache
      // hits included). Freeze the clock or toEqual flakes across an ms boundary.
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-06-01T00:00:00Z'))

      const fetchSpy = vi.spyOn(
        service as unknown as { fetchBOJRate: (...args: unknown[]) => Promise<unknown> },
        'fetchBOJRate'
      )

      try {
        const date = new Date('2024-01-15')

        const rate1 = await service.getRate(date, 'JPY', 'USD')
        const rate2 = await service.getRate(date, 'JPY', 'USD')

        // Second call hits the cache: the BOJ fetch runs exactly once.
        expect(fetchSpy).toHaveBeenCalledTimes(1)
        expect(rate1).toEqual(rate2)
      } finally {
        vi.useRealTimers()
      }
    })

    it('should handle different currency pairs', async () => {
      const date = new Date('2024-01-15')
      const rate = await service.getRate(date, 'USD', 'JPY')

      expect(rate.fromCurrency).toBe('USD')
      expect(rate.toCurrency).toBe('JPY')
    })
  })

  describe('getLatestRate', () => {
    it('should return rate for last business day', async () => {
      const rate = await service.getLatestRate('JPY', 'USD')

      expect(rate.rateDate).toBeInstanceOf(Date)
      expect(rate.fromCurrency).toBe('JPY')
      expect(rate.toCurrency).toBe('USD')
      expect(rate.rate).toBeGreaterThan(0)
    })
  })

  describe('getMonthlyRates', () => {
    it('should return rates for all business days in month', async () => {
      const rates = await service.getMonthlyRates(2024, 1)

      expect(rates.length).toBeGreaterThan(0)
      expect(rates.length).toBeLessThanOrEqual(23)
      rates.forEach((rate) => {
        expect(rate.rate).toBeGreaterThan(0)
        expect(rate.source).toBe('BOJ')
      })
    })

    it('should handle February correctly', async () => {
      const rates = await service.getMonthlyRates(2024, 2)

      expect(rates.length).toBeGreaterThan(0)
      expect(rates.length).toBeLessThanOrEqual(21)
    })
  })

  describe('isBusinessDay', () => {
    it('should return true for weekdays', () => {
      const monday = new Date('2024-01-15')
      const tuesday = new Date('2024-01-16')
      const friday = new Date('2024-01-19')

      expect(
        (service as unknown as { isBusinessDay: (d: Date) => boolean }).isBusinessDay(monday)
      ).toBe(true)
      expect(
        (service as unknown as { isBusinessDay: (d: Date) => boolean }).isBusinessDay(tuesday)
      ).toBe(true)
      expect(
        (service as unknown as { isBusinessDay: (d: Date) => boolean }).isBusinessDay(friday)
      ).toBe(true)
    })

    it('should return false for weekends', () => {
      const saturday = new Date('2024-01-20')
      const sunday = new Date('2024-01-21')

      expect(
        (service as unknown as { isBusinessDay: (d: Date) => boolean }).isBusinessDay(saturday)
      ).toBe(false)
      expect(
        (service as unknown as { isBusinessDay: (d: Date) => boolean }).isBusinessDay(sunday)
      ).toBe(false)
    })
  })

  describe('getLastBusinessDay', () => {
    it('should return previous weekday when current is weekday', () => {
      const tuesday = new Date('2024-01-16')
      const result = (
        service as unknown as { getLastBusinessDay: (d: Date) => Date }
      ).getLastBusinessDay(tuesday)

      expect(result.getDay()).not.toBe(0)
      expect(result.getDay()).not.toBe(6)
    })

    it('should return Friday when current is Monday', () => {
      const monday = new Date('2024-01-15')
      const result = (
        service as unknown as { getLastBusinessDay: (d: Date) => Date }
      ).getLastBusinessDay(monday)

      expect(result.getDay()).toBe(5)
    })
  })
})

describe('createExchangeRateService', () => {
  it('should create BOJ service by default', () => {
    const service = createExchangeRateService()
    expect(service.success).toBe(true)
    if (service.success) {
      expect(service.data).toBeInstanceOf(BOJExchangeRateService)
    }
  })

  it('should create BOJ service when specified', () => {
    const service = createExchangeRateService('BOJ')
    expect(service.success).toBe(true)
    if (service.success) {
      expect(service.data).toBeInstanceOf(BOJExchangeRateService)
    }
  })

  it('should return failure for ECB service (not implemented)', () => {
    const service = createExchangeRateService('ECB')
    expect(service.success).toBe(false)
    if (!service.success) {
      expect(service.error.code).toBe('BUSINESS_LOGIC_ERROR')
      expect(service.error.message).toBe('ECB exchange rate service not implemented')
    }
  })
})
