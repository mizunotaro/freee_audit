import {
  ExchangeRate,
  ExchangeRateService,
  ExchangeRateSource,
  Currency,
  CurrencyCode,
} from './types'
import { exchangeRateCache } from '@/lib/cache'
import {
  type AppError,
  type Result,
  createAppError,
  ERROR_CODES,
  failure,
  success,
} from '@/types/result'

/**
 * ExchangeRateService backed by Bank of Japan rates. Uses an in-process cache and
 * returns mock-derived rates (intended for development) when no live fetch occurs.
 */
export class BOJExchangeRateService implements ExchangeRateService {
  private baseUrl = 'https://www.boj.or.jp/statistics'

  /**
   * Resolves an exchange rate for a date and pair, returning a cached value when
   * available and otherwise fetching (currently mock-derived) a BOJ rate.
   *
   * @param date - Target date.
   * @param from - Source currency.
   * @param to - Target currency.
   * @returns The resolved ExchangeRate.
   */
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

  /**
   * Resolves the rate for the most recent business day.
   *
   * @param from - Source currency.
   * @param to - Target currency.
   * @returns The resolved ExchangeRate.
   */
  async getLatestRate(from: Currency, to: Currency): Promise<ExchangeRate> {
    const lastBusinessDay = this.getLastBusinessDay(new Date())
    return this.getRate(lastBusinessDay, from, to)
  }

  /**
   * Collects JPY/USD rates for every business day in a month.
   *
   * @param year - Calendar year.
   * @param month - Calendar month (1-12).
   * @returns ExchangeRate records for each business day with data; failed days are skipped.
   */
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

  /**
   * Collects rates for a currency pair on every business day in a range.
   *
   * @param startDate - Range start (inclusive).
   * @param endDate - Range end (inclusive).
   * @param from - Source currency code.
   * @param to - Target currency code.
   * @returns ExchangeRate records for each business day with data; failed days are skipped.
   */
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

  /**
   * Returns the supplied rate with generated id/timestamps (no persistence in this
   * mock-oriented implementation).
   *
   * @param rate - ExchangeRate fields (id/timestamps are generated).
   * @returns The augmented ExchangeRate.
   */
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

/**
 * Factory for exchange-rate services by source.
 *
 * @param source - Desired rate source (default 'BOJ').
 * @returns success with the service for 'BOJ', or failure with BUSINESS_LOGIC_ERROR
 *   for unimplemented sources (ECB, MURC, OPEN_EXCHANGE, MANUAL). Unknown sources
 *   fall back to the BOJ service.
 */
export function createExchangeRateService(
  source: ExchangeRateSource = 'BOJ'
): Result<ExchangeRateService, AppError> {
  switch (source) {
    case 'BOJ':
      return success(new BOJExchangeRateService())
    case 'ECB':
    case 'MURC':
    case 'OPEN_EXCHANGE':
    case 'MANUAL':
      return failure(
        createAppError(
          ERROR_CODES.BUSINESS_LOGIC_ERROR,
          `${source} exchange rate service not implemented`
        )
      )
    default:
      return success(new BOJExchangeRateService())
  }
}
