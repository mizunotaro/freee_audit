import { ExchangeRate, ExchangeRateService, ExchangeRateSource, Currency } from './types'

export class BOJExchangeRateService implements ExchangeRateService {
  private baseUrl = 'https://www.boj.or.jp/statistics'
  private cache: Map<string, ExchangeRate> = new Map()
  private cacheExpiry: number = 3600000

  async getRate(date: Date, from: Currency, to: Currency): Promise<ExchangeRate> {
    const cacheKey = `${date.toISOString()}-${from}-${to}`
    const cached = this.cache.get(cacheKey)

    if (cached && this.isCacheValid(cached)) {
      return cached
    }

    const rate = await this.fetchBOJRate(date, from, to)
    this.cache.set(cacheKey, rate)

    return rate
  }

  async getLatestRate(from: Currency, to: Currency): Promise<ExchangeRate> {
    const lastBusinessDay = this.getLastBusinessDay(new Date())
    return this.getRate(lastBusinessDay, from, to)
  }

  async getMonthlyRates(year: number, month: number): Promise<ExchangeRate[]> {
    const rates: ExchangeRate[] = []
    const date = new Date(year, month - 1, 1)
    const lastDay = new Date(year, month, 0)

    while (date <= lastDay) {
      if (this.isBusinessDay(date)) {
        try {
          const rate = await this.getRate(new Date(date), 'JPY', 'USD')
          rates.push(rate)
        } catch {
          // Skip holidays/weekends without data
        }
      }
      date.setDate(date.getDate() + 1)
    }

    return rates
  }

  private async fetchBOJRate(date: Date, from: Currency, to: Currency): Promise<ExchangeRate> {
    // BOJ API integration (actual implementation would use real API)
    // This is a placeholder that returns mock data
    const mockRate = this.getMockRate(date)

    return {
      date: new Date(date),
      fromCurrency: from,
      toCurrency: to,
      rate: mockRate,
      source: 'BOJ' as ExchangeRateSource,
    }
  }

  private getMockRate(_date: Date): number {
    // Mock rate based on date for testing
    // In production, this would fetch from BOJ API
    return 149.5 + (Math.random() - 0.5) * 5
  }

  private getLastBusinessDay(date: Date): Date {
    const result = new Date(date)
    result.setDate(result.getDate() - 1)

    while (!this.isBusinessDay(result)) {
      result.setDate(result.getDate() - 1)
    }

    return result
  }

  private isBusinessDay(date: Date): boolean {
    const day = date.getDay()
    return day !== 0 && day !== 6
  }

  private isCacheValid(rate: ExchangeRate): boolean {
    return Date.now() - rate.date.getTime() < this.cacheExpiry
  }
}

export function createExchangeRateService(source: ExchangeRateSource = 'BOJ'): ExchangeRateService {
  switch (source) {
    case 'BOJ':
      return new BOJExchangeRateService()
    case 'ECB':
      // Placeholder for ECB implementation
      throw new Error('ECB exchange rate service not implemented')
    default:
      return new BOJExchangeRateService()
  }
}
