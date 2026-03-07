import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  BOJExchangeRateService,
  createExchangeRateService,
} from '@/services/currency/exchange-rate'

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

      expect(rate.date).toBeInstanceOf(Date)
      expect(rate.fromCurrency).toBe('JPY')
      expect(rate.toCurrency).toBe('USD')
      expect(rate.rate).toBeGreaterThan(0)
      expect(rate.rate).toBeLessThan(200)
      expect(rate.source).toBe('BOJ')
    })

    it('should return cached rate on subsequent calls', async () => {
      const date = new Date('2024-01-15')

      const rate1 = await service.getRate(date, 'JPY', 'USD')
      const rate2 = await service.getRate(date, 'JPY', 'USD')

      expect(rate1).toEqual(rate2)
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

      expect(rate.date).toBeInstanceOf(Date)
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
    expect(service).toBeInstanceOf(BOJExchangeRateService)
  })

  it('should create BOJ service when specified', () => {
    const service = createExchangeRateService('BOJ')
    expect(service).toBeInstanceOf(BOJExchangeRateService)
  })

  it('should throw error for ECB service (not implemented)', () => {
    expect(() => createExchangeRateService('ECB')).toThrow(
      'ECB exchange rate service not implemented'
    )
  })
})
