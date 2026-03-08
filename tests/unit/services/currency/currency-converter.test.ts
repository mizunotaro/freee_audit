import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  DefaultCurrencyConverter,
  createCurrencyConverter,
  calculateRunway,
  formatDualCurrency,
  formatCurrency,
} from '@/services/currency/currency-converter'
import type { ExchangeRateService, ExchangeRate, Currency } from '@/services/currency/types'

describe('DefaultCurrencyConverter', () => {
  let converter: DefaultCurrencyConverter
  let mockRateService: ExchangeRateService

  const mockRate: ExchangeRate = {
    id: 'rate-1',
    rateDate: new Date('2024-01-15'),
    fromCurrency: 'JPY',
    toCurrency: 'USD',
    rate: 149.5,
    source: 'BOJ',
    sourceUrl: null,
    confidence: 1.0,
    isOfficial: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  beforeEach(() => {
    mockRateService = {
      getRate: vi.fn().mockResolvedValue(mockRate),
      getLatestRate: vi.fn().mockResolvedValue(mockRate),
      getMonthlyRates: vi.fn().mockResolvedValue([mockRate]),
      getRatesInRange: vi.fn().mockResolvedValue([mockRate]),
      saveRate: vi.fn().mockResolvedValue(mockRate),
    }
    converter = new DefaultCurrencyConverter(mockRateService)
    vi.clearAllMocks()
  })

  describe('convert', () => {
    it('should return same amount for same currency', () => {
      const result = converter.convert(1000, 'JPY', 'JPY', mockRate)

      expect(result.originalAmount).toBe(1000)
      expect(result.convertedAmount).toBe(1000)
      expect(result.originalCurrency).toBe('JPY')
      expect(result.convertedCurrency).toBe('JPY')
    })

    it('should convert JPY to USD correctly', () => {
      const result = converter.convert(14950, 'JPY', 'USD', mockRate)

      expect(result.originalAmount).toBe(14950)
      expect(result.originalCurrency).toBe('JPY')
      expect(result.convertedCurrency).toBe('USD')
      expect(result.convertedAmount).toBeCloseTo(100, 0)
    })

    it('should convert USD to JPY correctly', () => {
      const usdToJpyRate: ExchangeRate = {
        id: 'rate-2',
        rateDate: new Date('2024-01-15'),
        fromCurrency: 'JPY',
        toCurrency: 'USD',
        rate: 149.5,
        source: 'BOJ',
        sourceUrl: null,
        confidence: 1.0,
        isOfficial: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const result = converter.convert(100, 'USD', 'JPY', usdToJpyRate)

      expect(result.originalAmount).toBe(100)
      expect(result.originalCurrency).toBe('USD')
      expect(result.convertedCurrency).toBe('JPY')
      expect(result.convertedAmount).toBe(14950)
    })

    it('should throw error for incompatible currency pair', () => {
      const incompatibleRate: ExchangeRate = {
        id: 'rate-3',
        rateDate: new Date('2024-01-15'),
        fromCurrency: 'EUR' as Currency,
        toCurrency: 'GBP' as Currency,
        rate: 1.2,
        source: 'BOJ',
        sourceUrl: null,
        confidence: 1.0,
        isOfficial: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      expect(() => converter.convert(100, 'JPY', 'USD', incompatibleRate)).toThrow()
    })

    it('should round converted amount to 2 decimal places', () => {
      const result = converter.convert(10000, 'JPY', 'USD', { ...mockRate, rate: 149.33 })

      expect(result.convertedAmount).toBe(Math.round((10000 / 149.33) * 100) / 100)
    })
  })

  describe('convertWithLatestRate', () => {
    it('should return same amount for same currency without calling rate service', async () => {
      const result = await converter.convertWithLatestRate(1000, 'JPY', 'JPY')

      expect(result.originalAmount).toBe(1000)
      expect(result.convertedAmount).toBe(1000)
      expect(mockRateService.getLatestRate).not.toHaveBeenCalled()
    })

    it('should fetch latest rate and convert', async () => {
      const result = await converter.convertWithLatestRate(14950, 'JPY', 'USD')

      expect(mockRateService.getLatestRate).toHaveBeenCalledWith('JPY', 'USD')
      expect(result.convertedAmount).toBeCloseTo(100, 0)
    })

    it('should include exchange rate in result', async () => {
      const result = await converter.convertWithLatestRate(14950, 'JPY', 'USD')

      expect(result.exchangeRate).toEqual(mockRate)
    })
  })
})

describe('createCurrencyConverter', () => {
  it('should create converter with provided rate service', () => {
    const mockService = {
      getRate: vi.fn(),
      getLatestRate: vi.fn(),
      getMonthlyRates: vi.fn(),
      getRatesInRange: vi.fn(),
      saveRate: vi.fn(),
    }

    const converter = createCurrencyConverter(mockService)

    expect(converter).toBeInstanceOf(DefaultCurrencyConverter)
  })

  it('should create converter with default BOJ service when not provided', () => {
    const converter = createCurrencyConverter()

    expect(converter).toBeInstanceOf(DefaultCurrencyConverter)
  })
})

describe('calculateRunway', () => {
  it('should calculate runway correctly for positive burn rate', () => {
    const result = calculateRunway(1000000, 500000, 700000)

    expect(result.monthlyBurnRate).toBe(200000)
    expect(result.runwayMonths).toBe(5)
    expect(result.zeroCashDate).toBeInstanceOf(Date)
  })

  it('should return Infinity for zero burn rate', () => {
    const result = calculateRunway(1000000, 700000, 500000)

    expect(result.monthlyBurnRate).toBe(-200000)
    expect(result.runwayMonths).toBe(Infinity)
  })

  it('should return Infinity for negative burn rate (profitable)', () => {
    const result = calculateRunway(1000000, 800000, 500000)

    expect(result.monthlyBurnRate).toBe(-300000)
    expect(result.runwayMonths).toBe(Infinity)
  })

  it('should handle zero cash', () => {
    const result = calculateRunway(0, 500000, 700000)

    expect(result.runwayMonths).toBe(0)
  })
})

describe('formatDualCurrency', () => {
  it('should format dual currency in Japanese locale', () => {
    const result = formatDualCurrency(14950, 'JPY', 149.5, 'ja')

    expect(result).toContain('¥')
    expect(result).toContain('$')
    expect(result).toContain('149.50')
  })

  it('should format dual currency in English locale', () => {
    const result = formatDualCurrency(100, 'USD', 149.5, 'en')

    expect(result).toContain('$')
    expect(result).toContain('¥')
    expect(result).toContain('149.50')
  })

  it('should include exchange rate in formatted string', () => {
    const result = formatDualCurrency(14950, 'JPY', 149.5, 'ja')

    expect(result).toContain('@149.50')
  })
})

describe('formatCurrency', () => {
  it('should format JPY with no decimal places', () => {
    const result = formatCurrency(12345, 'JPY', 'ja')

    expect(result).toContain('¥')
    expect(result).not.toContain('.00')
  })

  it('should format USD with 2 decimal places', () => {
    const result = formatCurrency(123.45, 'USD', 'en')

    expect(result).toContain('$')
    expect(result).toContain('123.45')
  })

  it('should use Japanese locale for ja', () => {
    const result = formatCurrency(1000, 'JPY', 'ja')

    expect(result).toContain('¥')
  })

  it('should use English locale for en', () => {
    const result = formatCurrency(1000, 'USD', 'en')

    expect(result).toContain('$')
  })
})
