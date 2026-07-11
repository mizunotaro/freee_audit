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

/**
 * CurrencyConverter implementation that performs conversions against a pluggable
 * ExchangeRateService, returning Result values instead of throwing.
 */
export class DefaultCurrencyConverter implements CurrencyConverter {
  constructor(private rateService: ExchangeRateService) {}

  /**
   * Converts an amount using an explicit exchange rate.
   *
   * Same-currency conversions return the amount unchanged. Otherwise the rate is
   * applied directly (amount / rate) when the pair matches, or inversely
   * (amount * rate) when reversed.
   *
   * @param amount - Amount to convert.
   * @param from - Source currency.
   * @param to - Target currency.
   * @param rate - Exchange rate to apply.
   * @returns success with the CurrencyConversion, or failure with
   *   BUSINESS_LOGIC_ERROR when the rate's currency pair cannot bridge `from`→`to`.
   */
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

  /**
   * Converts an amount using the latest rate fetched from the rate service.
   *
   * @param amount - Amount to convert.
   * @param from - Source currency.
   * @param to - Target currency.
   * @returns success with the CurrencyConversion (same-currency pairs
   *   short-circuit), or failure with EXTERNAL_SERVICE_ERROR if the rate lookup throws.
   */
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

/**
 * Builds a DefaultCurrencyConverter, creating a default BOJ rate service when one
 * is not supplied.
 *
 * @param service - Optional ExchangeRateService to inject.
 * @returns success with the converter, or failure forwarding the rate-service
 *   creation error.
 */
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

/**
 * Calculates cash runway: months of cash remaining at the current net burn rate
 * (monthly expenses minus monthly revenue).
 *
 * @param currentCash - Cash balance at the start.
 * @param averageMonthlyRevenue - Average monthly revenue.
 * @param averageMonthlyExpenses - Average monthly expenses.
 * @returns RunwayCalculation; `runwayMonths` is `Infinity` when not burning cash.
 */
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

/**
 * Formats an amount in its base currency alongside the converted JPY/USD equivalent,
 * using locale-aware currency formatting.
 *
 * @param amount - Amount in the base currency.
 * @param baseCurrency - Base currency code (JPY converts to USD, anything else to JPY).
 * @param exchangeRate - Rate used for the conversion (shown to 2 dp).
 * @param locale - Display locale, 'ja' or 'en' (default 'ja').
 * @returns Formatted dual-currency string.
 */
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

/**
 * Formats a numeric amount as a locale-aware currency string (JPY uses 0 decimals).
 *
 * @param amount - Amount to format.
 * @param currency - Currency code.
 * @param locale - Display locale, 'ja' or 'en' (default 'ja').
 * @returns Formatted currency string.
 */
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
