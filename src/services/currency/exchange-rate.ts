import {
  ExchangeRate,
  ExchangeRateService,
  ExchangeRateSource,
  Currency,
  CurrencyCode,
} from './types'
import { exchangeRateCache } from '@/lib/cache'

export class BOJExchangeRateService implements ExchangeRateService {
  private baseUrl = 'https://www.boj.or.jp/statistics'

  async getRate(date: Date, from: Currency, to: Currency): Promise<ExchangeRate> {
    const cacheKey = `${date.toISOString()}-${from}-${to}`

    const cachedRate = exchangeRateCache.get(cacheKey)
    if (cachedRate !== null) {
      return this.createExchangeRate(new Date(date), from, to, cachedRate, 'BOJ')
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

  async getRatesInRange(
    startDate: Date,
    endDate: Date,
    from: CurrencyCode,
    to: CurrencyCode
  ): Promise<ExchangeRate[]> {
    const rates: ExchangeRate[] = []
    const date = new Date(startDate)

    while (date <= endDate) {
      if (this.isBusinessDay(date)) {
        try {
          const rate = await this.getRate(new Date(date), from as Currency, to as Currency)
          rates.push(rate)
        } catch {
          // Skip holidays/weekends without data
        }
      }
      date.setDate(date.getDate() + 1)
    }

    return rates
  }

  async saveRate(
    rate: Omit<ExchangeRate, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ExchangeRate> {
    return {
      id: `rate-${Date.now()}`,
      ...rate,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  }

  private async fetchBOJRate(date: Date, from: Currency, to: Currency): Promise<ExchangeRate> {
    const mockRate = this.getMockRate(date)
    return this.createExchangeRate(new Date(date), from, to, mockRate, 'BOJ')
  }

  private createExchangeRate(
    date: Date,
    fromCurrency: string,
    toCurrency: string,
    rate: number,
    source: ExchangeRateSource
  ): ExchangeRate {
    return {
      id: `rate-${date.toISOString()}-${fromCurrency}-${toCurrency}`,
      rateDate: new Date(date),
      fromCurrency,
      toCurrency,
      rate,
      source,
      sourceUrl: null,
      confidence: source === 'BOJ' ? 1.0 : 0.9,
      isOfficial: source === 'BOJ',
      createdAt: new Date(),
      updatedAt: new Date(),
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
    case 'MURC':
    case 'OPEN_EXCHANGE':
    case 'MANUAL':
      throw new Error(`${source} exchange rate service not implemented`)
    default:
      return new BOJExchangeRateService()
  }
}
