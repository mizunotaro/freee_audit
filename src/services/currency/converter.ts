import type { CurrencyConversion } from '@/types'
import { prisma } from '@/lib/db'

export interface ExchangeRate {
  rateDate: Date
  fromCurrency: string
  toCurrency: string
  rate: number
  source: string
}

/**
 * Looks up the most recent exchange rate at or before the given date for a currency
 * pair. Same-currency pairs return an identity rate (rate 1, source 'identity').
 *
 * @param fromCurrency - Source currency code.
 * @param toCurrency - Target currency code.
 * @param date - Date the rate applies to (most recent on/before it is returned).
 * @returns The matching ExchangeRate, or `null` if none exists.
 * @throws Rejected with a Prisma error if the lookup fails.
 */
export async function getExchangeRate(
  fromCurrency: string,
  toCurrency: string,
  date: Date
): Promise<ExchangeRate | null> {
  if (fromCurrency === toCurrency) {
    return {
      rateDate: date,
      fromCurrency,
      toCurrency,
      rate: 1,
      source: 'identity',
    }
  }

  const rate = await prisma.exchangeRate.findFirst({
    where: {
      fromCurrency,
      toCurrency,
      rateDate: {
        lte: date,
      },
    },
    orderBy: {
      rateDate: 'desc',
    },
  })

  if (!rate) return null

  return {
    rateDate: rate.rateDate,
    fromCurrency: rate.fromCurrency,
    toCurrency: rate.toCurrency,
    rate: rate.rate,
    source: rate.source,
  }
}

/**
 * Converts an amount using a direct exchange rate (amount / rate), rounded to 2 dp.
 *
 * @param amount - Amount to convert.
 * @param fromCurrency - Source currency code.
 * @param toCurrency - Target currency code.
 * @param exchangeRate - Rate to apply (the amount is divided by this).
 * @returns CurrencyConversion capturing the original and converted amounts.
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  exchangeRate: number
): CurrencyConversion {
  const convertedAmount = amount / exchangeRate

  return {
    originalAmount: amount,
    originalCurrency: fromCurrency,
    fromCurrency,
    toCurrency,
    convertedCurrency: toCurrency,
    amount,
    rate: exchangeRate,
    convertedAmount: Math.round(convertedAmount * 100) / 100,
    rateDate: new Date(),
    source: 'BOJ',
  }
}

/**
 * Formats a JPY/USD amount pair as a localized dual-currency string
 * (e.g. "¥1,000 ($10 @150.00)").
 *
 * @param jpyAmount - Amount in JPY.
 * @param usdAmount - Amount in USD.
 * @param exchangeRate - Rate used for the conversion (shown to 2 dp).
 * @returns Formatted dual-currency string.
 */
export function formatDualCurrency(
  jpyAmount: number,
  usdAmount: number,
  exchangeRate: number
): string {
  return `¥${jpyAmount.toLocaleString()} ($${usdAmount.toLocaleString()} @${exchangeRate.toFixed(2)})`
}

/**
 * Returns the month-end (TTM) date for the given date's month, rolled back to the
 * nearest non-weekend day.
 *
 * @param date - A date within the target month.
 * @returns The last non-weekend day of that month.
 */
export function getMonthEndTTMDate(date: Date): Date {
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0)

  while (lastDay.getDay() === 0 || lastDay.getDay() === 6) {
    lastDay.setDate(lastDay.getDate() - 1)
  }

  return lastDay
}

/**
 * Persists an exchange rate record.
 *
 * @param rate - ExchangeRate to store.
 * @throws Rejected with a Prisma error if the write fails.
 */
export async function saveExchangeRate(rate: ExchangeRate): Promise<void> {
  await prisma.exchangeRate.create({
    data: {
      rateDate: rate.rateDate,
      fromCurrency: rate.fromCurrency,
      toCurrency: rate.toCurrency,
      rate: rate.rate,
      source: rate.source,
    },
  })
}

/**
 * Currency codes supported for conversion.
 */
export const SUPPORTED_CURRENCIES = ['JPY', 'USD', 'EUR', 'GBP'] as const
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number]

/**
 * Type guard that checks whether a string is one of the supported currency codes.
 *
 * @param currency - Candidate currency code.
 * @returns True when `currency` is a {@link SupportedCurrency}.
 */
export function isValidCurrency(currency: string): currency is SupportedCurrency {
  return SUPPORTED_CURRENCIES.includes(currency as SupportedCurrency)
}
