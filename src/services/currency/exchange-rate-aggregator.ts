import {
  ExchangeRate,
  ExchangeRateProvider,
  ExchangeRateService,
  CurrencyCode,
  Currency,
  ExchangeRateSource,
} from './types'
import { BOJRateProvider } from './providers/boj-rate-provider'
import { prisma } from '@/lib/db'

export class ExchangeRateAggregator implements ExchangeRateService {
  private providers: ExchangeRateProvider[]

  constructor(providers: ExchangeRateProvider[] = [new BOJRateProvider()]) {
    this.providers = providers.sort((a, b) => a.priority - b.priority)
  }

  async getRate(date: Date, from: Currency, to: Currency): Promise<ExchangeRate> {
    const cachedRate = await this.getFromDB(date, from, to)
    if (cachedRate) {
      return cachedRate
    }

    for (const provider of this.providers) {
      const result = await provider.fetchRates(date)
      if (result.success) {
        const rate = result.data.find((r) => r.fromCurrency === from && r.toCurrency === to)
        if (rate) {
          return rate
        }
      }
    }

    const previousBusinessDay = this.getPreviousBusinessDay(date)
    return this.getRate(previousBusinessDay, from, to)
  }

  async getLatestRate(from: Currency, to: Currency): Promise<ExchangeRate> {
    const lastBusinessDay = this.getPreviousBusinessDay(new Date())
    return this.getRate(lastBusinessDay, from, to)
  }

  async getMonthlyRates(year: number, month: number): Promise<ExchangeRate[]> {
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0)

    const rates = await prisma.exchangeRate.findMany({
      where: {
        rateDate: { gte: startDate, lte: endDate },
      },
      orderBy: { rateDate: 'asc' },
    })

    return rates.map((rate) => ({
      ...rate,
      source: rate.source as ExchangeRateSource,
    }))
  }

  async getRatesInRange(
    startDate: Date,
    endDate: Date,
    from: CurrencyCode,
    to: CurrencyCode
  ): Promise<ExchangeRate[]> {
    const rates = await prisma.exchangeRate.findMany({
      where: {
        rateDate: { gte: startDate, lte: endDate },
        fromCurrency: from,
        toCurrency: to,
      },
      orderBy: { rateDate: 'asc' },
    })

    return rates.map((rate) => ({
      ...rate,
      source: rate.source as ExchangeRateSource,
    }))
  }

  async saveRate(
    rate: Omit<ExchangeRate, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ExchangeRate> {
    const saved = await prisma.exchangeRate.create({
      data: {
        rateDate: rate.rateDate,
        fromCurrency: rate.fromCurrency,
        toCurrency: rate.toCurrency,
        rate: rate.rate,
        source: rate.source,
        sourceUrl: rate.sourceUrl,
        confidence: rate.confidence,
        isOfficial: rate.isOfficial,
      },
    })

    return {
      ...saved,
      source: saved.source as ExchangeRateSource,
    }
  }

  private async getFromDB(date: Date, from: string, to: string): Promise<ExchangeRate | null> {
    const rateDate = new Date(date)
    rateDate.setHours(0, 0, 0, 0)

    const rate = await prisma.exchangeRate.findFirst({
      where: {
        rateDate,
        fromCurrency: from,
        toCurrency: to,
        source: 'BOJ',
      },
    })

    if (rate) {
      return {
        ...rate,
        source: rate.source as ExchangeRateSource,
      }
    }

    const otherRate = await prisma.exchangeRate.findFirst({
      where: {
        rateDate,
        fromCurrency: from,
        toCurrency: to,
      },
      orderBy: { confidence: 'desc' },
    })

    if (otherRate) {
      return {
        ...otherRate,
        source: otherRate.source as ExchangeRateSource,
      }
    }

    return null
  }

  private getPreviousBusinessDay(date: Date): Date {
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

export const exchangeRateService = new ExchangeRateAggregator()
