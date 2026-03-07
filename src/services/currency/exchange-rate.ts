import { ExchangeRate, ExchangeRateService, ExchangeRateSource, Currency } from './types'
import { exchangeRateCache } from '@/lib/cache'

export class BOJExchangeRateService implements ExchangeRateService {
  private baseUrl = 'https://www.boj.or.jp/statistics'

  async getRate(date: Date, from: Currency, to: Currency): Promise<ExchangeRate> {
    const cacheKey = `${date.toISOString()}-${from}-${to}`

    const cachedRate = exchangeRateCache.get(cacheKey)
    if (cachedRate !== null) {
      return {
        date: new Date(date),
        fromCurrency: from,
        toCurrency: to,
        rate: cachedRate,
        source: 'BOJ' as ExchangeRateSource,
      }
    }

    const rate = await this.fetchBOJRate(date, from, to)
    exchangeRateCache.set(cacheKey, rate.rate)

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

  private getMockRate(date: Date): number {
    const dateNum = date.getTime()
    const seed = dateNum % 1000
    return 149.5 + (seed / 1000) * 5
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
