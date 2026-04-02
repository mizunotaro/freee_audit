import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getExchangeRate,
  convertCurrency,
  formatDualCurrency,
  getMonthEndTTMDate,
  saveExchangeRate,
  isValidCurrency,
  SUPPORTED_CURRENCIES,
} from '@/services/currency/converter'

vi.mock('@/lib/db', () => ({
  prisma: {
    exchangeRate: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}))

describe('getExchangeRate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return identity rate for same currency', async function () {
    const rate = await getExchangeRate('JPY', 'JPY', new Date())

    expect(rate).not.toBeNull()
    expect(rate!.rate).toBe(1)
    expect(rate!.source).toBe('identity')
  })

  it('should return rate from database', async function () {
    const { prisma } = await import('@/lib/db')

    vi.mocked(prisma.exchangeRate.findFirst).mockResolvedValue({
      rateDate: new Date('2024-01-15'),
      fromCurrency: 'USD',
      toCurrency: 'JPY',
      rate: 148.5,
      source: 'BOJ',
    } as any)

    const rate = await getExchangeRate('USD', 'JPY', new Date('2024-01-15'))

    expect(rate).not.toBeNull()
    expect(rate!.rate).toBe(148.5)
  })

  it('should return null when no rate found', async function () {
    const { prisma } = await import('@/lib/db')

    vi.mocked(prisma.exchangeRate.findFirst).mockResolvedValue(null)

    const rate = await getExchangeRate('EUR', 'JPY', new Date('2024-01-15'))

    expect(rate).toBeNull()
  })
})

describe('convertCurrency', () => {
  it('should convert amount using exchange rate', function () {
    const result = convertCurrency(14850, 'USD', 'JPY', 148.5)

    expect(result.originalAmount).toBe(14850)
    expect(result.convertedAmount).toBe(100)
    expect(result.rate).toBe(148.5)
    expect(result.fromCurrency).toBe('USD')
    expect(result.toCurrency).toBe('JPY')
  })

  it('should round to 2 decimal places', function () {
    const result = convertCurrency(10000, 'JPY', 'USD', 148.333)

    expect(result.convertedAmount).toBe(Math.round((10000 / 148.333) * 100) / 100)
  })
})

describe('formatDualCurrency', () => {
  it('should format dual currency display', function () {
    const result = formatDualCurrency(1000000, 6700, 149.25)

    expect(result).toContain('¥1,000,000')
    expect(result).toContain('$6,700')
    expect(result).toContain('149.25')
  })
})

describe('getMonthEndTTMDate', () => {
  it('should return last business day of month', function () {
    const date = new Date('2024-01-15')
    const result = getMonthEndTTMDate(date)

    expect(result.getMonth()).toBe(0)
    expect(result.getDay()).not.toBe(0)
    expect(result.getDay()).not.toBe(6)
    expect(result.getDate()).toBeLessThanOrEqual(31)
  })

  it('should skip weekends for month-end', function () {
    const date = new Date('2024-03-15')
    const result = getMonthEndTTMDate(date)

    expect(result.getDay()).not.toBe(0)
    expect(result.getDay()).not.toBe(6)
  })
})

describe('saveExchangeRate', () => {
  it('should save exchange rate to database', async function () {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.exchangeRate.create).mockResolvedValue({} as any)

    await saveExchangeRate({
      rateDate: new Date('2024-01-15'),
      fromCurrency: 'USD',
      toCurrency: 'JPY',
      rate: 148.5,
      source: 'BOJ',
    })

    expect(prisma.exchangeRate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fromCurrency: 'USD',
        toCurrency: 'JPY',
        rate: 148.5,
      }),
    })
  })
})

describe('isValidCurrency', () => {
  it('should validate supported currencies', function () {
    expect(isValidCurrency('JPY')).toBe(true)
    expect(isValidCurrency('USD')).toBe(true)
    expect(isValidCurrency('EUR')).toBe(true)
    expect(isValidCurrency('GBP')).toBe(true)
  })

  it('should reject unsupported currencies', function () {
    expect(isValidCurrency('CNY')).toBe(false)
    expect(isValidCurrency('KRW')).toBe(false)
  })
})

describe('SUPPORTED_CURRENCIES', () => {
  it('should contain expected currencies', function () {
    expect(SUPPORTED_CURRENCIES).toContain('JPY')
    expect(SUPPORTED_CURRENCIES).toContain('USD')
    expect(SUPPORTED_CURRENCIES).toContain('EUR')
    expect(SUPPORTED_CURRENCIES).toContain('GBP')
  })
})
