import {
  CurrencyConversion,
  CurrencyConverter,
  Currency,
  ExchangeRate,
  ExchangeRateService,
  RunwayCalculation,
} from './types'
import { createExchangeRateService } from './exchange-rate'
import { addMonths } from 'date-fns'

export class DefaultCurrencyConverter implements CurrencyConverter {
  constructor(private rateService: ExchangeRateService) {}

  convert(amount: number, from: Currency, to: Currency, rate: ExchangeRate): CurrencyConversion {
    if (from === to) {
      return {
        originalAmount: amount,
        originalCurrency: from,
        convertedAmount: amount,
        convertedCurrency: to,
        exchangeRate: rate,
      }
    }

    let convertedAmount: number

    if (from === rate.fromCurrency && to === rate.toCurrency) {
      convertedAmount = amount / rate.rate
    } else if (from === rate.toCurrency && to === rate.fromCurrency) {
      convertedAmount = amount * rate.rate
    } else {
      throw new Error(
        `Cannot convert from ${from} to ${to} with rate ${rate.fromCurrency}/${rate.toCurrency}`
      )
    }

    return {
      originalAmount: amount,
      originalCurrency: from,
      convertedAmount: Math.round(convertedAmount * 100) / 100,
      convertedCurrency: to,
      exchangeRate: rate,
    }
  }

  async convertWithLatestRate(
    amount: number,
    from: Currency,
    to: Currency
  ): Promise<CurrencyConversion> {
    if (from === to) {
      return {
        originalAmount: amount,
        originalCurrency: from,
        convertedAmount: amount,
        convertedCurrency: to,
        exchangeRate: {
          date: new Date(),
          fromCurrency: from,
          toCurrency: to,
          rate: 1,
          source: 'BOJ',
        },
      }
    }

    const rate = await this.rateService.getLatestRate(from, to)
    return this.convert(amount, from, to, rate)
  }
}

export function createCurrencyConverter(service?: ExchangeRateService): CurrencyConverter {
  const rateService = service || createExchangeRateService('BOJ')
  return new DefaultCurrencyConverter(rateService)
}

export function calculateRunway(
  currentCash: number,
  averageMonthlyRevenue: number,
  averageMonthlyExpenses: number
): RunwayCalculation {
  const burnRate = averageMonthlyExpenses - averageMonthlyRevenue
  const runwayMonths = burnRate > 0 ? currentCash / burnRate : Infinity

  return {
    monthlyBurnRate: burnRate,
    runwayMonths,
    zeroCashDate: addMonths(new Date(), Math.floor(runwayMonths)),
  }
}

export function formatDualCurrency(
  amount: number,
  baseCurrency: Currency,
  exchangeRate: number,
  locale: 'ja' | 'en' = 'ja'
): string {
  const baseFormatted = formatCurrency(amount, baseCurrency, locale)
  const convertedAmount = baseCurrency === 'JPY' ? amount / exchangeRate : amount * exchangeRate
  const convertedCurrency: Currency = baseCurrency === 'JPY' ? 'USD' : 'JPY'
  const convertedFormatted = formatCurrency(convertedAmount, convertedCurrency, locale)

  return `${baseFormatted} (${convertedFormatted} @${exchangeRate.toFixed(2)})`
}

export function formatCurrency(
  amount: number,
  currency: Currency,
  locale: 'ja' | 'en' = 'ja'
): string {
  const localeStr = locale === 'ja' ? 'ja-JP' : 'en-US'

  return new Intl.NumberFormat(localeStr, {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'JPY' ? 0 : 2,
    maximumFractionDigits: currency === 'JPY' ? 0 : 2,
  }).format(amount)
}
