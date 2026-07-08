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
import {
  type AppError,
  type Result,
  createAppError,
  ERROR_CODES,
  failure,
  success,
} from '@/types/result'

export class DefaultCurrencyConverter implements CurrencyConverter {
  constructor(private rateService: ExchangeRateService) {}

  convert(
    amount: number,
    from: Currency,
    to: Currency,
    rate: ExchangeRate
  ): Result<CurrencyConversion, AppError> {
    if (from === to) {
      return success({
        originalAmount: amount,
        originalCurrency: from,
        convertedAmount: amount,
        convertedCurrency: to,
        exchangeRate: rate,
      })
    }

    let convertedAmount: number

    if (from === rate.fromCurrency && to === rate.toCurrency) {
      convertedAmount = amount / rate.rate
    } else if (from === rate.toCurrency && to === rate.fromCurrency) {
      convertedAmount = amount * rate.rate
    } else {
      return failure(
        createAppError(
          ERROR_CODES.BUSINESS_LOGIC_ERROR,
          `Cannot convert from ${from} to ${to} with rate ${rate.fromCurrency}/${rate.toCurrency}`,
          {
            details: {
              from,
              to,
              rateFrom: rate.fromCurrency,
              rateTo: rate.toCurrency,
            },
          }
        )
      )
    }

    return success({
      originalAmount: amount,
      originalCurrency: from,
      convertedAmount: Math.round(convertedAmount * 100) / 100,
      convertedCurrency: to,
      exchangeRate: rate,
    })
  }

  async convertWithLatestRate(
    amount: number,
    from: Currency,
    to: Currency
  ): Promise<Result<CurrencyConversion, AppError>> {
    if (from === to) {
      const now = new Date()
      return success({
        originalAmount: amount,
        originalCurrency: from,
        convertedAmount: amount,
        convertedCurrency: to,
        exchangeRate: {
          id: 'same-currency',
          rateDate: now,
          fromCurrency: from,
          toCurrency: to,
          rate: 1,
          source: 'BOJ',
          sourceUrl: null,
          confidence: 1.0,
          isOfficial: true,
          createdAt: now,
          updatedAt: now,
        },
      })
    }

    try {
      const rate = await this.rateService.getLatestRate(from, to)
      return this.convert(amount, from, to, rate)
    } catch (error) {
      const cause = error instanceof Error ? error : new Error(String(error))
      return failure(createAppError(ERROR_CODES.EXTERNAL_SERVICE_ERROR, cause.message, { cause }))
    }
  }
}

export function createCurrencyConverter(
  service?: ExchangeRateService
): Result<CurrencyConverter, AppError> {
  let rateService: ExchangeRateService
  if (service) {
    rateService = service
  } else {
    const result = createExchangeRateService('BOJ')
    if (!result.success) {
      return failure(result.error)
    }
    rateService = result.data
  }
  return success(new DefaultCurrencyConverter(rateService))
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

  const formatted = new Intl.NumberFormat(localeStr, {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'JPY' ? 0 : 2,
    maximumFractionDigits: currency === 'JPY' ? 0 : 2,
  }).format(amount)

  return formatted.replace(/\uFFE5/g, '\u00A5')
}
